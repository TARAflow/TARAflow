// ==================== USE CHILD PAGES ====================
// Leveled-DFD Phase 5d–5h (leveled-dfd-multi-diagram-design.md §5.3, §12,
// D15–D17): child page per multiprocess, tab names, page links on later
// copies, the question about the page of a deleted multiprocess, context
// copies (5f) and "Insert as context" (5h).
//
// The work is done by ChildPagesOrchestrator outside React (review finding
// 3): one serial queue for every step and every analyst action, no busy
// flag, no polling, and no saved state is dropped. This hook binds it to
// React: it hands over each saved state and reads settling / orphan pages.

import { useEffect, useRef, useSyncExternalStore } from "react";
import type { DFDPage, DFDProjectData, DFDUpdateResult } from "../models/dfd-types";
import type { OrphanPage } from "../services/leveled";
import type { ParseResult } from "../services/dfd-parser";
import type { LeveledActionError } from "../models/leveled-errors";
import type { DrawioPageSyncResult, DrawioPageSyncSpec } from "../services/drawio-bridge";
import { ChildPagesOrchestrator } from "../services/leveled/child-pages-orchestrator";
import { randomPageId } from "../services/leveled/child-pages-steps";

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
  /** Parse of the saved DFD from the shared leveled analysis (finding 1). */
  parse?: ParseResult | null;
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
   * Resolves to an error code if draw.io did not delete the page — the
   * question stays then.
   */
  resolveOrphan: (pageId: string, removePage: boolean) => Promise<LeveledActionError | null>;
  /** "Create child page" for a multiprocess without one; false if impossible. */
  decompose: (tfId: string) => boolean;
  /**
   * "Sync context" (5f): copy what is missing on the child page of this
   * multiprocess. Resolves to the number of cells copied, or an error code.
   */
  syncContext: (tfId: string) => Promise<number | LeveledActionError>;
  /**
   * "Insert as context…" (5h): a copy of an element / flow on the page.
   * Resolves to null, or an error code. The copy is marked `manual`.
   */
  insertAsContext: (
    kind: "element" | "connection",
    tfId: string,
    pageId: string,
  ) => Promise<LeveledActionError | null>;
}

export function useChildPages(
  project: DFDProjectData,
  options: UseChildPagesOptions,
): UseChildPagesReturn {
  const { enabled, syncPages, savePages, setNoChildPage } = options;
  const orchestratorRef = useRef<ChildPagesOrchestrator | null>(null);
  if (!orchestratorRef.current) {
    orchestratorRef.current = new ChildPagesOrchestrator(options.newPageId ?? randomPageId);
  }
  const orchestrator = orchestratorRef.current;
  // The latest callbacks; read by the queued steps when they run.
  orchestrator.setDeps({ syncPages, savePages, setNoChildPage });

  const xml = project.dfd?.xml;
  const pages = project.dfd?.pages;
  const elements = project.dfd?.elements;
  const parse = options.parse;
  useEffect(() => {
    orchestrator.update({ enabled, xml, pages, elements, parse });
  }, [orchestrator, enabled, xml, pages, elements, parse]);

  const { settling, orphanPages } = useSyncExternalStore(
    orchestrator.subscribe,
    orchestrator.getSnapshot,
  );
  return {
    settling,
    orphanPages,
    resolveOrphan: orchestrator.resolveOrphan,
    decompose: orchestrator.decompose,
    syncContext: orchestrator.syncContext,
    insertAsContext: orchestrator.insertAsContext,
  };
}
