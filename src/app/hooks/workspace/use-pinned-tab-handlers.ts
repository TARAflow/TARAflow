// ==================== PINNED TAB HANDLERS ====================
// The writing handlers of the feature tabs, split out of
// workspace-layout.tsx (MT-1). Each handler is pinned to the project it was
// made for: a save that lands after a project switch — the flush when a tab
// (keyed by project id) unmounts, a network round-trip, a commit — belongs
// to the project it was made in, never to whatever is active by then. The
// target project is resolved by id against projectsRef at call time.
//
// Also the two lookups the DFD / Assets tabs call on demand; they read the
// project that is active at call time (activeProjectRef).

import { useCallback, useMemo, type MutableRefObject } from "react";
import type { TFunction } from "i18next";
import {
  emptyCybersecurityConcept,
  toGraphReference,
  getRegulationConflicts,
  regulationPresetFromTags,
  EMPTY_PROJECT_TAGS,
  type useToast,
  type VerificationEntry,
} from "shared";
import { hazardService, type HazardUpdateResult } from "features/hazards";
import { addCreatedAssets } from "features/dfd";
import type { AssetUpdateResult } from "features/assets";
import { syncThreatsWithGraph } from "features/threats";
import type { RiskUpdateResult } from "features/risks";
import type { AttackTreeUpdateResult } from "features/attacktree";
import type { AuditUpdateResult } from "features/audit/models/audit-types";
import { syncFromDFD } from "features/assets/services/asset-sync-service";

import { PhaseId } from "../../models/phase-types";
import type { Project } from "../../models/project-types";
import {
  mapDFDAssetsToAssetFeature,
  mapDFDConnectionsToAssetFeature,
  mapDFDElementsToAssetFeature,
} from "../../utils/dfd-to-asset-mapper";
import { resolveDfdGraph } from "../../utils/resolve-dfd-graph";
import { buildAssetDataReference } from "../../utils/build-asset-data-reference";
import { buildAssetHazardLinks } from "../../utils/build-asset-hazard-links";
import { rememberLocalSettings } from "../../services/local-user-settings";
import { applyRegulationFromTags } from "../../services/regulation-preset-orchestrator";
import { buildGeneralTabPatch } from "../../services/general-tab-update";
import { buildAssetsUpdate } from "../../services/assets-update-patch";
import {
  AssetDeletionBlockedError,
  collectAssetUsage,
  purgeAssetFromProject,
} from "../../services/asset-deletion";
import { useProjectUpdateHandlers } from "../use-project-update-handlers";
import type { GeneralTabData } from "features/overview";

type Toast = ReturnType<typeof useToast>;
type UpdateProject = (patch: Partial<Project> & { id: string }) => Promise<void>;

export interface PinnedTabHandlersInput {
  /** The active project's id ("" without one) — handlers are pinned to it. */
  projectId: string;
  activeProjectRef: MutableRefObject<Project | undefined>;
  projectsRef: MutableRefObject<Project[]>;
  updateProject: UpdateProject;
  toast: Toast;
  t: TFunction;
}

