// ==================== IDENTITY INFO ====================
// Leveled-DFD Phase 5g (leveled-dfd-multi-diagram-design.md §5.2, §12):
// what the details panel shows about the identity of the selected CELL
// and which identity actions it offers.
//
//   context copy        "Go to definition", "Make this the definition"
//   dangling copy       "Promote to definition" (BAL_DANGLING_REF repair)
//   plain definition    "Make this a context copy of …" (same type)
//   every cell          its occurrences on all pages
//
// Pure: derived from the parse of the saved DFD and dfd.pages; the actions
// themselves are the identity-link writers of 1.4 / 1.5.

import type { DFDPage } from "../../models/dfd-types";
import type { ParseResult } from "../dfd-parser";
import type { CellRef } from "./identity-links";
import { recordInfos, recordKey } from "./signatures";

export interface OccurrenceInfo extends CellRef {
  pageName: string;
  role: "definition" | "ref";
}

export interface IdentityInfo {
  tfId: string;
  kind: "element" | "connection";
  /** Role of the selected cell. */
  role: "definition" | "ref";
  /** The logical element has context copies but no definition (§5.2.1). */
  dangling: boolean;
  /** Definition of the logical element (absent while dangling). */
  definition?: OccurrenceInfo;
  /** All occurrences, definition first, then document order. */
  occurrences: OccurrenceInfo[];
  /** A copy whose element has a definition elsewhere. */
  canMakeDefinition: boolean;
  /** A copy of a dangling element. */
  canPromote: boolean;
  /**
   * A plain definition (no link) can become a context copy of another
   * element / flow of the same type that has a definition. Label: displayId
   * and name. Empty for a copy or a moved definition.
   */
  contextCopyCandidates: { tfId: string; label: string }[];
}

export function describeIdentity(
  parse: Pick<ParseResult, "pages" | "elements" | "connections" | "occurrences">,
  pages: readonly DFDPage[] | undefined,
  cell: CellRef,
): IdentityInfo | undefined {
  const selected = parse.occurrences.find(
    (o) => o.pageId === cell.pageId && o.cellId === cell.cellId,
  );
  if (!selected) return undefined;

  const pageNames = new Map(parse.pages.map((p) => [p.pageId, p.name || p.pageId]));
  const toInfo = (o: (typeof parse.occurrences)[number]): OccurrenceInfo => ({
    pageId: o.pageId,
    cellId: o.cellId,
    pageName: pageNames.get(o.pageId) ?? o.pageId,
    role: o.role,
  });
  const all = parse.occurrences.filter(
    (o) => o.kind === selected.kind && o.tfId === selected.tfId,
  );
  const definition = all.find((o) => o.role === "definition");
  const occurrences = [
    ...(definition ? [definition] : []),
    ...all.filter((o) => o !== definition),
  ].map(toInfo);

  // Context-copy targets: same kind and type, another identity that has a
  // definition. Only for a plain cell in an adopted page (links need it).
  const plain = selected.role === "definition" && selected.tfId === selected.cellId;
  const inTree = !!pages?.some((p) => p.pageId === cell.pageId);
  const infos = recordInfos(parse);
  const ownType = infos.get(recordKey(selected.kind, selected.tfId))?.type;
  const defined = new Set(
    parse.occurrences
      .filter((o) => o.kind === selected.kind && o.role === "definition")
      .map((o) => o.tfId),
  );
  const records = selected.kind === "element" ? parse.elements : parse.connections;
  const contextCopyCandidates =
    plain && inTree
      ? records
          .filter(
            (r) =>
              r.id !== selected.tfId &&
              defined.has(r.id) &&
              infos.get(recordKey(selected.kind, r.id))?.type === ownType,
          )
          .map((r) => ({
            tfId: r.id,
            label: [r.displayId, r.name].filter(Boolean).join(" ") || r.id,
          }))
          .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
      : [];

  return {
    tfId: selected.tfId,
    kind: selected.kind,
    role: selected.role,
    dangling: !definition,
    ...(definition ? { definition: toInfo(definition) } : {}),
    occurrences,
    canMakeDefinition: selected.role === "ref" && !!definition && inTree,
    canPromote: selected.role === "ref" && !definition && inTree,
    contextCopyCandidates,
  };
}
