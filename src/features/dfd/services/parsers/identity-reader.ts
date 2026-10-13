// ==================== IDENTITY READER ====================
// Leveled-DFD Phase 1.2 (leveled-dfd-multi-diagram-design.md §5.2).
//
// Reads the optional identity attributes of one draw.io page ("lazy
// identity"):
//
//   no tfId, no tfRole        → definition, tfId = cell id (every existing
//                               project, every normally drawn element)
//   tfRole="ref" tfId="X"     → context copy of the logical element/flow X
//   tfId="X" without tfRole   → definition whose identity differs from its
//                               cell id (after "Move definition" / adoption)
//
// TARAflow writes the attributes only where the identity differs from the
// cell id, so existing XML stays byte-identical and needs no migration.
// The attributes live on the <object> wrapper — draw.io keeps custom
// attributes only there, a bare <mxCell> cannot carry them.
//
// Malformed input is never guessed into a merge:
//   - tfRole="ref" without a tfId → plain definition of its own cell
//     (it stays analysable as an element of its own; merging needs an
//     explicit tfId)
//   - an empty tfId or an unknown tfRole value is ignored

export type OccurrenceRole = "definition" | "ref";

export interface CellIdentity {
  tfId: string;
  role: OccurrenceRole;
}

/**
 * Identity attributes of all <object> cells of one page, keyed by cell id.
 * Only cells whose identity differs from the default (definition, tfId =
 * cell id) are listed; use {@link identityOf} to look a cell up.
 */
export function collectCellIdentities(
  doc: Document,
): Map<string, CellIdentity> {
  const identities = new Map<string, CellIdentity>();

  for (const obj of Array.from(doc.getElementsByTagName("object"))) {
    const cellId = obj.getAttribute("id");
    if (!cellId) continue;

    const tfId = (obj.getAttribute("tfId") ?? "").trim();
    if (tfId === "") continue;

    const role: OccurrenceRole =
      obj.getAttribute("tfRole") === "ref" ? "ref" : "definition";

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
