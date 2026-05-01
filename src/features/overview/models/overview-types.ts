// ==================== OVERVIEW TYPES ====================
// Data structures for the Overview/General feature
// These define the shape of data this feature works with

import type { PhaseStatusMap, ValidationResult } from "shared";
import { TAG_CATEGORIES, TagCategoryKey, getTagCategory } from "shared";

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
}
export interface PhaseValidationInfo {
  errors: number;
  warnings: number;
}

export interface ProjectTags {
  domain: string[]; // Industrial, Medical, Automotive...
  platform: string[]; // Embedded, OT, Cloud, Web...
  regulation: string[]; // IEC 62443, CRA, ISO 21434...
  custom: string[]; // Free tags — no category validation
}

export const EMPTY_PROJECT_TAGS: ProjectTags = {
  domain: [],
  platform: [],
  regulation: [],
  custom: [],
};

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
 * 7 = Audit
 * 8 = Integration
 */

/**
 * Standard workflow order (non-critical systems):
 * General → DFD → Assets → Threats → Risks → Attack Tree → Documentation
 */
export const STANDARD_PHASE_ORDER = [0, 1, 2, 3, 4, 5, 6, 7];

/**
 * Critical workflow order (high-impact systems):
 * General → DFD → Assets → Attack Tree → Threats → Risks → Documentation
 *
 * Attack Trees come before Threats because for critical systems,
 * understanding attack paths helps inform threat identification.
 */
export const CRITICAL_PHASE_ORDER = [0, 1, 2, 5, 3, 4, 6, 7];

/**
 * Get the workflow mode based on settings
 */
export const getWorkflowMode = (settings: ProjectInfoData): WorkflowMode => {
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

/**
 * Migrate legacy string[] tags to ProjectTags.
 * Called on project load/import. Idempotent — safe to call on already-migrated data.
 */
export function migrateProjectTags(
  raw: string[] | ProjectTags,
  customTagCategories: Record<string, TagCategoryKey> = {}
): ProjectTags {
  if (!Array.isArray(raw)) return raw; // Already ProjectTags
 
  const result: ProjectTags = { ...EMPTY_PROJECT_TAGS };
  for (const tag of raw) {
    const cat = getTagCategory(tag, customTagCategories);
    const bucket = (cat?.key ?? "custom") as keyof ProjectTags;
    (result[bucket] as string[]).push(tag);
  }
  return result;
}
 
/**
 * Add a tag to the correct bucket. Prevents duplicates across all buckets.
 * categoryOverride: used for custom tags where auto-detection fails.
 */
export function addTagToProject(
  tags: ProjectTags,
  tagName: string,
  categoryOverride?: TagCategoryKey
): ProjectTags {
  const trimmed = tagName.trim();
  if (!trimmed) return tags;
 
  // Duplicate check across all buckets
  if (flattenProjectTags(tags).includes(trimmed)) return tags;
 
  const cat = categoryOverride
    ? TAG_CATEGORIES.find((c) => c.key === categoryOverride)
    : getTagCategory(trimmed, {});
 
  const bucket = (cat?.key ?? "custom") as keyof ProjectTags;
  return { ...tags, [bucket]: [...(tags[bucket] as string[]), trimmed] };
}
 
/**
 * Remove a tag from whichever bucket it lives in.
 */
export function removeTagFromProject(
  tags: ProjectTags,
  tagName: string
): ProjectTags {
  return {
    domain:     tags.domain.filter((t) => t !== tagName),
    platform:   tags.platform.filter((t) => t !== tagName),
    regulation: tags.regulation.filter((t) => t !== tagName),
    custom:     tags.custom.filter((t) => t !== tagName),
  };
}
 
/**
 * Flatten ProjectTags to string[] — used for backwards-compat checks
 * and validation counts.
 */
export function flattenProjectTags(tags: ProjectTags): string[] {
  return [
    ...tags.domain,
    ...tags.platform,
    ...tags.regulation,
    ...tags.custom,
  ];
}
 
/**
 * Type guard — checks if a value is already ProjectTags (not string[]).
 */
export function isProjectTags(value: unknown): value is ProjectTags {
  return (
    typeof value === "object" &&
    value !== null &&
    "domain" in value &&
    "platform" in value &&
    "regulation" in value &&
    "custom" in value
  );
}