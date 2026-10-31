/**
 * Migrate schema version 11 → 12 (0.17.0-beta).
 *
 * Version fence — no data change (iec-62443-4-2-cra-coverage.md D-8,
 * release-0.17-plan.md §4; fence rule: a new number when an older release
 * would drop or misread new fields, or the meaning of existing data
 * changes). Schema 12 brings project.compliance — the IEC 62443-4-2 / CRA
 * matrix data: component under evaluation, target SL-C vector per FR,
 * analyst statements per row (IEC-4). An older release would drop it on save
 * (its repair path rebuilds a project from known fields).
 *
 * Declared analysis-preserving (ANALYSIS_PRESERVING_MIGRATIONS): it changes
 * no value, so a TARA verification recorded with 0.16 stays valid. A step
 * added here later that changes or reshapes a value (e.g. a single-valued
 * property becoming multi-select, IEC-9) must keep that declaration true —
 * a 1:1 reshaping only — or remove it.
 *
 * Runs once per file through the version gate in migration-service.
 */
export function migrate_11_to_12(data: any): any {
  return { ...data, schemaVersion: 12 };
}
