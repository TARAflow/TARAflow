// features/dfd/asset-graph/asset-graph-keyboard.ts
//
// Keyboard and mouse operation of the asset graph, pure part: which node an
// arrow key leads to (NFR-4), and which pointer events zoom or pan (FR-V17). The next node is the nearest one in that direction,
// with sideways distance weighted double — so "up" from a node goes to the
// lane above, close to the same x, not to a far node that is slightly higher.

import type { Positions } from "./layout-asset-graph";

export type ArrowDirection = "left" | "right" | "up" | "down";

export function arrowDirection(key: string): ArrowDirection | null {
  switch (key) {
    case "ArrowLeft":
      return "left";
    case "ArrowRight":
      return "right";
    case "ArrowUp":
      return "up";
    case "ArrowDown":
      return "down";
    default:
      return null;
  }
}

const SIDEWAYS_WEIGHT = 2;

/** Nearest of `ids` from `fromId` in `direction`, or null if there is none. */
export function nearestInDirection(
  positions: Positions,
  fromId: string,
  direction: ArrowDirection,
  ids: readonly string[],
): string | null {
  const from = positions.get(fromId);
  if (!from) return null;
  let best: { id: string; score: number } | null = null;
  for (const id of ids) {
    if (id === fromId) continue;
    const p = positions.get(id);
    if (!p) continue;
    const dx = p.x - from.x;
    const dy = p.y - from.y;
    const along = direction === "left" ? -dx : direction === "right" ? dx : direction === "up" ? -dy : dy;
    const sideways = direction === "left" || direction === "right" ? Math.abs(dy) : Math.abs(dx);
    if (along <= 0) continue;
    const score = along + SIDEWAYS_WEIGHT * sideways;
    if (!best || score < best.score || (score === best.score && id < best.id)) best = { id, score };
  }
  return best?.id ?? null;
}

/** Keys that must not act while the user types in a field. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

// ==================== MOUSE: ZOOM / PAN vs. MOVE (FR-V17, G5) ====================

export type PointerLikeEvent = Event & {
  button?: number;
  ctrlKey?: boolean;
  metaKey?: boolean;
  type: string;
};

/**
 * The zoom behaviour's filter, as in draw.io: the wheel zooms; a drag on the
 * empty canvas pans; a drag on a node moves the node (not a pan) unless Ctrl
 * / ⌘ is held — then it pans there too; a drag from a connection handle
 * connects. Only the primary button.
 */
export function allowsZoomOrPan(e: PointerLikeEvent): boolean {
  const target = e.target as Element | null;
  if (target?.closest?.("[data-graph-handle]")) return false;
  if (e.type !== "wheel" && !(e.ctrlKey || e.metaKey) && target?.closest?.("[data-node-id]")) return false;
  return !e.button;
}
