// ==================== LOCKED PAGES ====================
// Multi-project TARA (doc/Done/multi-project-tara-design.md v3, §6.2, §6.6):
// the pages of an imported component — the child page of an imported
// multiprocess and every page below it — belong to the component. The
// machine's renumber leaves them alone (and the editor will lock their
// cells). Pure; the DFD knows multiprocess ids, not components.

import type { DFDPage } from "../../models/dfd-types";

/**
 * Page ids of the pages that decompose one of the given multiprocesses.
 * Pass the instance's multiprocess AND the component's own decomposed
 * multiprocesses (their machine tfIds) — a page's parent page is not in
 * dfd.pages, so the subtree is given by its multiprocesses.
 */
export function lockedPageIdsOf(
  pages: readonly DFDPage[] | undefined,
  multiprocessTfIds: readonly string[] | undefined,
): Set<string> {
  const mps = new Set(multiprocessTfIds ?? []);
  return new Set((pages ?? []).filter((p) => p.decomposes && mps.has(p.decomposes)).map((p) => p.pageId));
}
