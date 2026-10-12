// tests/unit/features/assets/utils/asset-links-transfer.test.ts
//
// B13: the asset export carries the asset links between the exported assets;
// the import turns them into add operations for the relations service.

import { describe, it, expect } from "vitest";
import {
  a2aOpsFromAssetExport,
  exportableRelations,
} from "features/assets/utils/asset-links-transfer";
import type { A2ARelation } from "shared";

const rel = (id: string, s: string, t: string, type: string, extra = {}): A2ARelation =>
  ({ id, sourceAssetId: s, targetAssetId: t, relationType: type, ...extra }) as A2ARelation;

describe("exportableRelations", () => {
  it("keeps only links whose both ends are exported", () => {
    const relations = [rel("r1", "a", "b", "required_by"), rel("r2", "a", "x", "configures")];
    expect(exportableRelations([{ id: "a" }, { id: "b" }], relations)).toEqual([relations[0]]);
  });

  it("no relations → empty list", () => {
    expect(exportableRelations([{ id: "a" }], undefined)).toEqual([]);
  });
});

describe("a2aOpsFromAssetExport", () => {
  it("one add operation per link, attributes kept, stored id dropped", () => {
    const ops = a2aOpsFromAssetExport(
      [rel("r1", "a", "b", "required_by", { rationale: "why", stepOrder: 2 })],
      [],
    );
    expect(ops).toEqual([
      {
        kind: "add",
        relation: {
          sourceAssetId: "a",
          targetAssetId: "b",
          relationType: "required_by",
          rationale: "why",
          stepOrder: 2,
        },
      },
    ]);
  });

  it("links that already exist in the project are skipped (re-import is no error)", () => {
    const existing = [rel("other-id", "a", "b", "required_by")];
    expect(
      a2aOpsFromAssetExport(
        [rel("r1", "a", "b", "required_by"), rel("r2", "a", "b", "configures")],
        existing,
      ).map((o) => (o.kind === "add" ? o.relation.relationType : o.kind)),
    ).toEqual(["configures"]);
  });

  it("duplicates within the file and malformed entries are dropped", () => {
    expect(
      a2aOpsFromAssetExport(
        [
          rel("r1", "a", "b", "required_by"),
          rel("r2", "a", "b", "required_by"),
          { sourceAssetId: "a", relationType: "required_by" },
          null,
        ],
        undefined,
      ),
    ).toHaveLength(1);
  });
});
