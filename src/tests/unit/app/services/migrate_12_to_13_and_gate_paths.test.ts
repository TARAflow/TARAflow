// Schema 13 step S13-c (release plan 0.18 FX-6): an AND gate is one attack
// path per combination; the analyst's decisions on the old leaf paths move to
// the combined path — assessments merged (disagreement stays for review),
// risks renamed or merged (review note when their decisions differ), goal /
// claim risk ids follow; only files with an AND gate report a changed analysis.
import { describe, it, expect } from "vitest";
import { attackTreeParser } from "features/attacktree/services/attacktree-parser";
import { computePathKey } from "features/attacktree/services/attacktree-path-identity";
import { migrateAndGatePaths } from "app/services/versions/migrate-12-to-13-and-gate-paths";
import { migrate_12_to_13 } from "app/services/versions/migrate-12-to-13";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const DSL = ["Tamper;ROOT", "\tBoth;AND", "\t\tOpen port;p=0.5,i=3", "\t\tBypass;p=0.4,i=4", "\tAlone;p=0.2,i=2"].join("\n");
const OLD_A = computePathKey(["Tamper", "Both", "Open port"]);
const OLD_B = computePathKey(["Tamper", "Both", "Bypass"]);
const ALONE = computePathKey(["Tamper", "Alone"]);

const assessment = (pathKey: string, relevance = "relevant", extra: Any = {}) => ({ pathKey, strideCategory: "T", relevance, lastModified: "2026-10-01T00:00:00Z", ...extra });
const risk = (key: string, extra: Any = {}) => ({
  id: `R-AT-t1-${key}-T`,
  threatId: `AT-t1-${key}-T`,
  threatDisplayId: `AT-1.${key.slice(0, 2)}`,
  treatment: "reduce",
  moscowPriority: "must",
  factorRatings: [],
  selectedMitigations: [],
  calculatedRiskBeforeMitigation: 4,
  riskBeforeRationale: "",
  ...extra,
});

function project(assessments: Any[], risks: Any[]): Any {
  const ast = attackTreeParser.parse(DSL, "simple").ast!;
  return {
    schemaVersion: 12,
    attackTrees: {
      configuration: {},
      trees: [{ id: "t1", dsl: DSL, ast, configuration: { evaluationMethod: "simple" }, pathAnalysis: { paths: [] }, pathAssessments: assessments }],
    },
    risks: { risks },
    cybersecurityConcept: { goals: [{ id: "g1", displayId: "CSG-01", statement: "x", riskIds: [risk(OLD_A).id, risk(ALONE).id], assetProperties: [] }], claims: [], verifications: [] },
  };
}

