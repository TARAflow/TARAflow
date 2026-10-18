// ==================== USE PAGE THUMBNAILS ====================
// Leveled-DFD Phase 5i (leveled-dfd-multi-diagram-design.md §12.1, D18):
// after every save, export the thumbnail of each page whose content
// changed (and of pages that have none yet) and store them in
// dfd.pages[].thumbnail; dfd.thumbnail mirrors the root page (Top).
//
// The export renders pages without switching the page the user sees
// (drawio:exportPageSvgs). Like the single thumbnail it waits until the
// DFD iframe can render faithfully — an export from a hidden iframe would
// store a broken image; the next save while the DFD is visible catches up.
// Classic projects (one page) are untouched: they keep dfd.thumbnail.

import { useEffect, useRef } from "react";
import type { DFDProjectData } from "../models/dfd-types";
import { pageFingerprints, pagesToExport } from "../services/leveled";
import type { PageSvgExport } from "../services/drawio-bridge";

export interface UsePageThumbnailsOptions {
  /** The TARAflow plugin runs in draw.io (Electron). */
  enabled: boolean;
  exportPageSvgs: (pageIds: string[]) => Promise<PageSvgExport>;
  storeThumbnails: (svgs: Record<string, string>) => void;
  /** Resolves true once the DFD iframe can render (waitForRenderable). */
  isRenderable: () => Promise<boolean>;
}

export function usePageThumbnails(
  project: DFDProjectData,
  options: UsePageThumbnailsOptions,
): void {
  const { enabled, exportPageSvgs, storeThumbnails, isRenderable } = options;
  const xml = project.dfd?.xml;
  const pages = project.dfd?.pages;

  // pageId → fingerprint of the content last exported. A stored thumbnail
  // counts as current when the DFD is opened.
  const exportedRef = useRef<Map<string, string> | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    if (!enabled || !xml || !pages || pages.length < 2 || busyRef.current) return;
    const current = pageFingerprints(xml);
    if (!exportedRef.current) {
      exportedRef.current = new Map(
        pages.filter((p) => p.thumbnail && current.has(p.pageId)).map((p) => [p.pageId, current.get(p.pageId)!]),
      );
    }
    const ids = pagesToExport(xml, pages, exportedRef.current);
    if (ids.length === 0) return;

    busyRef.current = true;
    void (async () => {
      try {
        if (!(await isRenderable())) {
          console.debug("[usePageThumbnails] skipped — DFD iframe not visible");
          return;
        }
        const result = await exportPageSvgs(ids);
        if (!result.success) {
          console.warn("[usePageThumbnails] export failed:", result.error);
          return;
        }
        if (result.errors?.length) console.warn("[usePageThumbnails]", result.errors);
        const svgs = result.svgs ?? {};
        for (const id of Object.keys(svgs)) {
          if (current.has(id)) exportedRef.current!.set(id, current.get(id)!);
        }
        if (Object.keys(svgs).length > 0) storeThumbnails(svgs);
      } finally {
        busyRef.current = false;
      }
    })();
  }, [enabled, xml, pages, exportPageSvgs, storeThumbnails, isRenderable]);
}
