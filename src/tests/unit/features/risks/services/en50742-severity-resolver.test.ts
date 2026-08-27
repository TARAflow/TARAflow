// src/tests/unit/features/risks/services/en50742-severity-resolver.test.ts
//
// §11.2 groundwork, parts A+B (pure calculation logic, no UI wiring yet):
//
//   A. resolveEN50742Severity() — worst-case physicalImpact over a risk's
//      linkedAssets, mapped onto the EN 50742 3-level vocabulary. Reuses
//      worstPhysicalImpact() (risk-calculation-service.ts), the same
//      worst-case selection the existing "Safety Impact" factor
//      (deriveSafetyValue) already uses over the same hazard-chain-resolved
//      asset.physicalImpact — see resolve-asset-physical-impact.ts.
//
//   B. evaluateEN50742Likelihood() / en50742RiskFromResolved() with severity
//      undefined: AP/likelihood must still compute (R×L lens is independent
//      of severity), but srsl must be null — NOT the same null as the
//      "el/ac unrated" case, but reached via the same field for the same
//      reason (§ EN50742CalculationResult.srsl doc: "unrated" must never be
//      mistaken for genuinely-isolated SRSL0).
//
// Pure logic, no rendering.

import { describe, it, expect } from "vitest";
import {
  resolveEN50742Severity,
  en50742RiskFromResolved,
} from "features/risks/services/en50742-risk-calculation";
import {
  evaluateEN50742Likelihood,
  determineSrsl,
} from "features/risks/models/en50742-approach-a-core";
import { worstPhysicalImpact } from "features/risks/services/risk-calculation-service";
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

const identityNormalise = (v: number, s: number, t: number): number => {
  if (v <= 0) return 0;
  if (s === t || s <= 1) return v;
  return Math.round(1 + ((v - 1) * (t - 1)) / (s - 1));
};

// ── A: severity resolver ────────────────────────────────────────────────

describe("resolveEN50742Severity (§3.6/§3.7 — worst-case physicalImpact, mapped)", () => {
  it("maps a single asset's physicalImpact onto the EN 50742 vocabulary", () => {
    expect(resolveEN50742Severity([asset("A-1", "reversible_injury")])).toBe(
      "reversible",
    );
    expect(resolveEN50742Severity([asset("A-1", "irreversible_injury")])).toBe(
      "non_reversible",
    );
    expect(resolveEN50742Severity([asset("A-1", "fatality")])).toBe("fatal");
  });

  it("takes the worst across multiple linked assets", () => {
    const linked = [
      asset("A-1", "reversible_injury"),
      asset("A-2", "fatality"),
      asset("A-3", "irreversible_injury"),
    ];
    expect(resolveEN50742Severity(linked)).toBe("fatal");
  });

  it("is undefined when no linked asset carries a physicalImpact (no safety-function link)", () => {
    expect(resolveEN50742Severity([asset("A-1"), asset("A-2")])).toBeUndefined();
    expect(resolveEN50742Severity([])).toBeUndefined();
  });

  it("shares worst-case selection with the existing Safety Impact factor (same helper)", () => {
    const linked = [asset("A-1", "irreversible_injury"), asset("A-2", "fatality")];
    // Both resolvers must agree on WHICH asset wins — they're the same
    // worst-case selection over the same source data, just mapped to
    // different target vocabularies (3-level EN 50742 vs. 4-level business).
    expect(worstPhysicalImpact(linked)).toBe("fatality");
    expect(resolveEN50742Severity(linked)).toBe("fatal");
  });
});

// ── B: optional severity in the core eval ───────────────────────────────

describe("evaluateEN50742Likelihood — severity optional (§11.2 gate)", () => {
  it("still computes AP/likelihood when severity is undefined", () => {
    const result = evaluateEN50742Likelihood(
      { exposureLevel: "EL2", windowOfOpportunity: "moderately_restricted", attackerCapability: "basic" },
      undefined,
    );
    expect(result.attackPotential.band).toBe("AP1"); // (5×0.8)+4 = 8, same worked example
    expect(result.likelihoodOrdinal).toBe(2);
    expect(result.srsl).toBeNull();
  });

  it("computes srsl normally when severity IS resolved", () => {
    const result = evaluateEN50742Likelihood(
      { exposureLevel: "EL2", windowOfOpportunity: "moderately_restricted", attackerCapability: "basic" },
      "non_reversible",
    );
    expect(result.srsl).toBe(determineSrsl(result.attackPotential.band, "non_reversible"));
    expect(result.srsl).not.toBeNull();
  });
});

describe("en50742RiskFromResolved — severity optional (§11.2 gate)", () => {
  it("R×L lens still populates with no linked safety-function severity; srsl is null", () => {
    const r = en50742RiskFromResolved(
      4,
      "EL2",
      "basic",
      "moderately_restricted",
      undefined, // no resolvable severity — EL/AC are otherwise fully rated
      5,
      identityNormalise,
    );
    expect(r.impact).toBe(4);
    expect(r.apBand).toBe("AP1");
    expect(r.likelihood).toBe(2);
    expect(r.risk).toBe(8); // R = I × L still computed — independent of severity
    expect(r.srsl).toBeNull();
  });

  it("srsl is still null (not SRSL0) when EL/AC are ALSO unrated — same field, different reason", () => {
    const r = en50742RiskFromResolved(
      4,
      undefined,
      undefined,
      "moderately_restricted",
      "fatal", // severity resolved, but EL/AC aren't — still fully unrated
      5,
      identityNormalise,
    );
    expect(r.likelihood).toBe(0);
    expect(r.risk).toBe(0);
    expect(r.srsl).toBeNull();
    expect(r.apBand).toBeNull();
  });
});
