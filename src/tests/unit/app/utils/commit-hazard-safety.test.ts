// tests/unit/app/utils/commit-hazard-safety.test.ts

import { describe, it, expect } from "vitest";

import {
  applyHazardSafetyToAsset,
  commitHazardSafety,
} from "app/utils/commit-hazard-safety";
import type { Asset } from "features/assets";
import type {
  AssetHazardSummary,
  AssetHazardLink,
} from "shared/models/asset-hazard-reference-types";
import type { SafetyImpact, SafetyRelevance } from "shared/models/safety-types";

const mkAsset = (over: Partial<Asset>): Asset => ({
  id: "X",
  numericId: 0,
  name: "X",
  assetGroup: "system",
  impactRatings: [],
  overallImpact: 1, // → business LOW
  securityGoals: [],
  linkedDFDElements: [],
  source: "dfd",
  syncedWithDFD: true,
  created: "t0",
  lastModified: "t0",
  ...over,
});

const endangered = (severity: SafetyImpact): AssetHazardSummary => ({
  endangeredBy: [
    { hazardId: "h1", label: "Collision", role: "endangered", severity },
  ],
  contributesTo: [],
  worstSeverity: severity,
  causeSeverity: undefined, // pure target → no attack-surface rating
  isHazardTarget: true,
});

const cause = (
  severity: SafetyImpact,
  relevance: SafetyRelevance,
): AssetHazardSummary => {
  const link: AssetHazardLink = {
    hazardId: "h1",
    label: "Collision",
    role: "cause",
    severity,
    relevance,
  };
  return {
    endangeredBy: [],
    contributesTo: [link],
    worstSeverity: severity,
    causeSeverity: severity,
    causeDirect: relevance === "direct",
    isHazardTarget: false,
  };
};

describe("applyHazardSafetyToAsset — Safety Override via bowtie", () => {
  it("a pure protection target (victim only) is left untouched", () => {
    const a = mkAsset({ id: "HU-002", assetGroup: "human" });
    const r = applyHazardSafetyToAsset(a, endangered("fatality"));
    expect(r).toBe(a); // human is a consequence, not an attack surface
  });

  it("indirect cause inherits severity but does NOT trigger override → HIGH+", () => {
    const a = mkAsset({ id: "SY-001" });
    const r = applyHazardSafetyToAsset(a, cause("irreversible_injury", "indirect"));
    expect(r.physicalImpact).toBe("irreversible_injury");
    expect(r.physicalImpactSource).toBe("hazard");
    expect(r.aggregatedImpact).toBe("HIGH+");
    expect(r.physicalImpactRationale).toContain("[indirect]");
  });

  it("direct cause of a fatal hazard → override CRITICAL", () => {
    const a = mkAsset({ id: "RobotArm" });
    const r = applyHazardSafetyToAsset(a, cause("fatality", "direct"));
    expect(r.physicalImpact).toBe("fatality");
    expect(r.aggregatedImpact).toBe("CRITICAL");
  });

  it("manual override wins — asset is left untouched", () => {
    const a = mkAsset({
      physicalImpact: "reversible_injury",
      physicalImpactSource: "manual",
      physicalImpactRationale: "analyst decision",
    });
    const r = applyHazardSafetyToAsset(a, endangered("fatality"));
    expect(r).toBe(a); // same reference, no change
  });

  it("reverts to the annotation pipeline when the hazard is removed", () => {
    const a = mkAsset({
      physicalImpact: "fatality",
      physicalImpactSource: "hazard",
      physicalImpactRationale: "old chain",
      aggregatedImpact: "CRITICAL",
    });
    const r = applyHazardSafetyToAsset(a, undefined);
    expect(r.physicalImpactSource).toBeUndefined();
    expect(r.physicalImpact).toBeUndefined();
    expect(r.aggregatedImpact).toBe("LOW"); // business-only, overallImpact 1
  });

  it("uninvolved asset is returned unchanged", () => {
    const a = mkAsset({});
    expect(applyHazardSafetyToAsset(a, undefined)).toBe(a);
  });
});

describe("commitHazardSafety — reference guard", () => {
  it("returns the same AssetData when nothing changes", () => {
    const data = {
      configuration: {} as any,
      assets: [mkAsset({ id: "A" }), mkAsset({ id: "B" })],
      lastModified: "t0",
    } as any;
    expect(commitHazardSafety(data, {})).toBe(data);
  });

  it("rewrites only the governed (cause) assets", () => {
    const data = {
      configuration: {} as any,
      assets: [mkAsset({ id: "RobotArm" }), mkAsset({ id: "B" })],
      lastModified: "t0",
    } as any;
    const out = commitHazardSafety(data, {
      RobotArm: cause("fatality", "direct"),
    })!;
    expect(out).not.toBe(data);
    expect(out.assets[0].aggregatedImpact).toBe("CRITICAL");
    expect(out.assets[0].physicalImpactSource).toBe("hazard");
    expect(out.assets[1]).toBe(data.assets[1]); // untouched ref
  });
});
