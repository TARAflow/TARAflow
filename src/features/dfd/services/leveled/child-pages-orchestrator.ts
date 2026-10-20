// ==================== CHILD PAGES — ORCHESTRATOR ====================
// Leveled-DFD Phase 5d–5h (leveled-dfd-multi-diagram-design.md §5.3, §12,
// D15–D17), outside React (review finding 3). After every save it brings
// draw.io's pages and dfd.pages in line:
//
//   deleted pages   a child page deleted in draw.io leaves dfd.pages; its
//                   multiprocess keeps no page (noChildPage)
//   arrived links   context copies that draw.io's autosave brought into the
//                   saved XML become "ref" links
//   page sync       new multiprocesses get their child page (with context),
//                   tab names follow the multiprocess, the root is Top, page
//                   links on copies drawn later
//   auto context    pure context pages follow their parent page
//   orphan pages    the page of a deleted multiprocess: the analyst decides
//
// Order matters: draw.io creates the page first, then dfd.pages is saved —
// before the autosave brings the new page, so the new page is adopted when
// it arrives and the save is never refused for it.
//
// Every step and every analyst action runs through one serial queue. A
// saved state that arrives while a step runs is not dropped: once the queue
// is free the newest state is reconciled (exactly once, intermediate states
// are contained in it). Guards against loops: a rename once per (page,
// name), a page once per multiprocess and session, also when draw.io
// refuses; context cells once per page and session.

import { inspectDrawioPages } from "shared";
import type { DFDCellLink, DFDElement, DFDPage, DFDUpdateResult } from "../../models/dfd-types";
import type { DrawioPageSyncResult, DrawioPageSyncSpec } from "../drawio-bridge";
import type { ParseResult } from "../dfd-parser";
import type { LeveledActionError } from "../../models/leveled-errors";
import { SerialQueue } from "../../utils/serial-queue";
import { parseDfd } from "./leveled-analysis";
import { analysePageGeometry } from "./page-geometry";
import { planContextCopies, planInsertAsContext, type ContextCopySpec } from "./context-copies";
import { planPageSync, readCellLinks, type OrphanPage } from "./child-pages";
import { needsPageReview } from "./identity-review";
import {
  applyArrivedLinks,
  autoContextOf,
  callSync,
  deletedChildPages,
  rememberCopies,
  type ContextRemoval,
} from "./child-pages-steps";

/** The saved DFD state the orchestrator reconciles. */
export interface ChildPagesState {
  /** The TARAflow plugin runs in draw.io (Electron). */
  enabled: boolean;
  xml?: string;
  pages?: DFDPage[];
  elements?: readonly DFDElement[];
  /**
   * Parse of this state from the shared leveled analysis, if the caller has
   * one (finding 1); otherwise the shared cache is asked.
   */
  parse?: ParseResult | null;
}

export interface ChildPagesDeps {
  syncPages: (spec: DrawioPageSyncSpec) => Promise<DrawioPageSyncResult>;
  savePages: (pages: DFDPage[]) => Promise<DFDUpdateResult | null>;
  /** properties.noChildPage of a multiprocess; saved with the next savePages. */
  setNoChildPage: (tfId: string, noChildPage: boolean) => void;
}

/** What the UI shows; replaced (never mutated) on every change. */
export interface ChildPagesSnapshot {
  /** A created page or context copy is on its way into the saved XML. */
  settling: boolean;
  /** Child pages whose multiprocess was deleted, not decided yet. */
  orphanPages: OrphanPage[];
}

const isOptedOut = (e: DFDElement) =>
  e.type === "Multiprocess" && !!(e.properties as { noChildPage?: boolean } | undefined)?.noChildPage;

export class ChildPagesOrchestrator {
  private readonly queue = new SerialQueue();
  private state: ChildPagesState | null = null;
  private deps: ChildPagesDeps | null = null;
  private reconcileQueued = false;
  private snapshot: ChildPagesSnapshot = { settling: false, orphanPages: [] };
  private readonly listeners = new Set<() => void>();

