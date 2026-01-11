// ==================== COMMON TYPES ====================
// Shared types used across app and features
// These types are "owned" by no one - they are shared contracts

// ==================== STATUS TYPES ====================

export type PhaseStatus = keyof typeof PHASE_STATUS_CONFIG;
export type PhaseStatusVariant = typeof PHASE_STATUS_CONFIG[PhaseStatus]['variant'];

export type ProjectStatus = "draft" | "in-progress" | "review" | "complete";

export type StrideMethod = "per-element" | "per-interaction";

export type StrideCategory = "S" | "T" | "R" | "I" | "D" | "E";

export const PHASES: PhaseDefinition[] = [
  {
    id: 0,
    label: "General",
    shortLabel: "Info",
    description: "Project information and settings",
    icon: "📋",
  },
  {
    id: 1,
    label: "1 - DFD",
    shortLabel: "DFD",
    description: "Data Flow Diagram modeling",
    icon: "📊",
  },
  {
    id: 2,
    label: "2 - Assets",
    shortLabel: "Assets",
    description: "Asset identification and security goals",
    icon: "🛡️",
  },
  {
    id: 3,
    label: "3 - Threats",
    shortLabel: "Threats",
    description: "Threat identification and mitigation",
    icon: "⚠️",
  },
  {
    id: 4,
    label: "4 - Risk",
    shortLabel: "Risk",
    description: "Risk assessment and prioritization",
    icon: "📈",
  },
  {
    id: 5,
    label: "5 - Attack Tree",
    shortLabel: "Attack Tree",
    description: "Attack tree modeling and analysis of threat paths",
    icon: "🌳",
  },
  {
    id: 6,
    label: "6 - Documentation",
    shortLabel: "Docs",
    description: "Threat model documentation and reporting",
    icon: "📄",
  },
];

// ==================== COMMON INTERFACES ====================

export interface PhaseDefinition {
  id: number;
  label: string;
  shortLabel: string;
  description: string;
  icon?: string;
}

export interface PhaseStatusMap {
  0: PhaseStatus; // General
  1: PhaseStatus; // DFD
  2: PhaseStatus; // Assets
  3: PhaseStatus; // Threats
  4: PhaseStatus; // Risk
  5: PhaseStatus; // Attack Tree
  6: PhaseStatus; // Documentation
}

// Generic Validation Pattern
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ==================== PHASE STATUS CONFIGURATION ====================

export const PHASE_STATUS_CONFIG = {
  'not-started': {
    icon: "○",
    color: "#9ca3af",
    label: "Not Started",
    bgColor: "#f3f4f6",
    variant: 'default',
  },
  'in-progress': {
    icon: "⚙",
    color: "#2563eb",
    label: "In Progress",
    bgColor: "#dbeafe",
    variant: 'info',
  },
  incomplete: {
    icon: "⚠",
    color: "#dc2626",
    label: "Incomplete",
    bgColor: "#fee2e2",
    variant: 'danger',
  },
  complete: {
    icon: "✓",
    color: "#16a34a",
    label: "Complete",
    bgColor: "#dcfce7",
    variant: 'success',
  },
    blocked: {
    icon: "⛔",
    color: "#7c2d12",
    label: "Blocked",
    bgColor: "#ffedd5",
    variant: 'warning',
  },
  unknown: {
    icon: "?",
    color: "#6b7280",
    label: "Unknown",
    bgColor: "#f9fafb",
    variant: 'warning',
  },
} as const;

export const getPhaseStatusConfig = (status: string) => {
  return PHASE_STATUS_CONFIG[status as PhaseStatus] ?? PHASE_STATUS_CONFIG.unknown;
};

export const getPhaseStatusIcon = (status: string) => getPhaseStatusConfig(status).icon;

export const getPhaseStatusColor = (status: string) => getPhaseStatusConfig(status).color;

export const getPhaseStatusLabel = (status: string) => getPhaseStatusConfig(status).label;

export const getPhaseStatusBgColor = (status: string) => getPhaseStatusConfig(status).bgColor;

// ==================== UI CALLBACK TYPES ====================

/**
 * Standard callback for confirmation dialogs
 */
export interface ConfirmDialogProps {
  itemName: string;
  itemType?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// ==================== Color TYPES ====================

export const STRIDE_COLORS: Record<StrideCategory, string> = {
  S: "#ef4444", // red
  T: "#f97316", // orange
  R: "#eab308", // yellow
  I: "#22c55e", // green
  D: "#3b82f6", // blue
  E: "#a855f7", // purple
};