export function usePinnedTabHandlers({
  projectId,
  activeProjectRef,
  projectsRef,
  updateProject,
  toast,
  t,
}: PinnedTabHandlersInput) {
  const findProject = useCallback(
    (id: string) => projectsRef.current.find((p) => p.id === id),
    [projectsRef],
  );

  // ── General tab ───────────────────────────────────────────────────────────
  // A source binding resolve / drift check finishes after a network
  // round-trip and may land after a project switch; resolving "whatever is
  // active now" wrote the outgoing project's info, settings and Definition
  // into the incoming project.
  const makeGeneralTabUpdateHandler = useCallback(
    (id: string) => (data: GeneralTabData) => {
      const current = findProject(id);
      if (!current) return;
      updateProject(buildGeneralTabPatch(current, data));
      const conflicts = getRegulationConflicts(data.info.tags);
      if (conflicts.length > 0) toast.warning(conflicts[0].message);
    },
    [findProject, updateProject, toast],
  );
  const handleGeneralTabUpdate = useMemo(
    () => makeGeneralTabUpdateHandler(projectId),
    [projectId, makeGeneralTabUpdateHandler],
  );

  // Audit tab → TARA verification entries (ISO 21434 plan Phase 4, decision 25).
  const makeVerificationsChangeHandler = useCallback(
    (id: string) => (verifications: VerificationEntry[]) => {
      const current = findProject(id);
      if (!current) return;
      const concept = current.cybersecurityConcept ?? emptyCybersecurityConcept();
      updateProject({ id: current.id, cybersecurityConcept: { ...concept, verifications } });
    },
    [findProject, updateProject],
  );

  // ── Shared writers: DFD, threats, assumptions, compliance, concept,
  //    documentation, integration, project mitigations (FX-8) ──────────────
  const handleRejectedRelations = useCallback(
    (rejected: readonly { reason: string }[]) => {
      // The dialog prevents these; reaching here means stale data (e.g. an
      // asset deleted meanwhile) or an import with relations the rules no
      // longer allow.
      toast.warning(
        t("assets.relations.a2a.rejected", {
          defaultValue: "{{count}} asset relation(s) were not applied: {{reasons}}",
          count: rejected.length,
          reasons: [...new Set(rejected.map((r) => r.reason))].join(", "),
        }),
      );
    },
    [toast, t],
  );
  const shared = useProjectUpdateHandlers({
    projectId,
    projectsRef,
    updateProject,
    onRejectedRelations: handleRejectedRelations,
  });

  // ── Hazard tab ────────────────────────────────────────────────────────────
  const makeHazardsUpdateHandler = useCallback(
    (id: string) => async (updates: HazardUpdateResult) => {
      const current = findProject(id);
      if (!current) return;
      const status = hazardService.deriveHazardPhaseStatus(updates.hazards);

      const dfd = updates.createdAssets?.length
        ? addCreatedAssets(current.dfd, updates.createdAssets)
        : current.dfd;

      // Keep both stores consistent: the hazard-minted humans were just folded
      // into dfd.assets, but assetDataRef is built from project.assets.assets.
      // Run the canonical DFD→Assets sync so they surface there too (and stay
      // resolvable in Hazard/Threat/Risk).
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
        assets, // synchronised asset store
        phaseStatus: { ...current.phaseStatus, [PhaseId.Hazard]: status },
      });
    },
    [findProject, updateProject],
  );
  const handleHazardsUpdate = useMemo(
    () => makeHazardsUpdateHandler(projectId),
    [projectId, makeHazardsUpdateHandler],
  );

  // ── Assets tab ────────────────────────────────────────────────────────────
  // AssetsTab is keyed by project id, so each mounted instance owns a handler
  // pinned to its own project; its flush-on-unmount fires just after the
  // active project has switched. Name/description edits are mirrored onto
  // dfd.assets in the SAME updateProject call (the Asset tab is the known
  // source of the edit); asset links travel only as operations (AR-5).
  const makeAssetsUpdateHandler = useCallback(
    (id: string) => async (updates: AssetUpdateResult) => {
      const current = findProject(id);
      if (!current) return;
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
    [findProject, updateProject, toast, t],
  );

  // ── Asset deletion (Asset tab) ────────────────────────────────────────────
  // One project-wide operation: asset store, DFD (record + all relations),
  // hazard edges, risks — then threats re-derive from the rebuilt graph. The
  // confirm dialog shows collectAssetUsage() first and blocks while attack
  // trees are anchored on the asset.
  const makeAssetDeleteHandler = useCallback(
    (id: string) => async (assetId: string) => {
      const current = findProject(id);
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

      await updateProject({ id, ...purged, threats });
    },
    [findProject, updateProject],
  );

  // ── Risks tab ─────────────────────────────────────────────────────────────
  const makeRisksUpdateHandler = useCallback(
    (id: string) => async (updates: RiskUpdateResult) => {
      const current = findProject(id);
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
    [findProject, updateProject],
  );
  const handleRisksUpdate = useMemo(
    () => makeRisksUpdateHandler(projectId),
    [projectId, makeRisksUpdateHandler],
  );

  // ── Attack tree tab ───────────────────────────────────────────────────────
  // Keyed by project id like the Asset tab: its flush-on-unmount fires just
  // after the active project has already switched.
  const makeAttackTreeUpdateHandler = useCallback(
    (id: string) => (updates: AttackTreeUpdateResult) => {
      const current = findProject(id);
      if (!current) return;
      updateProject({
        id: current.id,
        attackTrees: updates.attackTrees,
        phaseStatus: updates.phaseStatus,
      });
    },
    [findProject, updateProject],
  );
  const handleAttackTreeUpdate = useMemo(
    () => makeAttackTreeUpdateHandler(projectId),
    [projectId, makeAttackTreeUpdateHandler],
  );

  // ── Audit tab ─────────────────────────────────────────────────────────────
  // Also a commit that finishes after the switch belongs to its project; the
  // same holds for the local settings (credentials/config) remembered per
  // project id.
  const makeAuditHandlers = useCallback(
    (id: string) => ({
      onUpdate: (updates: AuditUpdateResult) => {
        const current = findProject(id);
        if (!current) return;
        rememberLocalSettings(current.id, updates.audit, null);
        updateProject({
          id: current.id,
          audit: updates.audit,
          phaseStatus: updates.phaseStatus,
        });
      },
      onDirtyChange: (isDirty: boolean) => {
        const current = findProject(id);
        if (!current) return;
        updateProject({ id: current.id, hasUnsavedChanges: isDirty });
      },
      onVerificationsChange: makeVerificationsChangeHandler(id),
    }),
    [findProject, updateProject, makeVerificationsChangeHandler],
  );
  const auditHandlers = useMemo(
    () => makeAuditHandlers(projectId),
    [projectId, makeAuditHandlers],
  );

  // ── Lookups (read the project active at call time) ────────────────────────
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
  }, [activeProjectRef]);

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
  }, [activeProjectRef]);

  return {
    ...shared,
    handleGeneralTabUpdate,
    handleHazardsUpdate,
    makeAssetsUpdateHandler,
    makeAssetDeleteHandler,
    handleRisksUpdate,
    handleAttackTreeUpdate,
    auditHandlers,
    assetUsageLookup,
    threatCountLookup,
  };
}
