// features/dfd/asset-graph/asset-graph-query.ts
//
// Questions the context bar asks about a prepared graph (FR-V10, UX-6):
// which relation types exist, which assets match a search, and — for a
// match that is not drawn — why not.

import {
  compareDisplayIds,
  isContributesTo,
  isEndangers,
  validateA2ARelations,
  type AssetGroup,
  type HazardRelation,
} from "shared";
import { layerRank } from "./asset-graph-layers";
import type { AssetGraph, AssetGraphOptions, AssetGraphSource, GraphAssetInput } from "./asset-graph-types";

export interface RelationTypeCount {
  readonly type: string;
  readonly kind: "a2a" | "anchor";
  readonly count: number;
}

/** All relation types in the source, asset links first, then by name. */
export function relationTypesIn(source: AssetGraphSource): RelationTypeCount[] {
  const counts = new Map<string, RelationTypeCount>();
  const add = (type: string, kind: "a2a" | "anchor") => {
    const key = `${kind}:${type}`;
    const c = counts.get(key);
    counts.set(key, { type, kind, count: (c?.count ?? 0) + 1 });
  };
  for (const r of source.relations) add(r.relationType, "a2a");
  for (const el of source.elements) {
    for (const r of el.assetRelations ?? []) add(r.relationType, "anchor");
  }
  return [...counts.values()].sort(
    (a, b) =>
      (a.kind === b.kind ? 0 : a.kind === "a2a" ? -1 : 1) || a.type.localeCompare(b.type),
  );
}

/** Assets whose displayId or name contains the query (case-insensitive). */
export function searchAssets(
  source: AssetGraphSource,
  query: string,
): GraphAssetInput[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return source.assets
    .filter(
      (a) =>
        (a.displayId ?? "").toLowerCase().includes(q) ||
        (a.name ?? "").toLowerCase().includes(q),
    )
    .sort(
      (a, b) =>
        layerRank(a.assetGroup) - layerRank(b.assetGroup) ||
        compareDisplayIds(a.displayId ?? a.id, b.displayId ?? b.id),
    );
}

export type AssetVisibility =
  | { readonly state: "visible" }
  | { readonly state: "hiddenLayer"; readonly layer: string }
  | { readonly state: "outsideFocus" }
  /** Leveled DFD (6f): held by no element of the pages the graph is filtered to. */
  | { readonly state: "outsidePage" }
  | { readonly state: "unknown" };

/** Why an asset is (not) drawn — the answer to "why don't I see X?" (UX-6). */
export function assetVisibility(
  graph: Pick<AssetGraph, "nodes">,
  source: AssetGraphSource,
  options: Pick<AssetGraphOptions, "layers">,
  assetId: string,
  /** The assets the page filter keeps; absent = no page filter. */
  onPages?: ReadonlySet<string>,
): AssetVisibility {
  if (graph.nodes.some((n) => n.kind === "asset" && n.id === assetId)) {
    return { state: "visible" };
  }
  const asset = source.assets.find((a) => a.id === assetId);
  if (!asset) return { state: "unknown" };
  if (onPages && !onPages.has(assetId)) return { state: "outsidePage" };
  if (!options.layers.includes(asset.assetGroup as never)) {
    return { state: "hiddenLayer", layer: String(asset.assetGroup) };
  }
  return { state: "outsideFocus" };
}

// ==================== PAGE FILTER (leveled DFD, 6f) ====================

/**
 * The part of the source on some pages of a leveled DFD (§9): the elements
 * and flows shown there (`items`), the assets they hold, and the asset links
 * among those assets. Hazard Items stay when an asset on the pages causes
 * them or is endangered by them; their protection targets stay with them (a
 * person or a building has no DFD element). A hazard without such an edge
 * is not on the pages.
 */
export function sourceOnPages(
  source: AssetGraphSource,
  items: ReadonlySet<string>,
): AssetGraphSource {
  const elements = source.elements.filter((e) => items.has(e.id));
  const held = new Set(elements.flatMap((e) => (e.assetRelations ?? []).map((r) => r.assetId)));
  const assetEnd = (r: HazardRelation) => (isContributesTo(r) ? r.from : r.to);
  const hazardEnd = (r: HazardRelation) => (isContributesTo(r) ? r.to : r.from);
  const hazardIds = new Set(
    (source.hazards?.relations ?? []).filter((r) => held.has(assetEnd(r))).map(hazardEnd),
  );
  const hazardRelations = (source.hazards?.relations ?? []).filter(
    (r) => hazardIds.has(hazardEnd(r)) && (held.has(assetEnd(r)) || isEndangers(r)),
  );
  const shown = new Set([...held, ...hazardRelations.map(assetEnd)]);
  const onPages: AssetGraphSource = {
    assets: source.assets.filter((a) => shown.has(a.id)),
    relations: source.relations.filter((r) => shown.has(r.sourceAssetId) && shown.has(r.targetAssetId)),
    elements,
  };
  if (!source.hazards) return onPages;
  return {
    ...onPages,
    hazards: {
      items: source.hazards.items.filter((h) => hazardIds.has(h.id)),
      relations: hazardRelations,
    },
  };
}

