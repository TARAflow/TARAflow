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

import { DFDGraph } from "./dfd-graph-types";
import { DFDGraphAnalysisContext } from "../adapters/dfd-graph-analysis-context";
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
  | "stores" // Element stores the asset (DataStore)
  | "read" // Element reads or computes on the asset without modifying it
  | "modify" // Element actively modifies or overwrites the asset
  | "creates" // Element creates the asset (Process, ExternalEntity)
  | "deletes" //  Element destroys the asset (Process, ExternalEntity)
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
 * @see dfd-constants.ts for the actual configuration
 */
export { ALLOWED_ASSET_RELATIONS } from "./dfd-constants";

// ==================== DFD ELEMENTS ====================

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
  graph?: DFDGraph;
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

// ==================== RE-EXPORTS FROM OTHER FILES ====================
// These are re-exported for backward compatibility
// Import directly from dfd-constants.ts or dfd-formatters.ts in new code

export { DFD_ELEMENT_CONFIG } from "./dfd-constants";
export {
  type DocLanguage,
  getSecurityLevelText,
  getTrustLevelText,
  getDFDElementTypeText,
  getDFDElementTypePluralText,
  getAllowedAssetRelations,
  isAssetRelationAllowed,
  getAssetRelationTypeText,
} from "./dfd-formatters";