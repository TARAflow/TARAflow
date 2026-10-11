// src/tests/unit/app/services/migrate_7_to_8.test.ts
//
// Schema v8: A2A relations become an edge list in assets.relations[]
// (asset-graph-view-requirements.md, D1 / AR-3).

import { describe, it, expect } from "vitest";
import { migrate_7_to_8 } from "app/services/versions/migrate-7-to-8";
import { liftLegacyA2ARelations } from "app/services/versions/lift-legacy-a2a";

function ids() {
  let n = 0;
  return () => `rel-${++n}`;
}

function v7(dfdAssets: any[], relations?: any[]): any {
  return {
    schemaVersion: 7,
    assets: {
      assets: [],
      configuration: {},
      ...(relations ? { relations } : {}),
    },
    dfd: { assets: dfdAssets, elements: [], connections: [] },
  };
}

describe("migrate_7_to_8", () => {
  it("bumps the version and adds no field when there is nothing to lift", () => {
    const out = migrate_7_to_8(v7([]));
    expect(out.schemaVersion).toBe(8);
    expect("relations" in out.assets).toBe(false);
  });

  it("keeps an existing canonical list", () => {
    const existing = [
      { id: "x", sourceAssetId: "a", targetAssetId: "b", relationType: "depends_on" },
    ];
    expect(migrate_7_to_8(v7([], existing)).assets.relations).toEqual(existing);
  });

  it("is idempotent", () => {
    const once = migrate_7_to_8(
      v7([
        {
          id: "a",
          assetRelations: [
            { sourceGroup: "data", targetGroup: "process", targetAssetId: "b", relationType: "required_by" },
          ],
        },
      ]),
    );
    const twice = migrate_7_to_8(once);
    expect(twice.assets.relations).toEqual(once.assets.relations);
  });
});

describe("liftLegacyA2ARelations", () => {
  it("lifts assetRelations and assetToAssetRelations, drops group copies, keeps attributes", () => {
    const out = liftLegacyA2ARelations(
      v7([
        {
          id: "a",
          assetRelations: [
            {
              sourceGroup: "process",
              targetGroup: "system",
              targetAssetId: "s",
              relationType: "depends_on",
              degradationMode: true,
              rationale: "fallback",
            },
          ],
          assetToAssetRelations: [
            { sourceGroup: "process", targetGroup: "function", targetAssetId: "f", relationType: "implements" },
          ],
        },
      ]),
      ids(),
    );
    expect(out.assets.relations).toEqual([
      { id: "rel-2", sourceAssetId: "a", targetAssetId: "f", relationType: "implements" },
      {
        id: "rel-1",
        sourceAssetId: "a",
        targetAssetId: "s",
        relationType: "depends_on",
        degradationMode: true,
        rationale: "fallback",
      },
    ]);
  });

  it("ignores entries without a target asset (element relations)", () => {
    const out = liftLegacyA2ARelations(
      v7([{ id: "a", assetRelations: [{ elementId: "p1", relationType: "reads" }] }]),
      ids(),
    );
    expect("relations" in out.assets).toBe(false);
  });

  it("merges exact duplicates; the existing canonical edge wins", () => {
    const existing = [
      { id: "keep", sourceAssetId: "a", targetAssetId: "b", relationType: "required_by" },
    ];
    const out = liftLegacyA2ARelations(
      v7(
        [
          {
            id: "a",
            assetRelations: [
              { targetAssetId: "b", relationType: "required_by" },
              { targetAssetId: "b", relationType: "required_by" },
              { targetAssetId: "b", relationType: "configures" },
            ],
          },
        ],
        existing,
      ),
      ids(),
    );
    expect(out.assets.relations.map((r: any) => [r.id, r.relationType])).toEqual([
      ["rel-1", "configures"],
      ["keep", "required_by"],
    ]);
  });

  it("keeps relations the rule set would reject — they are reported later, not dropped", () => {
    const out = liftLegacyA2ARelations(
      v7([{ id: "a", assetRelations: [{ targetAssetId: "a", relationType: "hosted_on" }] }]),
      ids(),
    );
    expect(out.assets.relations).toHaveLength(1);
  });

  it("does not touch dfd.assets", () => {
    const input = v7([{ id: "a", assetRelations: [{ targetAssetId: "b", relationType: "calls" }] }]);
    const out = liftLegacyA2ARelations(input, ids());
    expect(out.dfd).toBe(input.dfd);
  });
});
