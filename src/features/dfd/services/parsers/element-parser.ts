// ==================== ELEMENT PARSER ====================
// Single Responsibility: Parse DFD elements from DrawIO XML

import type { DFDElement, DFDElementType } from "../../models/dfd-types";
import {
  cleanLabel,
  getGeometry,
  getElementType as getXmlElementType,
} from "./xml-parser";
import {
  determineElementType,
  extractTrustBoundaryId,
} from "./parser-utils";

/**
 * Collect all ID labels from the document
 * ID labels are <object type="idlabel"> elements that contain formatted display IDs
 */
export function collectIdLabels(doc: Document): Map<string, string> {
  const idLabels = new Map<string, string>();

  const objects = doc.getElementsByTagName("object");
  Array.from(objects).forEach((obj) => {
    const objType = getXmlElementType(obj);

    if (objType === "idlabel") {
      const label = obj.getAttribute("label") || "";
      const cleanedLabel = cleanLabel(label);

      // Find the parent element ID from the child mxCell
      const childCells = obj.getElementsByTagName("mxCell");
      if (childCells.length > 0) {
        const mxCell = childCells[0];
        const parentId = mxCell.getAttribute("parent");

        if (parentId && parentId !== "0" && parentId !== "1") {
          idLabels.set(parentId, cleanedLabel);
        }
      }
    }
  });

  return idLabels;
}

/**
 * Assign display IDs from ID labels to elements
 */
export function assignDisplayIds(
  elements: DFDElement[],
  idLabels: Map<string, string>
): void {
  for (const elem of elements) {
    const displayId = idLabels.get(elem.id);
    if (displayId) {
      elem.displayId = displayId;
    }
  }
}

/**
 * Parse element from DrawIO object
 */
export function parseElementFromObject(obj: Element): DFDElement | null {
  const id = obj.getAttribute("id") || "";
  const label = obj.getAttribute("label") || "";
  const objType = getXmlElementType(obj);

  // Skip if no type or is idlabel or asset
  if (!objType || objType === "idlabel" || objType === "asset") return null;

  // Get child mxCell
  const cells = obj.getElementsByTagName("mxCell");
  if (cells.length === 0) return null;

  const cell = cells[0];
  
  // Skip edges (connections)
  if (cell.getAttribute("edge") === "1") return null;

  const geometry = getGeometry(cell);
  if (!geometry) return null;

  const type = determineElementType(obj);
  if (!type || type === "Asset") return null;

  const name = cleanLabel(label) || type;

  const element: DFDElement = {
    id,
    type: type as DFDElementType,
    name,
    displayId: name,
    position: { x: geometry.x, y: geometry.y },
    size: { width: geometry.width, height: geometry.height },
    properties: {},
  };

  // Extract Trust Boundary ID if applicable
  if (type === "TrustBoundary") {
    const tbId = extractTrustBoundaryId(name);
    if (tbId) {
      element.properties = {
        ...element.properties,
        boundaryId: tbId,
      };
    }
  }

  return element;
}

/**
 * Parse element from DrawIO mxCell (fallback for old format)
 */
export function parseElementFromCell(cell: Element): DFDElement | null {
  const id = cell.getAttribute("id") || "";
  
  // Skip root cells
  if (id === "0" || id === "1") return null;
  
  // Skip edges
  if (cell.getAttribute("edge") === "1") return null;

  const value = cell.getAttribute("value") || "";
  const geometry = getGeometry(cell);
  if (!geometry) return null;

  const type = determineElementType(cell);
  if (!type || type === "Asset") return null;

  const name = cleanLabel(value) || type;

  const element: DFDElement = {
    id,
    type: type as DFDElementType,
    name,
    displayId: name,
    position: { x: geometry.x, y: geometry.y },
    size: { width: geometry.width, height: geometry.height },
    properties: {},
  };

  // Extract Trust Boundary ID if applicable
  if (type === "TrustBoundary") {
    const tbId = extractTrustBoundaryId(name);
    if (tbId) {
      element.properties = {
        ...element.properties,
        boundaryId: tbId,
      };
    }
  }

  return element;
}

/**
 * Parse all elements from document
 */
export function parseElements(doc: Document): DFDElement[] {
  const elements: DFDElement[] = [];
  const seenIds = new Set<string>();

  // Parse object elements (new stencil format)
  const objects = doc.getElementsByTagName("object");
  Array.from(objects).forEach((obj) => {
    const element = parseElementFromObject(obj);
    if (element && !seenIds.has(element.id)) {
      elements.push(element);
      seenIds.add(element.id);
    }
  });

  // Parse direct mxCell elements (backwards compatibility)
  const cells = doc.getElementsByTagName("mxCell");
  Array.from(cells).forEach((cell) => {
    const element = parseElementFromCell(cell);
    if (element && !seenIds.has(element.id)) {
      elements.push(element);
      seenIds.add(element.id);
    }
  });

  return elements;
}