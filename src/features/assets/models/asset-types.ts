// ==================== ASSET TYPES ====================
// Core data models for the Assets feature
// NO dependency on app OR dfd - follows Dependency Inversion Principle

import type { PhaseStatusMap } from "shared";
import type {
  ImpactRating,
  ImpactScaleType,
  ImpactCalculationMethod,
  ImpactRoundingMethod,
} from "./asset-impact-types";
import type {
  SecurityGoal,
  SecurityGoalType,
} from "./asset-security-goals-types";
import { SECURITY_GOALS } from "./asset-security-goals-types";
import type {
  DFDAssetReference as AssetDFDAsset,
  DFDElementReference as AssetDFDElement,
  DFDConnectionReference as AssetDFDConnection,
  DFDElementLink,
} from "./dfd-reference-types";

// ==================== DFD INTERFACE TYPES (Asset's View) ====================
// What Assets needs to know about DFD elements - NO direct dependency on dfd-types

/**
 * Minimal DFD Asset info needed by Assets feature
 */
export type {
  AssetDFDAsset,
  AssetDFDElement,
  AssetDFDConnection,
  DFDElementLink,
};

// ==================== ASSET CONFIGURATION ====================

/**
 * Project-specific asset configuration
 */
export interface AssetConfiguration {
  /** Selected impact criteria IDs (4-6 recommended) */
  impactCriteria: string[];

  /** Impact rating scale */
  impactScale: ImpactScaleType;

  /** Calculation method for overall impact */
  calculationMethod: ImpactCalculationMethod;

  /** Rounding method for level threshold calculation */
  roundingMethod: ImpactRoundingMethod;
}

/**
 * Default configuration for new projects
 */
export const DEFAULT_ASSET_CONFIGURATION: AssetConfiguration = {
  impactCriteria: [
    "financial_damage",
    "regulatory_compliance",
    "reputation",
    "operational",
    "safety",
  ],
  impactScale: "4-level",
  calculationMethod: "conservative",
  roundingMethod: "round",
};

// ==================== ASSET DATA ====================

/**
 * Core Asset data structure
 */
export interface Asset {
  /** Unique ID (e.g., "A-001", "A-01", "A-1") */
  id: string;

  /** Numeric part for sorting and renumbering */
  numericId: number;

  /** Asset name/description */
  name: string;

  /** Impact ratings per criterion */
  impactRatings: ImpactRating[];

  /** Calculated overall impact (based on configuration) */
  overallImpact: number;

  /** Selected security goals with formal descriptions */
  securityGoals: SecurityGoal[];

  /** Linked DFD elements */
  linkedDFDElements: DFDElementLink[];

  /** Source: was this created from DFD or manually? */
  source: "dfd" | "manual";

  /** Is this asset synced with DFD? */
  syncedWithDFD: boolean;

  properties?: {
    description: string;
    category?: "data" | "system" | "infrastructure" | "process" | "human";
    protectionNeed?: "low" | "medium" | "high" | "critical";
    owner?: string;
    notes?: string;
    // Category-specific fields
    dataType?: string;
    dataClassification?: string;
    retentionPeriod?: string;
    systemType?: string;
    criticality?: string;
    backupInterval?: string;
    infrastructureType?: string;
    location?: string;
    redundancy?: string;
    processType?: string;
    updateFrequency?: string;
    dependencies?: string;
    role?: string;
    clearanceLevel?: string;
    trainingRequired?: string;
  };

  /** Timestamps */
  created: string;
  lastModified: string;
}

// ==================== ASSET DATA CONTAINER ====================

/**
 * Complete asset data for a project
 */
export interface AssetData {
  /** Project-specific configuration */
  configuration: AssetConfiguration;
  
  /** List of assets */
  assets: Asset[];
  
  /** DFD image for preview (base64 or URL) */
  dfdPreviewImage?: string;
  
  /** Validation state */
  validation?: AssetValidation;
  
  /** Last modified timestamp */
  lastModified: string;
}

export interface AssetValidation {
  isComplete: boolean;
  errors: string[];
  warnings: string[];
  lastValidated: string;
}

// ==================== EXPORT/IMPORT TYPES ====================

/**
 * Options for asset export
 */
export interface AssetExportOptions {
  includeConfiguration: boolean;
  includeAssets: boolean;
}

/**
 * Exported asset data structure
 */
