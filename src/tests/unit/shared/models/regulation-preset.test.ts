import { describe, it, expect } from "vitest";
import {
  REGULATION_PRESETS,
  REGULATION_PRESET_IDS,
  DEFAULT_REGULATION_PRESET,
  getRegulationPreset,
  getDisabledThreatGenerators,
  isThreatGeneratorEnabled,
  type RegulationPresetId,
} from "shared";
describe("regulation preset catalog", () => {
  it("has an entry for every id, keyed consistently", () => {
    for (const id of REGULATION_PRESET_IDS) {
      expect(REGULATION_PRESETS[id].id).toBe(id);
    }
  });

  it("lists exactly the five known presets", () => {
    expect([...REGULATION_PRESET_IDS].sort()).toEqual(
      ["en-50742-a", "en-50742-b", "etsi-tvra", "iso-21434", "standard"].sort(),
    );
  });

  it("defaults to standard", () => {
    expect(DEFAULT_REGULATION_PRESET).toBe("standard");
    expect(getRegulationPreset(undefined).id).toBe("standard");
    expect(getRegulationPreset("en-50742-a").id).toBe("en-50742-a");
  });

  it("en-50742-a activates exactly the two rated Annex B factors", () => {
    // WoO is project-global (Overview → RiskConfiguration.windowOfOpportunity,
    // §3.3), NOT a per-risk factor — only EL + AC are rated per risk.
    expect(REGULATION_PRESETS["en-50742-a"].likelihoodFactorIds).toEqual([
      "exposure_level",
      "attacker_capability",
    ]);
  });

  it("en-50742-b manages no likelihood factors (compliance-driven)", () => {
    expect(
      REGULATION_PRESETS["en-50742-b"].likelihoodFactorIds,
    ).toBeUndefined();
  });


  it("every preset carries name + description i18n keys", () => {
    for (const id of REGULATION_PRESET_IDS) {
      const p = REGULATION_PRESETS[id];
      expect(p.nameKey).toBe(`regulationPresets.${id}.name`);
      expect(p.descriptionKey).toBe(`regulationPresets.${id}.description`);
    }
  });
});

describe("regulation preset catalog — score-table presets", () => {
  it("iso-21434 activates the five ISO 21434 attack-potential factors", () => {
    expect(REGULATION_PRESETS["iso-21434"].likelihoodFactorIds).toEqual([
      "iso_elapsed_time",
      "iso_expertise",
      "iso_knowledge",
      "iso_window_of_opportunity",
      "iso_equipment",
    ]);
  });

  it("etsi-tvra activates the six TVRA weighted-summation factors", () => {
    expect(REGULATION_PRESETS["etsi-tvra"].likelihoodFactorIds).toEqual([
      "time",
      "expertise",
      "knowledge",
      "etsi_opportunity",
      "equipment",
      "etsi_intensity",
    ]);
  });
});

describe("threat generator activation (disabledThreatGenerators)", () => {
  it("iso-21434 disables exactly the per-interaction generator", () => {
    expect(REGULATION_PRESETS["iso-21434"].disabledThreatGenerators).toEqual([
      "per-interaction",
    ]);
    expect(getDisabledThreatGenerators("iso-21434")).toEqual([
      "per-interaction",
    ]);
  });

  it("iso-21434 keeps per-element and attack-path enabled", () => {
    expect(isThreatGeneratorEnabled("iso-21434", "per-element")).toBe(true);
    expect(isThreatGeneratorEnabled("iso-21434", "attack-path")).toBe(true);
    expect(isThreatGeneratorEnabled("iso-21434", "per-interaction")).toBe(
      false,
    );
  });

  it("no other preset disables any generator", () => {
    for (const id of REGULATION_PRESET_IDS) {
      if (id === "iso-21434") continue;
      expect(getDisabledThreatGenerators(id)).toEqual([]);
      expect(isThreatGeneratorEnabled(id, "per-interaction")).toBe(true);
    }
  });

  it("undefined preset falls back to the default and disables nothing", () => {
    expect(getDisabledThreatGenerators(undefined)).toEqual([]);
    expect(isThreatGeneratorEnabled(undefined, "per-interaction")).toBe(true);
  });
});
