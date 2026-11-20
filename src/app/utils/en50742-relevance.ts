// src/app/utils/en50742-relevance.ts
//
// EN 50742 (O17 / O18, user 2026-11-20): the standard is about the interfaces
// to the safety functions and the data flows crossing them — for Approach A
// (EL, AC, WoO, SRSL) and Approach B (Table 4) alike. Which interfaces and
// flows are "EN 50742 relevant" is decided once, here:
//
//   zone   a trust boundary of type "safety" marks the safety-related part of
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
  /** The safety zones (trust boundaries of type "safety"). */
  zoneIds: string[];
  /** Relevant interface and flow ids, with their reason. */
  relevant: Map<string, En50742RelevanceReason>;
}

export interface En50742RelevanceInput {
  /** Trust boundaries of type "safety". */
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
