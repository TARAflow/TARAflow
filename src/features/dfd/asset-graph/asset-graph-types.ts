// features/dfd/asset-graph/asset-graph-types.ts
//
// Input and output of the asset graph preparation (AR-11). The preparation is
// a pure function; rendering (D3) only draws what it returns.

import type { A2ARelation, AssetGroup, HazardItem, HazardRelation } from "shared";

// ==================== INPUT ====================

/** The asset fields the graph needs (feature store or DFD mirror). */
export interface GraphAssetInput {
  readonly id: string;
  readonly displayId?: string;
  readonly name?: string;
  readonly assetGroup: AssetGroup | string;
  readonly protectionNeed?: string;
}

/** A DFD element or data flow with its element-to-asset relations. */
export interface GraphElementInput {
  readonly id: string;
  readonly displayId?: string;
  readonly name?: string;
  /** DFD element type; "DataFlow" for connections. */
  readonly type: string;
  readonly assetRelations?: readonly {
    readonly assetId: string;
    readonly relationType: string;
  }[];
}

export interface AssetGraphSource {
  readonly assets: readonly GraphAssetInput[];
  /** Canonical asset-to-asset edges (assets.relations). */
  readonly relations: readonly A2ARelation[];
  /** DFD elements and data flows (element anchors, FR-V6). */
  readonly elements: readonly GraphElementInput[];
  /**
   * Hazard Items and their edges (FR-V11, read-only), from the project's
   * hazard data — passed by the app layer. Absent: the graph shows no hazards
   * and behaves as before.
   */
  readonly hazards?: AssetGraphHazards;
}

export interface AssetGraphHazards {
  readonly items: readonly HazardItem[];
  readonly relations: readonly HazardRelation[];
}

export type AssetGraphViewKind = "layers" | "focus";

export interface AssetGraphOptions {
  readonly view: AssetGraphViewKind;
  /** Visible layers (asset groups). */
  readonly layers: readonly AssetGroup[];
  /** Focus view: the asset in the centre. */
  readonly focusAssetId?: string | null;
  /** Focus view: hops in both directions (default 1). */
  readonly depth?: number;
  /** Relation types to show; null/undefined = all (FR-V10). */
  readonly relationTypes?: readonly string[] | null;
  /** Element anchors: always in the focus view, optional in the layer view. */
  readonly showAnchors?: boolean;
  /**
   * Hazard Items and their edges (FR-V11, layer view). The focus view takes
   * hazards as neighbours later (FR-V11b).
   */
  readonly showHazards?: boolean;
}

// ==================== OUTPUT ====================

export interface AssetGraphAssetNode {
  readonly kind: "asset";
  readonly id: string;
  readonly displayId: string;
  readonly name: string;
  readonly group: AssetGroup | string;
  readonly protectionNeed?: string;
  /** Hops from the focus asset (focus view only; 0 = the focus asset). */
  readonly distance?: number;
}

export interface AssetGraphAnchorNode {
  readonly kind: "anchor";
  /** "el:" + element id — never collides with an asset id. */
  readonly id: string;
  readonly elementId: string;
  readonly elementType: string;
  readonly displayId: string;
  readonly name: string;
}

/** A Hazard Item (FR-V11) — read-only, edited in the Hazard tab (G2). */
export interface AssetGraphHazardNode {
  readonly kind: "hazard";
  /** "hz:" + hazard item id — never collides with an asset or anchor id. */
  readonly id: string;
  readonly hazardId: string;
  /** `externalRef`, else the label (FR-V11). */
  readonly displayId: string;
  readonly name: string;
  /** Worst severity of its endangers edges ("" without one) and its rank 0–4. */
  readonly severity: string;
  readonly severityRank: number;
  /** False: no edge to an existing asset (FR-V11e, "not linked"). */
  readonly linked: boolean;
}

export type AssetGraphNode =
  | AssetGraphAssetNode
  | AssetGraphAnchorNode
  | AssetGraphHazardNode;

export interface AssetGraphEdge {
  /** A2A: the relation id; anchor and hazard edges: derived, stable. */
  readonly id: string;
  /**
   * Solid (A2A) vs dashed (element → asset) — UX-3. Hazard edges (FR-V11a):
   * asset → hazard (`contributes_to`), hazard → protection target
   * (`endangers`); relationType is the same word.
   */
  readonly kind: "a2a" | "anchor" | "contributes_to" | "endangers";
  readonly source: string;
  readonly target: string;
  readonly relationType: string;
  readonly stepOrder?: number;
  /** contributes_to: direct / indirect (stroke width). */
  readonly relevance?: string;
  /** endangers: the severity, legacy values normalised (edge label). */
  readonly severity?: string;
}

/** Edges to assets in hidden layers, as a counter at the node (FR-V4). */
export interface AssetGraphStub {
  readonly layer: AssetGroup | string;
  readonly count: number;
}

/** What the context bar reports (FR-V14, UX-6). */
export interface AssetGraphCounts {
  readonly assetsTotal: number;
  readonly assetsVisible: number;
  /** Assets not shown because their layer is hidden. */
  readonly assetsInHiddenLayers: number;
  /** Assets in visible layers but beyond the focus depth. */
  readonly assetsOutsideFocus: number;
  /** A2A edges between visible assets that the type filter hides. */
  readonly edgesHiddenByFilter: number;
  readonly edgesVisible: number;
  readonly anchorsVisible: number;
  /** Hazard Items in the source / drawn (FR-V11c). */
  readonly hazardsTotal: number;
  readonly hazardsVisible: number;
}

export interface AssetGraph {
  readonly nodes: readonly AssetGraphNode[];
  readonly edges: readonly AssetGraphEdge[];
  /** Per visible asset or hazard node id, sorted by layer. */
  readonly stubs: Readonly<Record<string, readonly AssetGraphStub[]>>;
  readonly counts: AssetGraphCounts;
  /** Focus view with an id that is not (or no longer) an asset. */
  readonly focusMissing: boolean;
}
