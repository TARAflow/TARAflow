// Matrix evaluator (iec-62443-4-2-cra-coverage.md §9.4, tests of §9.5) on
// small graphs. The rows reference the real evidence rules; the editions
// here are minimal so each test shows one rule of the evaluation.
import { describe, it, expect } from "vitest";
import {
  evaluateMatrix,
  type ComplianceInput,
  type Edition,
  type EditionRow,
  type RequirementId,
  type ViewElement,
  type ViewFlow,
} from "features/compliance";

// ==================== HELPERS ====================

type RowSpec = Partial<EditionRow> & { label: string; requirementIds: readonly RequirementId[] };

const edition = (...rows: RowSpec[]): Edition => ({
  id: "en-iec-62443-4-2-praa-2026",
  title: "test",
  draft: true,
  ccsc2Label: "supporting measures",
  rows: rows.map((r) => ({ fr: "UC", minSl: 1, supportingMeasuresAllowed: false, ...r })),
});

const el = (id: string, type: string, properties: Record<string, unknown> = {}): ViewElement => ({ id, type, properties });
const flow = (id: string, from: string, to: string, properties: Record<string, unknown> = {}): ViewFlow => ({ id, from, to, properties });

function run(
  ed: Edition,
  elements: ViewElement[],
  flows: ViewFlow[] = [],
  extra: Partial<ComplianceInput> = {},
) {
  const { view, ...rest } = extra;
  return evaluateMatrix({
    edition: ed,
    view: { elements, flows, fallbackContained: view?.fallbackContained },
    scope: rest.scope ?? new Set(elements.map((e) => e.id)),
    run: "achieved",
    ...rest,
  });
}

const row = (result: ReturnType<typeof run>, label: string) => result.rows.find((r) => r.label === label)!;

const OPERATOR = el("ee-op", "ExternalEntity", { entityType: "operator" });
const LOCK = (id: string, lock?: boolean) => el(id, "Process", lock === undefined ? {} : { sessionControl: { sessionLockEnabled: lock } });

// ==================== D-12 UNKNOWN VS N/A ====================

describe("unknown is never n/a (D-12)", () => {
  const ed = edition({ label: "CR 3.5", requirementIds: ["cr-3.5"] });

  it("an unset evidence property → unknown", () => {
    expect(row(run(ed, [el("p", "Process")]), "CR 3.5").status).toBe("unknown");
  });

  it('"not_specified" is undecided, like unset', () => {
    expect(row(run(ed, [el("p", "Process", { inputValidation: "not_specified" })]), "CR 3.5").status).toBe("unknown");
  });

  it("no element of the target type → n/a with the type named (accepted limit)", () => {
    const r = row(run(ed, [el("s", "DataStore")]), "CR 3.5");
    expect(r.status).toBe("n/a");
    expect(r.reasoning).toContain("Process");
  });

  it("an unfinished model never reaches a higher value than the complete one", () => {
    const ed2 = edition(
      { label: "CR 2.5", requirementIds: ["cr-2.5"], minSl: 1 },
      { label: "CR 3.5", requirementIds: ["cr-3.5"], minSl: 1 },
    );
    const complete = run(ed2, [OPERATOR, el("p", "Process", { inputValidation: "strict", sessionControl: { sessionLockEnabled: false } })], [flow("f", "ee-op", "p")]);
    const unfinished = run(ed2, [el("ee-op", "ExternalEntity"), el("p", "Process", { inputValidation: "strict" })], [flow("f", "ee-op", "p")]);
    expect(unfinished.component.UC).toBeLessThanOrEqual(complete.component.UC);
    expect(row(unfinished, "CR 2.5").status).toBe("unknown");
  });
});

// ==================== D-13 / D-19 QUANTIFIER ====================

