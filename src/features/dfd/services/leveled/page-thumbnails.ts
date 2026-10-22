// ==================== PAGE THUMBNAILS ====================
// Leveled-DFD Phase 5i (leveled-dfd-multi-diagram-design.md §12.1, D18):
// one SVG thumbnail per page in dfd.pages[].thumbnail; dfd.thumbnail holds
// the root page (Top). Only pages whose content changed are exported again,
// so the TCS diff shows the thumbnails of the pages actually edited.
// Pure: what to export, and the content fingerprint per page.

import { inspectDrawioPages } from "shared";
import type { DFDPage } from "../../models/dfd-types";

const DIAGRAM_RE = /<diagram\b([^>]*)>([\s\S]*?)<\/diagram>/g;
const ID_RE = /\bid="([^"]*)"/;

/** FNV-1a over the page's XML — a fingerprint, not a security hash. */
function fingerprint(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${text.length}:${hash.toString(16)}`;
}

/** pageId → fingerprint of the page's content (its <diagram> element). */
export function pageFingerprints(xml: string | null | undefined): Map<string, string> {
  const result = new Map<string, string>();
  for (const match of (xml ?? "").matchAll(DIAGRAM_RE)) {
    const id = ID_RE.exec(match[1] ?? "")?.[1];
    if (id !== undefined) result.set(id, fingerprint(match[0]));
  }
  return result;
}

/**
 * Pages whose thumbnail must be (re)exported: pages of a leveled DFD without
 * a thumbnail, and pages whose content differs from the last export. Empty
 * for a classic project (one page — dfd.thumbnail as before).
 *
 * @param exported pageId → fingerprint of the content last exported; a page
 *                 with a stored thumbnail but no entry counts as current
 *                 (the thumbnail was stored with its content)
 */
export function pagesToExport(
  xml: string | null | undefined,
  pages: readonly DFDPage[] | undefined,
  exported: ReadonlyMap<string, string>,
): string[] {
  if (!xml || !pages || pages.length < 2) return [];
  if (!inspectDrawioPages(xml, pages.map((p) => p.pageId)).supported) return [];
  const current = pageFingerprints(xml);
  return pages
    .filter((p) => current.has(p.pageId))
    .filter((p) => {
      if (!p.thumbnail) return true;
      const last = exported.get(p.pageId);
      return last !== undefined && last !== current.get(p.pageId);
    })
    .map((p) => p.pageId);
}

/**
 * dfd.pages and dfd.thumbnail with the new thumbnails: each page gets its
 * own, dfd.thumbnail mirrors the root page (the page without `decomposes`)
 * so every reader that knows only dfd.thumbnail shows Top.
 */
export function withPageThumbnails(
  pages: readonly DFDPage[] | undefined,
  thumbnail: string | undefined,
  svgs: Readonly<Record<string, string>>,
): { pages: DFDPage[] | undefined; thumbnail: string | undefined } {
  if (!pages) return { pages: undefined, thumbnail };
  const next = pages.map((p) => (svgs[p.pageId] ? { ...p, thumbnail: svgs[p.pageId] } : p));
  const root = next.find((p) => p.decomposes === undefined);
  return { pages: next, thumbnail: root?.thumbnail ?? thumbnail };
}
