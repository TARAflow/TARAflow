// ==================== OVERVIEW TYPES ====================
// Data structures for the Overview/General feature
// These define the shape of data this feature works with

import type {
  PhaseStatusMap,
  ProjectTags,
  ValidationResult,
  WorkflowMode,
} from "shared";

// ==================== OVERVIEW-SPECIFIC TYPES ====================
/**
 * Overview-specific aggregation for UI display
 * Transforms ValidationResult (errors[], warnings[]) into counts
 */

// ==================== PROJECT INFO ====================
export interface ProjectInfoData {
  name: string;
  description: string;
  version: string;
  responsible: string;
  created: string;
  lastModified: string;
  tags: ProjectTags;
  team: string[];
  isHighImpact: boolean; // Required field
  /**
   * Safety relevance. When true, the Hazard tab is shown directly after
   * Overview and before DFD (independent of Standard/Critical). Default: false.
   */
  safetyRelevant?: boolean;
}
export interface PhaseValidationInfo {
  errors: number;
  warnings: number;
}

// ==================== PROJECT SETTINGS ====================

export interface ProjectSettingsData {
  strictMode: boolean;
  autoSave: boolean;
  autoSaveInterval?: number;
}

// ==================== PROJECT PROGRESS ====================

export interface ProjectProgressData {
  phaseStatus: PhaseStatusMap;
  /** Validation info per phase (optional) */
  validationInfo?: Record<number, PhaseValidationInfo>;
}

// ==================== PROJECT STATUS CONFIGURATION ====================

export const PROJECT_STATUS_CONFIG = {
  draft: {
    icon: "📝",
    color: "#6b7280",
    label: "Draft",
  },
  "in-progress": {
    icon: "🟡",
    color: "#f59e0b",
    label: "In Progress",
  },
  review: {
    icon: "👀",
    color: "#3b82f6",
    label: "Under Review",
  },
  complete: {
    icon: "✅",
    color: "#10b981",
    label: "Complete",
  },
} as const;

// ==================== GENERAL TAB ====================
// Main data structure for the General/Overview tab

export interface GeneralTabData {
  // Project info
  info: ProjectInfoData;

  // Settings
  settings: ProjectSettingsData;

  // Phase status
  phaseStatus: PhaseStatusMap;

  // Validation results (optional)
  dfdValidation?: ValidationResult;
  assetsValidation?: ValidationResult;
  threatsValidation?: ValidationResult;
}
