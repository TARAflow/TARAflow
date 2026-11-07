/**
 * Migrate schema version 13 → 14 (0.19.0-beta).
 *
 * Version fence — no data change (multi-project TARA design v3, §10;
 * decision 15 as refined: a fence when an older release would misread or
 * drop new fields). Schema 14 brings project.components: the imported
 * component TARAs (snapshot, source, content hash, methodology fingerprint)
 * and their instances in the DFD (prefix, EE mapping, assumption status).
 * An older release would drop them on save (its repair path rebuilds a
 * project from known fields).
 *
 * Reports per file (K-9): a fence never changes an analysis value.
 * Runs once per file through the version gate in migration-service.
 */
export function migrate_13_to_14(data: any): { data: any; analysisChanged: boolean } {
  return { data: { ...data, schemaVersion: 14 }, analysisChanged: false };
}
