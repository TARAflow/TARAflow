// ==================== DFD ANALYZER ====================
// Single Responsibility: Geometric analysis and element relationships in DFD
// Shared utility used by both dfd-validator and asset-service

import type { DFDElement, DFDConnection, DFDAsset } from "../models/dfd-types";
import type { DFDElementLink } from "../../assets/models/asset-types";
import { geometryAnalyzer, type GeometricElement } from "../utils/geometry-analyzer";

/**
 * Result of analyzing which elements an asset protects/overlaps
 */
export interface AssetElementAnalysis {
  /** The asset being analyzed */
  assetId: string;
  assetName: string;

  /** Elements that overlap with the asset */
  overlappingElements: DFDElementLink[];

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
    elements: DFDElement[],
    connections: DFDConnection[]
  ): AssetElementAnalysis {
    const overlappingElements: DFDElementLink[] = [];

    // Valid target element types for asset placement
    const validTargetTypes = [
      "Process",
      "Multiprocess",
      "DataStore",
      "ExternalEntity",
      "Interface",
    ];

    // Check each asset placement (xmlId) against all elements
    asset.xmlIds.forEach((xmlId, index) => {
      const assetPlacement: GeometricElement = {
        position: asset.positions[index],
        size: asset.sizes[index],
      };

      // Check overlap with elements (rectangles)
      elements.forEach((element) => {
        if (!validTargetTypes.includes(element.type)) return;
        if (element.id === asset.id) return; // Skip the asset itself

        // Check if this placement overlaps with the element
        if (geometryAnalyzer.rectanglesOverlap(assetPlacement, element)) {
          // Check if not already added
          const exists = overlappingElements.find(
            (link) => link.elementId === element.id
          );
          if (!exists) {
            overlappingElements.push({
              elementId: element.id,
              elementName: element.name,
              elementType: element.type,
              displayId: element.displayId,
            });
          }
        }
      });

      // Check overlap with dataflows (lines)
      connections.forEach((conn) => {
        if (this.assetIntersectsDataflow(conn, assetPlacement, elements)) {
          // Check if not already added
          const exists = overlappingElements.find(
            (link) => link.elementId === conn.id
          );
          if (!exists) {
            overlappingElements.push({
              elementId: conn.id,
              elementName: conn.label || `DataFlow ${conn.id}`,
              elementType: "DataFlow",
              displayId: conn.displayId,
            });
          }
        }
      });
    });

    return {
      assetId: asset.id,
      assetName: asset.id, // Asset ID is the name
      overlappingElements,
      hasValidPlacement: overlappingElements.length > 0,
    };
  }

  /**
   * Check if an asset has valid placement (overlaps with at least one element)
   */
  validateAssetPlacement(
    asset: DFDAsset,
    elements: DFDElement[],
    connections: DFDConnection[]
  ): boolean {
    const analysis = this.findElementsOverlappingAsset(
      asset,
      elements,
      connections
    );
    return analysis.hasValidPlacement;
  }

  /**
   * Find all dataflows that pass through an interface
   */
  findDataflowsThroughInterface(
    iface: DFDElement,
    connections: DFDConnection[],
    elements: DFDElement[]
  ): DFDConnection[] {
    return connections.filter((conn) =>
      this.dataflowIntersectsInterface(conn, iface, elements)
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
    allElements: DFDElement[]
  ): boolean {
    const sourceEl = allElements.find((e) => e.id === connection.from);
    const targetEl = allElements.find((e) => e.id === connection.to);

    if (!sourceEl || !targetEl) return false;

    // Get exit and entry points (use center as default)
    const start = this.getElementConnectionPoint(sourceEl, "exit", connection);
    const end = this.getElementConnectionPoint(targetEl, "entry", connection);

    // Use GeometryAnalyzer for line intersection check
    return geometryAnalyzer.rectangleIntersectsLine(
      assetPlacement,
      start,
      end,
      connection.waypoints
    );
  }

  /**
   * Check if a dataflow intersects with an interface
   * Same logic as assetIntersectsDataflow but renamed for clarity
   */
  private dataflowIntersectsInterface(
    connection: DFDConnection,
    iface: DFDElement,
    allElements: DFDElement[]
  ): boolean {
    return this.assetIntersectsDataflow(connection, iface, allElements);
  }

  /**
   * Get the connection point on an element (where dataflow exits or enters)
   */
  private getElementConnectionPoint(
    element: DFDElement,
    type: "exit" | "entry",
    connection: DFDConnection
  ): { x: number; y: number } {
    // Default to center of element
    return {
      x: element.position.x + element.size.width / 2,
      y: element.position.y + element.size.height / 2,
    };
  }

  /**
   * Check if an element is geometrically inside a Trust Boundary
   */
  isElementInsideBoundary(
    element: DFDElement,
    boundary: DFDElement
  ): boolean {
    // Use GeometryAnalyzer's duck-typed method
    return geometryAnalyzer.elementInsideBoundary(element, boundary);
  }
}

// Export singleton instance
export const dfdAnalyzer = new DFDAnalyzer();
export default dfdAnalyzer;