// features/dfd/asset-graph/build-asset-graph.ts
//
// Pure preparation of the asset graph view (AR-11): assets + asset links +
// element anchors + view options → nodes, edges, stubs, context-bar counts.
// No React, no D3; the same input always yields the same output in the same
// order (AR-10: the layout starts from it).
//
// Rules:
//   - Layers: only assets of visible layers become nodes. The focus asset is
//     always shown, whatever its layer.
//   - Type filter: hidden relation types neither draw nor connect — the focus
//     walk does not cross them, stubs do not count them.
//   - Focus view: assets within `depth` hops over visible links, both
//     directions. Links to hidden layers end in stubs, not in the walk.
//   - Stubs (FR-V4): per visible asset, its links to assets in hidden layers,
//     grouped by the target's layer.
//   - Anchors (FR-V6): one node per DFD element bound to a visible asset;
//     always in the focus view, optional in the layer view.
//   - Nothing is invented (UX-8): only stored edges are drawn.

import { compareDisplayIds, type AssetGroup } from "shared";
import { layerRank } from "./asset-graph-layers";
import type {
  AssetGraph,
  AssetGraphAnchorNode,
  AssetGraphAssetNode,
  AssetGraphEdge,
  AssetGraphNode,
  AssetGraphOptions,
  AssetGraphSource,
  AssetGraphStub,
  GraphAssetInput,
} from "./asset-graph-types";

export const ANCHOR_PREFIX = "el:";
export const DEFAULT_FOCUS_DEPTH = 1;

