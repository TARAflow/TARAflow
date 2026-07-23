// src/tests/unit/features/risks/services/risk-sync-service.impact-enable.test.ts
//
// The enabled impact factors mirror the criteria configured in the Asset Tab —
// project-wide, identically for every risk.
//
// Two bugs bracket this behaviour, and the tests below pin both edges:
//
//   1. Originally a factor was enabled only when a LINKED asset carried a rated
//      value > 0. A threat without an asset link therefore showed NO impact
//      factors at all, because the dialog renders only enabled factors.
//   2. The fix for (1) then enabled ALL eleven impact factors unconditionally,
//      which put dimensions like Supply Chain and Environmental in front of the
//      analyst on projects that never configured them.
//
// The rule that resolves both: the SET comes from the Asset Tab configuration
// (an impactRatings entry exists — its value is irrelevant), the VALUES come
// from the linked asset where there is one. Same dimensions everywhere keeps
// calculatedImpact comparable across the register.
//
// Pure logic, no rendering.

import { describe, it, expect } from "vitest";
import { updateImpactFactorsAutoEnable } from "features/risks/services/risk-sync-service";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";
import type { ActiveFactor } from "features/risks/models/risk-factor-types";
import type { AssetDataReference } from "shared";

/** The criteria this fixture project configured in the Asset Tab. */
const CONFIGURED = [
  "financial_damage",
  "regulatory_compliance",
  "operational",
  "affected_users",
  "recoverability",
];

/** Impact factors that exist but are NOT configured here. */
const NOT_CONFIGURED = [
  "reputation",
  "privacy",
  "accountability",
  "physical_damage",
  "environmental",
  "supply_chain",
];

/**
 * An asset whose impactRatings carry an ENTRY per configured criterion.
 * Values are deliberately mixed — unrated (null), not-applicable ("na") and a
 * number — because configuration is about the dimension existing, not about
 * anyone having filled it in yet.
 */
function assetData(criteria: string[] = CONFIGURED): AssetDataReference {
  return {
    assets: [
      {
        id: "DA-001",
        name: "Config Data",
        assetGroup: "data",
        impactRatings: criteria.map((criterionId, i) => ({
          criterionId,
          value: i === 0 ? 3 : i === 1 ? null : ("na" as const),
        })),
      },
    ],
    hasSafetyAssets: false,
    impactScale: "4-level",
  } as AssetDataReference;
}

describe("updateImpactFactorsAutoEnable — set follows the Asset Tab criteria", () => {
  it("enables exactly the configured criteria", () => {
    const { activeFactors } = updateImpactFactorsAutoEnable(
      DEFAULT_CONFIGURATION.activeFactors,
      assetData(),
    );
    for (const id of CONFIGURED) {
      const f = activeFactors.find((af) => af.factorId === id);
      expect(f?.enabled, `${id} should be enabled`).toBe(true);
    }
  });

  it("leaves unconfigured impact factors disabled", () => {
    const { activeFactors } = updateImpactFactorsAutoEnable(
      DEFAULT_CONFIGURATION.activeFactors,
      assetData(),
    );
    for (const id of NOT_CONFIGURED) {
      const f = activeFactors.find((af) => af.factorId === id);
      expect(f?.enabled, `${id} should stay disabled`).toBe(false);
    }
  });

  it("counts an entry as configured even when it is unrated or not applicable", () => {
    // Only null / "na" — nothing rated at all. The dimensions still exist.
    const unratedOnly = {
      assets: [
        {
          id: "DA-002",
          name: "Telemetry",
          assetGroup: "data",
          impactRatings: [
            { criterionId: "operational", value: null },
            { criterionId: "affected_users", value: "na" as const },
          ],
        },
      ],
      hasSafetyAssets: false,
    } as AssetDataReference;

    const { activeFactors } = updateImpactFactorsAutoEnable(
      DEFAULT_CONFIGURATION.activeFactors,
      unratedOnly,
    );
    expect(
      activeFactors.find((af) => af.factorId === "operational")?.enabled,
    ).toBe(true);
    expect(
      activeFactors.find((af) => af.factorId === "affected_users")?.enabled,
    ).toBe(true);
  });

  it("unions criteria across several assets", () => {
    const twoAssets = {
      assets: [
        {
          id: "DA-001",
          name: "A",
          assetGroup: "data",
          impactRatings: [{ criterionId: "operational", value: 2 }],
        },
        {
          id: "DA-002",
          name: "B",
          assetGroup: "data",
          impactRatings: [{ criterionId: "recoverability", value: 3 }],
        },
      ],
      hasSafetyAssets: false,
    } as AssetDataReference;

    const { activeFactors } = updateImpactFactorsAutoEnable(
      DEFAULT_CONFIGURATION.activeFactors,
      twoAssets,
    );
    expect(
      activeFactors.find((af) => af.factorId === "operational")?.enabled,
    ).toBe(true);
    expect(
      activeFactors.find((af) => af.factorId === "recoverability")?.enabled,
    ).toBe(true);
  });

  it("does not touch likelihood factors", () => {
    const { activeFactors } = updateImpactFactorsAutoEnable(
      DEFAULT_CONFIGURATION.activeFactors,
      assetData(),
    );
    expect(
      activeFactors.find((af) => af.factorId === "skill_level")?.enabled,
    ).toBe(true);
    expect(
      activeFactors.find((af) => af.factorId === "window_of_opportunity")
        ?.enabled,
    ).toBe(false);
  });

  it("leaves the safety factor to its own path", () => {
    // safety is configured as a criterion here, but this function must ignore
    // it — updateSafetyFactorAutoEnable owns it (physicalImpact / hazards).
    const withSafety = assetData([...CONFIGURED, "safety"]);
    const { activeFactors } = updateImpactFactorsAutoEnable(
      DEFAULT_CONFIGURATION.activeFactors,
      withSafety,
    );
    expect(activeFactors.find((af) => af.factorId === "safety")?.enabled).toBe(
      false,
    );
  });
});

