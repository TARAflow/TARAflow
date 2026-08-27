// src/tests/unit/features/risks/services/regulation-preset-service.test.ts
//
// History note: the 14 tests below `applyRegulationPreset — purity` through
// `applyRegulationPreset — etsi-tvra` are the ORIGINAL test suite for this
// module (commit 904443d). They were briefly overwritten by a narrower
// bugfix-regression file during EN 50742 SRSL work and have been restored
// here, alongside the newer presetFactorLock/factorLockState tests added
// during that work (kept in their own describe blocks below, not merged in,
// to avoid conflating two different testing angles: full-DEFAULT_CONFIGURATION
// fixtures here vs. minimal fixtures there).
//
// Two of the 14 needed correcting for the mode-aware regime-pool fix (see
// regulation-preset-service.ts, METHOD_REGIME_SOURCES vs
// EXCLUSIVE_REGIME_SOURCES):
//
//   - "enables the 3 EN 50742 factors and disables the standard likelihood
//     factors" — depended on the ORIGINAL bug (applying en-50742-a used to
//     disable standard factors too). Corrected: en-50742-a is "method" mode
//     and must leave standard factors untouched entirely.
//   - "keeps a manually-enabled other-regime factor ON and reports it as a
//     conflict" — used "size" (a standard-source factor) against en-50742-a.
//     Since "standard" is no longer regime-managed under "method" mode,
//     "size" can never conflict with en-50742-a anymore. Switched the
//     target preset to "iso-21434" (exclusive mode, where "standard" IS
//     still regime-managed) — same fixture, same assertions, now testing a
//     scenario that's actually still possible.
//
// All other 12 of the original 14 remain valid unchanged: the mode-aware fix
// specifically PRESERVES the "exclusive" methods' (iso-21434/etsi-tvra)
// original behaviour of disabling standard factors — only "method" mode
// (en-50742-a) was ever wrong.

import { describe, it, expect } from "vitest";
import {
  applyRegulationPreset,
  presetFactorLock,
  factorLockState,
} from "features/risks/services/regulation-preset-service";
import type { ActiveFactor } from "features/risks/models/risk-factor-types";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";
import { ALL_PREDEFINED_FACTORS } from "features/risks/models/risk-factor-types";
import { REGULATION_PRESETS, REGULATION_PRESET_IDS } from "shared";

// ═══════════════════════════════════════════════════════════════════════
// Original 14 (restored from 904443d, 2 corrected — see header note)
// ═══════════════════════════════════════════════════════════════════════

// A fresh copy of the app-default activeFactors for each test.
const defaults = (): ActiveFactor[] =>
  DEFAULT_CONFIGURATION.activeFactors.map((f) => ({ ...f }));

const byId = (fs: ActiveFactor[], id: string) =>
  fs.find((f) => f.factorId === id);
const enabledIds = (fs: ActiveFactor[]) =>
  fs
    .filter((f) => f.enabled)
    .map((f) => f.factorId)
    .sort();

const EN = ["attacker_capability", "exposure_level"];
const STANDARD4 = ["skill_level", "motive", "opportunity", "ease_of_exploit"];

