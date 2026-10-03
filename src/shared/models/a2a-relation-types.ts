// ==================== A2A RELATION (CANONICAL) ====================
// Canonical shape of an asset-to-asset relation (asset-graph-view-requirements.md,
// decision D1 = (a): an edge list with its own id).
//
// Differences to the legacy AssetToAssetRelation on DFDAsset:
//   - own stable `id` (selection, highlighting, undo, audit diff)
//   - explicit `sourceAssetId` instead of "the asset the list hangs on"
//   - NO sourceGroup/targetGroup copies: groups are always read from the
//     referenced assets (AR-2, fixes B5)
//
// Not persisted yet — the schema bump that stores these in project.assets
// follows in a later commit (AR-1/AR-3).

import type { A2ARelationType } from "./asset-group-types";
import type { SafetyAnnotation } from "./safety-types";

export interface A2ARelation {
  readonly id: string;
  readonly sourceAssetId: string;
  readonly targetAssetId: string;
  readonly relationType: A2ARelationType;
  readonly stepOrder?: number;
  readonly analyticallyActive?: boolean;
  readonly rationale?: string;
  readonly notes?: string;
  readonly safety?: SafetyAnnotation;
  /**
   * Transitive criticality brake — only relevant for `depends_on`.
   * true: source continues degraded when the target fails (damped propagation).
   */
  readonly degradationMode?: boolean;
}

/** Attributes that can change without changing the edge's identity. */
export type A2ARelationAttributes = Omit<
  A2ARelation,
  "id" | "sourceAssetId" | "targetAssetId" | "relationType"
>;
