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

/**
 * The hazards the asset graph shows: only those marked relevant in the Hazard
 * tab (system relevance "in scope", user 2026-11-06) — out of scope, unknown
 * or unreviewed ones and their edges are left out, also from the counts.
 */
export function onlyRelevantHazards(source: AssetGraphSource): AssetGraphSource {
  if (!source.hazards) return source;
  const items = source.hazards.items.filter((h) => h.systemRelevance === "in_scope");
  if (items.length === source.hazards.items.length) return source;
  const kept = new Set(items.map((h) => h.id as string));
  const relations = source.hazards.relations.filter((r) =>
    isContributesTo(r) ? kept.has(r.to) : isEndangers(r) ? kept.has(r.from) : false,
  );
  return { ...source, hazards: { items, relations } };
}

/**
 * Relation filter of the layer view (user 2026-11-06): one checkbox per kind
 * of relation, all ticked by default. A hazard is a node like an asset; the
 * kind of a relation is its other end:
 *   asset    an asset's relation to another asset, and a hazard's relation
 *            to an asset (the chain asset → hazard → asset)
 *   element  an asset's relation to a DFD element
 *   hazard   an asset's relation to a hazard
 * An unticked kind hides every node (asset or hazard) with such a relation;
 * nothing ticked leaves the nodes without any relation. A relation to an
 * asset or hazard that no longer exists does not count.
 */
export type RelationKind = "element" | "asset" | "hazard";

export const RELATION_KINDS: readonly RelationKind[] = ["element", "asset", "hazard"];

export interface RelationIndex {
  /** Per kind, the asset ids with such a relation (whole model, not a page). */
  readonly assets: Record<RelationKind, ReadonlySet<string>>;
  /** Hazard ids with a relation to an existing asset (kind "asset" for the hazard). */
  readonly linkedHazards: ReadonlySet<string>;
}

export function relationIndex(source: AssetGraphSource): RelationIndex {
  const ids = new Set(source.assets.map((a) => a.id));
  const asset = new Set<string>();
  for (const r of source.relations) {
    if (!ids.has(r.sourceAssetId) || !ids.has(r.targetAssetId)) continue;
    asset.add(r.sourceAssetId);
    asset.add(r.targetAssetId);
  }
  const hazardIds = new Set((source.hazards?.items ?? []).map((h) => h.id as string));
  const hazard = new Set<string>();
  const linkedHazards = new Set<string>();
  for (const r of source.hazards?.relations ?? []) {
    const [assetId, hazardId] = isContributesTo(r) ? [r.from, r.to] : isEndangers(r) ? [r.to, r.from] : [];
    if (!assetId || !hazardId || !ids.has(assetId) || !hazardIds.has(hazardId)) continue;
    hazard.add(assetId);
    linkedHazards.add(hazardId);
  }
  const element = new Set<string>();
  for (const el of source.elements) for (const r of el.assetRelations ?? []) if (ids.has(r.assetId)) element.add(r.assetId);
  return { assets: { element, asset, hazard }, linkedHazards };
}

/** Whether an asset stays: every kind of relation it has is ticked. */
export function assetPassesRelations(index: RelationIndex, assetId: string, ticked: readonly RelationKind[]): boolean {
  return RELATION_KINDS.every((kind) => ticked.includes(kind) || !index.assets[kind].has(assetId));
}

/** Whether a hazard stays: its relations are of kind "asset". */
export function hazardPassesRelations(index: RelationIndex, hazardId: string, ticked: readonly RelationKind[]): boolean {
  return ticked.includes("asset") || !index.linkedHazards.has(hazardId);
}

/** The source as the relation filter shows it (assets, hazards and the hazard edges between kept nodes). */
export function filterByRelations(
  source: AssetGraphSource,
  index: RelationIndex,
  ticked: readonly RelationKind[],
): AssetGraphSource {
  if (RELATION_KINDS.every((k) => ticked.includes(k))) return source;
  const assets = source.assets.filter((a) => assetPassesRelations(index, a.id, ticked));
  if (!source.hazards) return { ...source, assets };
  const items = source.hazards.items.filter((h) => hazardPassesRelations(index, h.id as string, ticked));
  const keptAssets = new Set(assets.map((a) => a.id));
  const keptHazards = new Set(items.map((h) => h.id as string));
  const relations = source.hazards.relations.filter((r) =>
    isContributesTo(r)
      ? keptAssets.has(r.from) && keptHazards.has(r.to)
      : isEndangers(r)
        ? keptHazards.has(r.from) && keptAssets.has(r.to)
        : false,
  );
  return { ...source, assets, hazards: { items, relations } };
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
