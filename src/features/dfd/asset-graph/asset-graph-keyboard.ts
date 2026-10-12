// features/dfd/asset-graph/asset-graph-keyboard.ts
//
// Keyboard operation of the asset graph (NFR-4), pure part: which node an
// arrow key leads to. The next node is the nearest one in that direction,
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
