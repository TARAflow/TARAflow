// src/app/utils/en50742-relevance.ts
//
// EN 50742 (O17 / O18, user 2026-11-20): the standard is about the interfaces
// to the safety functions and the data flows crossing them — for Approach A
// (EL, AC, WoO, SRSL) and Approach B (Table 4) alike. Which interfaces and
// flows are "EN 50742 relevant" is decided once, here:
//
//   zone   a trust boundary marked as the safety zone (O18) marks the safety-related part of
//          the machine (the yellow area of the grey / yellow separation):
//          every flow that crosses its border (in either direction) is
//          relevant, and so is every interface such a flow passes;
//   path   without a safety zone: the interfaces and flows on a path to a
//          safety function (an asset with a physical impact) — the search of
//          CM-12b (safety-function-paths.ts);
//   none   neither a zone nor a safety function — nothing is relevant (the
//          rows and risks that need it stay unknown, never met).
//
// Every relevant id carries its reason, so the Risks and Compliance tabs can
// say why ("DF-3 crosses into the safety zone SZ via IF-2").
//
// Pure: the caller (compliance-report.ts) passes the graph facts.

import { pathAnchors, type SafetyPathInput } from "./safety-function-paths";

export type En50742RelevanceMode = "zone" | "path" | "none";

export type En50742RelevanceReason =
  | { kind: "crosses-zone"; zoneIds: string[] }
  | { kind: "zone-interface"; zoneIds: string[]; flowIds: string[] }
  | { kind: "on-path"; safetyFunctionIds: string[] };

export interface En50742Relevance {
  mode: En50742RelevanceMode;
  /** The safety zones (trust boundaries marked as the safety zone). */
  zoneIds: string[];
  /** Relevant interface and flow ids, with their reason. */
  relevant: Map<string, En50742RelevanceReason>;
}

export interface En50742RelevanceInput {
  /** Trust boundaries marked as the safety zone (shared safety-zone helper). */
  zoneIds: readonly string[];
  /** Flow id → the trust boundaries its source and its target lie in. */
  boundariesOf: (flowId: string) => { from: readonly string[]; to: readonly string[] } | undefined;
  /** Safety functions: assets with a physical impact and their DFD elements. */
  safetyFunctions: readonly { id: string; linkedIds: readonly string[] }[];
  /** The path search of CM-12b (flows, interfaces, one-way stops, containment). */
  paths: SafetyPathInput;
}

export function en50742Relevance(input: En50742RelevanceInput): En50742Relevance {
  const zoneIds = [...input.zoneIds];
  const relevant = new Map<string, En50742RelevanceReason>();

  if (zoneIds.length > 0) {
    const zones = new Set(zoneIds);
    const interfaceReasons = new Map<string, { zoneIds: Set<string>; flowIds: Set<string> }>();
    for (const flow of input.paths.flows) {
      const b = input.boundariesOf(flow.id);
      if (!b) continue;
      const from = new Set(b.from);
      const to = new Set(b.to);
      const crossed = [...zones].filter((z) => from.has(z) !== to.has(z));
      if (crossed.length === 0) continue;
      relevant.set(flow.id, { kind: "crosses-zone", zoneIds: crossed.sort() });
      for (const i of input.paths.interfacesOf(flow.id)) {
        const r = interfaceReasons.get(i) ?? { zoneIds: new Set<string>(), flowIds: new Set<string>() };
        crossed.forEach((z) => r.zoneIds.add(z));
        r.flowIds.add(flow.id);
        interfaceReasons.set(i, r);
      }
    }
    for (const [id, r] of interfaceReasons) {
      relevant.set(id, { kind: "zone-interface", zoneIds: [...r.zoneIds].sort(), flowIds: [...r.flowIds].sort() });
    }
    return { mode: "zone", zoneIds, relevant };
  }

  if (input.safetyFunctions.length === 0) return { mode: "none", zoneIds, relevant };

  const bySf = new Map<string, Set<string>>();
  for (const sf of input.safetyFunctions) {
    for (const id of pathAnchors(sf.linkedIds, input.paths)) {
      const set = bySf.get(id) ?? new Set<string>();
      set.add(sf.id);
      bySf.set(id, set);
    }
  }
  for (const [id, sfs] of bySf) relevant.set(id, { kind: "on-path", safetyFunctionIds: [...sfs].sort() });
  return { mode: "path", zoneIds, relevant };
}

