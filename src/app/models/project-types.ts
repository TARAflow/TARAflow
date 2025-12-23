import { DFDData } from "features/dfd";
import { AssetData } from "features/assets";
import { ActivityLogEntry, PhaseStatus, PhaseStatusMap } from "shared";
import { ThreatData } from "features/threats";

// ==================== PROJECT TYPES ====================

// export type PhaseStatus =
//   | "not-started"
//   | "in-progress"
//   | "incomplete"
//   | "complete";

export type ProjectStatus = "draft" | "in-progress" | "review" | "complete";

export type StrideMethod = "per-element" | "per-interaction";

// ==================== INTERFACES ====================

export interface ProjectSettings {
  strictMode: boolean;
  autoSave: boolean;
  autoSaveInterval?: number; // in seconds, default 30
}

// export interface ActivityLogEntry {
//   timestamp: string;
//   action: "CREATE" | "UPDATE" | "DELETE" | "EXPORT" | "IMPORT";
//   entity?:
//     | "project"
//     | "dfd"
//     | "asset"
//     | "threat"
//     | "risk"
//     | "attacktree"
//     | "documentation";
//   entityId?: string;
//   description: string;
// }

// export interface PhaseStatusMap {
//   0: PhaseStatus; // General
//   1: PhaseStatus; // DFD
//   2: PhaseStatus; // Assets
//   3: PhaseStatus; // Threats
//   4: PhaseStatus; // Risk
//   5: PhaseStatus; // Attack Tree
//   6: PhaseStatus; // Documentation
// }

// export interface Asset {
//   id: string;
//   name: string;
//   category: "Data" | "System" | "Infrastructure" | "Process" | "Human";
//   description?: string;
//   linkedDfdElement?: string;
//   location?: string;
//   dependencies?: string[];
//   responsible?: string;
//   criticality?: {
//     overall: "Critical" | "High" | "Medium" | "Low";
//     criteria: Record<string, "Critical" | "High" | "Medium" | "Low">;
//   };
//   strideRelevance?: {
//     S: boolean; // Spoofing
//     T: boolean; // Tampering
//     R: boolean; // Repudiation
//     I: boolean; // Information Disclosure
//     D: boolean; // Denial of Service
//     E: boolean; // Elevation of Privilege
//   };
//   securityGoals?: Array<{
//     category: "S" | "T" | "R" | "I" | "D" | "E";
//     goal: string;
//   }>;
// }

export interface ThreatMitigation {
  description: string;
  status: "Planned" | "In Progress" | "Implemented" | "Verified";
  implementedDate?: string;
}

export interface ThreatTesting {
  methods: string[];
  status:
    | "Not Tested"
    | "Testing Planned"
    | "Testing In Progress"
    | "Passed"
    | "Failed";
  results?: string;
  testedDate?: string;
}

export interface Threat {
  id: string;
  element: string; // DFD element ID
  assetIds: string[];
  strideType: "S" | "T" | "R" | "I" | "D" | "E";
  threat: string;
  attack?: string;
  threatActor?:
    | "Insider"
    | "External Attacker"
    | "Nation-State"
    | "Script Kiddie"
    | "Competitor"
    | "Other";
  attackVector?:
    | "Network"
    | "API"
    | "Physical"
    | "Social Engineering"
    | "Malware"
    | "Supply Chain"
    | "Other";
  mitigation?: ThreatMitigation;
  testing?: ThreatTesting;
  status: "Open" | "In Review" | "Resolved" | "Accepted";
  riskLevel?: "Critical" | "High" | "Medium" | "Low";
  created: string;
  modified: string;
  isManual: boolean;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  version: string;
  responsible: string;
  created: string;
  lastModified: string;
  lastOpened?: string;
  currentPhase: number;
  strideMethod: StrideMethod | null;
  methodSelected: boolean;
  phaseStatus: PhaseStatusMap;
  settings: ProjectSettings;
  tags: string[];
  team: string[];
  status: ProjectStatus;
  activityLog: ActivityLogEntry[];
  dfd: DFDData | null;
  assets: AssetData | null;
  threats: ThreatData | null;
  hasUnsavedChanges?: boolean;
  isOpen?: boolean;
}

// ==================== INPUT TYPES ====================

export interface CreateProjectInput {
  name: string;
  description: string;
  version?: string;
  responsible?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  version?: string;
  responsible?: string;
  tags?: string[];
  team?: string[];
  status?: ProjectStatus;
  settings?: Partial<ProjectSettings>;
}

// ==================== VALIDATION TYPES ====================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface PhaseValidation {
  phase: number;
  status: PhaseStatus;
  validation: ValidationResult;
  lastValidated: string;
}
