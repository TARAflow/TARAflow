// ==================== OVERVIEW TYPES ====================
// Data structures for the Overview/General feature
// These define the shape of data this feature works with

import type {
  PhaseStatusMap,
  ProjectTags,
  RegulationPresetId,
  SourceBinding,
  ValidationResult,
  WindowOfOpportunity,
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
  /**
   * Project-global Window of Opportunity (EN 50742 Approach A, Annex B, Table
   * B.3 — prEN 50742:2025 §3.3). Only meaningful when the project's regulation
   * tags resolve to the `en-50742-a` preset (regulationPresetFromTags); the
   * orchestrator threads this value onto
   * RiskConfiguration.windowOfOpportunity via threadWindowOfOpportunity() —
   * it is NOT a per-risk factor. Undefined until the analyst sets it.
   */
  windowOfOpportunity?: WindowOfOpportunity;
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
  /**
   * Project-wide regulation preset (single-select). Undefined → treated as the
   * default ("owasp"). Drives which likelihood factors the risk config uses;
   * see regulation-preset-service.applyRegulationPreset.
   */
  regulationPreset?: RegulationPresetId;
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

  /**
   * Project-level source-repository references (Source Version Binding,
   * implementation plan §3.5) — "this TARA was performed against repo X,
   * release Y". An analysis/evidence reference, deliberately NOT implied to
   * apply to every element automatically; element-level bindings on
   * Function/Process/System Asset properties are a separate, non-inheriting
   * collection. Rendered as its own section in GeneralTab, after
   * ProjectSettings (plan §4). Undefined/empty is the normal case — this is
   * an optional documentation reference, not a required field.
   */
  sourceBindings?: SourceBinding[];

  // Validation results (optional)
  dfdValidation?: ValidationResult;
  assetsValidation?: ValidationResult;
  threatsValidation?: ValidationResult;
}