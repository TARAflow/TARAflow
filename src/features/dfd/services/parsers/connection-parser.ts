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
 * Build a map of parentId → edge label value from draw.io child edgeLabel cells.
 *
 * draw.io sometimes stores DataFlow labels not on the <object label="..."> attribute
 * but as a separate child <mxCell style="edgeLabel;..." parent="<objectId>" value="..."/>.
 * This happens when the label is added via double-click on an existing edge in
 * draw.io Desktop/Web, producing XML that TARAflow would otherwise parse as unnamed.
 *
 * Exclusion rules (no false positives):
 *   - type="idlabel"  → already handled by collectIdLabels() in element-parser
 *   - vertex !== "1"  → not a label cell (safety guard)
 *   - empty value     → nothing to fall back to
 */
function buildEdgeLabelMap(doc: Document): Map<string, string> {
  const map = new Map<string, string>();
  const cells = doc.getElementsByTagName("mxCell");

  Array.from(cells).forEach((cell) => {
    const style = cell.getAttribute("style") || "";
    if (!style.includes("edgeLabel")) return;

    const cellType = cell.getAttribute("type") || "";
    if (cellType === "idlabel") return;

    if (cell.getAttribute("vertex") !== "1") return;

    const parentId = cell.getAttribute("parent");
    if (!parentId) return;

    const value = cell.getAttribute("value") || "";
    if (!value.trim()) return;

    // First match wins — draw.io produces at most one edgeLabel per edge
    if (!map.has(parentId)) {
      map.set(parentId, value);
    }
  });

  return map;
}

/**
 * Parse connection from DrawIO object
 */
export function parseConnectionFromObject(
  obj: Element,
  edgeLabelMap?: Map<string, string>,
): {
  connection: DFDConnection | null;
  unconnected: string | null;
} {
  const id = obj.getAttribute("id") || "";

  // Prefer object.label (TARAflow-native format).
  // Fall back to edgeLabelMap for diagrams created in draw.io Desktop/Web
  // where the label is stored as a child edgeLabel cell instead.
  const rawLabel = obj.getAttribute("label") || "";
  const label = rawLabel || (edgeLabelMap?.get(id) ?? "");

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
      style,
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
 * Extract a numeric style attribute from a draw.io style string.
 * e.g. extractStyleValue("entryX=0.175;entryY=0.967;", "entryX") → 0.175
 */
function extractStyleValue(style: string, key: string): number | undefined {
  const match = style.match(new RegExp(`(?:^|;)${key}=([^;]+)`));
  if (!match) return undefined;
  const val = parseFloat(match[1]);
  return isNaN(val) ? undefined : val;
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
  style: string,
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

  // Extract entryX/entryY/exitX/exitY from draw.io style string.
  // These fractional anchor values are always authoritative for computing the
  // actual connection point on the source/target element — even when stale
  // mxPoint sourcePoint/targetPoint values exist in the XML (draw.io may leave
  // those from a previous layout). The geometry analyzer uses these to compute
  // the correct start/end coordinates for intersection checks.
  const entryX = extractStyleValue(style, "entryX");
  const entryY = extractStyleValue(style, "entryY");
  const exitX = extractStyleValue(style, "exitX");
  const exitY = extractStyleValue(style, "exitY");

  // Store entry/exit fractions as loosely-typed extension fields.
  // These are internal-only: used by dfd-analyzer.getElementConnectionPoint()
  // to compute accurate intersection points without requiring mxPoint coords.
  // Not part of DFDConnection interface — transport only, never persisted.
  if (entryX !== undefined && entryY !== undefined) {
    (connection as any).entryX = entryX;
    (connection as any).entryY = entryY;
  }
  if (exitX !== undefined && exitY !== undefined) {
    (connection as any).exitX = exitX;
    (connection as any).exitY = exitY;
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

  // Build edge-label fallback map once for the whole document.
  // Used by parseConnectionFromObject when object.label is empty.
  const edgeLabelMap = buildEdgeLabelMap(doc);

  // Parse object elements (new stencil format)
  const objects = doc.getElementsByTagName("object");
  Array.from(objects).forEach((obj) => {
    const result = parseConnectionFromObject(obj, edgeLabelMap);

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
    const connectAble = cell.getAttribute("connectable") || null;

    // Skip connection which are not connectAble
    if (connectAble !== "1") {
      return;
    }

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