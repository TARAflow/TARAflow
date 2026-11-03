// EN 50742 Approach A on the evaluator (model-coverage-implementation-plan.md
// §8.1, CM-11): the model rows of 7.3 read the element properties like the
// IEC 62443 rules; rows on risk or project evidence need a statement until
// the En50742View exists (CM-12); 7.4.3.5.1 stays unknown while the SRSL is
// not known. The family assesses the whole machine — no component.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { evaluateMatrix, EDITION_EN50742_A, type ComplianceInput, type ViewElement } from "features/compliance";
import { parseAndRepair } from "app/services/migration-service";
import { prepareProjectCompliance } from "app/services/compliance-report";
import type { Project } from "app/models/project-types";

const el = (id: string, type: string, properties: Record<string, unknown> = {}): ViewElement => ({ id, type, properties });

function run(elements: ViewElement[], extra: Partial<ComplianceInput> = {}) {
  return evaluateMatrix({
    edition: EDITION_EN50742_A,
    view: { elements, flows: [] },
    scope: new Set(elements.map((e) => e.id)),
    run: "achieved",
    ...extra,
  });
}

const row = (result: ReturnType<typeof run>, label: string) => result.rows.find((r) => r.label === label)!;

const AUDIT = "EN-7.3.2/295–296";
const PROTECTED = "EN-7.3.5/321–322";

describe("information collection (7.3) from the model", () => {
  it("an audit log store records interventions — met, the record content stays to confirm", () => {
    const r = row(run([el("p", "Process"), el("s", "DataStore", { storedDataTypes: ["audit_logs"] })]), AUDIT);
    expect(r.status).toBe("met");
    expect(r.source).toBe("model");
    expect(r.checklist).toHaveLength(1);
  });

  it("a process with an audit log meets it too", () => {
    expect(row(run([el("p", "Process", { nonRepudiation: "audit_log" })]), AUDIT).status).toBe("met");
  });

  it("nothing logs → gap; the logging properties unset → unknown (D-12)", () => {
    expect(row(run([el("p", "Process", { nonRepudiation: "none" }), el("s", "DataStore", { storedDataTypes: ["config"] })]), AUDIT).status).toBe("gap");
    expect(row(run([el("p", "Process")]), AUDIT).status).toBe("unknown");
  });

  it("7.3.5: the audit log store must be integrity protected", () => {
    const store = (integrityProtection?: string) =>
      el("s", "DataStore", { storedDataTypes: ["audit_logs"], ...(integrityProtection ? { integrityProtection } : {}) });
    expect(row(run([store("none")]), PROTECTED).status).toBe("gap");
    expect(row(run([store("hmac")]), PROTECTED).status).toBe("met");
    expect(row(run([store()]), PROTECTED).status).toBe("unknown");
    expect(row(run([el("s", "DataStore", { storedDataTypes: ["config"] })]), PROTECTED).status).toBe("n/a");
  });
});

describe("rows on risk and project evidence (until CM-12)", () => {
  const model = [el("p", "Process"), el("s", "DataStore", { storedDataTypes: ["audit_logs"] })];

  it.each(["EN-4.3/217", "EN-7.1/260", "EN-7.4.3.2.1/356–360", "EN-4.3/229"])("%s needs a statement", (label) => {
    expect(row(run(model), label).status).toBe("needs-statement");
  });

  it("a statement meets such a row (D-17)", () => {
    const r = row(run(model, { statements: { "EN-4.3/217": { status: "met", reasoning: "hazard list imported" } } }), "EN-4.3/217");
    expect(r.status).toBe("met");
    expect(r.source).toBe("statement");
  });

  it("7.4.3.5.1 applies from SRSL 2 — unknown while the SRSL is not read, never met or n/a", () => {
    const r = row(run([el("p", "Process", { updateMechanism: "signed_ota" })]), "EN-7.4.3.5.1/438–441");
    expect(r.status).toBe("unknown");
    expect(r.reasoning).toContain("SRSL");
  });

  it("statement rows (type C) need a statement", () => {
    for (const label of ["EN-7.3.1/281", "EN-7.3.4/317–319", "EN-7.5/444–445", "EN-9/491–496"]) {
      expect(row(run(model), label).status, label).toBe("needs-statement");
    }
  });
});

describe("scope: the whole machine", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const project: any = parseAndRepair(JSON.parse(readFileSync("src/tests/fixtures/SmokeDetector.tara.json", "utf-8")))!;
  const component = project.dfd.elements.find((e: { type: string }) => e.type === "Process").id as string;

  it("a component chosen for IEC 62443 does not narrow EN 50742 A", () => {
    const withComponent: Project = { ...project, compliance: { ...project.compliance, componentId: component } };
    const context = prepareProjectCompliance(withComponent)!;
    const en = context.evaluate(EDITION_EN50742_A);
    const whole = prepareProjectCompliance({ ...project, compliance: undefined })!;
    expect(en.scopeName).toBeUndefined();
    expect([...en.scope].sort()).toEqual([...whole.scope].sort());
    expect(context.scope.size).toBeLessThan(whole.scope.size);
  });
});
