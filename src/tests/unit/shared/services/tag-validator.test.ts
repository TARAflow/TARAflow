import { describe, it, expect } from "vitest";
import {
  regulationPresetFromTags,
  requiresHazardAnalysis,
  getRegulationConflicts,
  hasTagConflicts,
  addTagToProject,
  EMPTY_PROJECT_TAGS,
  getRegulationPreset,
  getAllPredefinedTagNames,
} from "shared";
import type { ProjectTags } from "shared";

const tags = (regulation: string[]): ProjectTags => ({
  regulation,
  domain: [],
  platform: [],
  custom: [],
});

describe("regulationPresetFromTags", () => {
  it.each([
    [[], "standard"],
    [["Automotive"], "standard"], // non-regime tag
    [["ISO 21434"], "iso-21434"],
    [["EN50742_A"], "en-50742-a"],
    [["EN 50742 Approach B"], "en-50742-b"],
    [["EN 50742"], "en-50742-a"], // bare → Approach A
    [["ETSI_TVRA"], "etsi-tvra"],
    [["ETSI TVRA"], "etsi-tvra"],
  ])("%j → %s", (regs, expected) => {
    expect(regulationPresetFromTags(tags(regs as string[]))).toBe(expected);
  });

  it("takes the first regime tag when several are present", () => {
    // (a conflict, separately warned) — derivation still returns a value
    expect(["iso-21434", "en-50742-a"]).toContain(
      regulationPresetFromTags(tags(["ISO 21434", "EN 50742"])),
    );
  });
});

describe("requiresHazardAnalysis", () => {
  it.each([
    ["EN 50742", true],
    ["EN50742_A", true],
    ["EN 50742 Approach B", true],
    ["IEC 81001", true],
    ["IEC TR 60601", true],
    ["IEC 63452", true],
    ["CLC/TS 50701", true],
    ["ISO 21434", false], // likelihood preset, not a hazard standard
    ["ETSI_TVRA", false],
    ["Automotive", false],
  ])("%s → %s", (reg, expected) => {
    expect(requiresHazardAnalysis(tags([reg]))).toBe(expected);
  });

  it("is false with no tags", () => {
    expect(requiresHazardAnalysis(tags([]))).toBe(false);
  });
});

describe("getRegulationConflicts — mutual exclusion", () => {
  it("flags two distinct method regimes (ISO 21434 vs EN 50742)", () => {
    const c = getRegulationConflicts(tags(["ISO 21434", "EN 50742 Approach A"]));
    expect(c).toHaveLength(1);
    expect(c[0].kind).toBe("mutual-exclusion");
  });

  it("flags ISO 21434 vs ETSI TVRA (both method regimes now)", () => {
    const c = getRegulationConflicts(tags(["ISO 21434", "ETSI_TVRA"]));
    expect(c.some((w) => w.kind === "mutual-exclusion")).toBe(true);
  });

  it("flags EN 50742 Approach A vs Approach B", () => {
    const c = getRegulationConflicts(tags(["EN50742_A", "EN50742_B"]));
    expect(c.some((w) => w.kind === "mutual-exclusion")).toBe(true);
  });

  it("does not flag a single regime", () => {
    expect(getRegulationConflicts(tags(["ISO 21434"]))).toHaveLength(0);
    expect(hasTagConflicts(tags(["ETSI_TVRA"]))).toBe(false);
  });

  it("does not flag non-regime tags", () => {
    expect(getRegulationConflicts(tags(["Automotive", "IoT"]))).toHaveLength(0);
  });
});

describe("EN 50742 Approach B (0.20)", () => {
  it("adding the B tag brings IEC 62443 along (user 2026-11-20), once", () => {
    const once = addTagToProject(EMPTY_PROJECT_TAGS, "EN 50742 B");
    expect(once.regulation).toEqual(["EN 50742 B", "IEC 62443"]);
    const already = addTagToProject({ ...EMPTY_PROJECT_TAGS, regulation: ["IEC 62443"] }, "EN 50742 B");
    expect(already.regulation).toEqual(["IEC 62443", "EN 50742 B"]);
    // an alias spelling (custom bucket) brings it along too
    expect(addTagToProject(EMPTY_PROJECT_TAGS, "EN50742_B").regulation).toEqual(["IEC 62443"]);
    // Approach A brings nothing along
    expect(addTagToProject(EMPTY_PROJECT_TAGS, "EN 50742 A").regulation).toEqual(["EN 50742 A"]);
  });

  it("selects the preset en-50742-b: standard factors without the motive (O16)", () => {
    const id = regulationPresetFromTags({ ...EMPTY_PROJECT_TAGS, regulation: ["EN 50742 B", "IEC 62443"] });
    expect(id).toBe("en-50742-b");
    expect(getRegulationPreset(id).likelihoodFactorIds).toEqual(["skill_level", "opportunity", "ease_of_exploit"]);
    expect(getRegulationPreset(id).likelihoodMethod).toBe("weighted-mean");
  });

  it("A and B together stay a conflict (Clause 4.1)", () => {
    expect(getRegulationConflicts({ ...EMPTY_PROJECT_TAGS, regulation: ["EN 50742 A", "EN 50742 B"] }).length).toBeGreaterThan(0);
  });

  it("the B tag is offered in the tag editor", () => {
    expect(getAllPredefinedTagNames()).toContain("EN 50742 B");
  });
});
