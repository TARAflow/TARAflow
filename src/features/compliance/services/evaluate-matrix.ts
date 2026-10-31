// ==================== MATRIX EVALUATOR ====================
// Evaluates one IEC 62443-4-2 edition against the model of a project
// (iec-62443-4-2-cra-coverage.md §9.4). Pure: the app layer passes the
// property view of one run (achieved / planned, D-4), the component scope,
// statements, claims and mitigations.
//
// Per element everything is three-valued (D-12): an unset property — or a
// value that only says "not decided yet" — is `unknown`, never a reason for
// `n/a`. Per row the first deciding step wins:
//   1 void row → n/a            5 satisfaction in scope (quantifier, D-13, D-19)
//   2 device category (K-C1)    6 mitigation (D-16, D-21)
//   3 statement (D-17)          7 supporting measure, "any" rules only (D-20)
//   4 applicability             8 claim (D-5)
//                               9 no → gap, else unknown, else needs-statement

import type {
  EditionRow,
  EvidenceRule,
  EvidenceTarget,
  FoundationalRequirement,
  NeighbourCheck,
  PropertyCheck,
  RequirementId,
  SecurityLevel,
  SlVector,
} from "../models/compliance-types";
import { FOUNDATIONAL_REQUIREMENTS } from "../models/compliance-types";
import type {
  ComplianceInput,
  ComplianceResult,
  RowResult,
  RowSource,
  RowStatus,
  ViewElement,
} from "../models/evaluation-types";
import { EVIDENCE_RULES } from "../data/evidence-rules";

// ==================== THREE-VALUED LOGIC ====================

type Tri = "yes" | "no" | "unknown";

/** Values that mean "not decided yet" — unknown, like an unset property (D-12). */
const UNDECIDED_VALUES: readonly unknown[] = [undefined, null, "", "not_specified", "not_assessed"];

/** A value that only says "something else was entered" (D-23). */
const CUSTOM_VALUE = "custom";

const and = (values: readonly Tri[]): Tri =>
  values.includes("no") ? "no" : values.includes("unknown") ? "unknown" : "yes";

const or = (values: readonly Tri[]): Tri =>
  values.includes("yes") ? "yes" : values.includes("unknown") ? "unknown" : "no";

function readPath(properties: Record<string, unknown> | undefined, path: string): unknown {
  let value: unknown = properties;
  for (const key of path.split(".")) {
    if (value === null || typeof value !== "object") return undefined;
    value = (value as Record<string, unknown>)[key];
  }
  return value;
}

/**
 * One check on one element. Multi-select values match when any entry
 * matches. In type A rules a match that rests only on "custom" is unknown
 * (D-23).
 */
function evaluateCheck(element: ViewElement, check: PropertyCheck, typeA: boolean): Tri {
  const value = readPath(element.properties, check.property);
  if (UNDECIDED_VALUES.includes(value)) return "unknown";
  const entries = Array.isArray(value) ? value : [value];
  if (entries.length === 0) return "unknown";
  const matching = entries.filter((entry) =>
    check.in ? check.in.includes(entry) : check.notIn ? !check.notIn.includes(entry) : true,
  );
  if (matching.length === 0) return "no";
  if (typeA && matching.every((entry) => entry === CUSTOM_VALUE)) return "unknown";
  return "yes";
}

// ==================== GRAPH ====================

interface Graph {
  elements: Map<string, ViewElement>;
  /** Flows as elements of type "DataFlow". */
  flowElements: Map<string, ViewElement>;
  /** id → ids of the elements at the other end of its flows. */
  neighbours: Map<string, Set<string>>;
  /** flow id → its two endpoints. */
  endpoints: Map<string, [string, string]>;
  fallbackContained: ReadonlySet<string>;
}

function buildGraph(input: ComplianceInput): Graph {
  const elements = new Map(input.view.elements.map((e) => [e.id, e]));
  const flowElements = new Map<string, ViewElement>();
  const neighbours = new Map<string, Set<string>>();
  const endpoints = new Map<string, [string, string]>();
  const link = (a: string, b: string) => {
    if (!neighbours.has(a)) neighbours.set(a, new Set());
    neighbours.get(a)!.add(b);
  };
  for (const flow of input.view.flows) {
    flowElements.set(flow.id, { id: flow.id, type: "DataFlow", properties: flow.properties });
    endpoints.set(flow.id, [flow.from, flow.to]);
    link(flow.from, flow.to);
    link(flow.to, flow.from);
  }
  return { elements, flowElements, neighbours, endpoints, fallbackContained: input.view.fallbackContained ?? new Set() };
}

