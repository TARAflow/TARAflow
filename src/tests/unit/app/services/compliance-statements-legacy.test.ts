// Statements per requirement (iec-62443-4-2-cra-coverage.md D-31): files of
// the 0.17 development stored them per edition and row label; loading folds
// them into one statement per requirement, nothing lost.
import { describe, it, expect } from "vitest";
import { foldLegacyStatements } from "app/services/compliance-statements-legacy";
import { parseAndRepair } from "app/services/migration-service";
import { CURRENT_SCHEMA_VERSION } from "app/services/schema-version";
import type { ComplianceData, ComplianceStatement } from "shared";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const st = (reasoning: string, date = "2026-11-01"): ComplianceStatement => ({ status: "met", reasoning, date });

describe("foldLegacyStatements", () => {
  it("labels of each edition become requirement keys; the classic composite row keeps its own key", () => {
    const legacy: Any = {
      target: { IAC: 2 },
      statements: {
        "en-iec-62443-4-2-praa-2026": { "CR 1.7": st("cra"), "CR 2.11": st("time") },
        "iec-62443-4-2-2019": { "EDR 2.4": st("no mobile code"), "CR 4.1": st("both at rest and in transit") },
      },
    };
    const folded = foldLegacyStatements(legacy)!;
    expect(folded.target).toEqual({ IAC: 2 });
    expect(folded.statements).toEqual({
      "cr-1.7": st("cra"),
      "cr-2.11": st("time"),
      "cr-2.4": st("no mobile code"),
      "cr-4.1-rest+cr-4.1-transit": st("both at rest and in transit"),
    });
  });

  it("the same requirement in both editions: the newer statement wins", () => {
    const legacy: Any = {
      statements: {
        "en-iec-62443-4-2-praa-2026": { "CR 1.7": st("older", "2026-10-30") },
        "iec-62443-4-2-2019": { "CR 1.7": st("newer", "2026-11-01") },
      },
    };
    expect(foldLegacyStatements(legacy)!.statements).toEqual({ "cr-1.7": st("newer", "2026-11-01") });
  });

  it("data in the new form passes unchanged (same object)", () => {
    const data: ComplianceData = { statements: { "cr-1.7": st("x") } };
    expect(foldLegacyStatements(data)).toBe(data);
    expect(foldLegacyStatements(undefined)).toBeUndefined();
  });

  it("on load: a project with the old form is folded", () => {
    const project: Any = parseAndRepair({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      id: "p",
      info: { name: "P", description: "", tags: { domain: [], platform: [], custom: [], regulation: ["IEC 62443"] } },
      phaseStatus: {},
      compliance: { statements: { "iec-62443-4-2-2019": { "CR 1.7": st("x") } } },
    });
    expect(project.compliance.statements).toEqual({ "cr-1.7": st("x") });
  });
});