// ==================== PER THREAT ====================

/** What a risk's threat is anchored on — the EN 50742 anchors are interfaces and data flows. */
export interface AnchoredThreat {
  linkedElement?: { elementId?: string; elementType?: string } | null;
  dataFlow?: { connectionId?: string } | null;
}

export function threatAnchor(threat: AnchoredThreat): { id?: string; kind: "interface" | "flow" | "other" } {
  const linked = threat.linkedElement;
  if (linked?.elementId) {
    if (linked.elementType === "Interface") return { id: linked.elementId, kind: "interface" };
    if (linked.elementType === "DataFlow") return { id: linked.elementId, kind: "flow" };
    return { id: linked.elementId, kind: "other" };
  }
  const flow = threat.dataFlow?.connectionId;
  return flow ? { id: flow, kind: "flow" } : { kind: "other" };
}

export type ThreatRelevance =
  | { relevant: true; reason: En50742RelevanceReason }
  | { relevant: false; reason: "not-an-interface" | "outside-zone" | "off-path" | "no-safety-scope" };

/** Whether a threat's risk gets EL / AC / WoO / SRSL (O18), and why (not). */
export function threatRelevance(threat: AnchoredThreat, relevance: En50742Relevance): ThreatRelevance {
  const anchor = threatAnchor(threat);
  if (anchor.kind === "other" || !anchor.id) return { relevant: false, reason: "not-an-interface" };
  const reason = relevance.relevant.get(anchor.id);
  if (reason) return { relevant: true, reason };
  if (relevance.mode === "none") return { relevant: false, reason: "no-safety-scope" };
  return { relevant: false, reason: relevance.mode === "zone" ? "outside-zone" : "off-path" };
}

/** English text of a threat's relevance (the default of its i18n key). */
export const THREAT_RELEVANCE_TEXTS = {
  "crosses-zone": "the flow crosses the safety zone {{zones}}",
  "zone-interface": "the interface lies on the border of the safety zone {{zones}} ({{flows}})",
  "on-path": "on a path to the safety function {{functions}}",
  "not-an-interface": "the threat is not on an interface or a data flow",
  "outside-zone": "the interface / flow does not cross the safety zone",
  "off-path": "the interface / flow is on no path to a safety function",
  "no-safety-scope": "no safety zone and no safety function modelled",
} as const;

type Translate = (key: string, options: Record<string, unknown>) => string;

/** The display text of a threat's relevance — labels by element id (display id / name). */
export function threatRelevanceText(r: ThreatRelevance, labelOf: (id: string) => string, t: Translate): string {
  const list = (ids: readonly string[]) => ids.map(labelOf).join(", ");
  const code = typeof r.reason === "string" ? r.reason : r.reason.kind;
  const values =
    typeof r.reason === "string"
      ? {}
      : r.reason.kind === "on-path"
        ? { functions: list(r.reason.safetyFunctionIds) }
        : { zones: list(r.reason.zoneIds), flows: r.reason.kind === "zone-interface" ? list(r.reason.flowIds) : "" };
  return t(`tabs.risks.en50742Relevance.${code}`, { ...values, defaultValue: THREAT_RELEVANCE_TEXTS[code] });
}

// ==================== SCOPE OF THE MODEL ROWS ====================

/**
 * O17: the model rows of EN 50742 A and B are evaluated on the relevant
 * interfaces and flows and on what those flows reach directly — the process
 * / store behind the interface (the flow's endpoints) and the chip and
 * physical boundaries around it. Empty in mode "none" (the rows are then
 * unknown, never met).
 */
