// ==================== GEOMETRY ANALYZER ====================
// Shared utility for geometric analysis in DFDs
// Feature-independent: Uses duck-typing for position/size objects

/**
 * Minimal interface for geometric elements
 * Any object with these properties can be analyzed
 */
export interface GeometricElement {
  position: { x: number; y: number };
  size: { width: number; height: number };
}

/**
 * Minimal interface for connections/dataflows
 */
export interface GeometricConnection {
  waypoints?: Array<{ x: number; y: number }>;
  sourcePoint?: { x: number; y: number };
  targetPoint?: { x: number; y: number };
  curved?: boolean;
}

/**
 * GeometryAnalyzer - Geometric analysis algorithms
 * 
 * Duck-typed: Works with any objects that have position/size properties
 * No feature dependencies - pure geometric calculations
 */
export class GeometryAnalyzer {
  /**
   * Check if two rectangles overlap (even partially)
   */
  rectanglesOverlap(a: GeometricElement, b: GeometricElement): boolean {
    const aLeft = a.position.x;
    const aRight = a.position.x + a.size.width;
    const aTop = a.position.y;
    const aBottom = a.position.y + a.size.height;

    const bLeft = b.position.x;
    const bRight = b.position.x + b.size.width;
    const bTop = b.position.y;
    const bBottom = b.position.y + b.size.height;

    // Check for overlap (returns true if rectangles touch or overlap)
    return !(
      aRight < bLeft || // A is completely left of B
      aLeft > bRight || // A is completely right of B
      aBottom < bTop || // A is completely above B
      aTop > bBottom // A is completely below B
    );
  }

