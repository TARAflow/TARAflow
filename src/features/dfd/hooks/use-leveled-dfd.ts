// ==================== USE LEVELED DFD ====================
// Façade of the leveled-DFD flows of the DFD tab (review finding 4): the
// shared analysis (finding 1) and everything the tab needs of it — Phase 4b
// refinement candidates, 5b adoption / copy assignment, 5c page outline and
// page tabs, 5d/5e child pages, 5g context-copy display and cell identity,
// 5h insert as context, 5i page thumbnails, 5k lost definitions, 5l page
// renumbering, 6d asset roll-up of the selected multiprocess.
//
// The DFD tab renders; this hook decides. A classic DFD (one page) yields
// null / empty values and no draw.io calls beyond the plain DFD.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { inspectDrawioPages } from "shared";
import type { DFDElement, DFDProjectData } from "../models/dfd-types";
import type { ContextCellMap } from "../services/drawio-bridge";
import {
  buildPageTabInfo,
  contextCellsOf,
  deeperHomeContainer,
  describeIdentity,
  insertCandidates,
  linkAsContextCopy,
  makeDefinition,
  needsPageRepair,
  promoteToDefinition,
  recordInfos,
  type CellRef,
  type LinkEditResult,
  type LostDefinition,
} from "../services/leveled";
import { analyseLeveled } from "../services/leveled/leveled-analysis";
import { assetRollupsOf } from "../services/leveled/asset-rollup";
import { ValidationMessages } from "../services/validators/validator-utils";
import { refinementCandidatesOf } from "../utils/refinement-candidates";
import { waitForRenderable } from "../utils/wait-for-renderable";
import type { AssetRollupContextValue } from "../components/forms/asset-rollup-view";
import type { UseDFDEditorReturn } from "./use-dfd-editor";
import { useIdentityReview } from "./use-identity-review";
import { usePageOutline } from "./use-page-outline";
import { useChildPages } from "./use-child-pages";
import { useLostDefinitions } from "./use-lost-definitions";
import { usePageThumbnails } from "./use-page-thumbnails";
import type { LeveledActionError } from "../models/leveled-errors";

export interface LeveledSelection {
  /** The selected element (record), if any. */
  element?: DFDElement;
  /** The selected cell (page + cell id). */
  cellRef: CellRef | null;
}

