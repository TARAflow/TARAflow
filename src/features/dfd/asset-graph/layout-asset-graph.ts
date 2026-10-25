// features/dfd/asset-graph/layout-asset-graph.ts
//
// Layout of the asset graph (D6, FR-V3, AR-10, AR-12):
//
//   - Vertical layers are horizontal lanes, bottom → top: data, function,
//     system, infrastructure. Orthogonal layers sit in a side column
//     (process, service, physical, human; environment next to human).
//     Element anchors get their own lane below data. Hazard Items get a lane
//     in the side column directly above human (G1).
//   - Every node sits exactly on a row (fixed y): the nodes of a vertical
//     lane all at the lane's height, side-column nodes on their row — or, once
//     moved, on the row they were moved to (FR-V17, rows = lane heights).
//     d3-force only spreads them horizontally: a pull to the node's slot
//     (vertical lanes) or to the column (side column), weak link forces,
//     collision. Run synchronously to rest.
//   - Deterministic: initial positions come from the (sorted) node order and
//     d3-force's own random source is a fixed-seed LCG — same input, same
//     picture (AR-10).
//   - Stable (AR-12): nodes with a known position are fixed (fx/fy). Only new
//     nodes move; they start next to a positioned neighbour. A full re-layout
//     happens only when the caller passes no previous positions ("Rearrange",
//     FR-V12). Positions of hidden nodes are kept by the caller and passed
//     back later.
//   - A known position only counts while it still lies in the node's lane
//     (vertical layers and anchors): after a group change, or a position
//     remembered from an earlier session (FR-V15), the node is placed anew.

