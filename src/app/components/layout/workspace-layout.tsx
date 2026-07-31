// ==================== WORKSPACE LAYOUT ====================
// Single Responsibility: render the active project's feature tabs
// and coordinate all tab-level updates back to ProjectContext.
//
// What lives here:
//   - Phase tab bar + tab routing
//   - All feature tab handlers (DFD, Assets, Threats, Risks, etc.)
//   - All memoized data transformations for feature tabs
//   - activeProjectRef (stale-closure protection for async handlers)
//   - useBidirectionalAssetSync
//
// What does NOT live here:
//   - Project list state (ProjectShell / useProjectManager)
//   - Dialogs (ProjectShell)
//   - Sidebar (ProjectShell)
//
// All project writes go through context.updateProject() — a single,
// stable, ref-based write channel. No stale-closure risk.

import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { PHASES, getPhaseStatusIcon, getPhaseStatusColor, useToast } from "shared";
import { PhaseId, getProgressPhaseIds } from "../../models/phase-types";
import {
  AssetDataReference,
  DFDReference,
  ThreatReference,
  toGraphReference,
} from "shared";

import { useProjectContext } from "../../contexts/project-context";
import { useBidirectionalAssetSync } from "../../hooks/use-bidirectional-asset-sync";

import { PhaseTabs } from "../navigation/phase-tab-bar";

import { GeneralTab } from "features/overview";
import type { GeneralTabData } from "features/overview";

import {
  HazardsTab,
  type HazardUpdateResult,
  hazardService,
} from "features/hazards";

import {
  DFDTab,
  DFDUpdateResult,
  DFDGraphAnalysisContext,
} from "features/dfd";
import { addCreatedAssets, translateFinding } from "features/dfd";

import { AssetsTab, AssetUpdateResult } from "features/assets";
import { buildAssetHazardLinks } from "app/utils/build-asset-hazard-links";
import { buildAssetDataReference } from "app/utils/build-asset-data-reference";
import { buildAttackPathThreatReferences } from "app/utils/build-attack-path-threat-references";
import { buildAttackTreeLikelihoodReferences } from "app/utils/build-attack-tree-likelihood-references";

import {
  StrideMethod,
  ThreatData,
  ThreatsTab,
  type ThreatUpdateResult,
  resolveMitigationDrafts,
  resolveVerificationDrafts,
  getAllMitigations,
  syncThreatsWithGraph,
} from "features/threats";

import { RisksTab, RiskUpdateResult } from "features/risks";

import {
  AttackTreeTab,
  AttackTreeUpdateResult,
  extractAssetReferences,
  extractThreatReferencesForAttackTree,
  extractRiskReferences,
  extractDFDElementReferences,
  extractMitigationReferences,
} from "features/attacktree";

import { DocTab, DocUpdateResult } from "features/documentation";
import { IntegrationTab, type IntegrationTabData } from "features/integration";
import { AuditTab } from "features/audit";
import type { AuditUpdateResult } from "features/audit/models/audit-types";

import { transformProjectToDocData } from "app/services/doc-transform";
import { useControlInstanceDerivation } from "app/hooks/use-control-instance-derivation";
import { useSecurityDrift } from "app/hooks/use-security-drift";

import {
  mapDFDAssetsToAssetFeature,
  mapDFDConnectionsToAssetFeature,
  mapDFDElementsToAssetFeature,
} from "../../utils/dfd-to-asset-mapper";
 
import { toReferenceGraph } from "../../utils/to-reference-graph";

import type { Project } from "../../models/project-types";
import { syncFromDFD } from "features/assets/services/asset-sync-service";

// ==================== COMPONENT ====================

