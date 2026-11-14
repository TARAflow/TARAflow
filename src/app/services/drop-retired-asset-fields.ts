// ==================== RETIRED ASSET FIELDS ====================
// 0.19 (review 2026-11-14): the asset field "protection need" (low … critical)
// is retired. No calculation ever read it — threats, risks, compliance and
// the report take the impact from the security goals and the damage
// scenarios — and it could contradict them. Older files still carry it, on
// the asset record (`asset.protectionNeed`, `properties.protectionNeed`) and
// on the DFD's asset mirror. It is dropped on load so the in-memory project
// never carries it; the next save writes the file without it, and the commit
// diff lists the dropped values once (diff-service reads the previous state
// raw, see LegacyAssetFields there).
//
// Not analysis content: a verification of the file as read stays valid —
// the load re-keys it to the state without the field (migration-service).
// Embedded component snapshots are left as they are (hashed; the snapshot
// builder never took the field over).
//
// Pure: returns the input unchanged when nothing is to drop.

const RETIRED = "protectionNeed";

type Raw = Record<string, unknown>;
const isObject = (v: unknown): v is Raw => typeof v === "object" && v !== null && !Array.isArray(v);

/** The asset without the retired fields; the same object when it has none. */
function withoutRetired(asset: unknown): unknown {
  if (!isObject(asset)) return asset;
  const properties = asset.properties;
  const onProps = isObject(properties) && RETIRED in properties;
  if (!(RETIRED in asset) && !onProps) return asset;
  const { [RETIRED]: _top, ...rest } = asset;
  if (onProps) {
    const { [RETIRED]: _prop, ...props } = properties as Raw;
    return { ...rest, properties: props };
  }
  return rest;
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
