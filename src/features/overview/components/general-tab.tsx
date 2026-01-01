import React from "react";
import { PhaseDefinition, PhaseStatus, PhaseStatusMap } from "shared";
import { ProjectInfo, ProjectInfoData } from "./project-info";
import { ProjectProgress } from "./project-progress";
import { ProjectSettings } from "./project-settings";
import {
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

export interface GeneralTabData {
  // Project info
  id: string;
  name: string;
  description: string;
  version: string;
  responsible: string;
  created: string;
  lastModified: string;
  tags: string[];
  team: string[];

  // Settings (includes isHighImpact)
  settings: ProjectSettingsData;

  // Phase status
  phaseStatus: PhaseStatusMap;

  // DFD validation (for progress display)
  dfdValidation?: {
    errors: string[];
    warnings: string[];
  };
}

interface GeneralTabProps {
  /** Project data */
  data: GeneralTabData;

  /** Phase definitions (injected from app config) */
  phases: PhaseDefinition[];

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
  getStatusIcon,
  getStatusColor,
  onUpdate,
}) => {
  // Map data to ProjectInfoData interface
  const projectInfoData: ProjectInfoData = {
    name: data.name,
    description: data.description,
    version: data.version,
    responsible: data.responsible,
    created: data.created,
    lastModified: data.lastModified,
    tags: data.tags,
    team: data.team,
    isHighImpact: data.settings.isHighImpact,
  };

  // Map data to ProjectProgressData interface
  const progressData: ProjectProgressData = React.useMemo(() => {
    const validationInfo: Record<number, PhaseValidationInfo> = {};

    // Phase 0: General - check for missing fields
    const missingFields: string[] = [];
    if (!data.name || data.name.trim().length < 3) missingFields.push("name");
    if (!data.description || data.description.trim().length === 0)
      missingFields.push("description");
    if (!data.version || data.version.trim().length === 0)
      missingFields.push("version");
    if (!data.responsible || data.responsible.trim().length === 0)
      missingFields.push("responsible");
    if (!data.tags || data.tags.length === 0) missingFields.push("tags");
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
      name: info.name,
      description: info.description,
      version: info.version,
      responsible: info.responsible,
      tags: info.tags,
      team: info.team,
      settings: {
        ...data.settings,
        isHighImpact: info.isHighImpact,
      },
    });
  };

  // Handle settings updates (only strictMode, autoSave, autoSaveInterval)
  const handleSettingsUpdate = (settings: ProjectSettingsData) => {
    onUpdate({
      ...data,
      settings: {
        ...settings,
        // Preserve isHighImpact from current settings (edited via ProjectInfo)
        isHighImpact: data.settings.isHighImpact,
      },
    });
  };

  return (
    <div className="p-6 max-w-4xl">
      <ProjectInfo info={projectInfoData} onUpdate={handleInfoUpdate} />

      <ProjectProgress
        data={progressData}
        phases={phases}
        getStatusIcon={getStatusIcon}
        getStatusColor={getStatusColor}
      />

      <ProjectSettings
        settings={data.settings}
        onUpdate={handleSettingsUpdate}
      />
    </div>
  );
};
