// ==================== ASSET TYPES ====================
// Core data models for the Assets feature
// NO dependency on app OR dfd - follows Dependency Inversion Principle

import type { AssetGroup, PhaseStatusMap } from "shared";
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
  /** Unique ID (e.g., "A-001", "A-01", "A-1") */
  id: string;

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

  properties?: {
    description?: string;
    category?: AssetGroup;
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
    // ── Graph-relevant flags ──────────────────────────────────────────────
    /** Activates Accountability (**) derivation — DSGVO Art. 5 Abs. 2 */
    isPersonalData?: boolean;
    /** Activates Confidentiality (*) for stores relation — TPM/HSM/OP-TEE */
    isSecureStorage?: boolean;
    /** Activates Confidentiality (*) for is_an relation — proprietary process */
    isBusinessSecret?: boolean;

    // ── High-Value Asset (Infrastructure / Physical only) ─────────────────
    // HVA assessment belongs to the asset rating phase.
    // Derived from: MAX(impactRatings) + replacementLeadTime + vendorDependency + spareAvailability.
    // Override with isHighValueAssetSource: "manual" requires highValueRationale.
    //
    // Override hierarchy (highest wins, Safety Override takes precedence):
    //   isHighValueAsset: "critical" → Threat priority CRITICAL minimum
    //   isHighValueAsset: "high"     → Threat priority HIGH minimum
    //   isHighValueAsset: "medium"   → Threat priority MEDIUM minimum
    //   isHighValueAsset: "low"      → informative only

    /**
     * Derived HVA classification.
     * "derived" = calculated from impactRatings + lead time + vendor/spare fields.
     * "manual"  = analyst override — highValueRationale required.
     */
    isHighValueAsset?: "low" | "medium" | "high" | "critical";
    isHighValueAssetSource?: "derived" | "manual";

    /**
     * Maximum impact upon total destruction of the asset.
     * Derived from MAX(financial_damage, operational, physical_damage) in impactRatings.
     * Read-only in UI — shown as context next to HVA classification.
     */
    assetDestructionImpact?: "low" | "medium" | "high" | "critical";

    /**
     * Replacement lead time bracket (factual timespan + derived criticality).
     * Analyst selects the bracket; replacementLeadTimeNote allows free-text precision.
     */
    replacementLeadTime?:
      | "<3m (low)"
      | "3-6m (medium)"
      | "6-12m (high)"
      | ">12m (critical)";

    /** Optional free-text precision, e.g. "18–24 months, ASML allocation queue" */
    replacementLeadTimeNote?: string;

    /**
     * Supplier dependency for replacement procurement.
     * multi_vendor:  multiple suppliers available
     * limited:       few suppliers, restricted availability
     * single_source: sole supplier, no alternative
     */
    vendorDependency?: "multi_vendor" | "limited" | "single_source";

    /**
     * Availability of spare parts or replacement units.
     * on_site:  spare present on-site
     * supplier: orderable from supplier
     * none:     no spare available
     */
    spareAvailability?: "on_site" | "supplier" | "none";

    /**
     * Rationale for HVA classification — reproduced verbatim in audit report.
     * Required when: isHighValueAssetSource === "manual"
     *             OR isHighValueAsset ∈ {"high", "critical"}
     */
    highValueRationale?: string;
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

