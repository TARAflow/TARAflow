// src/tests/unit/app/services/asset-deletion.test.ts
import { describe, it, expect } from "vitest";
import type { Project } from "app/models/project-types";
import {
  AssetDeletionBlockedError,
  collectAssetUsage,
  purgeAssetFromProject,
} from "app/services/asset-deletion";

const A = "11111111-1111-4111-8111-111111111111"; // asset to delete
const B = "22222222-2222-4222-8222-222222222222"; // survivor

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "proj_1",
    info: { name: "p", tags: {} },
    currentPhase: 1,
    strideMethod: null,
    methodSelected: false,
    phaseStatus: {},
    settings: {},
    status: "draft",
    hazards: {
      hazards: [{ id: "H-01", label: "Crush" }],
      relations: [
        { type: "contributes_to", from: A, to: "H-01", relevance: "direct", hazardDistance: 1 },
        { type: "endangers", from: "H-01", to: B, impact: { target: "human", severity: "fatality" } },
      ],
      lastModified: "t0",
    },
    dfd: {
      elements: [
        {
          id: "e1",
          type: "Process",
          name: "PLC",
          displayId: "P1",
          position: { x: 0, y: 0 },
          size: { width: 100, height: 60 },
          assetRelations: [
            { assetId: A, assetGroup: "system", relationType: "is_a" },
            { assetId: B, assetGroup: "human", relationType: "interacts" },
          ],
        },
      ],
      connections: [],
      assets: [
        { id: A, displayId: "SY-001", name: "Controller", assetGroup: "system" },
        {
          id: B,
          displayId: "HU-001",
          name: "Operator",
          assetGroup: "human",
          assetRelations: [{ targetAssetId: A, relationType: "uses" }],
        },
      ],
      lastModified: "t0",
    },
    assets: {
      assets: [
        { id: A, displayId: "SY-001", name: "Controller" },
        { id: B, displayId: "HU-001", name: "Operator" },
      ],
      lastModified: "t0",
    },
    threats: null,
    risks: {
      risks: [{ id: "r1", linkedAssetIds: [A, B] }],
      lastModified: "t0",
    },
    attackTrees: null,
    documentation: null,
    integration: null,
    audit: null,
    ...overrides,
  } as unknown as Project;
}

describe("collectAssetUsage", () => {
  it("counts DFD, A2A and hazard references", () => {
    expect(collectAssetUsage(makeProject(), A)).toEqual({
      dfdRelations: 1,
      assetToAssetRelations: 1,
      hazardRelations: 1,
      blockingAttackTrees: [],
    });
  });

  it("reports attack trees anchored on the asset as blockers", () => {
    const p = makeProject({
      attackTrees: {
        trees: [{ id: "t1", name: "Tamper PLC", anchor: { type: "asset", assetId: A } }],
      } as unknown as Project["attackTrees"],
    });
    expect(collectAssetUsage(p, A).blockingAttackTrees).toEqual([
      { id: "t1", name: "Tamper PLC" },
    ]);
  });
});

describe("purgeAssetFromProject", () => {
  it("removes the asset and every reference, keeps the rest", () => {
    const out = purgeAssetFromProject(makeProject(), A);

    expect(out.assets!.assets.map((a) => a.id)).toEqual([B]);
    expect(out.dfd!.assets.map((a) => a.id)).toEqual([B]);
    expect(out.dfd!.elements[0].assetRelations!.map((r) => r.assetId)).toEqual([B]);
    expect(
      (out.dfd!.assets[0] as unknown as { assetRelations: unknown[] }).assetRelations,
    ).toEqual([]);
    expect(out.hazards!.relations).toHaveLength(1);
    expect(out.hazards!.relations[0].type).toBe("endangers");
    expect(out.risks!.risks[0].linkedAssetIds).toEqual([B]);
  });

  it("re-derives linkedElements so the survivor keeps its link", () => {
    const out = purgeAssetFromProject(makeProject(), A);
    expect(out.dfd!.assets[0].linkedElements?.map((l) => l.elementId)).toEqual(["e1"]);
  });

  it("is idempotent — deleting an already-removed asset changes nothing", () => {
    const once = purgeAssetFromProject(makeProject(), A);
    const twice = purgeAssetFromProject({ ...makeProject(), ...once } as Project, A);
    expect(twice.assets).toBe(once.assets);
    expect(twice.hazards).toBe(once.hazards);
    expect(twice.risks).toBe(once.risks);
    expect(twice.dfd!.assets).toEqual(once.dfd!.assets);
  });

  it("refuses while an attack tree is anchored on the asset", () => {
    const p = makeProject({
      attackTrees: {
        trees: [{ id: "t1", name: "Tamper PLC", anchor: { type: "asset", assetId: A } }],
      } as unknown as Project["attackTrees"],
    });
    expect(() => purgeAssetFromProject(p, A)).toThrow(AssetDeletionBlockedError);
  });
});
