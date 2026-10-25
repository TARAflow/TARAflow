// NFR-4: arrow keys lead to the nearest node in that direction.

import { describe, expect, it } from "vitest";
import {
  allowsZoomOrPan,
  arrowDirection,
  nearestInDirection,
} from "features/dfd/asset-graph/asset-graph-keyboard";

const positions = new Map([
  ["a", { x: 0, y: 280 }], // data lane
  ["b", { x: 150, y: 280 }],
  ["c", { x: 0, y: 140 }], // function lane, straight above a
  ["d", { x: 600, y: 120 }], // a bit higher, far away
  ["e", { x: 160, y: 0 }],
]);
const ids = [...positions.keys()];

describe("asset graph keyboard", () => {
  it("maps the arrow keys", () => {
    expect(arrowDirection("ArrowUp")).toBe("up");
    expect(arrowDirection("ArrowLeft")).toBe("left");
    expect(arrowDirection("Enter")).toBeNull();
  });

  it("goes to the nearest node in the direction, sideways distance counting double", () => {
    expect(nearestInDirection(positions, "a", "up", ids)).toBe("c");
    expect(nearestInDirection(positions, "a", "right", ids)).toBe("b");
    expect(nearestInDirection(positions, "b", "left", ids)).toBe("a");
    expect(nearestInDirection(positions, "c", "up", ids)).toBe("e");
    expect(nearestInDirection(positions, "c", "down", ids)).toBe("a");
  });

  it("returns null at the edge or for an unknown node", () => {
    expect(nearestInDirection(positions, "a", "down", ids)).toBeNull();
    expect(nearestInDirection(positions, "zz", "up", ids)).toBeNull();
  });
});

describe("allowsZoomOrPan (FR-V17, G5: as in draw.io)", () => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const node = document.createElementNS("http://www.w3.org/2000/svg", "g");
  node.setAttribute("data-node-id", "d1");
  const inner = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  node.appendChild(inner);
  const handle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  handle.setAttribute("data-graph-handle", "");
  node.appendChild(handle);
  svg.appendChild(node);
  const ev = (type: string, target: Element, init: { button?: number; ctrlKey?: boolean; metaKey?: boolean } = {}) =>
    ({ type, target, button: 0, ...init }) as never;

  it("empty canvas: a drag pans", () => {
    expect(allowsZoomOrPan(ev("mousedown", svg))).toBe(true);
  });
  it("on a node: a drag moves it — no pan; with Ctrl or ⌘ it pans", () => {
    expect(allowsZoomOrPan(ev("mousedown", inner))).toBe(false);
    expect(allowsZoomOrPan(ev("mousedown", inner, { ctrlKey: true }))).toBe(true);
    expect(allowsZoomOrPan(ev("mousedown", inner, { metaKey: true }))).toBe(true);
  });
  it("the wheel zooms everywhere; a handle never pans; only the primary button", () => {
    expect(allowsZoomOrPan(ev("wheel", inner))).toBe(true);
    expect(allowsZoomOrPan(ev("mousedown", handle, { ctrlKey: true }))).toBe(false);
    expect(allowsZoomOrPan(ev("mousedown", svg, { button: 2 }))).toBe(false);
  });
});
