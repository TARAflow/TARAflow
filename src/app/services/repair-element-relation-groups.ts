// app/services/repair-element-relation-groups.ts
//
// Load-time repair for DFD element → asset relations whose cached
// `assetGroup` does not match the asset's group (B15). The side panel's
// relation dialog stored every "uses" as system and every "accesses" as
// infrastructure — also for service and physical assets. The validator, the
// qualifier handling and the type guards (isServiceUsesRelation, …) read that
// field, so a service "uses" was treated as a system "uses".
//
// Repair: the relation takes the group of the asset it points to. Nothing
// else changes — a qualifier from the wrong group stays as it is (no
// guessing); the dialog then asks for a valid one before it saves again.
// Relations to unknown assets are left alone (the validator reports them).
//
// Pure and idempotent; returns the input object unchanged when nothing needs
// repair. Runs in the legacy repair pass before the schema migrations; on a
// pre-v6 file asset ids are still the readable labels and resolve the same
// way, so the order does not matter.

export function repairElementRelationGroups(data: any): any {
  const dfd = data?.dfd;
  if (!dfd) return data;

  const groupOf = new Map<string, string>();
  for (const list of [data?.assets?.assets, dfd.assets]) {
    if (!Array.isArray(list)) continue;
    for (const a of list) {
      if (a && typeof a.id === "string" && typeof a.assetGroup === "string" && !groupOf.has(a.id)) {
        groupOf.set(a.id, a.assetGroup);
      }
    }
  }
  if (groupOf.size === 0) return data;

  const fix = (items: unknown): { items: unknown; changed: boolean } => {
    if (!Array.isArray(items)) return { items, changed: false };
    let changed = false;
    const next = items.map((item: any) => {
      if (!Array.isArray(item?.assetRelations)) return item;
      let itemChanged = false;
      const relations = item.assetRelations.map((r: any) => {
        const group = groupOf.get(r?.assetId);
        if (!group || r.assetGroup === group) return r;
        itemChanged = true;
        return { ...r, assetGroup: group };
      });
      if (!itemChanged) return item;
      changed = true;
      return { ...item, assetRelations: relations };
    });
    return { items: changed ? next : items, changed };
  };

  const elements = fix(dfd.elements);
  const connections = fix(dfd.connections);
  if (!elements.changed && !connections.changed) return data;
  return {
    ...data,
    dfd: { ...dfd, elements: elements.items, connections: connections.items },
  };
}
