// ==================== USE CHILD PAGES ====================
// Leveled-DFD Phase 5d (leveled-dfd-multi-diagram-design.md §5.3, §12,
// D15–D17): after every save, give new multiprocesses their child page,
// let tab names follow their multiprocess and name the root page Top.
//
// Order matters: draw.io creates the page first, then dfd.pages is saved
// — before draw.io's autosave brings the new page, so the new page is
// adopted when it arrives and the save is never refused for it.
//
// Loop and retry guards: one sync at a time; a rename is requested once per
// (page, name); a multiprocess gets one attempt per session, also when
// draw.io refuses (old draw.io without the page API) — then it simply stays
// without page, as before 5d.

import { useEffect, useRef, useState } from "react";
import { inspectDrawioPages } from "shared";
import type { DFDPage, DFDProjectData, DFDUpdateResult } from "../models/dfd-types";
import { dfdParser } from "../services/dfd-parser";
import { needsPageReview, planPageSync } from "../services/leveled";
import type {
  DrawioPageSyncResult,
  DrawioPageSyncSpec,
} from "../services/drawio-bridge";

export interface UseChildPagesOptions {
  /** The TARAflow plugin runs in draw.io (Electron). */
  enabled: boolean;
  syncPages: (spec: DrawioPageSyncSpec) => Promise<DrawioPageSyncResult>;
  savePages: (pages: DFDPage[]) => Promise<DFDUpdateResult | null>;
  /** Page id generator (tests); default: random, draw.io style. */
  newPageId?: () => string;
}

export interface UseChildPagesReturn {
  /**
   * A created page is in dfd.pages but not yet in the saved XML (draw.io's
   * autosave is on its way). Page-tree findings about it are transient.
   */
  settling: boolean;
}

export function useChildPages(
  project: DFDProjectData,
  options: UseChildPagesOptions,
): UseChildPagesReturn {
  const { enabled, syncPages, savePages } = options;
  const newPageIdRef = useRef(options.newPageId ?? randomPageId);
  const xml = project.dfd?.xml;
  const pages = project.dfd?.pages;

  // Multiprocesses of the DFD as opened: they never get a page automatically.
  const knownRef = useRef<Set<string> | null>(null);
  // Multiprocesses already handled in this session (page requested).
  const attemptedRef = useRef(new Set<string>());
  // Renames requested: pageId → name.
  const renamedRef = useRef(new Map<string, string>());
  // Pages created in this session.
  const createdPagesRef = useRef(new Set<string>());
  const busyRef = useRef(false);
  const [settling, setSettling] = useState(false);

  useEffect(() => {
    const xmlPageIds = new Set(xml ? inspectDrawioPages(xml).pageIds : []);
    setSettling([...createdPagesRef.current].some((id) => !xmlPageIds.has(id)));

    if (!enabled || !xml || busyRef.current) return;
    const layout = inspectDrawioPages(xml, pages?.map((p) => p.pageId));
    if (!layout.supported) return; // adoption first (5b)
    if (needsPageReview(xml, pages)) return; // repair first, or a page is on its way

    const parse = dfdParser.parse(xml, pages);
    if (!knownRef.current) {
      knownRef.current = new Set(
        parse.elements.filter((e) => e.type === "Multiprocess").map((e) => e.id),
      );
    }
    const plan = planPageSync({
      parse,
      pages,
      knownMultiprocesses: new Set([...knownRef.current, ...attemptedRef.current]),
      newPageId: newPageIdRef.current,
    });
    if (!plan) return;

    const rename = plan.rename.filter((r) => renamedRef.current.get(r.pageId) !== r.name);
    const pagesChanged = JSON.stringify(plan.pages) !== JSON.stringify(pages ?? []);
    if (plan.create.length === 0 && rename.length === 0 && !pagesChanged) return;

    busyRef.current = true;
    void (async () => {
      try {
        // 1. Create the child pages.
        let created = plan.create;
        if (plan.create.length > 0) {
          for (const c of plan.create) attemptedRef.current.add(c.decomposes);
          const result = await syncPages({ create: plan.create, rename: [] });
          if (!result.success) {
            console.warn("[useChildPages] draw.io could not create pages:", result.error);
            created = [];
          } else if (result.errors?.length) {
            console.warn("[useChildPages] draw.io page links:", result.errors);
          }
        }
        // A classic project only becomes leveled once a page really exists:
        // otherwise neither the root is renamed nor dfd.pages written.
        if (!pages && created.length === 0) return;

        // 2. Names (D16, D17).
        if (rename.length > 0) {
          for (const r of rename) renamedRef.current.set(r.pageId, r.name);
          const result = await syncPages({ create: [], rename });
          if (!result.success) {
            console.warn("[useChildPages] draw.io could not rename pages:", result.error);
          }
        }

        // 3. dfd.pages — only with the pages draw.io has really created.
        const failed = new Set(
          plan.create.filter((c) => !created.includes(c)).map((c) => c.pageId),
        );
        const nextPages = plan.pages.filter((p) => !failed.has(p.pageId));
        for (const c of created) createdPagesRef.current.add(c.pageId);
        if (JSON.stringify(nextPages) !== JSON.stringify(pages ?? [])) {
          if (created.length > 0) setSettling(true);
          await savePages(nextPages);
        }
      } finally {
        busyRef.current = false;
      }
    })();
  }, [enabled, xml, pages, syncPages, savePages]);

  return { settling };
}

/** 20 characters like draw.io's own page ids. */
function randomPageId(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_";
  let id = "";
  for (let i = 0; i < 20; i++) id += alphabet[Math.floor(Math.random() * alphabet.length)];
  return id;
}