describe("applyRegulationPreset — purity", () => {
  it("does not mutate the input array or its factors", () => {
    const input = defaults();
    const snapshot = JSON.stringify(input);
    applyRegulationPreset(input, "en-50742-a");
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

describe("applyRegulationPreset — standard → en-50742-a", () => {
  it("enables the EN 50742 factors; standard likelihood factors are untouched (not regime-managed by 'method' mode)", () => {
    const res = applyRegulationPreset(defaults(), "en-50742-a");

    for (const id of EN) {
      expect(byId(res.activeFactors, id)?.enabled).toBe(true);
      expect(byId(res.activeFactors, id)?.autoEnabled).toBe(true);
    }
    // CORRECTED (was: expect disabled) — "standard" factors are never
    // regime-managed by en-50742-a; they stay exactly as ship-default
    // enabled them, unaffected by the preset switch.
    for (const id of STANDARD4) {
      expect(byId(res.activeFactors, id)?.enabled).toBe(true);
    }
    expect(res.enabled.sort()).toEqual([...EN].sort());
    expect(res.disabled).toEqual([]); // nothing disabled — standard stays as-is
    expect(res.conflicts).toEqual([]);
    expect(res.changed).toBe(true);
  });

  it("leaves non-regime factors (deployment_scope, impacts, safety) untouched", () => {
    const res = applyRegulationPreset(defaults(), "en-50742-a");
    // deployment_scope is enabled by default and is a custom (non-regime) factor
    expect(byId(res.activeFactors, "deployment_scope")?.enabled).toBe(true);
    // impact + safety factors stay disabled exactly as before
    expect(byId(res.activeFactors, "safety")?.enabled).toBe(false);
    expect(byId(res.activeFactors, "operational")?.enabled).toBe(false);
  });
});

describe("applyRegulationPreset — round trip", () => {
  it("en-50742-a → standard restores the standard set and disables EN 50742", () => {
    const en = applyRegulationPreset(defaults(), "en-50742-a").activeFactors;
    const res = applyRegulationPreset(en, "standard");

    expect(enabledIds(res.activeFactors)).toEqual(
      [...STANDARD4, "deployment_scope"].sort(),
    );
    for (const id of EN) {
      expect(byId(res.activeFactors, id)?.enabled).toBe(false);
    }
  });
});

describe("applyRegulationPreset — non-destructive (analyst ownership)", () => {
  it("keeps a manually-enabled other-regime factor ON and reports it as a conflict (exclusive mode)", () => {
    // CORRECTED: target preset changed from en-50742-a to iso-21434.
    // "size" (source: "standard") is no longer regime-managed by "method"
    // mode (en-50742-a) at all — see the standard-factors tests below for
    // that behaviour. "Exclusive" mode (iso-21434/etsi-tvra) is where
    // standard factors ARE still regime-managed (EXCLUSIVE_REGIME_SOURCES
    // includes "standard"), so this conflict scenario is still valid there
    // — same fixture and assertions as the original test.
    const fs = defaults();
    const size = fs.find((f) => f.factorId === "size")!;
    size.enabled = true;
    size.autoEnabled = false;

    const res = applyRegulationPreset(fs, "iso-21434");

    expect(byId(res.activeFactors, "size")?.enabled).toBe(true);
    expect(res.conflicts).toContain("size");
    expect(res.disabled).not.toContain("size");
  });

  it("enables a target factor that was disabled by default (autoEnabled undefined)", () => {
    // exposure_level ships disabled with autoEnabled undefined → apply enables it
    const res = applyRegulationPreset(defaults(), "en-50742-a");
    expect(byId(res.activeFactors, "exposure_level")?.enabled).toBe(true);
    expect(byId(res.activeFactors, "exposure_level")?.autoEnabled).toBe(true);
  });
});

describe("applyRegulationPreset — missing target factor", () => {
  it("adds a target factor that is absent from activeFactors", () => {
    const fs = defaults().filter((f) => f.factorId !== "exposure_level");
    expect(byId(fs, "exposure_level")).toBeUndefined();

    const res = applyRegulationPreset(fs, "en-50742-a");
    const added = byId(res.activeFactors, "exposure_level");
    expect(added?.enabled).toBe(true);
    expect(added?.autoEnabled).toBe(true);
    expect(res.enabled).toContain("exposure_level");
  });
});

describe("applyRegulationPreset — idempotence & no-op presets", () => {
  it("applying the same preset twice is a no-op the second time", () => {
    const once = applyRegulationPreset(defaults(), "en-50742-a").activeFactors;
    const twice = applyRegulationPreset(once, "en-50742-a");
    expect(twice.changed).toBe(false);
    expect(twice.enabled).toEqual([]);
    expect(twice.disabled).toEqual([]);
  });

  it("en-50742-b does not touch activeFactors (compliance-driven)", () => {
    const fs = defaults();
    const res = applyRegulationPreset(fs, "en-50742-b");
    expect(res.changed).toBe(false);
    expect(res.activeFactors).toBe(fs); // same reference — untouched
    expect(res.enabled).toEqual([]);
    expect(res.disabled).toEqual([]);
  });
});

describe("preset factor ids resolve against the factor catalog", () => {
  const known = new Set(ALL_PREDEFINED_FACTORS.map((f) => f.id));
  it("every declared likelihood factor id exists", () => {
    for (const id of REGULATION_PRESET_IDS) {
      for (const fid of REGULATION_PRESETS[id].likelihoodFactorIds ?? []) {
        expect(known.has(fid)).toBe(true);
      }
    }
  });
});

describe("applyRegulationPreset — iso-21434 (factors absent from defaults)", () => {
  const ISO = [
    "iso_elapsed_time",
    "iso_expertise",
    "iso_knowledge",
    "iso_window_of_opportunity",
    "iso_equipment",
  ];

  it("adds and enables all five ISO factors and disables the standard set", () => {
    const res = applyRegulationPreset(defaults(), "iso-21434");
    for (const id of ISO) {
      expect(byId(res.activeFactors, id)?.enabled).toBe(true);
      expect(byId(res.activeFactors, id)?.autoEnabled).toBe(true);
      expect(res.enabled).toContain(id); // added, since not in DEFAULT_CONFIGURATION
    }
    for (const id of [
      "skill_level",
      "motive",
      "opportunity",
      "ease_of_exploit",
    ]) {
      expect(byId(res.activeFactors, id)?.enabled).toBe(false);
    }
    expect(res.changed).toBe(true);
  });

  it("round-trips back to standard", () => {
    const iso = applyRegulationPreset(defaults(), "iso-21434").activeFactors;
    const back = applyRegulationPreset(iso, "standard");
    for (const id of ISO) {
      expect(byId(back.activeFactors, id)?.enabled).toBe(false);
    }
    expect(byId(back.activeFactors, "skill_level")?.enabled).toBe(true);
  });

  it("is idempotent", () => {
    const iso = applyRegulationPreset(defaults(), "iso-21434").activeFactors;
    expect(applyRegulationPreset(iso, "iso-21434").changed).toBe(false);
  });
});

describe("applyRegulationPreset — etsi-tvra (mix of existing + new factors)", () => {
  it("enables the four existing ETSI factors and adds the two new ones", () => {
    const res = applyRegulationPreset(defaults(), "etsi-tvra");
    // present in DEFAULT_CONFIGURATION (disabled) → enabled, not 'added'
    for (const id of ["time", "expertise", "knowledge", "equipment"]) {
      expect(byId(res.activeFactors, id)?.enabled).toBe(true);
    }
    // absent from DEFAULT_CONFIGURATION → added + enabled
    for (const id of ["etsi_opportunity", "etsi_intensity"]) {
      expect(byId(res.activeFactors, id)?.enabled).toBe(true);
      expect(res.enabled).toContain(id);
    }
    for (const id of [
      "skill_level",
      "motive",
      "opportunity",
      "ease_of_exploit",
    ]) {
      expect(byId(res.activeFactors, id)?.enabled).toBe(false);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// presetFactorLock / factorLockState — added during EN 50742 SRSL work.
// Minimal fixtures (not full DEFAULT_CONFIGURATION) — a different testing
// angle than the section above: these test the dialog's LOCK DISPLAY
// directly, independent of any particular activeFactors starting state.
// ═══════════════════════════════════════════════════════════════════════

const STANDARD_LIKELIHOOD_IDS = [
  "skill_level",
  "motive",
  "opportunity",
  "ease_of_exploit",
];

function activeFactorsWithStandardEnabled(): ActiveFactor[] {
  return STANDARD_LIKELIHOOD_IDS.map((factorId) => ({
    factorId,
    enabled: true,
    weight: 1.0,
  }));
}

describe("presetFactorLock — en-50742-a manages nothing (mode 'none')", () => {
  it("returns mode 'none' — config-dialog no longer manages en-50742-a's own factors", () => {
    const lock = presetFactorLock("en-50742-a");
    expect(lock.mode).toBe("none");
    expect(lock.targets).toEqual([]);
    expect(lock.lockedLikelihood).toEqual([]);
  });

  it("factorLockState reports every factor as editable — nothing locked at all", () => {
    const lock = presetFactorLock("en-50742-a");
    for (const id of [
      ...STANDARD_LIKELIHOOD_IDS,
      "exposure_level",
      "attacker_capability",
    ]) {
      expect(factorLockState(id, lock)).toBe("editable");
    }
  });
});

describe("applyRegulationPreset — en-50742-a leaves pre-enabled standard factors alone", () => {
  it("does not disable standard factors that were already enabled", () => {
    const result = applyRegulationPreset(
      activeFactorsWithStandardEnabled(),
      "en-50742-a",
    );

    for (const id of STANDARD_LIKELIHOOD_IDS) {
      const factor = result.activeFactors.find((f) => f.factorId === id);
      expect(factor?.enabled).toBe(true);
    }
    expect(result.disabled).not.toEqual(
      expect.arrayContaining(STANDARD_LIKELIHOOD_IDS),
    );
  });

  it("still auto-enables the norm's own targets (EL/AC) — the sole enabling mechanism now that config-dialog doesn't manage them", () => {
    const result = applyRegulationPreset(
      activeFactorsWithStandardEnabled(),
      "en-50742-a",
    );
    const el = result.activeFactors.find(
      (f) => f.factorId === "exposure_level",
    );
    const ac = result.activeFactors.find(
      (f) => f.factorId === "attacker_capability",
    );
    expect(el?.enabled).toBe(true);
    expect(ac?.enabled).toBe(true);
  });
});

describe("presetFactorLock — 'exclusive' mode (iso-21434) is unaffected by either fix", () => {
  it("still locks off standard factors entirely (regression guard)", () => {
    const lock = presetFactorLock("iso-21434");
    expect(lock.mode).toBe("exclusive");
    for (const id of STANDARD_LIKELIHOOD_IDS) {
      expect(factorLockState(id, lock)).toBe("locked-off");
    }
  });
});