import {
  forceCollide,
  forceLink,
  forceSimulation,
  forceX,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3";
import type { AssetGraph, AssetGraphNode } from "./asset-graph-types";
import { ORTHOGONAL_LAYERS, VERTICAL_LAYERS } from "./asset-graph-layers";

export interface Point {
  readonly x: number;
  readonly y: number;
}

export type Positions = ReadonlyMap<string, Point>;

export const LANE_HEIGHT = 140;
export const NODE_SPACING = 150;
export const NODE_RADIUS = 34;
/** Gap between the widest vertical lane and the side column. */
const COLUMN_GAP = 2 * NODE_SPACING;
const TICKS = 300;

export const ANCHOR_LANE = "anchors";
/** Lane of the Hazard Items (FR-V11, G1) — side column, above human. */
export const HAZARD_LANE = "hazards";

/** Side column rows, top → bottom; environment shares the human row. */
const COLUMN_LANES: readonly string[] = [
  ...ORTHOGONAL_LAYERS.filter((l) => l !== "human" && l !== "environment"),
  HAZARD_LANE,
  "human",
  "environment",
];

export interface AssetGraphLane {
  /** Asset group, ANCHOR_LANE or HAZARD_LANE (a side-column lane). */
  readonly id: string;
  readonly kind: "vertical" | "orthogonal" | "anchors";
  /** Lane centre. */
  readonly y: number;
  /** Column centre (orthogonal lanes only). */
  readonly x?: number;
}

export interface AssetGraphLayout {
  readonly positions: Positions;
  readonly lanes: readonly AssetGraphLane[];
}

interface LaneSlot {
  readonly lane: AssetGraphLane;
  /** Horizontal anchor point for the pull (column lanes). */
  readonly targetX?: number;
}

function laneKey(node: AssetGraphNode): string {
  if (node.kind === "anchor") return ANCHOR_LANE;
  if (node.kind === "hazard") return HAZARD_LANE;
  return String(node.group);
}

/**
 * Lane geometry for a node set: lanes that hold nodes, plus `extraLanes`
 * (edit mode: every visible layer gets a lane to create assets in).
 */
function computeLanes(
  nodes: readonly AssetGraphNode[],
  extraLanes: readonly string[] = [],
): Map<string, LaneSlot> {
  const counts = new Map<string, number>();
  for (const n of nodes) counts.set(laneKey(n), (counts.get(laneKey(n)) ?? 0) + 1);
  const present = new Set<string>([...counts.keys(), ...extraLanes]);

  const top = VERTICAL_LAYERS.length - 1;
  const slots = new Map<string, LaneSlot>();
  VERTICAL_LAYERS.forEach((layer, i) => {
    if (!present.has(layer)) return;
    slots.set(layer, {
      lane: { id: layer, kind: "vertical", y: (top - i) * LANE_HEIGHT },
    });
  });
  if (present.has(ANCHOR_LANE)) {
    slots.set(ANCHOR_LANE, {
      lane: { id: ANCHOR_LANE, kind: "anchors", y: (top + 1) * LANE_HEIGHT },
    });
  }

  const widest = Math.max(
    1,
    ...[...VERTICAL_LAYERS, ANCHOR_LANE].map((l) => counts.get(l) ?? 0),
  );
  const columnX = (widest - 1) * NODE_SPACING + COLUMN_GAP;
  // Side column rows; environment shares the human row, one step further out.
  let row = 0;
  for (const layer of COLUMN_LANES) {
    if (!present.has(layer)) continue;
    if (layer === "environment" && present.has("human")) {
      const human = slots.get("human")!;
      const x = columnX + Math.max(1, counts.get("human") ?? 1) * NODE_SPACING;
      slots.set(layer, {
        lane: { id: layer, kind: "orthogonal", y: human.lane.y, x },
        targetX: x,
      });
      continue;
    }
    const lane: AssetGraphLane = {
      id: layer,
      kind: "orthogonal",
      y: row * LANE_HEIGHT,
      x: columnX,
    };
    slots.set(layer, { lane, targetX: columnX });
    row += 1;
  }
  return slots;
}

interface SimNode extends SimulationNodeDatum {
  id: string;
  /** Column centre (side column) — a strong pull. */
  targetX?: number;
  /** Start slot in a vertical lane — a mild pull, so lanes stay spread. */
  slotX?: number;
}

/** The rows a side-column node can sit on: lane heights, top to bottom lane. */
function snapToRow(y: number, lanes: readonly AssetGraphLane[]): number {
  if (lanes.length === 0) return y;
  const ys = lanes.map((l) => l.y);
  const row = Math.round(y / LANE_HEIGHT) * LANE_HEIGHT;
  return Math.min(Math.max(row, Math.min(...ys)), Math.max(...ys));
}

/**
 * Positions for all nodes of `graph`. Nodes found in `previous` keep their
 * position exactly; the others are placed and settled around them.
 */
export function layoutAssetGraph(
  graph: Pick<AssetGraph, "nodes" | "edges">,
  previous: Positions = new Map(),
  options: { readonly extraLanes?: readonly string[] } = {},
): AssetGraphLayout {
  const slots = computeLanes(graph.nodes, options.extraLanes);
  const lanes = [...slots.values()].map((s) => s.lane);

  // Neighbours (for placing new nodes next to a positioned one).
  const neighbours = new Map<string, string[]>();
  for (const e of graph.edges) {
    (neighbours.get(e.source) ?? neighbours.set(e.source, []).get(e.source)!).push(e.target);
    (neighbours.get(e.target) ?? neighbours.set(e.target, []).get(e.target)!).push(e.source);
  }

  const indexInLane = new Map<string, number>();
  const seenInLane = new Map<string, number>();
  for (const n of graph.nodes) {
    const k = laneKey(n);
    const i = seenInLane.get(k) ?? 0;
    indexInLane.set(n.id, i);
    seenInLane.set(k, i + 1);
  }

  const simNodes: SimNode[] = graph.nodes.map((n) => {
    const slot = slots.get(laneKey(n))!;
    const laneY = slot.lane.y;
    const sideColumn = slot.lane.kind === "orthogonal";
    const stored = previous.get(n.id);
    const known =
      stored && (sideColumn || Math.abs(stored.y - laneY) <= LANE_HEIGHT / 2)
        ? stored
        : undefined;
    if (known) {
      // A vertical lane's nodes share its height; a side-column node keeps
      // its row. Older remembered positions snap back onto it.
      const y = sideColumn ? snapToRow(known.y, lanes) : laneY;
      return { id: n.id, targetX: slot.targetX, x: known.x, y, fx: known.x, fy: y };
    }
    const placedNeighbour = (neighbours.get(n.id) ?? [])
      .map((id) => previous.get(id))
      .find((p): p is Point => p !== undefined);
    const i = indexInLane.get(n.id)!;
    const x = placedNeighbour
      ? placedNeighbour.x + NODE_SPACING / 2
      : slot.targetX !== undefined
        ? slot.targetX + (i % 2) * (NODE_SPACING / 2)
        : i * NODE_SPACING;
    return {
      id: n.id,
      targetX: slot.targetX,
      slotX: slot.targetX === undefined ? x : undefined,
      x,
      y: laneY,
      fy: laneY,
    };
  });

  const movable = simNodes.some((n) => n.fx === undefined);
  if (movable) {
    const ids = new Set(simNodes.map((n) => n.id));
    const links: SimulationLinkDatum<SimNode>[] = graph.edges
      .filter((e) => ids.has(e.source) && ids.has(e.target))
      .map((e) => ({ source: e.source, target: e.target }));

    const sim = forceSimulation<SimNode>(simNodes)
      .force(
        "column",
        forceX<SimNode>((n) => n.targetX ?? n.slotX ?? (n.x as number)).strength((n) =>
          n.targetX !== undefined ? 0.6 : n.slotX !== undefined ? 0.2 : 0,
        ),
      )
      .force(
        "link",
        forceLink<SimNode, SimulationLinkDatum<SimNode>>(links)
          .id((n) => n.id)
          .distance(NODE_SPACING)
          .strength(0.05),
      )
      .force("collide", forceCollide<SimNode>(NODE_RADIUS + 12))
      .stop();
    for (let i = 0; i < TICKS; i++) sim.tick();
  }

  const positions = new Map<string, Point>();
  for (const n of simNodes) {
    positions.set(n.id, { x: round(n.x ?? 0), y: round(n.y ?? 0) });
  }
  return { positions, lanes };
}

/** Whole pixels: stable output, no float noise between runs. */
function round(v: number): number {
  return Math.round(v);
}

// ==================== MOVING A NODE (FR-V17) ====================

/**
 * The positions after moving `id` by (`dx`, `dy`) graph units; every other
 * node stays where it is (FR-V17). A node of a vertical lane (or an anchor)
 * moves along its lane only: y stays the lane's height. A side-column node
 * (orthogonal layers, hazards) moves freely in x and snaps in y to the
 * nearest row — the lane heights from the top to the bottom lane (FR-V17d).
 * The result is a known position for the next layout (AR-12).
 */
export function moveNode(
  positions: Positions,
  id: string,
  dx: number,
  dy: number,
  options: { readonly sideColumn: boolean; readonly lanes: readonly AssetGraphLane[] },
): Map<string, Point> {
  const next = new Map(positions);
  const p = positions.get(id);
  if (!p) return next;
  const y = options.sideColumn ? snapToRow(p.y + dy, options.lanes) : p.y;
  next.set(id, { x: round(p.x + dx), y });
  return next;
}
