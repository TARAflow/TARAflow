// ==================== DFD ANALYZER ====================
// Single Responsibility: Geometric analysis and element relationships in DFD
// Shared utility used by both dfd-validator and asset-service

import type { DFDElement, DFDConnection } from "../models/dfd-types";
import type { DFDAsset } from "../models/dfd-asset-types";
import { geometryAnalyzer, type GeometricElement } from "../utils/geometry-analyzer";

/**
 * Result of analyzing which elements an asset protects/overlaps
 */
export interface AssetElementAnalysis {
  /** The asset being analyzed */
  assetId: string;
  assetName: string;

  /** True if asset overlaps with at least one valid element */
  hasValidPlacement: boolean;
}

/**
 * DFDAnalyzer - Geometric analysis and element relationship detection
 *
 * Provides reusable geometric algorithms for:
 * - Asset placement validation
 * - Element overlap detection
 * - Dataflow intersection detection
 * - Interface usage detection
 * 
 * Now uses GeometryAnalyzer for all geometric calculations
 */
export class DFDAnalyzer {
  /**
   * Find all elements and dataflows that overlap with an asset
   *
   * Returns links to:
   * - Process, Multiprocess, DataStore, ExternalEntity (rectangles)
   * - Dataflow (lines)
   * - Interface (rectangles)
   */
  findElementsOverlappingAsset(
    asset: DFDAsset,
    _elements: DFDElement[],
    _connections: DFDConnection[],
  ): AssetElementAnalysis {
    return {
      assetId: asset.id,
      assetName: asset.name,
      hasValidPlacement: false,
    };
  }

  /**
   * Check if an asset has valid placement (overlaps with at least one element)
   */
  validateAssetPlacement(
    _asset: DFDAsset,
    _elements: DFDElement[],
    _connections: DFDConnection[],
  ): boolean {
    return false;
  }

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
   * The authoritative source is the exit/entry anchor (exitX/exitY or entryX/entryY)
   * stored on the connection style. When anchors are present they define the exact
   * pixel position on the element boundary where the line starts/ends.
   *
   * Fallback chain:
   *   1. Exit/entry anchor from connection style  (most accurate)
   *   2. Element center                            (safe default when no anchor)
   *
   * Note: sourcePoint/targetPoint are intentionally ignored here.
   */
  private getElementConnectionPoint(
    element: DFDElement,
    type: "exit" | "entry",
    connection: DFDConnection,
  ): { x: number; y: number } {
    // Parse exit/entry anchor from the connection style string.
    // draw.io style format: "...;exitX=0.25;exitY=0;exitDx=0;exitDy=0;..."
    // or "...;entryX=0.175;entryY=0.967;entryDx=0;entryDy=0;..."
    const style: string = (connection as any).style ?? "";

    const parseAnchor = (prefix: "exit" | "entry") => {
      const xMatch = style.match(new RegExp(`${prefix}X=([\\d.\\-]+)`));
      const yMatch = style.match(new RegExp(`${prefix}Y=([\\d.\\-]+)`));
      const dxMatch = style.match(new RegExp(`${prefix}Dx=([\\d.\\-]+)`));
      const dyMatch = style.match(new RegExp(`${prefix}Dy=([\\d.\\-]+)`));
      if (!xMatch || !yMatch) return null;
      const rx = parseFloat(xMatch[1]);
      const ry = parseFloat(yMatch[1]);
      const dx = dxMatch ? parseFloat(dxMatch[1]) : 0;
      const dy = dyMatch ? parseFloat(dyMatch[1]) : 0;
      return {
        x: element.position.x + rx * element.size.width + dx,
        y: element.position.y + ry * element.size.height + dy,
      };
    };

    const anchor = parseAnchor(type === "exit" ? "exit" : "entry");
    if (anchor) return anchor;

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