// ==================== MATRIX EVALUATOR ====================
// Evaluates one edition of a standard (IEC 62443-4-2, EN 50742 A) against the model of a project
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
  AnyEditionRow,
  AnyRequirementId,
  ChecklistAnswer,
  EvidenceRule,
  EvidenceTarget,
  FoundationalRequirement,
  NeighbourCheck,
  PropertyCheck,
  SecurityLevel,
  SlVector,
} from "../models/compliance-types";
import { BLACK_BOX_FIELDS, isUnset, MODEL_CONDITIONS, MODEL_FIELDS, visibilityContexts, withoutHiddenFields, type VisibilityContext } from "shared";
import { FOUNDATIONAL_REQUIREMENTS } from "../models/compliance-types";
import type {
  ComplianceInput,
  ComplianceResult,
  RowResult,
  RowSource,
  RowStatus,
  ViewElement,
} from "../models/evaluation-types";
import { RULES_BY_ID } from "../data/requirement-registry";
import { externalOutcome, srslReached, srslSummary } from "./evaluate-en50742";

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
  blackBoxes: ReadonlySet<string>;
  scope: ReadonlySet<string>;
  /** Element / flow id → what the model conditions see of it (EvidenceTarget.when). */
  contextOf: (id: string) => VisibilityContext | undefined;
}

