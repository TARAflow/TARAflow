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
 */
export const CURRENT_SCHEMA_VERSION = 4;