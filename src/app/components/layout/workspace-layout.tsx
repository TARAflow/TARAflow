// ==================== WORKSPACE LAYOUT ====================
// Single Responsibility: render the active project's feature tabs
// and coordinate all tab-level updates back to ProjectContext.
//
// What lives here:
//   - Phase tab bar + tab routing
//   - All feature tab handlers (DFD, Assets, Threats, Risks, etc.)
//   - All memoized data transformations for feature tabs
//   - activeProjectRef (stale-closure protection for async handlers)
//
// What does NOT live here:
//   - Project list state (ProjectShell / useProjectManager)
//   - Dialogs (ProjectShell)
//   - Sidebar (ProjectShell)
//
// All project writes go through context.updateProject() — a single,
// stable, ref-based write channel. No stale-closure risk.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  PHASES,
  getPhaseStatusIcon,
  getPhaseStatusColor,
  useToast,
  dfdPreviewPagesOf,
  emptyItemDefinition,
  newAssumption,
  issuedAssumptionNumber,
  withAssumptions,
  type Assumption,
  type CybersecurityConcept,
  emptyCybersecurityConcept,
  type VerificationEntry,
} from "shared";
import { PhaseId, getProgressPhaseIds } from "../../models/phase-types";
import {
  AssetDataReference,
  DFDReference,
  ThreatReference,
  toGraphReference,
} from "shared";

import { useProjectContext } from "../../contexts/project-context";

import { PhaseTabs } from "../navigation/phase-tab-bar";

import { GeneralTab } from "features/overview";
import type { GeneralTabData } from "features/overview";

import {
  HazardsTab,
  type HazardUpdateResult,
  hazardService,
  hazardValidator,
} from "features/hazards";

import {
  DFDTab,
  DFDUpdateResult,
  DFDGraphAnalysisContext,
} from "features/dfd";
import {
  addCreatedAssets,
  analyseLeveled,
  dfdService,
  isLeveled,
  multiprocessGroupsFrom,
  parentLevelFlowsFrom,
  translateFinding,
} from "features/dfd";

import { AssetsTab, AssetUpdateResult } from "features/assets";
import { buildAssetHazardLinks } from "app/utils/build-asset-hazard-links";
import { buildAssumptionUsage, buildItemModelItems } from "app/utils/build-item-model-items";
import { buildMethodologySummary } from "app/utils/build-methodology-summary";
import { buildVerificationChecklist } from "app/utils/build-verification-checklist";
import { notifyProjectMitigations, setProjectMitigations } from "shared/services/project-mitigation-registry";
import { verificationStateHash, verificationStatus } from "app/services/verification-state";
import { phaseIndicators } from "app/utils/phase-indicators";
import { attackPathControlTargets } from "app/utils/attack-path-control-targets";
import { buildAssetDataReference } from "app/utils/build-asset-data-reference";
import { buildAttackPathThreatReferences } from "app/utils/build-attack-path-threat-references";
import {
  buildElementToAssetIds,
  resolveThreatAssetIds,
} from "app/utils/threat-asset-links";
import { buildThreatGoalLinks } from "app/utils/build-threat-goal-links";
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
  type ThreatRiskAttachment,
  type ThreatProjectData,
  projectGenerationDrift,
  NO_DRIFT,
} from "features/threats";

import { RisksTab, RiskUpdateResult } from "features/risks";
import {
  mergeProjectMitigationConflicts,
  mergeProjectMitigationRefs,
  projectMitigationUsage,
} from "app/services/project-mitigation-usage";
import { getMandatoryAssetCriteriaIds } from "features/risks/services/regulation-preset-service";

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
import { IntegrationTab, createTicketAdapter, type IntegrationTabData } from "features/integration";
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

import { applyRegulationFromTags } from "app/services/regulation-preset-orchestrator";
import { buildGeneralTabPatch } from "app/services/general-tab-update";
import {
  getRegulationConflicts,
  regulationPresetFromTags,
  getRequiredImpactScale,
  EMPTY_PROJECT_TAGS,
  getDisabledThreatGenerators,
  getRegulationPreset,
} from "shared";
import { resolveDfdGraph } from "../../utils/resolve-dfd-graph";
import { buildDfdUpdate } from "app/services/dfd-update-patch";
import { buildAssetsUpdate } from "app/services/assets-update-patch";
import {
  AssetDeletionBlockedError,
  collectAssetUsage,
  purgeAssetFromProject,
} from "app/services/asset-deletion";

// ==================== COMPONENT ====================

