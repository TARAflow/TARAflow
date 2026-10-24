// ==================== ASSET TYPES ====================
// Core data models for the Assets feature
// NO dependency on app OR dfd - follows Dependency Inversion Principle

import type {
  AssetGroup,
  PhaseStatusMap,
  A2AOp,
  A2ARelation,
  SafetySeverity,
} from "shared";
import type { AssetProperties } from "shared/models/asset-property-types";
import type {
  ImpactRating,
  WeightedImpactCriterion,
  ImpactScaleType,
  ImpactLabelVocabulary,
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
  physicalImpact?: SafetySeverity;
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

  /**
   * Asset-to-asset relations — canonical and persisted (schema v8, D1 = edge
   * list). Written only through the relations service in shared
   * (a2a-relation-service). Absent = no relations.
   */
  relations?: A2ARelation[];

  /** DFD image for preview (base64 or URL) */
  dfdPreviewImage?: string;
  /** Leveled DFD (D18): one thumbnail per page, Top first. */
  dfdPreviewPages?: import("shared").DFDPreviewPage[];

  /** Last modified timestamp */
  lastModified: string;
}

export interface AssetValidation {
  isComplete: boolean;
  errors: string[];
  warnings: string[];
  /**
   * Legitimate states worth mentioning in a review (e.g. a goal whose level is
   * provisional). Never affects completeness. Optional: older persisted
   * validations have none.
   */
  infos?: string[];
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
  /** Asset links between the exported assets (written with the assets). */
  relations?: A2ARelation[];
}

/**
 * Options for asset import
 */
export interface AssetImportOptions {
  importConfiguration: boolean;
  importAssets: boolean;
  /**
   * Imported assets are always added (B14). For an imported asset that is
   * already in the project (same id, or same group and name): keep the
   * project's asset (default) or replace its content. Key: id in the file.
   */
  decisions: Readonly<Record<string, "keep" | "replace">>;
}

// ==================== ASSET PROJECT INTERFACE ====================
// What Assets feature needs from a project (Dependency Inversion)

export interface AssetProjectData {
  id: string;
  name: string;
  assets: AssetData | null;
  phaseStatus: PhaseStatusMap;

  /**
   * ISO/SAE 21434 mode — surfaces the per-goal damage-scenario consequence field
   * in the asset dialog. Derived live from the active regulation preset at the
   * app layer (regulationPresetFromTags(tags) === "iso-21434"); never persisted,
   * so it cannot go stale. The asset feature stays regulation-agnostic.
   */
  damageScenarioMode?: boolean;

  /**
   * Impact criteria the active regulation preset makes mandatory (SFOP under
   * ISO/SAE 21434). Derived at the app layer from the project tags; the config
   * dialog locks these so they cannot be deselected. Absent/empty → none locked.
   */
  mandatoryImpactCriteriaIds?: string[];

  /**
   * Impact scale the active regulation preset prescribes (iso-21434 → 4-level,
   * RQ-15-05). Derived at the app layer; the config dialog offers only this
   * scale and the validator reports a mismatch. Absent → free choice.
   */
  requiredImpactScale?: ImpactScaleType;

  /** Names of the impact levels — "iso-21434" shows negligible / moderate /
   * major / severe on the 4-level scale (RQ-15-05). Derived at the app layer;
   * display only. Absent → default names. */
  impactLabelVocabulary?: ImpactLabelVocabulary;

  /** DFD assets for asset synchronization and linking */
  dfdAssets?: AssetDFDAsset[];

  /** DFD elements for linking display */
  dfdElements?: AssetDFDElement[];

  /** DFD connections for linking display */
  dfdConnections?: AssetDFDConnection[];

  a2aRelations?: AssetToAssetRelationReference[];

  /** DFD preview image */
  dfdPreviewImage?: string;
  /** Leveled DFD (D18): one thumbnail per page, Top first. */
  dfdPreviewPages?: import("shared").DFDPreviewPage[];
  /**
   * Leveled DFD (Phase 6c, D20): groups per top-level decomposed
   * multiprocess; the asset table is grouped by the elements holding each
   * asset. Undefined for a classic DFD or without a decomposed multiprocess.
   */
  dfdTableGroups?: import("shared").DfdTableGroups;

  lastModified: string;
}

// ==================== ASSET UPDATE RESULT ====================
// What Assets returns to app layer after updates

export interface AssetUpdateResult {
  /**
   * The asset store. Its `relations` field is ignored on write: asset links
   * change only through `a2aOps` (single write path, AR-5).
   */
  assets: AssetData;
  phaseStatus: PhaseStatusMap;
  lastModified: string;
  /** Asset-link operations for the relations service (e.g. asset import). */
  a2aOps?: A2AOp[];
}

