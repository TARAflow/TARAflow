// ==================== SCHEMA VERSION ====================
/**
 * Current schema version. Increment for every breaking or additive
 * change to the persisted Project structure.
 *
 * Version history:
 *   0 = pre-release (no schemaVersion field present)
 *   1 = Release 1 — first official version
 *   2 = Hazard phase inserted at position 1
 *   3 = Interface.implementedControls.logicalAccessControl split into
 *       linkAuthentication ("secure_pairing" → "pairing") or a migration
 *       note on the element, for re-modelling on the terminating
 *       process/flow. The obsolete key is dropped.
 *   4 = DataFlow.properties.direction dropped — redundant with the DF
 *       label verb + tag (dataflow-labeling-convention_v3.md is the
 *       source of truth; the property only ever duplicated it).
 *   5 = Threat identity split. Threat.id becomes an opaque UUID (stable
 *       across renumber); the old regenerable label (e.g. "P1-S-1") moves to
 *       the new Threat.displayId. Cross-feature foreign keys that referenced
 *       the old label are repointed to the new UUID in the same pass:
 *       Risk.threatId and AttackTreeAnchor.threatId. (Risk.id and the DSL
 *       threatRef keep their own hardening for a later change.)
 *   6 = Asset identity split (mirror of v5 for assets). Asset.id becomes an
 *       opaque UUID (stable across a group change); the old readable,
 *       group-prefixed label (e.g. "DA-001") moves to Asset.displayId. Every
 *       asset-id foreign key is repointed to the new UUID in the same pass —
 *       assetId / sourceAssetId / targetAssetId / linkedAssetIds / assetIds,
 *       wherever they occur — across both the feature store and the dfd mirror.
 */
export const CURRENT_SCHEMA_VERSION = 6;