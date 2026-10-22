// ==================== IDENTITY READER ====================
// Leveled-DFD Phase 1.2 (leveled-dfd-multi-diagram-design.md §5.2).
//
// Resolves the identity of the cells of one draw.io page from the identity
// links stored in the project (dfd.pages[].links) — "lazy identity":
//
//   no link                          → definition, tfId = cell id (every
//                                      existing project, every normally
//                                      drawn element)
//   { role: "ref", tfId: X }         → context copy of the logical
//                                      element / flow X
//   { role: "definition", tfId: X }  → definition whose identity differs
//                                      from its cell id (moved / adopted)
//
// The XML stays plain draw.io: no identity attributes are read or written.
// Only cells whose identity differs from their cell id carry a link, so
// classic projects have none and need no migration.
//
// Malformed links are ignored, never guessed into a merge: an empty cell id
// or tfId, and every further link for a cell id that already has one (the
// first one wins). A "definition" link with tfId = cell id says nothing and
// is skipped; a "ref" link with tfId = cell id is valid — it is the former
// definition cell after "Make this the definition" moved the definition to
// another cell.

import type { DFDCellLink } from "../../models/dfd-types";

export type OccurrenceRole = "definition" | "ref";

export interface CellIdentity {
  tfId: string;
  role: OccurrenceRole;
}

/**
 * Identity links of one page, keyed by cell id. Use {@link identityOf} to
 * look a cell up; cells without a link are plain definitions.
 */
export function collectCellIdentities(
  links: readonly DFDCellLink[] | undefined,
): Map<string, CellIdentity> {
  const identities = new Map<string, CellIdentity>();

  for (const link of links ?? []) {
    const cellId = (link.cellId ?? "").trim();
    const tfId = (link.tfId ?? "").trim();
    if (cellId === "" || tfId === "") continue;
    if (identities.has(cellId)) continue;

    const role: OccurrenceRole = link.role === "ref" ? "ref" : "definition";
    if (role === "definition" && tfId === cellId) continue;
    identities.set(cellId, { tfId, role });
  }

  return identities;
}

/** Identity of a page-local cell; default = definition with tfId = cell id. */
export function identityOf(
  identities: Map<string, CellIdentity>,
  cellId: string,
): CellIdentity {
  return identities.get(cellId) ?? { tfId: cellId, role: "definition" };
}
