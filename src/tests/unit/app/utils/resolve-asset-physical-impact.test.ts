// tests/unit/app/utils/resolve-asset-physical-impact.test.ts

import { describe, it, expect } from "vitest";

import { resolveAssetPhysicalImpact } from "app/utils/resolve-asset-physical-impact";
import type { AssetHazardSummary } from "shared/models/asset-hazard-reference-types";
import type { SafetyImpact, SafetyRelevance } from "shared/models/safety-types";
import type { DFDElementLink } from "features/assets/models/dfd-asset-link-types";

const link = (relevance: SafetyRelevance, impact: SafetyImpact): DFDElementLink =>
  ({
    elementId: "E1",
    elementName: "E1",
    relationType: "uses",
    safety: { relevance, impact },
  }) as DFDElementLink;

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
    const r = resolveAssetPhysicalImpact({}, cause("fatal"));
    expect(r).toEqual({ level: "fatal", source: "hazard" });
  });

  it("manual override wins over the hazard chain", () => {
    const r = resolveAssetPhysicalImpact(
      { physicalImpact: "reversible_major", physicalImpactSource: "manual" },
      cause("fatal"),
    );
    expect(r).toEqual({ level: "reversible_major", source: "manual" });
  });

  it("falls back to the legacy annotation-derived value when no hazard", () => {
    const r = resolveAssetPhysicalImpact(
      {
        physicalImpact: "irreversible_major",
        physicalImpactSource: "derived",
      },
      cause(undefined),
    );
    expect(r).toEqual({ level: "irreversible_major", source: "annotation" });
  });

  it("worse hazard chain wins over an annotation value — flagged as conflict", () => {
    const r = resolveAssetPhysicalImpact(
      { physicalImpact: "reversible_major", physicalImpactSource: "derived" },
      cause("fatal"),
    );
    expect(r).toEqual({ level: "fatal", source: "hazard", conflict: true });
  });

  it("worse annotation wins over the hazard chain (worst-of)", () => {
    const r = resolveAssetPhysicalImpact(
      { linkedDFDElements: [link("direct", "fatal")] },
      cause("irreversible_minor"),
    );
    expect(r).toEqual({ level: "fatal", source: "annotation", conflict: true });
  });

  it("a tie goes to the hazard chain", () => {
    const r = resolveAssetPhysicalImpact(
      { linkedDFDElements: [link("indirect", "irreversible_major")] },
      cause("irreversible_major"),
    );
    expect(r).toEqual({ level: "irreversible_major", source: "hazard", conflict: true });
  });

  it("derives the annotation level fresh from the DFD links, ignoring a hazard-written value", () => {
    const r = resolveAssetPhysicalImpact(
      {
        physicalImpact: "fatal",
        physicalImpactSource: "hazard",
        linkedDFDElements: [link("indirect", "reversible_minor")],
      },
      undefined,
    );
    expect(r).toEqual({ level: "reversible_minor", source: "annotation" });
  });

  it("a pure protection target is NOT rated by the hazard chain", () => {
    // endangered with fatality but no cause side → no attack-surface rating
    expect(resolveAssetPhysicalImpact({}, target("fatal"))).toEqual({});
  });

  it("returns empty when there is no signal at all", () => {
    expect(resolveAssetPhysicalImpact({}, undefined)).toEqual({});
  });
});