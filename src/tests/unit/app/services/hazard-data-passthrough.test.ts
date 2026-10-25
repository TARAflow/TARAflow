// tests/unit/app/services/hazard-data-passthrough.test.ts
//
// Hazard import design D4 (doc/InProgress/Hazard/hazard-import-iso12100-
// extensions.md): fields under `hazards` that a TARAflow version does not
// know — today HazardData.importProfiles (HI-9) and the import flags in
// HazardItem.importMeta (HI-10) — survive every write path. That is why they
// need no schema fence (ISO 21434 plan decision 15, as refined): an older
// release keeps them on save. If this test fails, a write path rebuilds
// `hazards` from known fields — then new hazard fields need a fence.

import { describe, it, expect } from "vitest";

import { hazardService } from "features/hazards/services/hazard-service";
import { repairHazardAssetRefs } from "app/services/repair-hazard-asset-refs";
import { purgeAssetFromProject } from "app/services/asset-deletion";
import { prepareForDisk } from "app/services/prepare-for-disk";
import { mergeProjectPatch } from "app/services/project-commit";
import type { Project } from "app/models/project-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const FUTURE = { futureList: [{ id: "x" }], futureFlag: true };

const hazards = (): Any => ({
  hazards: [
    { id: "HZ-1", label: "a", combinationType: "ANY", futureItemField: "keep", importMeta: { profileId: "p" } },
    { id: "HZ-2", label: "b", combinationType: "ANY" },
  ],
  relations: [
    { type: "endangers", from: "HZ-1", to: "A-1", impact: { target: "human", severity: "fatal" }, provenance: "derived" },
  ],
  lastModified: "t0",
  importProfiles: [{ id: "p", name: "p", source: { fileName: "f.xlsx", header: ["Id"] } }],
  ...FUTURE,
});

const project = (): Project =>
  ({
    id: "P",
    info: { name: "P", tags: { domain: [], platform: [], regulation: [], custom: [] } },
    assets: { assets: [{ id: "A-1", name: "Operator", assetGroup: "human" }], configuration: {} },
    dfd: null,
    risks: null,
    hazards: hazards(),
  }) as unknown as Project;

const kept = (h: Any) => {
  expect(h.importProfiles).toEqual(hazards().importProfiles);
  expect(h.futureList).toEqual(FUTURE.futureList);
  expect(h.futureFlag).toBe(true);
};

describe("unknown hazard fields survive every write path", () => {
  it("hazard service: add, update, delete", () => {
    const added = hazardService.addHazard(hazards(), { id: "HZ-3", label: "c" } as Any);
    kept(added);
    const updated = hazardService.updateHazard(added, { ...added.hazards[0], label: "a2" });
    kept(updated);
    expect((updated.hazards[0] as Any).futureItemField).toBe("keep");
    kept(hazardService.deleteHazard(updated, "HZ-2" as Any));
  });

  it("repair of hazard asset references", () => {
    const data: Any = { ...project(), hazards: { ...hazards(), relations: [{ type: "endangers", from: "HZ-1", to: "Operator" }] } };
    kept(repairHazardAssetRefs(data).hazards);
  });

  it("purging an asset that hazard edges reference", () => {
    kept(purgeAssetFromProject(project(), "A-1").hazards);
  });

  it("write channel and disk form", () => {
    const merged = mergeProjectPatch(project(), { id: "P", hazards: hazards() } as Any, "t1");
    kept(merged.hazards);
    kept(prepareForDisk(merged).hazards);
  });
});
