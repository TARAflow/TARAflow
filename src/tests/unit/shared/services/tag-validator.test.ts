import { describe, it, expect } from "vitest";
import {
  regulationPresetFromTags,
  requiresHazardAnalysis,
  getRegulationConflicts,
  hasTagConflicts,
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
