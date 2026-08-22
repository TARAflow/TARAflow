import { describe, it, expect } from "vitest";
import {
  en50742RiskFromResolved,
  calculateEN50742RiskValues,
} from "features/risks/services/en50742-risk-calculation";
import { calculateRiskValues } from "features/risks/services/risk-calculation-service";
import type { FactorRating } from "features/risks/models/risk-factor-types";
import type { RiskConfiguration } from "features/risks/models/risk-config-types";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";

// Complete config via the repo default + overrides — never a partial literal
// (a partial RiskConfiguration is what triggered TS2740 earlier).
const makeConfig = (overrides: Partial<RiskConfiguration>): RiskConfiguration => ({
  ...DEFAULT_CONFIGURATION,
  ...overrides,
});

const round1 = (n: number): number => Math.round(n * 10) / 10;

const identityNormalise = (v: number, s: number, t: number): number => {
  if (v <= 0) return 0;
  if (s === t || s <= 1) return v;
  return Math.round(1 + ((v - 1) * (t - 1)) / (s - 1));
};

describe("en50742RiskFromResolved (pure — injected normalise)", () => {
  it("composes impact × AP-band likelihood and the SRSL side output", () => {
    const r = en50742RiskFromResolved(
      4,
      "EL2",
      "basic",
      "moderately_restricted",
      "non_reversible",
      5,
      identityNormalise,
    );
    expect(r.impact).toBe(4);
    expect(r.apBand).toBe("AP1");
    expect(r.likelihood).toBe(2);
    expect(r.risk).toBe(8);
    expect(r.srsl).toBe("SRSL1");
  });

  it("guards unrated method factors: 0 likelihood/risk and SRSL null (NOT SRSL0)", () => {
    const r = en50742RiskFromResolved(4, undefined, "basic", "unlimited", "fatal", 5, identityNormalise);
    expect(r.likelihood).toBe(0);
    expect(r.risk).toBe(0);
    expect(r.srsl).toBeNull();
    expect(r.apBand).toBeNull();
  });

  it("normalises the ordinal across scales (5 bands → 4-level project scale)", () => {
    const r = en50742RiskFromResolved(
      3,
      "EL4",
      "basic",
      "unlimited",
      "fatal",
      4,
      identityNormalise,
    );
    expect(r.apBand).toBe("AP4");
    expect(r.likelihood).toBe(4);
    expect(r.srsl).toBe("SRSL3");
  });
});

describe("calculateEN50742RiskValues (wiring — extracts EL/AC from ratings)", () => {
  it("derives EL/AC + SRSL, and impact stays IDENTICAL to the generic path", () => {
    const config = makeConfig({ scale: "5-level" }); // identity normalise
    const ratings: FactorRating[] = [
      { factorId: "financial_damage", value: 4, weight: 1 },
      { factorId: "reputation", value: 2, weight: 1 },
      { factorId: "exposure_level", value: 3, weight: 1, source: "derived" }, // idx3 → EL2
      { factorId: "attacker_capability", value: 4, weight: 1 }, //                idx4 → basic
    ];
    const r = calculateEN50742RiskValues(
      ratings,
      config,
      "moderately_restricted",
      "reversible",
    );

    // Impact parity — same value the generic calc would produce (no re-derivation).
    expect(r.impact).toBe(calculateRiskValues(ratings, config).impact);

    // EN 50742-specific outputs.
    expect(r.apBand).toBe("AP1"); // (5×0.8)+4 = 8
    expect(r.likelihood).toBe(2);
    expect(r.srsl).toBe("SRSL1");

    // R = I × L composition, robust to whatever impact evaluates to.
    expect(r.risk).toBe(round1(r.impact * r.likelihood));
  });

  it("returns SRSL null when EL is unrated (absent)", () => {
    const config = makeConfig({ scale: "5-level" });
    const ratings: FactorRating[] = [
      { factorId: "financial_damage", value: 4, weight: 1 },
      { factorId: "attacker_capability", value: 4, weight: 1 },
      // exposure_level absent → unrated
    ];
    const r = calculateEN50742RiskValues(ratings, config, "unlimited", "fatal");
    expect(r.likelihood).toBe(0);
    expect(r.risk).toBe(0);
    expect(r.srsl).toBeNull();
  });
});