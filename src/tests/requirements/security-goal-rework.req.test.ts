// src/tests/requirements/security-goal-rework.req.test.ts
//
// Requirement tests for doc/Done/Asset/security-goal-rework-design.md.
// One describe per requirement id (SG-xx, see doc/Test/requirements-test-matrix.md).
// Each test walks the chain the app runs — deriver → goal state → threat
// generator → risk impact → findings → report — with real services, no mocks.

import { describe, expect, it } from "vitest";
import {
  adjustGoal,
  excludeGoal,
  goalFindings,
  goalState,
  setGoalImpact,
} from "features/assets/services/asset-goal-state";
import {
  assetIdsNeedingReview,
  collectAssetFindings,
} from "features/assets/services/asset-validator";
import { applyAssetCriteriaToFactorRatings } from "features/risks/services/risk-calculation-service";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";
import type { FactorRating } from "features/risks/models/risk-factor-types";
import { elementThreatGenerator } from "features/threats/services/per-element/element-generator";
import type { ThreatConfiguration, ThreatProjectData } from "features/threats/models/threat-types";
import { buildSecurityGoalDocRows } from "features/documentation/utils/security-goal-doc-rows";
import { goalChipEntries } from "features/assets/components/security-goal-chips";
import { resolveThreatImpactAssets } from "shared";
import type { AssetData } from "features/assets/models/asset-types";
import type { Asset } from "features/assets/models/asset-types";
import {
  SCALE,
  assetRef,
  dataAsset,
  goal,
  r,
  rederive,
  withGoal,
} from "./builders";

const codes = (a: Asset, t: Parameters<typeof goal>[1]) =>
  goalFindings(goalState(a, goal(a, t), SCALE), goal(a, t)).map((f) => f.code);

// ─────────────────────────────────────────────────────────────────────────────
describe("SG-01 goals are derived from DFD relations and asset impact", () => {
  it("a transported data asset gets C/I/A suggested, levels from its impact", () => {
    const a = dataAsset("a", [r("safety", 4), r("financial_damage", 2)]);
    const active = a.securityGoals.filter((g) => g.level !== "none").map((g) => g.type);
    expect(active).toEqual(expect.arrayContaining(["I"]));
    const s = goalState(a, goal(a, "I"), SCALE);
    expect(s.source).toBe("suggested");
    expect(s.assessment).toBe("assessed");
    expect(s.levelReason).toMatchObject({ kind: "mechanism", criterionId: "safety", value: 4 });
  });
});

describe("SG-02 invariant A — manual wins over derivation", () => {
  it("a deriver run after an impact change leaves a manual level unchanged", () => {
    const a0 = dataAsset("a", [r("safety", 4)]);
    const manual = withGoal(a0, adjustGoal(a0, goal(a0, "I"), "low", "Interlock", SCALE));
    const after = rederive({ ...manual, impactRatings: [r("safety", 1)] } as Asset);
    expect(goal(after, "I")).toMatchObject({ level: "low", source: "manual" });
  });
});

describe("SG-03 invariant B — the snapshot is historical", () => {
  it("a higher suggestion marks the decision for review, the level stays", () => {
    const a0 = dataAsset("a", [r("financial_damage", 2)]);
    const decided = withGoal(a0, adjustGoal(a0, goal(a0, "C"), "medium", "ok", SCALE));
    const raised = rederive({ ...decided, impactRatings: [r("financial_damage", 4)] } as Asset);
    const s = goalState(raised, goal(raised, "C"), SCALE);
    expect(s.stale).toBe("level-raised");
    expect(goal(raised, "C").level).toBe("medium");
    expect(codes(raised, "C")).toContain("GOAL_OVERRIDE_STALE");
  });
});

describe("SG-04 invariant C — an exclusion is a decision and stays visible", () => {
  const a0 = dataAsset("a", [r("safety", 4), r("financial_damage", 3)]);
  const a = withGoal(a0, excludeGoal(a0, goal(a0, "C"), "No secrets in the config", SCALE));

  it("table: the excluded goal is listed", () => {
    const e = goalChipEntries(a, SCALE).find((x) => x.goal.type === "C");
    expect(e?.state.visibility).toBe("excluded");
  });

  it("report: the excluded goal is a row with its rationale", () => {
    const row = buildSecurityGoalDocRows([a], SCALE, "en").find((x) => x.goal.endsWith("(C)"));
    expect(row).toMatchObject({ level: "-", source: "Excluded", excluded: true });
    expect(row!.basis).toContain("No secrets in the config");
  });

  it("generator: the excluded goal removes its STRIDE category", () => {
    expect(flowThreats([a0])).toContain("I"); // control: C active → I generated
    expect(flowThreats([a])).not.toContain("I"); // C excluded → no information disclosure
  });
});

