import { describe, it, expect } from "vitest";
import {
  presetFactorLock,
  factorLockState,
  detectPresetFactorDrift,
} from "features/risks/services/regulation-preset-service";
import type { ActiveFactor } from "features/risks/models/risk-factor-types";

const af = (factorId: string, enabled: boolean, autoEnabled?: boolean): ActiveFactor => ({
  factorId, enabled, weight: 1, ...(autoEnabled !== undefined ? { autoEnabled } : {}),
});

describe("presetFactorLock — modes", () => {
  it("none for weighted-mean presets (standard, en-50742-b)", () => {
    expect(presetFactorLock("standard").mode).toBe("none");
    expect(presetFactorLock("en-50742-b").mode).toBe("none");
  });
  it("method for en-50742-a", () => {
    const l = presetFactorLock("en-50742-a");
    expect(l.mode).toBe("method");
    expect(l.targets).toEqual(["attacker_capability", "exposure_level"]);
    // WoO is project-global now (Overview), NOT a per-risk target — it is a
    // regime likelihood factor that stays locked OFF.
    expect(l.lockedLikelihood).toContain("window_of_opportunity");
    expect(l.lockedLikelihood).toContain("skill_level");
    expect(l.lockedLikelihood).toContain("iso_elapsed_time");
  });
  it("exclusive for iso-21434 and etsi-tvra", () => {
    expect(presetFactorLock("iso-21434").mode).toBe("exclusive");
    expect(presetFactorLock("etsi-tvra").mode).toBe("exclusive");
  });
});

describe("factorLockState — EN 50742 (method): impact editable, norm locked", () => {
  const lock = presetFactorLock("en-50742-a");
  it("norm factor → locked-on", () => {
    expect(factorLockState("exposure_level", lock)).toBe("locked-on");
  });
  it("other regime likelihood → locked-off", () => {
    expect(factorLockState("skill_level", lock)).toBe("locked-off");
    expect(factorLockState("time", lock)).toBe("locked-off");
  });
  it("impact factor → EDITABLE (feeds only R=I×L)", () => {
    expect(factorLockState("financial_damage", lock)).toBe("editable");
    expect(factorLockState("reputation", lock)).toBe("editable");
  });
  it("per-risk window_of_opportunity → locked-off (WoO is global now)", () => {
    expect(factorLockState("window_of_opportunity", lock)).toBe("locked-off");
  });
  it("unknown/custom factor → editable", () => {
    expect(factorLockState("my_custom", lock)).toBe("editable");
  });
});

describe("factorLockState — ISO/TVRA (exclusive): everything but norm locked", () => {
  const lock = presetFactorLock("iso-21434");
  it("norm factor → locked-on", () => {
    expect(factorLockState("iso_elapsed_time", lock)).toBe("locked-on");
  });
  it("impact factor → locked-off (NOT editable)", () => {
    expect(factorLockState("financial_damage", lock)).toBe("locked-off");
  });
  it("other regime + custom → locked-off", () => {
    expect(factorLockState("skill_level", lock)).toBe("locked-off");
    expect(factorLockState("my_custom", lock)).toBe("locked-off");
  });
});

describe("detectPresetFactorDrift — method (EN 50742)", () => {
  const base: ActiveFactor[] = [
    af("exposure_level", true), af("attacker_capability", true),
    af("financial_damage", true), // impact ON — allowed in method mode
  ];
  it("impact factor enabled is NOT drift in method mode", () => {
    expect(detectPresetFactorDrift(base, "en-50742-a").drifted).toBe(false);
  });
  it("disabled norm target is drift", () => {
    const d = detectPresetFactorDrift(base.map((f) => f.factorId === "exposure_level" ? af("exposure_level", false) : f), "en-50742-a");
    expect(d.disabledTargets).toEqual(["exposure_level"]);
    expect(d.drifted).toBe(true);
  });
  it("foreign regime likelihood enabled is drift", () => {
    const d = detectPresetFactorDrift([...base, af("skill_level", true)], "en-50742-a");
    expect(d.foreignEnabled).toEqual(["skill_level"]);
  });
});

describe("detectPresetFactorDrift — exclusive (ISO/TVRA)", () => {
  const norm: ActiveFactor[] = [
    af("iso_elapsed_time", true), af("iso_expertise", true), af("iso_knowledge", true),
    af("iso_window_of_opportunity", true), af("iso_equipment", true),
  ];
  it("only norm factors → no drift", () => {
    expect(detectPresetFactorDrift(norm, "iso-21434").drifted).toBe(false);
  });
  it("ANY enabled non-norm factor is drift — impact included", () => {
    const d = detectPresetFactorDrift([...norm, af("financial_damage", true)], "iso-21434");
    expect(d.drifted).toBe(true);
    expect(d.foreignEnabled).toEqual(["financial_damage"]);
  });
});