describe("updateImpactFactorsAutoEnable — analyst decisions win", () => {
  it("never re-enables an impact factor the analyst explicitly disabled", () => {
    const withManualDisable: ActiveFactor[] =
      DEFAULT_CONFIGURATION.activeFactors.map((af) =>
        af.factorId === "operational"
          ? { ...af, enabled: false, autoEnabled: false }
          : af,
      );
    const { activeFactors } = updateImpactFactorsAutoEnable(
      withManualDisable,
      assetData(),
    );
    expect(
      activeFactors.find((af) => af.factorId === "operational")?.enabled,
    ).toBe(false);
  });

  it("keeps a manually enabled factor even when its criterion is not configured", () => {
    const withManualEnable: ActiveFactor[] =
      DEFAULT_CONFIGURATION.activeFactors.map((af) =>
        af.factorId === "reputation"
          ? { ...af, enabled: true, autoEnabled: false }
          : af,
      );
    const { activeFactors, autoDisabledCount } = updateImpactFactorsAutoEnable(
      withManualEnable,
      assetData(),
    );
    expect(
      activeFactors.find((af) => af.factorId === "reputation")?.enabled,
    ).toBe(true);
    expect(autoDisabledCount).toBe(0);
  });

  it("withdraws a factor it auto-enabled once its criterion disappears", () => {
    // First pass configures operational, second pass no longer does.
    const first = updateImpactFactorsAutoEnable(
      DEFAULT_CONFIGURATION.activeFactors,
      assetData(["operational"]),
    );
    expect(
      first.activeFactors.find((af) => af.factorId === "operational")?.enabled,
    ).toBe(true);

    const second = updateImpactFactorsAutoEnable(
      first.activeFactors,
      assetData(["recoverability"]),
    );
    expect(
      second.activeFactors.find((af) => af.factorId === "operational")?.enabled,
    ).toBe(false);
    expect(second.autoDisabledCount).toBe(1);
  });

  it("is idempotent — a second run changes nothing", () => {
    const first = updateImpactFactorsAutoEnable(
      DEFAULT_CONFIGURATION.activeFactors,
      assetData(),
    );
    const second = updateImpactFactorsAutoEnable(
      first.activeFactors,
      assetData(),
    );
    expect(second.autoEnabledCount).toBe(0);
    expect(second.autoDisabledCount).toBe(0);
  });
});

describe("updateImpactFactorsAutoEnable — no assets configured", () => {
  it("leaves activeFactors untouched when there is no asset data", () => {
    const { activeFactors, autoEnabledCount, autoDisabledCount } =
      updateImpactFactorsAutoEnable(
        DEFAULT_CONFIGURATION.activeFactors,
        undefined,
      );
    // A TARA without assets is an unfinished project, not a supported mode:
    // nothing to derive from, so nothing is invented.
    expect(activeFactors).toBe(DEFAULT_CONFIGURATION.activeFactors);
    expect(autoEnabledCount).toBe(0);
    expect(autoDisabledCount).toBe(0);
  });

  it("leaves activeFactors untouched when assets carry no impactRatings", () => {
    const noRatings = {
      assets: [{ id: "DA-001", name: "A", assetGroup: "data" }],
      hasSafetyAssets: false,
    } as AssetDataReference;

    const { autoEnabledCount, autoDisabledCount } =
      updateImpactFactorsAutoEnable(
        DEFAULT_CONFIGURATION.activeFactors,
        noRatings,
      );
    expect(autoEnabledCount).toBe(0);
    expect(autoDisabledCount).toBe(0);
  });
});