describe("SG-05 invariant D — the floor is not an ordinary Low", () => {
  it("no impact rated → assessment missing, no display level, 'Assessment required' in the report", () => {
    const a = dataAsset("a", []);
    const s = goalState(a, goal(a, "I"), SCALE);
    expect(s.assessment).toBe("missing");
    expect(s.displayLevel).toBeNull();
    expect(buildSecurityGoalDocRows([a], SCALE, "en").find((x) => x.goal.endsWith("(I)"))!.level).toBe(
      "Assessment required",
    );
  });
});

describe("SG-06 invariant E — a conflict is an error, not a mutation", () => {
  it("asset 2, goal override 3 → effective 3, override stays 3, GOAL_OVERRIDE_EXCEEDS_ASSET", () => {
    const a0 = dataAsset("a", [r("safety", 2)]);
    const a = withGoal(a0, { ...setGoalImpact(goal(a0, "I"), "safety", 3), rationale: "x" });
    expect(goal(a, "I").impactRatings).toEqual([r("safety", 3)]);
    expect(codes(a, "I")).toContain("GOAL_OVERRIDE_EXCEEDS_ASSET");
    const impact = riskImpact([a], "T");
    expect(impact.safety).toBe(3);
  });
});

// ── threat generator (Phase 1) ──────────────────────────────────────────────
const config = { activeMethod: "per-element", forceClassicMode: false } as unknown as ThreatConfiguration;

function flowThreats(assets: Asset[], flowProps: Record<string, unknown> = {}): string[] {
  const el = (id: string, type: string) => ({ id, type, name: id, displayId: id });
  const project = {
    threats: null,
    dfdGraph: {
      elementsById: new Map([
        ["p1", el("p1", "Process")],
        ["ds1", el("ds1", "DataStore")],
      ]),
      connectionsById: new Map([
        ["DF-1", { id: "DF-1", from: "p1", to: "ds1", name: "write data", displayId: "DF-1", properties: flowProps }],
      ]),
      effectiveElementTrustBoundary: new Map<string, string | null>([
        ["p1", null],
        ["ds1", null],
      ]),
      elementPhysicalBoundaries: new Map(),
      elementChipBoundaries: new Map(),
    },
    assetDataRef: assetRef(assets),
  } as unknown as ThreatProjectData;
  return elementThreatGenerator
    .generateThreatsForProject(project, config)
    .flatMap((t) => t.threats)
    .filter((t) => t.linkedElement?.elementId === "DF-1")
    .map((t) => t.strideCategory)
    .sort();
}

describe("SG-07 generator — technically possible AND violates an active goal", () => {
  it("without goals: the data flow's base categories (T, I, D)", () => {
    expect(flowThreats([])).toEqual(["D", "I", "T"]);
  });

  it("goals applied: intersection with the goals' categories", () => {
    const a0 = dataAsset("a", [r("safety", 4), r("financial_damage", 3), r("operational", 3)]);
    const onlyIntegrity = {
      ...a0,
      securityGoals: a0.securityGoals.map((g) =>
        g.type === "I" ? g : { ...g, level: "none" as const },
      ),
    } as Asset;
    expect(flowThreats([onlyIntegrity])).toEqual(["T"]);
  });

  it("properties still remove what is not technically possible (EL0 removes I) — even with C active", () => {
    const a = dataAsset("a", [r("safety", 4), r("financial_damage", 3), r("operational", 3)]);
    expect(flowThreats([a])).toContain("I"); // control
    expect(flowThreats([a], { exposureLevel: "EL0" })).not.toContain("I");
  });
});

// ── risk impact (Phase 4, mandatory cases §4.5) ─────────────────────────────
const IMPACT_FACTORS = ["safety", "financial_damage", "operational", "privacy", "reputation"];
function riskImpact(assets: Asset[], stride: "T" | "R" | "I" | "D" | "S" | "E"): Record<string, number> {
  const ref = assetRef(assets);
  const ratings: FactorRating[] = IMPACT_FACTORS.map((factorId) => ({ factorId, value: 0, weight: 1 }));
  const out = applyAssetCriteriaToFactorRatings(
    ratings,
    ref.assets,
    ref,
    { ...DEFAULT_CONFIGURATION, useAssetImpact: true },
    stride,
  );
  return Object.fromEntries(out.map((x) => [x.factorId, x.value]));
}

