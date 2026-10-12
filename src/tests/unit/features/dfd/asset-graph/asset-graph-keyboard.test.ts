// NFR-4: arrow keys lead to the nearest node in that direction.

import { describe, expect, it } from "vitest";
import { arrowDirection, nearestInDirection } from "features/dfd/asset-graph/asset-graph-keyboard";

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