  /**
   * Check if a rectangle (asset) intersects with a line (dataflow)
   * Supports waypoints for curved/orthogonal paths
   */
  rectangleIntersectsLine(
    rect: GeometricElement,
    lineStart: { x: number; y: number },
    lineEnd: { x: number; y: number },
    waypoints?: Array<{ x: number; y: number }>,
    curved?: boolean,
  ): boolean {
    // Tolerance in pixels for geometric intersection.
    // Case 1 (curved QB): analytic solution, TOL=5 gives ~5px margin matching
    //   draw.io stroke width and verified against measured boundary positions.
    // Cases 2+3 (straight/orthogonal): TOL=5 for placement flexibility.
    const LINE_TOL = 5;
    const CURVE_TOL = 0;
    const EPS = 1e-6;

    // ── Case 1: Waypoints + curved=1 — exact draw.io algorithm ──────────
    //
    // Source: mxPolyline.prototype.paintCurvedLine in mxgraph@4.2.2
    //
    //   moveTo(pts[0])
    //   for i = 1 to n-2:
    //     quadTo(ctrl=pts[i], end=mid(pts[i], pts[i+1]))
    //   quadTo(ctrl=pts[n-2], end=pts[n-1])
    //
    // Intersection uses ANALYTIC quadratic Bézier vs AABB — no sampling.
    // Solves the QB equation per rect edge (4 edges × 2 solutions = up to 8
    // candidates) and checks if t ∈ [0,1] and the other coordinate is in bounds.
    // This avoids all pointInRect / sampling false-positive issues.
    if (waypoints && waypoints.length > 0 && curved) {
      const allPoints = [lineStart, ...waypoints, lineEnd];
      const n = allPoints.length;

      /**
       * Solve quadratic Bézier component = val for t.
       * QB(t) = (1-t)^2*a0 + 2(1-t)t*ac + t^2*a1
       * Rearranged: (a0-2ac+a1)t^2 + (-2a0+2ac)t + (a0-val) = 0
       */
      const solveQB = (
        a0: number,
        ac: number,
        a1: number,
        val: number,
      ): number[] => {
        const A = a0 - 2 * ac + a1;
        const B = -2 * a0 + 2 * ac;
        const C = a0 - val;
        if (Math.abs(A) < 1e-10) {
          if (Math.abs(B) < 1e-10) return [];
          const t = -C / B;
          return t >= 0 && t <= 1 ? [t] : [];
        }
        const disc = B * B - 4 * A * C;
        if (disc < 0) return [];
        const sq = Math.sqrt(disc);
        // return [(-B - sq) / (2 * A), (-B + sq) / (2 * A)].filter(
        //   (t) => t >= 0 && t <= 1,
        // );
        return [(-B - sq) / (2 * A), (-B + sq) / (2 * A)]
          .filter((t) => t >= -EPS && t <= 1 + EPS)
          .map((t) => Math.max(0, Math.min(1, t)));
      };

      const qbAt = (
        p0: { x: number; y: number },
        ctrl: { x: number; y: number },
        p2: { x: number; y: number },
        t: number,
      ) => {
        const mt = 1 - t;
        return {
          x: mt * mt * p0.x + 2 * mt * t * ctrl.x + t * t * p2.x,
          y: mt * mt * p0.y + 2 * mt * t * ctrl.y + t * t * p2.y,
        };
      };

      const qbHitsRect = (
        p0: { x: number; y: number },
        ctrl: { x: number; y: number },
        p2: { x: number; y: number },
      ): boolean => {
        const left = rect.position.x - CURVE_TOL;
        const right = rect.position.x + rect.size.width + CURVE_TOL;
        const top = rect.position.y - CURVE_TOL;
        const bottom = rect.position.y + rect.size.height + CURVE_TOL;
        const EPS = 1e-6;

        // Solve for x-edges (left, right), check y in bounds
        for (const xe of [left, right]) {
          for (const t of solveQB(p0.x, ctrl.x, p2.x, xe)) {
            const pt = qbAt(p0, ctrl, p2, t);

            // MUST validate full point, not just 1 axis
            if (pt.y >= top - EPS && pt.y <= bottom + EPS) {
              return true;
            }
          }
        }
        // Solve for y-edges (top, bottom), check x in bounds
        for (const ye of [top, bottom]) {
          for (const t of solveQB(p0.y, ctrl.y, p2.y, ye)) {
            const pt = qbAt(p0, ctrl, p2, t);

            if (pt.x >= left - EPS && pt.x <= right + EPS) {
              return true;
            }
          }
        }
        return false;
      };

      // Walk the path following paintCurvedLine (mxPolyline.js)
      // Loop: i = 1 to n-3 (i < n-2), then one final QB to pts[n-1]
      let curPos = allPoints[0];

      for (let i = 1; i < n - 2; i++) {
        const ctrl = allPoints[i];
        const p1 = allPoints[i + 1];
        const endPt = { x: (ctrl.x + p1.x) / 2, y: (ctrl.y + p1.y) / 2 };
        if (qbHitsRect(curPos, ctrl, endPt)) return true;
        curPos = endPt;
      }

      // Final QB: curPos → pts[n-1] with pts[n-2] as control
      if (qbHitsRect(curPos, allPoints[n - 2], allPoints[n - 1])) return true;

      return false;
    }

    // ── Case 2: Waypoints without curve — straight segments only ──────────
    if (waypoints && waypoints.length > 0) {
      const points = [lineStart, ...waypoints, lineEnd];
      for (let i = 0; i < points.length - 1; i++) {
        if (
          this.lineIntersectsRect(
            points[i],
            points[i + 1],
            rect.position,
            rect.size,
            LINE_TOL,
          )
        ) {
          return true;
        }
      }
      return false;
    }

    // ── Case 3: No waypoints ──────────────────────────────────────────────
    const dx = Math.abs(lineEnd.x - lineStart.x);
    const dy = Math.abs(lineEnd.y - lineStart.y);
    const ifaceSize = Math.max(rect.size.width, rect.size.height);

    // Near-straight: deviation <= interface symbol size → direct line check
    const isNearStraight =
      (dy > dx && dx <= ifaceSize) || (dx > dy && dy <= ifaceSize);

    if (isNearStraight) {
      return this.lineIntersectsRect(
        lineStart,
        lineEnd,
        rect.position,
        rect.size,
        LINE_TOL,
      );
    }

    // Diagonal: check both V-H and H-V orthogonal patterns
    if (
      this.lineIntersectsRect(
        lineStart,
        { x: lineStart.x, y: lineEnd.y },
        rect.position,
        rect.size,
        LINE_TOL,
      ) ||
      this.lineIntersectsRect(
        { x: lineStart.x, y: lineEnd.y },
        lineEnd,
        rect.position,
        rect.size,
        LINE_TOL,
      )
    ) {
      return true;
    }

    if (
      this.lineIntersectsRect(
        lineStart,
        { x: lineEnd.x, y: lineStart.y },
        rect.position,
        rect.size,
        LINE_TOL,
      ) ||
      this.lineIntersectsRect(
        { x: lineEnd.x, y: lineStart.y },
        lineEnd,
        rect.position,
        rect.size,
        LINE_TOL,
      )
    ) {
      return true;
    }

    return false;
  }

