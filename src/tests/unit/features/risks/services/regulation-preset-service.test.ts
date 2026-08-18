import { describe, it, expect } from "vitest";
import type { ActiveFactor } from "features/risks/models/risk-factor-types";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";
import { ALL_PREDEFINED_FACTORS } from "features/risks/models/risk-factor-types";
import { applyRegulationPreset } from "features/risks/services/regulation-preset-service";
import { REGULATION_PRESETS, REGULATION_PRESET_IDS } from "shared";

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

const EN = ["window_of_opportunity", "attacker_capability", "exposure_level"];
const OWASP4 = ["skill_level", "motive", "opportunity", "ease_of_exploit"];

describe("applyRegulationPreset — purity", () => {
  it("does not mutate the input array or its factors", () => {
    const input = defaults();
    const snapshot = JSON.stringify(input);
    applyRegulationPreset(input, "en-50742-a");
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

describe("applyRegulationPreset — owasp → en-50742-a", () => {
  it("enables the 3 EN 50742 factors and disables the OWASP likelihood factors", () => {
    const res = applyRegulationPreset(defaults(), "en-50742-a");

    for (const id of EN) {
      expect(byId(res.activeFactors, id)?.enabled).toBe(true);
      expect(byId(res.activeFactors, id)?.autoEnabled).toBe(true);
    }
    for (const id of OWASP4) {
      expect(byId(res.activeFactors, id)?.enabled).toBe(false);
    }
    expect(res.enabled.sort()).toEqual([...EN].sort());
    expect(res.disabled.sort()).toEqual([...OWASP4].sort());
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
  it("en-50742-a → owasp restores the OWASP set and disables EN 50742", () => {
    const en = applyRegulationPreset(defaults(), "en-50742-a").activeFactors;
    const res = applyRegulationPreset(en, "owasp");

    expect(enabledIds(res.activeFactors)).toEqual(
      [...OWASP4, "deployment_scope"].sort(),
    );
    for (const id of EN) {
      expect(byId(res.activeFactors, id)?.enabled).toBe(false);
    }
  });
});

describe("applyRegulationPreset — non-destructive (analyst ownership)", () => {
  it("keeps a manually-enabled other-regime factor ON and reports it as a conflict", () => {
    const fs = defaults();
    // Analyst explicitly enabled the existing OWASP 'size' factor by hand
    // (autoEnabled: false marks it as a deliberate choice).
    const size = fs.find((f) => f.factorId === "size")!;
    size.enabled = true;
    size.autoEnabled = false;

    const res = applyRegulationPreset(fs, "en-50742-a");

    // 'size' is a regime (OWASP) likelihood factor the analyst owns → left on.
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

describe("applyRegulationPreset — iso-21434", () => {
  it("enables the ISO/ETSI factor set and disables OWASP", () => {
    const res = applyRegulationPreset(defaults(), "iso-21434");
    for (const id of ["knowledge", "expertise", "time", "equipment"]) {
      expect(byId(res.activeFactors, id)?.enabled).toBe(true);
    }
    for (const id of OWASP4) {
      expect(byId(res.activeFactors, id)?.enabled).toBe(false);
    }
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
