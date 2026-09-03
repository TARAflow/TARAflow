// src/tests/unit/features/risks/services/en50742-gate.test.ts
//
// §11.2 (part C) — calculateGatedRiskValues is the single routing point
// between the generic R=I×L path and the EN 50742 AP/SRSL path, per risk.
// The gate itself is a pure rating/config check — no DFD/threat lookup,
// because applyExposureLevelToFactorRatings() has already written the
// resolved EL into `ratings` by the time this runs (tested separately in
// en50742-exposure-level-adapter.test.ts).
//
// Pure logic, no rendering.

import { describe, it, expect } from "vitest";
import { calculateGatedRiskValues } from "features/risks/services/en50742-risk-calculation";
import { calculateRiskValues } from "features/risks/services/risk-calculation-service";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";
import type { RiskConfiguration } from "features/risks/models/risk-config-types";
import type { FactorRating } from "features/risks/models/risk-factor-types";
import type { AssetReference } from "shared";

// ── Fixtures ─────────────────────────────────────────────────────────────

function asset(
  id: string,
  physicalImpact?: "reversible_injury" | "irreversible_injury" | "fatality",
): AssetReference {
  return {
    id,
    name: id,
    assetGroup: "process",
    overallImpact: 0,
    ...(physicalImpact ? { physicalImpact } : {}),
  } as AssetReference;
}

/** en-50742-a config with EL/AC enabled and a valid WoO, unless overridden. */
function en50742Config(overrides: Partial<RiskConfiguration> = {}): RiskConfiguration {
  return {
    ...DEFAULT_CONFIGURATION,
    likelihoodMethod: "en-50742-a",
    scale: "5-level",
    windowOfOpportunity: "moderately_restricted",
    activeFactors: DEFAULT_CONFIGURATION.activeFactors.map((f) =>
      f.factorId === "exposure_level" || f.factorId === "attacker_capability"
        ? { ...f, enabled: true }
        : f,
    ),
    ...overrides,
  };
}

const elRated = (value = 3): FactorRating => ({
  factorId: "exposure_level",
  value,
  derivedValue: value,
  weight: 1,
  source: "derived",
});

const acRated = (value = 4): FactorRating => ({
  factorId: "attacker_capability",
  value,
  weight: 1,
});

// A standard (OWASP) likelihood factor — this, not EL/AC, drives R = L × I.
const likRated = (value = 3): FactorRating => ({
  factorId: "skill_level",
  value,
  weight: 1,
});

// ── Tests ────────────────────────────────────────────────────────────────

describe("calculateGatedRiskValues — non-en-50742-a projects", () => {
  it("delegates entirely to the generic path; srsl/apScore/apBand are simply absent", () => {
    const config = DEFAULT_CONFIGURATION; // likelihoodMethod undefined → "weighted-mean"
    const ratings: FactorRating[] = [
      { factorId: "skill_level", value: 3, weight: 1 },
      { factorId: "financial_damage", value: 2, weight: 1 },
    ];

    const result = calculateGatedRiskValues(ratings, config, []);
    const generic = calculateRiskValues(ratings, config);

    expect(result).toEqual(generic);
    expect(result.srsl).toBeUndefined();
    expect(result.apScore).toBeUndefined();
    expect(result.apBand).toBeUndefined();
  });
});

describe("calculateGatedRiskValues — en-50742-a projects, EL absent (gate inactive)", () => {
  it("runs the generic R×L path but marks srsl/apScore/apBand explicitly null (not undefined)", () => {
    const config = en50742Config();
    const ratings: FactorRating[] = [elRated(0), acRated(4)]; // EL unrated → no anchor

    const result = calculateGatedRiskValues(ratings, config, []);

    expect(result.srsl).toBeNull();
    expect(result.apScore).toBeNull();
    expect(result.apBand).toBeNull();
    // Still a real R×L computation via the generic path (whatever it evaluates to).
    expect(result).toMatchObject(calculateRiskValues(ratings, config));
  });

  it("treats a missing windowOfOpportunity the same as EL-absent (cannot compute AP without WoO)", () => {
    const config = en50742Config({ windowOfOpportunity: undefined });
    const ratings: FactorRating[] = [elRated(3), acRated(4)]; // EL IS rated here

    const result = calculateGatedRiskValues(ratings, config, []);

    expect(result.srsl).toBeNull();
    expect(result.apScore).toBeNull();
    expect(result.apBand).toBeNull();
  });
});

describe("calculateGatedRiskValues — en-50742-a projects, EL present (gate active)", () => {
  it("delegates to the EN 50742 path and resolves severity from linkedAssets", () => {
    const config = en50742Config();
    const ratings: FactorRating[] = [
      { factorId: "financial_damage", value: 4, weight: 1 }, // impact
      likRated(3), // OWASP likelihood → drives L (NOT EL/AC)
      elRated(3),
      acRated(4),
    ]; // EL2, basic — worked example
    const linkedAssets = [asset("A-1", "irreversible_injury")]; // → non_reversible

    const result = calculateGatedRiskValues(ratings, config, linkedAssets);

    // SRSL/AP dimension — from EL/AC/WoO/severity.
    expect(result.apBand).toBe("AP1"); // (5×0.8)+4 = 8
    expect(result.srsl).not.toBeNull();
    // R = L × I dimension — from the standard factors, present & independent.
    expect(result.likelihood).toBeGreaterThan(0);
    expect(result.risk).toBeGreaterThan(0);
    // The separation: L/R equal the pure standard computation — EL/AC do NOT
    // contribute to them.
    const generic = calculateRiskValues(ratings, config);
    expect(result.likelihood).toBe(generic.likelihood);
    expect(result.risk).toBe(generic.risk);
  });

  it("still runs AP/likelihood when severity cannot be resolved; srsl is null for THAT reason", () => {
    const config = en50742Config();
    const ratings: FactorRating[] = [
      { factorId: "financial_damage", value: 4, weight: 1 },
      likRated(3), // OWASP likelihood → drives L
      elRated(3),
      acRated(4),
    ];
    const linkedAssets: AssetReference[] = []; // no linked safety-function asset

    const result = calculateGatedRiskValues(ratings, config, linkedAssets);

    expect(result.apBand).toBe("AP1");
    expect(result.likelihood).toBeGreaterThan(0); // R×L lens unaffected by EL/AC
    expect(result.risk).toBeGreaterThan(0);
    expect(result.srsl).toBeNull(); // but no severity → no Table B.6 lookup
  });
});

describe("calculateGatedRiskValues — SRSL and R = L × I are separated", () => {
  it("EL/AC do not move likelihood or risk; only the SRSL/AP changes", () => {
    const config = en50742Config();
    const base: FactorRating[] = [
      { factorId: "financial_damage", value: 4, weight: 1 }, // impact
      likRated(3), // the only likelihood input
    ];
    const linkedAssets = [asset("A-1", "irreversible_injury")];

    const strong = calculateGatedRiskValues(
      [...base, elRated(4), acRated(4)],
      config,
      linkedAssets,
    );
    const weak = calculateGatedRiskValues(
      [...base, elRated(2), acRated(1)],
      config,
      linkedAssets,
    );

    // R = L × I identical regardless of EL/AC …
    expect(weak.likelihood).toBe(strong.likelihood);
    expect(weak.risk).toBe(strong.risk);
    // … while the SRSL/AP dimension differs.
    expect(weak.apBand).not.toBe(strong.apBand);
    expect(weak.srsl).not.toBe(strong.srsl);
  });
});
