// ==================== ELEMENT PARSER ====================
// Single Responsibility: Parse DFD elements from DrawIO XML

import type { DFDElement, DFDElementType } from "../../models/dfd-types";
import type {
  ChipBoundaryProperties,
  TrustBoundaryProperties,
} from "../../models/element-properties";
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
 * Collect positions of all group elements
 * Groups have style="group" and contain position but no actual element
 */
function collectGroupPositions(doc: Document): Map<string, { x: number; y: number }> {
  const groupPositions = new Map<string, { x: number; y: number }>();

  const objects = doc.getElementsByTagName("object");
  Array.from(objects).forEach((obj) => {
    const id = obj.getAttribute("id");
    if (!id) return;

    const cell = obj.querySelector("mxCell");
    if (!cell) return;

    const style = cell.getAttribute("style") || "";
    if (style.includes("group")) {
      const geometry = getGeometry(cell);
      if (geometry) {
        groupPositions.set(id, { x: geometry.x, y: geometry.y });
        // console.log(`Collected group position: ID=${id}, x=${geometry.x}, y=${geometry.y}`);
      }
    }
  });

  return groupPositions;
}

/**
 * Collect IDs of groups that contain a legend object (type="legend").
 * All mxCell children of these groups are decorative and must be skipped.
 */
function collectLegendGroupIds(doc: Document): Set<string> {
  const legendGroupIds = new Set<string>();
  const objects = doc.getElementsByTagName("object");
  Array.from(objects).forEach((obj) => {
    if (obj.getAttribute("type") !== "legend") return;
    const cell = obj.querySelector("mxCell");
    const parentId = cell?.getAttribute("parent");
    if (parentId && parentId !== "0" && parentId !== "1") {
      legendGroupIds.add(parentId);
    }
  });
  return legendGroupIds;
}

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
export function parseElementFromObject(
  obj: Element,
  groupPositions?: Map<string, { x: number; y: number }>,
  legendGroupIds?: Set<string>,
): DFDElement | null {
  const id = obj.getAttribute("id") || "";
  const label = obj.getAttribute("label") || "";
  const objType = getXmlElementType(obj);

  if (!id) {
    return null;
  }

  if (!label || label.trim() === "") {
    console.warn(`Skipping object without valid Label. ID: ${id}`);
    return null;
  }

  if (!objType) {
    console.warn(
      `Skipping object without valid Type. ID: ${id}, Label: ${label}`,
    );
    return null;
  }

  const objCell = obj.querySelector("mxCell");
  const objParentId = objCell?.getAttribute("parent");
  if (objParentId && legendGroupIds?.has(objParentId)) return null;

  const style = objCell?.getAttribute("style") || "";
  if (style.includes("group")) {
    console.info(`Skipping group element with ID: ${id}`);
    return null;
  }

  // Skip if no type or is idlabel or asset
  if (!objType || objType === "idlabel" || objType === "asset") return null;

  if (objType === "trustboundary") {
    const cleanLabel = label.trim();
    const validLabelRegex = /\[.*\]/;
    if (!cleanLabel || !validLabelRegex.test(cleanLabel)) {
      return null;
    }
  }

  if (objType === "chipboundary") {
    const cleanLabel = label.trim();
    const validLabelRegex = /\[.*\]/;
    if (!cleanLabel || !validLabelRegex.test(cleanLabel)) {
      return null;
    }
  }

  // Get child mxCell
  const cells = obj.getElementsByTagName("mxCell");
  if (cells.length === 0) {
    console.warn(`Object has no mxCell: ID=${id}`);
    return null;
  }

  // Skip edges (connections)
  const cell = cells[0];
  if (cell.getAttribute("edge") === "1") {
    return null;
  }

  const geometry = getGeometry(cell);
  if (!geometry) {
    console.warn(`Skipping object with missing geometry. ID=${id}`);
    return null;
  }

  // Check if element is child of a group and use parent position
  const parentId = cell.getAttribute("parent");
  let position = { x: geometry.x, y: geometry.y };

  if (parentId && groupPositions?.has(parentId)) {
    const parentPos = groupPositions.get(parentId)!;
    position = { x: parentPos.x, y: parentPos.y };
    // console.log(
    //   `Using parent group position: ID=${id}, parent=${parentId}, x=${position.x}, y=${position.y}`,
    // );
  }

  const type = determineElementType(obj);
  if (!type || type === "Asset") return null;

  const name = cleanLabel(label) || type;
  // console.log(` - Computed Name: ${name}`);

  const element: DFDElement = {
    id,
    type: type as DFDElementType,
    name,
    displayId: name,
    position: position,
    size: { width: geometry.width, height: geometry.height },
    properties: {},
  };

  // Extract Trust Boundary ID if applicable
  if (type === "TrustBoundary") {
    const tbId = extractTrustBoundaryId(name);
    if (tbId) {
      element.displayId = tbId;
      element.properties = {
        ...element.properties,
        boundaryId: tbId,
      } as TrustBoundaryProperties;
    }
  }

  if (type === "ChipBoundary") {
    const chipId = extractTrustBoundaryId(name); // Same regex, reuse helper
    if (chipId) {
      element.displayId = chipId;
      element.properties = {
        ...element.properties,
        // No boundaryId needed — chipType is the classifier
      } as ChipBoundaryProperties;
    }
  }

  return element;
}