/** Elements (or flows) of the target's types, inside or outside the scope. */
function candidates(graph: Graph, target: EvidenceTarget, inScope: (id: string) => boolean, wantScope: boolean): ViewElement[] {
  const out: ViewElement[] = [];
  if (target.elementTypes.includes("DataFlow")) {
    for (const flow of graph.flowElements.values()) if (inScope(flow.id) === wantScope) out.push(flow);
  }
  for (const element of graph.elements.values()) {
    if (target.elementTypes.includes(element.type as never) && inScope(element.id) === wantScope) out.push(element);
  }
  return out;
}

/** Applicability side: "custom" is a decided value here (D-23 concerns evidence only). */
function neighbourTri(graph: Graph, ids: Iterable<string>, check: NeighbourCheck): Tri {
  const results: Tri[] = [];
  for (const id of ids) {
    const element = graph.elements.get(id);
    if (!element || !check.elementTypes.includes(element.type as never)) continue;
    results.push(and(check.checks.map((c) => evaluateCheck(element, c, false))));
  }
  return or(results);
}

function applicable(graph: Graph, element: ViewElement, target: EvidenceTarget): Tri {
  const parts: Tri[] = (target.appliesIf ?? []).map((c) => evaluateCheck(element, c, false));
  if (target.endpointIf && element.type === "DataFlow") {
    parts.push(neighbourTri(graph, graph.endpoints.get(element.id) ?? [], target.endpointIf));
  }
  if (target.connectedIf) {
    let tri = neighbourTri(graph, graph.neighbours.get(element.id) ?? [], target.connectedIf);
    if (tri === "no" && graph.fallbackContained.has(element.id)) tri = "unknown";
    parts.push(tri);
  }
  return and(parts);
}

function satisfied(element: ViewElement, target: EvidenceTarget, typeA: boolean): Tri {
  return or((target.satisfiedIf ?? []).map((c) => evaluateCheck(element, c, typeA)));
}

// ==================== ONE REQUIREMENT ====================

type IdStatus = "met" | "n/a" | "unknown" | "needs-statement" | "gap";

interface IdOutcome {
  status: IdStatus;
  source?: "model" | "mitigation" | "supporting-measure";
  failing: string[];
  unknown: string[];
  supporting: string[];
  mitigationIds: string[];
  contradiction?: boolean;
  reasoning?: string;
}

const outcome = (status: IdStatus, extra: Partial<IdOutcome> = {}): IdOutcome => ({
  status,
  failing: [],
  unknown: [],
  supporting: [],
  mitigationIds: [],
  ...extra,
});

function describeTargets(targets: readonly EvidenceTarget[]): string {
  return [...new Set(targets.flatMap((t) => t.elementTypes))].join(" / ");
}