export function useLeveledDfd(
  project: DFDProjectData,
  editor: UseDFDEditorReturn,
  selection: LeveledSelection,
) {
  const { t } = useTranslation();
  const dfd = project.dfd;
  const xml = dfd?.xml;
  const pages = dfd?.pages;

  // ── Shared analysis (finding 1) ─────────────────────────────────────────
  // Null for a classic project and while pages wait for adoption.
  const analysis = useMemo(() => {
    if (!xml || !pages || pages.length === 0) return null;
    if (!inspectDrawioPages(xml, pages.map((p) => p.pageId)).supported) return null;
    return analyseLeveled({
      xml,
      pages,
      elements: dfd?.elements ?? [],
      connections: dfd?.connections ?? [],
    });
  }, [xml, pages, dfd?.elements, dfd?.connections]);
  const parse = analysis?.parse ?? null;

  // ── 4b: flows a data flow may refine ────────────────────────────────────
  const connections = dfd?.connections;
  const refinementCandidates = useMemo(
    () => refinementCandidatesOf({ xml, connections }),
    [xml, connections],
  );

  // ── 5b: adoption of unadopted pages, assignment of pasted copies ────────
  const identityReview = useIdentityReview(project, {
    adoptionPending: !!editor.validation?.errors.some(
      (f) => f.key === ValidationMessages.ADOPTION_PENDING,
    ),
    savePages: editor.savePages,
  });

  // ── 5c: page outline and draw.io page tabs ──────────────────────────────
  const pageOutline = usePageOutline(parse, pages, editor.validation);
  const pageTabInfo = useMemo(
    () => buildPageTabInfo(pageOutline, (key, options) => String(t(key, options))),
    [pageOutline, t],
  );
  const { pluginReady, setPageTabInfo, setContextCells } = editor;
  useEffect(() => {
    if (pluginReady) void setPageTabInfo(pageTabInfo);
  }, [pluginReady, setPageTabInfo, pageTabInfo]);

  // ── 5g: context copies shown faded and dashed (display only) ────────────
  const contextCells = useMemo<ContextCellMap>(
    () => (parse ? contextCellsOf(parse.occurrences, pages) : {}),
    [parse, pages],
  );
  useEffect(() => {
    if (pluginReady) void setContextCells(contextCells);
  }, [pluginReady, setContextCells, contextCells]);

  // ── 5d/5e: child page per multiprocess ──────────────────────────────────
  const { updateElementDescription, updateConnectionDescription } = editor;
  const projectElements = dfd?.elements;
  const setNoChildPage = useCallback(
    (tfId: string, noChildPage: boolean) => {
      const mp = projectElements?.find((e) => e.id === tfId);
      if (!mp) return;
      updateElementDescription(tfId, {
        // MultiprocessProperties.noChildPage; the element's union type has
        // no multiprocess member of its own.
        properties: { ...mp.properties, noChildPage } as unknown as typeof mp.properties,
      });
    },
    [projectElements, updateElementDescription],
  );
  const childPages = useChildPages(project, {
    enabled: pluginReady,
    syncPages: editor.syncPages,
    savePages: editor.savePages,
    setNoChildPage,
    parse,
  });

  // Adopted pages the tree cannot use (extra or missing root page) — from
  // the saved state, and not while a page just created is on its way into
  // the saved XML.
  const pageRepair = useMemo(
    () => !childPages.settling && needsPageRepair(xml, pages),
    [childPages.settling, xml, pages],
  );

  // ── 5k: a linked definition cell deleted or drawn again ─────────────────
  const restoreRecord = useCallback(
    (lost: LostDefinition) => {
      const { properties, assetRelations } = lost.record as {
        properties?: unknown;
        assetRelations?: unknown;
      };
      const updates = {
        ...(properties !== undefined ? { properties } : {}),
        ...(assetRelations !== undefined ? { assetRelations } : {}),
      };
      if (lost.kind === "element") updateElementDescription(lost.tfId, updates as never);
      else updateConnectionDescription(lost.tfId, updates as never);
    },
    [updateElementDescription, updateConnectionDescription],
  );
  const lostDefinitions = useLostDefinitions(project, {
    savePages: editor.savePages,
    restoreRecord,
    parse,
  });

  // ── 5i: one thumbnail per page ──────────────────────────────────────────
  const { iframeRef } = editor;
  const isRenderable = useCallback(
    () => waitForRenderable(() => iframeRef.current, { timeoutMs: 2_000 }),
    [iframeRef],
  );
  usePageThumbnails(project, {
    enabled: pluginReady,
    exportPageSvgs: editor.exportPageSvgs,
    storeThumbnails: editor.updatePageThumbnails,
    isRenderable,
  });

  // ── 5l: the page draw.io shows (before the first selection event the
  //    first page of the document) and its renumbering ─────────────────────
  const { getCurrentPageId, autoNumberLabels } = editor;
  const currentPageOf = useCallback(
    () => getCurrentPageId() ?? parse?.pages[0]?.pageId ?? null,
    [getCurrentPageId, parse],
  );
  const autoNumberPage = useCallback(async () => {
    const pageId = currentPageOf();
    if (pageId) await autoNumberLabels(pageId);
  }, [currentPageOf, autoNumberLabels]);
  const currentPageName = useCallback(() => {
    const pageId = currentPageOf();
    return parse?.pages.find((p) => p.pageId === pageId)?.name ?? pageId ?? "";
  }, [currentPageOf, parse]);

  // ── 5h: insert as context on the current page ───────────────────────────
  const [insertTargetPage, setInsertTargetPage] = useState<string | null>(null);
  const insertContext = useMemo(() => {
    if (!parse || !insertTargetPage) return null;
    return {
      targetPage: insertTargetPage,
      candidates: insertCandidates(parse, pages, insertTargetPage),
      pageNames: Object.fromEntries(parse.pages.map((p) => [p.pageId, p.name || p.pageId])),
    };
  }, [parse, pages, insertTargetPage]);
  const openInsertContext = useCallback(
    () => setInsertTargetPage(currentPageOf()),
    [currentPageOf],
  );
  const closeInsertContext = useCallback(() => setInsertTargetPage(null), []);

  // ── Selection: 6d roll-up, 5e child page, 5g cell identity ─────────────
  const selected = selection.element;
  const assetRollup = useMemo((): AssetRollupContextValue | undefined => {
    if (selected?.type !== "Multiprocess" || !analysis || !pages || pages.length < 2) return undefined;
    const assets = assetRollupsOf(analysis.model, analysis.records).get(selected.id);
    if (!assets) return undefined;
    const labels = new Map(
      [...analysis.records.elements.values(), ...analysis.records.connections.values()].map(
        (r) => [r.id, r.displayId || r.name || r.id],
      ),
    );
    return { elementId: selected.id, assets, partLabel: (tfId) => labels.get(tfId) ?? tfId };
  }, [selected, analysis, pages]);

  const { decompose, syncContext } = childPages;
  const { openPage } = editor;
  const childPage = useMemo(() => {
    if (selected?.type !== "Multiprocess") return undefined;
    const page = pages?.find((p) => p.decomposes === selected.id);
    const mpTfId = selected.id;
    if (page) {
      return pluginReady
        ? {
            pageName: page.name,
            onOpen: () => void openPage(page.pageId),
            onSyncContext: () => syncContext(mpTfId),
          }
        : { pageName: page.name };
    }
    return pluginReady ? { onCreate: () => void decompose(mpTfId) } : {};
  }, [selected, pages, decompose, syncContext, pluginReady, openPage]);

  const { savePages, selectCellAt } = editor;
  const cellRef = selection.cellRef;
  const tree = analysis?.tree;
  const identity = useMemo(() => {
    if (!parse || !pages || !cellRef) return undefined;
    const info = describeIdentity(parse, pages, cellRef);
    if (!info) return undefined;
    // A definition below the highest occurrence makes the element part of
    // the multiprocess of this page — asked before it is applied.
    const container = tree && deeperHomeContainer(parse.occurrences, pages, tree.depthOf, cellRef);
    const label = (tfId: string) => {
      const r = parse.elements.find((e) => e.id === tfId);
      return [r?.displayId, r?.name].filter(Boolean).join(" ") || tfId;
    };
    const becomesPartOf = container
      ? { element: label(info.tfId), container: label(container) }
      : undefined;
    const apply = async (result: LinkEditResult): Promise<LeveledActionError | null> => {
      if (!result.ok) return result.reason;
      return (await savePages(result.pages)) ? null : "SAVE_FAILED";
    };
    return {
      info,
      becomesPartOf,
      onGoTo: (target: CellRef) => void selectCellAt(target.pageId, target.cellId),
      onMakeDefinition: () => apply(makeDefinition(pages, parse.occurrences, cellRef)),
      onPromote: () => apply(promoteToDefinition(pages, parse.occurrences, cellRef)),
      onLinkAsContextCopy: (tfId: string) =>
        apply(linkAsContextCopy(pages, parse.occurrences, recordInfos(parse), cellRef, tfId)),
    };
  }, [parse, pages, cellRef, tree, savePages, selectCellAt]);

  return {
    /** Parse + effective model of the saved DFD; null for a classic DFD. */
    analysis,
    parse,
    refinementCandidates,
    identityReview,
    pageOutline,
    childPages,
    pageRepair,
    lostDefinitions,
    page: { currentPageOf, currentPageName, autoNumberPage },
    insertContext: { data: insertContext, open: openInsertContext, close: closeInsertContext },
    selection: { assetRollup, childPage, identity },
  };
}

export type UseLeveledDfdReturn = ReturnType<typeof useLeveledDfd>;
