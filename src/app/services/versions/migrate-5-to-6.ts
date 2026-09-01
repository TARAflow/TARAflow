/**
 * Migrate schema version 5 → 6.
 * Asset identity split: decouple an asset's stable identity from its
 * regenerable, group-prefixed display label. Mirrors the threat identity split
 * (migrate_4_to_5) for assets.
 *
 * Before: an asset's only id was the readable, group-prefixed label ("DA-001").
 * Changing the asset's group regenerated that id (DA-001 → SY-001), which
 * orphaned every element/connection assetRelation and every cross-feature
 * reference keyed on it. The prefix also could never match the group after a
 * move.
 *
 * After:
 *   - Asset.id        = opaque UUID, minted here, NEVER changes again — the
 *                       reference every assetRelation / linkedAssetId points at.
 *   - Asset.displayId = the old readable label ("DA-001"), regenerated on a
 *                       group change; the only thing the UI shows.
 *
 * Because the id is a cross-feature foreign key, the repoint happens in ONE
 * pass so the project is never left internally inconsistent. Every field that
 * holds an asset id is rewritten from the old label to the new UUID. The
 * reference surface (confirmed against the codebase) is these field names,
 * wherever they occur in the project tree:
 *   - assetId                         (DFD element/connection.assetRelations[],
 *                                      risks, attack trees, hazard relations)
 *   - sourceAssetId / targetAssetId   (asset-to-asset relations)
 *   - linkedAssetIds / assetIds       (threats / risks / attack trees — string[])
 *
 * A generic key-allowlisted walk is used rather than enumerating each location,
 * so no reference site can be silently missed; only values that are actual old
 * asset ids (present in the map) are replaced, so unrelated strings are safe.
 *
 * The feature store is remapped to the new UUIDs and becomes the single
 * canonical asset store. The dfd.assets mirror is DROPPED (emptied): it is a
 * runtime projection of the feature store, re-derived on load (commitAssetSync)
 * and stripped on save (prepareForDisk), so it is no longer persisted:
 *   - project.assets.assets[]  (canonical feature store — remapped)
 *   - project.dfd.assets[]     (mirror — dropped)
 *
 * Idempotent: an asset whose id already looks like a UUID contributes no
 * mapping and is left untouched, and refs already pointing at a UUID are left
 * untouched.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): boolean {
  return typeof value === "string" && UUID_RE.test(value);
}

function newUuid(): string {
  return crypto.randomUUID();
}

// Fields that hold a single asset id.
const ASSET_ID_KEYS = new Set(["assetId", "sourceAssetId", "targetAssetId"]);
// Fields that hold an array of asset ids.
const ASSET_ID_ARRAY_KEYS = new Set(["linkedAssetIds", "assetIds"]);

/**
 * Recursively rewrite any allowlisted asset-id reference field, mapping old
 * readable ids to their new UUIDs. Values not in the map (already-UUID refs,
 * unrelated strings) pass through unchanged.
 */
function rewriteAssetRefs(node: any, map: Map<string, string>): any {
  if (Array.isArray(node)) {
    return node.map((n) => rewriteAssetRefs(n, map));
  }
  if (node && typeof node === "object") {
    const out: Record<string, any> = {};
    for (const [key, value] of Object.entries(node)) {
      if (ASSET_ID_KEYS.has(key) && typeof value === "string") {
        out[key] = map.get(value) ?? value;
      } else if (ASSET_ID_ARRAY_KEYS.has(key) && Array.isArray(value)) {
        out[key] = value.map((v) =>
          typeof v === "string" ? (map.get(v) ?? v) : rewriteAssetRefs(v, map),
        );
      } else {
        out[key] = rewriteAssetRefs(value, map);
      }
    }
    return out;
  }
  return node;
}

export function migrate_5_to_6(data: any): any {
  // ── 1. Build old readable id → new UUID from BOTH asset stores ────────────
  const idToUuid = new Map<string, string>();
  const collect = (asset: any): void => {
    const id = asset?.id;
    if (typeof id === "string" && !isUuid(id) && !idToUuid.has(id)) {
      idToUuid.set(id, newUuid());
    }
  };
  (data.assets?.assets ?? []).forEach(collect);
  (data.dfd?.assets ?? []).forEach(collect);

  // Nothing to migrate (fresh/already-UUID project) — idempotent no-op.
  if (idToUuid.size === 0) {
    return { ...data, schemaVersion: 6 };
  }

  // ── 2. Repoint every asset-id reference across the whole project ──────────
  let next = rewriteAssetRefs(data, idToUuid);

  // ── 3. Rewrite the asset records themselves: id → UUID, old id → displayId ─
  const rewriteRecord = (asset: any): any => {
    if (!asset || typeof asset.id !== "string") return asset;
    const uuid = idToUuid.get(asset.id);
    if (!uuid) return asset; // already a UUID
    return {
      ...asset,
      id: uuid,
      // The old readable id becomes the display label (keep an existing,
      // already-readable displayId if one was set).
      displayId: asset.displayId ?? asset.id,
    };
  };

  if (next.assets?.assets && Array.isArray(next.assets.assets)) {
    next = {
      ...next,
      assets: {
        ...next.assets,
        assets: next.assets.assets.map(rewriteRecord),
      },
    };
  }
  // Drop the dfd.assets mirror: the feature store is now the single canonical
  // asset store, and all references were repointed above. dfd.assets is a
  // runtime projection re-derived on load (commitAssetSync) and stripped on
  // save (prepareForDisk), so it is not persisted.
  if (next.dfd && Array.isArray(next.dfd.assets)) {
    next = {
      ...next,
      dfd: {
        ...next.dfd,
        assets: [],
      },
    };
  }

  return { ...next, schemaVersion: 6 };
}