describe('quantifier "all" (D-13, D-19)', () => {
  const ed = edition({ label: "CR 1.1", requirementIds: ["cr-1.1"] });
  const human = [OPERATOR, el("p1", "Process"), el("p2", "Process")];

  it("one of two human-access flows unauthenticated → gap naming it", () => {
    const r = row(
      run(ed, human, [flow("f1", "ee-op", "p1", { endpointAuthentication: "mfa" }), flow("f2", "ee-op", "p2", { endpointAuthentication: "none" })]),
      "CR 1.1",
    );
    expect(r.status).toBe("gap");
    expect(r.failing).toEqual(["f2"]);
  });

  it("both authenticated → met from the model, with the B checklist", () => {
    const r = row(
      run(ed, human, [flow("f1", "ee-op", "p1", { endpointAuthentication: "mfa" }), flow("f2", "ee-op", "p2", { endpointAuthentication: "password" })]),
      "CR 1.1",
    );
    expect(r.status).toBe("met");
    expect(r.source).toBe("model");
    expect(r.checklist.length).toBeGreaterThan(0);
  });

  it("a flow whose endpoint type is unset blocks met (applicability unknown, D-19)", () => {
    const r = row(
      run(ed, [OPERATOR, el("ee-x", "ExternalEntity"), el("p1", "Process"), el("p2", "Process")], [
        flow("f1", "ee-op", "p1", { endpointAuthentication: "mfa" }),
        flow("f2", "ee-x", "p2"),
      ]),
      "CR 1.1",
    );
    expect(r.status).toBe("unknown");
    expect(r.unknown).toEqual(["f2"]);
  });

  it("one element no and one unknown → gap naming both (step 9)", () => {
    const r = row(
      run(ed, human, [flow("f1", "ee-op", "p1", { endpointAuthentication: "none" }), flow("f2", "ee-op", "p2")]),
      "CR 1.1",
    );
    expect(r.status).toBe("gap");
    expect(r.failing).toEqual(["f1"]);
    expect(r.unknown).toEqual(["f2"]);
  });
});

describe('quantifier "any"', () => {
  const ed = edition({ label: "CR 7.3", requirementIds: ["cr-7.3"], fr: "RA" });

  it("one element with backup suffices", () => {
    const r = row(run(ed, [el("mp", "Multiprocess", { backupMechanism: "none" }), el("ds", "DataStore", { backupEnabled: true })]), "CR 7.3");
    expect(r.status).toBe("met");
  });

  it("none, but one unknown → unknown (it might still satisfy)", () => {
    const r = row(run(ed, [el("mp", "Multiprocess", { backupMechanism: "none" }), el("ds", "DataStore")]), "CR 7.3");
    expect(r.status).toBe("unknown");
  });
});

// ==================== D-23 CUSTOM ====================

describe('"custom" (D-23)', () => {
  it("in a type A rule → unknown", () => {
    const ed = edition({ label: "CR 3.2", requirementIds: ["cr-3.2"], fr: "SI" });
    expect(row(run(ed, [el("p", "Process", { malwareProtection: "custom" })]), "CR 3.2").status).toBe("unknown");
  });

  it("in a type B rule → met with the checklist", () => {
    const ed = edition({ label: "CR 3.4", requirementIds: ["cr-3.4"], fr: "SI" });
    const r = row(run(ed, [el("ds", "DataStore", { integrityProtection: "custom" })]), "CR 3.4");
    expect(r.status).toBe("met");
    expect(r.checklist.length).toBeGreaterThan(0);
  });
});

// ==================== D-14 / D-20 SUPPORTING MEASURES AND CLAIMS ====================

describe("two values per FR (D-14, D-20)", () => {
  // Component = the multiprocess without backup; a data store outside backs it up.
  const elements = [el("mp", "Multiprocess", { backupMechanism: "none" }), el("ds-ext", "DataStore", { backupEnabled: true })];
  const scope = new Set(["mp"]);

  it("an 'any' rule met outside the scope → supporting measure; counts for the component only if allowed", () => {
    const notAllowed = run(edition({ label: "CR 7.3", requirementIds: ["cr-7.3"], fr: "RA", minSl: 1 }), elements, [], { scope });
    expect(row(notAllowed, "CR 7.3").source).toBe("supporting-measure");
    expect(row(notAllowed, "CR 7.3").supportingElements).toEqual(["ds-ext"]);
    expect(notAllowed.component.RA).toBe(0);
    expect(notAllowed.withSupport.RA).toBe(4);

    const allowed = run(
      edition({ label: "CR 7.3", requirementIds: ["cr-7.3"], fr: "RA", minSl: 1, supportingMeasuresAllowed: true }),
      elements,
      [],
      { scope },
    );
    expect(allowed.component.RA).toBe(4);
  });

  it("an 'all' rule gets no automatic supporting measure — only a statement naming it", () => {
    const ed = edition({ label: "CR 3.5", requirementIds: ["cr-3.5"], fr: "SI", minSl: 1, supportingMeasuresAllowed: true });
    const elems = [el("p", "Process", { inputValidation: "none" }), el("p-ext", "Process", { inputValidation: "strict" })];
    expect(row(run(ed, elems, [], { scope: new Set(["p"]) }), "CR 3.5").status).toBe("gap");

    const withStatement = run(ed, elems, [], {
      scope: new Set(["p"]),
      statements: { "CR 3.5": { status: "met", reasoning: "gateway validates", supportingMeasure: "upstream gateway" } },
    });
    expect(row(withStatement, "CR 3.5").source).toBe("statement");
    expect(withStatement.component.SI).toBe(4); // the row allows supporting measures
  });

  it("a claim raises only the second value", () => {
    const ed = edition({ label: "CR 3.5", requirementIds: ["cr-3.5"], fr: "SI", minSl: 2 });
    const result = run(ed, [el("p", "Process", { inputValidation: "none" })], [], {
      claims: [{ displayId: "CLM-01", rowLabels: ["CR 3.5"] }],
    });
    expect(row(result, "CR 3.5").status).toBe("claimed");
    expect(result.component.SI).toBe(1);
    expect(result.withSupport.SI).toBe(4);
  });
});

