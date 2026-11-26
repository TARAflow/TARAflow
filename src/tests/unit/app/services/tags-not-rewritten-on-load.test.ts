// Loading never rewrites tags (review 2026-11-21): a rewrite changed the
// file and a component's snapshot hash (about.tags). A stored alias keeps its
// spelling and is read by methodTagOf — the preset as before.
import { describe, it, expect } from "vitest";
import { parseAndRepair, repairProject } from "app/services/migration-service";
import { CURRENT_SCHEMA_VERSION } from "app/services/schema-version";
import { regulationPresetFromTags, getRegulationConflicts } from "shared";

const raw = (regulation: string[]) => ({
  id: "P",
  schemaVersion: CURRENT_SCHEMA_VERSION,
  info: { name: "Machine", description: "", tags: { domain: [], platform: [], custom: [], regulation }, team: [] },
  currentPhase: 0,
  phaseStatus: {},
  settings: {},
  hazards: null,
  dfd: null,
  assets: null,
  threats: null,
  risks: null,
  attackTrees: null,
  documentation: null,
  audit: null,
  integration: null,
});

describe("method tags on load", () => {
  it("aliases keep their spelling; the preset reads them", () => {
    for (const regulation of [["EN 50742", "CRA"], ["EN50742_A"], ["EN50742_B", "IEC 62443"], ["ISO/SAE 21434"], ["ETSI TS 102 165-1"]]) {
      expect(parseAndRepair(raw(regulation))!.info.tags.regulation).toEqual(regulation);
      expect(repairProject(raw(regulation))!.info.tags.regulation).toEqual(regulation);
    }
    expect(regulationPresetFromTags(parseAndRepair(raw(["EN 50742", "CRA"]))!.info.tags)).toBe("en-50742-a");
  });

  it("excluded combinations are kept for the analyst to resolve", () => {
    const loaded = parseAndRepair(raw(["ISO 21434", "EN50742_A"]))!;
    expect(loaded.info.tags.regulation).toEqual(["ISO 21434", "EN50742_A"]);
    expect(getRegulationConflicts(loaded.info.tags)).toHaveLength(1);
  });
});
