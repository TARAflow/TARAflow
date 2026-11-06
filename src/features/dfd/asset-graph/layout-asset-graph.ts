// features/dfd/asset-graph/layout-asset-graph.ts
//
// Layout of the asset graph (D6, FR-V3, AR-10, AR-12):
//
//   - Vertical layers are horizontal lanes, bottom → top: data, function,
//     system, infrastructure. Orthogonal layers sit in a side column
//     (process, service, physical, human; environment next to human).
//     Element anchors get their own lane below data. Hazard Items get a lane
//     in the side column directly above human (G1).
//   - Every node sits exactly on a row (fixed y). A vertical lane, the anchor
//     lane and the free rows hold three rows each (ROWS_PER_LANE, user
//     2026-11-06): new nodes take the middle one, a node moved up or down
//     snaps onto one of the three. Side-column nodes sit on their lane's row
//     — or, once moved, on any row of the ROW_HEIGHT grid (FR-V17).
//   - A full layout ("Rearrange", first build) spreads a crowded lane over
//     its three rows by the node's links: mostly to the lanes above → top
//     row, mostly below → bottom row, else middle; then balanced, so no row
//     holds more than a third (rounded up). Fewer crossings, a narrower lane.
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

/** Distance between two rows — a node with its name below needs about 100 px. */
export const ROW_HEIGHT = 100;
/** Rows of a vertical lane, the anchor lane and a free row: above, middle, below. */
export const ROWS_PER_LANE = 3;
export const LANE_HEIGHT = ROW_HEIGHT * ROWS_PER_LANE;
/** A full layout spreads a lane over its rows from this many nodes on. */
export const SPREAD_FROM = 7;
export const NODE_SPACING = 150;
export const NODE_RADIUS = 34;
/** Gap between the widest vertical lane and the side column. */
const COLUMN_GAP = 2 * NODE_SPACING;
const TICKS = 300;

export const ANCHOR_LANE = "anchors";
/**
 * Two empty rows above the top lane (FR-V17g): places to move side-column
 * nodes to, e.g. persons above the infrastructure — two, so persons and
 * e.g. services or hazards' protection targets can each get a row of their
 * own. Hold no node of their own.
 */
