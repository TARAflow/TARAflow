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
//
// 5f: every new child page gets its context copies (flow neighbours, flows
// at the MP's border, boundaries around them); "Sync context" adds what is
// missing on an existing one. The clones become context copies ("ref"
// links) only once draw.io's autosave has brought them into the saved XML —
// a link to a cell the saved XML does not have yet would be pruned as stale
// by the very save that writes it.

import { useCallback, useEffect, useRef, useState } from "react";
import { inspectDrawioPages } from "shared";
import type {
  DFDCellLink,
  DFDPage,
  DFDProjectData,
  DFDUpdateResult,
} from "../models/dfd-types";
import { dfdParser } from "../services/dfd-parser";
import { readDrawioPages } from "../services/parsers/page-reader";
import {
  analysePageGeometry,
  pagesWithOwnParts,
  needsPageReview,
  planContextCopies,
  planContextRemovals,
  planInsertAsContext,
  planPageSync,
  readCellLinks,
  type ContextCopySpec,
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
  /**
   * "Sync context" (5f): copy what is missing on the child page of this
   * multiprocess. Resolves to the number of cells copied, or an error text.
   */
  syncContext: (tfId: string) => Promise<number | string>;
  /**
   * "Insert as context…" (5h): a copy of an element / flow on the page.
   * Resolves to null, or an error text. The copy is marked `manual`.
   */
  insertAsContext: (
    kind: "element" | "connection",
    tfId: string,
    pageId: string,
  ) => Promise<string | null>;
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
  // 5f: context copies waiting for draw.io's autosave — pageId → links to
  // write once the clones are in the saved XML.
  const pendingLinksRef = useRef(new Map<string, DFDCellLink[]>());
  // Context cells requested per child page ("pageId\u0000cellId"): never
  // twice in a session, also while the copy is on its way.
  const requestedRef = useRef(new Set<string>());

  const markRequested = (specs: readonly ContextCopySpec[]) => {
    for (const spec of specs) {
      for (const cell of spec.cells) requestedRef.current.add(`${spec.toPageId}\u0000${cell}`);
    }
  };
  const copyContext = async (specs: ContextCopySpec[], removals: ContextRemoval[] = []) => {
    markRequested(specs);
    for (const r of removals) {
      for (const cell of r.cellIds) requestedRef.current.add(`${r.pageId}\u0000-${cell}`);
    }
    const result = await callSync(syncPages, {
      create: [],
      rename: [],
      context: specs,
      ...(removals.length > 0 ? { removeCells: removals } : {}),
    });
    if (!result.success) {
      console.warn("[useChildPages] draw.io could not copy the context:", result.error, result);
      return;
    }
    if (result.errors?.length) console.warn("[useChildPages] context:", result.errors);
    rememberCopies(pendingLinksRef.current, specs, result.copies);
    if (result.copies?.length) setSettling(true);
  };

  useEffect(() => {
    const xmlPageIds = new Set(xml ? inspectDrawioPages(xml).pageIds : []);
    for (const id of [...createdPagesRef.current]) {
      if (xmlPageIds.has(id)) createdPagesRef.current.delete(id);
    }
    setSettling(createdPagesRef.current.size > 0 || pendingLinksRef.current.size > 0);

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

    // 5f: context copies have arrived in the saved XML — link them now.
    if (pendingLinksRef.current.size > 0 && pages) {
      const arrived = applyArrivedLinks(xml, pages, pendingLinksRef.current);
      if (arrived) {
        lastSkipRef.current = null;
        busyRef.current = true;
        void (async () => {
          try {
            await savePages(arrived);
          } finally {
            busyRef.current = false;
          }
        })();
        return;
      }
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
    // Context copies not linked yet are plain cells: never give them a page.
    for (const links of pendingLinksRef.current.values()) {
      for (const l of links) known.add(l.cellId);
    }
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

    // 5f: a child page without a part of its own is a pure context page
    // (D15): its context follows the parent page automatically — e.g. a flow
    // drawn to the MP after its page was created. Once the analyst draws
    // parts there, "Sync context" is manual, so nothing removed on purpose
    // comes back.
    const { copies: autoContext, removals: autoRemovals } = autoContextOf(
      parse,
      pages,
      requestedRef.current,
    );
    const autoChanges = autoContext.length + autoRemovals.length;
    if (!plan) {
      if (autoChanges === 0) return skip("pages up to date");
      lastSkipRef.current = null;
      console.info("[useChildPages] context follows the parent page:", {
        add: autoContext.map((c) => `${c.toPageId}: ${c.cells.join(", ")}`),
        remove: autoRemovals.map((r) => `${r.pageId}: ${r.cellIds.join(", ")}`),
      });
      busyRef.current = true;
      void (async () => {
        try {
          await copyContext(autoContext, autoRemovals);
        } finally {
          busyRef.current = false;
        }
      })();
      return;
    }

    const rename = plan.rename.filter((r) => renamedRef.current.get(r.pageId) !== r.name);
    const linkKey = (l: { pageId: string; cellId: string; target: string }) =>
      `${l.pageId}\u0000${l.cellId}\u0000${l.target}`;
    const link = plan.link.filter((l) => !linkedRef.current.has(linkKey(l)));
    const pagesChanged = JSON.stringify(plan.pages) !== JSON.stringify(pages ?? []);
    if (
      plan.create.length === 0 &&
      rename.length === 0 &&
      link.length === 0 &&
      !pagesChanged &&
      autoChanges === 0
    ) {
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
          // 5f: every new child page gets its context copies.
          const geometry = analysePageGeometry(parse.pageCells);
          const context = plan.create
            .map((c) =>
              planContextCopies({
                parse,
                pageGeometry: geometry,
                multiprocess: c.decomposes,
                childPageId: c.pageId,
              }),
            )
            .filter((c): c is ContextCopySpec => !!c);
          markRequested(context);
          const result = await callSync(syncPages, { create: plan.create, rename: [], context });
          rememberCopies(pendingLinksRef.current, context, result.copies);
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
          const result = await callSync(syncPages, { create: [], rename, link });
          if (!result.success) {
            console.warn("[useChildPages] draw.io could not rename / link:", result.error, result);
          } else if (result.errors?.length) {
            console.warn("[useChildPages] draw.io page sync:", result.errors);
          }
        }

        // 2b. Context of pure context pages (5f).
        if (autoChanges > 0) await copyContext(autoContext, autoRemovals);

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
        const result = await callSync(syncPages, { create: [], rename: [], remove: [pageId] });
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

  const syncContext = useCallback(
    async (tfId: string): Promise<number | string> => {
      const page = pages?.find((p) => p.decomposes === tfId);
      if (!enabled || !xml || !page) return "not available";
      if (!(await waitIdle(busyRef))) return "busy";
      busyRef.current = true;
      try {
        const parse = dfdParser.parse(xml, pages);
        const spec = planContextCopies({
          parse,
          pageGeometry: analysePageGeometry(parse.pageCells),
          multiprocess: tfId,
          childPageId: page.pageId,
          childLinks: page.links,
        });
        if (!spec) return 0;
        markRequested([spec]);
        const result = await callSync(syncPages, { create: [], rename: [], context: [spec] });
        if (!result.success) return result.error ?? "failed";
        if (result.errors?.length) console.warn("[useChildPages] sync context:", result.errors);
        rememberCopies(pendingLinksRef.current, [spec], result.copies);
        setSettling(true);
        return result.copies?.length ?? 0;
      } finally {
        busyRef.current = false;
      }
    },
    [enabled, xml, pages, syncPages],
  );

  const insertAsContext = useCallback(
    async (kind: "element" | "connection", tfId: string, pageId: string): Promise<string | null> => {
      if (!enabled || !xml) return "not available";
      if (!(await waitIdle(busyRef))) return "busy";
      busyRef.current = true;
      try {
        const parse = dfdParser.parse(xml, pages);
        const spec = planInsertAsContext(parse, pages, kind, tfId, pageId);
        if (!spec) return "not possible";
        const result = await callSync(syncPages, { create: [], rename: [], context: [spec] });
        if (!result.success) return result.error ?? "failed";
        if (!result.copies?.length) return result.errors?.join("; ") || "nothing copied";
        rememberCopies(pendingLinksRef.current, [spec], result.copies, true);
        setSettling(true);
        return null;
      } finally {
        busyRef.current = false;
      }
    },
    [enabled, xml, pages, syncPages],
  );

  return { settling, orphanPages, resolveOrphan, decompose, syncContext, insertAsContext };
}

interface ContextRemoval {
  pageId: string;
  cellIds: string[];
}

/**
 * Pure context pages (no part of their own, D15) follow their parent page
 * both ways: context still missing is copied, context copies that left the
 * context are removed. Cells already requested in this session are left
 * out (copies on their way, removals sent).
 */
function autoContextOf(
  parse: ReturnType<typeof dfdParser.parse>,
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
function rememberCopies(
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
function applyArrivedLinks(
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
 * An action of the analyst waits for a sync that is running (e.g. a page
 * link after the last save) instead of failing with "busy" — up to a few
 * seconds.
 */
async function waitIdle(busy: { current: boolean }, timeoutMs = 5_000): Promise<boolean> {
  const start = Date.now();
  while (busy.current) {
    if (Date.now() - start > timeoutMs) return false;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return true;
}

/**
 * draw.io's answer, never undefined: a missing result (no bridge, a test
 * double) or a thrown error (IPC) is a failed sync — reported, not an
 * unhandled rejection in a fire-and-forget effect.
 */
async function callSync(
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
function randomPageId(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_";
  let id = "";
  for (let i = 0; i < 20; i++) id += alphabet[Math.floor(Math.random() * alphabet.length)];
  return id;
}
