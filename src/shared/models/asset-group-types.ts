// ==================== ASSET GROUP TYPES ====================
// shared/models/asset-group-types.ts
//
// Single source of truth for the AssetGroup type.
// No other dependencies — intentionally minimal.
//
// Imported by:
//   shared/models/asset-color-constants.ts  (display config)
//   features/dfd/models/asset-relation-types.ts  (relation model)
//   features/assets/models/dfd-reference-types.ts  (reference model)
//
// Asset taxonomy:
//   Vertical hierarchy (static abstraction, bottom → top):
//     data → function → system → infrastructure
//   Orthogonal categories (dynamic context, cut across all levels):
//     process | physical | service | human

export type AssetGroup =
  | "data"
  | "function"
  | "system"
  | "infrastructure"
  | "process"
  | "physical"
  | "service"
  | "human"
  | "environment";

// ==================== ASSET-TO-ASSET RELATION TYPE ====================
// Cross-feature type — used by both dfd and assets features.
// Full semantics and STRIDE mappings documented in:
//   features/dfd/models/asset-relation-types.ts
//   taraflow-asset-zu-asset-beziehungen.md

export type A2ARelationType =
  // Data → Data
  | "derives_from"
  | "aggregates"
  | "supersedes"
  // Function → Function
  | "calls"
  // Process → Process
  | "triggers"
  | "suspends"
  // System → System
  | "integrates"
  // Infrastructure → Infrastructure
  | "powers"
  | "houses"
  // Physical → Physical
  | "mechanically_linked"
  // Service → Service
  | "delegates_to"
  // Human → Human
  | "manages"
  | "reports_to"
  // Data → Process / Function / System / Human
  | "required_by"
  | "consumed_by"
  | "configures"
  | "exposes"
  // Function → Data
  | "creates"
  | "reads"
  | "modifies"
  | "deletes"
  // Function / System → Process / System
  | "implemented_by"
  // Process / System → Function
  | "implements"
  | "invokes"
  // Process / System / Service → Infrastructure
  | "hosted_on"
  | "powered_by"
  // Process → Human / System
  | "operated_by"
  | "runs_on"
  // Physical → Function / System / Infrastructure / Human
  | "enables"
  | "hosts"
  | "controlled_by"
  | "connected_to"
  | "located_in"
  | "endangers"
  // Service → Function / Data / System / Human
  | "provides"
  | "consumes"
  | "integrates_with"
  | "monitors"
  // Human → Physical / Process / Function
  | "owns"
  | "accesses"
  | "responsible_for"
  | "authorized_for"
  // Shared / multi-category
  | "depends_on"
  | "affects_safety"
  | "affects_privacy"
  // Environment
  | "contaminates";