  // Session state.
  /** Multiprocesses of the DFD as opened (classic: they never get a page automatically). */
  private known: Set<string> | null = null;
  /** Multiprocesses already handled (page requested). */
  private readonly attempted = new Set<string>();
  /** Renames requested: pageId → name. */
  private readonly renamed = new Map<string, string>();
  /** Pages created that the saved XML does not show yet. */
  private readonly createdPages = new Set<string>();
  /** Explicit "Create child page" requests. */
  private readonly forced = new Set<string>();
  /** Page links requested ("page\0cell\0target"). */
  private readonly linked = new Set<string>();
  /** Orphan pages decided. */
  private readonly asked = new Set<string>();
  /** Context copies waiting for draw.io's autosave: pageId → links. */
  private readonly pendingLinks = new Map<string, DFDCellLink[]>();
  /** Context cells requested per page ("page\0cell", removals "page\0-cell"). */
  private readonly requested = new Set<string>();
  /** Last reason for doing nothing, logged once per change. */
  private lastSkip: string | null = null;

  constructor(private readonly newPageId: () => string) {}

  // ── React binding (useSyncExternalStore) ────────────────────────────────

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): ChildPagesSnapshot => this.snapshot;

  setDeps(deps: ChildPagesDeps): void {
    this.deps = deps;
  }

  /** A new saved state: settle at once, reconcile in the queue. */
  update(state: ChildPagesState): void {
    this.state = state;
    // The DFD as opened: its multiprocesses are taken from the first saved
    // state at once — the queue may skip to a newer state, which could
    // already hold a multiprocess drawn since.
    if (!this.known && state.xml && inspectDrawioPages(state.xml, state.pages?.map((p) => p.pageId)).supported) {
      const parse = state.parse ?? parseDfd(state.xml, state.pages);
      this.known = new Set(parse.elements.filter((e) => e.type === "Multiprocess").map((e) => e.id));
    }
    const xmlPageIds = new Set(state.xml ? inspectDrawioPages(state.xml).pageIds : []);
    for (const id of [...this.createdPages]) if (xmlPageIds.has(id)) this.createdPages.delete(id);
    this.publish({ settling: this.createdPages.size > 0 || this.pendingLinks.size > 0 });
    this.requestReconcile();
  }

  /** Resolves once everything queued so far has run (tests). */
  idle(): Promise<void> {
    return this.queue.idle();
  }

  // ── Analyst actions ─────────────────────────────────────────────────────

  /** "Create child page" for a multiprocess without one; false if impossible. */
  decompose = (tfId: string): boolean => {
    const state = this.state;
    const mp = state?.elements?.find((e) => e.id === tfId && e.type === "Multiprocess");
    if (!state?.enabled || !mp) return false;
    if (state.pages?.some((p) => p.decomposes === tfId)) return false;
    this.forced.add(tfId);
    this.attempted.delete(tfId);
    if (isOptedOut(mp)) this.deps?.setNoChildPage(tfId, false);
    this.requestReconcile();
    return true;
  };

  /** "Sync context" (5f): the number of cells copied, or an error code. */
  syncContext = (tfId: string): Promise<number | LeveledActionError> =>
    this.queue.run(async () => {
      const { enabled, xml, pages } = this.state ?? { enabled: false };
      const page = pages?.find((p) => p.decomposes === tfId);
      if (!enabled || !xml || !page || !this.deps) return "NOT_AVAILABLE";
      const parse = this.parseOf(xml, pages);
      const spec = planContextCopies({
        parse,
        pageGeometry: analysePageGeometry(parse.pageCells),
        multiprocess: tfId,
        childPageId: page.pageId,
        childLinks: page.links,
      });
      if (!spec) return 0;
      this.markRequested([spec]);
      const result = await callSync(this.deps.syncPages, { create: [], rename: [], context: [spec] });
      if (!result.success) {
        console.warn("[childPages] draw.io could not sync the context:", result.error, result);
        return "DRAWIO_FAILED";
      }
      if (result.errors?.length) console.warn("[childPages] sync context:", result.errors);
      rememberCopies(this.pendingLinks, [spec], result.copies);
      this.publish({ settling: true });
      return result.copies?.length ?? 0;
    });

  /** "Insert as context…" (5h): null, or an error code. The copy is `manual`. */
  insertAsContext = (
    kind: "element" | "connection",
    tfId: string,
    pageId: string,
  ): Promise<LeveledActionError | null> =>
    this.queue.run(async () => {
      const { enabled, xml, pages } = this.state ?? { enabled: false };
      if (!enabled || !xml || !this.deps) return "NOT_AVAILABLE";
      const parse = this.parseOf(xml, pages);
      const spec = planInsertAsContext(parse, pages, kind, tfId, pageId);
      if (!spec) return "NOT_POSSIBLE";
      const result = await callSync(this.deps.syncPages, { create: [], rename: [], context: [spec] });
      if (!result.success) {
        console.warn("[childPages] draw.io could not insert the copy:", result.error, result);
        return "DRAWIO_FAILED";
      }
      if (!result.copies?.length) {
        console.warn("[childPages] draw.io copied nothing:", result.errors, result);
        return "NOTHING_COPIED";
      }
      rememberCopies(this.pendingLinks, [spec], result.copies, true);
      this.publish({ settling: true });
      return null;
    });

  /** Delete the orphan page in draw.io, or keep it: null, or an error code (question stays). */
  resolveOrphan = (pageId: string, removePage: boolean): Promise<LeveledActionError | null> =>
    this.queue.run(async () => {
      if (removePage && this.deps) {
        // The deleted page then leaves dfd.pages like any page deleted in draw.io.
        const result = await callSync(this.deps.syncPages, { create: [], rename: [], remove: [pageId] });
        if (!result.success || result.errors?.length) {
          console.warn("[childPages] draw.io could not delete the page:", result.error ?? result.errors, result);
          return "PAGE_NOT_DELETED";
        }
      }
      this.asked.add(pageId);
      this.publish({ orphanPages: this.snapshot.orphanPages.filter((o) => o.pageId !== pageId) });
      return null;
    });

  // ── Reconciliation ──────────────────────────────────────────────────────

  /** One reconcile of the newest state after what runs now; never two waiting. */
  private requestReconcile(): void {
    if (this.reconcileQueued) return;
    this.reconcileQueued = true;
    void this.queue
      .run(async () => {
        this.reconcileQueued = false;
        if (this.state && this.deps) await this.reconcile(this.state, this.deps);
      })
      .catch((error) => console.warn("[childPages] reconcile failed:", error));
  }

  private async reconcile(state: ChildPagesState, deps: ChildPagesDeps): Promise<void> {
    const { xml, pages, elements = [] } = state;
    if (!xml) return this.skip("no saved diagram yet");
    if (!inspectDrawioPages(xml, pages?.map((p) => p.pageId)).supported) {
      return this.skip("pages wait for adoption (5b)");
    }
    const xmlPageIds = new Set(inspectDrawioPages(xml).pageIds);

    const deleted = deletedChildPages(pages, xmlPageIds, this.createdPages);
    if (deleted.length > 0) return this.removeDeletedPages(deleted, pages ?? [], elements, deps);

    if (this.pendingLinks.size > 0 && pages) {
      const arrived = applyArrivedLinks(xml, pages, this.pendingLinks);
      if (arrived) {
        this.lastSkip = null;
        await deps.savePages(arrived);
        return;
      }
    }

    if (!state.enabled) return this.skip("draw.io plugin not ready (Electron only)");
    if (needsPageReview(xml, pages)) {
      return this.skip("page tree needs a review (extra root or missing page) or a new page is on its way");
    }
    await this.syncPages(xml, pages, elements, deps);
  }

  /** Deleting the page was the analyst's decision: its multiprocess keeps no page. */
  private async removeDeletedPages(
    deleted: DFDPage[],
    pages: DFDPage[],
    elements: readonly DFDElement[],
    deps: ChildPagesDeps,
  ): Promise<void> {
    this.lastSkip = null;
    console.info(
      "[childPages] child page(s) deleted in draw.io, removed from the page tree:",
      deleted.map((p) => p.name),
    );
    const multiprocesses = new Set(elements.filter((e) => e.type === "Multiprocess").map((e) => e.id));
    for (const p of deleted) {
      if (multiprocesses.has(p.decomposes!)) {
        this.attempted.add(p.decomposes!);
        deps.setNoChildPage(p.decomposes!, true);
      }
    }
    const gone = new Set(deleted.map((p) => p.pageId));
    await deps.savePages(pages.filter((p) => !gone.has(p.pageId)));
  }

  private async syncPages(
    xml: string,
    pages: DFDPage[] | undefined,
    elements: readonly DFDElement[],
    deps: ChildPagesDeps,
  ): Promise<void> {
    const parse = this.parseOf(xml, pages);
    const leveled = !!pages && pages.length > 0;
    const known = new Set([
      ...(leveled ? [] : (this.known ?? [])),
      ...this.attempted,
      ...elements.filter(isOptedOut).map((e) => e.id),
    ]);
    for (const tfId of this.forced) known.delete(tfId);
    // Context copies not linked yet are plain cells: never give them a page.
    for (const links of this.pendingLinks.values()) for (const l of links) known.add(l.cellId);
    const plan = planPageSync({
      parse,
      pages,
      knownMultiprocesses: known,
      newPageId: this.newPageId,
      cellLinks: readCellLinks(xml),
    });

    const orphans = (plan?.orphans ?? []).filter((o) => !this.asked.has(o.pageId));
    if (JSON.stringify(orphans) !== JSON.stringify(this.snapshot.orphanPages)) {
      this.publish({ orphanPages: orphans });
    }

    // A child page without a part of its own is a pure context page (D15):
    // its context follows the parent page automatically.
    const { copies: autoContext, removals: autoRemovals } = autoContextOf(parse, pages, this.requested);
    const autoChanges = autoContext.length + autoRemovals.length;
    if (!plan) {
      if (autoChanges === 0) return this.skip("pages up to date");
      this.lastSkip = null;
      console.info("[childPages] context follows the parent page:", {
        add: autoContext.map((c) => `${c.toPageId}: ${c.cells.join(", ")}`),
        remove: autoRemovals.map((r) => `${r.pageId}: ${r.cellIds.join(", ")}`),
      });
      return this.copyContext(autoContext, autoRemovals, deps);
    }

    const rename = plan.rename.filter((r) => this.renamed.get(r.pageId) !== r.name);
    const linkKey = (l: { pageId: string; cellId: string; target: string }) =>
      `${l.pageId}\u0000${l.cellId}\u0000${l.target}`;
    const link = plan.link.filter((l) => !this.linked.has(linkKey(l)));
    const pagesChanged = JSON.stringify(plan.pages) !== JSON.stringify(pages ?? []);
    if (plan.create.length === 0 && rename.length === 0 && link.length === 0 && !pagesChanged && autoChanges === 0) {
      return this.skip(
        orphans.length > 0 ? "waiting for the decision on orphan pages" : "pages up to date (requests already sent)",
      );
    }
    this.lastSkip = null;
    console.info("[childPages] syncing pages:", {
      create: plan.create.map((c) => `${c.name} (${c.decomposes})`),
      rename: rename.map((r) => `${r.pageId} → ${r.name}`),
      link: link.map((l) => `${l.pageId}/${l.cellId} → ${l.target}`),
    });

    // 1. Create the child pages, each with its context copies (5f).
    let created = plan.create;
    if (plan.create.length > 0) {
      for (const c of plan.create) {
        this.attempted.add(c.decomposes);
        this.forced.delete(c.decomposes);
      }
      const geometry = analysePageGeometry(parse.pageCells);
      const context = plan.create
        .map((c) =>
          planContextCopies({ parse, pageGeometry: geometry, multiprocess: c.decomposes, childPageId: c.pageId }),
        )
        .filter((c): c is ContextCopySpec => !!c);
      this.markRequested(context);
      const result = await callSync(deps.syncPages, { create: plan.create, rename: [], context });
      rememberCopies(this.pendingLinks, context, result.copies);
      if (!result.success) {
        console.warn("[childPages] draw.io could not create pages:", result.error, result);
        created = [];
      } else {
        // Only what draw.io reports as created (an insert can fail).
        if (result.created) created = plan.create.filter((c) => result.created!.includes(c.pageId));
        if (result.errors?.length) console.warn("[childPages] draw.io page sync:", result.errors);
      }
    }
    // A classic project only becomes leveled once a page really exists.
    if (!pages && created.length === 0) return;

    // 2. Names (D16, D17) and page links on later copies (5e).
    if (rename.length > 0 || link.length > 0) {
      for (const r of rename) this.renamed.set(r.pageId, r.name);
      for (const l of link) this.linked.add(linkKey(l));
      const result = await callSync(deps.syncPages, { create: [], rename, link });
      if (!result.success) {
        console.warn("[childPages] draw.io could not rename / link:", result.error, result);
      } else if (result.errors?.length) {
        console.warn("[childPages] draw.io page sync:", result.errors);
      }
    }

    // 2b. Context of pure context pages (5f).
    if (autoChanges > 0) await this.copyContext(autoContext, autoRemovals, deps);

    // 3. dfd.pages — only with the pages draw.io has really created.
    const failed = new Set(plan.create.filter((c) => !created.includes(c)).map((c) => c.pageId));
    const nextPages = plan.pages.filter((p) => !failed.has(p.pageId));
    for (const c of created) this.createdPages.add(c.pageId);
    if (JSON.stringify(nextPages) !== JSON.stringify(pages ?? [])) {
      if (created.length > 0) this.publish({ settling: true });
      await deps.savePages(nextPages);
    }
  }

  private async copyContext(
    specs: ContextCopySpec[],
    removals: ContextRemoval[],
    deps: ChildPagesDeps,
  ): Promise<void> {
    this.markRequested(specs);
    for (const r of removals) for (const cell of r.cellIds) this.requested.add(`${r.pageId}\u0000-${cell}`);
    const result = await callSync(deps.syncPages, {
      create: [],
      rename: [],
      context: specs,
      ...(removals.length > 0 ? { removeCells: removals } : {}),
    });
    if (!result.success) {
      console.warn("[childPages] draw.io could not copy the context:", result.error, result);
      return;
    }
    if (result.errors?.length) console.warn("[childPages] context:", result.errors);
    rememberCopies(this.pendingLinks, specs, result.copies);
    if (result.copies?.length) this.publish({ settling: true });
  }

  /** The parse handed over with the state, or the shared one. */
  private parseOf(xml: string, pages: readonly DFDPage[] | undefined): ParseResult {
    const state = this.state;
    return state?.parse && state.xml === xml && state.pages === pages ? state.parse : parseDfd(xml, pages);
  }

  private markRequested(specs: readonly ContextCopySpec[]): void {
    for (const spec of specs) for (const cell of spec.cells) this.requested.add(`${spec.toPageId}\u0000${cell}`);
  }

  private skip(reason: string): void {
    if (this.lastSkip === reason) return;
    this.lastSkip = reason;
    console.info(`[childPages] nothing to do: ${reason}`);
  }

  private publish(change: Partial<ChildPagesSnapshot>): void {
    const next = { ...this.snapshot, ...change };
    if (next.settling === this.snapshot.settling && next.orphanPages === this.snapshot.orphanPages) return;
    this.snapshot = next;
    for (const listener of this.listeners) listener();
  }
}
