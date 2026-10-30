import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  PhaseDefinition,
  PhaseStatus,
  SourceBinding,
  regulationPresetFromTags,
} from "shared";
import { itemDefinitionFindings } from "../services/item-definition-findings";
import { MethodologyView } from "./methodology-view";
import { ProjectInfo } from "./project-info";
import { ProjectProgress } from "./project-progress";
import { ProjectSettings } from "./project-settings";
import { missingGeneralFields } from "../services/general-completeness";
import { SourceBindingsSection } from "./source-bindings-section";
import { ItemDefinitionView } from "./item-definition-view";
import {
  GeneralTabData,
  ProjectInfoData,
  ProjectProgressData,
  ProjectSettingsData,
  PhaseIndicatorsView,
  ItemModelItem,
  MethodologySummary,
  VerificationStatusView,
} from "../models/overview-types";
import { VerificationStatusLine } from "./verification-status-line";

// ==================== GENERAL TAB ====================
// Overview/Info phase component — sub-tabs instead of a growing stack
// (ISO/SAE 21434 conformance plan Phase 1 "Overview rework", decision 24):
//
//   Project      project info (without the description) + phase progress
//   Definition   item definition — purpose and functions (the description), …
//   Methodology  the methodology record read-only (A-4) + project settings
//   Sources      project source reference (source bindings)
//
// The last view is remembered per project (browser storage). Each view shows
// the number of its open warnings (A-4): Project the missing project fields,
// Definition the item definition findings.

export type OverviewView = "project" | "definition" | "methodology" | "sources";

const OVERVIEW_VIEWS: readonly OverviewView[] = ["project", "definition", "methodology", "sources"];

const viewKey = (projectId: string) => `taraflow.overview.view.${projectId}`;

function loadView(projectId: string | undefined): OverviewView {
  if (!projectId) return "project";
  try {
    const v = localStorage.getItem(viewKey(projectId));
    return (OVERVIEW_VIEWS as readonly string[]).includes(v ?? "") ? (v as OverviewView) : "project";
  } catch {
    return "project";
  }
}

interface GeneralTabProps {
  /** Project data */
  data: GeneralTabData;

  /** Phase definitions (injected from app config) */
  phases: PhaseDefinition[];

  /** Phase ids that count toward progress (injected from app config). */
  progressPhaseIds: number[];

  /** Status icon getter (injected from app config) */
  getStatusIcon: (status: PhaseStatus) => string;

  /** Status color getter (injected from app config) */
  getStatusColor: (status: PhaseStatus) => string;

  /**
   * Status and error / warning count per phase, derived by the app layer
   * (the DFD's from its current validation). Without it: the stored status.
   */
  phaseIndicators?: PhaseIndicatorsView;

  /** Callback when data changes */
  onUpdate: (data: GeneralTabData) => void;

  /** Remembers the last sub-tab for this project; without it: Project. */
  projectId?: string;

  /** What Definition sections can link to (DFD, assets), built by the app layer. */
  modelItems?: readonly ItemModelItem[];

  /** assumption id → trust boundaries that link it (A-3), built by the app layer. */
  assumptionUsage?: Readonly<Record<string, readonly string[]>>;

  /** The methodology record, reduced for display (A-4), built by the app layer. */
  methodology?: MethodologySummary;

  /** Switch to the Risk tab, where the method is configured. */
  onOpenRiskTab?: () => void;

  /** TARA verification status (iso-21434 only, plan Phase 4), from the app layer. */
  verification?: VerificationStatusView;

  /** Switch to the Audit tab, where the verification is recorded. */
  onOpenAuditTab?: () => void;
}

