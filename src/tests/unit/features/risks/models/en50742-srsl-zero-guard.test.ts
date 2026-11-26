// SRSL0 only for an isolated interface (0.20 item 7, coverage F2 / O3):
// Table 2 (normative) reserves SRSL0 for a completely isolated safety
// function; Table B.6 (informative) gives SRSL0 for every AP0. An interface
// above EL0 gets at least SRSL1.
import { describe, it, expect } from "vitest";
import {
  evaluateEN50742Likelihood,
  evaluateApproachA,
  guardSrslZero,
  determineSrsl,
} from "features/risks/models/en50742-approach-a-core";
import { calculateGatedRiskValues } from "features/risks/services/en50742-risk-calculation";
import { DEFAULT_CONFIGURATION, type RiskConfiguration } from "features/risks/models/risk-config-types";
import type { AssetReference } from "shared";

describe("guardSrslZero", () => {
  it("raises SRSL0 above EL0, keeps it at EL0, leaves every other SRSL", () => {
    expect(guardSrslZero("SRSL0", "EL1")).toEqual({ srsl: "SRSL1", raised: true });
    expect(guardSrslZero("SRSL0", "EL4")).toEqual({ srsl: "SRSL1", raised: true });
    expect(guardSrslZero("SRSL0", "EL0")).toEqual({ srsl: "SRSL0", raised: false });
    expect(guardSrslZero("SRSL2", "EL3")).toEqual({ srsl: "SRSL2", raised: false });
  });
});

describe("evaluateEN50742Likelihood — the case B.6 and Table 2 disagree on", () => {
  // EL1 (2) × very restricted (0.6) + advanced (1) = 2.2 → AP0 → B.6: SRSL0
  const physical = { exposureLevel: "EL1", windowOfOpportunity: "very_restricted", attackerCapability: "advanced" } as const;

  it("a physical interface at AP0: SRSL1, marked as raised; AP and band unchanged", () => {
    const r = evaluateEN50742Likelihood(physical, "reversible");
    expect(r.attackPotential.band).toBe("AP0");
    expect(determineSrsl("AP0", "reversible")).toBe("SRSL0"); // the literal table
    expect(r.srsl).toBe("SRSL1");
    expect(r.srslRaised).toBe(true);
    expect(evaluateApproachA(physical, "non_reversible").srsl).toBe("SRSL1");
  });

  it("an isolated interface (EL0) keeps SRSL0, not marked", () => {
    const r = evaluateEN50742Likelihood({ ...physical, exposureLevel: "EL0" }, "reversible");
    expect(r.srsl).toBe("SRSL0");
    expect(r).not.toHaveProperty("srslRaised");
  });

  it("no severity: no SRSL, nothing raised", () => {
    const r = evaluateEN50742Likelihood(physical, undefined);
    expect(r.srsl).toBeNull();
    expect(r).not.toHaveProperty("srslRaised");
  });
});

describe("calculateGatedRiskValues carries the mark to the risk dialog", () => {
  const config: RiskConfiguration = {
    ...DEFAULT_CONFIGURATION,
    likelihoodMethod: "en-50742-a",
    windowOfOpportunity: "very_restricted",
  };
  const sf = [{ id: "sf", name: "sf", assetGroup: "process", overallImpact: 0, physicalImpact: "reversible_major" }] as unknown as AssetReference[];
  const ratings = (el: number) => [
    { factorId: "exposure_level", value: el, weight: 1 },
    { factorId: "attacker_capability", value: 1, weight: 1 }, // advanced
  ];

  it("EL1 at AP0: SRSL1 raised", () => {
    const r = calculateGatedRiskValues(ratings(2), config, sf, true);
    expect(r.apBand).toBe("AP0");
    expect(r.srsl).toBe("SRSL1");
    expect(r.srslRaised).toBe(true);
  });
});

describe("patch 22 — SRSL0 only for a completely isolated safety function", () => {
  it("an EL0 interface of a function reachable elsewhere: raised", () => {
    expect(guardSrslZero("SRSL0", "EL0", false)).toEqual({ srsl: "SRSL1", raised: true });
    expect(guardSrslZero("SRSL0", "EL0", true)).toEqual({ srsl: "SRSL0", raised: false });
    expect(guardSrslZero("SRSL0", "EL0", undefined)).toEqual({ srsl: "SRSL0", raised: false });
    // the interface rule stays even for an "isolated" function
    expect(guardSrslZero("SRSL0", "EL1", true)).toEqual({ srsl: "SRSL1", raised: true });
  });

  it("the internal bus (EL0, AP0) of a controller with a USB port gets SRSL1", () => {
    const bus = { exposureLevel: "EL0", windowOfOpportunity: "very_restricted", attackerCapability: "advanced" } as const;
    expect(evaluateEN50742Likelihood(bus, "reversible", false)).toMatchObject({ srsl: "SRSL1", srslRaised: true });
    expect(evaluateEN50742Likelihood(bus, "reversible", true).srsl).toBe("SRSL0");
  });
});
