// ==================== OVERVIEW TYPES ====================
// Data structures for the Overview/General feature
// These define the shape of data this feature works with

import type {
  PhaseStatusMap,
  ValidationResult,
  ActivityLogEntry,
} from "shared";

// ==================== OVERVIEW-SPECIFIC TYPES ====================
/**
 * Overview-specific aggregation for UI display
 * Transforms ValidationResult (errors[], warnings[]) into counts
 */
export interface PhaseValidationInfo {
  errors: number;
  warnings: number;
}


// ==================== PROJECT INFO ====================

export interface ProjectInfoData {
  name: string;
  description: string;
  version: string;
  responsible: string;
  created: string;
  lastModified: string;
  tags: string[];
  team: string[];
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

  phaseStatus: PhaseStatusMap;
  activityLog: ActivityLogEntry[];
  dfdValidation?: ValidationResult;
  assetsValidation?: ValidationResult;
  threatsValidation?: ValidationResult;
}