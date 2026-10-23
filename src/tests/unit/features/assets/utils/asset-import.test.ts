// B14: imported assets are added; an asset already in the project is kept
// or replaced (content only — identity and project-derived data stay).

import { describe, expect, it } from "vitest";
import { applyAssetImport, planAssetImport, remapImportedRelations } from "features/assets/utils/asset-import";
import { createDefaultAssetData, createEmptyAsset } from "features/assets/services/asset-factory";
import type { Asset } from "features/assets/models/asset-types";

const data = createDefaultAssetData();
const asset = (id: string, displayId: string, name: string, group: Asset["assetGroup"], extra: Partial<Asset> = {}): Asset => ({
  ...createEmptyAsset(id, data.configuration, group, displayId),
  name,
  displayId,
  ...extra,
});

const pump = asset("p", "DA-001", "Pump Data", "data", {
  source: "dfd",
  linkedDFDElements: [{ elementId: "e1", elementName: "P", elementType: "Process", displayId: "P-1", relationType: "reads" }],
  physicalImpact: "fatal",
  physicalImpactSource: "hazard",
});
const ctrl = asset("c", "SY-001", "Controller", "system");
const project = { ...data, assets: [pump, ctrl] };

describe("planAssetImport", () => {
  it("matches by id, else by group + name (trimmed, case-insensitive); everything else is new", () => {
    const plan = planAssetImport(project.assets, [
      asset("c", "SY-009", "Renamed", "system"),
      asset("x1", "DA-001", "  pump data ", "data"),
      asset("x2", "SY-002", "Pump Data", "system"), // same name, other group
      asset("x3", "DA-002", "Sensor Data", "data"),
    ]);
    expect(plan.conflicts.map((c) => [c.imported.id, c.existing.id, c.matchedBy])).toEqual([
      ["c", "c", "id"],
      ["x1", "p", "name"],
    ]);
    expect(plan.added.map((a) => a.id)).toEqual(["x2", "x3"]);
  });

  it("a project asset is matched at most once", () => {
    const plan = planAssetImport(project.assets, [asset("a", "DA-005", "Pump Data", "data"), asset("b", "DA-006", "Pump Data", "data")]);
    expect(plan.conflicts).toHaveLength(1);
    expect(plan.added.map((a) => a.id)).toEqual(["b"]);
  });
});

describe("applyAssetImport", () => {
  const file = [
    asset("x1", "DA-001", "Pump Data", "data", { properties: { description: "from file" }, physicalImpactSource: "derived", physicalImpact: "reversible_major" }),
    asset("x3", "DA-001", "Sensor Data", "data", {
      linkedDFDElements: [{ elementId: "foreign", elementName: "F", elementType: "Process", displayId: "P-9", relationType: "reads" }],
      physicalImpact: "fatal",
      physicalImpactSource: "hazard",
    }),
    asset("x4", "IN-001", "Cabinet", "infrastructure", { physicalImpact: "irreversible_major", physicalImpactSource: "manual", physicalImpactRationale: "pinch" }),
  ];

  it("keep is the default: the project's asset is unchanged, nothing replaced", () => {
    const plan = planAssetImport(project.assets, file);
    const r = applyAssetImport(project, plan, {});
    expect(r.assets.find((a) => a.id === "p")).toBe(pump);
    expect(r.counts).toEqual({ added: 2, replaced: 0, kept: 1 });
  });

  it("replace takes the content but keeps identity and what this project derived", () => {
    const plan = planAssetImport(project.assets, file);
    const r = applyAssetImport(project, plan, { x1: "replace" });
    const p = r.assets.find((a) => a.id === "p")!;
    expect(p.properties?.description).toBe("from file");
    expect([p.displayId, p.assetGroup, p.source]).toEqual(["DA-001", "data", "dfd"]);
    expect(p.linkedDFDElements).toBe(pump.linkedDFDElements);
    expect([p.physicalImpact, p.physicalImpactSource]).toEqual(["fatal", "hazard"]);
    expect(r.idMap.get("x1")).toBe("p");
    expect(r.counts.replaced).toBe(1);
  });

  it("added assets get a free displayId and lose what came from the other project; manual values stay", () => {
    const plan = planAssetImport(project.assets, file);
    const r = applyAssetImport(project, plan, {});
    const sensor = r.assets.find((a) => a.id === "x3")!;
    expect(sensor.displayId).toBe("DA-002"); // DA-001 is taken
    expect(sensor.numericId).toBe(2);
    expect(sensor.linkedDFDElements).toEqual([]);
    expect(sensor.physicalImpact).toBeUndefined();
    const cabinet = r.assets.find((a) => a.id === "x4")!;
    expect(cabinet.displayId).toBe("IN-001");
    expect([cabinet.physicalImpact, cabinet.physicalImpactSource]).toEqual(["irreversible_major", "manual"]);
    expect(r.assets).toHaveLength(4); // nothing deleted
  });

  it("ratings follow the project's criteria", () => {
    const foreign = asset("x5", "DA-007", "Log", "data", { impactRatings: [{ criterionId: "unknown", value: 3 }] });
    const r = applyAssetImport(project, planAssetImport(project.assets, [foreign]), {});
    const log = r.assets.find((a) => a.id === "x5")!;
    expect(log.impactRatings.map((x) => x.criterionId)).toEqual(data.configuration.impactCriteria.map((c) => c.id));
    expect(log.impactRatings.every((x) => x.value === 0)).toBe(true);
  });
});

describe("remapImportedRelations", () => {
  it("re-points to project ids and drops links of kept or missing assets", () => {
    const idMap = new Map([
      ["x1", "p"],
      ["x3", "x3"],
    ]);
    const out = remapImportedRelations(
      [
        { id: "r1", sourceAssetId: "x3", targetAssetId: "x1", relationType: "derived_from" },
        { id: "r2", sourceAssetId: "kept", targetAssetId: "x1", relationType: "required_by" },
      ],
      idMap,
    );
    expect(out).toEqual([{ id: "r1", sourceAssetId: "x3", targetAssetId: "p", relationType: "derived_from" }]);
  });
});
