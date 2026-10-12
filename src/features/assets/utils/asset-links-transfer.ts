// ==================== ASSET LINKS IN EXPORT / IMPORT ====================
// The asset export (Asset tab) carries the asset links (A2A edges) between the
// exported assets (D1: "the export of an asset takes its edges along"). On
// import they never go into the store directly: they become add operations
// for the relations service (AR-5), which checks rules, endpoints and
// duplicates like any other write.

import type { A2AOp, A2ARelation, NewA2ARelation } from "shared";

/** Edges whose both ends are among the exported assets. */
export function exportableRelations(
  assets: readonly { id: string }[],
  relations: readonly A2ARelation[] | undefined,
): A2ARelation[] {
  const ids = new Set(assets.map((a) => a.id));
  return (relations ?? []).filter(
    (r) => ids.has(r.sourceAssetId) && ids.has(r.targetAssetId),
  );
}

/**
 * Add operations for the edges in an export file. Edges that already exist in
 * the project (same source, target and type) are skipped — re-importing a
 * file is not an error. The stored id is not reused: the service mints one.
 */
export function a2aOpsFromAssetExport(
  relations: readonly unknown[] | undefined,
  existing: readonly A2ARelation[] | undefined,
): A2AOp[] {
  const key = (s: string, t: string, type: string) => `${s}\u0000${t}\u0000${type}`;
  const present = new Set(
    (existing ?? []).map((r) => key(r.sourceAssetId, r.targetAssetId, r.relationType)),
  );
  const ops: A2AOp[] = [];
  for (const raw of (relations ?? []) as Record<string, unknown>[]) {
    const { id: _id, sourceAssetId, targetAssetId, relationType, ...attributes } = raw ?? {};
    if (
      typeof sourceAssetId !== "string" ||
      typeof targetAssetId !== "string" ||
      typeof relationType !== "string"
    ) {
      continue;
    }
    const k = key(sourceAssetId, targetAssetId, relationType);
    if (present.has(k)) continue;
    present.add(k);
    ops.push({
      kind: "add",
      relation: {
        ...(attributes as object),
        sourceAssetId,
        targetAssetId,
        relationType,
      } as NewA2ARelation,
    });
  }
  return ops;
}
