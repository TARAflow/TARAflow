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
  it("none for en-50742-a — its own factors (WoO/AC/EL) are no longer part of this dialog's managed set at all", () => {
    // Design simplification (superseding the earlier "method" mode): rather
    // than keep patching the lock interaction between "standard" factors and
    // EN 50742's own factors, EN 50742's factors were removed from
    // risk-config-dialog.tsx's factorGroups.likelihood entirely — they're
    // shown/rated exclusively in RiskDialog's SRSL section, auto-enabled via
    // applyRegulationPreset() when the tag is set. There is nothing left for
    // this dialog's lock system to manage for en-50742-a.
    const l = presetFactorLock("en-50742-a");
    expect(l.mode).toBe("none");
    expect(l.targets).toEqual([]);
    expect(l.lockedLikelihood).toEqual([]);
  });
  it("exclusive for iso-21434 and etsi-tvra", () => {
    expect(presetFactorLock("iso-21434").mode).toBe("exclusive");
    expect(presetFactorLock("etsi-tvra").mode).toBe("exclusive");
  });
});

describe("factorLockState — EN 50742-a (none): nothing locked, config-dialog doesn't manage these factors", () => {
  const lock = presetFactorLock("en-50742-a");
  it("EN 50742's own norm factors → editable (not shown in this dialog at all, but the function itself locks nothing)", () => {
    expect(factorLockState("exposure_level", lock)).toBe("editable");
    expect(factorLockState("attacker_capability", lock)).toBe("editable");
  });
  it("other regimes' likelihood factors → editable (never competed with en-50742-a in the first place)", () => {
    expect(factorLockState("skill_level", lock)).toBe("editable");
    expect(factorLockState("time", lock)).toBe("editable");
  });
  it("impact factor → editable (unchanged)", () => {
    expect(factorLockState("financial_damage", lock)).toBe("editable");
    expect(factorLockState("reputation", lock)).toBe("editable");
  });
  it("per-risk window_of_opportunity → editable (global WoO lives on configuration.windowOfOpportunity, unrelated to this per-risk factor id's lock state)", () => {
    expect(factorLockState("window_of_opportunity", lock)).toBe("editable");
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

describe("detectPresetFactorDrift — en-50742-a (none): never drifts", () => {
  // mode "none" short-circuits to {drifted:false,...} unconditionally — there
  // is nothing for this dialog to consider drift for en-50742-a anymore,
  // regardless of what activeFactors looks like.
  it("no drift regardless of activeFactors state — nothing is managed here", () => {
    const anything: ActiveFactor[] = [
      af("exposure_level", false), // "disabled norm target" — not drift anymore
      af("skill_level", true), // "foreign regime enabled" — not drift anymore
      af("financial_damage", true),
    ];
    const d = detectPresetFactorDrift(anything, "en-50742-a");
    expect(d.drifted).toBe(false);
    expect(d.disabledTargets).toEqual([]);
    expect(d.foreignEnabled).toEqual([]);
  });
});

describe("detectPresetFactorDrift — exclusive (ISO/TVRA)", () => {
  const norm: ActiveFactor[] = [
    af("iso_elapsed_time", true),
    af("iso_expertise", true),
    af("iso_knowledge", true),
    af("iso_window_of_opportunity", true),
    af("iso_equipment", true),
  ];
  it("only norm factors → no drift", () => {
    expect(detectPresetFactorDrift(norm, "iso-21434").drifted).toBe(false);
  });
  it("ANY enabled non-norm factor is drift — impact included", () => {
    const d = detectPresetFactorDrift(
      [...norm, af("financial_damage", true)],
      "iso-21434",
    );
    expect(d.drifted).toBe(true);
    expect(d.foreignEnabled).toEqual(["financial_damage"]);
  });
});