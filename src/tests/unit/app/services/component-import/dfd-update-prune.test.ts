// src/tests/unit/app/services/component-import/dfd-update-prune.test.ts
// Multi-project TARA (design §6.7) in the production chain: a DFD update
// without the instance's multiprocess removes the instance in the same
// patch and reports it.
import { describe, expect, it } from "vitest";
import type { Project } from "app/models/project-types";
import { buildDfdUpdate } from "app/services/dfd-update-patch";
import { componentInstanceTfId, instanceAssetId } from "features/dfd";

const element = (id: string, type: string) => ({ id, displayId: id, name: id, type, position: { x: 0, y: 0 }, size: { width: 10, height: 10 }, properties: {} });

const current = {
  id: "machine",
  info: { name: "Panel", tags: { domain: [], platform: [], regulation: [], custom: [] } },
  phaseStatus: {},
  assets: null,
  threats: null,
  risks: null,
  hazards: null,
  dfd: { elements: [element("p1", "Process"), element("mp1", "Multiprocess")], connections: [], assets: [] },
  components: {
    imports: [{ id: "imp", componentId: "cam", name: "Camera", source: { commitSha: "a", schemaVersion: 14 }, importedAt: "t", methodology: { likelihoodMethod: "x", factors: [], hash: "" }, snapshot: {}, contentHash: "h" }],
    instances: [{ id: "i1", importId: "imp", multiprocessTfId: "mp1", prefix: "CAM1", eeMapping: [], assumptions: [] }],
  },
} as unknown as Project;

describe("buildDfdUpdate — deleted component multiprocess", () => {
  it("removes the instance (and the import with its last instance) and reports it", () => {
    const out = buildDfdUpdate(current, {
      dfd: { elements: [element("p1", "Process")], connections: [], assets: [] },
      phaseStatus: {},
      lastModified: "x",
    } as never);
    expect(out.removedComponentInstances).toEqual([{ prefix: "CAM1", component: "Camera", assetIds: [], threatIds: [] }]);
    expect(out.patch.components).toEqual({ imports: [], instances: [] });
  });

  it("keeps components untouched when the multiprocess stays", () => {
    const out = buildDfdUpdate(current, { dfd: current.dfd, phaseStatus: {}, lastModified: "x" } as never);
    expect(out.removedComponentInstances).toEqual([]);
    expect("components" in out.patch).toBe(false);
  });

  it("purges the instance's assets from the store and the DFD mirror (E5)", () => {
    const assetId = instanceAssetId("i1", "a1");
    const withAsset = {
      ...current,
      assets: { configuration: { impactScale: "4-level", impactCriteria: [] }, assets: [{ id: assetId, name: "Firmware", assetGroup: "data", impactRatings: [], securityGoals: [], linkedDFDElements: [], source: "dfd", syncedWithDFD: true, created: "", lastModified: "" }], relations: [], lastModified: "" },
      dfd: { ...current.dfd!, assets: [{ id: assetId, displayId: "CAM1:DA-1", name: "Firmware", assetGroup: "data" }] },
      components: { ...current.components!, imports: [{ ...current.components!.imports[0], snapshot: { assets: [{ id: "a1" }] } }] },
    } as unknown as Project;
    const out = buildDfdUpdate(withAsset, {
      dfd: { elements: [element("p1", "Process")], connections: [], assets: withAsset.dfd!.assets },
      phaseStatus: {},
      lastModified: "x",
    } as never);
    expect(out.removedComponentInstances[0].assetIds).toEqual([assetId]);
    expect(out.patch.assets!.assets.some((a) => a.id === assetId)).toBe(false);
    expect((out.patch.dfd!.assets ?? []).some((a) => a.id === assetId)).toBe(false);
  });

  it("removes the risks of the instance's imported threats and the concept's references to them (example project 2026-11-10)", () => {
    const threatId = componentInstanceTfId("i1", "threat|t1");
    const withRisk = {
      ...current,
      risks: { configuration: {}, risks: [{ id: "R-x", threatId }, { id: "R-own", threatId: "own" }], lastModified: "" },
      cybersecurityConcept: { goals: [{ id: "g", displayId: "CSG-01", riskIds: ["R-x", "R-own"] }], claims: [] },
      components: {
        ...current.components!,
        imports: [{ ...current.components!.imports[0], snapshot: { assets: [], threats: { perElementTables: [{ threats: [{ id: "t1" }] }], perInteractionTables: [] } } }],
      },
    } as unknown as Project;
    const out = buildDfdUpdate(withRisk, { dfd: { elements: [element("p1", "Process")], connections: [], assets: [] }, phaseStatus: {}, lastModified: "x" } as never);
    expect(out.removedComponentInstances[0].threatIds).toEqual([threatId]);
    expect(out.patch.risks!.risks.map((r) => r.id)).toEqual(["R-own"]);
    expect(out.patch.cybersecurityConcept!.goals[0].riskIds).toEqual(["R-own"]);
  });
});
