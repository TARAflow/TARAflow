// tests/unit/app/services/commit-iso-risk-values.test.ts
//
// ISO/SAE 21434 conformance plan 3a-1 (decisions 20, 22): risk value 1–5 per
// risk, computed in the write channel; inputs from asset (goal override before
// asset, Table F.1 / Se number for safety), attack tree or iso_* fallback;
// residual from the ratings after mitigation.

import { describe, it, expect } from "vitest";

import {
  commitIsoRiskValues,
  computeIsoRisks,
  isoImpactOfDamageScenario,
  isSafetyAmbiguous,
} from "app/utils/commit-iso-risk-values";
import { mergeProjectPatch } from "app/services/project-commit";
import { collectAssetFindings } from "features/assets/services/asset-validator";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";
import { DEFAULT_ASSET_CONFIGURATION } from "features/assets/models/asset-types";
import type { Project } from "app/models/project-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const asset = (over: Any = {}): Any => ({
  id: "A1",
  displayId: "DA-001",
  name: "Lamp request",
  assetGroup: "data",
  impactRatings: [
    { criterionId: "safety", value: 2 },
    { criterionId: "financial_damage", value: 1 },
    { criterionId: "operational", value: 2 },
    { criterionId: "privacy", value: 1 },
  ],
  securityGoals: [{ type: "I", level: "high", formalDescription: "x" }],
  linkedDFDElements: [],
  ...over,
});

const tree = (feasibility: string): Any => ({
  id: "T1",
  anchor: { type: "asset", assetId: "A1", securityGoal: "I" },
  pathAnalysis: { paths: [{ pathKey: "k1", feasibilityLevel: feasibility }], aggregatedFeasibility: feasibility },
});

const risk = (over: Any = {}): Any => ({
  id: "R1",
  strideCategory: "T",
  linkedAssetIds: ["A1"],
  factorRatings: [],
  mitigatedFactorRatings: [],
  attackTreeAssessment: { treeId: "T1", pathKey: "k1" },
  treatment: "reduce",
  ...over,
});

const project = (regulation: string[], over: Any = {}): Project =>
  ({
    id: "p1",
    info: { name: "P", tags: { domain: [], platform: [], regulation, custom: [] } },
    assets: { configuration: DEFAULT_ASSET_CONFIGURATION, assets: [asset()] },
    attackTrees: { configuration: {}, trees: [tree("high")] },
    risks: { configuration: { ...DEFAULT_CONFIGURATION, likelihoodMethod: "iso-21434" }, risks: [risk()] },
    ...over,
  }) as unknown as Project;

const ISO = ["ISO 21434"];
const iso = (p: Project) => p.risks!.risks[0].isoRisk;

describe("computeIsoRisks", () => {
  it("impact × path feasibility through H.8", () => {
    expect(iso(computeIsoRisks(project(ISO)))).toEqual({
      impact: "moderate",
      feasibility: "high",
      value: 3,
    });
  });

  it("other presets get no isoRisk (principle 6)", () => {
    for (const reg of [[], ["EN 50742"], ["ETSI TVRA"]]) {
      const p = project(reg);
      expect(computeIsoRisks(p)).toBe(p);
    }
  });

  it("the iso_* fallback without a tree", () => {
    const f = (id: string, value: number) => ({ factorId: id, value, weight: 1 });
    const p = project(ISO, {
      attackTrees: null,
      risks: {
        configuration: DEFAULT_CONFIGURATION,
        risks: [
          risk({
            attackTreeAssessment: undefined,
            factorRatings: [
              f("iso_elapsed_time", 2),
              f("iso_expertise", 4),
              f("iso_knowledge", 3),
              f("iso_window_of_opportunity", 1),
              f("iso_equipment", 2),
            ],
          }),
        ],
      },
    });
    expect(iso(computeIsoRisks(p))).toEqual({ impact: "moderate", feasibility: "low", value: 2 });
  });

  it("residual from the mitigated tree likelihood via the runtime Mapping B", () => {
    const p = project(ISO, {
      risks: {
        configuration: { ...DEFAULT_CONFIGURATION, scale: "4-level" },
        risks: [
          risk({
            mitigatedFactorRatings: [{ factorId: "attack_tree_likelihood", value: 2, weight: 1 }],
          }),
        ],
      },
    });
    expect(iso(computeIsoRisks(p))!.residual).toEqual({ feasibility: "low", value: 2 });
  });

  it("no impact or no feasibility → no isoRisk; a stale one is removed", () => {
    const unrated = project(ISO, {
      assets: { configuration: DEFAULT_ASSET_CONFIGURATION, assets: [asset({ impactRatings: [] })] },
    });
    expect(iso(computeIsoRisks(unrated))).toBeUndefined();
    const stale = project(ISO, {
      attackTrees: null,
      risks: {
        configuration: DEFAULT_CONFIGURATION,
        risks: [risk({ attackTreeAssessment: undefined, isoRisk: { impact: "severe", feasibility: "high", value: 5 } })],
      },
    });
    expect(iso(computeIsoRisks(stale))).toBeUndefined();
  });
});

describe("safety level", () => {
  it("categorical severity wins over the Se number (Table F.1)", () => {
    expect(isoImpactOfDamageScenario(asset({ physicalImpact: "fatal" }), "I")).toBe("severe");
    expect(
      isoImpactOfDamageScenario(
        asset({ physicalImpact: "irreversible_major", impactRatings: [{ criterionId: "safety", value: 4 }] }),
        "I",
      ),
    ).toBe("major");
  });

  it("Se number: 4 → severe and ambiguous (finding); 3 → major", () => {
    const four = asset({ impactRatings: [{ criterionId: "safety", value: 4 }] });
    expect(isoImpactOfDamageScenario(four, "I")).toBe("severe");
    expect(isSafetyAmbiguous(four)).toBe(true);
    const findings = collectAssetFindings(
      { assets: [four], configuration: DEFAULT_ASSET_CONFIGURATION } as Any,
      undefined,
      undefined,
      "4-level",
      true,
    );
    expect(findings.some((f) => f.key === "tabs.assets.validation.safetyAmbiguous")).toBe(true);
    expect(
      isoImpactOfDamageScenario(asset({ impactRatings: [{ criterionId: "safety", value: 3 }] }), "I"),
    ).toBe("major");
  });

  it("a numeric goal override of safety wins over the asset (override before asset)", () => {
    const a = asset({
      physicalImpact: "fatal",
      securityGoals: [{ type: "I", level: "high", impactRatings: [{ criterionId: "safety", value: 1 }] }],
    });
    expect(isoImpactOfDamageScenario(a, "I")).toBe("moderate");
    expect(isoImpactOfDamageScenario(a, "A")).toBe("severe"); // other goal: asset
  });
});

describe("write channel", () => {
  it("opening / another project never computes", () => {
    const next = project(ISO);
    expect(commitIsoRiskValues(undefined, next)).toBe(next);
    expect(commitIsoRiskValues({ ...next, id: "other" } as Project, next)).toBe(next);
  });

  it("a changed attack tree recomputes; the stamp follows the new value", () => {
    const prev = computeIsoRisks(project(ISO));
    const out = mergeProjectPatch(
      prev,
      { id: "p1", attackTrees: { configuration: {}, trees: [tree("low")] } as Any },
      "now",
    );
    expect(out.risks!.risks[0].isoRisk).toEqual({ impact: "moderate", feasibility: "low", value: 2 });
    expect(out.risks!.risks[0].calcStamp?.method).toBe("iso-21434");
  });
});
