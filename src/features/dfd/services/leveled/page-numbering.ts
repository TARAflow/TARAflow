// ==================== PAGE NUMBERING PRECONDITION ====================
// Leveled DFD §8, 5l: "Renumber this page" numbers the parts of a child page
// in the namespace of the multiprocess it decomposes (P-2.1 under MP-2).
// While that multiprocess has no number, the page falls back to the root
// namespace and its parts get flat numbers (P-5) — the action is offered
// only once the multiprocess is numbered.

import type { DFDElement, DFDPage } from "../../models/dfd-types";

/** A display id with a number after its prefix ("MP-2", "MP-1.3"). */
const NUMBERED = /^[A-Z]+-\d+(\.\d+)*$/;

/**
 * The multiprocess that keeps `pageId` from being renumbered on its own:
 * the one the page decomposes, when it has no number yet. Null when the
 * page can be renumbered (root page, numbered multiprocess, unknown page).
 */
export function unnumberedDecomposedMp(
  pages: readonly DFDPage[] | undefined,
  elements: readonly DFDElement[] | undefined,
  pageId: string | null,
): DFDElement | null {
  const mpId = pages?.find((p) => p.pageId === pageId)?.decomposes;
  if (!mpId) return null;
  const mp = elements?.find((e) => e.id === mpId);
  if (!mp) return null;
  return NUMBERED.test(mp.displayId ?? "") ? null : mp;
}
