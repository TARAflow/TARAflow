// ==================== DFD ASSET TYPES ====================
// Renamed from asset-types.ts → dfd-asset-types.ts to avoid confusion
// with asset-tab/models/asset-types.ts.
// Update all imports: import ... from "./asset-types" → "./dfd-asset-types"
// Type definitions for assets in the Asset Tab.
//
// Import hierarchy (no cycles):
//   safety-types.ts → asset-relation-types.ts → asset-types.ts → dfd-types.ts

import type {
  AssetToAssetRelation,
  SystemUsesQualifier,
  InfraAccessesQualifier,
  PhysicalContactQualifier,
  ServiceUsesQualifier,
} from "./asset-relation-types";
import type { DFDElementType } from "./dfd-element-types";
import { AssetGroup, AnyAssetRelationType } from "shared";

// ==================== ASSET ENUM TYPES (moved to shared) ====================
// These unions + ExternalSafetyRef were moved to
// shared/models/asset-property-types.ts (Asset-Store SoT, Phase 4) so that both
// the DFD and Asset features can use them without importing each other.
// Imported for local use by AssetProperties below, and re-exported so existing
// DFD consumers keep importing them from here unchanged.
import type {
  AssetDataType,
  AssetDomain,
  AutomationLevel,
  PhysicalAccessControl,
  Portability,
  ExternalSafetyRef,
} from "shared/models/asset-property-types";
export type {
  AssetDataType,
  AssetDomain,
  AutomationLevel,
  PhysicalAccessControl,
  Portability,
  ExternalSafetyRef,
};

// NOTE: HighValueAssetFields removed — HVA assessment belongs to
// asset-tab/models/asset-types.ts (Asset.properties). See taraflow-asset-beziehungen.md.

// ==================== ASSET PROPERTIES ====================
// Moved to shared/models/asset-property-types.ts (Asset-Store SoT, Phase 4b-ii).
// DFDAsset.properties and Asset.properties now share ONE canonical type, so the
// former DFD-local AssetProperties is re-exported from shared unchanged for DFD
// consumers that import it from here.
import type { AssetProperties } from "shared/models/asset-property-types";
export type { AssetProperties };

// ==================== ELEMENT RELATION ====================

/**
 * Element relation from Asset perspective (Asset → Element).
 * Mirrored representation stored in DFDAsset.linkedElements.
 */
export interface ElementRelation {
  elementId: string;
  elementName: string;
  elementType: DFDElementType;
  displayId: string;
  relationType?: AnyAssetRelationType;
  /**
   * Qualifier for relations that require one:
   *   SystemUsesRelation:      SystemUsesQualifier
   *   ServiceUsesRelation:     ServiceUsesQualifier
   *   InfraAccessesRelation:   InfraAccessesQualifier
   *   PhysicalAccessesRelation: PhysicalContactQualifier
   */
  qualifier?:
    | SystemUsesQualifier
    | ServiceUsesQualifier
    | InfraAccessesQualifier
    | PhysicalContactQualifier;
  notes?: string;
}

// ==================== DFD ASSET ====================

export interface DFDAsset {
  id: string;
  displayId: string;
  name: string;
  description?: string;
  assetGroup: AssetGroup;
  protectionNeed?: "low" | "medium" | "high" | "critical";
  linkedElements?: ElementRelation[];
  assetToAssetRelations?: AssetToAssetRelation[];
  properties?: AssetProperties;
}