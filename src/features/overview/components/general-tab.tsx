import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  ConfirmDeleteDialog,
  PhaseDefinition,
  PhaseStatus,
  PhaseStatusMap,
} from "shared";
import { ActivityLog, ActivityLogEntry } from "./activity-log";
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
// This component orchestrates the sub-components and handles
// the mapping between the full project data and the specific
// interfaces each component needs.
//
// Dependencies are injected via props (Dependency Inversion Principle)

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

  // Settings
  settings: ProjectSettingsData;

  // Phase status
  phaseStatus: PhaseStatusMap;

  // Activity
  activityLog: ActivityLogEntry[];

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

  /** Callback to export project (optional, injected from app) */
  onExport?: () => void;

  /** Callback to delete project (optional, injected from app) */
  onDelete?: () => void;
}

export const GeneralTab: React.FC<GeneralTabProps> = ({
  data,
  phases,
  getStatusIcon,
  getStatusColor,
  onUpdate,
  onExport,
  onDelete,
}) => {
  const { t } = useTranslation();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

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
  };

  // Map data to ProjectProgressData interface
  const progressData: ProjectProgressData = useMemo(() => {
    // Build validation info for each phase
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

  // Handle info updates
  const handleInfoUpdate = (info: ProjectInfoData) => {
    onUpdate({
      ...data,
      ...info,
    });
  };

  // Handle settings updates
  const handleSettingsUpdate = (settings: ProjectSettingsData) => {
    onUpdate({
      ...data,
      settings,
    });
  };

  // Handle delete
  const handleDeleteClick = () => {
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = () => {
    setShowDeleteDialog(false);
    onDelete?.();
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

      <ActivityLog entries={data.activityLog} />

      <div className="flex gap-3">
        {onExport && (
          <Button variant="primary" onClick={onExport}>
            {t("project.exportProject")}
          </Button>
        )}
        {onDelete && (
          <Button variant="danger" onClick={handleDeleteClick}>
            {t("project.deleteProject")}
          </Button>
        )}
      </div>

      {/* Delete Confirmation Dialog - from shared */}
      {showDeleteDialog && (
        <ConfirmDeleteDialog
          itemName={data.name}
          itemType="project"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setShowDeleteDialog(false)}
        />
      )}
    </div>
  );
};
