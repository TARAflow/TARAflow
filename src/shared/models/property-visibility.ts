// shared/models/property-visibility.ts
//
// Model coverage fields and when they are shown (model-coverage-implementation-
// plan.md §3, CM-4). One registry entry per field; every consumer — the DFD
// form, the compliance evaluator, threat generation, the closed loop and the
// report — asks the same predicate (R-3), so "shown when" has one truth.
//
//   R-1  every field starts at "not_specified"; a yes/no field is three-valued
//        (not_specified / yes / no) — an unfinished model never looks better
//        than a complete one
//   R-2  nothing is written on load: unset stays unset
//   R-3  one predicate per field, here (pure, shared: the evaluator may not
//        import features/dfd)
//   R-4  a hidden field is ignored everywhere but kept in the file (K-7):
//        readers get it as unset (readModelField, withoutHiddenFields); when
//        the driver changes back, the value returns
//
// The fields of stage 1 (§4.2) join the registry with CM-5 … CM-7. The
// guard test src/tests/unit/shared/models/property-visibility.guard.test.ts
// checks that no consumer reads a registered field around the predicate.
// Labels, help texts and values: dfd.json, tabs.dfd.modelFields.<property>
// (R-7); "not specified" uses the common key.

// ==================== CONTEXT ====================

/** What a predicate sees of an element or a flow. */
export interface VisibilityElement {
  id: string;
  /** Element type; flows are "DataFlow". */
  type: string;
  properties?: Readonly<Record<string, unknown>>;
}

/** A flow at the element and the element at its other end. */
export interface VisibilityLink {
  flow: VisibilityElement;
  /** Absent when the other end is not in the model (dangling flow). */
  other?: VisibilityElement;
}

export interface VisibilityContext {
  element: VisibilityElement;
  /** Flows into the element (none for a flow). */
  incoming: readonly VisibilityLink[];
  /** Flows out of the element (none for a flow). */
  outgoing: readonly VisibilityLink[];
  /** For a flow: its source and target. */
  endpoints?: { from?: VisibilityElement; to?: VisibilityElement };
}

/** A flow as the DFD and the property view store it. */
export interface VisibilityFlowInput {
  id: string;
  from: string;
  to: string;
  properties?: Readonly<Record<string, unknown>>;
}

// ==================== REGISTRY ====================

export const NOT_SPECIFIED = "not_specified";

export interface ModelField {
  /** Property key on the element (top level of `properties`). */
  property: string;
  /** Element types that carry the field (R-6). */
  elementTypes: readonly string[];
  /** Values in display order; the first is "not_specified" (R-1). */
  values: readonly string[];
  /** Multi-select: the stored value is an array of `values` (without "not_specified"). */
  multiple?: boolean;
  /**
   * When the field is shown (R-3) — only asked for elements of `elementTypes`.
   * A driver that is itself a registered field is read with readModelField.
   */
  shownWhen: (context: VisibilityContext) => boolean;
}

/** The registered fields; stage 1 joins with CM-5 … CM-7. */
export const MODEL_FIELDS: readonly ModelField[] = [];

export function modelField(property: string, fields: readonly ModelField[] = MODEL_FIELDS): ModelField | undefined {
  return fields.find((f) => f.property === property);
}

// ==================== PREDICATES ====================

/** Unset: absent, empty, "not_specified" or an empty selection (R-1). */
export function isUnset(value: unknown): boolean {
  return value === undefined || value === null || value === "" || value === NOT_SPECIFIED || (Array.isArray(value) && value.length === 0);
}

/** The field belongs to the element's type and its driver shows it. */
export function isFieldShown(field: ModelField, context: VisibilityContext): boolean {
  return field.elementTypes.includes(context.element.type) && field.shownWhen(context);
}

/** The value every consumer reads (R-4): unset while the field is hidden. */
export function readModelField(field: ModelField, context: VisibilityContext): unknown {
  return isFieldShown(field, context) ? context.element.properties?.[field.property] : undefined;
}

// ==================== WHOLE MODEL ====================

/** Context per element and flow id, for consumers that see the whole model. */
export function visibilityContexts(
  elements: readonly VisibilityElement[],
  flows: readonly VisibilityFlowInput[],
): (id: string) => VisibilityContext | undefined {
  const byId = new Map(elements.map((e) => [e.id, e]));
  const flowElement = (f: VisibilityFlowInput): VisibilityElement => ({ id: f.id, type: "DataFlow", properties: f.properties });
  const incoming = new Map<string, VisibilityLink[]>();
  const outgoing = new Map<string, VisibilityLink[]>();
  const push = (map: Map<string, VisibilityLink[]>, id: string, link: VisibilityLink) => {
    if (!map.has(id)) map.set(id, []);
    map.get(id)!.push(link);
  };
  const flowsById = new Map<string, VisibilityFlowInput>();
  for (const f of flows) {
    flowsById.set(f.id, f);
    push(incoming, f.to, { flow: flowElement(f), other: byId.get(f.from) });
    push(outgoing, f.from, { flow: flowElement(f), other: byId.get(f.to) });
  }
  return (id) => {
    const element = byId.get(id);
    if (element) return { element, incoming: incoming.get(id) ?? [], outgoing: outgoing.get(id) ?? [] };
    const flow = flowsById.get(id);
    if (!flow) return undefined;
    return { element: flowElement(flow), incoming: [], outgoing: [], endpoints: { from: byId.get(flow.from), to: byId.get(flow.to) } };
  };
}

/** Properties without the registered fields that are hidden; the same object when none is. */
function maskProperties(
  context: VisibilityContext,
  fields: readonly ModelField[],
): Readonly<Record<string, unknown>> | undefined {
  const properties = context.element.properties;
  if (!properties) return properties;
  const hidden = fields.filter((f) => f.property in properties && !isUnset(properties[f.property]) && !isFieldShown(f, context));
  if (hidden.length === 0) return properties;
  const masked: Record<string, unknown> = { ...properties };
  for (const f of hidden) delete masked[f.property];
  return masked;
}

/**
 * The model as every reader should see it (R-4): registered fields that are
 * hidden are removed from the copies; the stored model is not touched.
 * Elements and flows without a hidden field are returned as they are.
 */
export function withoutHiddenFields<E extends VisibilityElement, F extends VisibilityFlowInput>(
  elements: readonly E[],
  flows: readonly F[],
  fields: readonly ModelField[] = MODEL_FIELDS,
): { elements: E[]; flows: F[] } {
  if (fields.length === 0) return { elements: [...elements], flows: [...flows] };
  const contextOf = visibilityContexts(elements, flows);
  const mask = <T extends { id: string; properties?: Readonly<Record<string, unknown>> }>(item: T): T => {
    const context = contextOf(item.id);
    if (!context) return item;
    const properties = maskProperties(context, fields);
    return properties === item.properties ? item : { ...item, properties };
  };
  return { elements: elements.map(mask), flows: flows.map(mask) };
}