describe("S13-c: AND gate paths", () => {
  it("assessments of the two leaf paths become one on the combined path; other paths untouched", () => {
    const { data, analysisChanged } = migrateAndGatePaths(
      project([assessment(OLD_A, "relevant", { mitigationIds: ["M-T-001"], evalNote: "a" }), assessment(OLD_B, "relevant", { mitigationIds: ["M-T-002"] }), assessment(ALONE)], []),
    );
    expect(analysisChanged).toBe(true);
    const tree = data.attackTrees.trees[0];
    const combinedKey = tree.pathAnalysis.paths.find((p: Any) => p.combination).pathKey;
    expect(tree.pathAnalysis.paths).toHaveLength(2);
    expect(tree.pathAssessments.map((a: Any) => a.pathKey).sort()).toEqual([ALONE, combinedKey].sort());
    const merged = tree.pathAssessments.find((a: Any) => a.pathKey === combinedKey);
    expect(merged).toMatchObject({ relevance: "relevant", mitigationIds: ["M-T-001", "M-T-002"], evalNote: "a" });
  });

  it("disagreeing relevance: the combined path is relevant, the old assessments stay for review", () => {
    const { data } = migrateAndGatePaths(project([assessment(OLD_A, "relevant"), assessment(OLD_B, "not_relevant")], []));
    const keys = data.attackTrees.trees[0].pathAssessments.map((a: Any) => a.pathKey);
    expect(keys).toContain(OLD_A);
    expect(keys).toContain(OLD_B);
    expect(data.attackTrees.trees[0].pathAssessments.find((a: Any) => ![OLD_A, OLD_B].includes(a.pathKey)).relevance).toBe("relevant");
  });

  it("one old risk is renamed; two are merged into the higher one with the mitigations united; goals follow", () => {
    const one = migrateAndGatePaths(project([], [risk(OLD_A, { treatment: "accept" })])).data;
    const key = one.attackTrees.trees[0].pathAnalysis.paths.find((p: Any) => p.combination).pathKey;
    expect(one.risks.risks.map((r: Any) => r.id)).toEqual([`R-AT-t1-${key}-T`]);
    expect(one.risks.risks[0].treatment).toBe("accept");
    // Only one step had a risk: carried over, with a review note (audit trail).
    expect(one.risks.risks[0].riskBeforeRationale).toMatch(/^Carried over from AT-1\.\w+ \(AND gate = one attack path, TARAflow 0\.18\): review the rating and the treatment\.$/);

    const two = migrateAndGatePaths(
      project([], [
        risk(OLD_A, { calculatedRiskBeforeMitigation: 6, selectedMitigations: [{ id: "M-T-001", status: "implemented" }] }),
        risk(OLD_B, { calculatedRiskBeforeMitigation: 9, treatment: "accept", selectedMitigations: [{ id: "M-T-002", status: "open" }] }),
        risk(ALONE),
      ]),
    ).data;
    const ids = two.risks.risks.map((r: Any) => r.id).sort();
    expect(ids).toEqual([`R-AT-t1-${ALONE}-T`, `R-AT-t1-${key}-T`].sort());
    const merged = two.risks.risks.find((r: Any) => r.id === `R-AT-t1-${key}-T`);
    expect(merged.treatment).toBe("accept"); // the higher risk is the base
    expect(merged.selectedMitigations.map((m: Any) => m.id)).toEqual(["M-T-002", "M-T-001"]);
    expect(merged.riskBeforeRationale).toMatch(/review the rating and the treatment/);
    expect(two.cybersecurityConcept.goals[0].riskIds).toEqual([`R-AT-t1-${key}-T`, `R-AT-t1-${ALONE}-T`]);
  });

  it("a file without AND gate is unchanged and keeps its analysis (K-9)", () => {
    const data = project([], []);
    data.attackTrees.trees[0].ast = attackTreeParser.parse(["R;ROOT", "\tO;OR", "\t\tA;p=0.5,i=3", "\t\tB;p=0.5,i=3"].join("\n"), "simple").ast;
    const result = migrateAndGatePaths(data);
    expect(result.analysisChanged).toBe(false);
    expect(result.data).toBe(data);
  });

  it("part of migrate_12_to_13", () => {
    const { data, analysisChanged } = migrate_12_to_13(project([assessment(OLD_A)], []));
    expect(analysisChanged).toBe(true);
    expect(data.schemaVersion).toBe(13);
    const keys = data.attackTrees.trees[0].pathAssessments.map((a: Any) => a.pathKey);
    expect(keys.some((k: string) => ![OLD_A, OLD_B].includes(k))).toBe(true);
  });

  it("a step without an assessment is not assessed — never 'not relevant' (other step not relevant)", () => {
    const { data } = migrateAndGatePaths(project([assessment(OLD_A, "not_relevant")], []));
    const tree = data.attackTrees.trees[0];
    const combinedKey = tree.pathAnalysis.paths.find((p: Any) => p.combination).pathKey;
    expect(tree.pathAssessments.find((a: Any) => a.pathKey === combinedKey).relevance).toBe("relevant");
    // the old assessment stays for review in the banner
    expect(tree.pathAssessments.map((a: Any) => a.pathKey)).toContain(OLD_A);
  });

  it("both steps assessed alike: one combined assessment, nothing left for review", () => {
    const { data } = migrateAndGatePaths(project([assessment(OLD_A, "not_relevant"), assessment(OLD_B, "not_relevant")], []));
    const tree = data.attackTrees.trees[0];
    expect(tree.pathAssessments).toHaveLength(1);
    expect(tree.pathAssessments[0].relevance).toBe("not_relevant");
  });

  it("two risks with the same decisions: merged with a note, no review request", () => {
    const { data } = migrateAndGatePaths(project([], [risk(OLD_A), risk(OLD_B)]));
    const merged = data.risks.risks[0];
    expect(data.risks.risks).toHaveLength(1);
    expect(merged.riskBeforeRationale).toMatch(/^Merged from .+ \(AND gate = one attack path, TARAflow 0\.18\)\.$/);
  });
});
