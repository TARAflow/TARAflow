// ==================== DFD ELEMENT BASE TYPES ====================
// Primitive base types for DFD elements.
// Extracted from dfd-types.ts to avoid circular imports:
//
//   asset-types.ts          (DFDAsset, ElementRelation)
//     → dfd-element-types.ts  (DFDElementType)
//   dfd-types.ts
//     → asset-types.ts
//     → dfd-element-types.ts  (re-exported for backwards compatibility)
//
// All existing imports of DFDElementType via dfd-types.ts
// continue to work (dfd-types re-exports everything).

// ==================== DFD ELEMENT TYPE ====================

export type DFDElementType =
  | "ExternalEntity"
  | "Process"
  | "Multiprocess"
  | "DataStore"
  | "DataFlow"
  | "TrustBoundary"
  | "Interface"
  | "ChipBoundary";

// ==================== SECURITY / TRUST LEVEL ====================

export type SecurityLevel = "public" | "internal" | "confidential" | "secret";
export type TrustLevel = "trusted" | "untrusted" | "unknown";