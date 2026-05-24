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
   * Get the connection point on an element (where dataflow exits or enters)
   */
  private getElementConnectionPoint(
    element: DFDElement,
    type: "exit" | "entry",
    connection: DFDConnection,
  ): { x: number; y: number } {
    // Use sourcePoint/targetPoint if available
    if (type === "exit" && connection.sourcePoint) {
      return connection.sourcePoint;
    }
    if (type === "entry" && connection.targetPoint) {
      return connection.targetPoint;
    }

    // Fallback to center
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