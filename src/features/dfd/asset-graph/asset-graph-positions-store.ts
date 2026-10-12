// features/dfd/asset-graph/asset-graph-positions-store.ts
//
// FR-V15: node positions remembered locally per project, so the graph looks
// the same when the project is opened again. Never in the project file (D3):
// positions are view state, and every move would show up in the audit diff.
//
// Browser storage can be missing, full or blocked — every access is guarded,
// and without stored positions the deterministic layout applies (AR-10).
// Positions that no longer fit their lane are dropped by the layout itself.

import type { Point } from "./layout-asset-graph";

const PREFIX = "taraflow:assetGraphPositions:";
const VERSION = 1;

export function positionsStorageKey(projectId: string): string {
  return `${PREFIX}${projectId}`;
}

interface Stored {
  readonly v: number;
  /** id → [x, y] */
  readonly p: Record<string, [number, number]>;
}

/** Pure: stored text → positions; anything malformed yields none. */
export function parsePositions(raw: string | null): Map<string, Point> {
  const out = new Map<string, Point>();
  if (!raw) return out;
  try {
    const data = JSON.parse(raw) as Partial<Stored>;
    if (data?.v !== VERSION || !data.p || typeof data.p !== "object") return out;
    for (const [id, xy] of Object.entries(data.p)) {
      if (Array.isArray(xy) && xy.length === 2 && xy.every((n) => typeof n === "number" && Number.isFinite(n))) {
        out.set(id, { x: xy[0], y: xy[1] });
      }
    }
  } catch {
    // Not ours or broken: start from the layout.
  }
  return out;
}

/** Pure: positions → stored text, only for ids that still exist. */
export function serializePositions(
  positions: ReadonlyMap<string, Point>,
  keep: (id: string) => boolean,
): string {
  const p: Record<string, [number, number]> = {};
  for (const [id, pt] of positions) if (keep(id)) p[id] = [Math.round(pt.x), Math.round(pt.y)];
  return JSON.stringify({ v: VERSION, p } satisfies Stored);
}

export function loadPositions(projectId: string | null | undefined): Map<string, Point> {
  if (!projectId) return new Map();
  try {
    return parsePositions(window.localStorage.getItem(positionsStorageKey(projectId)));
  } catch {
    return new Map();
  }
}

export function savePositions(
  projectId: string | null | undefined,
  positions: ReadonlyMap<string, Point>,
  keep: (id: string) => boolean,
): void {
  if (!projectId) return;
  try {
    window.localStorage.setItem(positionsStorageKey(projectId), serializePositions(positions, keep));
  } catch {
    // Quota or blocked storage: positions stay for this session only (AR-12).
  }
}
