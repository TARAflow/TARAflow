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
  isHighImpact?: boolean; // For display in Project Info
}

// ==================== PROJECT SETTINGS ====================

export interface ProjectSettingsData {
  strictMode: boolean;
  autoSave: boolean;
  autoSaveInterval?: number;
  isHighImpact?: boolean; // Critical System flag - changes workflow order
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

// ==================== WORKFLOW TYPES ====================

export type WorkflowMode = "standard" | "critical";

/**
 * Phase IDs:
 * 0 = General
 * 1 = DFD
 * 2 = Assets
 * 3 = Threats
 * 4 = Risks
 * 5 = Attack Tree
 * 6 = Documentation
 */

/**
 * Standard workflow order (non-critical systems):
 * General → DFD → Assets → Threats → Risks → Attack Tree → Documentation
 */
export const STANDARD_PHASE_ORDER = [0, 1, 2, 3, 4, 5, 6];

/**
 * Critical workflow order (high-impact systems):
 * General → DFD → Assets → Attack Tree → Threats → Risks → Documentation
 *
 * Attack Trees come before Threats because for critical systems,
 * understanding attack paths helps inform threat identification.
 */
export const CRITICAL_PHASE_ORDER = [0, 1, 2, 5, 3, 4, 6];

/**
 * Get the workflow mode based on settings
 */
export const getWorkflowMode = (
  settings: ProjectSettingsData
): WorkflowMode => {
  return settings.isHighImpact ? "critical" : "standard";
};

/**
 * Get the phase order based on workflow mode
 */
export const getPhaseOrder = (mode: WorkflowMode): number[] => {
  return mode === "critical" ? CRITICAL_PHASE_ORDER : STANDARD_PHASE_ORDER;
};

/**
 * Get the display index for a phase based on workflow mode
 * (used for tab ordering)
 */
export const getPhaseDisplayIndex = (
  phaseId: number,
  mode: WorkflowMode
): number => {
  const order = getPhaseOrder(mode);
  return order.indexOf(phaseId);
};

/**
 * Get next phase ID based on current phase and workflow mode
 */
export const getNextPhase = (
  currentPhase: number,
  mode: WorkflowMode
): number | null => {
  const order = getPhaseOrder(mode);
  const currentIndex = order.indexOf(currentPhase);

  if (currentIndex === -1 || currentIndex >= order.length - 1) {
    return null;
  }

  return order[currentIndex + 1];
};

/**
 * Get previous phase ID based on current phase and workflow mode
 */
export const getPreviousPhase = (
  currentPhase: number,
  mode: WorkflowMode
): number | null => {
  const order = getPhaseOrder(mode);
  const currentIndex = order.indexOf(currentPhase);

  if (currentIndex <= 0) {
    return null;
  }

  return order[currentIndex - 1];
};

/**
 * Sort phases array according to workflow mode
 */
export const sortPhasesByWorkflow = <T extends { id: number }>(
  phases: T[],
  mode: WorkflowMode
): T[] => {
  const order = getPhaseOrder(mode);
  return [...phases].sort((a, b) => {
    const indexA = order.indexOf(a.id);
    const indexB = order.indexOf(b.id);
    return indexA - indexB;
  });
};