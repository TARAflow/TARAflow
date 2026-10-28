import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  PhaseDefinition,
  PhaseStatus,
  SourceBinding,
} from "shared";
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
  PhaseValidationInfo,
} from "../models/overview-types";

// ==================== GENERAL TAB ====================
// Overview/Info phase component — sub-tabs instead of a growing stack
// (ISO/SAE 21434 conformance plan Phase 1 "Overview rework", decision 24):
//
//   Project      project info (without the description) + phase progress
//   Definition   item definition — purpose and functions (the description), …
//   Methodology  project settings (the methodology record follows, A-4)
//   Sources      project source reference (source bindings)
//
// The last view is remembered per project (browser storage).

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

  /** Callback when data changes */
  onUpdate: (data: GeneralTabData) => void;

  /** Remembers the last sub-tab for this project; without it: Project. */
  projectId?: string;
}

export const GeneralTab: React.FC<GeneralTabProps> = ({
  data,
  phases,
  progressPhaseIds,
  getStatusIcon,
  getStatusColor,
  onUpdate,
  projectId,
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
  const progressData: ProjectProgressData = React.useMemo(() => {
    const validationInfo: Record<number, PhaseValidationInfo> = {};

    // Phase 0: General - missing fields (same rule as its phase status)
    validationInfo[0] = { errors: 0, warnings: missingGeneralFields(data.info).length };

    // Phase 1: DFD - use validation from data
    if (data.dfdValidation) {
      validationInfo[1] = {
        errors: data.dfdValidation.errors?.length ?? 0,
        warnings: data.dfdValidation.warnings?.length ?? 0,
      };
    }

    return {
      phaseStatus: data.phaseStatus,
      validationInfo,
    };
  }, [data]);

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
          </button>
        ))}
      </div>

      {view === "project" && (
        <>
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
          onDescriptionChange={(description) =>
            onUpdate({ ...data, info: { ...data.info, description } })
          }
        />
      )}

      {view === "methodology" && (
        <ProjectSettings
          settings={data.settings}
          onUpdate={handleSettingsUpdate}
        />
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