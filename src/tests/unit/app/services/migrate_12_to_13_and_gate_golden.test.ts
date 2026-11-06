// Schema 13 step S13-c (FX-6) — golden test. The step recomputes the paths
// with the attack-tree calculator of the running version; this test pins
// what it makes of a frozen schema-12 file (an OR below an AND gate, a step
// without assessment, a risk shared by two combinations). A later change of
// the calculator or of the step that would migrate a 0.17 file differently
// fails here — decide it on purpose, then rewrite the expectation:
//   WRITE_GOLDEN=1 npx vitest run src/tests/unit/app/services/migrate_12_to_13_and_gate_golden.test.ts
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { migrate_12_to_13 } from "app/services/versions/migrate-12-to-13";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const DIR = join(process.cwd(), "src/tests/fixtures/migrations");
const INPUT = join(DIR, "and-gate-paths.schema12.json");
const EXPECTED = join(DIR, "and-gate-paths.schema13.expected.json");

/** What the step decides — paths, assessments, risks, goal links; no timestamps. */
function decisions(data: Any) {
  const tree = data.attackTrees.trees[0];
  return {
    paths: tree.pathAnalysis.paths.map((p: Any) => ({
      pathKey: p.pathKey,
      combination: p.combination ?? null,
      riskScore: p.riskScore,
      probability: p.probability,
      feasibilityLevel: p.feasibilityLevel,
    })),
    pathAssessments: tree.pathAssessments.map((a: Any) => ({
      pathKey: a.pathKey,
      strideCategory: a.strideCategory,
      relevance: a.relevance,
    })),
    risks: data.risks.risks.map((r: Any) => ({
      id: r.id,
      threatId: r.threatId,
      treatment: r.treatment,
      calculatedRiskBeforeMitigation: r.calculatedRiskBeforeMitigation,
      riskBeforeRationale: r.riskBeforeRationale,
    })),
    goals: data.cybersecurityConcept.goals.map((g: Any) => ({ id: g.id, riskIds: g.riskIds })),
  };
}

describe("S13-c golden: AND gate with an OR below it", () => {
  it("migrates the frozen schema-12 file exactly as recorded", () => {
    const { data, analysisChanged } = migrate_12_to_13(JSON.parse(readFileSync(INPUT, "utf8")));
    expect(analysisChanged).toBe(true);
    const actual = decisions(data);
    if (process.env.WRITE_GOLDEN) writeFileSync(EXPECTED, JSON.stringify(actual, null, 2) + "\n");
    expect(actual).toEqual(JSON.parse(readFileSync(EXPECTED, "utf8")));
  });

  it("the recorded expectation says what FX-6 promises", () => {
    const expected = JSON.parse(readFileSync(EXPECTED, "utf8"));
    const combined = expected.paths.filter((p: Any) => p.combination);
    // One path per branch of the OR, each with the AND gate's other step.
    expect(combined.map((p: Any) => p.combination.legs.map((l: string[]) => l.join(" > ")))).toEqual([
      ["Port > Debug port", "Bypass"],
      ["Port > JTAG", "Bypass"],
    ]);
    // Bypass had no assessment: no combination became "not relevant".
    for (const p of combined) {
      expect(expected.pathAssessments.find((a: Any) => a.pathKey === p.pathKey).relevance).toBe("relevant");
    }
    // Every carried risk names its origin; the merged one asks for a review.
    const carried = expected.risks.filter((r: Any) => combined.some((p: Any) => r.threatId.includes(p.pathKey)));
    expect(carried).toHaveLength(2);
    for (const r of carried) expect(r.riskBeforeRationale).toMatch(/AND gate = one attack path, TARAflow 0\.18\): review/);
  });
});