export const GeneralTab: React.FC<GeneralTabProps> = ({
  data,
  phases,
  progressPhaseIds,
  getStatusIcon,
  getStatusColor,
  phaseIndicators,
  onUpdate,
  projectId,
  modelItems = [],
  assumptionUsage,
  methodology,
  onOpenRiskTab,
  verification,
  onOpenAuditTab,
}) => {
  const { t } = useTranslation();
  const [view, setView] = useState<OverviewView>(() => loadView(projectId));
  useEffect(() => setView(loadView(projectId)), [projectId]);
  const chooseView = (v: OverviewView) => {
    setView(v);
    if (!projectId) return;
    try {
      localStorage.setItem(viewKey(projectId), v);
    } catch {
      /* storage unavailable: this session only */
    }
  };

  // Progress grid: only the phases that count, scoped by the app layer
  // (Hazard already filtered out there when safety analysis is off).
  const overviewPhases = phases.filter((p) => progressPhaseIds.includes(p.id));

  // Map data to ProjectInfoData interface
  const projectInfoData: ProjectInfoData = {
    name: data.info.name,
    description: data.info.description,
    version: data.info.version,
    responsible: data.info.responsible,
    created: data.info.created,
    lastModified: data.info.lastModified,
    tags: data.info.tags,
    team: data.info.team,
    isHighImpact: data.info.isHighImpact,
    safetyRelevant: data.info.safetyRelevant,
    windowOfOpportunity: data.info.windowOfOpportunity,
  };

  // Map data to ProjectProgressData interface
  const progressData: ProjectProgressData = React.useMemo(
    () => ({
      phaseStatus: phaseIndicators?.status ?? data.phaseStatus,
      // Phase 0 (General) without the app: missing fields, same rule as its status.
      validationInfo: phaseIndicators?.counts ?? { 0: { errors: 0, warnings: missingGeneralFields(data.info).length } },
    }),
    [data.phaseStatus, data.info, phaseIndicators],
  );

  // Handle info updates (includes isHighImpact now)
  const handleInfoUpdate = (info: ProjectInfoData) => {
    onUpdate({
      ...data,
      info: {
        ...data.info,
        ...info,
      },
    });
  };

  // Handle settings updates (only strictMode, autoSave, autoSaveInterval)
  const handleSettingsUpdate = (settings: ProjectSettingsData) => {
    onUpdate({
      ...data,
      info: {
        ...data.info,
      },
      settings: {
        ...settings,
      },
    });
  };

  // Handle project-level source binding updates (Source Version Binding,
  // implementation plan §3.5/§4 — the project-wide "analysed against repo
  // X, release Y" reference; element-level bindings are a separate,
  // non-inheriting collection edited elsewhere).
  const handleSourceBindingsUpdate = (sourceBindings: SourceBinding[]) => {
    onUpdate({
      ...data,
      sourceBindings,
    });
  };

  // ── Findings (A-4) ─────────────────────────────────────────────────────
  const modelItemIds = React.useMemo(() => new Set(modelItems.map((m) => m.id)), [modelItems]);
  const itemFindings = React.useMemo(
    () =>
      itemDefinitionFindings({
        description: data.info.description,
        itemDefinition: data.itemDefinition,
        presetId: regulationPresetFromTags(data.info.tags),
        assumptionUsage,
        modelItemIds: modelItems.length > 0 ? modelItemIds : undefined,
        today: new Date().toISOString().slice(0, 10),
      }),
    [data.info.description, data.info.tags, data.itemDefinition, assumptionUsage, modelItems, modelItemIds],
  );
  const badges: Record<OverviewView, number> = {
    // The description is counted in Definition, where it is edited.
    project:
      missingGeneralFields(data.info).filter((f) => f !== "description").length +
      (verification && verification.kind !== "verified" ? 1 : 0),
    definition: itemFindings.filter((f) => f.severity === "warning").length,
    methodology: methodology && !methodology.impactScaleConforms ? 1 : 0,
    sources: 0,
  };

  return (
    <div className="p-6 max-w-6xl">
      <div
        role="tablist"
        aria-label={t("overviewViews.label", { defaultValue: "Overview views" })}
        className="flex gap-1 border-b border-gray-200 mb-6"
      >
        {OVERVIEW_VIEWS.map((v) => (
          <button
            key={v}
            role="tab"
            aria-selected={view === v}
            data-testid={`overview-view-${v}`}
            onClick={() => chooseView(v)}
            className={`px-4 py-2 text-sm -mb-px border-b-2 transition-colors ${
              view === v
                ? "border-blue-600 text-blue-700 font-medium"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            {t(`overviewViews.${v}`, { defaultValue: v })}
            {badges[v] > 0 && (
              <span
                className="ml-2 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-amber-100 text-amber-800 text-xs"
                data-testid={`overview-view-${v}-badge`}
              >
                {badges[v]}
              </span>
            )}
          </button>
        ))}
      </div>

      {view === "project" && (
        <>
          {verification && <VerificationStatusLine status={verification} onOpenAudit={onOpenAuditTab} />}
          <ProjectInfo info={projectInfoData} onUpdate={handleInfoUpdate} />

          <ProjectProgress
            data={progressData}
            phases={overviewPhases}
            getStatusIcon={getStatusIcon}
            getStatusColor={getStatusColor}
          />
        </>
      )}

      {view === "definition" && (
        <ItemDefinitionView
          description={data.info.description}
          itemDefinition={data.itemDefinition}
          modelItems={modelItems}
          assumptionUsage={assumptionUsage}
          findings={itemFindings}
          onChange={({ description, itemDefinition }) =>
            onUpdate({
              ...data,
              info: description !== undefined ? { ...data.info, description } : data.info,
              itemDefinition,
            })
          }
        />
      )}

      {view === "methodology" && (
        <>
          {methodology && <MethodologyView summary={methodology} onOpenRiskTab={onOpenRiskTab} />}
          <ProjectSettings
            settings={data.settings}
            onUpdate={handleSettingsUpdate}
          />
        </>
      )}

      {view === "sources" && (
        <SourceBindingsSection
          bindings={data.sourceBindings ?? []}
          scopeLabel={t("sourceBinding.projectScope.title", {
            defaultValue: "Project Source Reference",
          })}
          scopeDescriptionKey="sourceBinding.projectScope.description"
          onUpdate={handleSourceBindingsUpdate}
        />
      )}
    </div>
  );
};