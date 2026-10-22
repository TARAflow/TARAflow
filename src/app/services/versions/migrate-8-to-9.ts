/**
 * Migrate schema version 8 → 9.
 * Leveled DFDs (leveled-dfd-multi-diagram-design.md §11.2): a DFD may span
 * several draw.io pages, with the page tree and the identity links in
 * dfd.pages. The step changes NO data — dfd.pages is optional and absent
 * for classic projects. It is a version fence: every TARAflow release
 * before the leveled-DFD work silently merges the pages of a multi-page
 * file; with schema 9 those versions refuse the file instead
 * (migration-service rejects schemaVersion > CURRENT_SCHEMA_VERSION).
 *
 * Idempotent.
 */
export function migrate_8_to_9(data: any): any {
  return { ...data, schemaVersion: 9 };
}
