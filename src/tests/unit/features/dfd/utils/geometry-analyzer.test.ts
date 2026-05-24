// src/tests/unit/features/dfd/utils/geometry-analyzer.test.ts
//
// Unit tests for GeometryAnalyzer.rectangleIntersectsLine
//
// Ground truth: draw.io SVG exports of DF-2 with various IF-1 positions.
// The SVG path proves the exact QB curve draw.io renders:
//   M 160.5 341  Q 160.47 171  80.24 171  Q 0 171  0.04 0.01
// (coords offset by end point (419,278))
//
// Which corresponds to paintCurvedLine (mxPolyline.js mxgraph@4.2.2):
//   moveTo(start=(580,620))
//   quadTo(ctrl=WP1=(580,450), end=mid(WP1,WP2)=(499.5,450))
//   quadTo(ctrl=WP2=(419,450), end=(419,278))
//
// CURVE_TOL=2: the QB curve at the left boundary (x=494) passes
// 1.25px outside the rect corner at (544,470). TOL=2 gives clean
// HIT/MISS separation verified across all measured boundary positions.

import { describe, it, expect } from "vitest";
import { geometryAnalyzer } from "features/dfd/utils/geometry-analyzer";

// ==================== HELPERS ====================

function rect(x: number, y: number, w = 50, h = 50) {
  return { position: { x, y }, size: { width: w, height: h } };
}

// DF-2: EE-1→P-1 with two waypoints, curved=1
const DF2 = {
  start: { x: 580, y: 620 },
  end: { x: 419, y: 278 },
  waypoints: [
    { x: 580, y: 450 },
    { x: 419, y: 450 },
  ],
  curved: true,
};

function checkDF2(ifaceRect: ReturnType<typeof rect>): boolean {
  return geometryAnalyzer.rectangleIntersectsLine(
    ifaceRect,
    DF2.start,
    DF2.end,
    DF2.waypoints,
    DF2.curved,
  );
}

// ==================== TESTS ====================

describe("GeometryAnalyzer — rectangleIntersectsLine (curved QB)", () => {
  describe("Left side of DF-2 curve", () => {
    it("x=494 — right edge (544,470) touches curve → HIT", () => {
      // Curve passes 1.25px outside right edge at y=470 — within CURVE_TOL=2
      expect(checkDF2(rect(494, 470))).toBe(true);
    });

    it("x=484 — 10px clear of curve → MISS", () => {
      expect(checkDF2(rect(484, 470))).toBe(false);
    });

    it("x=400 — far left → MISS", () => {
      expect(checkDF2(rect(400, 470))).toBe(false);
    });
  });

  describe("Right side of DF-2 curve", () => {
    it("x=530 — on the curve → HIT", () => {
      expect(checkDF2(rect(530, 470))).toBe(true);
    });

    it("x=569 — left-bottom corner (569,520) on curve → HIT", () => {
      expect(checkDF2(rect(569, 470))).toBe(true);
    });

    it("x=619 — SVG export confirms outside curve → MISS", () => {
      // Curve never exceeds x=580 (start point x-value).
      expect(checkDF2(rect(619, 470))).toBe(false);
    });

    it("x=700 — far right → MISS", () => {
      expect(checkDF2(rect(700, 470))).toBe(false);
    });
  });

  describe("Horizontal mid-segment (y≈450, x=419..499.5)", () => {
    it("IF centered on horizontal segment → HIT", () => {
      expect(checkDF2(rect(440, 425))).toBe(true);
    });

    it("IF right of curve at y=390 → MISS", () => {
      // Final QB segment passes through x≈440 at y≈408.
      // x=550 is clearly to the right of the curve at this height.
      expect(checkDF2(rect(550, 390))).toBe(false);
    });
  });

  describe("End segment (vertical near x=419)", () => {
    it("IF on vertical end segment → HIT", () => {
      expect(checkDF2(rect(394, 340))).toBe(true);
    });

    it("IF right of end segment → MISS", () => {
      expect(checkDF2(rect(470, 340))).toBe(false);
    });
  });

  describe("Vertical extremes", () => {
    it("IF above curve start → MISS", () => {
      expect(checkDF2(rect(530, 200))).toBe(false);
    });

    it("IF below curve end → MISS", () => {
      expect(checkDF2(rect(530, 650))).toBe(false);
    });
  });
});

describe("GeometryAnalyzer — rectangleIntersectsLine (straight, no waypoints)", () => {
  it("Vertical line through rect → HIT", () => {
    expect(
      geometryAnalyzer.rectangleIntersectsLine(
        rect(490, 400),
        { x: 500, y: 300 },
        { x: 500, y: 600 },
      ),
    ).toBe(true);
  });

  it("Vertical line missing rect → MISS", () => {
    expect(
      geometryAnalyzer.rectangleIntersectsLine(
        rect(490, 400),
        { x: 600, y: 300 },
        { x: 600, y: 600 },
      ),
    ).toBe(false);
  });

  it("Near-vertical (dx=12 < ifaceSize=50) passes through rect → HIT", () => {
    expect(
      geometryAnalyzer.rectangleIntersectsLine(
        rect(490, 400),
        { x: 510, y: 620 },
        { x: 498, y: 278 },
      ),
    ).toBe(true);
  });
});

describe("GeometryAnalyzer — elementInsideBoundary", () => {
  it("Center inside boundary → true", () => {
    expect(
      geometryAnalyzer.elementInsideBoundary(
        { position: { x: 615, y: 345 }, size: { width: 10, height: 10 } },
        { position: { x: 610, y: 340 }, size: { width: 37, height: 37 } },
      ),
    ).toBe(true);
  });

  it("Center outside boundary → false", () => {
    expect(
      geometryAnalyzer.elementInsideBoundary(
        { position: { x: 600, y: 530 }, size: { width: 90, height: 41 } },
        { position: { x: 610, y: 340 }, size: { width: 37, height: 37 } },
      ),
    ).toBe(false);
  });
});

describe("SVG regression — false positives", () => {
  // SVG path: M 160.5 341  Q 160.47 171  80.24 171  Q 0 171  0.04 0.01
  // Curve at y=191-241 passes through x=121-152.

  it("rect(161,191) — curve is left of rect → MISS", () => {
    // Curve at x=121-152, rect left=161 → clear gap
    expect(
      geometryAnalyzer.rectangleIntersectsLine(
        rect(161, 191),
        { x: 160.5, y: 341 },
        { x: 0.04, y: 0.01 },
        [
          { x: 160.47, y: 171 },
          { x: 0, y: 171 },
        ],
        true,
      ),
    ).toBe(false);
  });

  it("rect(160,191) — curve still left of rect → MISS", () => {
    // Geometrically verified: curve at y=191-241 is at x=121-152.
    // rect(160,191) left=160, right=210 — no intersection.
    // The test name "tangent" was misleading — this is a clear MISS.
    expect(
      geometryAnalyzer.rectangleIntersectsLine(
        rect(160, 191),
        { x: 160.5, y: 341 },
        { x: 0.04, y: 0.01 },
        [
          { x: 160.47, y: 171 },
          { x: 0, y: 171 },
        ],
        true,
      ),
    ).toBe(false);
  });
});