/**
 * Parse element from DrawIO mxCell (fallback for old format)
 */
export function parseElementFromCell(cell: Element): DFDElement | null {
  const id = cell.getAttribute("id") || null;
  const value = cell.getAttribute("value") || null;
  const parent = cell.getAttribute("parent") || null;

  // console.log("parseElementFromCellParsing mxCell:");
  // console.log(`parseElementFromCell - ID: ${id}`);
  // console.log(`parseElementFromCell - Value: ${value}`);
  // console.log(`parseElementFromCell - Parent: ${parent}`);

  // Skip root cells
  if (!id || id === "0" || id === "1") {
    console.warn(`Skipping invalid or root mxCell. ID: ${id}`);
    return null;
  }

  if (!value) {
    console.warn(`Skipping mxCell with missing Value. ID: ${id}`);
    return null;
  }

  // Skip edges
  if (cell.getAttribute("edge") === "1") return null;

  const geometry = getGeometry(cell);
  if (!geometry) {
    console.warn(`Skipping mxCell with ID: ${id} due to missing geometry`);
    return null;
  }

  const type = determineElementType(cell); // Typ festlegen
  if (!type || type === "Asset") {
    console.warn(`No valid type found for mxCell with ID: ${id}`);
    return null;
  }

  const name = cleanLabel(value) || type;
  // console.log(` - Computed Name: ${name}`);

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
      } as TrustBoundaryProperties;
    }
  }

  if (type === "ChipBoundary") {
    const chipId = extractTrustBoundaryId(name); // Same regex, reuse helper
    if (chipId) {
      element.displayId = chipId;
      element.properties = {
        ...element.properties,
        // No boundaryId needed — chipType is the classifier
      } as ChipBoundaryProperties;
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

  // STEP 1: Collect group positions (id -> position)
  const groupPositions = collectGroupPositions(doc);

  // Collect legend group IDs — child cells are decorative, not DFD elements
  const legendGroupIds = collectLegendGroupIds(doc);

  // STEP 2: Parse object elements (new stencil format)
  const objects = doc.getElementsByTagName("object");

  Array.from(objects).forEach((obj, index) => {
    const id = obj.getAttribute("id");
    const label = obj.getAttribute("label");
    const type = obj.getAttribute("type");
    // console.log(`[FOUND ${index}] ID: ${id}, Label: ${label}, Type: ${type}`);
  });

  Array.from(objects).forEach((obj) => {
    const element = parseElementFromObject(obj, groupPositions, legendGroupIds);
    // console.log("parseElementFromObject Id: ", element);
    if (element && !seenIds.has(element.id)) {
      elements.push(element);
      seenIds.add(element.id);
    }
  });

  console.debug("parseElements 1: ", elements);

  // Parse direct mxCell elements (backwards compatibility)
  const cells = doc.getElementsByTagName("mxCell");
  const validCells = filterValidCells(cells); // Nur relevante mxCell verarbeiten
  validCells.forEach((cell) => {
    // Skip cells whose parent is a legend group
    const cellParentId = cell.getAttribute("parent");
    if (cellParentId && legendGroupIds.has(cellParentId)) return;

    const element = parseElementFromCell(cell);
    if (element && !seenIds.has(element.id)) {
      elements.push(element);
      seenIds.add(element.id);
    }
  });
  // Array.from(cells).forEach((cell) => {
  //   const element = parseElementFromCell(cell);
  //   console.log(
  //     "parseElementFromCell Id: " + element?.id + " Name: " + element?.name,
  //   );
  //   if (element && !seenIds.has(element.id)) {
  //     elements.push(element);
  //     seenIds.add(element.id);
  //   }
  // });
  console.debug("parseElements 2: ", elements);
  return elements;
}

/**
 * Pre-Filter für mxCell-Elemente
 */
function filterValidCells(cells: HTMLCollectionOf<Element>): Element[] {
  const validCells: Element[] = [];
  Array.from(cells).forEach((cell) => {
    const id = cell.getAttribute("id") || null;
    const value = cell.getAttribute("value") || null;
    const edge = cell.getAttribute("edge") || null;

    // Zellen ohne ID oder mit Root-IDs überspringen
    if (!id || id === "0" || id === "1") {
      console.warn(`Skipping root mxCell. ID: ${id}`);
      return;
    }

    // Zellen mit `edge` können separat behandelt werden (falls notwendig)
    if (edge === "1") {
      console.info(`Skipping edge mxCell. ID: ${id}, Value: ${value}`);
      return;
    }

    // Fehlt der Wert? Überspringen, außer speziell markierte
    if (!value) {
      console.warn(`Skipping mxCell due to missing Value. ID: ${id}`);
      return;
    }

    validCells.push(cell);
  });

  return validCells;
}
