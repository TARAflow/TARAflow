// ==================== SIGNATURES ====================
// Leveled-DFD Phase 1.5 (leveled-dfd-multi-diagram-design.md §5.2, §11.2.1).
//
// Adoption and the paste assignment both group cells by (displayId, type):
// a context copy drawn by hand or pasted in draw.io carries the same id label
// and type as its original. That is an ASSUMPTION, so it only ever feeds a
// proposal the analyst confirms — never a silent merge.
//
// A displayId only counts if it is a real id: numbered types must match their
// prefix (P-3, MP-1, DF-7, …), boundaries their bracket id ("Case [PB]" →
// "PB"). The parser's fallback displayId (= the label) never matches, so
// cells without an id label stay singletons and are never merged.

import type { ParseResult, ParsedOccurrence } from "../dfd-parser";
import { ELEMENT_PREFIXES } from "../dfd-auto-numbering";
import { extractTrustBoundaryId } from "../parsers/parser-utils";

export interface RecordInfo {
  kind: ParsedOccurrence["kind"];
  tfId: string;
  /** DFDElementType, or "DataFlow" for connections */
  type: string;
  displayId: string;
  name: string;
}

const BOUNDARY_TYPES = new Set([
  "TrustBoundary",
  "ChipBoundary",
  "PhysicalBoundary",
]);

/** kind\0tfId → logical record info, from a ParseResult. */
export function recordInfos(
  parse: Pick<ParseResult, "elements" | "connections">,
): Map<string, RecordInfo> {
  const infos = new Map<string, RecordInfo>();
  for (const e of parse.elements) {
    infos.set(recordKey("element", e.id), {
      kind: "element",
      tfId: e.id,
      type: e.type,
      displayId: e.displayId,
      name: e.name,
    });
  }
  for (const c of parse.connections) {
    infos.set(recordKey("connection", c.id), {
      kind: "connection",
      tfId: c.id,
      type: "DataFlow",
      displayId: c.displayId,
      name: c.name,
    });
  }
  return infos;
}

export function recordKey(kind: ParsedOccurrence["kind"], tfId: string) {
  return `${kind}\u0000${tfId}`;
}

/**
 * Grouping signature, or undefined if the record has no real displayId (it
 * then stays a singleton).
 */
export function signatureOf(info: RecordInfo): string | undefined {
  const displayId = (info.displayId ?? "").trim();
  if (displayId === "") return undefined;

  if (BOUNDARY_TYPES.has(info.type)) {
    if (extractTrustBoundaryId(info.name) !== displayId) return undefined;
  } else {
    const prefix = ELEMENT_PREFIXES[info.type.toLowerCase()];
    if (!prefix) return undefined;
    const escaped = prefix.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    if (!new RegExp(`^${escaped}\\d+$`).test(displayId)) return undefined;
  }
  return `${info.kind}\u0000${info.type}\u0000${displayId}`;
}
