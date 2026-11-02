// Statements per requirement (iec-62443-4-2-cra-coverage.md D-31): files of
// the 0.17 development stored them per edition and row label; migrate-12-to-13
// folds them into one statement per requirement and reports what was dropped
// (K-9). The load path is tested with the migration (migrate_12_to_13.test.ts).
import { describe, it, expect } from "vitest";
import { foldLegacyStatements } from "app/services/compliance-statements-legacy";
import type { ComplianceStatement } from "shared";

const st = (reasoning: string, date = "2026-11-01"): ComplianceStatement => ({ status: "met", reasoning, date });

describe("foldLegacyStatements", () => {
  it("labels of each edition become requirement keys; the classic composite row keeps its own key", () => {
    const folded = foldLegacyStatements({
      "en-iec-62443-4-2-praa-2026": { "CR 1.7": st("cra"), "CR 2.11": st("time") },
      "iec-62443-4-2-2019": { "EDR 2.4": st("no mobile code"), "CR 4.1": st("both at rest and in transit") },
    });
    expect(folded.statements).toEqual({
      "cr-1.7": st("cra"),
      "cr-2.11": st("time"),
      "cr-2.4": st("no mobile code"),
      "cr-4.1-rest+cr-4.1-transit": st("both at rest and in transit"),
    });
    expect(folded.dropped).toBe(0);
  });

  it("the same requirement in both editions: the newer statement wins, the older one counts as dropped", () => {
    const folded = foldLegacyStatements({
      "en-iec-62443-4-2-praa-2026": { "CR 1.7": st("older", "2026-10-30") },
      "iec-62443-4-2-2019": { "CR 1.7": st("newer", "2026-11-01") },
    });
    expect(folded.statements).toEqual({ "cr-1.7": st("newer", "2026-11-01") });
    expect(folded.dropped).toBe(1);
  });

  it("the same statement in both editions is nothing dropped", () => {
    const folded = foldLegacyStatements({
      "en-iec-62443-4-2-praa-2026": { "CR 1.7": st("same") },
      "iec-62443-4-2-2019": { "CR 1.7": st("same") },
    });
    expect(folded).toEqual({ statements: { "cr-1.7": st("same") }, dropped: 0 });
  });

  it("statements in the new form pass unchanged (same object)", () => {
    const statements = { "cr-1.7": st("x") };
    expect(foldLegacyStatements(statements).statements).toBe(statements);
    expect(foldLegacyStatements(undefined)).toEqual({ statements: undefined, dropped: 0 });
  });
});
