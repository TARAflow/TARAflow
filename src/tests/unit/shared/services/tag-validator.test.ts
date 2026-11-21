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
  addTagWithOutcome,
  canonicalizeMethodTags,
  getTagWarnings,
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
    // an alias spelling is written as the catalogue tag (0.20) and brings it along too
    expect(addTagToProject(EMPTY_PROJECT_TAGS, "EN50742_B").regulation).toEqual(["EN 50742 B", "IEC 62443"]);
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

describe("method tag combinations (user 2026-11-21)", () => {
  const add = (regulation: string[], tag: string) => addTagWithOutcome(tags(regulation), tag);

  it("EN 50742 A is an addition: with the standard method or ETSI TVRA, no conflict", () => {
    expect(add(["ETSI TVRA"], "EN 50742 A")).toMatchObject({ tags: { regulation: ["ETSI TVRA", "EN 50742 A"] }, replaced: [] });
    expect(getRegulationConflicts(tags(["ETSI TVRA", "EN 50742 A"]))).toEqual([]);
  });

  it("EN 50742 B goes with ETSI TVRA and IEC 62443", () => {
    expect(add(["ETSI TVRA"], "EN 50742 B").tags.regulation).toEqual(["ETSI TVRA", "EN 50742 B", "IEC 62443"]);
    expect(getRegulationConflicts(tags(["ETSI TVRA", "EN 50742 B", "IEC 62443"]))).toEqual([]);
  });

  it("the excluded pairs: the added tag replaces the other one", () => {
    expect(add(["EN 50742 A", "CRA"], "EN 50742 B")).toMatchObject({
      tags: { regulation: ["CRA", "EN 50742 B", "IEC 62443"] },
      replaced: ["EN 50742 A"],
    });
    expect(add(["EN 50742 B", "IEC 62443"], "EN 50742 A")).toMatchObject({
      tags: { regulation: ["IEC 62443", "EN 50742 A"] },
      replaced: ["EN 50742 B"],
    });
    expect(add(["ISO 21434"], "EN 50742 A")).toMatchObject({ tags: { regulation: ["EN 50742 A"] }, replaced: ["ISO 21434"] });
    expect(add(["ETSI TVRA", "EN 50742 A"], "ISO 21434")).toMatchObject({
      tags: { regulation: ["ISO 21434"] },
      replaced: ["ETSI TVRA", "EN 50742 A"],
    });
    expect(add(["ISO 21434"], "ETSI TVRA")).toMatchObject({ tags: { regulation: ["ETSI TVRA"] }, replaced: ["ISO 21434"] });
  });

  it("the bare EN 50742 is refused; a free spelling becomes the catalogue tag", () => {
    expect(add([], "EN 50742")).toMatchObject({ tags: { regulation: [] }, refused: "en50742-approach" });
    expect(add([], "EN50742")).toMatchObject({ refused: "en50742-approach" });
    expect(add([], "EN 50742 Approach A").tags.regulation).toEqual(["EN 50742 A"]);
    expect(add([], "ISO/SAE 21434").tags.regulation).toEqual(["ISO 21434"]);
    // the same method in an old spelling goes silently
    expect(add(["EN50742_A"], "EN 50742 A")).toMatchObject({ tags: { regulation: ["EN 50742 A"] }, replaced: [] });
    // a free tag is untouched
    expect(addTagWithOutcome(EMPTY_PROJECT_TAGS, "Kiosk").tags.custom).toEqual(["Kiosk"]);
  });

  it("conflicts of projects saved before — the bare EN 50742 counts as A (was missed)", () => {
    expect(getRegulationConflicts(tags(["EN 50742", "EN 50742 B"]))).toHaveLength(1);
    expect(getRegulationConflicts(tags(["ISO 21434", "ETSI TVRA", "EN 50742 A"]))).toHaveLength(2);
  });

  it("EN 50742 B without any IEC 62443-4-2 edition is hinted; with the CRA edition not", () => {
    const hint = (r: string[]) => getTagWarnings(tags(r)).filter((w) => w.regulation === "EN 50742 B");
    expect(hint(["EN 50742 B"])).toHaveLength(1);
    expect(hint(["EN 50742 B", "EN IEC 62443 (CRA)"])).toHaveLength(0);
    expect(hint(["EN 50742 B", "IEC 62443"])).toHaveLength(0);
  });

  it("loading writes the catalogue spelling — the preset reads the same", () => {
    const old = tags(["EN 50742", "CRA", "EN50742_A"]);
    const fixed = canonicalizeMethodTags(old);
    expect(fixed.regulation).toEqual(["EN 50742 A", "CRA"]);
    expect(regulationPresetFromTags(fixed)).toBe(regulationPresetFromTags(old));
    const clean = tags(["EN 50742 A", "CRA"]);
    expect(canonicalizeMethodTags(clean)).toBe(clean);
  });
});