// ==================== DETAIL: RELATIONS GROUPED BY TYPE (FR-V8) ====================

export interface GroupedRelationItem {
  /** The other end: an asset id or an element id (anchors). */
  readonly id: string;
  readonly displayId: string;
  readonly name: string;
  readonly stepOrder?: number;
  /** The A2A relation id (edge details); undefined for anchors. */
  readonly relationId?: string;
}

export interface GroupedRelations {
  /** Stored type (outgoing), its inverse name (incoming) or the element relation type. */
  readonly label: string;
  readonly relationType: string;
  readonly direction: "out" | "in" | "element";
  readonly items: readonly GroupedRelationItem[];
}

/**
 * The relations of one asset, grouped by type and read from the asset's
 * side: outgoing links under the stored type, incoming ones under the
 * inverse name (`requires`, `implemented by` …), then DFD elements bound to
 * it. Within a group: step order, then display id.
 */
export function relationsOfAssetGrouped(
  source: AssetGraphSource,
  assetId: string,
  inverseName: (relationType: string) => string,
): GroupedRelations[] {
  const assets = new Map(source.assets.map((a) => [a.id, a]));
  const groups = new Map<string, { label: string; relationType: string; direction: GroupedRelations["direction"]; items: GroupedRelationItem[] }>();
  const push = (
    key: string,
    head: { label: string; relationType: string; direction: GroupedRelations["direction"] },
    item: GroupedRelationItem,
  ) => {
    const g = groups.get(key) ?? groups.set(key, { ...head, items: [] }).get(key)!;
    g.items.push(item);
  };
  for (const r of source.relations) {
    const out = r.sourceAssetId === assetId;
    const inn = r.targetAssetId === assetId;
    if (!out && !inn) continue;
    const otherId = out ? r.targetAssetId : r.sourceAssetId;
    const other = assets.get(otherId);
    const item: GroupedRelationItem = {
      id: otherId,
      displayId: other?.displayId ?? otherId.slice(0, 8),
      name: other?.name ?? "",
      relationId: r.id,
      ...(r.stepOrder !== undefined ? { stepOrder: r.stepOrder } : {}),
    };
    if (out) {
      push(`out:${r.relationType}`, { label: r.relationType, relationType: r.relationType, direction: "out" }, item);
    } else {
      push(`in:${r.relationType}`, { label: inverseName(r.relationType), relationType: r.relationType, direction: "in" }, item);
    }
  }
  for (const el of source.elements) {
    for (const r of el.assetRelations ?? []) {
      if (r.assetId !== assetId) continue;
      push(
        `el:${r.relationType}`,
        { label: r.relationType, relationType: r.relationType, direction: "element" },
        { id: el.id, displayId: el.displayId ?? el.id, name: el.name ?? "" },
      );
    }
  }
  const rank = { out: 0, in: 1, element: 2 } as const;
  return [...groups.values()]
    .sort((a, b) => rank[a.direction] - rank[b.direction] || a.label.localeCompare(b.label))
    .map((g) => ({
      ...g,
      items: [...g.items].sort(
        (a, b) =>
          (a.stepOrder ?? Infinity) - (b.stepOrder ?? Infinity) ||
          compareDisplayIds(a.displayId, b.displayId),
      ),
    }));
}

// ==================== FINDINGS (UX-4, stage 4) ====================

/**
 * Asset links the rules no longer allow (e.g. after a group change), by
 * relation id → reason. Same check as the findings panels
 * (validateA2ARelations); shown as a small symbol, never by colour.
 */
export function invalidLinks(source: AssetGraphSource): Map<string, string> {
  const groups = new Map(source.assets.map((a) => [a.id, a.assetGroup as AssetGroup]));
  const out = new Map<string, string>();
  for (const f of validateA2ARelations(source.relations, (id) => groups.get(id))) {
    out.set(f.relationId, f.reason);
  }
  return out;
}
