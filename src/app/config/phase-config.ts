import { PhaseStatus } from "shared";

// ==================== HELPER FUNCTIONS ====================

export const calculatePhaseProgress = (
  phaseStatus: Record<number, PhaseStatus>
): number => {
  const statuses = Object.values(phaseStatus);
  const completed = statuses.filter((s) => s === "complete").length;
  return Math.round((completed / statuses.length) * 100);
};

export const isPhaseAccessible = (
  targetPhase: number,
  currentPhaseStatus: Record<number, PhaseStatus>,
  strictMode: boolean
): { accessible: boolean; reason?: string } => {
  if (targetPhase === 0) {
    return { accessible: true };
  }

  if (!strictMode) {
    return { accessible: true };
  }

  // In strict mode, previous phase must be complete
  const previousPhase = targetPhase - 1;
  const previousStatus = currentPhaseStatus[previousPhase];

  if (previousStatus !== "complete") {
    return {
      accessible: false,
      reason: `Phase ${previousPhase} must be completed before accessing Phase ${targetPhase}`,
    };
  }

  return { accessible: true };
};

// ==================== CONSTANTS ====================

export const MAX_OPEN_PROJECTS = 10;
export const DEFAULT_AUTO_SAVE_INTERVAL = 30; // seconds
export const RECENT_PROJECTS_LIMIT = 10;
export const ACTIVITY_LOG_DISPLAY_LIMIT = 5;

// ==================== PREDEFINED TAGS ====================

export const PREDEFINED_TAGS = [
  "Web",
  "Mobile",
  "Cloud",
  "Embedded",
  "Desktop",
  "System",
  "IoT",
  "Industrial",
  "Medical",
  "Railway",
  "Public",
  "API",
  "Database",
  "Network",
  "high-priority",
  "low-priority",
  "critical",
  "legacy",
  "new-development",
] as const;

// ==================== STRIDE CONFIGURATION ====================

export const STRIDE_CATEGORIES = [
  {
    key: "S",
    label: "Spoofing",
    description: "Authentication threats",
    color: "#ef4444",
  },
  {
    key: "T",
    label: "Tampering",
    description: "Integrity threats",
    color: "#f97316",
  },
  {
    key: "R",
    label: "Repudiation",
    description: "Non-repudiation threats",
    color: "#eab308",
  },
  {
    key: "I",
    label: "Information Disclosure",
    description: "Confidentiality threats",
    color: "#3b82f6",
  },
  {
    key: "D",
    label: "Denial of Service",
    description: "Availability threats",
    color: "#8b5cf6",
  },
  {
    key: "E",
    label: "Elevation of Privilege",
    description: "Authorization threats",
    color: "#ec4899",
  },
] as const;

export const STRIDE_METHOD_INFO = {
  "per-element": {
    label: "STRIDE-per-Element",
    description:
      "Analyzes each DFD element individually against all applicable STRIDE threats",
    icon: "🔍",
    effort: "High",
    coverage: "Excellent",
    bestFor: [
      "Closed systems with limited external interfaces",
      "Safety-critical systems requiring exhaustive analysis",
      "Regulatory compliance (e.g., automotive ISO 21434)",
    ],
  },
  "per-interaction": {
    label: "STRIDE-per-Interaction",
    description: "Analyzes data flows and interactions between components",
    icon: "🔗",
    effort: "Medium",
    coverage: "Good",
    bestFor: [
      "Web applications and APIs",
      "Distributed/microservices architectures",
      "Cloud-native systems with many external services",
    ],
  },
} as const;