// ==================== D-16 / D-21 MITIGATIONS ====================

describe("mitigations (D-16, D-21)", () => {
  const cRow = edition({ label: "CR 1.8", requirementIds: ["cr-1.8"], fr: "IAC" });
  const pkElements = [el("mp", "Multiprocess", { boundaryAuthentication: "certificate" })];

  it("a done mitigation for a risk in scope meets a type C row", () => {
    const r = row(
      run(cRow, pkElements, [], { mitigations: [{ mitigationId: "M-1", requirementIds: ["cr-1.8"], done: true, concernsElementIds: ["mp"] }] }),
      "CR 1.8",
    );
    expect(r.status).toBe("met");
    expect(r.source).toBe("mitigation");
  });

  it("a mitigation for a risk of another component does not count", () => {
    const r = row(
      run(cRow, [...pkElements, el("other", "Process")], [], {
        scope: new Set(["mp"]),
        mitigations: [{ mitigationId: "M-1", requirementIds: ["cr-1.8"], done: true, concernsElementIds: ["other"] }],
      }),
      "CR 1.8",
    );
    expect(r.status).toBe("needs-statement");
  });

  it("achieved run: a done mitigation against a model 'no' stays a gap with the contradiction note", () => {
    const ed = edition({ label: "CR 3.5", requirementIds: ["cr-3.5"], fr: "SI" });
    const mitigations = [{ mitigationId: "M-2", requirementIds: ["cr-3.5"] as RequirementId[], done: true, concernsElementIds: ["p"] }];
    const achieved = row(run(ed, [el("p", "Process", { inputValidation: "none" })], [], { mitigations }), "CR 3.5");
    expect(achieved.status).toBe("gap");
    expect(achieved.contradiction).toBe(true);

    const planned = row(run(ed, [el("p", "Process", { inputValidation: "none" })], [], { mitigations, run: "planned" }), "CR 3.5");
    expect(planned.status).toBe("met");
    expect(planned.source).toBe("mitigation");
  });

  it("achieved run counts only done mitigations", () => {
    const r = row(
      run(cRow, pkElements, [], { mitigations: [{ mitigationId: "M-1", requirementIds: ["cr-1.8"], done: false, concernsElementIds: ["mp"] }] }),
      "CR 1.8",
    );
    expect(r.status).toBe("needs-statement");
  });
});

// ==================== D-17 STATEMENTS ====================

describe("statements (D-17)", () => {
  const ed = edition({ label: "CR 3.5", requirementIds: ["cr-3.5"], fr: "SI" });

  it("win over the model, which stays visible", () => {
    const r = row(
      run(ed, [el("p", "Process", { inputValidation: "none" })], [], {
        statements: { "CR 3.5": { status: "met", reasoning: "validated by the protocol stack", modelStatusAtStatement: "gap" } },
      }),
      "CR 3.5",
    );
    expect(r.status).toBe("met");
    expect(r.modelStatus).toBe("gap");
    expect(r.statementModelChanged).toBeUndefined();
  });

  it('show "model changed" when the model result moved since the statement', () => {
    const r = row(
      run(ed, [el("p", "Process", { inputValidation: "strict" })], [], {
        statements: { "CR 3.5": { status: "n/a", reasoning: "x", modelStatusAtStatement: "gap" } },
      }),
      "CR 3.5",
    );
    expect(r.statementModelChanged).toBe(true);
  });
});

