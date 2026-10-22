// ==================== DANGLING REFERENCES ====================
// Leveled-DFD Phase 1.4 (leveled-dfd-multi-diagram-design.md §5.2.1, D12).
//
// A logical element or flow is dangling while it has context copies but no
// definition cell (typically: the definition was deleted, copies remain).
// Finding BAL_DANGLING_REF (error). It is never repaired automatically —
// promotion changes the home page and the boundary membership — the
// analyst picks a copy with "Promote to definition" (identity-links.ts).
//
// Until then the element stays in the model: the parser takes its record
// from the first copy, and the persisted record (displayId, properties,
// asset relations) is merged onto it by id as usual (D10, D12).

import type { ParsedOccurrence } from "../dfd-parser";

export interface DanglingReference {
  kind: ParsedOccurrence["kind"];
  tfId: string;
  /** All context copies of the tfId, in document order. */
  copies: ParsedOccurrence[];
}

export function findDanglingReferences(
  occurrences: readonly ParsedOccurrence[],
): DanglingReference[] {
  const defined = new Set<string>();
  const copies = new Map<string, DanglingReference>();

  for (const o of occurrences) {
    const key = `${o.kind}\u0000${o.tfId}`;
    if (o.role === "definition") {
      defined.add(key);
      continue;
    }
    const entry = copies.get(key) ?? { kind: o.kind, tfId: o.tfId, copies: [] };
    entry.copies.push(o);
    copies.set(key, entry);
  }

  return Array.from(copies.entries())
    .filter(([key]) => !defined.has(key))
    .map(([, entry]) => entry);
}
