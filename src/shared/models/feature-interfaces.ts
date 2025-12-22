// ==================== FEATURE TAB INTERFACES ====================
// Interfaces that define what features need from the app
// This follows the Dependency Inversion Principle:
// - Features define what they need (interfaces)
// - App provides the implementations

import { PhaseStatus, PhaseStatusMap, StrideMethod, ProjectStatus } from "./common-types";

// ==================== PROJECT INTERFACE ====================
// Minimal project interface that features can read from
// Features should NOT import the full Project type from app/

export interface ProjectData {
  id: string;
  name: string;
  description: string;
  version: string;
  responsible: string;
  created: string;
  lastModified: string;
  currentPhase: number;
  phaseStatus: PhaseStatusMap;
  status: ProjectStatus;
  strideMethod: StrideMethod | null;
  methodSelected: boolean;
  settings: {
    strictMode: boolean;
    autoSave: boolean;
    autoSaveInterval?: number;
  };
  tags: string[];
  team: string[];
}

// ==================== FEATURE TAB PROPS ====================
// Standard props that all feature tabs receive

export interface FeatureTabProps<TData = unknown> {
  /** The current project (read-only view) */
  project: ProjectData;
  
  /** Feature-specific data from the project */
  data: TData;
  
  /** Callback to update project data */
  onUpdate: (updates: Partial<ProjectData> & { data?: TData }) => void;
}

// ==================== SERVICE INTERFACES ====================
// Interfaces for services that features might need
// App injects concrete implementations

export interface ExportService {
  exportAsJSON: (data: unknown, filename: string) => void;
}

export interface StorageService {
  save: (key: string, data: unknown) => Promise<boolean>;
  load: <T>(key: string) => Promise<T | null>;
}

// ==================== ACTION HANDLERS ====================
// Callbacks that app provides to features

export interface ProjectActions {
  onExport?: (projectId: string) => void;
  onDelete?: (projectId: string) => void;
  onSave?: (projectId: string) => void;
}