export const WorkspaceLayout: React.FC = () => {
  const { t, i18n } = useTranslation();
  const toast = useToast();

  const {
    projects,
    activeProject,
    activePhase,
    setActivePhase,
    updateProject,
  } = useProjectContext();

  // ── Stable ref — stale-closure protection ─────────────────────────────────
  // Async handlers (DFD autosave, thumbnail) read the CURRENT activeProject
  // at call time, not the one captured when the callback was created.

  const activeProjectRef = useRef<Project | undefined>(undefined);
  activeProjectRef.current = activeProject;

  // Project mitigation catalog M-C-nnn (custom mitigation catalog CM-2): the
  // one writer of the shared registry. Registered before anything below reads
  // the catalog — a plain assignment, like activeProjectRef above; the
  // subscribers (useMitigationCatalogVersion) are told after the render.
  const customMitigations = activeProject?.threats?.configuration?.customMitigations;
  setProjectMitigations(customMitigations);
  useEffect(() => notifyProjectMitigations(), [customMitigations]);

  // ── Projects-by-id ref — target-project lookup for late-firing handlers ────
  // activeProjectRef always points at whatever is active NOW. That is wrong
  // for a handler that fires AFTER a project switch — most importantly the
  // Assets flush-on-unmount: when AssetsTab (keyed by project id) unmounts on
  // switch, its pending-edit flush calls onUpdate with the OUTGOING project's
  // assets, but by then activeProject is already the incoming one. Resolving
  // the target project by its explicit id (see makeAssetsUpdateHandler) against
  // this ref writes the flushed edit — and mirrors its name/description onto
  // the correct dfd.assets — into the project the edit actually belongs to.
  const projectsRef = useRef<Project[]>(projects);
  projectsRef.current = projects;

  // ── Bidirectional asset sync ──────────────────────────────────────────────
  // REMOVED (see handleAssetsUpdate / handleDFDUpdate below): name and
  // description edits are now mirrored synchronously, in the SAME
  // updateProject call as the edit itself. There is never any ambiguity
  // about which side is "the change" — the handler that receives the edit
  // IS the source of truth for that edit, by construction (Asset-Tab edits
  // arrive via handleAssetsUpdate, DFD-Tab edits via handleDFDUpdate /
  // updateAssetDescription — never both for the same edit).
  //
  // The old design wrote each side independently and used a separate,
  // debounced effect (useBidirectionalAssetSync) to reconcile them
  // afterwards via snapshot-history heuristics ("which side still matches
  // the last known baseline"). That gap between the two writes — and the
  // heuristics needed to guess across it — was the root cause of every
  // description-loss bug found in this investigation (the DrawIO-autosave
  // race, the StrictMode double-invoke issue, and the assets-tab
  // cross-contamination bug). Writing both sides atomically in one
  // updateProject call removes the gap entirely, so there is nothing left
  // to guess and nothing left to race.

  // ── Phase change ──────────────────────────────────────────────────────────

  // "Show in graph" from the asset table (FR-V13): DFD tab, asset graph view.
  const [graphFocusRequest, setGraphFocusRequest] = useState<{
    assetId: string;
  } | null>(null);
  // "Show in table" from the asset graph (FR-V13, way back).
  const [tableHighlightRequest, setTableHighlightRequest] = useState<{
    assetId: string;
  } | null>(null);
  // "Open in Hazard tab" from a hazard's card in the asset graph (G9).
  const [hazardOpenRequest, setHazardOpenRequest] = useState<{
    hazardId: string;
  } | null>(null);

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

      // A "show in table" mark belongs to that one jump; leaving the Assets
      // tab drops it, so a later visit does not mark the row again.
      if (phaseId !== PhaseId.Assets) setTableHighlightRequest(null);
      if (phaseId !== PhaseId.Hazard) setHazardOpenRequest(null);
      setActivePhase(phaseId);
      updateProject({ id: current.id, currentPhase: phaseId });
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
        sourceBindings: activeProject.sourceBindings,
        itemDefinition: activeProject.itemDefinition,
      }
    : undefined;

  const handleGeneralTabUpdate = useCallback(
    (data: GeneralTabData) => {
      const current = activeProjectRef.current;
      if (!current) return;
      updateProject(buildGeneralTabPatch(current, data));
      const conflicts = getRegulationConflicts(data.info.tags);
      if (conflicts.length > 0) toast.warning(conflicts[0].message);
    },
    [updateProject, toast],
  );

  // Trust boundary form → a new Item Definition assumption (A-3). Synchronous:
  // the form links the returned id right away.
  const handleCreateAssumption = useCallback(
    (text: string): Assumption => {
      const current = activeProjectRef.current;
      const def = current?.itemDefinition ?? emptyItemDefinition();
      const created = newAssumption(def.assumptions, text, issuedAssumptionNumber(def));
      if (current) {
        updateProject({
          id: current.id,
          itemDefinition: withAssumptions(def, [...def.assumptions, created]),
        });
      }
      return created;
    },
    [updateProject],
  );

  // Audit tab → TARA verification entries (ISO 21434 plan Phase 4, decision 25).
  const handleVerificationsChange = useCallback(
    (verifications: VerificationEntry[]) => {
      const current = activeProjectRef.current;
      if (!current) return;
      const concept = current.cybersecurityConcept ?? emptyCybersecurityConcept();
      updateProject({ id: current.id, cybersecurityConcept: { ...concept, verifications } });
    },
    [updateProject],
  );

  // Risk dialog → goals and claims (ISO 21434 plan Phase 4, decision 25).
  const handleConceptChange = useCallback(
    (cybersecurityConcept: CybersecurityConcept) => {
      const current = activeProjectRef.current;
      if (current) updateProject({ id: current.id, cybersecurityConcept });
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
  // Invalidate dfdTabProject when the canonical asset registry (ids/names)
  // changes, so DFD validation always sees the current asset set.
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
      knownAssetsKey,
    ],
  );

  const handleDFDUpdate = useCallback(
    async (updates: DFDUpdateResult) => {
      // Read via ref — always current, never stale
      const current = activeProjectRef.current;
      if (!current) return;
      const { patch, rejectedA2AOps } = buildDfdUpdate(current, updates);
      if (rejectedA2AOps.length > 0) {
        // The dialog prevents these; reaching here means stale data (e.g. an
        // asset deleted meanwhile) or an import with relations the rules no
        // longer allow.
        toast.warning(
          t("assets.relations.a2a.rejected", {
            defaultValue:
              "{{count}} asset relation(s) were not applied: {{reasons}}",
            count: rejectedA2AOps.length,
            reasons: [...new Set(rejectedA2AOps.map((r) => r.reason))].join(", "),
          }),
        );
      }
      await updateProject(patch);
    },

    // Stable — reads current project via ref, never via closure
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [updateProject, toast, t],
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
          mapDFDAssetsToAssetFeature(
            dfd.assets,
            dfd.elements ?? [],
            dfd.connections ?? [],
          ),
          mapDFDElementsToAssetFeature(dfd.elements ?? []),
          mapDFDConnectionsToAssetFeature(dfd.connections ?? []),
        );
        assets = assetData;
      }

      await updateProject({
        id: current.id,
        hazards: updates.hazards,
        dfd,
        assets, // ← synchronisierter Assets-Store
        phaseStatus: { ...current.phaseStatus, [PhaseId.Hazard]: status },
      });
    },
    [updateProject],
  );

  // ── Assets tab ────────────────────────────────────────────────────────────

  // Bound to a specific project id, NOT to "whatever is active now". AssetsTab
  // is keyed by project id, so each mounted instance owns a handler pinned to
  // its own project. This matters for the flush-on-unmount edit, which fires
  // just after the active project has already switched: we must resolve the
  // target — and its dfd — by the pinned id, or the outgoing project's assets
  // would be written into (and mirrored onto) the incoming project.
  const makeAssetsUpdateHandler = useCallback(
    (projectId: string) => async (updates: AssetUpdateResult) => {
      const current = projectsRef.current.find((p) => p.id === projectId);
      if (!current) return;

      // Mirror name/description edits from the Asset-Tab onto dfd.assets in
      // THIS SAME updateProject call (the Asset-Tab is the known source of
      // the edit — see the note above on the former bidirectional sync).
      // Asset links travel only as operations (asset import, AR-5).
      const { patch, rejectedA2AOps } = buildAssetsUpdate(current, updates);
      if (rejectedA2AOps.length > 0) {
        toast.warning(
          t("assets.relations.a2a.rejected", {
            defaultValue:
              "{{count}} asset relation(s) were not applied: {{reasons}}",
            count: rejectedA2AOps.length,
            reasons: [...new Set(rejectedA2AOps.map((r) => r.reason))].join(", "),
          }),
        );
      }
      await updateProject(patch);
    },
    [updateProject, toast, t],
  );

  // ── Asset deletion (Asset tab) ────────────────────────────────────────────
  // One project-wide operation: asset store, DFD (record + all relations),
  // hazard edges, risks — then threats re-derive from the rebuilt graph. The
  // confirm dialog shows collectAssetUsage() first and blocks while attack
  // trees are anchored on the asset.
  const assetUsageLookup = useCallback((assetId: string) => {
    const current = activeProjectRef.current;
    return current
      ? collectAssetUsage(current, assetId)
      : {
          dfdRelations: 0,
          assetToAssetRelations: 0,
          hazardRelations: 0,
          blockingAttackTrees: [],
        };
  }, []);

  // Leveled DFD (5k): threats referring to a DFD element / flow (tfId), for
  // the question when a linked definition is lost.
  const threatCountLookup = useCallback((tfId: string) => {
    const threats = activeProjectRef.current?.threats;
    if (!threats) return 0;
    let count = 0;
    for (const table of [...threats.perElementTables, ...threats.perInteractionTables]) {
      for (const threat of table.threats) {
        if (
          threat.linkedElement?.elementId === tfId ||
          threat.dataFlow?.connectionId === tfId
        ) {
          count++;
        }
      }
    }
    return count;
  }, []);

  const makeAssetDeleteHandler = useCallback(
    (projectId: string) => async (assetId: string) => {
      const current = projectsRef.current.find((p) => p.id === projectId);
      if (!current) return;

      let purged;
      try {
        purged = purgeAssetFromProject(current, assetId);
      } catch (err) {
        if (err instanceof AssetDeletionBlockedError) return; // dialog blocks this
        throw err;
      }

      const assetDataRef = purged.assets
        ? buildAssetDataReference(
            purged.assets.assets,
            buildAssetHazardLinks(purged.hazards ?? null),
            purged.assets.configuration?.impactScale ?? "4-level",
          )
        : undefined;
      const graph = resolveDfdGraph(purged.dfd as Project["dfd"]);
      const threats = graph
        ? syncThreatsWithGraph(
            current.threats ?? null,
            toGraphReference(graph),
            assetDataRef,
            regulationPresetFromTags(
              current.info?.tags ?? EMPTY_PROJECT_TAGS,
            ) === "iso-21434",
          )
        : current.threats;

      await updateProject({ id: projectId, ...purged, threats });
    },
    [updateProject],
  );

  // ── Threats tab ───────────────────────────────────────────────────────────

  const handleThreatsUpdate = useCallback(
    async (updates: ThreatUpdateResult) => {
      const current = activeProjectRef.current;
      if (!current) return;
      await updateProject({
        id: current.id,
        threats: updates.threats,
        phaseStatus: updates.phaseStatus,
      });
    },
    [updateProject],
  );

  // The issue tracker's adapter for the Risk tab (adapters design §4.3) —
  // derived from the stored connection; the main process holds the token.
  const integrationConnection = activeProject?.integration?.connection ?? null;
  const ticketPort = useMemo(() => createTicketAdapter(integrationConnection), [integrationConnection]);

  // Project mitigations M-C-nnn (custom mitigation catalog CM-3): usage and
  // merge span threats, risks and attack trees.
  const projectMitigationRefs = useMemo(
    () => ({
      usage: (id: string) => {
        const current = activeProjectRef.current;
        return current
          ? projectMitigationUsage(current, id)
          : { threats: [], risks: [], attackTrees: [] };
      },
      mergeConflicts: (fromId: string, intoId: string) => {
        const current = activeProjectRef.current;
        return current ? mergeProjectMitigationConflicts(current, fromId, intoId) : [];
      },
      merge: (fromId: string, intoId: string) => {
        const current = activeProjectRef.current;
        if (!current || mergeProjectMitigationConflicts(current, fromId, intoId).length > 0) return;
        const merged = mergeProjectMitigationRefs(current, fromId, intoId);
        void updateProject({ id: current.id, ...merged });
      },
    }),
    [updateProject],
  );

  // ── Risks tab ─────────────────────────────────────────────────────────────

  const handleRisksUpdate = useCallback(
    async (updates: RiskUpdateResult) => {
      const current = activeProjectRef.current;
      if (!current) return;
      const withRisks: Project = { ...current, risks: updates.risks };
      const { project } = applyRegulationFromTags(
        withRisks,
        current.info.windowOfOpportunity,
      );
      await updateProject({
        id: current.id,
        risks: project.risks,
        phaseStatus: updates.phaseStatus,
        settings: project.settings,
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
        id: current.id,
        attackTrees: updates.attackTrees,
        phaseStatus: updates.phaseStatus,
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
        id: current.id,
        audit: updates.audit,
        phaseStatus: updates.phaseStatus,
      });
    },
    [updateProject],
  );

  const handleAuditDirtyChange = useCallback(
    (isDirty: boolean) => {
      const current = activeProjectRef.current;
      if (!current) return;
      updateProject({ id: current.id, hasUnsavedChanges: isDirty });
    },
    [updateProject],
  );

  // ── Documentation tab ─────────────────────────────────────────────────────

  const handleDocUpdate = useCallback(
    (updates: DocUpdateResult) => {
      const current = activeProjectRef.current;
      if (!current) return;
      updateProject({
        id: current.id,
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
        id: current.id,
        integration: data.integration,
      });
    },
    [updateProject],
  );

  // ── Memoized DFD data ─────────────────────────────────────────────────────

  const memoizedDFDAssets = useMemo(
    () =>
      activeProject?.dfd?.assets
        ? mapDFDAssetsToAssetFeature(
            activeProject.dfd.assets,
            activeProject.dfd.elements ?? [],
            activeProject.dfd.connections ?? [],
          )
        : undefined,
    // Must also depend on elements/connections: linkedElements (incl.
    // safety) is rebuilt from their assetRelations, so a safety-only edit
    // on an element/connection — with the assets array reference
    // unchanged — must still invalidate this memo.
    [
      activeProject?.dfd?.assets,
      activeProject?.dfd?.elements,
      activeProject?.dfd?.connections,
    ],
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

  // Stored graph, or rebuilt from the persisted DFD when missing — the
  // Threats tab is only rendered when a DFD context exists (see
  // resolveDfdGraph for why this must not depend on a side-effect save).
  const activeDfdGraph = useMemo(
    () => resolveDfdGraph(activeProject?.dfd),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      activeProject?.dfd?.graph,
      activeProject?.dfd?.elements,
      activeProject?.dfd?.connections,
      activeProject?.dfd?.assets,
    ],
  );

  const memoizedDFDGraphRef = useMemo(
    () => (activeDfdGraph ? toReferenceGraph(activeDfdGraph) : undefined),
    [activeDfdGraph],
  );

  // Leveled DFD: one shared analysis (parse + effective model) for the
  // parent-level flows (5j) and the table groups (Phase 6, D20).
  const activeDfd = activeProject?.dfd;
  const leveledAnalysis = useMemo(
    () =>
      activeDfd?.xml && activeDfd.pages && activeDfd.pages.length > 1 && isLeveled(activeDfd.xml)
        ? analyseLeveled({
            xml: activeDfd.xml,
            pages: activeDfd.pages,
            elements: activeDfd.elements ?? [],
            connections: activeDfd.connections ?? [],
          })
        : null,
    [activeDfd?.xml, activeDfd?.pages, activeDfd?.elements, activeDfd?.connections],
  );
  const memoizedParentLevelFlows = useMemo(
    () => (leveledAnalysis ? parentLevelFlowsFrom(leveledAnalysis) : []),
    [leveledAnalysis],
  );
  const memoizedTableGroups = useMemo(
    () => (leveledAnalysis ? multiprocessGroupsFrom(leveledAnalysis) : undefined),
    [leveledAnalysis],
  );

  const memoizedDFDContext = useMemo(
    () => (activeDfdGraph ? new DFDGraphAnalysisContext(activeDfdGraph) : null),
    [activeDfdGraph],
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

  // Hazard Items and their edges for the asset graph (FR-V11, read-only); a
  // stable object so the graph is rebuilt only when the hazard data changes.
  const memoizedGraphHazards = useMemo(
    () =>
      activeProject?.hazards
        ? { items: activeProject.hazards.hazards, relations: activeProject.hazards.relations }
        : null,
    [activeProject?.hazards],
  );

  // The asset registry for the asset graph: the manual assets (e.g. hazard
  // protection targets) are not in the dfd.assets mirror.
  const memoizedGraphRegistry = useMemo(
    () =>
      activeProject?.assets
        ? {
            assets: activeProject.assets.assets.map((a) => ({
              id: a.id,
              displayId: a.displayId,
              name: a.name,
              assetGroup: a.assetGroup,
              ...(a.properties?.protectionNeed ? { protectionNeed: String(a.properties.protectionNeed) } : {}),
            })),
            relations: activeProject.assets.relations ?? [],
          }
        : null,
    [activeProject?.assets],
  );

  // What the Item Definition can link to (Overview → Definition, A-2).
  const memoizedItemModelItems = useMemo(
    () => (activeProject ? buildItemModelItems(activeProject) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeProject?.dfd, activeProject?.assets],
  );
  // TARA verification (plan Phase 4, decision 25): the hash of the current
  // analysis content, the checklist of a new entry, and — under iso-21434 —
  // the status the Overview shows.
  const verificationHash = useMemo(
    () => (activeProject ? verificationStateHash(activeProject) : ""),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      activeProject?.info?.description,
      activeProject?.itemDefinition,
      activeProject?.hazards,
      activeProject?.dfd,
      activeProject?.assets,
      activeProject?.threats,
      activeProject?.attackTrees,
      activeProject?.risks,
      activeProject?.cybersecurityConcept,
    ],
  );
  const memoizedVerificationInput = useMemo(
    () =>
      activeProject
        ? {
            currentStateHash: verificationHash,
            checklist: buildVerificationChecklist(activeProject, new Date().toISOString().slice(0, 10)),
            ...(activeProject.info?.version ? { projectVersion: activeProject.info.version } : {}),
          }
        : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [verificationHash, activeProject?.info?.version, activeProject?.info?.tags],
  );
  const memoizedVerificationStatus = useMemo(
    () =>
      activeProject &&
      regulationPresetFromTags(activeProject.info?.tags ?? EMPTY_PROJECT_TAGS) === "iso-21434"
        ? verificationStatus(
            activeProject.cybersecurityConcept?.verifications,
            verificationHash,
            new Date().toISOString().slice(0, 10),
            activeProject.audit?.config?.verificationMaxAgeDays,
          )
        : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [verificationHash, activeProject?.cybersecurityConcept?.verifications, activeProject?.info?.tags, activeProject?.audit?.config?.verificationMaxAgeDays],
  );

  // Methodology sub-tab of the Overview (A-4): the record, read-only.
  const memoizedMethodologySummary = useMemo(
    () => (activeProject ? buildMethodologySummary(activeProject) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeProject?.info?.tags, activeProject?.assets?.configuration, activeProject?.risks?.configuration, activeProject?.attackTrees?.configuration],
  );
  const memoizedAssumptionUsage = useMemo(
    () => (activeProject ? buildAssumptionUsage(activeProject) : {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeProject?.dfd],
  );

  // Label vocabulary of the preset: under iso-21434 person-harm severities
  // show their ISO 26262 class (S0–S3, conformance plan 1H-S).
  const labelVocabulary: "default" | "iso-21434" =
    regulationPresetFromTags(activeProject?.info?.tags ?? EMPTY_PROJECT_TAGS) === "iso-21434"
      ? "iso-21434"
      : "default";

  // Hazard → asset projection (§6): endangeredBy / contributesTo per asset.
  // Read-only; the assets feature never imports features/hazards.
  const memoizedHazardRef = useMemo(
    () => buildAssetHazardLinks(activeProject?.hazards ?? null),
    [activeProject?.hazards],
  );

  // Risk work per threat id — lets the Threats tab warn before an action would
  // drop a threat that carries a risk assessment (threats ⊥ risks: built here).
  const memoizedRiskAttachments = useMemo(() => {
    const out: Record<string, ThreatRiskAttachment> = {};
    for (const r of activeProject?.risks?.risks ?? []) {
      out[r.threatId] = { mitigationCount: r.selectedMitigations?.length ?? 0 };
    }
    return out;
  }, [activeProject?.risks?.risks]);

  // Threats → linked assets, for the threat ↔ goal cross-checks of the asset
  // tab (assets ⊥ threats: projected here). Same generators and link rule as
  // the risk register.
  const memoizedThreatGoalLinks = useMemo(
    () =>
      buildThreatGoalLinks({
        threats: activeProject?.threats,
        assets: activeProject?.assets?.assets,
        dfdElements: (activeProject?.dfd as any)?.elements,
        attackTrees: activeProject?.attackTrees,
        disabledStrideMethods: getDisabledThreatGenerators(
          regulationPresetFromTags(activeProject?.info?.tags ?? EMPTY_PROJECT_TAGS),
        ),
      }),
    [
      activeProject?.threats,
      activeProject?.assets?.assets,
      activeProject?.dfd,
      activeProject?.attackTrees,
      activeProject?.info?.tags,
    ],
  );

  const memoizedAssetDataRef = useMemo((): AssetDataReference | undefined => {
    const assets = activeProject?.assets?.assets;
    if (!assets || assets.length === 0) return undefined;
    return buildAssetDataReference(
      assets,
      memoizedHazardRef,
      activeProject?.assets?.configuration?.impactScale ?? "4-level",
      activeProject?.assets?.configuration?.impactCriteria,
    );
  }, [
    activeProject?.assets?.assets,
    activeProject?.assets?.configuration?.impactScale,
    activeProject?.assets?.configuration?.impactCriteria,
    memoizedHazardRef,
  ]);

  // ── Threat generation drift (phase tab badge) ────────────────────────────
  // Same check as the Threats tab banner, evaluated here so the badge appears
  // right after e.g. a security-goal change in the Asset tab. Runs the threat
  // generator without writing — cheap for typical DFD sizes; memoized on the
  // inputs the generator reads.
  const threatDriftCounts = useMemo(() => {
    if (!activeProject?.threats || !memoizedDFDContext) return undefined;
    const driftProject = {
      id: activeProject.id,
      name: activeProject.info?.name || "",
      threats: activeProject.threats,
      phaseStatus: activeProject.phaseStatus,
      dfdElements: activeProject.dfd?.elements ?? [],
      dfdConnections: activeProject.dfd?.connections ?? [],
      dfdGraph: memoizedDFDGraphRef,
      assetDataRef: memoizedAssetDataRef,
      dfd: memoizedDFDReference,
      info: { tags: activeProject.info?.tags ?? EMPTY_PROJECT_TAGS },
      lastModified: "",
    } as unknown as ThreatProjectData;
    let drift = NO_DRIFT;
    try {
      drift = projectGenerationDrift(driftProject, memoizedDFDContext);
    } catch {
      // A badge must never break the workspace; the tab shows details.
    }
    return { obsolete: drift.obsolete.length, added: drift.addedCount };
  }, [
    activeProject?.threats,
    activeProject?.dfd?.elements,
    activeProject?.dfd?.connections,
    activeProject?.info?.tags,
    memoizedDFDContext,
    memoizedDFDGraphRef,
    memoizedAssetDataRef,
    memoizedDFDReference,
  ]);

  // ── Phase indicators (tabs + Overview phase progress) ─────────────────────
  // One computation keyed by PhaseId; the DFD part validates the stored
  // diagram now instead of trusting the validation stored in the file.
  const dfdSavedValidation = useMemo(
    () => (dfdTabProject ? dfdService.validateSavedState(dfdTabProject) : null),
    [dfdTabProject],
  );
  const memoizedPhaseIndicators = useMemo(
    () =>
      activeProject
        ? phaseIndicators({
            phaseStatus: activeProject.phaseStatus,
            info: activeProject.info,
            dfdValidation: dfdSavedValidation,
            dfdStatus: dfdSavedValidation ? dfdService.phaseStatusOf(dfdSavedValidation) : undefined,
            // The Hazard tab's validation, only where the phase is shown.
            hazardValidation:
              activeProject.info?.safetyRelevant && activeProject.hazards?.hazards.length
                ? hazardValidator.validate(activeProject.hazards, memoizedAssetDataRef?.assets)
                : null,
            threatDrift: threatDriftCounts,
            t,
          })
        : null,
    [activeProject, dfdSavedValidation, threatDriftCounts, memoizedAssetDataRef, t],
  );

  // ── Control instances + security drift ───────────────────────────────────

  // getAllMitigations() is a module-level singleton — memoize to ensure
  // stable reference across renders so useControlInstanceDerivation
  // does not re-run unnecessarily.
  const mitigationCatalog = useMemo(
    () => getAllMitigations(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [customMitigations],
  );

  // Attack-path risks reach the closed loop through their tree's anchor
  // (closed-loop review CL-3).
  const anchorTargets = useMemo(
    () =>
      attackPathControlTargets(
        activeProject?.attackTrees,
        activeProject?.assets?.assets,
        activeProject?.dfd,
      ),
    [activeProject?.attackTrees, activeProject?.assets?.assets, activeProject?.dfd],
  );

  const controlInstances = useControlInstanceDerivation(
    activeProject?.threats ?? null,
    activeProject?.risks ?? null,
    activeProject?.dfd ?? null,
    mitigationCatalog,
    anchorTargets,
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

    const elementToAssetIds = buildElementToAssetIds(
      activeProject?.assets?.assets,
      (activeProject?.dfd as any)?.elements,
    );

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

        const linkedAssetIds = resolveThreatAssetIds(threat, elementToAssetIds);

        references.push({
          id: threat.id,
          displayId: threat.displayId,
          strideCategory: threat.strideCategory,
          threatDescription: threat.threatDescription,
          attackDescription: threat.attackDescription,
          causeDescription: threat.causeDescription,
          linkedAssetIds,
          relevance: threat.relevance ?? "unrated",
          ...(threat.review ? { review: threat.review } : {}),
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
          // EL-anchor resolution (§11.1) reads the DFD's exposureLevel off the
          // threat's raw anchor: per-element (incl. a DataFlow-typed element,
          // STRIDE_PER_ELEMENT_TYPE.DataFlow = T,I,D) via linkedElement, and
          // per-interaction via dataFlow. These must survive onto the
          // ThreatReference or applyExposureLevelToFactorRatings has no anchor
          // to resolve and EN 50742 EL silently stays 0 in the Risk tab.
          linkedElement: threat.linkedElement ?? null,
          dataFlow: threat.dataFlow ?? null,
          // Table group of a flow between multiprocesses (D20): the attacked side.
          ...(threat.interactionContext?.victimRole
            ? { interactionContext: { victimRole: threat.interactionContext.victimRole } }
            : {}),
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
        threatDrift={threatDriftCounts}
        indicators={memoizedPhaseIndicators ?? undefined}
      />

      <div className="flex-1 overflow-y-auto">
        {activePhase === PhaseId.General && (
          <GeneralTab
            data={generalTabData}
            phases={PHASES}
            progressPhaseIds={getProgressPhaseIds(
              activeProject.info?.safetyRelevant ?? false,
              regulationPresetFromTags(
                activeProject.info?.tags ?? EMPTY_PROJECT_TAGS,
              ) === "iso-21434",
            )}
            getStatusIcon={getPhaseStatusIcon}
            getStatusColor={getPhaseStatusColor}
            phaseIndicators={memoizedPhaseIndicators ?? undefined}
            onOpenPhase={handlePhaseChange}
            onUpdate={handleGeneralTabUpdate}
            projectId={activeProject.id}
            modelItems={memoizedItemModelItems}
            assumptionUsage={memoizedAssumptionUsage}
            methodology={memoizedMethodologySummary}
            verification={memoizedVerificationStatus}
            onOpenAuditTab={() => handlePhaseChange(PhaseId.Audit)}
            onOpenRiskTab={() => handlePhaseChange(PhaseId.Risk)}
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
                labelVocabulary,
              }}
              onUpdate={handleHazardsUpdate}
              openRequest={hazardOpenRequest}
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
              assetUsage={assetUsageLookup}
              threatCountOf={threatCountLookup}
              graphFocusRequest={graphFocusRequest}
              hazards={memoizedGraphHazards}
              assetRegistry={memoizedGraphRegistry}
              labelVocabulary={labelVocabulary}
              assumptions={activeProject.itemDefinition?.assumptions}
              onCreateAssumption={handleCreateAssumption}
              onShowInTable={(assetId) => {
                setTableHighlightRequest({ assetId });
                handlePhaseChange(PhaseId.Assets);
              }}
              onOpenHazard={
                activeProject.info?.safetyRelevant
                  ? (hazardId) => {
                      handlePhaseChange(PhaseId.Hazard);
                      setHazardOpenRequest({ hazardId });
                    }
                  : undefined
              }
              controlInstances={controlInstances}
              securityDrifts={securityDrifts}
            />
          </div>
        )}

        {activePhase === PhaseId.Assets && (
          <AssetsTab
            key={activeProject.id}
            project={{
              id: activeProject.id,
              name: activeProject.info?.name || "",
              assets: activeProject.assets ?? null,
              phaseStatus: activeProject.phaseStatus,
              dfdAssets: memoizedDFDAssets,
              dfdElements: memoizedDFDElements,
              dfdConnections: memoizedDFDConnections,
              dfdPreviewImage: activeProject.dfd?.thumbnail,
              dfdPreviewPages: dfdPreviewPagesOf(activeProject.dfd),
              dfdTableGroups: memoizedTableGroups,
              lastModified: activeProject.info?.lastModified || "",
              damageScenarioMode:
                regulationPresetFromTags(
                  activeProject.info?.tags ?? EMPTY_PROJECT_TAGS,
                ) === "iso-21434",
              mandatoryImpactCriteriaIds: getMandatoryAssetCriteriaIds(
                regulationPresetFromTags(
                  activeProject.info?.tags ?? EMPTY_PROJECT_TAGS,
                ),
              ),
              requiredImpactScale: getRequiredImpactScale(
                regulationPresetFromTags(
                  activeProject.info?.tags ?? EMPTY_PROJECT_TAGS,
                ),
              ),
              impactLabelVocabulary:
                regulationPresetFromTags(
                  activeProject.info?.tags ?? EMPTY_PROJECT_TAGS,
                ) === "iso-21434"
                  ? "iso-21434"
                  : "default",
            }}
            onUpdate={makeAssetsUpdateHandler(activeProject.id)}
            onDeleteAsset={makeAssetDeleteHandler(activeProject.id)}
            tableHighlightRequest={tableHighlightRequest}
            onShowInGraph={(assetId) => {
              setGraphFocusRequest({ assetId });
              handlePhaseChange(PhaseId.DFD);
            }}
            assetUsage={assetUsageLookup}
            hazardLinks={memoizedHazardRef}
            threatLinks={memoizedThreatGoalLinks}
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
              dfdPageIds: activeProject.dfd?.pages?.map((p) => p.pageId),
              dfdParentLevelFlows: memoizedParentLevelFlows,
              dfdTableGroups: memoizedTableGroups,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              dfdElements: (activeProject.dfd?.elements || []) as any[],
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              dfdConnections: activeProject.dfd?.connections as any,
              dfdPreviewImage: activeProject.dfd?.thumbnail,
              dfdPreviewPages: dfdPreviewPagesOf(activeProject.dfd),
              assetIds: activeProject.assets?.assets?.map((a) => a.id),
              lastModified: activeProject.info?.lastModified || "",
              dfdGraph: memoizedDFDGraphRef,
              assetDataRef: memoizedAssetDataRef,
              dfd: memoizedDFDReference,
              riskAttachments: memoizedRiskAttachments,
              info: {
                tags: activeProject.info?.tags ?? EMPTY_PROJECT_TAGS,
              },
            }}
            dfdContext={memoizedDFDContext}
            onUpdate={handleThreatsUpdate}
            projectMitigationRefs={projectMitigationRefs}
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
                // ISO 21434: a relevant path reaches the Risk tab without a
                // mitigation (risk is assessed before treatment is decided).
                regulationPresetFromTags(
                  activeProject.info?.tags ?? EMPTY_PROJECT_TAGS,
                ) !== "iso-21434",
                // Controls are proposed only when their context fits the
                // project (mitigation catalog design D4).
                activeProject.info?.tags ?? EMPTY_PROJECT_TAGS,
              ).map((ref) => ({
                ...ref,
                // Where the path's controls go, for the coverage badge
                // (closed-loop review CL-4).
                controlTargets: anchorTargets(ref.id),
              })),
              attackTreeLikelihoods: buildAttackTreeLikelihoodReferences(
                activeProject.attackTrees,
                activeProject.risks?.configuration?.scale,
              ),
              recommendedImpactAggregation: getRegulationPreset(
                regulationPresetFromTags(
                  activeProject.info?.tags ?? EMPTY_PROJECT_TAGS,
                ),
              ).impactAggregation,
              disabledStrideMethods: getDisabledThreatGenerators(
                regulationPresetFromTags(
                  activeProject.info?.tags ?? EMPTY_PROJECT_TAGS,
                ),
              ),
              isoMode:
                regulationPresetFromTags(
                  activeProject.info?.tags ?? EMPTY_PROJECT_TAGS,
                ) === "iso-21434",
              assetDataRef: memoizedAssetDataRef,
              dfd: memoizedDFDReference,
              dfdPreviewImage: activeProject.dfd?.thumbnail,
              dfdPreviewPages: dfdPreviewPagesOf(activeProject.dfd),
              dfdTableGroups: memoizedTableGroups,
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
                      issueTypes: activeProject.integration.connection?.issueTypes,
                      credentials: activeProject.integration.connection
                        ?.credentials as any,
                    },
                  }
                : null,
              cybersecurityConcept: activeProject.cybersecurityConcept,
              assumptions: activeProject.itemDefinition?.assumptions,
              lastModified: activeProject.info?.lastModified || "",
            }}
            ticketPort={ticketPort}
            onUpdate={handleRisksUpdate}
            onConceptChange={handleConceptChange}
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
              isoMode:
                regulationPresetFromTags(
                  activeProject.info?.tags ?? EMPTY_PROJECT_TAGS,
                ) === "iso-21434",
              attackTrees: activeProject.attackTrees,
              assets: extractAssetReferences(activeProject),
              threats: extractThreatReferencesForAttackTree(activeProject),
              risks: extractRiskReferences(activeProject),
              dfdElements: extractDFDElementReferences(activeProject),
              mitigations: extractMitigationReferences(activeProject),
              dfdPreviewImage: activeProject.dfd?.thumbnail,
              dfdPreviewPages: dfdPreviewPagesOf(activeProject.dfd),
              lastModified: activeProject.info?.lastModified || "",
            }}
            onUpdate={handleAttackTreeUpdate}
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
              itemDefinition: activeProject.itemDefinition,
              cybersecurityConcept: activeProject.cybersecurityConcept,
              verification: memoizedVerificationInput,
              lastModified: activeProject.info?.lastModified || "",
            }}
            onUpdate={handleAuditUpdate}
            onVerificationsChange={handleVerificationsChange}
            onDirtyChange={handleAuditDirtyChange}
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
}
