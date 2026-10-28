// ==================== DFD ANALYZER ====================
// Single Responsibility: Geometric analysis and element relationships in DFD
// Shared utility used by both dfd-validator and asset-service

import type { DFDElement, DFDConnection } from "../models/dfd-types";
import { geometryAnalyzer, type GeometricElement } from "../utils/geometry-analyzer";

/**
 * DFDAnalyzer - Geometric analysis and element relationship detection
 *
 * Provides reusable geometric algorithms for:
 * - Dataflow intersection detection
 * - Interface usage detection
 * 
 * Now uses GeometryAnalyzer for all geometric calculations
 */
export class DFDAnalyzer {
  /**
   * Find all dataflows that pass through an interface
   */
  findDataflowsThroughInterface(
    iface: DFDElement,
    connections: DFDConnection[],
    elements: DFDElement[],
  ): DFDConnection[] {
    return connections.filter((conn) =>
      this.dataflowIntersectsInterface(conn, iface, elements),
    );
  }

  // ==================== GEOMETRIC ALGORITHMS ====================

  /**
   * Check if an asset (rectangle) intersects with a dataflow (line segments)
   * Supports curved/orthogonal dataflows with waypoints
   */
  private assetIntersectsDataflow(
    connection: DFDConnection,
    assetPlacement: GeometricElement,
    allElements: DFDElement[],
  ): boolean {
    const sourceEl = allElements.find((e) => e.id === connection.from);
    const targetEl = allElements.find((e) => e.id === connection.to);

    if (!sourceEl || !targetEl) return false;

    // Get exit and entry points (use center as default)
    const start = this.getElementConnectionPoint(sourceEl, "exit", connection);
    const end = this.getElementConnectionPoint(targetEl, "entry", connection);

    // Use GeometryAnalyzer for line intersection check.
    // Pass curved flag so Case 1 (QB Bézier algorithm) fires correctly.
    return geometryAnalyzer.rectangleIntersectsLine(
      assetPlacement,
      start,
      end,
      connection.waypoints,
      connection.curved,
    );
  }

  /**
   * Check if a dataflow intersects with an interface
   * Same logic as assetIntersectsDataflow but renamed for clarity
   */
  private dataflowIntersectsInterface(
    connection: DFDConnection,
    iface: DFDElement,
    allElements: DFDElement[],
  ): boolean {
    return this.assetIntersectsDataflow(connection, iface, allElements);
  }

  /**
   * Get the connection point on an element (where dataflow exits or enters).
   *
   * draw.io stores sourcePoint/targetPoint as stale internal fallback coordinates
   * that reflect the last manual drag position — they are NOT the actual rendered
   * line endpoints and must NOT be used as lineStart/lineEnd for intersection checks.
   *
   * The authoritative source is the exit/entry anchor (connection.exitX/exitY,
   * entryX/entryY — the parser takes them from the draw.io style). When present
   * they define the point on the element's bounding box where the line
   * starts/ends.
   *
   * Fallback chain:
   *   1. Exit/entry anchor of the connection  (most accurate)
   *   2. Element center                       (safe default when no anchor)
   *
   * Note: sourcePoint/targetPoint are intentionally ignored here.
   */
  private getElementConnectionPoint(
    element: DFDElement,
    type: "exit" | "entry",
    connection: DFDConnection,
  ): { x: number; y: number } {
    const rx = type === "exit" ? connection.exitX : connection.entryX;
    const ry = type === "exit" ? connection.exitY : connection.entryY;
    if (rx !== undefined && ry !== undefined) {
      return {
        x: element.position.x + rx * element.size.width,
        y: element.position.y + ry * element.size.height,
      };
    }

    // Fallback: element center
    return {
      x: element.position.x + element.size.width / 2,
      y: element.position.y + element.size.height / 2,
    };
  }

  /**
   * Check if an element is geometrically inside a Trust Boundary
   */
  isElementInsideBoundary(element: DFDElement, boundary: DFDElement): boolean {
    // Use GeometryAnalyzer's duck-typed method
    return geometryAnalyzer.elementInsideBoundary(element, boundary);
  }
}

// Export singleton instance
export const dfdAnalyzer = new DFDAnalyzer();
export default dfdAnalyzer;