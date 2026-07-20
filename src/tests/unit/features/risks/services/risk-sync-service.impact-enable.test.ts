// src/tests/unit/features/risks/services/risk-sync-service.impact-enable.test.ts
//
// Regression cover for the impact-factor visibility bug: a threat with no asset
// link showed NO impact factors in the risk dialog, because impact factors were
// only enabled when a linked asset carried a rated criterion > 0, and the dialog
// renders only enabled factors. Impact is intrinsic to a risk — the factors must
// be enabled regardless of asset linkage (values stay 0 until rated).
//
// Pure logic, no rendering.

import { describe, it, expect } from "vitest";
import { updateImpactFactorsAutoEnable } from "features/risks/services/risk-sync-service";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";
import type { ActiveFactor } from "features/risks/models/risk-factor-types";

const IMPACT_IDS = [
  "financial_damage",
  "regulatory_compliance",
  "reputation",
  "privacy",
  "operational",
  "affected_users",
  "recoverability",
  "accountability",
  "physical_damage",
  "environmental",
  "supply_chain",
];

describe("updateImpactFactorsAutoEnable — impact is always enabled", () => {
  it("enables every impact factor even with NO asset data", () => {
    const { activeFactors } = updateImpactFactorsAutoEnable(
      DEFAULT_CONFIGURATION.activeFactors,
      undefined, // no assetDataRef — the exact asset-less case
    );
    for (const id of IMPACT_IDS) {
      const f = activeFactors.find((af) => af.factorId === id);
      expect(f?.enabled, `${id} should be enabled`).toBe(true);
    }
  });

  it("does not touch likelihood factors", () => {
    const { activeFactors } = updateImpactFactorsAutoEnable(
      DEFAULT_CONFIGURATION.activeFactors,
      undefined,
    );
    // skill_level was already enabled; a non-impact disabled one stays disabled.
    expect(
      activeFactors.find((af) => af.factorId === "skill_level")?.enabled,
    ).toBe(true);
    expect(
      activeFactors.find((af) => af.factorId === "window_of_opportunity")
        ?.enabled,
    ).toBe(false);
  });

  it("never re-enables an impact factor the analyst explicitly disabled", () => {
    const withManualDisable: ActiveFactor[] = DEFAULT_CONFIGURATION.activeFactors.map(
      (af) =>
        af.factorId === "privacy"
          ? { ...af, enabled: false, autoEnabled: false }
          : af,
    );
    const { activeFactors } = updateImpactFactorsAutoEnable(
      withManualDisable,
      undefined,
    );
    expect(
      activeFactors.find((af) => af.factorId === "privacy")?.enabled,
    ).toBe(false);
  });

  it("leaves an already-enabled impact factor enabled (idempotent)", () => {
    const preEnabled = DEFAULT_CONFIGURATION.activeFactors.map((af) =>
      af.factorId === "operational" ? { ...af, enabled: true } : af,
    );
    const { activeFactors } = updateImpactFactorsAutoEnable(
      preEnabled,
      undefined,
    );
    expect(
      activeFactors.find((af) => af.factorId === "operational")?.enabled,
    ).toBe(true);
  });
});
