import React from "react";
import { PhaseDefinition, PhaseStatus, flattenProjectTags } from "shared";
import { ProjectInfo } from "./project-info";
import { ProjectProgress } from "./project-progress";
import { ProjectSettings } from "./project-settings";
import {
  GeneralTabData,
  ProjectInfoData,
  ProjectProgressData,
  ProjectSettingsData,
  PhaseValidationInfo,
} from "../models/overview-types";

// ==================== GENERAL TAB ====================
// Overview/Info phase component
//
// Layout:
// 1. Project Info (editable)
// 2. Phase Progress
// 3. Project Settings (Validation, Auto Saving)

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
}

export const GeneralTab: React.FC<GeneralTabProps> = ({
  data,
  phases,
  progressPhaseIds,
  getStatusIcon,
  getStatusColor,
  onUpdate,
}) => {
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
  };

  // Map data to ProjectProgressData interface
  const progressData: ProjectProgressData = React.useMemo(() => {
    const validationInfo: Record<number, PhaseValidationInfo> = {};

    // Phase 0: General - check for missing fields
    const missingFields: string[] = [];
    if (!data.info.name || data.info.name.trim().length < 3)
      missingFields.push("name");
    if (!data.info.description || data.info.description.trim().length === 0)
      missingFields.push("description");
    if (!data.info.version || data.info.version.trim().length === 0)
      missingFields.push("version");
    if (!data.info.responsible || data.info.responsible.trim().length === 0)
      missingFields.push("responsible");
    const totalTags = flattenProjectTags(data.info.tags).length;
    if (totalTags === 0) missingFields.push("tags");
    validationInfo[0] = { errors: 0, warnings: missingFields.length };

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

  return (
    <div className="p-6 max-w-6xl">
      <ProjectInfo info={projectInfoData} onUpdate={handleInfoUpdate} />

      <ProjectProgress
        data={progressData}
        phases={overviewPhases}
        getStatusIcon={getStatusIcon}
        getStatusColor={getStatusColor}
      />

      <ProjectSettings
        settings={data.settings}
        onUpdate={handleSettingsUpdate}
      />
    </div>
  );
};;
