import { describe, it, expect } from "vitest";
import {
  computeAttackPotential,
  bandForAttackPotential,
  determineSrsl,
  en50742LevelFromRating,
  en50742LikelihoodOrdinal,
  evaluateEN50742Likelihood,
  resolveExposureLevelForThreat,
  EN50742_EXPOSURE_LEVELS,
  EN50742_ATTACKER_CAPABILITY_LEVELS,
  EN50742_AP_BAND_COUNT,
  type AttackPotentialBand,
} from "features/risks/models/en50742-approach-a-core";

describe("EN 50742 — attack potential (Annex B, AP = (EL × WoO) + AC)", () => {
  it("matches the norm worked example (5×0.8)+4 = 8 → AP1", () => {
    const r = computeAttackPotential({
      exposureLevel: "EL2", // score 5
      windowOfOpportunity: "moderately_restricted", // ×0.8
      attackerCapability: "basic", // +4
    });
    expect(r.score).toBe(8);
    expect(r.band).toBe("AP1");
  });

  it("bands the one-decimal boundaries deterministically (Table B.5)", () => {
    const cases: [number, AttackPotentialBand][] = [
      [0, "AP0"], [5.0, "AP0"], [5.1, "AP1"], [10.0, "AP1"], [10.1, "AP2"],
      [15.0, "AP2"], [15.1, "AP3"], [20.0, "AP3"], [20.1, "AP4"], [99, "AP4"],
    ];
    for (const [v, b] of cases) expect(bandForAttackPotential(v)).toBe(b);
  });

  it("AC has inverted factor polarity: basic yields higher AP than advanced", () => {
    const base = { exposureLevel: "EL3", windowOfOpportunity: "unlimited" } as const;
    const advanced = computeAttackPotential({ ...base, attackerCapability: "advanced" }).score;
    const basic = computeAttackPotential({ ...base, attackerCapability: "basic" }).score;
    expect(advanced).toBe(17); // 16 + 1
    expect(basic).toBe(20); //    16 + 4
    expect(basic).toBeGreaterThan(advanced);
  });
});

describe("EN 50742 — band → likelihood ordinal (NATURAL polarity)", () => {
  it("maps AP0→1 (lowest) … AP4→5 (highest) — opposite of ISO/TVRA", () => {
    expect(en50742LikelihoodOrdinal("AP0")).toBe(1);
    expect(en50742LikelihoodOrdinal("AP4")).toBe(5);
  });

  it("is strictly increasing in the band", () => {
    const bands: AttackPotentialBand[] = ["AP0", "AP1", "AP2", "AP3", "AP4"];
    const ords = bands.map(en50742LikelihoodOrdinal);
    for (let i = 1; i < ords.length; i++) expect(ords[i]).toBeGreaterThan(ords[i - 1]);
  });

  it("exposes 5 as the source scale for normalisation", () => {
    expect(EN50742_AP_BAND_COUNT).toBe(5);
  });
});

describe("EN 50742 — level registries & rating→enum mapping", () => {
  it("orders exposure levels EL0..EL4", () => {
    expect([...EN50742_EXPOSURE_LEVELS]).toEqual(["EL0", "EL1", "EL2", "EL3", "EL4"]);
  });

  it("orders attacker capability most→least capable (index rises with AC score)", () => {
    expect([...EN50742_ATTACKER_CAPABILITY_LEVELS]).toEqual([
      "advanced", "specialist", "medium", "basic",
    ]);
  });

  it("maps a 1-based rating value to its level key", () => {
    expect(en50742LevelFromRating("exposure_level", 1)).toBe("EL0");
    expect(en50742LevelFromRating("exposure_level", 5)).toBe("EL4");
    expect(en50742LevelFromRating("attacker_capability", 1)).toBe("advanced");
    expect(en50742LevelFromRating("attacker_capability", 4)).toBe("basic");
  });

  it("returns undefined for unrated (0), out of range, or unknown factor", () => {
    expect(en50742LevelFromRating("exposure_level", 0)).toBeUndefined();
    expect(en50742LevelFromRating("exposure_level", 6)).toBeUndefined();
    expect(en50742LevelFromRating("window_of_opportunity", 1)).toBeUndefined();
  });
});

describe("EN 50742 — SRSL (Table B.6, incl. fatal extension row)", () => {
  it("looks up (band × severity), fatal saturating one band earlier", () => {
    expect(determineSrsl("AP0", "reversible")).toBe("SRSL0");
    expect(determineSrsl("AP2", "reversible")).toBe("SRSL1");
    expect(determineSrsl("AP2", "non_reversible")).toBe("SRSL2");
    expect(determineSrsl("AP0", "fatal")).toBe("SRSL1"); // never SRSL0
    expect(determineSrsl("AP2", "fatal")).toBe("SRSL3");
  });

  it("evaluateEN50742Likelihood combines AP → band → ordinal + SRSL", () => {
    const e = evaluateEN50742Likelihood(
      { exposureLevel: "EL2", windowOfOpportunity: "moderately_restricted", attackerCapability: "basic" },
      "reversible",
    );
    expect(e.attackPotential.band).toBe("AP1");
    expect(e.likelihoodOrdinal).toBe(2);
    expect(e.srsl).toBe("SRSL1");
  });

  it("Output Model C: likelihood-ordering and SRSL-ordering can flip", () => {
    // X: AP2, reversible → higher likelihood, but LOWER SRSL
    // Y: AP1, fatal      → lower likelihood, but HIGHER SRSL
    const xOrd = en50742LikelihoodOrdinal("AP2");
    const yOrd = en50742LikelihoodOrdinal("AP1");
    const xSrsl = determineSrsl("AP2", "reversible"); // SRSL1
    const ySrsl = determineSrsl("AP1", "fatal"); //      SRSL2
    expect(xOrd).toBeGreaterThan(yOrd);
    expect(srslRank(xSrsl)).toBeLessThan(srslRank(ySrsl));
  });
});

describe("EN 50742 — exposure resolution (higher-EL-wins, LOCAL, non-transitive)", () => {
  it("takes the max exposure across own EL and crossed boundaries", () => {
    expect(resolveExposureLevelForThreat({ ownEL: "EL1", crossedBoundaryELs: ["EL3"] }))
      .toEqual({ el: "EL3", source: "boundary" });
    expect(resolveExposureLevelForThreat({ ownEL: "EL4", crossedBoundaryELs: ["EL2"] }))
      .toEqual({ el: "EL4", source: "own" });
    expect(resolveExposureLevelForThreat({ crossedBoundaryELs: ["EL2", "EL0", "EL3"] }))
      .toEqual({ el: "EL3", source: "boundary" });
  });

  it("favours own on a tie", () => {
    expect(resolveExposureLevelForThreat({ ownEL: "EL2", crossedBoundaryELs: ["EL2"] }))
      .toEqual({ el: "EL2", source: "own" });
  });

  it("is non-transitive: an internal flow crossing no boundary stays EL0", () => {
    // A public EL4 boundary may exist upstream, but it is not in the local set,
    // so it must NOT leak in. EL measures direct attack surface.
    expect(resolveExposureLevelForThreat({ crossedBoundaryELs: [] }))
      .toEqual({ el: "EL0", source: "default" });
    expect(resolveExposureLevelForThreat({}))
      .toEqual({ el: "EL0", source: "default" });
  });
});

function srslRank(s: string): number {
  return ({ SRSL0: 0, SRSL1: 1, SRSL2: 2, SRSL3: 3 } as Record<string, number>)[s] ?? -1;
}