const byDisplay = (a: GraphAssetInput, b: GraphAssetInput) =>
  layerRank(a.assetGroup) - layerRank(b.assetGroup) ||
  compareDisplayIds(a.displayId ?? a.id, b.displayId ?? b.id) ||
  (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

const byId = (a: { id: string }, b: { id: string }) =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

export function buildAssetGraph(
  source: AssetGraphSource,
  options: AssetGraphOptions,
): AssetGraph {
  const assetsById = new Map(source.assets.map((a) => [a.id, a]));
  const visibleLayers = new Set<string>(options.layers);
  const typeFilter = options.relationTypes ? new Set(options.relationTypes) : null;
  const passesFilter = (type: string) => !typeFilter || typeFilter.has(type);

  const focusId =
    options.view === "focus" ? options.focusAssetId ?? null : null;
  const focusMissing =
    options.view === "focus" && (!focusId || !assetsById.has(focusId));

  const inVisibleLayer = (a: GraphAssetInput) =>
    visibleLayers.has(a.assetGroup) || a.id === focusId;

  // Only edges whose ends both exist are drawable at all.
  const edges = source.relations.filter(
    (r) => assetsById.has(r.sourceAssetId) && assetsById.has(r.targetAssetId),
  );

  // ── Which assets are shown ──────────────────────────────────────────────
  let shown: Map<string, number | undefined>; // id → distance (focus view)
  if (options.view === "focus") {
    shown = new Map();
    if (!focusMissing && focusId) {
      const depth = Math.max(0, options.depth ?? DEFAULT_FOCUS_DEPTH);
      const neighbours = new Map<string, string[]>();
      for (const r of edges) {
        if (!passesFilter(r.relationType)) continue;
        const s = assetsById.get(r.sourceAssetId)!;
        const t = assetsById.get(r.targetAssetId)!;
        if (!inVisibleLayer(s) || !inVisibleLayer(t)) continue;
        (neighbours.get(s.id) ?? neighbours.set(s.id, []).get(s.id)!).push(t.id);
        (neighbours.get(t.id) ?? neighbours.set(t.id, []).get(t.id)!).push(s.id);
      }
      shown.set(focusId, 0);
      let frontier = [focusId];
      for (let d = 1; d <= depth && frontier.length > 0; d++) {
        const next: string[] = [];
        for (const id of frontier) {
          for (const n of neighbours.get(id) ?? []) {
            if (shown.has(n)) continue;
            shown.set(n, d);
            next.push(n);
          }
        }
        frontier = next;
      }
    }
  } else {
    shown = new Map(
      source.assets.filter(inVisibleLayer).map((a) => [a.id, undefined]),
    );
  }

  // ── Asset nodes ─────────────────────────────────────────────────────────
  const assetNodes: AssetGraphAssetNode[] = source.assets
    .filter((a) => shown.has(a.id))
    .sort(byDisplay)
    .map((a) => {
      const distance = shown.get(a.id);
      return {
        kind: "asset",
        id: a.id,
        displayId: a.displayId ?? a.id,
        name: a.name ?? "",
        group: a.assetGroup,
        ...(a.protectionNeed ? { protectionNeed: a.protectionNeed } : {}),
        ...(distance !== undefined ? { distance } : {}),
      };
    });

  // ── A2A edges, stubs, filter count ──────────────────────────────────────
  const a2aEdges: AssetGraphEdge[] = [];
  const stubCounts = new Map<string, Map<string, number>>();
  let edgesHiddenByFilter = 0;
  for (const r of edges) {
    const sShown = shown.has(r.sourceAssetId);
    const tShown = shown.has(r.targetAssetId);
    if (sShown && tShown) {
      if (passesFilter(r.relationType)) {
        a2aEdges.push({
          id: r.id,
          kind: "a2a",
          source: r.sourceAssetId,
          target: r.targetAssetId,
          relationType: r.relationType,
          ...(r.stepOrder !== undefined ? { stepOrder: r.stepOrder } : {}),
        });
      } else {
        edgesHiddenByFilter += 1;
      }
      continue;
    }
    if (!passesFilter(r.relationType)) continue;
    // One end shown, the other in a hidden layer → stub at the shown end.
    const stubAt = (from: string, other: string) => {
      const o = assetsById.get(other)!;
      if (visibleLayers.has(o.assetGroup)) return; // visible layer, outside focus
      const perLayer = stubCounts.get(from) ?? stubCounts.set(from, new Map()).get(from)!;
      perLayer.set(o.assetGroup, (perLayer.get(o.assetGroup) ?? 0) + 1);
    };
    if (sShown) stubAt(r.sourceAssetId, r.targetAssetId);
    if (tShown) stubAt(r.targetAssetId, r.sourceAssetId);
  }

  const stubs: Record<string, AssetGraphStub[]> = {};
  for (const [nodeId, perLayer] of [...stubCounts].sort(([a], [b]) => (a < b ? -1 : 1))) {
    stubs[nodeId] = [...perLayer]
      .sort(([a], [b]) => layerRank(a) - layerRank(b))
      .map(([layer, count]) => ({ layer: layer as AssetGroup, count }));
  }

  // ── Element anchors ─────────────────────────────────────────────────────
  const anchorNodes: AssetGraphAnchorNode[] = [];
  const anchorEdges: AssetGraphEdge[] = [];
  const withAnchors = options.view === "focus" || options.showAnchors === true;
  if (withAnchors) {
    for (const el of [...source.elements].sort(byId)) {
      const links = (el.assetRelations ?? []).filter(
        (r) => shown.has(r.assetId) && passesFilter(r.relationType),
      );
      if (links.length === 0) continue;
      const nodeId = ANCHOR_PREFIX + el.id;
      anchorNodes.push({
        kind: "anchor",
        id: nodeId,
        elementId: el.id,
        elementType: el.type,
        displayId: el.displayId ?? el.id,
        name: el.name ?? "",
      });
      const seen = new Set<string>();
      for (const r of links) {
        const id = `${nodeId}->${r.assetId}:${r.relationType}`;
        if (seen.has(id)) continue;
        seen.add(id);
        anchorEdges.push({
          id,
          kind: "anchor",
          source: nodeId,
          target: r.assetId,
          relationType: r.relationType,
        });
      }
    }
  }

  // ── Counts ──────────────────────────────────────────────────────────────
  let assetsInHiddenLayers = 0;
  let assetsOutsideFocus = 0;
  for (const a of source.assets) {
    if (shown.has(a.id)) continue;
    if (!inVisibleLayer(a)) assetsInHiddenLayers += 1;
    else assetsOutsideFocus += 1;
  }

  const nodes: AssetGraphNode[] = [...assetNodes, ...anchorNodes];
  const allEdges = [...a2aEdges.sort(byId), ...anchorEdges.sort(byId)];
  return {
    nodes,
    edges: allEdges,
    stubs,
    counts: {
      assetsTotal: source.assets.length,
      assetsVisible: assetNodes.length,
      assetsInHiddenLayers,
      assetsOutsideFocus,
      edgesHiddenByFilter,
      edgesVisible: a2aEdges.length,
      anchorsVisible: anchorNodes.length,
    },
    focusMissing,
  };
}

/** Layers that hide at least one link of a shown asset (for "show layer"). */
export function hiddenLayersWithStubs(graph: AssetGraph): AssetGroup[] {
  const layers = new Set<string>();
  for (const list of Object.values(graph.stubs)) {
    for (const s of list) layers.add(s.layer);
  }
  return [...layers].sort((a, b) => layerRank(a) - layerRank(b)) as AssetGroup[];
}