export interface AssetExportData {
  version: string;
  exportedAt: string;
  projectName?: string;
  configuration?: AssetConfiguration;
  assets?: Asset[];
}

/**
 * Options for asset import
 */
export interface AssetImportOptions {
  importConfiguration: boolean;
  importAssets: boolean;
  mergeAssets: boolean; // true = merge with existing, false = replace
}

// ==================== ASSET PROJECT INTERFACE ====================
// What Assets feature needs from a project (Dependency Inversion)

export interface AssetProjectData {
  id: string;
  name: string;
  assets: AssetData | null;
  phaseStatus: PhaseStatusMap;

  /** DFD assets for asset synchronization and linking */
  dfdAssets?: AssetDFDAsset[];

  /** DFD elements for linking display */
  dfdElements?: AssetDFDElement[];

  /** DFD connections for linking display */
  dfdConnections?: AssetDFDConnection[];

  /** DFD preview image */
  dfdPreviewImage?: string;

  lastModified: string;
}

// ==================== ASSET UPDATE RESULT ====================
// What Assets returns to app layer after updates

export interface AssetUpdateResult {
  assets: AssetData;
  phaseStatus: PhaseStatusMap;
  lastModified: string;
}

// ==================== ASSET TAB PROPS ====================

export interface AssetTabProps {
  project: AssetProjectData;
  onUpdate: (updates: AssetUpdateResult) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  onPhaseComplete?: () => void;
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Generate next asset ID based on existing assets
 */
export function generateNextAssetId(existingAssets: Asset[]): string {
  if (existingAssets.length === 0) {
    return "A-01";
  }
  
  const maxNumeric = Math.max(...existingAssets.map(a => a.numericId));
  const nextNumeric = maxNumeric + 1;
  
  // Determine padding based on existing format
  const existingId = existingAssets[0]?.id || "A-01";
  const match = existingId.match(/A-(\d+)/);
  const padding = match ? match[1].length : 2;
  
  return `A-${String(nextNumeric).padStart(padding, "0")}`;
}

/**
 * Parse asset ID to extract numeric part
 */
export function parseAssetId(id: string): number {
  const match = id.match(/A-(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Renumber assets sequentially
 */
export function renumberAssets(assets: Asset[]): Asset[] {
  return assets
    .sort((a, b) => a.numericId - b.numericId)
    .map((asset, index) => {
      const newNumericId = index + 1;
      const padding = String(assets.length).length;
      const newId = `A-${String(newNumericId).padStart(Math.max(padding, 2), "0")}`;
      
      return {
        ...asset,
        id: newId,
        numericId: newNumericId,
      };
    });
}

/**
 * Create empty asset with defaults
 */
export function createEmptyAsset(
  id: string,
  configuration: AssetConfiguration
): Asset {
  const numericId = parseAssetId(id);

  return {
    id,
    numericId,
    name: "",
    impactRatings: configuration.impactCriteria.map((criterionId) => ({
      criterionId,
      value: 0,
    })),
    overallImpact: 0,
    securityGoals: SECURITY_GOALS.map((sg) => ({
      type: sg.type,
      enabled: false,
      formalDescription: "",
    })),
    linkedDFDElements: [],
    source: "manual",
    syncedWithDFD: false,
    created: new Date().toISOString(),
    lastModified: new Date().toISOString(),
  };
}

/**
 * Create default AssetData for new projects
 */
export function createDefaultAssetData(): AssetData {
  return {
    configuration: { ...DEFAULT_ASSET_CONFIGURATION },
    assets: [],
    lastModified: new Date().toISOString(),
  };
}

/**
 * Migrate configuration from older versions (without roundingMethod)
 */
export function migrateAssetConfiguration(
  config: Partial<AssetConfiguration>
): AssetConfiguration {
  return {
    impactCriteria:
      config.impactCriteria ?? DEFAULT_ASSET_CONFIGURATION.impactCriteria,
    impactScale: config.impactScale ?? DEFAULT_ASSET_CONFIGURATION.impactScale,
    calculationMethod:
      config.calculationMethod ?? DEFAULT_ASSET_CONFIGURATION.calculationMethod,
    roundingMethod:
      config.roundingMethod ?? DEFAULT_ASSET_CONFIGURATION.roundingMethod,
  };
}

export function impactValueToLevel(
  value: number,
  rounding: ImpactRoundingMethod
): number {
  if (rounding === "ceil") return Math.ceil(value);
  return Math.round(value);
}