export const FREE_LANE = "free";
/** The second free row, above FREE_LANE. */
export const FREE_LANE_2 = "free-2";
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
  /** Asset group, ANCHOR_LANE, HAZARD_LANE (a side-column lane), FREE_LANE or FREE_LANE_2. */
  readonly id: string;
  readonly kind: "vertical" | "orthogonal" | "anchors" | "free";
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
  /** Nodes on the fullest row of the vertical / anchor lanes — sets the side column's x. */
  widestRow?: number,
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
    widestRow ?? Math.max(0, ...[...VERTICAL_LAYERS, ANCHOR_LANE].map((l) => counts.get(l) ?? 0)),
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
  // FR-V17g: with a side column, two free rows above everything.
  if ([...slots.values()].some((s) => s.lane.kind === "orthogonal")) {
    const topY = Math.min(...[...slots.values()].map((s) => s.lane.y));
    slots.set(FREE_LANE, { lane: { id: FREE_LANE, kind: "free", y: topY - LANE_HEIGHT } });
    slots.set(FREE_LANE_2, { lane: { id: FREE_LANE_2, kind: "free", y: topY - 2 * LANE_HEIGHT } });
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

/** A lane with three rows (vertical lanes, anchors, free rows); the side column has one per lane. */
const hasRows = (lane: AssetGraphLane) => lane.kind !== "orthogonal";

/** The rows of a lane, top to bottom. */
export function laneRows(lane: AssetGraphLane): number[] {
  if (!hasRows(lane)) return [lane.y];
  const half = Math.floor(ROWS_PER_LANE / 2);
  return Array.from({ length: ROWS_PER_LANE }, (_, i) => lane.y + (i - half) * ROW_HEIGHT);
}

/** The rows a side-column node can sit on: the ROW_HEIGHT grid from the top to the bottom row. */
function snapToRow(y: number, lanes: readonly AssetGraphLane[]): number {
  if (lanes.length === 0) return y;
  const ys = lanes.flatMap(laneRows);
  const row = Math.round(y / ROW_HEIGHT) * ROW_HEIGHT;
  return Math.min(Math.max(row, Math.min(...ys)), Math.max(...ys));
}

/** The row of `lane` nearest to `y` — a node of a lane with rows stays inside its lane. */
function snapToLaneRow(y: number, lane: AssetGraphLane): number {
  return laneRows(lane).reduce((best, r) => (Math.abs(r - y) < Math.abs(best - y) ? r : best));
}

/** Bottom → top position of the lanes with rows that links point between (anchors below data). */
function laneLevel(key: string): number | undefined {
  if (key === ANCHOR_LANE) return -1;
  const i = VERTICAL_LAYERS.indexOf(key as (typeof VERTICAL_LAYERS)[number]);
  return i === -1 ? undefined : i;
}

/**
 * Row offset per node of a crowded lane for a full layout: -1 top, 0 middle,
 * +1 bottom (in rows). By its links — up to a higher lane → top, down → bottom,
 * both or none → middle; then each row holds at most ceil(n / 3), the nodes
 * with the weakest preference move first, towards the middle. Deterministic:
 * ties keep the node order.
 */
function spreadOverRows(
  nodes: readonly AssetGraphNode[],
  edges: AssetGraph["edges"],
): Map<string, number> {
  const keyOf = new Map(nodes.map((n) => [n.id, laneKey(n)]));
  const pull = new Map<string, number>();
  for (const e of edges) {
    const a = laneLevel(keyOf.get(e.source) ?? "");
    const b = laneLevel(keyOf.get(e.target) ?? "");
    if (a === undefined || b === undefined || a === b) continue;
    pull.set(e.source, (pull.get(e.source) ?? 0) + Math.sign(b - a));
    pull.set(e.target, (pull.get(e.target) ?? 0) + Math.sign(a - b));
  }
  const offsets = new Map<string, number>();
  const byLane = new Map<string, AssetGraphNode[]>();
  for (const n of nodes) {
    if (laneLevel(laneKey(n)) === undefined) continue;
    (byLane.get(laneKey(n)) ?? byLane.set(laneKey(n), []).get(laneKey(n))!).push(n);
  }
  for (const members of byLane.values()) {
    if (members.length < SPREAD_FROM) continue;
    const cap = Math.ceil(members.length / ROWS_PER_LANE);
    const rows = new Map<number, AssetGraphNode[]>([[-1, []], [0, []], [1, []]]);
    for (const n of members) {
      const p = pull.get(n.id) ?? 0;
      rows.get(p > 0 ? -1 : p < 0 ? 1 : 0)!.push(n);
    }
    const strength = (n: AssetGraphNode) => Math.abs(pull.get(n.id) ?? 0);
    // Outer rows give their weakest to the middle, then the middle gives to the emptier outer row.
    for (const outer of [-1, 1]) {
      const row = rows.get(outer)!;
      row.sort((a, b) => strength(b) - strength(a) || members.indexOf(a) - members.indexOf(b));
      while (row.length > cap) rows.get(0)!.push(row.pop()!);
    }
    const middle = rows.get(0)!;
    middle.sort((a, b) => members.indexOf(a) - members.indexOf(b));
    while (middle.length > cap) {
      const target = rows.get(-1)!.length <= rows.get(1)!.length ? -1 : 1;
      // The node whose links lean that way, else the last one.
      const lean = (n: AssetGraphNode) => Math.sign(pull.get(n.id) ?? 0) === (target === -1 ? 1 : -1);
      const i = middle.findIndex(lean);
      rows.get(target)!.push(middle.splice(i === -1 ? middle.length - 1 : i, 1)[0]);
    }
    for (const [offset, row] of rows) for (const n of row) offsets.set(n.id, offset);
  }
  return offsets;
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
  // Rows: a full layout spreads crowded lanes; otherwise new nodes take the middle row.
  const spread = previous.size === 0 ? spreadOverRows(graph.nodes, graph.edges) : new Map<string, number>();
  const baseSlots = computeLanes(graph.nodes, options.extraLanes);
  const rowOffset = (n: AssetGraphNode): number => {
    const slot = baseSlots.get(laneKey(n))!;
    const stored = previous.get(n.id);
    if (stored && hasRows(slot.lane) && Math.abs(stored.y - slot.lane.y) <= LANE_HEIGHT / 2) {
      return Math.round((snapToLaneRow(stored.y, slot.lane) - slot.lane.y) / ROW_HEIGHT);
    }
    return spread.get(n.id) ?? 0;
  };
  const rowCounts = new Map<string, number>();
  for (const n of graph.nodes) {
    if (laneLevel(laneKey(n)) === undefined) continue;
    const k = `${laneKey(n)}:${rowOffset(n)}`;
    rowCounts.set(k, (rowCounts.get(k) ?? 0) + 1);
  }
  const slots = computeLanes(graph.nodes, options.extraLanes, Math.max(0, ...rowCounts.values()));
  const lanes = [...slots.values()].map((s) => s.lane);

  // Neighbours (for placing new nodes next to a positioned one).
  const neighbours = new Map<string, string[]>();
  for (const e of graph.edges) {
    (neighbours.get(e.source) ?? neighbours.set(e.source, []).get(e.source)!).push(e.target);
    (neighbours.get(e.target) ?? neighbours.set(e.target, []).get(e.target)!).push(e.source);
  }

  // Start slots per row (vertical lanes) or per lane (side column).
  const indexInRow = new Map<string, number>();
  const seenInRow = new Map<string, number>();
  for (const n of graph.nodes) {
    const k = `${laneKey(n)}:${rowOffset(n)}`;
    const i = seenInRow.get(k) ?? 0;
    indexInRow.set(n.id, i);
    seenInRow.set(k, i + 1);
  }

  const simNodes: SimNode[] = graph.nodes.map((n) => {
    const slot = slots.get(laneKey(n))!;
    const sideColumn = slot.lane.kind === "orthogonal";
    const rowY = slot.lane.y + rowOffset(n) * ROW_HEIGHT;
    const stored = previous.get(n.id);
    const known =
      stored && (sideColumn || Math.abs(stored.y - slot.lane.y) <= LANE_HEIGHT / 2)
        ? stored
        : undefined;
    if (known) {
      // A node of a lane with rows keeps its row inside the lane; a
      // side-column node keeps its row. Older remembered positions snap.
      const y = sideColumn ? snapToRow(known.y, lanes) : rowY;
      return { id: n.id, targetX: slot.targetX, x: known.x, y, fx: known.x, fy: y };
    }
    const placedNeighbour = (neighbours.get(n.id) ?? [])
      .map((id) => previous.get(id))
      .find((p): p is Point => p !== undefined);
    const i = indexInRow.get(n.id)!;
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
      y: rowY,
      fy: rowY,
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
 * stays in its lane: in y it snaps to the nearest of the lane's three rows.
 * A side-column node (orthogonal layers, hazards) moves freely in x and
 * snaps in y to the nearest row of the ROW_HEIGHT grid, from the top to the
 * bottom row (FR-V17d).
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
  const own = options.lanes
    .filter((l) => l.kind === "vertical" || l.kind === "anchors")
    .reduce<AssetGraphLane | undefined>((best, l) => (!best || Math.abs(l.y - p.y) < Math.abs(best.y - p.y) ? l : best), undefined);
  const y = options.sideColumn ? snapToRow(p.y + dy, options.lanes) : own ? snapToLaneRow(p.y + dy, own) : p.y;
  next.set(id, { x: round(p.x + dx), y });
  return next;
}
