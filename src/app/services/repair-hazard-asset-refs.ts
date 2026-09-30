// app/services/repair-hazard-asset-refs.ts
//
// Load-time repair for hazard relations orphaned by the schema 5 → 6 asset
// identity split. That migration repointed every asset reference to the new
// UUID EXCEPT hazard relations, which carry the asset id in the generic
// `from` (contributes_to) / `to` (endangers) keys. Files migrated by those
// builds still point at the OLD readable label ("SY-001"), which since v6 is
// the asset's displayId — so the hazard tab shows the edges as unresolved.
//
// Repair: an asset-side reference that matches no asset id but EXACTLY ONE
// asset's displayId is repointed to that asset's id. Ambiguous or unknown
// references are left as they are (still flagged "unresolved" in the UI) —
// never guess. Edges that become identical after repointing are collapsed
// (first wins).
//
// Limitation: the match uses the CURRENT displayId. If an asset changed group
// after the migration its label was regenerated, and the old reference no
// longer matches — it stays unresolved rather than being mis-linked.
//
// Pure and idempotent; returns the input object unchanged when nothing needs
// repair. Runs before the schema migrations (applyLegacyMigrations): on a
// pre-v6 file every reference still resolves by id, so it is a no-op there
// and migrate_5_to_6 does the repoint.

function assetSideKey(r: any): "from" | "to" | null {
  if (r?.type === "contributes_to") return "from";
  if (r?.type === "endangers") return "to";
  return null;
}

export function repairHazardAssetRefs(data: any): any {
  const relations: unknown = data?.hazards?.relations;
  if (!Array.isArray(relations) || relations.length === 0) return data;

  const assets: any[] = [
    ...(Array.isArray(data?.assets?.assets) ? data.assets.assets : []),
    ...(Array.isArray(data?.dfd?.assets) ? data.dfd.assets : []),
  ];

  const ids = new Set<string>();
  // displayId → ids carrying it (more than one = ambiguous, never repointed)
  const byDisplayId = new Map<string, Set<string>>();
  for (const a of assets) {
    if (typeof a?.id !== "string") continue;
    ids.add(a.id);
    if (typeof a.displayId === "string" && a.displayId) {
      const set = byDisplayId.get(a.displayId) ?? new Set<string>();
      set.add(a.id);
      byDisplayId.set(a.displayId, set);
    }
  }

  let changed = false;
  const repaired = relations.map((r: any) => {
    const key = assetSideKey(r);
    if (!key) return r;
    const ref = r[key];
    if (typeof ref !== "string" || ids.has(ref)) return r;
    const candidates = byDisplayId.get(ref);
    if (!candidates || candidates.size !== 1) return r;
    changed = true;
    return { ...r, [key]: [...candidates][0] };
  });
  if (!changed) return data;

  // Collapse edges that became duplicates (same type + endpoints).
  const seen = new Set<string>();
  const deduped = repaired.filter((r: any) => {
    const k = `${r?.type}\u0000${r?.from}\u0000${r?.to}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return {
    ...data,
    hazards: { ...data.hazards, relations: deduped },
  };
}
