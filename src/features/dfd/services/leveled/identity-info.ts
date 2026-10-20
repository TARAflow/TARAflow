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

/**
 * The context copies per page, for their faded display (5g): every "ref"
 * occurrence, plus every cell with a "ref" link — a copied flow whose free
 * end is not attached yet is no occurrence for the parser, but it is a
 * context copy all the same.
 */
export function contextCellsOf(
  occurrences: readonly { pageId: string; cellId: string; role: "definition" | "ref" }[],
  pages: readonly DFDPage[] | undefined,
): Record<string, Record<string, true>> {
  const byPage: Record<string, Record<string, true>> = {};
  const add = (pageId: string, cellId: string) => {
    (byPage[pageId] ??= {})[cellId] = true;
  };
  for (const o of occurrences) if (o.role === "ref") add(o.pageId, o.cellId);
  for (const page of pages ?? []) {
    for (const link of page.links ?? []) if (link.role === "ref") add(page.pageId, link.cellId);
  }
  return byPage;
}

/**
 * Making `cell` the definition (or promoting it) moves the element's home
 * page below the highest page it is shown on — the element then becomes
 * part of the multiprocess that page details (D5, BAL_HOME_NOT_HIGHEST).
 * Returns that multiprocess's tfId, or undefined when the cell's page is
 * the highest occurrence anyway. Elements only; flows have no containment.
 */
export function deeperHomeContainer(
  occurrences: readonly { kind: "element" | "connection"; tfId: string; pageId: string; cellId: string }[],
  pages: readonly DFDPage[] | undefined,
  depthOf: ReadonlyMap<string, number>,
  cell: CellRef,
): string | undefined {
  const selected = occurrences.find((o) => o.pageId === cell.pageId && o.cellId === cell.cellId);
  if (selected?.kind !== "element") return undefined;
  const depth = depthOf.get(cell.pageId);
  if (depth === undefined) return undefined;
  const higher = occurrences.some(
    (o) =>
      o.kind === "element" &&
      o.tfId === selected.tfId &&
      (depthOf.get(o.pageId) ?? Infinity) < depth,
  );
  if (!higher) return undefined;
  return pages?.find((p) => p.pageId === cell.pageId)?.decomposes;
}