function buildGraph(input: ComplianceInput): Graph {
  // R-4: a model field its driver hides reads as unset in every check. A
  // multiprocess that is no black box (it has a child page) hides its
  // "inside" fields (D-30c).
  const blackBoxes = input.view.blackBoxes ?? new Set<string>();
  const decomposed = new Set(input.view.elements.filter((e) => e.type === "Multiprocess" && !blackBoxes.has(e.id)).map((e) => e.id));
  const options = { componentId: input.componentId, decomposed };
  const view = withoutHiddenFields(input.view.elements, input.view.flows, MODEL_FIELDS, options);
  const elements = new Map(view.elements.map((e) => [e.id, e]));
  const flowElements = new Map<string, ViewElement>();
  const neighbours = new Map<string, Set<string>>();
  const endpoints = new Map<string, [string, string]>();
  const link = (a: string, b: string) => {
    if (!neighbours.has(a)) neighbours.set(a, new Set());
    neighbours.get(a)!.add(b);
  };
  for (const flow of view.flows) {
    flowElements.set(flow.id, { id: flow.id, type: "DataFlow", properties: flow.properties });
    endpoints.set(flow.id, [flow.from, flow.to]);
    link(flow.from, flow.to);
    link(flow.to, flow.from);
  }
  return {
    elements,
    flowElements,
    neighbours,
    endpoints,
    fallbackContained: input.view.fallbackContained ?? new Set(),
    blackBoxes: input.view.blackBoxes ?? new Set(),
    scope: input.scope,
    contextOf: visibilityContexts(view.elements, view.flows, options),
  };
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

/** The flow transmits information across the component's border (D-28). */
function crossesComponent(graph: Graph, flow: ViewElement): boolean {
  const props = (flow.properties ?? {}) as Record<string, unknown>;
  if (props.protocol === "human_input" || props.medium === "physical") return false;
  return (graph.endpoints.get(flow.id) ?? []).some(
    (id) => !graph.scope.has(id) || graph.elements.get(id)?.type === "ExternalEntity",
  );
}

function applicable(graph: Graph, element: ViewElement, target: EvidenceTarget): Tri {
  if (target.crossesComponent && element.type === "DataFlow" && !crossesComponent(graph, element)) return "no";
  if (target.when) {
    const context = graph.contextOf(element.id);
    if (!context || !target.when.every((id) => MODEL_CONDITIONS[id](context))) return "no";
  }
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
  if (!target.satisfiedIfAll?.length) return or((target.satisfiedIf ?? []).map((c) => evaluateCheck(element, c, typeA)));
  const all = and(target.satisfiedIfAll.map((c) => evaluateCheck(element, c, typeA)));
  return target.satisfiedIf?.length ? and([or(target.satisfiedIf.map((c) => evaluateCheck(element, c, typeA))), all]) : all;
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
  /** EN 50742 A: risks that fail or are unrated. */
  risks?: string[];
  contradiction?: boolean;
  reasoning?: string;
  /** Type B: the checklist items the model does not answer (CM-5b). */
  openChecklist?: string[];
  /** Element id → the fields it lacks for this requirement (FX-21). */
  unset?: Record<string, string[]>;
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

/** Types a multiprocess without child page contains but the model does not show (D-30). */
const STAND_IN_TYPES: readonly string[] = ["Process", "DataStore"];

/**
 * D-30: black-box multiprocesses in scope that stand in for a rule's
 * Process / DataStore targets — only when no element of those types is in
 * scope at all (the case §9.4 step 4 otherwise reports as n/a). Targets
 * that check Multiprocess themselves need no stand-in.
 */
function blackBoxStandIns(rule: EvidenceRule<AnyRequirementId>, graph: Graph, inScope: (id: string) => boolean): string[] {
  const standInTargets = rule.targets.filter(
    (t) =>
      !(t.elementTypes as readonly string[]).includes("Multiprocess") &&
      (t.elementTypes as readonly string[]).some((type) => STAND_IN_TYPES.includes(type)),
  );
  if (standInTargets.length === 0) return [];
  const types = new Set(standInTargets.flatMap((t) => (t.elementTypes as readonly string[]).filter((type) => STAND_IN_TYPES.includes(type))));
  for (const element of graph.elements.values()) {
    if (types.has(element.type) && inScope(element.id)) return [];
  }
  return [...graph.blackBoxes].filter((id) => inScope(id) && graph.elements.has(id));
}

/**
 * D-30c: a black box with "inside" fields set takes part as a contained
 * Process / DataStore — its fields read under the property names the rule
 * checks (BLACK_BOX_FIELDS) — also next to modelled processes and stores
 * (a supplier module drawn as a black box beside a PLC with a child page).
 * Without such a field it stays a stand-in only where nothing of the type
 * is in scope (D-30).
 */
function blackBoxElements(graph: Graph, target: EvidenceTarget, inScope: (id: string) => boolean): ViewElement[] {
  if ((target.elementTypes as readonly string[]).includes("Multiprocess")) return [];
  const out: ViewElement[] = [];
  for (const type of ["Process", "DataStore"] as const) {
    if (!(target.elementTypes as readonly string[]).includes(type)) continue;
    const map: Readonly<Record<string, string>> = BLACK_BOX_FIELDS[type];
    for (const id of graph.blackBoxes) {
      const box = graph.elements.get(id);
      if (!box || !inScope(id)) continue;
      const properties: Record<string, unknown> = {};
      for (const [property, inner] of Object.entries(map)) {
        const value = box.properties?.[inner];
        if (!isUnset(value)) properties[property] = value;
      }
      if (Object.keys(properties).length > 0) out.push({ id, type, properties });
    }
  }
  return out;
}

/**
 * FX-21: the element's own fields among the checks that read as unset — under
 * the field the user sets (a black box's "inside" field for a contained
 * Process / DataStore, D-30c). Unknowns that come from a neighbour list none.
 */
function unsetFields(element: ViewElement, checks: readonly PropertyCheck[], typeA: boolean, viaBox: boolean): string[] {
  const map: Readonly<Record<string, string>> | undefined = viaBox
    ? BLACK_BOX_FIELDS[element.type as keyof typeof BLACK_BOX_FIELDS]
    : undefined;
  return checks
    .filter((check) => evaluateCheck(element, check, typeA) === "unknown")
    .map((check) => map?.[check.property] ?? check.property);
}

/** D-30c: the "inside" fields a black box would answer the rule's Process / DataStore checks with. */
function standInFields(rule: EvidenceRule<AnyRequirementId>): string[] {
  const out = new Set<string>();
  for (const target of rule.targets) {
    for (const type of STAND_IN_TYPES as readonly (keyof typeof BLACK_BOX_FIELDS)[]) {
      if (!(target.elementTypes as readonly string[]).includes(type)) continue;
      const map: Readonly<Record<string, string>> = BLACK_BOX_FIELDS[type];
      for (const check of [...(target.appliesIf ?? []), ...(target.satisfiedIf ?? []), ...(target.satisfiedIfAll ?? [])]) {
        if (map[check.property]) out.add(map[check.property]);
      }
    }
  }
  return [...out];
}

const addUnset = (unset: Record<string, string[]>, id: string, fields: readonly string[]) => {
  if (fields.length > 0) unset[id] = [...new Set([...(unset[id] ?? []), ...fields])];
};

/** Steps 4 – 7 and 9 for one requirement id. */
function evaluateRule(rule: EvidenceRule<AnyRequirementId>, graph: Graph, input: ComplianceInput): IdOutcome {
  const typeA = rule.type === "A";
  // EN 50742 A: risk and project evidence and the SRSL come from the
  // En50742View (CM-12); without it a statement meets the row.
  if (rule.external) {
    if (!input.en50742) return outcome("needs-statement", { reasoning: "evaluated from the risks and the project data" });
    const e = externalOutcome(rule.external, input.en50742, input.run);
    return outcome(e.status, {
      ...(e.status === "met" ? { source: "model" as const } : {}),
      failing: e.failing ?? [],
      unknown: e.unknown ?? [],
      risks: e.risks ?? [],
      reasoning: e.reasoning,
      openChecklist: [...(rule.checklist ?? [])],
    });
  }
  if (rule.minSrsl) {
    const reached = input.en50742 ? srslReached(rule.minSrsl, input.en50742) : "unknown";
    if (reached === "no") return outcome("n/a", { reasoning: `no risk reaches SRSL ${rule.minSrsl}` });
    if (reached === "unknown") return outcome("unknown", { reasoning: `applies from SRSL ${rule.minSrsl} — risks not rated yet` });
  }
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
  const unset: Record<string, string[]> = {};
  // Black boxes that took part through their "inside" fields are no stand-ins.
  const viaFields = new Set<string>();
  for (const target of rule.targets) {
    const boxes = blackBoxElements(graph, target, inScope);
    for (const box of boxes) viaFields.add(box.id);
    for (const element of [...candidates(graph, target, inScope, true), ...boxes]) {
      const tri = applicable(graph, element, target);
      if (tri === "yes") applicableYes.push({ element, target });
      else if (tri === "unknown") {
        applicableUnknown.push(element.id);
        addUnset(unset, element.id, unsetFields(element, target.appliesIf ?? [], false, boxes.includes(element)));
      }
    }
  }
  if (!wholeComponent && applicableYes.length === 0) {
    if (applicableUnknown.length > 0) return outcome("unknown", { unknown: applicableUnknown, unset });
    const standIns = blackBoxStandIns(rule, graph, inScope).filter((id) => !viaFields.has(id));
    if (standIns.length > 0) {
      for (const id of standIns) addUnset(unset, id, standInFields(rule));
      return outcome("unknown", {
        unknown: standIns,
        unset,
        reasoning: `no ${describeTargets(rule.targets)} modelled — a multiprocess without child page may contain one`,
      });
    }
    return outcome("n/a", { reasoning: `no applicable ${describeTargets(rule.targets)} in the component` });
  }

  // Step 5 — satisfaction in scope (types A / B); type C needs a statement.
  let model: IdOutcome;
  // Type B: checklist items answered by model fields (CM-5b) — "no" fails the row.
  const answered = answerChecklist(rule, applicableYes.map((a) => a.element));
  if (rule.type === "C") {
    model = outcome("needs-statement");
  } else {
    const results = applicableYes.map(({ element, target }) => {
      const tri = satisfied(element, target, typeA);
      if (tri === "unknown") {
        const checks = [...(target.satisfiedIf ?? []), ...(target.satisfiedIfAll ?? [])];
        addUnset(unset, element.id, unsetFields(element, checks, typeA, viaFields.has(element.id) && STAND_IN_TYPES.includes(element.type)));
      }
      return { id: element.id, tri };
    });
    const yes = results.filter((r) => r.tri === "yes").map((r) => r.id);
    const no = results.filter((r) => r.tri === "no").map((r) => r.id);
    const unknown = [...results.filter((r) => r.tri === "unknown").map((r) => r.id), ...applicableUnknown];
    if ((rule.quantifier ?? "all") === "all") {
      // D-19: an element with unknown applicability blocks "met" too; step 9: no before unknown.
      model =
        no.length > 0
          ? outcome("gap", { failing: no, unknown, unset })
          : unknown.length > 0
            ? outcome("unknown", { unknown, unset })
            : outcome("met", { source: "model" });
    } else {
      // "any": one satisfying element suffices; an unknown one might still satisfy.
      model =
        yes.length > 0
          ? outcome("met", { source: "model" })
          : unknown.length > 0
            ? outcome("unknown", { failing: no, unknown, unset })
            : outcome("gap", { failing: no });
    }
  }
  if (answered.failing.length > 0 && (model.status === "met" || model.status === "unknown")) {
    model = outcome("gap", { failing: answered.failing, unknown: model.unknown, unset: model.unset });
  }
  model = { ...model, openChecklist: answered.open };
  if (model.status === "met") return model;

  // Step 6 — mitigations naming the requirement, chosen for risks in scope (D-16).
  const mitigations = (input.mitigations ?? []).filter(
    (m) =>
      (m.requirementIds as readonly string[]).includes(rule.id) &&
      // A flow counts when it touches the scope, as for the evidence (a threat
      // on a flow concerns the flow itself).
      m.concernsElementIds.some(inScope) &&
      !m.unclear &&
      (input.run === "planned" || m.done),
  );
  // D-29: a rule every element must meet is covered element by element — a
  // mitigation counts only for the elements its risks concern; the rest stays
  // open. Row-level (as before): C rows and "any" rules (a capability of the
  // component as a whole).
  const open = [...model.failing, ...model.unknown];
  if (mitigations.length > 0 && rule.type !== "C" && (rule.quantifier ?? "all") === "all" && open.length > 0) {
    const covering = mitigations.filter((m) => m.concernsElementIds.some((id) => open.includes(id)));
    if (covering.length === 0) return model;
    const covered = new Set(covering.flatMap((m) => m.concernsElementIds));
    const mitigationIds = covering.map((m) => m.mitigationId);
    // D-21: in the achieved run a done mitigation does not overrule a clear model "no".
    const failing = input.run === "achieved" ? model.failing : model.failing.filter((id) => !covered.has(id));
    const unknown = model.unknown.filter((id) => !covered.has(id));
    const contradiction = input.run === "achieved" && model.failing.some((id) => covered.has(id));
    if (failing.length > 0) return { ...model, failing, unknown, mitigationIds, ...(contradiction ? { contradiction } : {}) };
    if (unknown.length > 0) return { ...model, status: "unknown", failing, unknown, mitigationIds };
    return { ...model, status: "met", source: "mitigation", failing, unknown, mitigationIds };
  }
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

/** One element's answer to a checklist item: yes, no, or open (unknown). */
function answerOf(element: ViewElement, answer: ChecklistAnswer): Tri {
  if (answer.yesIf.some((c) => evaluateCheck(element, c, false) === "yes")) return "yes";
  if ((answer.noIf ?? []).some((c) => evaluateCheck(element, c, false) === "yes")) return "no";
  return "unknown";
}

/** The checklist items still open and the elements whose fields fail one (CM-5b). */
function answerChecklist(rule: EvidenceRule<AnyRequirementId>, elements: readonly ViewElement[]): { open: string[]; failing: string[] } {
  const checklist = rule.checklist ?? [];
  if (rule.type !== "B" || !rule.answers?.length || elements.length === 0) return { open: [...checklist], failing: [] };
  const any = rule.quantifier === "any";
  const answeredYes = new Set<number>();
  const failing = new Set<string>();
  for (const answer of rule.answers) {
    const own = answer.elementTypes ? elements.filter((e) => answer.elementTypes!.includes(e.type as never)) : elements;
    if (own.length === 0) continue;
    const results = own.map((e) => ({ id: e.id, tri: answerOf(e, answer) }));
    const tris = results.map((r) => r.tri);
    const tri = any ? (tris.includes("yes") ? "yes" : tris.every((t) => t === "no") ? "no" : "unknown") : and(tris);
    if (tri === "yes") answeredYes.add(answer.item);
    if (tri === "no") for (const r of results) if (r.tri === "no") failing.add(r.id);
  }
  return { open: checklist.filter((_, i) => !answeredYes.has(i)), failing: [...failing] };
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
  const risks = [...new Set(outcomes.flatMap((o) => o.risks ?? []))];
  const unset: Record<string, string[]> = {};
  for (const o of outcomes) for (const [id, fields] of Object.entries(o.unset ?? {})) addUnset(unset, id, fields);
  return {
    status,
    source: status === "met" ? source : undefined,
    failing: merged("failing"),
    unknown: merged("unknown"),
    supporting: merged("supporting"),
    mitigationIds: merged("mitigationIds"),
    ...(risks.length > 0 ? { risks } : {}),
    contradiction: outcomes.some((o) => o.contradiction) || undefined,
    reasoning: outcomes.map((o) => o.reasoning).find(Boolean),
    openChecklist: outcomes.flatMap((o) => o.openChecklist ?? []),
    unset,
  };
}

/** FX-21: the fields of the row's unknown elements, only for those still unknown. */
function unsetOf(combined: IdOutcome): Pick<RowResult, "unsetFields"> {
  const out = Object.fromEntries(Object.entries(combined.unset ?? {}).filter(([id]) => combined.unknown.includes(id)));
  return Object.keys(out).length > 0 ? { unsetFields: out } : {};
}

/** Phase 4b: mitigations naming the row, in scope, whose effectiveness is unclear — shown, not counted. */
function unclearOf(row: AnyEditionRow, graph: Graph, input: ComplianceInput): Pick<RowResult, "unclearMitigationIds"> {
  const inScope = (id: string) => {
    if (input.scope.has(id)) return true;
    const ends = graph.endpoints.get(id);
    return !!ends && (input.scope.has(ends[0]) || input.scope.has(ends[1]));
  };
  const ids = (input.mitigations ?? [])
    .filter(
      (m) =>
        m.unclear &&
        (m.requirementIds as readonly string[]).some((id) => (row.requirementIds as readonly string[]).includes(id)) &&
        m.concernsElementIds.some(inScope),
    )
    .map((m) => m.mitigationId);
  return ids.length > 0 ? { unclearMitigationIds: [...new Set(ids)] } : {};
}

function evaluateRow(row: AnyEditionRow, graph: Graph, input: ComplianceInput): RowResult {
  const statement = input.statements?.[row.label];
  const base = {
    label: row.label,
    group: row.group,
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
  const rules = row.requirementIds.map((id) => RULES_BY_ID.get(id)!);
  const combined = combine(rules.map((rule) => evaluateRule(rule, graph, input)));
  let status: RowStatus = combined.status;
  let source: RowSource | undefined = combined.source;

  // Step 8 — claim (D-5). A claim cited from an imported component (phase 4c)
  // counts only when effective in its instance and covering every element
  // still open on the row; otherwise it is listed, not counted.
  const open = [...combined.failing, ...combined.unknown];
  const uncountedClaims: NonNullable<RowResult["uncountedClaims"]> = [];
  const claimIds = (input.claims ?? [])
    .filter((c) => c.rowLabels.includes(row.label))
    .filter((c) => {
      const stillOpen = status !== "met" && status !== "n/a";
      if (c.state === "unclear" || c.state === "not_effective") {
        if (stillOpen) uncountedClaims.push({ id: c.displayId, reason: c.state });
        return false;
      }
      if (c.concernsElementIds && !(open.length > 0 && open.every((id) => c.concernsElementIds!.includes(id)))) {
        if (stillOpen) uncountedClaims.push({ id: c.displayId, reason: "partial" });
        return false;
      }
      return true;
    })
    .map((c) => c.displayId);
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
    ...unsetOf(combined),
    supportingElements: combined.supporting,
    mitigationIds: combined.mitigationIds,
    ...(combined.risks ? { risks: combined.risks } : {}),
    claimIds,
    ...(uncountedClaims.length > 0 ? { uncountedClaims } : {}),
    checklist: status === "met" ? (combined.openChecklist ?? []) : [],
    reasoning: combined.reasoning,
    contradiction: combined.contradiction,
    ...unclearOf(row, graph, input),
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
    const blocking = rows.filter((r) => r.group === fr && r.minSl !== null && !counts(r)).map((r) => r.minSl as number);
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
    ...(input.en50742 ? { srsl: srslSummary(input.en50742) } : {}),
  };
}