/** Steps 4 – 7 and 9 for one requirement id. */
function evaluateRule(rule: EvidenceRule, graph: Graph, input: ComplianceInput): IdOutcome {
  const typeA = rule.type === "A";
  const inScope = (id: string) => {
    if (input.scope.has(id)) return true;
    const ends = graph.endpoints.get(id);
    return !!ends && (input.scope.has(ends[0]) || input.scope.has(ends[1]));
  };

  // Step 4a — component-level precondition.
  if (rule.appliesWhen) {
    const tri = or(
      rule.appliesWhen.flatMap((t) => candidates(graph, t, inScope, true).map((e) => applicable(graph, e, t))),
    );
    if (tri === "no") return outcome("n/a", { reasoning: `no ${describeTargets(rule.appliesWhen)} in the component needs it` });
    if (tri === "unknown") return outcome("unknown", { reasoning: "the precondition depends on unset properties" });
  }

  // Step 4b — applicable elements in scope.
  const wholeComponent = rule.targets.length === 0;
  const applicableYes: { element: ViewElement; target: EvidenceTarget }[] = [];
  const applicableUnknown: string[] = [];
  for (const target of rule.targets) {
    for (const element of candidates(graph, target, inScope, true)) {
      const tri = applicable(graph, element, target);
      if (tri === "yes") applicableYes.push({ element, target });
      else if (tri === "unknown") applicableUnknown.push(element.id);
    }
  }
  if (!wholeComponent && applicableYes.length === 0) {
    return applicableUnknown.length > 0
      ? outcome("unknown", { unknown: applicableUnknown })
      : outcome("n/a", { reasoning: `no applicable ${describeTargets(rule.targets)} in the component` });
  }

  // Step 5 — satisfaction in scope (types A / B); type C needs a statement.
  let model: IdOutcome;
  if (rule.type === "C") {
    model = outcome("needs-statement");
  } else {
    const results = applicableYes.map(({ element, target }) => ({ id: element.id, tri: satisfied(element, target, typeA) }));
    const yes = results.filter((r) => r.tri === "yes").map((r) => r.id);
    const no = results.filter((r) => r.tri === "no").map((r) => r.id);
    const unknown = [...results.filter((r) => r.tri === "unknown").map((r) => r.id), ...applicableUnknown];
    if ((rule.quantifier ?? "all") === "all") {
      // D-19: an element with unknown applicability blocks "met" too; step 9: no before unknown.
      model =
        no.length > 0
          ? outcome("gap", { failing: no, unknown })
          : unknown.length > 0
            ? outcome("unknown", { unknown })
            : outcome("met", { source: "model" });
    } else {
      // "any": one satisfying element suffices; an unknown one might still satisfy.
      model =
        yes.length > 0
          ? outcome("met", { source: "model" })
          : unknown.length > 0
            ? outcome("unknown", { failing: no, unknown })
            : outcome("gap", { failing: no });
    }
  }
  if (model.status === "met") return model;

  // Step 6 — mitigations naming the requirement, chosen for risks in scope (D-16).
  const mitigations = (input.mitigations ?? []).filter(
    (m) =>
      m.requirementIds.includes(rule.id) &&
      m.concernsElementIds.some((id) => input.scope.has(id)) &&
      (input.run === "planned" || m.done),
  );
  if (mitigations.length > 0) {
    const mitigationIds = mitigations.map((m) => m.mitigationId);
    // D-21: in the achieved run a done mitigation does not overrule a clear model "no".
    if (input.run === "achieved" && model.status === "gap") return { ...model, mitigationIds, contradiction: true };
    return { ...model, status: "met", source: "mitigation", mitigationIds };
  }

  // Step 7 — supporting measure, automatically only for "any" rules (D-20).
  if (rule.type !== "C" && rule.quantifier === "any") {
    const supporting = rule.targets.flatMap((target) =>
      candidates(graph, target, inScope, false)
        .filter((e) => applicable(graph, e, target) === "yes" && satisfied(e, target, typeA) === "yes")
        .map((e) => e.id),
    );
    if (supporting.length > 0) return { ...model, status: "met", source: "supporting-measure", supporting };
  }

  return model;
}

// ==================== ONE ROW ====================

const STATUS_ORDER: readonly IdStatus[] = ["gap", "unknown", "needs-statement", "met", "n/a"];

function combine(outcomes: readonly IdOutcome[]): IdOutcome {
  const status = STATUS_ORDER.find((s) => outcomes.some((o) => o.status === s)) ?? "n/a";
  const sources = outcomes.filter((o) => o.status === "met").map((o) => o.source);
  const source = sources.includes("supporting-measure")
    ? "supporting-measure"
    : sources.includes("mitigation")
      ? "mitigation"
      : sources.length > 0
        ? "model"
        : undefined;
  const merged = (key: "failing" | "unknown" | "supporting" | "mitigationIds") => [...new Set(outcomes.flatMap((o) => o[key]))];
  return {
    status,
    source: status === "met" ? source : undefined,
    failing: merged("failing"),
    unknown: merged("unknown"),
    supporting: merged("supporting"),
    mitigationIds: merged("mitigationIds"),
    contradiction: outcomes.some((o) => o.contradiction) || undefined,
    reasoning: outcomes.map((o) => o.reasoning).find(Boolean),
  };
}