// ==================== K-C1 DEVICE CATEGORIES ====================

describe("device rows (K-C1)", () => {
  const ed = edition(
    { label: "EDR 3.10", requirementIds: ["cr-3.10"], fr: "SI", deviceCategories: ["EDR"] },
    { label: "NDR 3.10", requirementIds: ["cr-3.10"], fr: "SI", deviceCategories: ["NDR"] },
  );
  const elements = [el("mp", "Multiprocess", { updateMechanism: "signed_ota" })];

  it("pending while the category is only derived", () => {
    const r = run(ed, elements, [], { deviceCategories: { categories: ["EDR"], source: "derived" } });
    expect(row(r, "EDR 3.10").status).toBe("pending-category");
    expect(r.component.SI).toBe(0);
  });

  it("confirmed: own category evaluated, others n/a; a statement on a dropped row is kept as superseded", () => {
    const r = run(ed, elements, [], {
      deviceCategories: { categories: ["EDR"], source: "manual" },
      statements: { "NDR 3.10": { status: "met", reasoning: "from when it was a gateway" } },
    });
    expect(row(r, "EDR 3.10").status).toBe("met");
    expect(row(r, "NDR 3.10").status).toBe("n/a");
    expect(row(r, "NDR 3.10").statementSuperseded).toBe(true);
  });
});

// ==================== D-24 NEIGHBOURS ====================

describe("neighbours (D-24)", () => {
  const ed = edition({ label: "CR 2.5", requirementIds: ["cr-2.5"], fr: "UC" });

  it("a flow excluded from threat generation still makes the process serve a human user", () => {
    const r = row(run(ed, [OPERATOR, LOCK("p", false)], [flow("f", "ee-op", "p", { excludeFromThreatGen: true })]), "CR 2.5");
    expect(r.status).toBe("gap");
    expect(r.failing).toEqual(["p"]);
  });

  it("an interface on the flow does not change the neighbour (sender → receiver)", () => {
    const r = row(run(ed, [OPERATOR, el("if", "Interface", { type: "touchscreen" }), LOCK("p", true)], [flow("f", "ee-op", "p")]), "CR 2.5");
    expect(r.status).toBe("met");
  });

  it("a process inside a decomposed multiprocess reached only by a fallback flow → unknown, not n/a", () => {
    const r = row(
      run(ed, [OPERATOR, el("mp", "Multiprocess"), LOCK("p", false)], [flow("f", "ee-op", "mp")], {
        view: { elements: [], flows: [], fallbackContained: new Set(["p"]) },
      }),
      "CR 2.5",
    );
    expect(r.status).toBe("unknown");
    expect(r.unknown).toEqual(["p"]);
  });
});

// ==================== ROWS AND VECTOR ====================

describe("rows and vector (D-2)", () => {
  it("a row of several requirement ids is met only when all are (2019 CR 4.1)", () => {
    const ed = edition({ label: "CR 4.1", requirementIds: ["cr-4.1-transit", "cr-4.1-rest"], fr: "DC" });
    const elements = [
      el("p", "Process"),
      el("ds", "DataStore", { dataClassification: "secret", encryptionAtRest: "none" }),
    ];
    const flows = [flow("f", "p", "ds", { dataClassification: "secret", encryptionInTransit: "tls" })];
    const r = row(run(ed, elements, flows), "CR 4.1");
    expect(r.status).toBe("gap");
    expect(r.failing).toEqual(["ds"]);
  });

  it("one non-counting row caps the FR below its lowest SL-C", () => {
    const ed = edition(
      { label: "A", requirementIds: ["cr-3.5"], fr: "SI", minSl: 1 },
      { label: "B", requirementIds: ["cr-3.7"], fr: "SI", minSl: 3 },
    );
    const result = run(ed, [el("p", "Process", { inputValidation: "strict", errorHandling: "verbose" })]);
    expect(result.component.SI).toBe(2);
    expect(result.component.IAC).toBe(4); // no rows → nothing blocks
  });

  it("void rows are n/a from the edition and never block", () => {
    const ed = edition({ label: "CR 7.5", requirementIds: [], minSl: null, void: "no component requirement", fr: "RA" });
    const r = run(ed, []);
    expect(row(r, "CR 7.5").status).toBe("n/a");
    expect(row(r, "CR 7.5").source).toBe("edition");
    expect(r.component.RA).toBe(4);
  });
});
