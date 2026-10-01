// tests/unit/features/assets/services/asset-validator.goal-findings.test.ts
//
// Asset validation carries the security-goal findings from goalFindings():
// warnings for missing rationale / assessment / changed basis, infos for
// legitimate-but-notable states. Infos never affect completeness.

import { describe, it, expect } from "vitest";
import {
  assetIdsNeedingReview,
  collectAssetFindings,
  validateAssetData,
  derivePhaseStatus,
  type AssetFinding,
} from "features/assets/services/asset-validator";
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
    expect(v.infos).toContain("tabs.assets.validation.goalProvisional:A-001 (Config DB):C");
    expect(v.isComplete).toBe(true);
    expect(derivePhaseStatus(v)).toBe("complete");
  });

  it("nothing rated → assessment required (warning), named by display id", () => {
    const v = validateAssetData(data(asset([])));
    expect(v.warnings).toContain("tabs.assets.validation.goalUnassessed:A-001 (Config DB):C");
    expect(v.warnings).toContain("tabs.assets.validation.goalUnassessed:A-001 (Config DB):I");
  });

  it("manual decision without rationale → warning", () => {
    const a0 = asset([{ criterionId: "financial_damage", value: 3 }]);
    const c = a0.securityGoals.find((g) => g.type === "C")!;
    const a = { ...a0, securityGoals: a0.securityGoals.map((g) => (g === c ? adjustGoal(a0, c, "low", "", "4-level") : g)) };
    expect(validateAssetData(data(a)).warnings).toContain("tabs.assets.validation.goalRationaleMissing:A-001 (Config DB):C");
  });

  it("changed basis → stale key carries the reason", () => {
    const a0 = asset([{ criterionId: "financial_damage", value: 2 }]);
    const c = a0.securityGoals.find((g) => g.type === "C")!;
    const decided = { ...a0, securityGoals: a0.securityGoals.map((g) => (g === c ? adjustGoal(a0, c, "medium", "ok", "4-level") : g)) };
    const raised = { ...decided, impactRatings: [{ criterionId: "financial_damage", value: 4 }] } as Asset;
    expect(validateAssetData(data(raised)).warnings).toContain(
      "tabs.assets.validation.goalOverrideStale.levelRaised:A-001 (Config DB):C",
    );
  });
});

describe("asset label in validation messages", () => {
  it("every message names the asset by display id and name, never the UUID", () => {
    const a = { ...asset([]), linkedDFDElements: [] } as Asset;
    const v = validateAssetData(data(a));
    const all = [...v.errors, ...v.warnings, ...(v.infos ?? [])];
    expect(all.length).toBeGreaterThan(0);
    expect(all.some((k) => k.includes("uuid-1"))).toBe(false);
    expect(v.warnings).toContain("tabs.assets.validation.notLinkedToDFD:A-001 (Config DB)");
  });

  it("colons in the name do not break the key format", async () => {
    const { assetLabel } = await import("features/assets/services/asset-validator");
    expect(assetLabel({ id: "u", displayId: "DA-2", name: "Flash: Config" })).toBe("DA-2 (Flash Config)");
    expect(assetLabel({ id: "u", displayId: "DA-3" })).toBe("DA-3");
  });
});

describe("structured findings (notification panel)", () => {
  it("carry asset id, label, goal and the dialog tab; strings are derived from them", async () => {
    const { collectAssetFindings } = await import("features/assets/services/asset-validator");
    const a = { ...asset([]), linkedDFDElements: [] } as Asset;
    const f = collectAssetFindings(data(a));
    const unassessed = f.find((x) => x.key.endsWith("goalUnassessed") && x.goal === "C")!;
    expect(unassessed).toMatchObject({ severity: "warning", assetId: "uuid-1", assetLabel: "A-001 (Config DB)", dialogTab: 1 });
    expect(f.find((x) => x.key.endsWith("notLinkedToDFD"))).toMatchObject({ dialogTab: 0 });
    const v = validateAssetData(data(a));
    expect(v.warnings.length + v.errors.length + (v.infos ?? []).length).toBe(f.length);
  });

  it("a goal without formal requirement text is an info, not a warning", () => {
    const a = asset([{ criterionId: "financial_damage", value: 3 }]);
    const blank = { ...a, securityGoals: a.securityGoals.map((g) => ({ ...g, formalDescription: "" })) } as Asset;
    const v = validateAssetData(data(blank));
    expect(v.warnings.some((w) => w.includes("noSecurityGoalDescription"))).toBe(false);
    expect(v.infos).toContain("tabs.assets.validation.noSecurityGoalDescription:A-001 (Config DB):C");
  });
});

// Phase 5: "Needs review only" filter of the asset table.
describe("assetIdsNeedingReview", () => {
  const f = (severity: AssetFinding["severity"], assetId?: string): AssetFinding => ({
    severity,
    key: "k",
    dialogTab: 1,
    ...(assetId ? { assetId } : {}),
  });

  it("errors and warnings mark an asset; infos and project findings do not", () => {
    const ids = assetIdsNeedingReview([
      f("info", "a-info"),
      f("warning", "a-warn"),
      f("error", "a-err"),
      f("error"), // project-level (e.g. no assets)
    ]);
    expect([...ids].sort()).toEqual(["a-err", "a-warn"]);
  });

  it("from the real findings: unassessed goals need review, provisional ones do not", () => {
    const unassessed = { ...asset([]), id: "u" } as Asset;
    const provisional = { ...asset([{ criterionId: "safety", value: 3 }]), id: "p" } as Asset;
    const ids = assetIdsNeedingReview(
      collectAssetFindings({
        assets: [unassessed, provisional],
        configuration: { impactScale: "4-level" },
      } as unknown as AssetData),
    );
    expect(ids.has("u")).toBe(true);
    expect(ids.has("p")).toBe(false);
  });
});
