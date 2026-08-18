import { describe, it, expect } from "vitest";
import {
  REGULATION_PRESETS,
  REGULATION_PRESET_IDS,
  DEFAULT_REGULATION_PRESET,
  getRegulationPreset,
  type RegulationPresetId,
} from "shared";
describe("regulation preset catalog", () => {
  it("has an entry for every id, keyed consistently", () => {
    for (const id of REGULATION_PRESET_IDS) {
      expect(REGULATION_PRESETS[id].id).toBe(id);
    }
  });

  it("lists exactly the four known presets", () => {
    expect([...REGULATION_PRESET_IDS].sort()).toEqual(
      ["en-50742-a", "en-50742-b", "iso-21434", "owasp"].sort(),
    );
  });

  it("defaults to owasp", () => {
    expect(DEFAULT_REGULATION_PRESET).toBe("owasp");
    expect(getRegulationPreset(undefined).id).toBe("owasp");
    expect(getRegulationPreset("en-50742-a").id).toBe("en-50742-a");
  });

  it("en-50742-a activates exactly the three Annex B factors", () => {
    expect(REGULATION_PRESETS["en-50742-a"].likelihoodFactorIds).toEqual([
      "window_of_opportunity",
      "attacker_capability",
      "exposure_level",
    ]);
  });

  it("en-50742-b manages no likelihood factors (compliance-driven)", () => {
    expect(REGULATION_PRESETS["en-50742-b"].likelihoodFactorIds).toBeUndefined();
  });


  it("every preset carries name + description i18n keys", () => {
    for (const id of REGULATION_PRESET_IDS) {
      const p = REGULATION_PRESETS[id];
      expect(p.nameKey).toBe(`regulationPresets.${id}.name`);
      expect(p.descriptionKey).toBe(`regulationPresets.${id}.description`);
    }
  });
});
