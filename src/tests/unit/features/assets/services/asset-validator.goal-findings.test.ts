// tests/unit/features/assets/services/asset-validator.goal-findings.test.ts
//
// Asset validation carries the security-goal findings from goalFindings():
// warnings for missing rationale / assessment / changed basis, infos for
// legitimate-but-notable states. Infos never affect completeness.

import { describe, it, expect } from "vitest";
import { validateAssetData, derivePhaseStatus } from "features/assets/services/asset-validator";
import { adjustGoal } from "features/assets/services/asset-goal-state";
import { deriveSecurityGoalSuggestions } from "features/assets/services/asset-cianaaa-deriver";
import type { AssetData, Asset } from "features/assets/models/asset-types";
import type { ImpactRating } from "features/assets/models/asset-impact-types";

const TYPES = ["C", "I", "A", "N", "AuthZ", "AuthN", "Acc"];

function asset(impactRatings: ImpactRating[]): Asset {
  const base = {
    id: "uuid-1",
    displayId: "A-001",
    name: "Config DB",
    assetGroup: "data",
    properties: {},
    impactRatings,
    linkedDFDElements: [{ elementId: "E-1", elementName: "Flow", relationType: "transports" }],
    securityGoals: TYPES.map((type) => ({ type, level: "none", formalDescription: "desc" })),
  } as unknown as Asset;
  return { ...base, securityGoals: deriveSecurityGoalSuggestions(base, base.securityGoals, "4-level") };
}

const data = (a: Asset): AssetData =>
  ({ assets: [a], configuration: { impactScale: "4-level" } }) as unknown as AssetData;

describe("goal findings in asset validation", () => {
  it("provisional level → info; does not affect completeness", () => {
    const v = validateAssetData(data(asset([{ criterionId: "safety", value: 3 }])));
    expect(v.infos).toContain("tabs.assets.validation.goalProvisional:A-001:C");
    expect(v.isComplete).toBe(true);
    expect(derivePhaseStatus(v)).toBe("complete");
  });

  it("nothing rated → assessment required (warning), named by display id", () => {
    const v = validateAssetData(data(asset([])));
    expect(v.warnings).toContain("tabs.assets.validation.goalUnassessed:A-001:C");
    expect(v.warnings).toContain("tabs.assets.validation.goalUnassessed:A-001:I");
  });

  it("manual decision without rationale → warning", () => {
    const a0 = asset([{ criterionId: "financial_damage", value: 3 }]);
    const c = a0.securityGoals.find((g) => g.type === "C")!;
    const a = { ...a0, securityGoals: a0.securityGoals.map((g) => (g === c ? adjustGoal(a0, c, "low", "", "4-level") : g)) };
    expect(validateAssetData(data(a)).warnings).toContain("tabs.assets.validation.goalRationaleMissing:A-001:C");
  });

  it("changed basis → stale key carries the reason", () => {
    const a0 = asset([{ criterionId: "financial_damage", value: 2 }]);
    const c = a0.securityGoals.find((g) => g.type === "C")!;
    const decided = { ...a0, securityGoals: a0.securityGoals.map((g) => (g === c ? adjustGoal(a0, c, "medium", "ok", "4-level") : g)) };
    const raised = { ...decided, impactRatings: [{ criterionId: "financial_damage", value: 4 }] } as Asset;
    expect(validateAssetData(data(raised)).warnings).toContain(
      "tabs.assets.validation.goalOverrideStale.levelRaised:A-001:C",
    );
  });
});
