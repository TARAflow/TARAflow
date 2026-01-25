// ==================== DFD TYPES ====================
// Single Responsibility: Type definitions for DFD-related data structures

import type { PhaseStatusMap } from "shared";
import type {
  ProcessProperties,
  ExternalEntityProperties,
  DataStoreProperties,
  DataFlowProperties,
  InterfaceProperties,
  TrustBoundaryProperties,
  AssetProperties,
} from "./element-properties";


// ==================== DFD ELEMENT TYPES ====================

export type DFDElementType =
  | "ExternalEntity"
  | "Process"
  | "Multiprocess"
  | "DataStore"
  | "DataFlow"
  | "TrustBoundary"
  | "Interface";

export type SecurityLevel = "public" | "internal" | "confidential" | "secret";
export type TrustLevel = "trusted" | "untrusted" | "unknown";

// ==================== ASSET RELATIONS ====================

/**
 * Types of relationships between DFD elements and assets
 */
export type AssetRelationType =
  | "stores"      // Element stores the asset (DataStore)
  | "processes"   // Element processes the asset (Process, ExternalEntity)
  | "creates"     // Element creates/destroys the asset (Process, ExternalEntity)
  | "transports"; // Element transports the asset (DataFlow, Interface)

/**
 * Asset relation from Element perspective (Element → Asset)
 */
export interface AssetRelation {
  /** Asset ID (e.g., "A-001") */
  assetId: string;
  
  /** Types of relations (multiple possible for same asset) */
  relationTypes: AssetRelationType[];
  
  /** Optional notes about this relationship */
  notes?: string;
}

/**
 * Element relation from Asset perspective (Asset → Element)
 * This is the mirrored representation stored in DFDAsset
 */
export interface ElementRelation {
  /** Element XML ID */
  elementId: string;
  
  /** Element name */
  elementName: string;
  
  /** Element type */
  elementType: DFDElementType;
  
  /** Display ID (e.g., "P-1", "DS-1") */
  displayId: string;
  
  /** Types of relations (mirrored from AssetRelation) */
  relationTypes: AssetRelationType[];
  
  /** Optional notes about this relationship */
  notes?: string;
}

/**
 * Allowed asset relation types per DFD element type
 */
export const ALLOWED_ASSET_RELATIONS: Record<DFDElementType, AssetRelationType[]> = {
  Process: ["processes", "creates"],
  ExternalEntity: ["processes", "creates"],
  DataStore: ["stores"],
  DataFlow: ["transports"],
  Multiprocess: ["processes", "creates"],
  Interface: ["transports", "processes", "stores"],
  TrustBoundary: [], // No asset relations for trust boundaries
};

/**
 * Semantic properties for DFD elements and assets
 * @deprecated Use specific property interfaces from element-properties.ts
 */
export interface ElementProperties {
  description?: string;
  protocol?: string;
  encrypted?: boolean;
  dataType?: string;

  // Threat modeling fields
  securityLevel?: SecurityLevel;
  trustLevel?: TrustLevel;
  authenticationRequired?: boolean;
  encryptionRequired?: boolean;
  securityNotes?: string;
}

// ==================== DFD ASSET ====================

/**
 * Asset annotation in DFD
 * Multiple asset labels with same name are consolidated
 */
export interface DFDAsset {
  /** Asset identifier (e.g. "A-001") - user-defined, can change */
  id: string;

  /** Display ID (same as id for consistency) */
  displayId: string;

  /** Asset name */
  name: string;

  /** XML element IDs from draw.io (stable, multiple if placed multiple times) */
  xmlIds: string[];

  /** Positions where this asset is placed (one per xmlId) */
  positions: Array<{ x: number; y: number }>;

  /** Sizes of asset labels (one per xmlId) */
  sizes: Array<{ width: number; height: number }>;

  /** DFD elements this asset is related to (with relation types) */
  linkedElements?: ElementRelation[];

  /** Asset-specific properties */
  properties?: AssetProperties;
}

// ==================== DFD ELEMENTS ====================

export interface DFDElement {
  id: string;
  type: DFDElementType;
  name: string;
  displayId: string;
  position: { x: number; y: number };
  size: { width: number; height: number };

  /** Asset relations (Element → Assets with relation types) */
  assetRelations?: AssetRelation[];

  /** Element-specific properties (type depends on element.type) */
  properties:
    | ProcessProperties
    | ExternalEntityProperties
    | DataStoreProperties
    | InterfaceProperties
    | TrustBoundaryProperties;
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

  /** Asset relations (DataFlow → Assets) */
  assetRelations?: AssetRelation[];

  /** DataFlow-specific properties */
  properties?: DataFlowProperties;
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
  interfaces: number; // Includes former PhysicalInterface elements
  assets: number; // Count of unique asset IDs (not placements)

  // Description completion stats
  describedElements: number;
  describedAssets: number;
  describedConnections: number;
}

export interface DFDData {
  xml?: string;
  elements: DFDElement[];
  connections: DFDConnection[];
  assets: DFDAsset[];
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
  assets: DFDAsset[];
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
  Interface: {
    name: "Interface",
    nameDE: "Schnittstelle",
    description: "Physical/logical interface (USB, UART, Ethernet, etc.)",
    icon: "▢",
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
    Interface: { en: "Interfaces", de: "Schnittstellen" },
  };
  return plurals[type]?.[language] ?? getDFDElementTypeText(type, language);
}

/**
 * Get allowed asset relation types for a given element type
 */
export function getAllowedAssetRelations(
  elementType: DFDElementType
): AssetRelationType[] {
  return ALLOWED_ASSET_RELATIONS[elementType] || [];
}

/**
 * Check if a relation type is allowed for an element type
 */
export function isAssetRelationAllowed(
  elementType: DFDElementType,
  relationType: AssetRelationType
): boolean {
  return ALLOWED_ASSET_RELATIONS[elementType]?.includes(relationType) ?? false;
}

/**
 * Get human-readable text for asset relation type
 */
export function getAssetRelationTypeText(
  relationType: AssetRelationType,
  language: DocLanguage = "en"
): string {
  const labels: Record<AssetRelationType, { en: string; de: string }> = {
    stores: { en: "Stores", de: "Speichert" },
    processes: { en: "Processes", de: "Verarbeitet" },
    creates: { en: "Creates/Destroys", de: "Erzeugt/Vernichtet" },
    transports: { en: "Transports", de: "Transportiert" },
  };
  return labels[relationType]?.[language] ?? relationType;
}