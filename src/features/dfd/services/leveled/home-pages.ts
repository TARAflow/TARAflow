// ==================== HOME PAGES ====================
// Leveled-DFD Phase 1.3 (leveled-dfd-multi-diagram-design.md §5.4, D5).
//
// The home page of a logical element or flow IS the page of its definition
// cell. It is not persisted and never re-derived from anything else: the XML
// says where the definition is drawn.
//
// The definition chosen here is the same one the parser takes the logical
// record from (first definition in document order), so record and home page
// can never disagree. An element with context copies only (dangling, §5.2.1)
// has no home page.

import type { ParsedOccurrence } from "../dfd-parser";

export interface HomePages {
  /** element tfId → pageId of its definition cell */
  elements: Map<string, string>;
  /** connection tfId → pageId of its definition cell */
  connections: Map<string, string>;
}

export function computeHomePages(
  occurrences: readonly ParsedOccurrence[],
): HomePages {
  const elements = new Map<string, string>();
  const connections = new Map<string, string>();

  for (const occurrence of occurrences) {
    if (occurrence.role !== "definition") continue;
    const target = occurrence.kind === "element" ? elements : connections;
    if (!target.has(occurrence.tfId)) {
      target.set(occurrence.tfId, occurrence.pageId);
    }
  }

  return { elements, connections };
}
