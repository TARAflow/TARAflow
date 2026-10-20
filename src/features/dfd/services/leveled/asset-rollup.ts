// ==================== ASSET ROLL-UP ====================
// Leveled DFD Phase 6d (leveled-dfd-multi-diagram-design.md §9, D3).
//
//   roll-up   a decomposed multiprocess holds no relations of its own: what
//             it holds is the set of distinct (asset, relation type) pairs
//             of its parts — the leaves below it and the flows between
//             them — with the parts that hold each pair ("via P-4, DS-2").
//             Read-only, derived on every view.
//   pending   relations the multiprocess held before it was decomposed stay
//             on its record: "not yet assigned to a part". A save removes a
//             pending relation as soon as a part holds the same pair (it is
//             then covered by the roll-up); until then the validator reports
//             BAL_ASSET_NOT_REALISED. Pending relations are never copied to
//             the parts — which part holds an asset is the analyst's call.
//   undo      when the decomposition ends (child page deleted, last own part
//             removed), a save materialises the roll-up of the last state as
//             the multiprocess' own relations, so no coverage is lost.
//
// A part that is deleted simply leaves the roll-up; no pending relation is
// re-created (the deletion is an explicit action, visible in the diff).

import type { DFDElement } from "../../models/dfd-types";
import type { AssetRelation } from "../../models/asset-relation-types";
import type { DfdGraphSource } from "../build-dfd-graph";
import { effectiveModelOf, isLeveled } from "../build-dfd-graph";
import type { EffectiveModel } from "./effective-model";

export interface RollupEntry {
  assetId: string;
  relationType: string;
  /** The relation as the first holding part has it (for materialising). */
  relation: AssetRelation;
  /** tfIds of the parts (elements and flows) holding the pair. */
  via: string[];
}

export interface MultiprocessAssets {
  /** Pairs held by the parts, in asset order of first appearance. */
  rollup: RollupEntry[];
  /** Own relations of the multiprocess not covered by the roll-up. */
  pending: AssetRelation[];
}

interface Records {
  elements: ReadonlyMap<string, { assetRelations?: AssetRelation[] }>;
  connections: ReadonlyMap<string, { assetRelations?: AssetRelation[] }>;
}

const pairKey = (r: { assetId: string; relationType: string }) => `${r.assetId}\u0000${r.relationType}`;

/** Roll-up and pending relations of every decomposed multiprocess. */
export function assetRollupsOf(
  model: Pick<EffectiveModel, "containmentParent" | "flows">,
  records: Records,
): Map<string, MultiprocessAssets> {
  const parent = model.containmentParent;
  const decomposed = new Set(parent.values());
  const ancestorsOf = (tfId: string): string[] => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (let mp = parent.get(tfId); mp !== undefined && !seen.has(mp); mp = parent.get(mp)) {
      seen.add(mp);
      out.push(mp);
    }
    return out;
  };

  const entries = new Map<string, Map<string, RollupEntry>>();
  const hold = (mp: string, holder: string, relations: AssetRelation[] | undefined) => {
    let pairs = entries.get(mp);
    if (!pairs) entries.set(mp, (pairs = new Map()));
    for (const relation of relations ?? []) {
      const key = pairKey(relation);
      const entry = pairs.get(key);
      if (entry) {
        if (!entry.via.includes(holder)) entry.via.push(holder);
      } else {
        pairs.set(key, {
          assetId: relation.assetId,
          relationType: relation.relationType,
          relation,
          via: [holder],
        });
      }
    }
  };

  for (const mp of decomposed) entries.set(mp, new Map());
  // Parts: the leaves below a multiprocess. A decomposed multiprocess below
  // it holds only pending relations — those are not realised by a part.
  for (const tfId of parent.keys()) {
    if (decomposed.has(tfId)) continue;
    const relations = records.elements.get(tfId)?.assetRelations;
    for (const mp of ancestorsOf(tfId)) hold(mp, tfId, relations);
  }
  // Flows between parts of the same multiprocess.
  for (const flow of model.flows) {
    const from = new Set(ancestorsOf(flow.from));
    const relations = records.connections.get(flow.tfId)?.assetRelations;
    for (const mp of ancestorsOf(flow.to)) {
      if (from.has(mp)) hold(mp, flow.tfId, relations);
    }
  }

  const out = new Map<string, MultiprocessAssets>();
  for (const [mp, pairs] of entries) {
    const own = records.elements.get(mp)?.assetRelations ?? [];
    out.set(mp, {
      rollup: [...pairs.values()],
      pending: own.filter((r) => !pairs.has(pairKey(r))),
    });
  }
  return out;
}

/** Roll-ups of a DFD source; empty for a classic DFD. */
export function assetRollupsOfSource(source: DfdGraphSource): Map<string, MultiprocessAssets> {
  if (!isLeveled(source.xml)) return new Map();
  const { model, records } = effectiveModelOf(source);
  return assetRollupsOf(model, records);
}

/**
 * Applied on every save: removes pending relations a part now covers, and
 * materialises the last roll-up on a multiprocess whose decomposition ended.
 * Returns `after.elements` itself when nothing changes.
 */
export function reconcileAssetRollup(
  before: DfdGraphSource | undefined,
  after: DfdGraphSource,
): DFDElement[] {
  const rollups = assetRollupsOfSource(after);
  const updates = new Map<string, AssetRelation[]>();

  // Covered pending relations leave the multiprocess.
  for (const [mp, { pending }] of rollups) {
    const own = after.elements.find((e) => e.id === mp)?.assetRelations ?? [];
    if (pending.length < own.length) updates.set(mp, pending);
  }

  // Decomposition ended: only then the previous state is analysed.
  const candidates = (before?.pages ?? [])
    .map((p) => p.decomposes)
    .filter((mp): mp is string => !!mp && !rollups.has(mp) && after.elements.some((e) => e.id === mp));
  if (before && candidates.length > 0) {
    const previous = assetRollupsOfSource(before);
    for (const mp of candidates) {
      const last = previous.get(mp);
      if (!last) continue; // was not decomposed (no own part yet)
      const own = updates.get(mp) ?? after.elements.find((e) => e.id === mp)?.assetRelations ?? [];
      const have = new Set(own.map(pairKey));
      const added = last.rollup.filter((r) => !have.has(pairKey(r))).map((r) => r.relation);
      if (added.length > 0) updates.set(mp, [...own, ...added]);
    }
  }

  if (updates.size === 0) return after.elements;
  return after.elements.map((e) => (updates.has(e.id) ? { ...e, assetRelations: updates.get(e.id) } : e));
}
