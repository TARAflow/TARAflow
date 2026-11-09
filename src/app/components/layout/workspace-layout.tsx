// ==================== WORKSPACE LAYOUT ====================
// Single Responsibility: render the active project's feature tabs
// and coordinate all tab-level updates back to ProjectContext.
//
// What lives here:
//   - Phase tab bar + tab routing (rendering)
//   - The project mitigation registry assignment (before anything reads it)
//   - activeProjectRef / projectsRef (stale-closure protection)
//
// The wiring is split into hooks per strand (MT-1, app/hooks/workspace/):
//   - useWorkspaceNavigation   phase change, jump requests, safety gate
//   - usePinnedTabHandlers     writing handlers pinned to their project
//   - useLocalProjectSettings  machine-local audit / tracker values
//   - useDfdDerivedData        DFD tab project, graph, leveled analysis
//   - useAssetDerivedData      asset data reference, hazard/threat links
//   - useOverviewData          item model, methodology, verification
//   - usePhaseIndicators       phase bar badges, audit hints
//   - useClosedLoopData        control instances, security drift
//   - useComplianceView        requirement matrices
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
import {
  PHASES,
  getPhaseStatusIcon,
  getPhaseStatusColor,
  useToast,
  dfdPreviewPagesOf,
  ThreatReference,
  getRequiredImpactScale,
  EMPTY_PROJECT_TAGS,
  getDisabledThreatGenerators,
  getRegulationPreset,
  regulationPresetFromTags,
} from "shared";
import { PhaseId, getProgressPhaseIds } from "../../models/phase-types";
import type { Project } from "../../models/project-types";

import { useProjectContext } from "../../contexts/project-context";
import { PhaseTabs } from "../navigation/phase-tab-bar";

import { GeneralTab, type GeneralTabData } from "features/overview";
import { HazardsTab } from "features/hazards";
import { DFDTab } from "features/dfd";
import { AssetsTab } from "features/assets";
import {
  StrideMethod,
  ThreatData,
  ThreatsTab,
  getAllMitigations,
} from "features/threats";
import { RisksTab } from "features/risks";
import { getMandatoryAssetCriteriaIds } from "features/risks/services/regulation-preset-service";
import {
  AttackTreeTab,
  extractAssetReferences,
  extractThreatReferencesForAttackTree,
  extractRiskReferences,
  extractDFDElementReferences,
  extractMitigationReferences,
} from "features/attacktree";
import { DocTab } from "features/documentation";
import { IntegrationTab } from "features/integration";
import { AuditTab } from "features/audit";
import { ComplianceFrame, suggestMitigations } from "features/compliance";

import { notifyProjectMitigations, setProjectMitigations } from "shared/services/project-mitigation-registry";
import { MatrixRequirementsContext } from "shared/hooks/matrix-requirements";
import { transformProjectToDocData } from "app/services/doc-transform";
import { buildAttackPathThreatReferences } from "app/utils/build-attack-path-threat-references";
import { extractThreatReferences as extractThreatReferencesOf } from "app/utils/extract-threat-references";
import { withComponentPrefill, withComponentThreats } from "app/utils/component-threats";
import { componentAttackPathThreatReferences, componentAttackTreeData } from "app/utils/component-attack-trees";
import { instanceAssetUnits } from "app/services/component-import/instance-quantity";
import { componentTreatments, machineDecided, uncreditedResiduals } from "app/utils/component-treatments";
import { projectMeasureOptions } from "app/services/component-import/assumption-status";
import { ComponentAttackPathsSection, ComponentTreatmentSection } from "features/components";
import { buildAttackTreeLikelihoodReferences } from "app/utils/build-attack-tree-likelihood-references";

