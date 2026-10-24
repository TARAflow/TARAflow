// tests/unit/app/services/commit-calc-stamps.test.ts
//
// ISO/SAE 21434 conformance plan 0c (decision 17): calculation stamps written
// in the project write channel, and the analysisDate / tree.lastModified churn
// fix (d1).

import { describe, it, expect } from "vitest";

import {
  commitCalcStamps,
  keepDateIfUnchanged,
} from "app/utils/commit-calc-stamps";
import { mergeProjectPatch } from "app/services/project-commit";
import type { Project } from "app/models/project-types";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";
import { DEFAULT_ASSET_CONFIGURATION } from "features/assets/models/asset-types";
import { DEFAULT_FEASIBILITY_CONFIGURATION } from "features/attacktree/models/attacktree-feasibility-types";
import { canonicalStringify } from "shared/utils/tcs-canonical";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const risk = (id: string, value: number): Any => ({
  id,
  threatId: id,
  factorRatings: [{ factorId: "safety", value, weight: 1 }],
  mitigatedFactorRatings: [],
  calculatedImpact: value,
  calculatedLikelihood: 2,
  calculatedRiskBeforeMitigation: value * 2,
  calculatedRiskAfterMitigation: 0,
  treatment: "reduce",
  lastModified: "t0",
});

const analysis = (feasibility: string, date: string): Any => ({
  paths: [{ pathKey: "k1", feasibilityLevel: feasibility }],
  criticalPaths: [],
  maxRiskScore: 0,
  averageRiskScore: 0,
  totalPaths: 1,
  aggregatedLikelihood: 0,
  likelihoodMethod: "max",
  aggregatedFeasibility: feasibility,
  goalSummary: {},
  analysisDate: date,
});

const tree = (id: string, dsl: string, pa: Any, modified: string): Any => ({
  id,
  name: id,
  dsl,
  pathAnalysis: pa,
  lastModified: modified,
});

const project = (regulation: string[], over: Partial<Project> = {}): Project =>
  ({
    id: "p1",
    info: {
      name: "P",
      lastModified: "x",
      tags: { domain: [], platform: [], regulation, custom: [] },
    },
    assets: { configuration: { ...DEFAULT_ASSET_CONFIGURATION }, assets: [] },
    risks: {
      configuration: { ...DEFAULT_CONFIGURATION, likelihoodMethod: "iso-21434" },
      risks: [risk("R1", 3), risk("R2", 2)],
      lastModified: "t0",
    },
    attackTrees: {
      configuration: { feasibilityConfiguration: DEFAULT_FEASIBILITY_CONFIGURATION },
      trees: [tree("T1", "A;ROOT", analysis("high", "d0"), "m0")],
      lastModified: "m0",
    },
    ...over,
  }) as unknown as Project;

const ISO = ["ISO 21434"];

const withRisks = (p: Project, risks: Any[]): Project => ({
  ...p,
  risks: { ...p.risks!, risks },
});
const withTrees = (p: Project, trees: Any[], lastModified = "m1"): Project => ({
  ...p,
  attackTrees: { ...p.attackTrees!, trees, lastModified },
});

describe("risk stamps — only for values actually (re)computed, only ISO", () => {
  it("a changed ISO risk gets a stamp, the untouched one none", () => {
    const prev = project(ISO);
    const next = withRisks(prev, [risk("R1", 4), { ...prev.risks!.risks[1] }]);
    const out = commitCalcStamps(prev, next);
    const [r1, r2] = out.risks!.risks;
    expect(r1.calcStamp).toMatchObject({
      method: "iso-21434",
      calcVersion: "risk-1+feasibility-1",
    });
    expect(r1.calcStamp!.mappingVersion).toMatch(/^[0-9a-f]{12}$/);
    expect(r2.calcStamp).toBeUndefined(); // new object, same values → not recomputed
  });

  it("a new risk gets a stamp", () => {
    const prev = project(ISO);
    const out = commitCalcStamps(prev, withRisks(prev, [...prev.risks!.risks, risk("R3", 1)]));
    expect(out.risks!.risks[2].calcStamp).toBeDefined();
  });

  it("opening / loading / switching projects never stamps", () => {
    const next = withRisks(project(ISO), [risk("R1", 4)]);
    expect(commitCalcStamps(undefined, next)).toBe(next);
    expect(commitCalcStamps({ ...project(ISO), id: "other" } as Project, next)).toBe(next);
  });

  it("other presets get no stamps (principle 6)", () => {
    for (const reg of [[], ["EN 50742"], ["ETSI TVRA"]]) {
      const prev = project(reg);
      const out = commitCalcStamps(prev, withRisks(prev, [risk("R1", 4), risk("R3", 1)]));
      expect(out.risks!.risks.every((r) => r.calcStamp === undefined)).toBe(true);
    }
  });

  it("a G.7 band change changes the risk stamp; impactAggregation only the risk stamp", () => {
    const prev = project(ISO);
    const stampOf = (p: Project) =>
      commitCalcStamps(prev, withRisks(p, [risk("R1", 4)])).risks!.risks[0].calcStamp!
        .mappingVersion;
    const pathStampOf = (p: Project) =>
      commitCalcStamps(prev, withTrees(p, [tree("T1", "B;ROOT", analysis("low", "d1"), "m1")]))
        .attackTrees!.trees[0].pathAnalysis!.calcStamp!.mappingVersion;

    const bands = DEFAULT_FEASIBILITY_CONFIGURATION.bands.map((b, i) =>
      i === 1 ? { ...b, minPotential: b.minPotential + 1 } : b,
    );
    const changedBands = {
      ...prev,
      attackTrees: {
        ...prev.attackTrees!,
        configuration: {
          feasibilityConfiguration: { ...DEFAULT_FEASIBILITY_CONFIGURATION, bands },
        },
      },
    } as Project;
    const changedAggregation = {
      ...prev,
      risks: {
        ...prev.risks!,
        configuration: { ...prev.risks!.configuration, impactAggregation: "weighted-mean" },
      },
    } as Project;

    expect(stampOf(changedBands)).not.toBe(stampOf(prev));
    expect(pathStampOf(changedBands)).not.toBe(pathStampOf(prev));
    expect(stampOf(changedAggregation)).not.toBe(stampOf(prev));
    expect(pathStampOf(changedAggregation)).toBe(pathStampOf(prev));
  });
});

