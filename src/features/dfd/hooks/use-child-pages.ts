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
//
// 5e: "Create child page" for a multiprocess without one (decompose), page
// links on copies drawn later, and a question when a multiprocess with a
// child page is deleted: delete the page too, or keep it.

import { useCallback, useEffect, useRef, useState } from "react";
import { inspectDrawioPages } from "shared";
import type { DFDPage, DFDProjectData, DFDUpdateResult } from "../models/dfd-types";
import { dfdParser } from "../services/dfd-parser";
import {
  needsPageReview,
  planPageSync,
  readCellLinks,
  type OrphanPage,
} from "../services/leveled";
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
   * Set properties.noChildPage of a multiprocess: true when its child page
   * was deleted (no page automatically again), false when the analyst
   * creates one explicitly. Called before savePages, which saves both.
   */
  setNoChildPage: (tfId: string, noChildPage: boolean) => void;
  /** Page id generator (tests); default: random, draw.io style. */
  newPageId?: () => string;
}

export interface UseChildPagesReturn {
  /**
   * A created page is in dfd.pages but not yet in the saved XML (draw.io's
   * autosave is on its way). Page-tree findings about it are transient.
   */
  settling: boolean;
  /** Child pages whose multiprocess was deleted and not decided yet (5e). */
  orphanPages: OrphanPage[];
  /**
   * Delete the orphan page in draw.io, or keep it (asked once per session).
   * Resolves to an error text if draw.io did not delete the page — the
   * question stays then.
   */
  resolveOrphan: (pageId: string, removePage: boolean) => Promise<string | null>;
  /** "Create child page" for a multiprocess without one; false if impossible. */
  decompose: (tfId: string) => boolean;
}

export function useChildPages(
  project: DFDProjectData,
  options: UseChildPagesOptions,
): UseChildPagesReturn {
  const { enabled, syncPages, savePages, setNoChildPage } = options;
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
  // 5e: explicit "Create child page" requests (override noChildPage and the
  // classic "only new" rule), page links requested (cell → target), orphan
  // pages asked about.
  const forcedRef = useRef(new Set<string>());
  const linkedRef = useRef(new Set<string>());
  const askedRef = useRef(new Set<string>());
  const [orphanPages, setOrphanPages] = useState<OrphanPage[]>([]);
  const [nonce, setNonce] = useState(0);

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
              setNoChildPage(p.decomposes!, true);
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
    const known = new Set([
      ...(leveled ? [] : knownRef.current),
      ...attemptedRef.current,
      ...optedOut,
    ]);
    for (const tfId of forcedRef.current) known.delete(tfId);
    const plan = planPageSync({
      parse,
      pages,
      knownMultiprocesses: known,
      newPageId: newPageIdRef.current,
      cellLinks: readCellLinks(xml),
    });

    // Orphan pages: the analyst decides (once per session).
    const orphans = (plan?.orphans ?? []).filter((o) => !askedRef.current.has(o.pageId));
    setOrphanPages((current) =>
      JSON.stringify(current) === JSON.stringify(orphans) ? current : orphans,
    );
    if (!plan) return skip("pages up to date");

    const rename = plan.rename.filter((r) => renamedRef.current.get(r.pageId) !== r.name);
    const linkKey = (l: { pageId: string; cellId: string; target: string }) =>
      `${l.pageId}\u0000${l.cellId}\u0000${l.target}`;
    const link = plan.link.filter((l) => !linkedRef.current.has(linkKey(l)));
    const pagesChanged = JSON.stringify(plan.pages) !== JSON.stringify(pages ?? []);
    if (plan.create.length === 0 && rename.length === 0 && link.length === 0 && !pagesChanged) {
      return skip(
        orphans.length > 0
          ? "waiting for the decision on orphan pages"
          : "pages up to date (requests already sent)",
      );
    }
    lastSkipRef.current = null;
    console.info("[useChildPages] syncing pages:", {
      create: plan.create.map((c) => `${c.name} (${c.decomposes})`),
      rename: rename.map((r) => `${r.pageId} → ${r.name}`),
      link: link.map((l) => `${l.pageId}/${l.cellId} → ${l.target}`),
    });

    busyRef.current = true;
    void (async () => {
      try {
        // 1. Create the child pages.
        let created = plan.create;
        if (plan.create.length > 0) {
          for (const c of plan.create) {
            attemptedRef.current.add(c.decomposes);
            forcedRef.current.delete(c.decomposes);
          }
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

        // 2. Names (D16, D17) and page links on later copies (5e).
        if (rename.length > 0 || link.length > 0) {
          for (const r of rename) renamedRef.current.set(r.pageId, r.name);
          for (const l of link) linkedRef.current.add(linkKey(l));
          const result = await syncPages({ create: [], rename, link });
          if (!result.success) {
            console.warn("[useChildPages] draw.io could not rename / link:", result.error, result);
          } else if (result.errors?.length) {
            console.warn("[useChildPages] draw.io page sync:", result.errors);
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
  }, [enabled, xml, pages, project.dfd?.elements, syncPages, savePages, setNoChildPage, nonce]);

  const resolveOrphan = useCallback(
    async (pageId: string, removePage: boolean): Promise<string | null> => {
      if (removePage) {
        // The deleted page then leaves dfd.pages like any page deleted in
        // draw.io (see above).
        const result = await syncPages({ create: [], rename: [], remove: [pageId] });
        if (!result.success || result.errors?.length) {
          const error = result.error ?? result.errors!.join("; ");
          console.warn("[useChildPages] draw.io could not delete the page:", error, result);
          return error;
        }
      }
      askedRef.current.add(pageId);
      setOrphanPages((current) => current.filter((o) => o.pageId !== pageId));
      return null;
    },
    [syncPages],
  );

  const elements = project.dfd?.elements;
  const decompose = useCallback(
    (tfId: string): boolean => {
      const mp = elements?.find((e) => e.id === tfId && e.type === "Multiprocess");
      if (!enabled || !mp) return false;
      if (pages?.some((p) => p.decomposes === tfId)) return false;
      forcedRef.current.add(tfId);
      attemptedRef.current.delete(tfId);
      if ((mp.properties as { noChildPage?: boolean } | undefined)?.noChildPage) {
        setNoChildPage(tfId, false);
      }
      setNonce((n) => n + 1);
      return true;
    },
    [enabled, elements, pages, setNoChildPage],
  );

  return { settling, orphanPages, resolveOrphan, decompose };
}

/** 20 characters like draw.io's own page ids. */
function randomPageId(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_";
  let id = "";
  for (let i = 0; i < 20; i++) id += alphabet[Math.floor(Math.random() * alphabet.length)];
  return id;
}
