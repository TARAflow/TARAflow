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
  /**
   * The child page of this multiprocess was deleted: mark it so it gets no
   * page automatically again (properties.noChildPage). Called before
   * savePages, which then saves both.
   */
  markNoChildPage: (tfId: string) => void;
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
  const { enabled, syncPages, savePages, markNoChildPage } = options;
  const newPageIdRef = useRef(options.newPageId ?? randomPageId);
  const xml = project.dfd?.xml;
  const pages = project.dfd?.pages;

  // Multiprocesses of the DFD as opened: in a classic project they never get
  // a page automatically (opening must not level it). Leveled: D15 for all.
  const knownRef = useRef<Set<string> | null>(null);
  // Last reason for doing nothing, logged once per change (diagnosis).
  const lastSkipRef = useRef<string | null>(null);
  const skip = (reason: string) => {
    if (lastSkipRef.current === reason) return;
    lastSkipRef.current = reason;
    console.info(`[useChildPages] nothing to do: ${reason}`);
  };
  // Multiprocesses already handled in this session (page requested).
  const attemptedRef = useRef(new Set<string>());
  // Renames requested: pageId → name.
  const renamedRef = useRef(new Map<string, string>());
  // Pages created in this session that the saved XML does not show yet
  // (draw.io's autosave is on its way). Removed once they arrive: a page
  // that disappears after that was deleted.
  const createdPagesRef = useRef(new Set<string>());
  const busyRef = useRef(false);
  const [settling, setSettling] = useState(false);

  useEffect(() => {
    const xmlPageIds = new Set(xml ? inspectDrawioPages(xml).pageIds : []);
    for (const id of [...createdPagesRef.current]) {
      if (xmlPageIds.has(id)) createdPagesRef.current.delete(id);
    }
    setSettling(createdPagesRef.current.size > 0);

    if (!xml) return skip("no saved diagram yet");
    if (busyRef.current) return;
    const layout = inspectDrawioPages(xml, pages?.map((p) => p.pageId));
    if (!layout.supported) return skip("pages wait for adoption (5b)");

    // A child page deleted in draw.io leaves dfd.pages (the XML says which
    // pages exist). Its multiprocess, if it still exists, keeps no page:
    // deleting the page was the analyst's decision ("stays away").
    const deleted = (pages ?? []).filter(
      (p) => p.decomposes && !xmlPageIds.has(p.pageId) && !createdPagesRef.current.has(p.pageId),
    );
    if (deleted.length > 0) {
      const multiprocesses = new Set(
        (project.dfd?.elements ?? []).filter((e) => e.type === "Multiprocess").map((e) => e.id),
      );
      lastSkipRef.current = null;
      console.info(
        "[useChildPages] child page(s) deleted in draw.io, removed from the page tree:",
        deleted.map((p) => p.name),
      );
      busyRef.current = true;
      void (async () => {
        try {
          for (const p of deleted) {
            if (multiprocesses.has(p.decomposes!)) {
              attemptedRef.current.add(p.decomposes!);
              markNoChildPage(p.decomposes!);
            }
          }
          const gone = new Set(deleted.map((p) => p.pageId));
          await savePages((pages ?? []).filter((p) => !gone.has(p.pageId)));
        } finally {
          busyRef.current = false;
        }
      })();
      return;
    }

    if (!enabled) return skip("draw.io plugin not ready (Electron only)");

    if (needsPageReview(xml, pages)) {
      return skip("page tree needs a review (extra root or missing page) or a new page is on its way");
    }

    const parse = dfdParser.parse(xml, pages);
    if (!knownRef.current) {
      knownRef.current = new Set(
        parse.elements.filter((e) => e.type === "Multiprocess").map((e) => e.id),
      );
    }
    const leveled = !!pages && pages.length > 0;
    // Multiprocesses whose child page the analyst deleted (noChildPage).
    const optedOut = (project.dfd?.elements ?? [])
      .filter(
        (e) =>
          e.type === "Multiprocess" &&
          (e.properties as { noChildPage?: boolean } | undefined)?.noChildPage,
      )
      .map((e) => e.id);
    const plan = planPageSync({
      parse,
      pages,
      knownMultiprocesses: new Set([
        ...(leveled ? [] : knownRef.current),
        ...attemptedRef.current,
        ...optedOut,
      ]),
      newPageId: newPageIdRef.current,
    });
    if (!plan) return skip("pages up to date");

    const rename = plan.rename.filter((r) => renamedRef.current.get(r.pageId) !== r.name);
    const pagesChanged = JSON.stringify(plan.pages) !== JSON.stringify(pages ?? []);
    if (plan.create.length === 0 && rename.length === 0 && !pagesChanged) {
      return skip("pages up to date (requests already sent)");
    }
    lastSkipRef.current = null;
    console.info("[useChildPages] syncing pages:", {
      create: plan.create.map((c) => `${c.name} (${c.decomposes})`),
      rename: rename.map((r) => `${r.pageId} → ${r.name}`),
    });

    busyRef.current = true;
    void (async () => {
      try {
        // 1. Create the child pages.
        let created = plan.create;
        if (plan.create.length > 0) {
          for (const c of plan.create) attemptedRef.current.add(c.decomposes);
          const result = await syncPages({ create: plan.create, rename: [] });
          if (!result.success) {
            console.warn("[useChildPages] draw.io could not create pages:", result.error, result);
            created = [];
          } else {
            // Only what draw.io reports as created (an insert can fail).
            if (result.created) {
              created = plan.create.filter((c) => result.created!.includes(c.pageId));
            }
            if (result.errors?.length) {
              console.warn("[useChildPages] draw.io page sync:", result.errors);
            }
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
            console.warn("[useChildPages] draw.io could not rename pages:", result.error, result);
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
  }, [enabled, xml, pages, project.dfd?.elements, syncPages, savePages, markNoChildPage]);

  return { settling };
}

/** 20 characters like draw.io's own page ids. */
function randomPageId(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_";
  let id = "";
  for (let i = 0; i < 20; i++) id += alphabet[Math.floor(Math.random() * alphabet.length)];
  return id;
}
