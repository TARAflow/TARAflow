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
 * 3. Asset-level safety properties become derived (deriveAssetSafety).
 *    Runs after 2, so a kept safetyImpact is already on the new scale.
 *
 * Runs once per file through the version gate in migration-service.
 */

import { normalizeSafetySeverities } from "./normalize-safety-severity";
import { deriveAssetSafety } from "./derive-asset-safety";

export function migrate_8_to_9(data: any): any {
  return {
    ...deriveAssetSafety(normalizeSafetySeverities(data)),
    schemaVersion: 9,
  };
}
