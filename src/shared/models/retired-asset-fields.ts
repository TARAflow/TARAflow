// ==================== RETIRED ASSET FIELDS ====================
// Asset fields taken out of the model (design: model-field-purpose-and-
// rating-context-design.md). Older files may still carry them — on the
// asset record or in its `properties`, in the asset store and in the DFD's
// asset mirror. One list, read by the load (they are dropped before every
// other step, app/services/drop-retired-asset-fields.ts) and by the commit
// diff (the previous state is read raw from git, so each drop shows once,
// features/audit/services/diff-service.ts).
//
// Retire only with this list — never by deleting a field from the type
// alone: a field no code writes can still hold data in older files, and its
// silent disappearance would change a committed file without a diff line.

export const RETIRED_ASSET_FIELDS = [
  // 0.19 — a rating entered as a field (P5): the impact rating is the truth
  "protectionNeed",
  "criticality",
  // 0.19 — dead model fields: no input, no reader (§2.2 C). The live
  // physical hazard potential is on the hazard / safety annotation.
  "physicalHazardPotential",
  "businessImpact",
  "businessImpactCategory",
  "aggregatedCriticality",
  "strideDepth",
  // 0.19 — the legacy asset-tab strings (never written since the
  // canonical flat AssetProperties)
  "dataClassification",
  "retentionPeriod",
  "systemType",
  "backupInterval",
  "infrastructureType",
  "redundancy",
  "processType",
  "updateFrequency",
  "dependencies",
  "clearanceLevel",
  "trainingRequired",
] as const;

export type RetiredAssetField = (typeof RETIRED_ASSET_FIELDS)[number];