export function en50742Scope(
  relevance: En50742Relevance,
  flows: readonly { id: string; from: string; to: string }[],
  boundariesAround: (elementId: string) => readonly string[],
): Set<string> {
  const scope = new Set<string>(relevance.relevant.keys());
  for (const flow of flows) {
    if (!relevance.relevant.has(flow.id)) continue;
    for (const end of [flow.from, flow.to]) {
      scope.add(end);
      for (const b of boundariesAround(end)) scope.add(b);
    }
  }
  return scope;
}

// ==================== ISOLATION OF A SAFETY FUNCTION ====================

/**
 * Whether a safety function is completely isolated (EN 50742 Table 2,
 * SRSL0; 0.20 patch 22, user 2026-11-21 — the stricter reading of F2): every
 * interface on a path to it has EL0. An interface whose EL is not set and a
 * flow with an EL above EL0 make it not isolated. `exposedBy` names them.
 * Patch 21 applied the rule per interface; the risks of a function that is
 * not isolated now get no SRSL0 on any of its interfaces (the internal bus of
 * a controller with a USB port included).
 */
export interface FunctionIsolation {
  isolated: boolean;
  /** Interfaces / flows on its paths that make it reachable, with their EL ("unset" if none). */
  exposedBy: { id: string; el: string }[];
}

export function safetyFunctionIsolation(
  linkedIds: readonly string[],
  paths: SafetyPathInput,
  itemOf: (id: string) => { type?: string; exposureLevel?: string } | undefined,
): FunctionIsolation {
  const anchors = pathAnchors(linkedIds, paths);
  // An interface the function is linked to directly ("invokes" / "monitors").
  for (const id of linkedIds) if (itemOf(id)?.type === "Interface") anchors.add(id);
  const exposedBy: { id: string; el: string }[] = [];
  for (const id of [...anchors].sort()) {
    const item = itemOf(id);
    if (!item) continue;
    const el = item.exposureLevel;
    if (item.type === "Interface") {
      if (el !== "EL0") exposedBy.push({ id, el: el ?? "unset" });
    } else if (el && el !== "EL0") {
      exposedBy.push({ id, el });
    }
  }
  return { isolated: exposedBy.length === 0, exposedBy };
}

/**
 * The isolation of a threat's safety functions: isolated only when all of
 * them are. Undefined when the threat is linked to no safety function.
 */
export function threatIsolation(
  linkedAssetIds: readonly string[] | undefined,
  isolation: ReadonlyMap<string, FunctionIsolation>,
): { isolated: boolean; notIsolated: { functionId: string; exposedBy: FunctionIsolation["exposedBy"] }[] } | undefined {
  const functions = (linkedAssetIds ?? []).filter((id) => isolation.has(id));
  if (functions.length === 0) return undefined;
  const notIsolated = functions
    .map((functionId) => ({ functionId, exposedBy: isolation.get(functionId)!.exposedBy }))
    .filter((f) => f.exposedBy.length > 0);
  return { isolated: notIsolated.length === 0, notIsolated };
}

/** English default of the isolation text: "E-Stop via IF-1 USB (EL1), IF-2 JTAG (unset)". */
export function threatIsolationText(
  notIsolated: { functionId: string; exposedBy: FunctionIsolation["exposedBy"] }[],
  labelOf: (id: string) => string,
  t: Translate,
): string {
  const parts = notIsolated.map((f) =>
    t("tabs.risks.en50742Isolation.function", {
      fn: labelOf(f.functionId),
      via: f.exposedBy
        .slice(0, 3)
        .map((x) => `${labelOf(x.id)} (${x.el === "unset" ? t("tabs.risks.en50742Isolation.unset", { defaultValue: "EL not set" }) : x.el})`)
        .join(", ") + (f.exposedBy.length > 3 ? ", …" : ""),
      defaultValue: "{{fn}} is reachable via {{via}}",
    }),
  );
  return parts.join("; ");
}
