// ==================== DFD-DERIVED DATA ====================
// Everything the tabs read from the active project's DFD, memoized: the DFD
// tab's project object, the asset-feature mappings, the graph and its
// analysis context, the leveled-DFD analysis, the DFD reference for threats
// and risks. Split out of workspace-layout.tsx (MT-1).

import { useMemo } from "react";
import type { DFDReference } from "shared";
import {
  DFDGraphAnalysisContext,
  analyseLeveled,
  isLeveled,
  multiprocessGroupsFrom,
  parentLevelFlowsFrom,
} from "features/dfd";
import type { Project } from "../../models/project-types";
import {
  mapDFDAssetsToAssetFeature,
  mapDFDConnectionsToAssetFeature,
  mapDFDElementsToAssetFeature,
} from "../../utils/dfd-to-asset-mapper";
import { toReferenceGraph } from "../../utils/to-reference-graph";
import { resolveDfdGraph } from "../../utils/resolve-dfd-graph";
import {
  componentFindings,
  importedMultiprocessIds,
} from "../../services/component-import/component-findings";
import { componentExcludedIds } from "../../services/component-import/component-scope";
import { componentThreatGroups } from "../../utils/component-threats";

export function useDfdDerivedData(activeProject: Project | undefined) {
  // ── DFD tab project ───────────────────────────────────────────────────────
  // Stable project object for DFDTab — prevents iframe reload and Popper
  // listener accumulation on unrelated re-renders.
  // CRITICAL: phaseStatus and settings are objects — comparing them via ===
  // always returns false after a spread (...current) even if content is
  // equal. JSON-serialized strings are the dependency proxies so the memo
  // only invalidates when the content actually changes, not the reference.
  const phaseStatusKey = JSON.stringify(activeProject?.phaseStatus);
  const settingsKey = JSON.stringify(activeProject?.settings);
  // Invalidate when the canonical asset registry (ids/names) changes, so DFD
  // validation always sees the current asset set.
  const knownAssetsKey = JSON.stringify(
    activeProject?.assets?.assets?.map((a) => [a.id, a.name, a.assetGroup]) ?? [],
  );

  const dfdTabProject = useMemo(
    () =>
      activeProject
        ? {
            id: activeProject.id,
            name: activeProject.info?.name ?? "",
            dfd: activeProject.dfd ?? null,
            // Canonical asset registry — validate DFD relations against the
            // feature store (truth), not the lagging dfd.assets mirror.
            knownAssets:
              activeProject.assets?.assets?.map((a) => ({
                id: a.id,
                name: a.name,
                assetGroup: a.assetGroup,
              })) ?? [],
            phaseStatus: activeProject.phaseStatus,
            settings: activeProject.settings,
            lastModified: activeProject.info?.lastModified ?? "",
          }
        : null,
    // Deliberately narrow: the serialized keys above stand for the objects
    // (iframe reload guard); a new project object with equal content must
    // not produce a new DFD tab project.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      activeProject?.id,
      activeProject?.info?.name,
      activeProject?.info?.lastModified,
      activeProject?.dfd?.lastModified,
      phaseStatusKey,
      settingsKey,
      knownAssetsKey,
    ],
  );

  // ── Asset-feature mappings ────────────────────────────────────────────────
  const dfd = activeProject?.dfd;
  const dfdAssets = useMemo(
    () =>
      dfd?.assets
        ? mapDFDAssetsToAssetFeature(dfd.assets, dfd.elements ?? [], dfd.connections ?? [])
        : undefined,
    // Must also depend on elements/connections: linkedElements (incl.
    // safety) is rebuilt from their assetRelations, so a safety-only edit on
    // an element/connection — with the assets array reference unchanged —
    // must still invalidate this memo.
    [dfd?.assets, dfd?.elements, dfd?.connections],
  );
  const dfdElements = useMemo(
    () => (dfd?.elements ? mapDFDElementsToAssetFeature(dfd.elements) : undefined),
    [dfd?.elements],
  );
  const dfdConnections = useMemo(
    () => (dfd?.connections ? mapDFDConnectionsToAssetFeature(dfd.connections) : undefined),
    [dfd?.connections],
  );

  // ── Graph ─────────────────────────────────────────────────────────────────
  // Stored graph, or rebuilt from the persisted DFD when missing — the
  // Threats tab is only rendered when a DFD context exists (see
  // resolveDfdGraph for why this must not depend on a side-effect save).
  const dfdGraph = useMemo(
    () => resolveDfdGraph(dfd),
    // Only the inputs of the graph: a DFD save that changes e.g. the
    // thumbnail or xml alone does not rebuild it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dfd?.graph, dfd?.elements, dfd?.connections, dfd?.assets],
  );
  const dfdGraphRef = useMemo(
    () => (dfdGraph ? toReferenceGraph(dfdGraph) : undefined),
    [dfdGraph],
  );
  const dfdContext = useMemo(
    () => (dfdGraph ? new DFDGraphAnalysisContext(dfdGraph) : null),
    [dfdGraph],
  );

  // ── Leveled DFD ───────────────────────────────────────────────────────────
  // One shared analysis (parse + effective model) for the parent-level flows
  // (5j) and the table groups (Phase 6, D20).
  const leveledAnalysis = useMemo(
    () =>
      dfd?.xml && dfd.pages && dfd.pages.length > 1 && isLeveled(dfd.xml)
        ? analyseLeveled({
            xml: dfd.xml,
            pages: dfd.pages,
            elements: dfd.elements ?? [],
            connections: dfd.connections ?? [],
          })
        : null,
    [dfd?.xml, dfd?.pages, dfd?.elements, dfd?.connections],
  );
  const parentLevelFlows = useMemo(
    () => (leveledAnalysis ? parentLevelFlowsFrom(leveledAnalysis) : []),
    [leveledAnalysis],
  );
  const tableGroups = useMemo(
    () => (leveledAnalysis ? multiprocessGroupsFrom(leveledAnalysis) : undefined),
    [leveledAnalysis],
  );

  // ── DFD reference (threats, risks) ────────────────────────────────────────
  const dfdReference = useMemo((): DFDReference | null => {
    if (!dfd) return null;
    return {
      processes: dfd.elements
        ?.filter((e) => e.type === "Process" || e.type === "Multiprocess")
        .map((e) => ({
          id: e.id,
          label: e.name ?? e.id,
          safetyAnnotation: (e.properties as any)?.safetyAnnotation
            ? {
                severity: (e.properties as any).safetyAnnotation.severity,
                description: (e.properties as any).safetyAnnotation.description,
              }
            : undefined,
        })),
      elements: dfd.elements?.map((e) => ({
        id: e.id,
        properties: e.properties as Record<string, unknown>,
      })),
      connections: dfd.connections?.map((c) => ({
        id: c.id,
        properties: c.properties as Record<string, unknown>,
      })),
    };
  }, [dfd]);

  // ── Imported components (multi-project TARA) ─────────────────────────────
  const components = activeProject?.components;
  const risks = activeProject?.risks;
  const componentDfdFindings = useMemo(
    () => (components ? componentFindings({ components, dfd: dfd ?? null, risks: risks ?? null }) : undefined),
    [components, dfd, risks],
  );
  const componentMultiprocessIds = useMemo(
    () => (components ? importedMultiprocessIds({ components }) : undefined),
    [components],
  );
  // Parts of imported components: no generated threats (patch 12, §7.1).
  const componentExcluded = useMemo(
    () => (components ? componentExcludedIds({ components }) : undefined),
    [components],
  );
  // The imported threats per instance, read-only (patch 14).
  const componentThreatGroupList = useMemo(
    () => (components ? componentThreatGroups({ components, dfd: dfd ?? null }) : undefined),
    [components, dfd],
  );

  return {
    dfdTabProject,
    componentDfdFindings,
    componentMultiprocessIds,
    componentExcluded,
    componentThreatGroups: componentThreatGroupList,
    dfdAssets,
    dfdElements,
    dfdConnections,
    dfdGraphRef,
    dfdContext,
    parentLevelFlows,
    tableGroups,
    dfdReference,
  };
}
