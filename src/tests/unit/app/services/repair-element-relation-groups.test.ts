// B15: element → asset relations take their asset's group on load.

import { describe, expect, it } from "vitest";
import { repairElementRelationGroups } from "app/services/repair-element-relation-groups";

const project = (relations: unknown[], connectionRelations: unknown[] = []) => ({
  assets: {
    assets: [
      { id: "sv", assetGroup: "service" },
      { id: "ph", assetGroup: "physical" },
      { id: "sy", assetGroup: "system" },
    ],
  },
  dfd: {
    elements: [{ id: "p", type: "Process", assetRelations: relations }],
    connections: [{ id: "f", assetRelations: connectionRelations }],
  },
});

describe("repairElementRelationGroups", () => {
  it("service uses / physical accesses stored as system / infrastructure get the asset's group", () => {
    const data = project(
      [
        { assetId: "sv", assetGroup: "system", relationType: "uses", qualifier: "api" },
        { assetId: "ph", assetGroup: "infrastructure", relationType: "accesses", qualifier: "direct" },
      ],
      [{ assetId: "sv", assetGroup: "system", relationType: "uses", qualifier: "api" }],
    );
    const out = repairElementRelationGroups(data);
    expect(out.dfd.elements[0].assetRelations.map((r: { assetGroup: string }) => r.assetGroup)).toEqual([
      "service",
      "physical",
    ]);
    expect(out.dfd.connections[0].assetRelations[0].assetGroup).toBe("service");
    // Nothing else changes: the qualifier stays as it was.
    expect(out.dfd.elements[0].assetRelations[1].qualifier).toBe("direct");
  });

  it("clean data comes back as the same object; repeated runs change nothing", () => {
    const clean = project([{ assetId: "sy", assetGroup: "system", relationType: "uses", qualifier: "api" }]);
    expect(repairElementRelationGroups(clean)).toBe(clean);
    const once = repairElementRelationGroups(project([{ assetId: "sv", assetGroup: "system", relationType: "uses" }]));
    expect(repairElementRelationGroups(once)).toBe(once);
  });

  it("relations to unknown assets and files without a DFD are left alone", () => {
    const data = project([{ assetId: "ghost", assetGroup: "system", relationType: "uses" }]);
    expect(repairElementRelationGroups(data)).toBe(data);
    const noDfd = { assets: { assets: [] } };
    expect(repairElementRelationGroups(noDfd)).toBe(noDfd);
  });

  it("falls back to the dfd.assets mirror of older files", () => {
    const data = {
      dfd: {
        assets: [{ id: "sv", assetGroup: "service" }],
        elements: [{ id: "p", assetRelations: [{ assetId: "sv", assetGroup: "system", relationType: "uses" }] }],
        connections: [],
      },
    };
    expect(repairElementRelationGroups(data).dfd.elements[0].assetRelations[0].assetGroup).toBe("service");
  });
});
