// tests/unit/features/assets/services/asset-validator.protection-target.test.ts
//
// Pure hazard protection targets (endangered by a HazardItem, never a cause)
// are reached through the bowtie, not through the DFD, and carry no CIANAAA
// goal of their own — the asset validation must not demand either.

import { describe, it, expect } from "vitest";
import {
  collectAssetFindings,
  isPureProtectionTarget,
  validateAssetData,
  type AssetHazardLinks,
} from "features/assets/services/asset-validator";
import type { AssetData, Asset } from "features/assets/models/asset-types";
import type { AssetHazardSummary } from "shared/models/asset-hazard-reference-types";

const TYPES = ["C", "I", "A", "N", "AuthZ", "AuthN", "Acc"];

function human(id: string, displayId: string, name: string): Asset {
  return {
    id,
    displayId,
    name,
    assetGroup: "human",
    properties: {},
    impactRatings: [],
    linkedDFDElements: [],
    securityGoals: TYPES.map((type) => ({ type, level: "none", formalDescription: "" })),
  } as unknown as Asset;
}

const data = (...assets: Asset[]): AssetData =>
  ({ assets, configuration: { impactScale: "4-level" } }) as unknown as AssetData;

const summary = (over: Partial<AssetHazardSummary>): AssetHazardSummary => ({
  endangeredBy: [],
  contributesTo: [],
  isHazardTarget: false,
  ...over,
});

const endangered = summary({
  isHazardTarget: true,
  endangeredBy: [{ hazardId: "H-01", label: "Fire not detected", role: "endangered", severity: "fatal" }],
});

const keysOf = (assetData: AssetData, links?: AssetHazardLinks) =>
  collectAssetFindings(assetData, undefined, links)
    .filter((f) => f.assetId)
    .map((f) => `${f.key}:${f.assetLabel}`);

describe("pure protection targets", () => {
  it("isPureProtectionTarget: endangered and no cause", () => {
    expect(isPureProtectionTarget(endangered)).toBe(true);
    expect(isPureProtectionTarget(undefined)).toBe(false);
    expect(isPureProtectionTarget(summary({}))).toBe(false);
    expect(
      isPureProtectionTarget({
        ...endangered,
        contributesTo: [{ hazardId: "H-02", label: "x", role: "cause", relevance: "indirect" }],
      }),
    ).toBe(false);
  });

  it("without hazard links the checks run as before", () => {
    expect(keysOf(data(human("u1", "HU-001", "Occupants")))).toEqual([
      "tabs.assets.validation.noSecurityGoal:HU-001 (Occupants)",
      "tabs.assets.validation.notLinkedToDFD:HU-001 (Occupants)",
    ]);
  });

  it("endangered-only asset: no security-goal error, no DFD-link warning", () => {
    expect(keysOf(data(human("u1", "HU-001", "Occupants")), { u1: endangered })).toEqual([]);
  });

  it("an asset that is also a cause keeps both checks", () => {
    const both = {
      ...endangered,
      contributesTo: [{ hazardId: "H-02", label: "x", role: "cause" as const, relevance: "indirect" as const }],
    };
    expect(keysOf(data(human("u1", "HU-001", "Occupants")), { u1: both })).toHaveLength(2);
  });

  it("an unrelated asset is not exempted by another asset's links", () => {
    const a = human("u1", "HU-001", "Occupants");
    const b = human("u2", "HU-002", "Visitor");
    expect(keysOf(data(a, b), { u1: endangered })).toEqual([
      "tabs.assets.validation.noSecurityGoal:HU-002 (Visitor)",
      "tabs.assets.validation.notLinkedToDFD:HU-002 (Visitor)",
    ]);
  });

  it("validateAssetData: the persisted validation (phase status) follows", () => {
    const d = data(human("u1", "HU-001", "Occupants"));
    expect(validateAssetData(d).isComplete).toBe(false);
    expect(validateAssetData(d, { u1: endangered }).isComplete).toBe(true);
  });
});

describe("double safety modelling (annotation + hazard item)", () => {
  const KEY = "tabs.assets.validation.safetyDoubleModelling";
  const withAnnotation = (a: Asset): Asset =>
    ({
      ...a,
      linkedDFDElements: [
        {
          elementId: "P1",
          elementName: "PLC",
          elementType: "Process",
          displayId: "P1",
          relationType: "controls",
          safety: { relevance: "direct", impact: "fatal" },
        },
      ],
    }) as Asset;

  it("warns when an annotated asset also takes part in a hazard", () => {
    const a = withAnnotation(human("h1", "HU-001", "Operator"));
    const keys = keysOf(data(a), { h1: endangered });
    expect(keys).toContain(`${KEY}:HU-001 (Operator)`);
  });

  it("does not warn with only one of the two paths", () => {
    const annotatedOnly = withAnnotation(human("h1", "HU-001", "Operator"));
    expect(keysOf(data(annotatedOnly), {})).not.toContain(`${KEY}:HU-001 (Operator)`);
    const hazardOnly = human("h2", "HU-002", "Service");
    expect(keysOf(data(hazardOnly), { h2: endangered })).not.toContain(
      `${KEY}:HU-002 (Service)`,
    );
  });

  it("does not warn for a manual override", () => {
    const a = {
      ...withAnnotation(human("h1", "HU-001", "Operator")),
      physicalImpact: "fatal",
      physicalImpactSource: "manual",
      physicalImpactRationale: "analyst",
    } as Asset;
    expect(keysOf(data(a), { h1: endangered })).not.toContain(`${KEY}:HU-001 (Operator)`);
  });
});
