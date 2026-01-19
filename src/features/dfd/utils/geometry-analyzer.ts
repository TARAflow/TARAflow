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
    waypoints?: Array<{ x: number; y: number }>
  ): boolean {
    // If we have waypoints, check each segment
    if (waypoints && waypoints.length > 0) {
      const points = [lineStart, ...waypoints, lineEnd];
      for (let i = 0; i < points.length - 1; i++) {
        if (
          this.lineIntersectsRect(
            points[i],
            points[i + 1],
            rect.position,
            rect.size,
            5
          )
        ) {
          return true;
        }
      }
      return false;
    }

    // For straight line or orthogonal curved path
    const pathPoints = this.calculateOrthogonalCurvedPath(lineStart, lineEnd);

    for (let i = 0; i < pathPoints.length - 1; i++) {
      if (
        this.lineIntersectsRect(
          pathPoints[i],
          pathPoints[i + 1],
          rect.position,
          rect.size,
          8
        )
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if an element is geometrically inside a boundary
   * Uses element center point
   */
  elementInsideBoundary(
    element: GeometricElement,
    boundary: GeometricElement
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
   * Calculate the path points for an orthogonal curved edge
   * Returns 5+ points: start, control1, middle, control2, end
   */
  private calculateOrthogonalCurvedPath(
    start: { x: number; y: number },
    end: { x: number; y: number }
  ): { x: number; y: number }[] {
    const dx = end.x - start.x;
    const dy = end.y - start.y;

    // For orthogonal routing, we create a stepped path
    const midX = start.x + dx / 2;

    return [
      start,
      { x: midX, y: start.y }, // Horizontal from start
      { x: midX, y: end.y }, // Vertical
      { x: end.x, y: end.y }, // Horizontal to end
      end,
    ];
  }

  /**
   * Check if a line segment intersects with a rectangle
   */
  private lineIntersectsRect(
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    rectPos: { x: number; y: number },
    rectSize: { width: number; height: number },
    tolerance: number = 5
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
        { width: right - left, height: bottom - top }
      ) || // p1 inside rect
      this.pointInRect(
        p2,
        { x: left, y: top },
        { width: right - left, height: bottom - top }
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
    p4: { x: number; y: number }
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
    rectSize: { width: number; height: number }
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