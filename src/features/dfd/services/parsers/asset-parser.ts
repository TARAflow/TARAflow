// ==================== ASSET PARSER ====================
// Single Responsibility: Parse asset markers and detect relationships with elements

import type { DFDElement, DFDConnection } from "../../models/dfd-types";
import type { DFDAsset, ElementRelation } from "../../models/dfd-asset-types";
import {
  cleanLabel,
  getGeometry,
  getElementType as getXmlElementType,
} from "./xml-parser";

/**
 * Raw asset marker data from XML
 */
interface RawAssetMarker {
  id: string;          // Asset ID (e.g., "A-001")
  xmlId: string;       // XML element ID
  label: string;       // Display label
  position: { x: number; y: number };
  size: { width: number; height: number };
}

/**
 * Parse asset marker from DrawIO object
 */
export function parseAssetFromObject(obj: Element): RawAssetMarker | null {
  const objType = getXmlElementType(obj);
  
  if (objType !== "asset") return null;

  const id = obj.getAttribute("id") || "";
  const label = obj.getAttribute("label") || "";

  // Get child mxCell
  const cells = obj.getElementsByTagName("mxCell");
  if (cells.length === 0) return null;

  const cell = cells[0];
  const geometry = getGeometry(cell);
  if (!geometry) return null;

  return {
    id: cleanLabel(label) || "A-xx",
    xmlId: id,
    label: cleanLabel(label) || "A-xx",
    position: { x: geometry.x, y: geometry.y },
    size: { width: geometry.width, height: geometry.height },
  };
}

/**
 * Parse asset marker from DrawIO mxCell (fallback for old format)
 */
export function parseAssetFromCell(cell: Element): RawAssetMarker | null {
  const cellType = getXmlElementType(cell);
  
  if (cellType !== "asset") return null;

  const id = cell.getAttribute("id") || "";
  const value = cell.getAttribute("value") || "";
  const geometry = getGeometry(cell);
  if (!geometry) return null;

  return {
    id: cleanLabel(value) || "A-xx",
    xmlId: id,
    label: cleanLabel(value) || "A-xx",
    position: { x: geometry.x, y: geometry.y },
    size: { width: geometry.width, height: geometry.height },
  };
}

/**
 * Parse all asset markers from document
 */
export function parseAssetMarkers(doc: Document): RawAssetMarker[] {
  const rawAssets: RawAssetMarker[] = [];

  // Parse object elements (new stencil format)
  const objects = doc.getElementsByTagName("object");
  Array.from(objects).forEach((obj) => {
    const asset = parseAssetFromObject(obj);
    if (asset) {
      rawAssets.push(asset);
    }
  });

  // Parse direct mxCell elements (backwards compatibility)
  const cells = doc.getElementsByTagName("mxCell");
  Array.from(cells).forEach((cell) => {
    const asset = parseAssetFromCell(cell);
    if (asset) {
      rawAssets.push(asset);
    }
  });

  return rawAssets;
}

/**
 * Consolidate raw asset markers: Group by asset ID, collect xmlIds/positions/sizes
 * Multiple markers with same ID are treated as one logical asset
 */
export function consolidateAssets(
  rawAssets: RawAssetMarker[]
): DFDAsset[] {
  // Group by asset id (name)
  const assetMap = new Map<
    string,
    {
      xmlIds: string[];
      positions: Array<{ x: number; y: number }>;
      sizes: Array<{ width: number; height: number }>;
    }
  >();

  rawAssets.forEach((raw) => {
    if (!assetMap.has(raw.id)) {
      assetMap.set(raw.id, {
        xmlIds: [],
        positions: [],
        sizes: [],
      });
    }
    const group = assetMap.get(raw.id)!;
    group.xmlIds.push(raw.xmlId);
    group.positions.push(raw.position);
    group.sizes.push(raw.size);
  });

  // Convert to DFDAsset[]
  const assets: DFDAsset[] = [];
  assetMap.forEach((group, id) => {
    assets.push({
      id,
      displayId: id,
      name: id,
      description: "",
      assetGroup: "data", // default - overridden in description form
      linkedElements: [],
      properties: {},
    });
  });

  return assets;
}

/**
 * Link assets to overlapping elements and connections
 * This creates the initial ElementRelation[] without relationTypes
 * (relationTypes will be defined later in the description forms)
 */
export function linkAssetsToElements(
  assets: DFDAsset[],
  elements: DFDElement[],
  connections: DFDConnection[],
  dfdAnalyzer: any // Import from utils/dfd-analyzer
): void {
  assets.forEach((asset) => {
    const analysis = dfdAnalyzer.findElementsOverlappingAsset(
      asset,
      elements,
      connections
    );

    // Create ElementRelation[] from overlapping elements
    asset.linkedElements = analysis.overlappingElements.map((overlap: any) => {
      // Find the actual element to get its details
      const element = elements.find((e) => e.id === overlap.elementId) ||
                      connections.find((c) => c.id === overlap.elementId);

      const elementType = element 
        ? ('type' in element ? element.type : 'DataFlow')
        : 'Process'; // Fallback

      const elementName = element?.name || "";

      const displayId = element 
        ? ('displayId' in element ? element.displayId : '')
        : '';

      const relation: ElementRelation = {
        elementId: overlap.elementId,
        elementName,
        elementType,
        displayId,
      };

      return relation;
    });

    if (!analysis.hasValidPlacement) {
      console.warn(`[AssetParser] Asset ${asset.id} has no valid placement`);
    }
  });
}

/**
 * Main function: Parse and link all assets
 */
export function parseAssets(
  doc: Document,
  elements: DFDElement[],
  connections: DFDConnection[],
  dfdAnalyzer: any
): DFDAsset[] {
  const rawAssets = parseAssetMarkers(doc);
  const assets = consolidateAssets(rawAssets);
  linkAssetsToElements(assets, elements, connections, dfdAnalyzer);
  return assets;
}