describe("path stamps and date churn", () => {
  it("an ISO path analysis that changed gets a stamp", () => {
    const prev = project(ISO);
    const out = commitCalcStamps(
      prev,
      withTrees(prev, [tree("T1", "B;ROOT", analysis("low", "d1"), "m1")]),
    );
    expect(out.attackTrees!.trees[0].pathAnalysis!.calcStamp).toMatchObject({
      method: "iso-21434",
      calcVersion: "feasibility-1",
    });
  });

  it("re-analysis with unchanged inputs keeps the previous tree objects (non-ISO)", () => {
    for (const reg of [[], ["EN 50742"], ["ETSI TVRA"]]) {
      const prev = project(reg);
      const out = commitCalcStamps(
        prev,
        withTrees(prev, [tree("T1", "A;ROOT", analysis("high", "d9"), "m9")], "m9"),
      );
      expect(out.attackTrees).toBe(prev.attackTrees);
    }
  });

  it("ISO: a pre-0c analysis gets its first stamp on re-analysis (a real change)", () => {
    const prev = project(ISO);
    const out = commitCalcStamps(
      prev,
      withTrees(prev, [tree("T1", "A;ROOT", analysis("high", "d9"), "m9")], "m9"),
    );
    expect(out.attackTrees!.trees[0].pathAnalysis!.calcStamp).toBeDefined();
    expect(out.attackTrees!.trees[0].pathAnalysis!.analysisDate).toBe("d9");
  });

  it("analysing twice with unchanged inputs: attackTrees and risks byte-identical", () => {
    const base = project(ISO);
    // first analysis: stamps the tree and a recomputed risk
    const first = commitCalcStamps(
      base,
      withRisks(withTrees(base, [tree("T1", "B;ROOT", analysis("low", "d1"), "m1")]), [
        risk("R1", 4),
        base.risks!.risks[1],
      ]),
    );
    // second analysis, same inputs, fresh objects and dates
    const second = commitCalcStamps(
      first,
      withRisks(
        withTrees(first, [tree("T1", "B;ROOT", analysis("low", "d2"), "m2")], "m2"),
        first.risks!.risks.map((r) => ({ ...r })), // recomputed: new objects, same values
      ),
    );
    expect(canonicalStringify(second.attackTrees)).toBe(canonicalStringify(first.attackTrees));
    expect(second.attackTrees).toBe(first.attackTrees);
    expect(canonicalStringify(second.risks)).toBe(canonicalStringify(first.risks));
    expect(first.risks!.risks[0].calcStamp).toBeDefined();
  });

  it("a changed tree keeps analysisDate when only the DSL text changed", () => {
    const prev = project([]);
    const out = commitCalcStamps(
      prev,
      withTrees(prev, [tree("T1", "A ;ROOT", analysis("high", "d5"), "m5")]),
    );
    const t = out.attackTrees!.trees[0];
    expect(t.dsl).toBe("A ;ROOT");
    expect(t.lastModified).toBe("m5"); // the tree did change
    expect(t.pathAnalysis!.analysisDate).toBe("d0"); // the analysis did not
  });

  it("a changed input gives a new analysisDate", () => {
    const prev = project([]);
    const out = commitCalcStamps(
      prev,
      withTrees(prev, [tree("T1", "A;ROOT", analysis("low", "d5"), "m5")]),
    );
    expect(out.attackTrees!.trees[0].pathAnalysis!.analysisDate).toBe("d5");
  });

  it("keepDateIfUnchanged ignores only the date", () => {
    const a = analysis("high", "d0");
    expect(keepDateIfUnchanged(a, analysis("high", "d1"))!.analysisDate).toBe("d0");
    expect(keepDateIfUnchanged(a, analysis("low", "d1"))!.analysisDate).toBe("d1");
    expect(
      keepDateIfUnchanged(a, { ...analysis("high", "d1"), calcStamp: { method: "x" } as Any })!
        .analysisDate,
    ).toBe("d1"); // a stamp change is a real change
  });
});

describe("write channel", () => {
  it("mergeProjectPatch stamps a recomputed ISO risk", () => {
    const prev = project(ISO);
    const out = mergeProjectPatch(
      prev,
      { id: "p1", risks: { ...prev.risks!, risks: [risk("R1", 4), prev.risks!.risks[1]] } },
      "now",
    );
    expect(out.risks!.risks[0].calcStamp).toBeDefined();
    expect(out.risks!.risks[1].calcStamp).toBeUndefined();
  });
});
