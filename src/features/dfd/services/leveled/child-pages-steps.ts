// ==================== CHILD PAGES — STEPS ====================
// Leveled-DFD Phase 5d–5h: the pure steps of the child-page orchestrator
// (review finding 3). No React, no draw.io: they plan, the orchestrator
// carries out.

import type { DFDCellLink, DFDPage } from "../../models/dfd-types";
import type { ParseResult } from "../dfd-parser";
import { readDrawioPages } from "../parsers/page-reader";
import type { DrawioPageSyncResult, DrawioPageSyncSpec } from "../drawio-bridge";
import { analysePageGeometry } from "./page-geometry";
import { pagesWithOwnParts } from "./effective-model";
import { planContextCopies, planContextRemovals, type ContextCopySpec } from "./context-copies";

export interface ContextRemoval {
  pageId: string;
  cellIds: string[];
}

/**
 * Pure context pages (no part of their own, D15) follow their parent page
 * both ways: context still missing is copied, context copies that left the
 * context are removed. Cells already requested in this session are left
 * out (copies on their way, removals sent).
 */
export function autoContextOf(
  parse: ParseResult,
  pages: readonly DFDPage[] | undefined,
  requested: ReadonlySet<string>,
): { copies: ContextCopySpec[]; removals: ContextRemoval[] } {
  const none = { copies: [], removals: [] };
  if (!pages) return none;
  const typeOf = new Map(parse.elements.map((e) => [e.id, e.type]));
  const withParts = pagesWithOwnParts(parse.occurrences, typeOf);
  const xmlPages = new Set(parse.pages.map((p) => p.pageId));
  const candidates = pages.filter(
    (p) =>
      p.decomposes &&
      xmlPages.has(p.pageId) &&
      typeOf.has(p.decomposes) &&
      !withParts.has(p.pageId),
  );
  if (candidates.length === 0) return none;
  const geometry = analysePageGeometry(parse.pageCells);
  const copies: ContextCopySpec[] = [];
  const removals: ContextRemoval[] = [];
  for (const p of candidates) {
    const input = {
      parse,
      pageGeometry: geometry,
      multiprocess: p.decomposes!,
      childPageId: p.pageId,
      childLinks: p.links,
    };
    const spec = planContextCopies(input);
    const cells = (spec?.cells ?? []).filter((c) => !requested.has(`${p.pageId}\u0000${c}`));
    if (spec && cells.length > 0) {
      copies.push({
        ...spec,
        cells,
        tfIdOf: Object.fromEntries(cells.map((c) => [c, spec.tfIdOf[c]])),
      });
    }
    const gone = planContextRemovals(input).filter(
      (c) => !requested.has(`${p.pageId}\u0000-${c}`),
    );
    if (gone.length > 0) removals.push({ pageId: p.pageId, cellIds: gone });
  }
  return { copies, removals };
}

/** Remember the clones draw.io made: they become "ref" copies once saved. */
export function rememberCopies(
  pending: Map<string, DFDCellLink[]>,
  specs: readonly ContextCopySpec[],
  copies: { pageId: string; from: string; to: string }[] | undefined,
  manual = false,
): void {
  for (const copy of copies ?? []) {
    const tfId = specs.find((s) => s.toPageId === copy.pageId)?.tfIdOf[copy.from];
    if (!tfId) continue;
    const links = pending.get(copy.pageId) ?? [];
    links.push({ cellId: copy.to, tfId, role: "ref", ...(manual ? { manual: true } : {}) });
    pending.set(copy.pageId, links);
  }
}

/**
 * dfd.pages with the links of the clones that the saved XML now contains;
 * undefined if none has arrived. "Contains" = the cell exists on its page,
 * whether or not the parser sees it as an occurrence: a copied flow with a
 * free end is linked at once, so it is never copied again (pruneStaleLinks
 * keeps a link whose cell exists). Pending links of a page that is gone are
 * dropped.
 */
export function applyArrivedLinks(
  xml: string,
  pages: readonly DFDPage[],
  pending: Map<string, DFDCellLink[]>,
): DFDPage[] | undefined {
  const cells = new Set<string>();
  for (const page of readDrawioPages(xml)) {
    for (const node of Array.from(page.doc.getElementsByTagName("*"))) {
      const id = node.getAttribute("id");
      if (id) cells.add(`${page.pageId}\u0000${id}`);
    }
  }
  let changed = false;
  const next = pages.map((p) => {
    const links = pending.get(p.pageId);
    if (!links) return p;
    const arrived = links.filter((l) => cells.has(`${p.pageId}\u0000${l.cellId}`));
    if (arrived.length === 0) return p;
    const rest = links.filter((l) => !arrived.includes(l));
    if (rest.length > 0) pending.set(p.pageId, rest);
    else pending.delete(p.pageId);
    const own = new Set((p.links ?? []).map((l) => l.cellId));
    changed = true;
    return { ...p, links: [...(p.links ?? []), ...arrived.filter((l) => !own.has(l.cellId))] };
  });
  for (const pageId of [...pending.keys()]) {
    if (!pages.some((p) => p.pageId === pageId)) pending.delete(pageId);
  }
  return changed ? next : undefined;
}

/**
 * Child pages deleted in draw.io: in dfd.pages, gone from the XML, and not
 * a page just created that the saved XML does not show yet.
 */
export function deletedChildPages(
  pages: readonly DFDPage[] | undefined,
  xmlPageIds: ReadonlySet<string>,
  justCreated: ReadonlySet<string>,
): DFDPage[] {
  return (pages ?? []).filter(
    (p) => p.decomposes && !xmlPageIds.has(p.pageId) && !justCreated.has(p.pageId),
  );
}

/**
 * draw.io's answer, never undefined: a missing result (no bridge, a test
 * double) or a thrown error (IPC) is a failed sync — reported, not an
 * unhandled rejection in a fire-and-forget effect.
 */
export async function callSync(
  syncPages: (spec: DrawioPageSyncSpec) => Promise<DrawioPageSyncResult>,
  spec: DrawioPageSyncSpec,
): Promise<DrawioPageSyncResult> {
  try {
    return (await syncPages(spec)) ?? { success: false, error: "no result" };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** 20 characters like draw.io's own page ids. */
export function randomPageId(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_";
  let id = "";
  for (let i = 0; i < 20; i++) id += alphabet[Math.floor(Math.random() * alphabet.length)];
  return id;
}