describe("SG-08 risk impact from the violated goals (§4.5 cases 1–5)", () => {
  it("case 1: A safety 4 with goal I adjusted to 2, B safety 3 inherited → 3", () => {
    const a0 = dataAsset("a", [r("safety", 4)]);
    const a = withGoal(a0, { ...setGoalImpact(goal(a0, "I"), "safety", 2), rationale: "x" });
    const b = dataAsset("b", [r("safety", 3)]);
    expect(riskImpact([a, b], "T").safety).toBe(3);
  });

  it("case 2: B without active goal I contributes nothing → 2", () => {
    const a0 = dataAsset("a", [r("safety", 4)]);
    const a = withGoal(a0, { ...setGoalImpact(goal(a0, "I"), "safety", 2), rationale: "x" });
    const b0 = dataAsset("b", [r("safety", 3)]);
    const b = withGoal(b0, excludeGoal(b0, goal(b0, "I"), "n/a", SCALE));
    expect(riskImpact([a, b], "T").safety).toBe(2);
  });

  it("case 3: no linked asset has an active goal I → fallback to the asset values (4) + THREAT_WITHOUT_GOAL", () => {
    const a0 = dataAsset("a", [r("safety", 4)]);
    const a = withGoal(a0, excludeGoal(a0, goal(a0, "I"), "n/a", SCALE));
    const b0 = dataAsset("b", [r("safety", 3)]);
    const b = withGoal(b0, excludeGoal(b0, goal(b0, "I"), "n/a", SCALE));
    expect(riskImpact([a, b], "T").safety).toBe(4);
    const ref = assetRef([a, b]);
    expect(resolveThreatImpactAssets(ref.assets, "T").matched).toBe(false);
    const findings = collectAssetFindings(
      { assets: [a, b], configuration: { impactScale: SCALE } } as unknown as AssetData,
      [{ id: "t", displayId: "P1-T-1", strideCategory: "T", linkedAssetIds: ["a", "b"] }],
    );
    expect(findings.some((f) => f.key.endsWith("threatWithoutGoal") && f.assetId === "a")).toBe(true);
  });

  it("case 4: asset 2, goal I adjusted to 3 → 3 (conflict, see SG-06)", () => {
    const a0 = dataAsset("a", [r("safety", 2)]);
    const a = withGoal(a0, { ...setGoalImpact(goal(a0, "I"), "safety", 3), rationale: "x" });
    expect(riskImpact([a], "T").safety).toBe(3);
  });

  it("case 5: goal N impact 2, goal Acc impact 3 (repudiation) → 3", () => {
    const a0 = dataAsset("a", [r("financial_damage", 4)], ["DF-1"], "processes");
    const n = adjustGoal(a0, goal(a0, "N"), "medium", "audit", SCALE);
    const acc = adjustGoal(a0, goal(a0, "Acc"), "medium", "audit", SCALE);
    let a = withGoal(withGoal(a0, n), acc);
    a = withGoal(a, setGoalImpact(goal(a, "N"), "financial_damage", 2));
    a = withGoal(a, setGoalImpact(goal(a, "Acc"), "financial_damage", 3));
    expect(riskImpact([a], "R").financial_damage).toBe(3);
  });
});

// ── overview, report, cross-checks (Phases 5, 6) ────────────────────────────
describe("SG-09 report: the goal table carries the goal state", () => {
  it("derived / adjusted / review are named in 'Source'", () => {
    const a0 = dataAsset("a", [r("financial_damage", 2), r("safety", 4)]);
    const decided = withGoal(a0, adjustGoal(a0, goal(a0, "C"), "medium", "ok", SCALE));
    const raised = rederive({ ...decided, impactRatings: [r("financial_damage", 4), r("safety", 4)] } as Asset);
    const rows = buildSecurityGoalDocRows([raised], SCALE, "en");
    expect(rows.find((x) => x.goal.endsWith("(I)"))!.source).toBe("Derived");
    expect(rows.find((x) => x.goal.endsWith("(C)"))!.source).toMatch(/^Adjusted — review: /);
  });
});

describe("SG-10 threat ↔ goal cross-checks", () => {
  const a = dataAsset("a", [r("safety", 4), r("financial_damage", 3)]);
  const data = { assets: [a], configuration: { impactScale: SCALE } } as unknown as AssetData;

  it("an E threat on an asset without AuthZ → THREAT_WITHOUT_GOAL (warning)", () => {
    const f = collectAssetFindings(data, [
      { id: "t1", displayId: "P1-E-1", strideCategory: "E", linkedAssetIds: ["a"] },
    ]).find((x) => x.key.endsWith("threatWithoutGoal"))!;
    expect(f).toMatchObject({ severity: "warning", goal: "AuthZ" });
  });

  it("an active goal no threat violates → GOAL_WITHOUT_THREAT (info)", () => {
    const f = collectAssetFindings(data, [
      { id: "t1", displayId: "P1-T-1", strideCategory: "T", linkedAssetIds: ["a"] },
    ]).filter((x) => x.key.endsWith("goalWithoutThreat"));
    expect(f.length).toBeGreaterThan(0);
    expect(f.every((x) => x.severity === "info")).toBe(true);
  });
});

describe("SG-11 'Needs review only' covers errors and warnings, not infos", () => {
  it("an unassessed asset needs review, a fully assessed one does not", () => {
    const open = dataAsset("open", []);
    const done = dataAsset("done", [r("safety", 4), r("financial_damage", 3), r("operational", 3)]);
    const ids = assetIdsNeedingReview(
      collectAssetFindings({ assets: [open, done], configuration: { impactScale: SCALE } } as unknown as AssetData),
    );
    expect(ids.has("open")).toBe(true);
    expect(ids.has("done")).toBe(false);
  });
});
