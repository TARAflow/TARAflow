// ==================== ASSET TYPES ====================
// Core data models for the Assets feature
// NO dependency on app OR dfd - follows Dependency Inversion Principle

import type { AssetGroup, PhaseStatusMap } from "shared";
import type { AssetProperties } from "shared/models/asset-property-types";
import type {
  ImpactRating,
  WeightedImpactCriterion,
  ImpactScaleType,
  ImpactCalculationMethod,
  ImpactRoundingMethod,
} from "./asset-impact-types";
import type { SecurityGoal } from "./asset-security-goals-types";
import type {
  AssetDFDAsset,
  AssetDFDElement,
  AssetDFDConnection,
  DFDElementLink,
  AssetToAssetRelationReference,
} from "./dfd-asset-link-types";

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
  AssetToAssetRelationReference,
};

// ==================== ASSET CONFIGURATION ====================

/**
 * Project-specific asset configuration
 */
export interface AssetConfiguration {
  /**
   * Selected impact criteria with weights (4-6 recommended).
   * Weights are used for weighted average calculation.
   * For conservative (MAX) method, weights have no effect.
   */
  impactCriteria: WeightedImpactCriterion[];

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
    // Core OT/Embedded impact criteria — covers financial, operational, regulatory,
    // recoverability and affected scope. Safety is added by analyst when relevant.
    { id: "financial_damage", weight: 0.25 },
    { id: "operational", weight: 0.25 },
    { id: "regulatory_compliance", weight: 0.2 },
    { id: "recoverability", weight: 0.15 },
    { id: "affected_users", weight: 0.15 },
    // safety: not in default — analyst adds when DFD safety annotations are present
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
  /**
   * Stable identity — the reference elements point at via
   * element.assetRelations[].assetId. Readable today (e.g. "DA-001"); becomes an
   * opaque UUID in the Phase 5 UUID switch. Never shown to the user — use
   * displayId for that.
   */
  id: string;

  /**
   * Human-readable, group-prefixed label (e.g. "DA-001", "SY-003), regenerated
   * on a group change. This is what the UI shows. Equal to id today; the two
   * diverge once id becomes a UUID.
   */
  displayId?: string;

  /** Numeric part for sorting and renumbering */
  numericId: number;

  /** Asset name/description */
  name: string;

  /**
   * Asset group — canonical category field.
   * Set by asset-sync-service from DFDAsset.assetGroup.
   * Replaces properties.category as the primary source.
   */
  assetGroup: AssetGroup;

  /** Impact ratings per criterion */
  impactRatings: ImpactRating[];

  /** Calculated overall impact (based on configuration) */
  overallImpact: number;

  /** Selected security goals with formal descriptions */
  securityGoals: SecurityGoal[];

  /** Linked DFD elements */
  linkedDFDElements: DFDElementLink[];

  /**
   * Safety Impact — derived from DFD SafetyAnnotation via graph.
   * Manual override requires rationale (IEC 62443-4-1 audit trail).
   */
  // Severity levels from ISO 12100 / EN 50742
  // undefined = no safety annotation → "–" in table
  physicalImpact?: "reversible_injury" | "irreversible_injury" | "fatality";
  /**
   * Provenance of physicalImpact:
   *   derived — from DFD SafetyAnnotation (legacy path)
   *   manual  — analyst override (rationale required)
   *   hazard  — from the HazardItem bowtie (endangers / inherited cause).
   *             Owned by commit-hazard-safety; the annotation deriver must not
   *             clobber it (see deriveAllImpacts guard).
   */
  physicalImpactSource?: "derived" | "manual" | "hazard";
  physicalImpactRationale?: string;

  /**
   * Aggregated Impact — always derived, never manual.
   * Safety Override Rule: fatality/irreversible_injury → CRITICAL regardless of business impact.
   * HIGH+ = indirect safety relevance, business impact HIGH.
   */
  aggregatedImpact?: "LOW" | "MED" | "MED+" | "HIGH" | "HIGH+" | "CRITICAL";

  /** Source: was this created from DFD or manually? */
  source: "dfd" | "manual";

  /** Is this asset synced with DFD? */
  syncedWithDFD: boolean;

  /**
   * Canonical, flat asset property schema (shared/models/asset-property-types).
   * Single source since the Asset-Store SoT consolidation — the former DFD-side
   * AssetProperties and this inline block were merged into one shared type.
   */
  properties?: AssetProperties;

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

  a2aRelations?: AssetToAssetRelationReference[];

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

