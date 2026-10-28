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
 *   7 = Risk identity. Risk.id becomes "R-<threat UUID>" (stable across a DFD
 *       renumber, unique per threat) instead of "R-<threat display id>". The
 *       readable label is derived (formatRiskLabel → "R-<threatDisplayId>").
 *       AttackTreeAnchor.riskId and dfd control-provenance riskId are repointed
 *       in the same pass; risk anchors gain a riskDisplayId snapshot.
 *   8 = Asset-to-asset relations become canonical. They are stored as an edge
 *       list in assets.relations[] (A2ARelation: own id, sourceAssetId,
 *       targetAssetId, relationType + attributes, no group copies). Before,
 *       they lived only on the runtime dfd.assets mirror and were lost on save.
 *       Legacy relations still found on dfd.assets[] (assetRelations /
 *       assetToAssetRelations) are lifted; migrate_5_to_6 lifts them before it
 *       drops the mirror. Absent = no relations.
 *   9 = Leveled DFDs: the DFD may span several draw.io pages; page tree and
 *       identity links live in dfd.pages (optional, absent for classic
 *       projects). No data changes — a version fence, so releases that
 *       would merge the pages of a multi-page file refuse it instead.
 *       Same step: canonical 5-level person-harm severity (reversible_minor …
 *       irreversible_major, fatal) for SafetyAnnotation.impact, human
 *       endangers edges, physicalImpact / safetyImpact. Conservative mapping
 *       (reversible_injury → reversible_major, irreversible_injury →
 *       irreversible_major, fatality → fatal); safety ImpactRating 3 → 4.
 *       Same step: asset-level safety properties become derived —
 *       AssetProperties drops safetyRelevant, containsSafetyRelevantData,
 *       safetyImpact and safetyRationale; a safetyImpact on an asset without
 *       physicalImpact is kept as a manual override ([MIGRATED] rationale).
 *  10 = 0.15.0-beta (ISO/SAE 21434 conformance plan Phase 0, fix, 3a;
 *       migrate-9-to-10.ts). Not a pure fence — it changes values:
 *       - fence for the optional calculation stamps Risk.calcStamp and
 *         PathAnalysis.calcStamp ({ method, calcVersion, mappingVersion }),
 *         written only in iso-21434 projects when a value is (re)computed;
 *         absent = computed before (0c);
 *       - stored attack-tree likelihoods corrected for 3- and 4-level risk
 *         scales, all presets (decision 21, fixTreeLikelihoodScale);
 *       - safety severity names normalised again (decision 22), so v9 files
 *         with old names (fatality …) get the canonical scale;
 *       - Risk.isoRisk (value 1–5, matrix H.8) computed and stamped for every
 *         risk of an iso-21434 project (3a, decision 20).
 *       Fence rule (decision 15 as refined 2026-10-25): a new number only when
 *       an older release would drop or misread new fields.
 *  11 = 0.16.0-beta, version fence, no data change (ISO plan decision 24):
 *       "none" (no injury, S0) as the severity of a person endangers edge
 *       (1H-S) — an older release would count it as harm; the Item
 *       Definition project.itemDefinition (sections, functions, assumptions;
 *       Phase 1 stage A) and the cybersecurity concept
 *       project.cybersecurityConcept (goals, claims, verification records;
 *       Phase 4, decision 25) — an older release would drop them on save.
 */
export const CURRENT_SCHEMA_VERSION = 11;