import { useWorkspaceNavigation } from "app/hooks/workspace/use-workspace-navigation";
import { usePinnedTabHandlers } from "app/hooks/workspace/use-pinned-tab-handlers";
import { useLocalProjectSettings } from "app/hooks/workspace/use-local-project-settings";
import { useDfdDerivedData } from "app/hooks/workspace/use-dfd-derived-data";
import { useAssetDerivedData } from "app/hooks/workspace/use-asset-derived-data";
import { useOverviewData } from "app/hooks/workspace/use-overview-data";
import { usePhaseIndicators } from "app/hooks/workspace/use-phase-indicators";
import { useClosedLoopData } from "app/hooks/workspace/use-closed-loop-data";
import { useComplianceView } from "app/hooks/workspace/use-compliance-view";
import { useComponentImport } from "app/hooks/workspace/use-component-import";
import { findingOwner } from "app/services/component-import/component-scope";

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
    openProjectFile,
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
  // assets, but by then activeProject is already the incoming one. The
  // pinned handlers (usePinnedTabHandlers) resolve their target project by
  // its explicit id against this ref.
  const projectsRef = useRef<Project[]>(projects);
  projectsRef.current = projects;

  // Name and description edits between the Asset tab and the DFD are
  // mirrored synchronously, in the SAME updateProject call as the edit
  // itself (see usePinnedTabHandlers / useProjectUpdateHandlers): the
  // handler that receives the edit IS the source of truth for it. The former
  // debounced bidirectional sync guessed across the gap between two writes
  // and caused every description-loss bug of that investigation.

  const navigation = useWorkspaceNavigation({
    activeProject,
    activeProjectRef,
    activePhase,
    setActivePhase,
    updateProject,
    toast,
  });
  const { handlePhaseChange } = navigation;

  const handlers = usePinnedTabHandlers({
    projectId: activeProject?.id ?? "",
    activeProjectRef,
    projectsRef,
    updateProject,
    toast,
    t,
  });

  const { localAudit, localIntegration, ticketPort } = useLocalProjectSettings(
    activeProject?.id,
    activeProject?.audit ?? null,
    activeProject?.integration ?? null,
  );

  const dfdData = useDfdDerivedData(activeProject);
  // Identical units per instance asset (I5) — the asset dialog's hint.
  const instanceComponents = activeProject?.components;
  const assetUnits = useMemo(() => instanceAssetUnits(instanceComponents), [instanceComponents]);
  // The project's measures (phase 3c) — what an assumption can name as relying on it.
  const measureRisks = activeProject?.risks;
  const measureThreats = activeProject?.threats;
  const projectMeasures = useMemo(
    () => projectMeasureOptions({ risks: measureRisks ?? null, threats: measureThreats ?? null }),
    [measureRisks, measureThreats],
  );
  // The component's treatment per imported risk (phase 3a) — the risk dialog's section.
  // The machine's risks tell which evidence measures are implemented (2026-11-09).
  const componentTreatmentMap = useMemo(
    () => componentTreatments({ components: instanceComponents, risks: measureRisks ?? null }),
    [instanceComponents, measureRisks],
  );
  // Owner chip of a finding on an imported component's cell (phase 4a, §8.1).
  const cellOwners = dfdData.componentCellOwners;
  const findingOwnerOf = useCallback(
    (cellId: string, key?: string) => {
      const owner = findingOwner(cellOwners, cellId, key);
      return owner
        ? {
            label: t("components.owner.label", { prefix: owner.prefix, defaultValue: "Component {{prefix}}" }),
            tooltip: t("components.owner.tooltip", {
              component: owner.label,
              defaultValue: "Belongs to {{component}} — read-only here, fixed in the component's TARA.",
            }),
          }
        : undefined;
    },
    [cellOwners, t],
  );
  // Residual risks not credited (phase 3d-2a, I7 (4)) — the Risk tab shows the values before treatment.
  const uncreditedMap = useMemo(
    () => uncreditedResiduals({ components: instanceComponents, risks: measureRisks ?? null }, componentTreatmentMap),
    [instanceComponents, measureRisks, componentTreatmentMap],
  );
  const assetData = useAssetDerivedData(activeProject);
  const overview = useOverviewData(activeProject);

  const phase = usePhaseIndicators({
    activeProject,
    activePhase,
    dfdTabProject: dfdData.dfdTabProject,
    dfdContext: dfdData.dfdContext,
    dfdGraphRef: dfdData.dfdGraphRef,
    dfdReference: dfdData.dfdReference,
    excludedElementIds: dfdData.componentExcluded,
    assetDataRef: assetData.assetDataRef,
    verificationStatus: overview.verificationStatus,
    t,
  });

  const { anchorTargets, controlInstances, securityDrifts } = useClosedLoopData(
    activeProject,
    customMitigations,
  );

  // Multi-project TARA: "Import component TARA…" in the DFD tab (design v3 §5).
  const componentImport = useComponentImport({
    activeProject,
    openProjectFile,
    projectsRef,
    activeProjectRef,
    updateProject,
    toast,
  });

  const { complianceStandards, matrixRequirements, complianceView } = useComplianceView(
    activeProject,
    activePhase,
  );

  // The regulation preset of the project's tags, read by several tabs.
  const presetId = regulationPresetFromTags(activeProject?.info?.tags ?? EMPTY_PROJECT_TAGS);
  const isoMode = presetId === "iso-21434";
  // Label vocabulary of the preset: under iso-21434 person-harm severities
  // show their ISO 26262 class (S0–S3, conformance plan 1H-S).
  const labelVocabulary: "default" | "iso-21434" = isoMode ? "iso-21434" : "default";

  // ── Threat reference extraction ───────────────────────────────────────────

  const extractThreatReferences = (
    threatData: ThreatData | null | undefined,
    strideMethod: StrideMethod,
  ): ThreatReference[] => {
    const refs = extractThreatReferencesOf(
      // Stored threats plus those of imported components (patch 14).
      activeProject ? withComponentThreats(threatData, activeProject) : threatData,
      strideMethod,
      activeProject?.assets?.assets,
      (activeProject?.dfd as any)?.elements,
    );
    // The component's intrinsic factor values for their risks (patch 16).
    return activeProject ? withComponentPrefill(refs, activeProject) : refs;
  };

  // ── Guard ─────────────────────────────────────────────────────────────────

  if (!activeProject?.info) return null;

  const generalTabData: GeneralTabData = {
    info: activeProject.info,
    settings: activeProject.settings,
    phaseStatus: activeProject.phaseStatus,
    sourceBindings: activeProject.sourceBindings,
    itemDefinition: activeProject.itemDefinition,
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <MatrixRequirementsContext.Provider value={matrixRequirements}>
      <PhaseTabs
        project={activeProject}
        activePhase={activePhase}
        onPhaseChange={handlePhaseChange}
        threatDrift={phase.threatDriftCounts}
        indicators={phase.indicators ?? undefined}
        auditHints={phase.auditHintLines}
        complianceAvailable={complianceStandards.length > 0}
      />

      <div className="flex-1 overflow-y-auto">
        {activePhase === PhaseId.General && (
          <GeneralTab
            key={activeProject.id}
            data={generalTabData}
            phases={PHASES}
            progressPhaseIds={getProgressPhaseIds(activeProject.info?.safetyRelevant ?? false, isoMode)}
            getStatusIcon={getPhaseStatusIcon}
            getStatusColor={getPhaseStatusColor}
            phaseIndicators={phase.indicators ?? undefined}
            onOpenPhase={handlePhaseChange}
            onUpdate={handlers.handleGeneralTabUpdate}
            projectId={activeProject.id}
            modelItems={overview.itemModelItems}
            assumptionUsage={overview.assumptionUsage}
            measureOptions={projectMeasures}
            methodology={overview.methodologySummary}
            verification={overview.verificationStatus}
            onOpenAuditTab={() => handlePhaseChange(PhaseId.Audit)}
            onOpenRiskTab={() => handlePhaseChange(PhaseId.Risk)}
          />
        )}

        {activePhase === PhaseId.Hazard &&
          (activeProject.info?.safetyRelevant ?? false) && (
            <HazardsTab
              key={activeProject.id}
              project={{
                id: activeProject.id,
                name: activeProject.info?.name || "",
                hazards: activeProject.hazards ?? null,
                phaseStatus: activeProject.phaseStatus,
                assetDataRef: assetData.assetDataRef,
                lastModified: activeProject.info?.lastModified || "",
                labelVocabulary,
              }}
              onUpdate={handlers.handleHazardsUpdate}
              openRequest={navigation.hazardOpenRequest}
            />
          )}

        {/* DFDTab: always mounted within a project to prevent iframe reload
            on tab switch. The key={dfdTabProject.id} forces a full remount
            on project switch — ensuring draw.io loads the correct project's
            DFD and doesn't show stale data from a previous project.
            The outer div's display:none hides the tab without unmounting. */}
        {dfdData.dfdTabProject && (
          <div
            style={{
              display: activePhase === PhaseId.DFD ? "flex" : "none",
              flexDirection: "column",
              height: "100%",
            }}
          >
            <DFDTab
              key={dfdData.dfdTabProject.id}
              project={dfdData.dfdTabProject}
              complianceComponentId={activeProject.compliance?.componentId}
              onUpdate={handlers.handleDFDUpdate}
              assetUsage={handlers.assetUsageLookup}
              threatCountOf={handlers.threatCountLookup}
              onImportComponent={componentImport.runner}
              importedMultiprocessIds={dfdData.componentMultiprocessIds}
              externalFindings={dfdData.componentDfdFindings}
              componentInfoOf={componentImport.componentInfoOf}
              findingOwnerOf={findingOwnerOf}
              graphFocusRequest={navigation.graphFocusRequest}
              elementFocusRequest={navigation.elementFocusRequest}
              hazards={assetData.graphHazards}
              assetRegistry={assetData.graphRegistry}
              labelVocabulary={labelVocabulary}
              assumptions={activeProject.itemDefinition?.assumptions}
              onCreateAssumption={handlers.handleCreateAssumption}
              assumptionsNeutral={!isoMode}
              onShowInTable={navigation.showInTable}
              onOpenHazard={activeProject.info?.safetyRelevant ? navigation.openHazard : undefined}
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
              dfdAssets: dfdData.dfdAssets,
              dfdElements: dfdData.dfdElements,
              dfdConnections: dfdData.dfdConnections,
              dfdPreviewImage: activeProject.dfd?.thumbnail,
              dfdPreviewPages: dfdPreviewPagesOf(activeProject.dfd),
              dfdTableGroups: dfdData.tableGroups,
              lastModified: activeProject.info?.lastModified || "",
              damageScenarioMode: isoMode,
              mandatoryImpactCriteriaIds: getMandatoryAssetCriteriaIds(presetId),
              requiredImpactScale: getRequiredImpactScale(presetId),
              impactLabelVocabulary: labelVocabulary,
            }}
            onUpdate={handlers.makeAssetsUpdateHandler(activeProject.id)}
            onDeleteAsset={handlers.makeAssetDeleteHandler(activeProject.id)}
            tableHighlightRequest={navigation.tableHighlightRequest}
            onShowInGraph={navigation.showInGraph}
            assetUsage={handlers.assetUsageLookup}
            hazardLinks={assetData.hazardRef}
            threatLinks={assetData.threatGoalLinks}
            unitsOf={(id) => assetUnits.get(id) ?? 1}
          />
        )}

        {activePhase === PhaseId.Threats && dfdData.dfdContext && (
          <ThreatsTab
            // One instance per project (FX-8): its local threat tables never
            // carry over into the next project.
            key={activeProject.id}
            project={{
              id: activeProject.id,
              name: activeProject.info?.name || "",
              threats: activeProject.threats ?? null,
              phaseStatus: activeProject.phaseStatus,
              dfdXml: activeProject.dfd?.xml,
              dfdPageIds: activeProject.dfd?.pages?.map((p) => p.pageId),
              dfdParentLevelFlows: dfdData.parentLevelFlows,
              dfdTableGroups: dfdData.tableGroups,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              dfdElements: (activeProject.dfd?.elements || []) as any[],
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              dfdConnections: activeProject.dfd?.connections as any,
              dfdPreviewImage: activeProject.dfd?.thumbnail,
              dfdPreviewPages: dfdPreviewPagesOf(activeProject.dfd),
              assetIds: activeProject.assets?.assets?.map((a) => a.id),
              lastModified: activeProject.info?.lastModified || "",
              dfdGraph: dfdData.dfdGraphRef,
              assetDataRef: assetData.assetDataRef,
              dfd: dfdData.dfdReference,
              riskAttachments: assetData.riskAttachments,
              excludedElementIds: dfdData.componentExcluded,
              importedThreatGroups: dfdData.componentThreatGroups,
              info: {
                tags: activeProject.info?.tags ?? EMPTY_PROJECT_TAGS,
              },
            }}
            dfdContext={dfdData.dfdContext}
            onUpdate={handlers.handleThreatsUpdate}
            projectMitigationRefs={handlers.projectMitigationRefs}
            onOverrideImportedRelevance={componentImport.overrideRelevance}
          />
        )}

        {activePhase === PhaseId.Risk && (
          <RisksTab
            key={activeProject.id}
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
                !isoMode,
                // Controls are proposed only when their context fits the
                // project (mitigation catalog design D4).
                activeProject.info?.tags ?? EMPTY_PROJECT_TAGS,
              ).map((ref): ThreatReference => ({
                ...ref,
                // Where the path's controls go, for the coverage badge
                // (closed-loop review CL-4).
                controlTargets: anchorTargets(ref.id),
              })).concat(
                // The attack paths of imported components (patch 17).
                componentAttackPathThreatReferences(activeProject, !isoMode, activeProject.info?.tags ?? EMPTY_PROJECT_TAGS),
              ),
              attackTreeLikelihoods: [
                ...buildAttackTreeLikelihoodReferences(
                  activeProject.attackTrees,
                  activeProject.risks?.configuration?.scale,
                ),
                ...buildAttackTreeLikelihoodReferences(
                  componentAttackTreeData(activeProject),
                  activeProject.risks?.configuration?.scale,
                ),
              ],
              recommendedImpactAggregation: getRegulationPreset(presetId).impactAggregation,
              disabledStrideMethods: getDisabledThreatGenerators(presetId),
              isoMode,
              assetDataRef: assetData.assetDataRef,
              dfd: dfdData.dfdReference,
              dfdPreviewImage: activeProject.dfd?.thumbnail,
              dfdPreviewPages: dfdPreviewPagesOf(activeProject.dfd),
              dfdTableGroups: dfdData.tableGroups,
              integration: localIntegration
                ? {
                    connection: {
                      tool: localIntegration.connection?.tool ?? "jira",
                      status: localIntegration.connection?.status ?? "disconnected",
                      projectName: localIntegration.connection?.projectName,
                      issueTypes: localIntegration.connection?.issueTypes,
                      credentials: localIntegration.connection?.credentials as any,
                    },
                  }
                : null,
              cybersecurityConcept: activeProject.cybersecurityConcept,
              assumptions: activeProject.itemDefinition?.assumptions,
              lastModified: activeProject.info?.lastModified || "",
            }}
            ticketPort={ticketPort}
            onUpdate={handlers.handleRisksUpdate}
            onConceptChange={handlers.handleConceptChange}
            uncreditedResiduals={uncreditedMap}
            riskExtraSection={(risk) => {
              // The component's treatment of an imported risk (phase 3a, §7.4).
              const tr = componentTreatmentMap.get(risk.threatId);
              return tr ? (
                <ComponentTreatmentSection
                  view={{ ...tr, decided: machineDecided(risk) }}
                  // "Not effective here" (phase 3d-2b) — per instance, for every risk relying on the measure.
                  onOverride={(measureId, rationale) => componentImport.overrideMeasure(tr.instanceId, measureId, rationale)}
                />
              ) : null;
            }}
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
              isoMode,
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
            onUpdate={handlers.handleAttackTreeUpdate}
            extraSection={
              isoMode && componentImport.attackPathGroups.length > 0 ? (
                <ComponentAttackPathsSection
                  groups={componentImport.attackPathGroups}
                  onSetWindow={componentImport.setPathWindow}
                />
              ) : undefined
            }
          />
        </div>

        {activePhase === PhaseId.Documentation && (
          <DocTab
            project={transformProjectToDocData(
              activeProject,
              i18n.language === "de" ? "de" : "en",
            )}
            onUpdate={handlers.handleDocUpdate}
          />
        )}

        {activePhase === PhaseId.Audit && (
          <AuditTab
            key={activeProject.id}
            project={{
              id: activeProject.id,
              name: activeProject.info?.name || "",
              filePath: activeProject.filePath,
              audit: localAudit,
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
              verification: overview.verificationInput,
              lastModified: activeProject.info?.lastModified || "",
            }}
            onUpdate={handlers.auditHandlers.onUpdate}
            onVerificationsChange={handlers.auditHandlers.onVerificationsChange}
            onDirtyChange={handlers.auditHandlers.onDirtyChange}
          />
        )}

        {activePhase === PhaseId.Compliance && complianceStandards.length > 0 && (
          complianceView ? (
            <ComplianceFrame
              standards={complianceStandards}
              evaluate={complianceView.evaluate}
              data={activeProject.compliance}
              componentOptions={complianceView.componentOptions}
              deviceProposal={complianceView.deviceProposal}
              nameOf={complianceView.nameOf}
              typeOf={complianceView.typeOf}
              today={new Date().toISOString().slice(0, 10)}
              onChange={handlers.handleComplianceChange}
              concept={activeProject.cybersecurityConcept}
              onConceptChange={handlers.handleConceptChange}
              onShowElement={navigation.showElement}
              mitigationSuggestions={(ids, openElementIds) =>
                suggestMitigations(
                  getAllMitigations(),
                  ids,
                  new Set(openElementIds.map(complianceView.typeOf).filter((type): type is string => !!type)),
                )
                  .map((m) => ({
                    id: m.id,
                    // Project mitigations carry their text; catalog ones are i18n keys.
                    text: (m as { text?: string }).text ?? t(`${m.id}.mitigation`, { ns: "mitigations", defaultValue: m.id }),
                  }))
              }
            />
          ) : (
            <div className="p-6 text-gray-600">
              {t("compliance.noModel", { defaultValue: "The requirement matrix needs a data flow diagram — model the system in the DFD tab first." })}
            </div>
          )
        )}

        {componentImport.dialog}

        {activePhase === PhaseId.Integration && (
          <IntegrationTab
            data={{ integration: localIntegration }}
            onUpdate={handlers.handleIntegrationUpdate}
          />
        )}
      </div>
    </MatrixRequirementsContext.Provider>
  );
}
