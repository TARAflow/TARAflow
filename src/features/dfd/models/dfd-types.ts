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
    trustLevel?: TrustLevel;
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
    trustLevel?: TrustLevel;
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

// ==================== HELPER FUNCTIONS ====================

export type DocLanguage = "en" | "de";

/**
 * Get security level text
 */
export function getSecurityLevelText(
  level: SecurityLevel | undefined,
  language: DocLanguage = "en"
): string {
  if (!level) return language === "de" ? "Keine" : "None";
  
  const labels: Record<SecurityLevel, { en: string; de: string }> = {
    public: { en: "Public", de: "Öffentlich" },
    internal: { en: "Internal", de: "Intern" },
    confidential: { en: "Confidential", de: "Vertraulich" },
    secret: { en: "Secret", de: "Geheim" },
  };
  return labels[level]?.[language] ?? level;
}

/**
 * Get trust level text
 */
export function getTrustLevelText(
  level: TrustLevel | undefined,
  language: DocLanguage = "en"
): string {
  if (!level) return language === "de" ? "Unbekannt" : "Unknown";
  
  const labels: Record<TrustLevel, { en: string; de: string }> = {
    trusted: { en: "Trusted", de: "Vertrauenswürdig" },
    untrusted: { en: "Untrusted", de: "Nicht vertrauenswürdig" },
    unknown: { en: "Unknown", de: "Unbekannt" },
  };
  return labels[level]?.[language] ?? level;
}

/**
 * Get DFD element type text (singular)
 */
export function getDFDElementTypeText(
  type: DFDElementType,
  language: DocLanguage = "en"
): string {
  const config = DFD_ELEMENT_CONFIG[type];
  return language === "de" ? config.nameDE : config.name;
}

/**
 * Get DFD element type text (plural for section headers)
 */
export function getDFDElementTypePluralText(
  type: DFDElementType,
  language: DocLanguage = "en"
): string {
  const plurals: Record<DFDElementType, { en: string; de: string }> = {
    ExternalEntity: { en: "External Entities", de: "Externe Entitäten" },
    Process: { en: "Processes", de: "Prozesse" },
    Multiprocess: { en: "Multiprocesses", de: "Multiprozesse" },
    DataStore: { en: "Data Stores", de: "Datenspeicher" },
    DataFlow: { en: "Data Flows", de: "Datenflüsse" },
    TrustBoundary: { en: "Trust Boundaries", de: "Vertrauensgrenzen" },
    PhysicalInterface: { en: "Physical Interfaces", de: "Physische Schnittstellen" },
    Asset: { en: "Assets", de: "Assets" },
    Interface: { en: "Interfaces", de: "Schnittstellen" },
  };
  return plurals[type]?.[language] ?? getDFDElementTypeText(type, language);
}