export const WorkspaceLayout: React.FC = () => {
  const { t, i18n } = useTranslation();
  const toast = useToast();

  const { activeProject, activePhase, setActivePhase, updateProject } =
    useProjectContext();

  // ── Stable ref — stale-closure protection ─────────────────────────────────
  // Async handlers (DFD autosave, thumbnail) read the CURRENT activeProject
  // at call time, not the one captured when the callback was created.

  const activeProjectRef = useRef<Project | undefined>(undefined);
  activeProjectRef.current = activeProject;

  // ── Bidirectional asset sync ──────────────────────────────────────────────

  const handleBidirectionalUpdate = useCallback(
    (updates: any) => {
      const current = activeProjectRef.current;
      if (!current) return;

      updateProject({
        ...current,
        ...updates,
        dfd: updates.dfd
          ? {
              ...current.dfd,
              ...updates.dfd,
              ...(current.dfd?.graph ? { graph: current.dfd.graph } : {}),
            }
          : current.dfd,
        info: {
          ...current.info,
          lastModified: new Date().toISOString(),
        },
      });
    },
    // updateProject is stable (useCallback with stable deps in use-project-manager)
    [updateProject],
  );

  useBidirectionalAssetSync({
    project: activeProject,
    onUpdate: handleBidirectionalUpdate,
    enabled: true,
  });

  // ── Phase change ──────────────────────────────────────────────────────────

  const handlePhaseChange = useCallback(
    (phaseId: number) => {
      const current = activeProjectRef.current;
      if (!current) return;

      if (current.settings?.strictMode) {
        const currentStatus =
          current.phaseStatus[phaseId as keyof typeof current.phaseStatus];
        if (currentStatus === "not-started" && phaseId > 0) {
          const prevPhase =
            current.phaseStatus[
              (phaseId - 1) as keyof typeof current.phaseStatus
            ];
          if (prevPhase !== "complete") {
            toast.warning(
              "⚠️ Warning: Previous phase is not complete. Strict mode is enabled.",
            );
          }
        }
      }

      setActivePhase(phaseId);
      updateProject({ ...current, currentPhase: phaseId });
    },
    [setActivePhase, toast, updateProject],
  );

  // ── Safety gating ─────────────────────────────────────────────────────────
  // If safety relevance is turned off while the Hazard tab is active,
  // fall back to Overview so we never render a hidden/empty phase.
  useEffect(() => {
    if (!activeProject) return;
    const safetyRelevant = activeProject.info?.safetyRelevant ?? false;
    if (!safetyRelevant && activePhase === PhaseId.Hazard) {
      setActivePhase(PhaseId.General);
    }
  }, [activeProject, activePhase, setActivePhase]);

  // ── General tab ───────────────────────────────────────────────────────────

    const generalTabData: GeneralTabData | undefined = activeProject?.info
      ? {
          info: activeProject.info,
          settings: activeProject.settings,
          phaseStatus: activeProject.phaseStatus,
          dfdValidation: activeProject.dfd?.validation
            ? {
                valid: activeProject.dfd.validation.errors.length === 0,
                // GeneralTabData.dfdValidation uses the generic, string-based
                // ValidationResult (common-types.ts) — it's a plain summary
                // widget, not the interactive DFD notification panel, so it
                // doesn't need displayId/elementId, just translated text.
                errors: activeProject.dfd.validation.errors.map((f) =>
                  translateFinding(t, f),
                ),
                warnings: activeProject.dfd.validation.warnings.map((f) =>
                  translateFinding(t, f),
                ),
              }
            : undefined,
        }
      : undefined;

  const handleGeneralTabUpdate = useCallback(
    (data: GeneralTabData) => {
      const current = activeProjectRef.current;
      if (!current) return;
      updateProject({
        ...current,
        info: data.info,
        settings: data.settings,
        phaseStatus: data.phaseStatus,
      });
    },
    [updateProject],
  );

  // ── DFD tab ───────────────────────────────────────────────────────────────

  // Stable memoized project object for DFDTab — prevents iframe reload
  // and Popper listener accumulation on unrelated re-renders.
  // Stable project object for DFDTab.
  // CRITICAL: phaseStatus and settings are objects — comparing them via ===
  // always returns false after a spread (...current) even if content is equal.
  // We use JSON-serialized strings as dependency proxies so the memo only
  // invalidates when the content actually changes, not the reference.
  const phaseStatusKey = JSON.stringify(activeProject?.phaseStatus);
  const settingsKey = JSON.stringify(activeProject?.settings);

  const dfdTabProject = useMemo(
    () =>
      activeProject
        ? {
            id: activeProject.id,
            name: activeProject.info?.name ?? "",
            dfd: activeProject.dfd ?? null,
            phaseStatus: activeProject.phaseStatus,
            settings: activeProject.settings,
            lastModified: activeProject.info?.lastModified ?? "",
          }
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      activeProject?.id,
      activeProject?.info?.name,
      activeProject?.info?.lastModified,
      activeProject?.dfd?.lastModified,
      // Use serialized strings instead of object references —
      // prevents memo invalidation when spread creates new object identity.
      phaseStatusKey,
      settingsKey,
    ],
  );

  const handleDFDUpdate = useCallback(
    async (updates: DFDUpdateResult) => {
      // Read via ref — always current, never stale
      const current = activeProjectRef.current;
      if (!current) return;

      const graph = updates.dfd?.graph ?? current.dfd?.graph;
      if (!graph) {
        throw new Error(
          "[DFD] Invariant violation: graph must exist after DFD update",
        );
      }

      // Merge the incoming DFD changes — the new single source of truth.
      const dfd = { ...current.dfd, ...updates.dfd, graph };

      // 1) Asset-sync FIRST. Reconcile the asset store against the new DFD so
      //    newly drawn elements exist as linked assets BEFORE threats sync —
      //    otherwise new-element threats would resolve empty linkedAssetIds.
      //    Mirrors the canonical DFD→Assets sync in handleHazardsUpdate.
      let assets = current.assets;
      if (dfd.assets && current.assets) {
        const { assetData } = syncFromDFD(
          current.assets,
          mapDFDAssetsToAssetFeature(dfd.assets),
          mapDFDElementsToAssetFeature(dfd.elements ?? []),
          mapDFDConnectionsToAssetFeature(dfd.connections ?? []),
        );
        assets = assetData;
      }

      // 2) Build the enriched asset reference from the freshly-synced store.
      const assetDataRef = assets
        ? buildAssetDataReference(
            assets.assets,
            buildAssetHazardLinks(current.hazards ?? null),
            assets.configuration?.impactScale ?? "4-level",
          )
        : undefined;

      // 3) Threat-sync SECOND, against the fresh graph and asset reference.
      const threats = syncThreatsWithGraph(
        current.threats ?? null,
        toGraphReference(graph),
        assetDataRef,
      );

      await updateProject({
        ...current,
        dfd,
        assets, // persist the reconciled asset store too
        phaseStatus: updates.phaseStatus,
        threats,
      });
    },

    // Stable — reads current project via ref, never via closure
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [updateProject],
  );

  // ── Hazard tab ────────────────────────────────────────────────────────────
  const handleHazardsUpdate = useCallback(
    async (updates: HazardUpdateResult) => {
      const current = activeProjectRef.current;
      if (!current) return;
      const status = hazardService.deriveHazardPhaseStatus(updates.hazards);

      const dfd = updates.createdAssets?.length
        ? addCreatedAssets(current.dfd, updates.createdAssets)
        : current.dfd;

      // Keep both stores consistent: the hazard-minted humans were just folded into dfd.assets,
      // but assetDataRef is built from project.assets.assets.
      // Run the canonical DFD→Assets sync so they surface there too (and stay resolvable in Hazard/Threat/Risk).
      let assets = current.assets;
      if (updates.createdAssets?.length && dfd?.assets && current.assets) {
        const { assetData } = syncFromDFD(
          current.assets,
          mapDFDAssetsToAssetFeature(dfd.assets),
          mapDFDElementsToAssetFeature(dfd.elements ?? []),
          mapDFDConnectionsToAssetFeature(dfd.connections ?? []),
        );
        assets = assetData;
      }

      await updateProject({
        ...current,
        hazards: updates.hazards,
        dfd,
        assets, // ← neu: synchronisierter Assets-Store
        phaseStatus: { ...current.phaseStatus, [PhaseId.Hazard]: status },
      });
    },
    [updateProject],
  );

  // ── Assets tab ────────────────────────────────────────────────────────────

  const handleAssetsUpdate = useCallback(
    async (updates: AssetUpdateResult) => {
      const current = activeProjectRef.current;
      if (!current) return;
      await updateProject({
        ...current,
        assets: updates.assets,
        phaseStatus: updates.phaseStatus,
      });
    },
    [updateProject],
  );

  // ── Threats tab ───────────────────────────────────────────────────────────

  const handleThreatsUpdate = useCallback(
    async (updates: ThreatUpdateResult) => {
      const current = activeProjectRef.current;
      if (!current) return;
      await updateProject({
        ...current,
        threats: updates.threats,
        phaseStatus: updates.phaseStatus,
      });
    },
    [updateProject],
  );

  // ── Risks tab ─────────────────────────────────────────────────────────────

  const handleRisksUpdate = useCallback(
    async (updates: RiskUpdateResult) => {
      const current = activeProjectRef.current;
      if (!current) return;
      await updateProject({
        ...current,
        risks: updates.risks,
        phaseStatus: updates.phaseStatus,
      });
    },
    [updateProject],
  );

  // ── Attack tree tab ───────────────────────────────────────────────────────

  const handleAttackTreeUpdate = useCallback(
    (updates: AttackTreeUpdateResult) => {
      const current = activeProjectRef.current;
      if (!current) return;
      updateProject({
        ...current,
        attackTrees: updates.attackTrees,
        phaseStatus: updates.phaseStatus,
        info: { ...current.info, lastModified: updates.lastModified },
      });
    },
    [updateProject],
  );

  // ── Audit tab ─────────────────────────────────────────────────────────────

  const handleAuditUpdate = useCallback(
    (updates: AuditUpdateResult) => {
      const current = activeProjectRef.current;
      if (!current) return;
      updateProject({
        ...current,
        audit: updates.audit,
        phaseStatus: updates.phaseStatus,
        info: { ...current.info, lastModified: updates.lastModified },
      });
    },
    [updateProject],
  );

  const handleAuditDirtyChange = useCallback(
    (isDirty: boolean) => {
      const current = activeProjectRef.current;
      if (!current) return;
      updateProject({ ...current, hasUnsavedChanges: isDirty });
    },
    [updateProject],
  );

  // ── Documentation tab ─────────────────────────────────────────────────────

  const handleDocUpdate = useCallback(
    (updates: DocUpdateResult) => {
      const current = activeProjectRef.current;
      if (!current) return;
      updateProject({
        ...current,
        documentation: updates.documentation,
        phaseStatus: updates.phaseStatus,
      });
    },
    [updateProject],
  );

  // ── Integration tab ───────────────────────────────────────────────────────

  const handleIntegrationUpdate = useCallback(
    (data: IntegrationTabData) => {
      const current = activeProjectRef.current;
      if (!current) return;
      updateProject({
        ...current,
        integration: data.integration,
        hasUnsavedChanges: true,
      });
    },
    [updateProject],
  );

  // ── Memoized DFD data ─────────────────────────────────────────────────────

  const memoizedDFDAssets = useMemo(
    () =>
      activeProject?.dfd?.assets
        ? mapDFDAssetsToAssetFeature(activeProject.dfd.assets)
        : undefined,
    [activeProject?.dfd?.assets],
  );

  const memoizedDFDElements = useMemo(
    () =>
      activeProject?.dfd?.elements
        ? mapDFDElementsToAssetFeature(activeProject.dfd.elements)
        : undefined,
    [activeProject?.dfd?.elements],
  );

  const memoizedDFDConnections = useMemo(
    () =>
      activeProject?.dfd?.connections
        ? mapDFDConnectionsToAssetFeature(activeProject.dfd.connections)
        : undefined,
    [activeProject?.dfd?.connections],
  );

  const memoizedDFDGraphRef = useMemo(
    () =>
      activeProject?.dfd?.graph
        ? toReferenceGraph(activeProject.dfd.graph)
        : undefined,
    [activeProject?.dfd?.graph],
  );

  const memoizedDFDContext = useMemo(
    () =>
      activeProject?.dfd?.graph
        ? new DFDGraphAnalysisContext(activeProject.dfd.graph)
        : null,
    [activeProject?.dfd?.graph],
  );

  const memoizedDFDReference = useMemo((): DFDReference | null => {
    const dfd = activeProject?.dfd;
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
  }, [activeProject?.dfd]);

  // ── Memoized asset data ───────────────────────────────────────────────────

  // Hazard → asset projection (§6): endangeredBy / contributesTo per asset.
  // Read-only; the assets feature never imports features/hazards.
  const memoizedHazardRef = useMemo(
    () => buildAssetHazardLinks(activeProject?.hazards ?? null),
    [activeProject?.hazards],
  );

  const memoizedAssetDataRef = useMemo((): AssetDataReference | undefined => {
    const assets = activeProject?.assets?.assets;
    if (!assets || assets.length === 0) return undefined;
    return buildAssetDataReference(
      assets,
      memoizedHazardRef,
      activeProject?.assets?.configuration?.impactScale ?? "4-level",
    );
  }, [
    activeProject?.assets?.assets,
    activeProject?.assets?.configuration?.impactScale,
    memoizedHazardRef,
  ]);

  // ── Control instances + security drift ───────────────────────────────────

  // getAllMitigations() is a module-level singleton — memoize to ensure
  // stable reference across renders so useControlInstanceDerivation
  // does not re-run unnecessarily.
  const mitigationCatalog = useMemo(() => getAllMitigations(), []);

  const controlInstances = useControlInstanceDerivation(
    activeProject?.threats ?? null,
    activeProject?.risks ?? null,
    activeProject?.dfd ?? null,
    mitigationCatalog,
  );

  const securityDrifts = useSecurityDrift(
    controlInstances,
    activeProject?.dfd ?? null,
  );

  // ── Threat reference extraction ───────────────────────────────────────────

  const extractThreatReferences = (
    threatData: ThreatData | null | undefined,
    strideMethod: StrideMethod,
  ): ThreatReference[] => {
    if (!threatData) return [];

    const tables =
      strideMethod === "per-element"
        ? threatData.perElementTables
        : threatData.perInteractionTables;

    if (!tables || tables.length === 0) return [];

    const elementToAssetIds = new Map<string, string[]>();
    if (activeProject?.assets?.assets) {
      for (const asset of activeProject.assets.assets) {
        for (const el of asset.linkedDFDElements ?? []) {
          const ids = elementToAssetIds.get(el.elementId) ?? [];
          if (!ids.includes(asset.id)) ids.push(asset.id);
          elementToAssetIds.set(el.elementId, ids);
        }
      }
    }
    const dfdElements = (activeProject?.dfd as any)?.elements ?? [];
    for (const el of dfdElements) {
      for (const rel of (el.assetRelations ?? []) as Array<{
        assetId: string;
        relationType: string;
      }>) {
        if (rel.relationType === "is_an") {
          const ids = elementToAssetIds.get(el.id) ?? [];
          if (!ids.includes(rel.assetId)) ids.push(rel.assetId);
          elementToAssetIds.set(el.id, ids);
        }
      }
    }

    const references: ThreatReference[] = [];
    for (const table of tables) {
      if (!table.threats || table.threats.length === 0) continue;
      for (const threat of table.threats) {
        let elementName: string | undefined;
        let dataFlowName: string | undefined;

        if (strideMethod === "per-element") {
          elementName =
            threat.linkedElement?.elementName ||
            threat.linkedElement?.elementId;
        } else {
          dataFlowName = threat.dataFlow?.dataFlowName;
          if (!dataFlowName && threat.dataFlow) {
            dataFlowName = `${threat.dataFlow.sourceName} → ${threat.dataFlow.targetName}`;
          }
        }

        const elementId =
          threat.linkedElement?.elementId ??
          threat.dataFlow?.connectionId ??
          threat.dataFlow?.fromElementId;

        const linkedAssetIds =
          (threat.linkedAssetIds?.length ?? 0) > 0
            ? threat.linkedAssetIds!
            : elementId
              ? (elementToAssetIds.get(elementId) ?? [])
              : [];

        references.push({
          id: threat.id,
          strideCategory: threat.strideCategory,
          threatDescription: threat.threatDescription,
          attackDescription: threat.attackDescription,
          causeDescription: threat.causeDescription,
          linkedAssetIds,
          relevance: threat.relevance ?? "unrated",
          proposedMitigations: resolveMitigationDrafts(
            threat.proposedMitigations ?? [],
          ).map((m) => ({
            id: m.id,
            text: m.text,
            notes: m.notes,
            isCustom: m.isCustom,
          })),
          proposedVerifications: resolveVerificationDrafts(
            threat.proposedVerifications ?? [],
          ).map((v) => ({
            id: v.id,
            text: v.text,
            notes: v.notes,
            isCustom: v.isCustom,
          })),
          sourceStrideMethod: strideMethod,
          elementName,
          dataFlowName,
          trustBoundaryId: table.displayIdentifier,
          trustBoundaryName: table.trustBoundaryName,
        });
      }
    }
    return references;
  };

  // ── Guard ─────────────────────────────────────────────────────────────────

  if (!activeProject || !generalTabData) return null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <PhaseTabs
        project={activeProject}
        activePhase={activePhase}
        onPhaseChange={handlePhaseChange}
      />

      <div className="flex-1 overflow-y-auto">
        {activePhase === PhaseId.General && (
          <GeneralTab
            data={generalTabData}
            phases={PHASES}
            progressPhaseIds={getProgressPhaseIds(
              activeProject.info?.safetyRelevant ?? false,
            )}
            getStatusIcon={getPhaseStatusIcon}
            getStatusColor={getPhaseStatusColor}
            onUpdate={handleGeneralTabUpdate}
          />
        )}

        {activePhase === PhaseId.Hazard &&
          (activeProject.info?.safetyRelevant ?? false) && (
            <HazardsTab
              project={{
                id: activeProject.id,
                name: activeProject.info?.name || "",
                hazards: activeProject.hazards ?? null,
                phaseStatus: activeProject.phaseStatus,
                assetDataRef: memoizedAssetDataRef,
                lastModified: activeProject.info?.lastModified || "",
              }}
              onUpdate={handleHazardsUpdate}
            />
          )}

        {/* DFDTab: always mounted within a project to prevent iframe reload
            on tab switch. The key={dfdTabProject.id} forces a full remount
            on project switch — ensuring draw.io loads the correct project's
            DFD and doesn't show stale data from a previous project.
            The outer div's display:none hides the tab without unmounting. */}
        {dfdTabProject && (
          <div
            style={{
              display: activePhase === PhaseId.DFD ? "flex" : "none",
              flexDirection: "column",
              height: "100%",
            }}
          >
            <DFDTab
              key={dfdTabProject.id}
              project={dfdTabProject}
              onUpdate={handleDFDUpdate}
              controlInstances={controlInstances}
              securityDrifts={securityDrifts}
            />
          </div>
        )}

        {activePhase === PhaseId.Assets && (
          <AssetsTab
            project={{
              id: activeProject.id,
              name: activeProject.info?.name || "",
              assets: activeProject.assets ?? null,
              phaseStatus: activeProject.phaseStatus,
              dfdAssets: memoizedDFDAssets,
              dfdElements: memoizedDFDElements,
              dfdConnections: memoizedDFDConnections,
              dfdPreviewImage: activeProject.dfd?.thumbnail,
              lastModified: activeProject.info?.lastModified || "",
            }}
            onUpdate={handleAssetsUpdate}
            hazardLinks={memoizedHazardRef}
          />
        )}

        {activePhase === PhaseId.Threats && memoizedDFDContext && (
          <ThreatsTab
            project={{
              id: activeProject.id,
              name: activeProject.info?.name || "",
              threats: activeProject.threats ?? null,
              phaseStatus: activeProject.phaseStatus,
              dfdXml: activeProject.dfd?.xml,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              dfdElements: (activeProject.dfd?.elements || []) as any[],
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              dfdConnections: activeProject.dfd?.connections as any,
              dfdPreviewImage: activeProject.dfd?.thumbnail,
              assetIds: activeProject.assets?.assets?.map((a) => a.id),
              lastModified: activeProject.info?.lastModified || "",
              dfdGraph: memoizedDFDGraphRef,
              assetDataRef: memoizedAssetDataRef,
              dfd: memoizedDFDReference,
            }}
            dfdContext={memoizedDFDContext}
            onUpdate={handleThreatsUpdate}
          />
        )}

        {activePhase === PhaseId.Risk && (
          <RisksTab
            project={{
              id: activeProject.id,
              name: activeProject.info?.name || "",
              risks: activeProject.risks ?? null,
              phaseStatus: activeProject.phaseStatus,
              perElementThreats: extractThreatReferences(
                activeProject.threats,
                "per-element",
              ),
              perInteractionThreats: extractThreatReferences(
                activeProject.threats,
                "per-interaction",
              ),
              perAttackPathThreats: buildAttackPathThreatReferences(
                activeProject.attackTrees,
              ),
              attackTreeLikelihoods: buildAttackTreeLikelihoodReferences(
                activeProject.attackTrees,
              ),
              assetDataRef: memoizedAssetDataRef,
              dfd: memoizedDFDReference,
              dfdPreviewImage: activeProject.dfd?.thumbnail,
              integration: activeProject.integration
                ? {
                    connection: {
                      tool:
                        activeProject.integration.connection?.tool ?? "jira",
                      status:
                        activeProject.integration.connection?.status ??
                        "disconnected",
                      projectName:
                        activeProject.integration.connection?.projectName,
                      credentials: activeProject.integration.connection
                        ?.credentials as any,
                    },
                  }
                : null,
              lastModified: activeProject.info?.lastModified || "",
            }}
            onUpdate={handleRisksUpdate}
            onPhaseComplete={() => setActivePhase(5)}
          />
        )}

        {/* AttackTreeTab always mounted — prevents resize listener accumulation */}
        <div
          style={{
            display: activePhase === PhaseId.AttackTree ? "flex" : "none",
            flexDirection: "column",
            height: "100%",
          }}
        >
          <AttackTreeTab
            key={activeProject.id}
            project={{
              id: activeProject.id,
              name: activeProject.info?.name || "",
              phaseStatus: activeProject.phaseStatus,
              isHighImpact: activeProject.info?.isHighImpact || false,
              attackTrees: activeProject.attackTrees,
              assets: extractAssetReferences(activeProject),
              threats: extractThreatReferencesForAttackTree(activeProject),
              risks: extractRiskReferences(activeProject),
              dfdElements: extractDFDElementReferences(activeProject),
              mitigations: extractMitigationReferences(activeProject),
              dfdPreviewImage: activeProject.dfd?.thumbnail,
              lastModified: activeProject.info?.lastModified || "",
            }}
            onUpdate={handleAttackTreeUpdate}
            onPhaseComplete={() => setActivePhase(6)}
          />
        </div>

        {activePhase === PhaseId.Documentation && (
          <DocTab
            project={transformProjectToDocData(
              activeProject,
              i18n.language === "de" ? "de" : "en",
            )}
            onUpdate={handleDocUpdate}
          />
        )}

        {activePhase === PhaseId.Audit && (
          <AuditTab
            project={{
              id: activeProject.id,
              name: activeProject.info?.name || "",
              filePath: activeProject.filePath,
              audit: activeProject.audit,
              phaseStatus: activeProject.phaseStatus,
              info: activeProject.info,
              hazards: activeProject.hazards,
              dfd: activeProject.dfd,
              assets: activeProject.assets,
              threats: activeProject.threats,
              risks: activeProject.risks,
              attackTrees: activeProject.attackTrees,
              lastModified: activeProject.info?.lastModified || "",
            }}
            onUpdate={handleAuditUpdate}
            onDirtyChange={handleAuditDirtyChange}
            onPhaseComplete={() => console.log("Audit phase completed")}
          />
        )}

        {activePhase === PhaseId.Integration && (
          <IntegrationTab
            data={{ integration: activeProject.integration ?? null }}
            onUpdate={handleIntegrationUpdate}
          />
        )}
      </div>
    </>
  );
};;