// ==================== DFD TYPES ====================
// Single Responsibility: Type definitions for DFD-related data structures

import type { PhaseStatusMap } from "shared";

// ==================== DFD ELEMENT TYPES ====================

export type DFDElementType =
  | "ExternalEntity"
  | "Process"
  | "Multiprocess"
  | "DataStore"
  | "DataFlow"
  | "TrustBoundary"
  | "PhysicalInterface"
  | "Asset"
  | "Interface";

export type SecurityLevel = "public" | "internal" | "confidential" | "secret";
export type TrustLevel = "trusted" | "untrusted" | "unknown";

export interface DFDElement {
  id: string;
  type: DFDElementType;
  name: string;
  description: string;
  displayId: string;
  position: { x: number; y: number };
  size: { width: number; height: number };

  // Semantic / logical properties (from description panel)
  properties: Record<string, unknown> & {
    description?: string;
    protocol?: string;
    encrypted?: boolean;
    dataType?: string;

    // Threat modeling fields (optional)
    securityLevel?: SecurityLevel;
    authenticationRequired?: boolean;
    encryptionRequired?: boolean;
    securityNotes?: string;
  };
}

export interface DFDConnection {
  id: string;
  from: string;
  to: string;
  label?: string;
  displayId: string;

  // Visual layout (from draw.io)
  waypoints?: Array<{ x: number; y: number }>;
  sourcePoint?: { x: number; y: number };
  targetPoint?: { x: number; y: number };
  offset?: { x: number; y: number };

  curved?: boolean;
  arrow?: {
    start?: string; // z.B. "classic"
    end?: string; // z.B. "classic"
    bidirectional?: boolean;
  };

  // Semantic / logical properties (from description panel)
  properties?: {
    description?: string;
    protocol?: string;
    encrypted?: boolean;
    dataType?: string;

    // Threat modeling fields (optional)
    securityLevel?: SecurityLevel;
    authenticationRequired?: boolean;
    encryptionRequired?: boolean;
    securityNotes?: string;
  };
}

export interface DFDValidation {
  isComplete: boolean;
  errors: string[];
  warnings: string[];
  lastValidated: string;
}

export interface DFDStats {
  totalElements: number;
  externalEntities: number;
  processes: number;
  multiprocesses: number;
  dataStores: number;
  dataFlows: number;
  trustBoundaries: number;
  physicalInterfaces: number;
  assets: number;
  interfaces: number;

  // Description completion stats
  describedElements: number;
  describedConnections: number;
}

export interface DFDData {
  xml?: string;
  elements: DFDElement[];
  connections: DFDConnection[];
  validation?: DFDValidation;
  stats?: DFDStats;
  lastModified?: string;
  thumbnail?: string;
}

// ==================== DFD EXPORT/IMPORT ====================

export interface DFDExportData {
  version: string; // Format version for future compatibility
  projectName: string;
  exportDate: string;
  xml: string;
  elements: DFDElement[];
  connections: DFDConnection[];
}

// ==================== DFD PROJECT INTERFACE ====================
// DFD feature only needs these fields from Project
// This is what DFD receives from app layer (Dependency Inversion)

export interface DFDProjectData {
  id: string;
  name: string;
  dfd: DFDData | null;
  phaseStatus: PhaseStatusMap;
  settings: {
    autoSave: boolean;
    autoSaveInterval?: number;
  };
  lastModified: string;
}

// ==================== DFD UPDATE RESULT ====================
// What DFD returns to APP after updates

export interface DFDUpdateResult {
  dfd: DFDData;
  phaseStatus: PhaseStatusMap;
  lastModified: string;
}

// ==================== DFD TAB PROPS ====================
// Props interface for DFDTab component - uses DFDProjectData instead of Project

export interface DFDTabProps {
  project: DFDProjectData;
  onUpdate: (updates: DFDUpdateResult) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  onPhaseComplete?: () => void;
}

// ==================== DFD VIEW MODE ====================

export type DFDViewMode = "draw" | "describe";

// ==================== DFD CONSTANTS ====================

export const DFD_ELEMENT_CONFIG: Record<
  DFDElementType,
  {
    name: string;
    nameDE: string;
    description: string;
    icon: string;
  }
> = {
  ExternalEntity: {
    name: "External Entity",
    nameDE: "Externe Entität",
    description: "User, external system or device",
    icon: "▭",
  },
  Process: {
    name: "Process",
    nameDE: "Prozess",
    description: "Processes or transforms data",
    icon: "○",
  },
  Multiprocess: {
    name: "Multiprocess",
    nameDE: "Multiprozess",
    description: "Multiple instances of a process",
    icon: "◎",
  },
  DataStore: {
    name: "Data Store",
    nameDE: "Datenspeicher",
    description: "Database, file or registry",
    icon: "║",
  },
  DataFlow: {
    name: "Data Flow",
    nameDE: "Datenfluss",
    description: "Data transfer between elements",
    icon: "→",
  },
  TrustBoundary: {
    name: "Trust Boundary",
    nameDE: "Trust Boundary",
    description: "Boundary between trust zones",
    icon: "┌",
  },
  PhysicalInterface: {
    name: "Physical Interface",
    nameDE: "Physische Schnittstelle",
    description: "USB, UART, JTAG, etc.",
    icon: "▢",
  },
  Asset: {
    name: "Asset",
    nameDE: "Asset",
    description: "Asset label for elements",
    icon: "A",
  },
  Interface: {
    name: "Interface",
    nameDE: "Schnittstelle",
    description: "Interface connection point",
    icon: "⊡",
  },
};