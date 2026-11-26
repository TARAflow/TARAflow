// shared/utils/element-info.ts
//
// What the Threats tab and the threat and risk dialogs show about a DFD element
// or data flow when the analyst rates a threat or a risk (manual test
// 2026-11-24: "I don't see the element's info, I have to switch to the DFD
// tab"). Read from the analysis graph the tab already has — no access to the
// DFD feature. In shared since 0.20 (risk dialog, 2026-11-25).

import type { DFDGraphReference } from "../models/dfd-reference-types";

export type InfoValue = string | number | boolean | readonly string[];

export interface InfoProperty {
  key: string;
  value: InfoValue;
}

export interface InfoFlow {
  direction: "in" | "out";
  displayId: string;
  name?: string;
  partnerDisplayId: string;
  partnerName: string;
}

export interface InfoEndpoint {
  role: "source" | "target";
  displayId: string;
  name: string;
  type: string;
  /**
   * The endpoint element's own info — for an interaction threat the target's
   * properties (authentication, input validation, …) often decide the rating.
   */
  element: ElementInfo | null;
}

export interface ElementInfo {
  kind: "element" | "flow";
  id: string;
  displayId: string;
  name: string;
  /** DFD element type ("Process", "DataStore", …, "DataFlow"). */
  type: string;
  description?: string;
  /** Trust, chip and physical boundaries the element lies in (names). */
  boundaries: string[];
  /** Filled-in properties, in the element's order; empty values left out. */
  properties: InfoProperty[];
  /** Elements only: connected data flows, incoming first. */
  flows: InfoFlow[];
  /** Flows only: source and target. */
  endpoints: InfoEndpoint[];
  /** Linked asset names. */
  assets: string[];
}

/** Shown separately, never as a property row. */
const OWN_FIELDS = new Set(["description"]);

function toValue(raw: unknown): InfoValue | undefined {
  if (typeof raw === "string") return raw.trim() === "" ? undefined : raw;
  if (typeof raw === "number" || typeof raw === "boolean") return raw;
  if (Array.isArray(raw)) {
    const items = raw.filter((x): x is string | number => typeof x === "string" || typeof x === "number").map(String);
    return items.length > 0 && items.length === raw.length ? items : undefined;
  }
  return undefined;
}

function propertiesOf(props: Record<string, unknown> | undefined): InfoProperty[] {
  const out: InfoProperty[] = [];
  for (const [key, raw] of Object.entries(props ?? {})) {
    if (OWN_FIELDS.has(key)) continue;
    const value = toValue(raw);
    if (value !== undefined) out.push({ key, value });
  }
  return out;
}

function descriptionOf(base: string | undefined, props: Record<string, unknown> | undefined): string | undefined {
  const own = typeof props?.description === "string" ? props.description : undefined;
  const text = (own ?? base ?? "").trim();
  return text === "" ? undefined : text;
}

function assetNames(graph: DFDGraphReference, relations: ReadonlyArray<{ assetId: string }> | undefined): string[] {
  const names = (relations ?? []).map((r) => graph.assetsById.get(r.assetId)?.name ?? r.assetId);
  return [...new Set(names)];
}

function boundaryNames(graph: DFDGraphReference, elementId: string): string[] {
  const ids = [
    ...(graph.elementTrustBoundaries.get(elementId) ?? []),
    ...(graph.elementChipBoundaries.get(elementId) ?? []),
    ...(graph.elementPhysicalBoundaries.get(elementId) ?? []),
  ];
  return [...new Set(ids.map((id) => graph.elementsById.get(id)?.name ?? id))];
}

/** The info of a DFD element (process, data store, interface, …); null if the graph does not have it. */
export function elementInfo(graph: DFDGraphReference | null | undefined, elementId: string | undefined): ElementInfo | null {
  if (!graph || !elementId) return null;
  const el = graph.elementsById.get(elementId);
  if (!el) return null;
  const flow = (direction: "in" | "out", connectionId: string): InfoFlow | null => {
    const c = graph.connectionsById.get(connectionId);
    if (!c) return null;
    const partner = graph.elementsById.get(direction === "in" ? c.from : c.to);
    return {
      direction,
      displayId: c.displayId,
      ...(c.name || c.label ? { name: c.name || c.label } : {}),
      partnerDisplayId: partner?.displayId ?? "",
      partnerName: partner?.name ?? (direction === "in" ? c.from : c.to),
    };
  };
  const flows = [
    ...(graph.incomingConnections.get(elementId) ?? []).map((id) => flow("in", id)),
    ...(graph.outgoingConnections.get(elementId) ?? []).map((id) => flow("out", id)),
  ].filter((f): f is InfoFlow => f !== null);
  const description = descriptionOf(el.description, el.properties);
  return {
    kind: "element",
    id: el.id,
    displayId: el.displayId,
    name: el.name,
    type: el.type,
    ...(description ? { description } : {}),
    boundaries: boundaryNames(graph, el.id),
    properties: propertiesOf(el.properties),
    flows,
    endpoints: [],
    assets: assetNames(graph, el.assetRelations),
  };
}

/**
 * The info of a data flow. Found by connection id, or — for threats that
 * carry only the flow's display id — by its display id.
 */
export function flowInfo(
  graph: DFDGraphReference | null | undefined,
  ref: { connectionId?: string; displayId?: string },
): ElementInfo | null {
  if (!graph) return null;
  const c =
    (ref.connectionId ? graph.connectionsById.get(ref.connectionId) : undefined) ??
    (ref.displayId ? [...graph.connectionsById.values()].find((x) => x.displayId === ref.displayId) : undefined);
  if (!c) return null;
  const endpoint = (role: "source" | "target", id: string): InfoEndpoint => {
    const e = graph.elementsById.get(id);
    return { role, displayId: e?.displayId ?? "", name: e?.name ?? id, type: e?.type ?? "", element: elementInfo(graph, id) };
  };
  const props = c.properties;
  const description = descriptionOf(undefined, props);
  return {
    kind: "flow",
    id: c.id,
    displayId: c.displayId,
    name: c.name || c.label || "",
    type: "DataFlow",
    ...(description ? { description } : {}),
    boundaries: [],
    properties: propertiesOf(props),
    flows: [],
    endpoints: [endpoint("source", c.from), endpoint("target", c.to)],
    assets: assetNames(graph, c.assetRelations),
  };
}

/** The i18n segment of the DFD property form for an element type. */
export function propertyFormKey(type: string): string {
  switch (type) {
    case "ExternalEntity":
      return "external_entity";
    case "DataFlow":
      return "dataflow";
    default:
      return type.toLowerCase();
  }
}
