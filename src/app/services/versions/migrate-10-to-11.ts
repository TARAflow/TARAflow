/**
 * Migrate schema version 10 → 11 (0.16.0-beta).
 *
 * Version fence — no data change (ISO/SAE 21434 conformance plan decision 24,
 * decision 15 as refined: a fence when an older release would misread or drop
 * new fields). Schema 11 brings:
 *
 * - "none" (no injury, S0 under ISO/SAE 21434) as the severity of a person
 *   endangers edge (1H-S, decision 13 C). An older release would count such
 *   an edge as harm: the person would become a hazard target and its causes
 *   safety-relevant.
 * - project.itemDefinition (Phase 1 stage A): sections, functions and
 *   assumptions of the Item Definition, and project.cybersecurityConcept
 *   (Phase 4, decision 25): goals, claims, verification records. An older
 *   release would drop them on save (its repair path rebuilds a project
 *   from known fields).
 *
 * Runs once per file through the version gate in migration-service.
 */
export function migrate_10_to_11(data: any): any {
  return { ...data, schemaVersion: 11 };
}
