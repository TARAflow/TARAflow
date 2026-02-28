// ==================== CONNECTION PARSER ====================
// Single Responsibility: Parse DFD connections (dataflows) from DrawIO XML

import type { DFDConnection } from "../../models/dfd-types";
import {
  cleanLabel,
  getGeometry,
  getElementType as getXmlElementType,
  extractPoint,
  parseCurved,
  parseArrow,
  getWaypoints,
} from "./xml-parser";

/**
 * Assign display IDs from ID labels to connections
 */
export function assignDisplayIds(
  connections: DFDConnection[],
  idLabels: Map<string, string>
): void {
  for (const conn of connections) {
    const displayId = idLabels.get(conn.id);
    if (displayId) {
      conn.displayId = displayId;
    }
  }
}

/**
 * Parse connection from DrawIO object
 */
export function parseConnectionFromObject(obj: Element): {
  connection: DFDConnection | null;
  unconnected: string | null;
} {
  const id = obj.getAttribute("id") || "";
  const label = obj.getAttribute("label") || "";
  const objType = getXmlElementType(obj);

  // Check if this is a dataflow
  if (objType !== "dataflow") {
    return { connection: null, unconnected: null };
  }

  // Get child mxCell
  const cells = obj.getElementsByTagName("mxCell");
  if (cells.length === 0) {
    return { connection: null, unconnected: null };
  }

  const cell = cells[0];
  const source = cell.getAttribute("source");
  const target = cell.getAttribute("target");
  const style = cell.getAttribute("style") || "";
  const geometry = cell.getElementsByTagName("mxGeometry")[0];

  if (source && target) {
    // Properly connected dataflow
    const connection = createConnection(
      id,
      source,
      target,
      label,
      geometry,
      style
    );
    return { connection, unconnected: null };
  } else {
    // Unconnected dataflow
    const unconnectedLabel = cleanLabel(label) || `Unnamed dataflow (${id})`;
    return { connection: null, unconnected: unconnectedLabel };
  }
}

/**
 * Parse connection from DrawIO mxCell (fallback for old format)
 */
export function parseConnectionFromCell(cell: Element): {
  connection: DFDConnection | null;
  unconnected: string | null;
} {
  const id = cell.getAttribute("id") || "";

  // Skip root cells and cells without ID
  if (!id || id === "0" || id === "1") {
    return { connection: null, unconnected: null };
  }

  // Skip mxCells that are children of <object> elements (already parsed)
  const parent = cell.parentElement;
  if (parent && parent.tagName.toLowerCase() === "object") {
    return { connection: null, unconnected: null };
  }

  const value = cell.getAttribute("value") || "";
  const source = cell.getAttribute("source");
  const target = cell.getAttribute("target");
  const isEdge = cell.getAttribute("edge") === "1";
  const style = cell.getAttribute("style") || "";

  // Check if this is a dataflow
  const cellType = getXmlElementType(cell);
  const isDataflow = cellType === "dataflow" || isEdge;

  if (!isDataflow) {
    return { connection: null, unconnected: null };
  }

  const geometry = cell.getElementsByTagName("mxGeometry")[0];

  if (source && target) {
    // Properly connected dataflow
    const connection = createConnection(
      id,
      source,
      target,
      value,
      geometry,
      style,
    );
    return { connection, unconnected: null };
  } else if (geometry) {
    // Unconnected dataflow - has coordinates but not connected to elements
    const unconnectedLabel = cleanLabel(value) || `Unnamed dataflow (${id})`;
    return { connection: null, unconnected: unconnectedLabel };
  }

  return { connection: null, unconnected: null };
}

/**
 * Create connection object from parsed data
 */
function createConnection(
  id: string,
  from: string,
  to: string,
  label: string,
  geometry: Element | undefined,
  style: string
): DFDConnection {
  const connection: DFDConnection = {
    id,
    from,
    to,
    name: cleanLabel(label),
    displayId: "",
    properties: {},
  };

  // Parse visual layout
  if (geometry) {
    connection.waypoints = getWaypoints(geometry);
    connection.sourcePoint = extractPoint(geometry, "sourcePoint");
    connection.targetPoint = extractPoint(geometry, "targetPoint");
    connection.offset = extractPoint(geometry, "offset");
  }

  // Parse style properties
  const curved = parseCurved(style);
  if (curved !== undefined) {
    connection.curved = curved;
  }

  const arrow = parseArrow(style);
  if (arrow.start || arrow.end) {
    connection.arrow = arrow;
  }

  return connection;
}

/**
 * Parse all connections from document
 */
export function parseConnections(doc: Document): {
  connections: DFDConnection[];
  unconnectedDataflows: string[];
} {
  const connections: DFDConnection[] = [];
  const unconnectedDataflows: string[] = [];
  const seenIds = new Set<string>();

  // Parse object elements (new stencil format)
  const objects = doc.getElementsByTagName("object");
  Array.from(objects).forEach((obj) => {
    const result = parseConnectionFromObject(obj);
    
    if (result.connection && !seenIds.has(result.connection.id)) {
      connections.push(result.connection);
      seenIds.add(result.connection.id);
    }
    
    if (result.unconnected) {
      unconnectedDataflows.push(result.unconnected);
    }
  });

  // Parse direct mxCell elements (backwards compatibility)
  const cells = doc.getElementsByTagName("mxCell");
  const validCells = filterValidConnectionCells(cells);
  validCells.forEach((cell) => {
    const result = parseConnectionFromCell(cell);

    if (result.connection && !seenIds.has(result.connection.id)) {
      connections.push(result.connection);
      seenIds.add(result.connection.id);
    }

    if (result.unconnected) {
      unconnectedDataflows.push(result.unconnected);
    }
  });

  return { connections, unconnectedDataflows };
}

/**
 * Pre-filter for mxCell elements to avoid duplicates
 * Filters out mxCells that are already part of <object> elements
 */
function filterValidConnectionCells(cells: HTMLCollectionOf<Element>): Element[] {
  const validCells: Element[] = [];
  
  Array.from(cells).forEach((cell) => {
    const id = cell.getAttribute("id") || null;
    const edge = cell.getAttribute("edge") || null;

    // Skip cells without ID or with root IDs
    if (!id || id === "0" || id === "1") {
      return;
    }

    // Skip non-edge cells (we only want dataflows here)
    if (edge !== "1") {
      return;
    }

    // Skip mxCells that are children of <object> elements (already parsed)
    const parent = cell.parentElement;
    if (parent && parent.tagName.toLowerCase() === "object") {
      console.info(`Skipping mxCell ${id} - already parsed as part of object`);
      return;
    }

    validCells.push(cell);
  });

  return validCells;
}