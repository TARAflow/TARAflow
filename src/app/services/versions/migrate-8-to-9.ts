/**
 * Migrate schema version 8 → 9.
 *
 * 1. Leveled DFDs (leveled-dfd-multi-diagram-design.md §11.2): a DFD may span
 * several draw.io pages, with the page tree and the identity links in
 * dfd.pages. The step changes NO data — dfd.pages is optional and absent
 * for classic projects. It is a version fence: every TARAflow release
 * before the leveled-DFD work silently merges the pages of a multi-page
 * file; with schema 9 those versions refuse the file instead
 * (migration-service rejects schemaVersion > CURRENT_SCHEMA_VERSION).
 *
 * 2. Person-harm severity on the canonical 5-level scale
 *    (normalizeSafetySeverities, conservative mapping).
 *
 * Runs once per file through the version gate in migration-service.
 */

import { normalizeSafetySeverities } from "./normalize-safety-severity";

export function migrate_8_to_9(data: any): any {
  return { ...normalizeSafetySeverities(data), schemaVersion: 9 };
}