  /**
   * Check if an element is geometrically inside a boundary
   * Uses element center point
   */
  elementInsideBoundary(
    element: GeometricElement,
    boundary: GeometricElement,
  ): boolean {
    const ex = element.position.x;
    const ey = element.position.y;
    const ew = element.size.width;
    const eh = element.size.height;

    const bx = boundary.position.x;
    const by = boundary.position.y;
    const bw = boundary.size.width;
    const bh = boundary.size.height;

    // Element center must be inside boundary
    const elementCenterX = ex + ew / 2;
    const elementCenterY = ey + eh / 2;

    return (
      elementCenterX >= bx &&
      elementCenterX <= bx + bw &&
      elementCenterY >= by &&
      elementCenterY <= by + bh
    );
  }

  // ==================== PRIVATE HELPERS ====================

  /**
   * Calculate both possible orthogonal paths between two points.
   *
   * draw.io orthogonal edges can route in two ways depending on the
   * exit/entry anchor positions:
   *
   *   Pattern V-H (vertical first):
   *     start → (start.x, end.y) → end
   *     Used when exit is top/bottom (exitY=0 or exitY=1)
   *
   *   Pattern H-V (horizontal first):
   *     start → (end.x, start.y) → end
   *     Used when exit is left/right (exitX=0 or exitX=1)
   *
   * Since we do not have the exact routing algorithm, we generate BOTH
   * paths and check intersection against either — whichever matches the
   * actual draw.io layout will correctly detect the interface crossing.
   */
  private calculateOrthogonalCurvedPath(
    start: { x: number; y: number },
    end: { x: number; y: number },
  ): { x: number; y: number }[] {
    // Pattern V-H: vertical from start, then horizontal to end
    // e.g. exitY=0 (top) or exitY=1 (bottom)
    const vhPath = [start, { x: start.x, y: end.y }, end];

    // Pattern H-V: horizontal from start, then vertical to end
    // e.g. exitX=0 (left) or exitX=1 (right)
    const hvPath = [start, { x: end.x, y: start.y }, end];

    // Return all segments from both patterns so rectangleIntersectsLine
    // checks all possible routing paths
    return [...vhPath, ...hvPath];
  }

  /**
   * Check if a line segment intersects with a rectangle
   */
  private lineIntersectsRect(
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    rectPos: { x: number; y: number },
    rectSize: { width: number; height: number },
    tolerance: number = 5,
  ): boolean {
    const left = rectPos.x - tolerance;
    const right = rectPos.x + rectSize.width + tolerance;
    const top = rectPos.y - tolerance;
    const bottom = rectPos.y + rectSize.height + tolerance;

    // Rectangle corners
    const topLeft = { x: left, y: top };
    const topRight = { x: right, y: top };
    const bottomLeft = { x: left, y: bottom };
    const bottomRight = { x: right, y: bottom };

    // Check if line intersects any edge of the rectangle
    return (
      this.lineSegmentsIntersect(p1, p2, topLeft, topRight) || // Top edge
      this.lineSegmentsIntersect(p1, p2, topRight, bottomRight) || // Right edge
      this.lineSegmentsIntersect(p1, p2, bottomLeft, bottomRight) || // Bottom edge
      this.lineSegmentsIntersect(p1, p2, topLeft, bottomLeft) || // Left edge
      this.pointInRect(
        p1,
        { x: left, y: top },
        { width: right - left, height: bottom - top },
      ) || // p1 inside rect
      this.pointInRect(
        p2,
        { x: left, y: top },
        { width: right - left, height: bottom - top },
      ) // p2 inside rect
    );
  }

  /**
   * Check if two line segments intersect
   * Uses parametric line intersection algorithm
   */
  private lineSegmentsIntersect(
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    p3: { x: number; y: number },
    p4: { x: number; y: number },
  ): boolean {
    const denominator =
      (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);

    // Lines are parallel
    if (denominator === 0) return false;

    const ua =
      ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) /
      denominator;
    const ub =
      ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) /
      denominator;

    // Check if intersection point is on both line segments
    return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
  }

  /**
   * Check if a point is inside a rectangle
   */
  private pointInRect(
    point: { x: number; y: number },
    rectPos: { x: number; y: number },
    rectSize: { width: number; height: number },
  ): boolean {
    return (
      point.x >= rectPos.x &&
      point.x <= rectPos.x + rectSize.width &&
      point.y >= rectPos.y &&
      point.y <= rectPos.y + rectSize.height
    );
  }
}

// Export singleton instance
export const geometryAnalyzer = new GeometryAnalyzer();
export default geometryAnalyzer;