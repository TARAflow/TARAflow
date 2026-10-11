/**
 * Migrate schema version 7 → 8.
 * Asset-to-asset (A2A) relations become canonical: an edge list in
 * assets.relations[] (decision D1, asset-graph-view-requirements.md).
 *
 * Up to v7 the relations lived only on the runtime dfd.assets mirror, which
 * prepareForDisk empties — so v6/v7 files normally carry none, and this step
 * only bumps the version. Defensive: any legacy relation still present on
 * dfd.assets[] (e.g. a v5 file of an already-UUID project, which
 * migrate_5_to_6 leaves untouched) is lifted.
 *
 * Idempotent: lifting merges exact duplicates; an existing list is kept.
 */

import { liftLegacyA2ARelations } from "./lift-legacy-a2a";

export function migrate_7_to_8(data: any): any {
  return { ...liftLegacyA2ARelations(data), schemaVersion: 8 };
}
