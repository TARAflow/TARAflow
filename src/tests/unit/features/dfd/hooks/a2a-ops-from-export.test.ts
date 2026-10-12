// A DFD export carries A2A relations as mirror lists on its assets. On import
// they become add operations for the relations service (single write path).

import { describe, expect, it } from "vitest";
import { a2aOpsFromExport } from "features/dfd/hooks/use-dfd-export-import";

describe("a2aOpsFromExport", () => {
  it("turns each mirror entry into an add op; ids and group copies are dropped", () => {
    const ops = a2aOpsFromExport([
      {
        id: "d1",
        assetRelations: [
          {
            id: "old",
            sourceGroup: "data",
            targetGroup: "function",
            targetAssetId: "f1",
            relationType: "required_by",
            rationale: "input",
          },
        ],
      },
      { id: "f1" },
    ]);
    expect(ops).toEqual([
      {
        kind: "add",
        relation: {
          sourceAssetId: "d1",
          targetAssetId: "f1",
          relationType: "required_by",
          rationale: "input",
        },
      },
    ]);
  });

  it("ignores malformed entries", () => {
    expect(
      a2aOpsFromExport([
        { id: "d1", assetRelations: [{ relationType: "x" }, null] },
        { assetRelations: [{ targetAssetId: "f1", relationType: "reads" }] },
      ]),
    ).toEqual([]);
  });
});
