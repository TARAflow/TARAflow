// src/tests/unit/features/dfd/asset-graph/asset-graph-stadium.test.ts
//
// 0.20 manual test (2026-11-26, user): a prefixed display id such as
// "C:SDC1:P1" did not fit into the round node. A node is now a stadium (the
// process symbol: round ends, top and bottom parallel) as wide as its id
// needs; short ids keep the circle. Edges end at the border of that shape.
import { describe, expect, it } from "vitest";
import { NODE_RADIUS, borderDistance, nodeHalfWidth } from "features/dfd/asset-graph/layout-asset-graph";

describe("stadium node width", () => {
  it("a short id keeps the circle; a long one widens the node", () => {
    expect(nodeHalfWidth("DA-001")).toBe(NODE_RADIUS);
    expect(nodeHalfWidth(undefined)).toBe(NODE_RADIUS);
    expect(nodeHalfWidth("C:SDC1:P1")).toBeGreaterThan(NODE_RADIUS);
    expect(nodeHalfWidth("C:SDC1:SDC2:P1")).toBeGreaterThan(nodeHalfWidth("C:SDC1:P1"));
  });
});

describe("border distance from the centre", () => {
  const hw = 80;
  it("a circle: the radius in every direction", () => {
    for (const [x, y] of [[1, 0], [0, 1], [1, 1], [-3, 2]]) expect(borderDistance(x, y, NODE_RADIUS)).toBeCloseTo(NODE_RADIUS);
  });
  it("a stadium: the half width sideways, the radius up and down", () => {
    expect(borderDistance(1, 0, hw)).toBeCloseTo(hw);
    expect(borderDistance(-1, 0, hw)).toBeCloseTo(hw);
    expect(borderDistance(0, 1, hw)).toBeCloseTo(NODE_RADIUS);
  });
  it("the flat part and the round end", () => {
    // through the flat top: y = radius
    const flat = borderDistance(1, 1, hw);
    expect(flat).toBeCloseTo(NODE_RADIUS * Math.SQRT2);
    // a shallow angle meets the round end: the point lies on its circle
    const d = borderDistance(4, 1, hw);
    const l = Math.hypot(4, 1);
    const [px, py] = [(4 / l) * d, (1 / l) * d];
    expect(Math.hypot(px - (hw - NODE_RADIUS), py)).toBeCloseTo(NODE_RADIUS);
  });
});
