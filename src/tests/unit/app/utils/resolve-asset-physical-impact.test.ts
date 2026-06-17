// tests/unit/app/utils/resolve-asset-physical-impact.test.ts

import { describe, it, expect } from "vitest";

import { resolveAssetPhysicalImpact } from "app/utils/resolve-asset-physical-impact";
import type { AssetHazardSummary } from "shared/models/asset-hazard-reference-types";
import type { SafetyImpact } from "shared/models/safety-types";

const cause = (causeSeverity?: SafetyImpact): AssetHazardSummary => ({
  endangeredBy: [],
  contributesTo: [],
  worstSeverity: causeSeverity,
  causeSeverity,
  causeDirect: false,
  isHazardTarget: false,
});

/** Pure protection target: severity present, but no cause side. */
const target = (severity: SafetyImpact): AssetHazardSummary => ({
  endangeredBy: [],
  contributesTo: [],
  worstSeverity: severity,
  causeSeverity: undefined,
  isHazardTarget: true,
});

describe("resolveAssetPhysicalImpact — precedence", () => {
  it("hazard chain drives the level when nothing manual is set", () => {
    const r = resolveAssetPhysicalImpact({}, cause("fatality"));
    expect(r).toEqual({ level: "fatality", source: "hazard" });
  });

  it("manual override wins over the hazard chain", () => {
    const r = resolveAssetPhysicalImpact(
      { physicalImpact: "reversible_injury", physicalImpactSource: "manual" },
      cause("fatality"),
    );
    expect(r).toEqual({ level: "reversible_injury", source: "manual" });
  });

  it("falls back to the legacy annotation-derived value when no hazard", () => {
    const r = resolveAssetPhysicalImpact(
      {
        physicalImpact: "irreversible_injury",
        physicalImpactSource: "derived",
      },
      cause(undefined),
    );
    expect(r).toEqual({ level: "irreversible_injury", source: "annotation" });
  });

  it("hazard chain wins over a legacy annotation value", () => {
    const r = resolveAssetPhysicalImpact(
      { physicalImpact: "reversible_injury", physicalImpactSource: "derived" },
      cause("fatality"),
    );
    expect(r).toEqual({ level: "fatality", source: "hazard" });
  });

  it("a pure protection target is NOT rated by the hazard chain", () => {
    // endangered with fatality but no cause side → no attack-surface rating
    expect(resolveAssetPhysicalImpact({}, target("fatality"))).toEqual({});
  });

  it("returns empty when there is no signal at all", () => {
    expect(resolveAssetPhysicalImpact({}, undefined)).toEqual({});
  });
});