function evaluateRow(row: EditionRow, graph: Graph, input: ComplianceInput): RowResult {
  const statement = input.statements?.[row.label];
  const base = {
    label: row.label,
    fr: row.fr,
    minSl: row.minSl,
    failing: [] as string[],
    unknown: [] as string[],
    supportingElements: [] as string[],
    mitigationIds: [] as string[],
    claimIds: [] as string[],
    checklist: [] as string[],
    supportingMeasuresAllowed: row.supportingMeasuresAllowed,
  };

  // Step 1 — void row.
  if (row.void) return { ...base, status: "n/a", modelStatus: "n/a", source: "edition", reasoning: row.void };

  // Step 2 — device rows (2019) by the component's device category (K-C1).
  if (row.deviceCategories) {
    const choice = input.deviceCategories;
    if (!choice || choice.source === "derived") {
      return { ...base, status: "pending-category", modelStatus: "pending-category", source: "device-category" };
    }
    if (!row.deviceCategories.some((c) => choice.categories.includes(c))) {
      return {
        ...base,
        status: "n/a",
        modelStatus: "n/a",
        source: "device-category",
        reasoning: `the component is not ${row.deviceCategories.join(" / ")}`,
        statementSuperseded: statement ? true : undefined,
      };
    }
  }

  // Steps 4 – 7 per requirement id, combined (all ids of a row must be met).
  const rules = row.requirementIds.map((id: RequirementId) => EVIDENCE_RULES.get(id)!);
  const combined = combine(rules.map((rule) => evaluateRule(rule, graph, input)));
  let status: RowStatus = combined.status;
  let source: RowSource | undefined = combined.source;

  // Step 8 — claim (D-5).
  const claimIds = (input.claims ?? []).filter((c) => c.rowLabels.includes(row.label)).map((c) => c.displayId);
  if (claimIds.length > 0 && status !== "met" && status !== "n/a") {
    status = "claimed";
    source = "claim";
  }

  const result: RowResult = {
    ...base,
    status,
    source,
    modelStatus: status,
    failing: combined.failing,
    unknown: combined.unknown,
    supportingElements: combined.supporting,
    mitigationIds: combined.mitigationIds,
    claimIds,
    checklist: status === "met" ? rules.flatMap((r) => (r.type === "B" ? [...(r.checklist ?? [])] : [])) : [],
    reasoning: combined.reasoning,
    contradiction: combined.contradiction,
  };

  // Step 3 — the statement wins; the model result stays visible (D-17).
  if (statement) {
    return {
      ...result,
      status: statement.status === "met" ? "met" : statement.status === "n/a" ? "n/a" : "gap",
      source: "statement",
      reasoning: statement.reasoning,
      statementSupportingMeasure: statement.supportingMeasure,
      statementModelChanged:
        statement.modelStatusAtStatement !== undefined && statement.modelStatusAtStatement !== result.modelStatus
          ? true
          : undefined,
    };
  }
  return result;
}

// ==================== VECTORS ====================

/** D-14: which row results count for which value. */
export function countsForComponent(row: RowResult): boolean {
  if (row.status === "n/a") return true;
  if (row.status !== "met") return false;
  if (row.source === "model" || row.source === "mitigation") return true;
  if (row.source === "statement") return !row.statementSupportingMeasure || row.supportingMeasuresAllowed;
  if (row.source === "supporting-measure") return row.supportingMeasuresAllowed;
  return false;
}

export function countsWithSupport(row: RowResult): boolean {
  return row.status === "n/a" || row.status === "met" || row.status === "claimed";
}

/** Per FR the highest level n such that every row with lowest SL-C ≤ n counts (D-2). */
export function vectorOf(rows: readonly RowResult[], counts: (row: RowResult) => boolean): SlVector {
  const vector = {} as SlVector;
  for (const fr of FOUNDATIONAL_REQUIREMENTS as readonly FoundationalRequirement[]) {
    const blocking = rows.filter((r) => r.fr === fr && r.minSl !== null && !counts(r)).map((r) => r.minSl as number);
    vector[fr] = (blocking.length > 0 ? Math.min(...blocking) - 1 : 4) as SecurityLevel;
  }
  return vector;
}

// ==================== ENTRY ====================

export function evaluateMatrix(input: ComplianceInput): ComplianceResult {
  const graph = buildGraph(input);
  const rows = input.edition.rows.map((row) => evaluateRow(row, graph, input));
  return {
    rows,
    component: vectorOf(rows, countsForComponent),
    withSupport: vectorOf(rows, countsWithSupport),
  };
}
