// ==================== DFD REFERENCE TYPES ====================
// features/assets/models/dfd-reference-types.ts
//
// Read-only reference types for the assets feature.
// Populated by dfd-to-asset-mapper; intentionally independent of DFD-internal
// types (Dependency Inversion). Both features import shared types from "shared".
//
// Structure:
//   - relationType (singular) instead of relationTypes[]
//   - assetGroup as explicit field (drives tab display + color coding)
//   - qualifier only for uses (System/Service) and accesses (Infra/Physical)
//   - Marker logic removed (positions, sizes, xmlIds)

import type { AssetGroup, A2ARelationType } from "shared";
import type { AssetProperties } from "shared/models/asset-property-types";

// ==================== SAFETY ANNOTATION SUMMARY ====================

/**
 * Minimal safety context projected from DFD SafetyAnnotation to the asset layer.
 * Full SafetyAnnotation lives in the DFD model; this read-only projection is used
 * by asset-physical-impact-deriver to compute physicalImpact (derived).
 * Populated by dfd-to-asset-mapper when a SafetyAnnotation is present on a relation.
 */
export interface SafetyAnnotationSummary {
  /** direct = element directly controls the hazardous action; indirect = systemic influence */
  readonly relevance: "none" | "indirect" | "direct";
  /** Worst-case injury classification from SafetyAnnotation.impact */
  readonly impact?:
    | "none"
    | "reversible_injury"
    | "irreversible_injury"
    | "fatality";
  /** True for Human Assets marked as protection targets (ISO 12100) */
  readonly protectionTarget?: boolean;
}

// ==================== DFD ASSET REFERENCE ====================

/**
 * Read-only reference to a DFD asset.
 * Used in the assets tab for sync and display.
 */
export interface AssetDFDAsset {
  readonly id: string;
  readonly displayId: string;
  readonly name?: string;
  readonly description?: string;

  /**
   * Asset group — drives tab display [Data|Function|Systems|Infra|Process|Physical|Service|People]
   * and color coding in the DrawIO layer.
   */
  readonly assetGroup?: AssetGroup;

  /** Protection need — used for chip color in AssetRelationSelector */
  readonly protectionNeed?: "low" | "medium" | "high" | "critical";

  /**
   * The DFD asset's category-specific properties, projected through unchanged
   * so the DFD → AssetData sync can carry them into Asset.properties. Before
   * the SoT consolidation this channel did not exist, so DFD-edited properties
   * only reached AssetData via the manual double-write (§3.1/§3.2).
   */
  readonly properties?: AssetProperties;

  // NOTE: isHighValueAsset has been moved to asset-tab/models/asset-types.ts (Asset.properties).
  // HVA assessment belongs to the asset rating phase, not the DFD structural phase.

  /**
   * DFD elements linked to this asset.
   * One entry per relation (not per asset-element pair).
   */
  readonly linkedElements?: ReadonlyArray<{
    readonly elementId: string;
    readonly elementName: string;
    readonly elementType: string;
    readonly displayId: string;
    /** Relation type — group-specific (e.g. "reads", "controls", "is_an") */
    readonly relationType?: string;
    /** Qualifier — for uses (System/Service) and accesses (Infra/Physical) */
    readonly qualifier?: string;
    readonly notes?: string;
    /**
     * Safety context projected from the DFD SafetyAnnotation on this relation.
     * Used by asset-physical-impact-deriver to compute physicalImpact (derived).
     */
    readonly safety?: SafetyAnnotationSummary;
  }>;
}

// ==================== DFD ELEMENT REFERENCE ====================

/**
 * Read-only reference to a DFD element.
 * Used for sync and display in the assets tab.
 */
export interface AssetDFDElement {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly displayId: string;

  /**
   * Asset relations of this element.
   * Defined by the analyst in the element description form.
   */
  readonly assetRelations?: ReadonlyArray<{
    readonly assetId: string;
    /** Asset group — for tab filtering and DrawIO label color */
    readonly assetGroup: AssetGroup;
    /** Relation type — group-specific */
    readonly relationType: string;
    /** Qualifier — for uses (System/Service) and accesses (Infra/Physical) */
    readonly qualifier?: string;
    readonly notes?: string;
  }>;
}

// ==================== DFD CONNECTION REFERENCE ====================

/**
 * Read-only reference to a DFD DataFlow.
 * name = the arrow label in the diagram (previously: label).
 */
export interface AssetDFDConnection {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  /** Action text of the data flow, e.g. "send cmd", "request status" */
  readonly name?: string;
  readonly displayId: string;

  /**
   * Asset relations of this DataFlow.
   * DataFlow allows: transports (Data), invokes (Process/Function), uses (System/Service).
   */
  readonly assetRelations?: ReadonlyArray<{
    readonly assetId: string;
    readonly assetGroup: AssetGroup;
    readonly relationType: string;
    readonly qualifier?: string;
    readonly notes?: string;
  }>;
}

// ==================== ASSET-TO-ASSET RELATION REFERENCE ====================

/**
 * Read-only projection of AssetToAssetRelation for the assets feature.
 * A2ARelationType is imported from "shared" — no local duplicate.
 */
export interface AssetToAssetRelationReference {
  readonly sourceAssetId: string;
  readonly targetAssetId: string;
  readonly relationType: A2ARelationType;
}

// ==================== ELEMENT LINK ====================

/**
 * Simplified link for display in the asset table.
 * Derived from AssetDFDAsset.linkedElements.
 */
export interface DFDElementLink {
  elementId: string;
  elementName: string;
  elementType: string;
  displayId: string;
  /** Relation type — group-specific */
  relationType?: string;
  /** Qualifier — for uses/accesses relations */
  qualifier?: string;
  notes?: string;
  /**
   * Safety context projected from DFD SafetyAnnotation.
   * Populated by dfd-to-asset-mapper; used by asset-physical-impact-deriver.
   */
  safety?: SafetyAnnotationSummary;
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Returns all linked elements for a given asset.
 */
export function getLinkedElementsForAsset(
  assetId: string,
  dfdAssets?: ReadonlyArray<AssetDFDAsset>,
): DFDElementLink[] {
  const dfdAsset = dfdAssets?.find((a) => a.id === assetId);
  if (!dfdAsset?.linkedElements) return [];

  return Array.from(dfdAsset.linkedElements).map((link) => ({
    elementId: link.elementId,
    elementName: link.elementName,
    elementType: link.elementType,
    displayId: link.displayId,
    relationType: link.relationType,
    qualifier: link.qualifier,
    notes: link.notes,
  }));
}

/**
 * Returns all asset relations of an element filtered by asset group.
 */
export function getElementRelationsByGroup(
  element: AssetDFDElement,
  assetGroup: AssetGroup,
): NonNullable<AssetDFDElement["assetRelations"]> {
  return (
    element.assetRelations?.filter((r) => r.assetGroup === assetGroup) ?? []
  );
}

/**
 * Returns true if an element has an is_an relation to the given asset.
 */
export function hasIsAnRelation(
  element: AssetDFDElement,
  assetId: string,
): boolean {
  return (
    element.assetRelations?.some(
      (r) => r.assetId === assetId && r.relationType === "is_an",
    ) ?? false
  );
}