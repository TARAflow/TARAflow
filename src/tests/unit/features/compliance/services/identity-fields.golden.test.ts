// R-8 golden check for the identity fields (model-coverage-implementation-
// plan.md §3, §7; CM-5a): on the example projects, which do not set
// userAccounts / passwordStrength / passwordLifetime, the rows that became
// type A are never met by the model — they are unknown, n/a or a gap until
// the analyst fills the fields; a statement still meets them (D-8).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseAndRepair } from "app/services/migration-service";
import { prepareProjectCompliance } from "app/services/compliance-report";
import { EDITION_2019, EDITION_PRAA_2026 } from "features/compliance";
import type { Project } from "app/models/project-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const ROWS = ["CR 1.1 RE(1)", "CR 1.7", "CR 1.7 RE(1)", "CR 1.7 RE(2)", "CR 2.1 RE(2)", "CR 3.10 RE(2)", "CR 7.6", "CR 7.6 RE(1)"];
const FIELDS = [
  "userAccounts", "passwordStrength", "passwordLifetime", "roleMapping", "defaultCredentials", "authenticatorChangeable",
  "updateDelivery", "updateDefaults", "secureByDefault", "securityConfigReporting", "userDataDeletion",
];

function load(file: string): Project {
  const project: Any = parseAndRepair(JSON.parse(readFileSync(file, "utf-8")))!;
  // None of the examples sets the new fields — the check relies on it.
  for (const e of project.dfd.elements) for (const f of FIELDS) expect(e.properties?.[f], `${e.id}.${f}`).toBeUndefined();
  return project;
}

describe.each([
  ["SmokeDetector", "src/tests/fixtures/SmokeDetector.tara.json"],
  ["CNC reference", "src/tests/fixtures/cnc-ref.tara.json"],
])("%s", (_name, file) => {
  const context = prepareProjectCompliance(load(file))!;

  it.each([EDITION_PRAA_2026, EDITION_2019])("$id: unset fields never meet a row", (edition) => {
    const { achieved, planned } = context.evaluate(edition);
    for (const result of [achieved, planned]) {
      for (const row of result.rows.filter((r) => ROWS.includes(r.label))) {
        if (row.source === "edition") continue; // void in this edition (prAA CR 1.7 RE(1))
        expect(row.source === "model" && row.status === "met", `${edition.id} ${row.label}: ${row.status}`).toBe(false);
      }
    }
  });

  it.each([EDITION_PRAA_2026, EDITION_2019])("$id: CR 1.5 keeps its whole checklist while F-3 / F-3b are unset", (edition) => {
    const row = context.evaluate(edition).achieved.rows.find((r) => r.label === "CR 1.5")!;
    if (row.status === "met" && row.source === "model") expect(row.checklist).toHaveLength(3);
    expect(row.status).not.toBe("gap");
  });
});
