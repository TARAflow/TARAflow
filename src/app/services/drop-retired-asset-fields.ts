// ==================== RETIRED ASSET FIELDS ====================
// Asset fields taken out of the model (shared/models/retired-asset-fields.ts:
// the protection need, the criticality, dead model fields — 0.19). Older
// files still carry them, on the asset record or in `properties`, in the
// asset store and on the DFD's asset mirror. They are dropped on load so the
// in-memory project never carries them; the next save writes the file
// without them, and the commit diff lists the dropped values once
// (diff-service reads the previous state raw, see LegacyAssetFields there).
//
// Not analysis content: a verification of the file as read stays valid —
// the load re-keys it to the state without the field (migration-service).
// Embedded component snapshots are left as they are (hashed; the snapshot
// builder never took the field over).
//
// Pure: returns the input unchanged when nothing is to drop.

import { RETIRED_ASSET_FIELDS } from "../../shared/models/retired-asset-fields";

const RETIRED: readonly string[] = RETIRED_ASSET_FIELDS;

type Raw = Record<string, unknown>;
const isObject = (v: unknown): v is Raw => typeof v === "object" && v !== null && !Array.isArray(v);

const without = (o: Raw): Raw => Object.fromEntries(Object.entries(o).filter(([k]) => !RETIRED.includes(k)));
const hasRetired = (o: Raw) => RETIRED.some((k) => k in o);

/** The asset without the retired fields; the same object when it has none. */
function withoutRetired(asset: unknown): unknown {
  if (!isObject(asset)) return asset;
  const properties = asset.properties;
  const onProps = isObject(properties) && hasRetired(properties);
  if (!hasRetired(asset) && !onProps) return asset;
  const rest = without(asset);
  return onProps ? { ...rest, properties: without(properties as Raw) } : rest;
}

function listWithout(list: unknown): unknown {
  if (!Array.isArray(list)) return list;
  const next = list.map(withoutRetired);
  return next.some((a, i) => a !== list[i]) ? next : list;
}

export function dropRetiredAssetFields<T>(data: T): T {
  if (!isObject(data)) return data;
  let out: Raw = data;
  const store = out.assets;
  if (isObject(store)) {
    const assets = listWithout(store.assets);
    if (assets !== store.assets) out = { ...out, assets: { ...store, assets } };
  }
  const dfd = out.dfd;
  if (isObject(dfd)) {
    const assets = listWithout(dfd.assets);
    if (assets !== dfd.assets) out = { ...out, dfd: { ...dfd, assets } };
  }
  return out as T;
}
