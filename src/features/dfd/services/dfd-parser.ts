// ==================== DFD PARSER ====================
// Single Responsibility: Parse Draw.io XML to structured DFD data

import {
  DFDElement,
  DFDConnection,
  DFDAsset,
  DFDStats,
  DFDElementType,
} from "../models/dfd-types";

export interface ParseResult {
  elements: DFDElement[];
  connections: DFDConnection[];
  assets: DFDAsset[]; // ← NEW: Separate consolidated asset list
  stats: DFDStats;
  /** Labels of dataflows that are not connected to elements (only have coordinates) */
  unconnectedDataflows: string[];
}

import { dfdAnalyzer } from "../utils/dfd-analyzer";

/**
 * DFDParser - Parses Draw.io XML into structured DFD elements
 * 
 * Single Responsibility: Only handles XML parsing, no storage or validation
 */
export class DFDParser {
  /**
   * Parse Draw.io XML string to structured data
   */
  parse(xml: string): ParseResult {
    const elements: DFDElement[] = [];
    const connections: DFDConnection[] = [];
    const rawAssets: Array<{ id: string; xmlId: string; label: string; position: { x: number; y: number }; size: { width: number; height: number } }> = [];
    const unconnectedDataflows: string[] = [];
    const stats = this.createEmptyStats();
    let assets: DFDAsset[] = [];  // Declare outside try block

    if (!xml || xml.trim() === "") {
      return { elements, connections, assets: [], stats, unconnectedDataflows };
    }

    try {
      const doc = this.parseXmlString(xml);

      // Collect ID labels first (they reference their parent elements)
      const idLabels = this.collectIdLabels(doc);

      // Parse object elements (these contain the type information)
      const objects = doc.getElementsByTagName("object");
      Array.from(objects).forEach((obj) => {
        this.processObject(
          obj,
          elements,
          connections,
          rawAssets,
          unconnectedDataflows,
          stats
        );
      });

      // Also parse direct mxCell elements (for backwards compatibility)
      const cells = doc.getElementsByTagName("mxCell");
      Array.from(cells).forEach((cell) => {
        this.processCell(
          cell,
          elements,
          connections,
          rawAssets,
          unconnectedDataflows,
          stats
        );
      });

      // Assign displayIds from ID labels to connections and elements
      this.assignDisplayIds(connections, elements, idLabels);

      // Consolidate assets: Group by asset name, collect xmlIds/positions/sizes
      assets = this.consolidateAssets(rawAssets);
      stats.assets = assets.length;

      assets.forEach((asset) => {
        const analysis = dfdAnalyzer.findElementsOverlappingAsset(
          asset,
          elements,
          connections
        );

        // linkedElements mit den XML-IDs der überlappenden Elemente füllen
        asset.linkedElements = analysis.overlappingElements.map(el => el.elementId);

        if (!analysis.hasValidPlacement) {
          console.warn(`[DFDParser] Asset ${asset.id} hat keine gültige Platzierung`);
        }
      });


    } catch (error) {
      console.error("DFDParser: Failed to parse XML", error);
    }

    return { elements, connections, assets, stats, unconnectedDataflows };
  }

  /**
   * Extract XML from DrawioMsg JSON format
   */
  extractXmlFromDrawioMsg(drawioMsg: string): string | null {
    try {
      const parsed = JSON.parse(drawioMsg);
      return parsed.xml || null;
    } catch {
      return null;
    }
  }

  // ==================== PRIVATE METHODS ====================

  private parseXmlString(xml: string): Document {
    const parser = new DOMParser();
    return parser.parseFromString(xml, "text/xml");
  }

  private createEmptyStats(): DFDStats {
    return {
      totalElements: 0,
      externalEntities: 0,
      processes: 0,
      multiprocesses: 0,
      dataStores: 0,
      dataFlows: 0,
      trustBoundaries: 0,
      physicalInterfaces: 0,
      assets: 0,
      interfaces: 0,
      describedElements: 0,
      describedAssets: 0,
      describedConnections: 0,
    };
  }

  /**
   * Collect all ID labels from the document
   * ID labels are <object type="idlabel"> elements that are children of other elements
   * They contain the formatted display ID like "DF-1", "P-1", "EE-1", etc.
   */
  private collectIdLabels(doc: Document): Map<string, string> {
    const idLabels = new Map<string, string>();

    const objects = doc.getElementsByTagName("object");
    Array.from(objects).forEach((obj) => {
      const objType = (
        obj.getAttribute("type") ||
        obj.getAttribute("Type") ||
        ""
      ).toLowerCase();

      if (objType === "idlabel") {
        // Get the label text (e.g., "DF-1", "P-1")
        const label = obj.getAttribute("label") || "";
        const cleanedLabel = this.cleanLabel(label);

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
   * Assign display IDs from ID labels to connections and elements
   */
  private assignDisplayIds(
    connections: DFDConnection[],
    elements: DFDElement[],
    idLabels: Map<string, string>
  ): void {
    // Assign to connections
    for (const conn of connections) {
      const displayId = idLabels.get(conn.id);
      if (displayId) {
        conn.displayId = displayId;
      }
    }

    // Assign to elements
    for (const elem of elements) {
      const displayId = idLabels.get(elem.id);
      if (displayId) {
        elem.displayId = displayId;
      }
    }
    console.log(
      "[assignDisplayIds] FINAL elements:",
      elements.map((e) => ({ id: e.id, type: e.type, displayId: e.displayId }))
    );
  }

  /**
   * Extract trust boundary ID from name.
   * Must match the same rule as validateTrustBoundaryIds:
   * /\[([a-zA-Z0-9_-]+)\]\s*$/
   */
  private extractTrustBoundaryId(name: string): string | undefined {
    if (!name) return undefined;

    const match = name.match(/\[([a-zA-Z0-9_-]+)\]\s*$/);
    if (!match) return undefined;

    return match[1]; // exakt die validierte ID
  }

  private extractPoint(
    geometry: Element | undefined,
    as: string
  ): { x: number; y: number } | undefined {
    if (!geometry) return undefined;
    const p = geometry.querySelector(`mxPoint[as="${as}"]`);
    if (!p) return undefined;
    return {
      x: parseFloat(p.getAttribute("x") || "0"),
      y: parseFloat(p.getAttribute("y") || "0"),
    };
  }

  private parseCurved(style: string): boolean | undefined {
    const m = /curved=([01])/.exec(style);
    if (!m) return undefined;
    return m[1] === "1";
  }

  private parseArrow(style: string): {
    start?: string;
    end?: string;
    bidirectional?: boolean;
  } {
    const start = /startArrow=([^;]+)/.exec(style)?.[1];
    const end = /endArrow=([^;]+)/.exec(style)?.[1];
    return {
      start,
      end,
      bidirectional: !!(start && end),
    };
  }

  /**
   * Process <object> elements (new stencil format)
   */
  private processObject(
    obj: Element,
    elements: DFDElement[],
    connections: DFDConnection[],
    rawAssets: Array<{ id: string; xmlId: string; label: string; position: { x: number; y: number }; size: { width: number; height: number } }>,
    unconnectedDataflows: string[],
    stats: DFDStats
  ): void {
    const id = obj.getAttribute("id") || "";
    const label = obj.getAttribute("label") || "";

    // Check both 'type' (lowercase) and 'Type' (uppercase) attributes
    const objType = (
      obj.getAttribute("type") ||
      obj.getAttribute("Type") ||
      ""
    ).toLowerCase();

    // Skip if no type
    if (!objType) return;

    // Skip IdLabel elements
    if (objType === "idlabel") return;

    // Get child mxCell
    const childCells = obj.getElementsByTagName("mxCell");
    if (childCells.length === 0) return;

    const mxCell = childCells[0];
    const parent = mxCell.getAttribute("parent") || "";
    const style = mxCell.getAttribute("style") || "";
    const isEdge = mxCell.getAttribute("edge") === "1";
    const source = mxCell.getAttribute("source");
    const target = mxCell.getAttribute("target");

    // Get geometry early (needed for waypoints extraction)
    const geometry = mxCell.getElementsByTagName("mxGeometry")[0];

    // Skip group containers (they have style="group")
    if (style.includes("group")) return;

    // Handle Dataflows (edges with source and target)
    if (objType === "dataflow" || isEdge) {
      if (source && target) {
        const rawWaypoints = this.extractWaypoints(geometry);
        const waypoints = rawWaypoints.length > 0 ? rawWaypoints : undefined;

        const sourcePoint =
          this.extractPoint(geometry, "sourcePoint") ?? undefined;
        const targetPoint =
          this.extractPoint(geometry, "targetPoint") ?? undefined;
        const offset = this.extractPoint(geometry, "offset") ?? undefined;

        const curved = this.parseCurved(style);
        const arrow = this.parseArrow(style);

        connections.push({
          id,
          from: source,
          to: target,
          label: this.cleanLabel(label),
          displayId: "", // wird später via idLabels gesetzt

          // Visual layout
          waypoints,
          sourcePoint,
          targetPoint,
          offset,
          curved,
          arrow,

          // Semantic / logical properties
          properties: {
            description: "",
            protocol: "",
            encrypted: false,
          },
        });
        stats.dataFlows++;
      } else {
        const flowLabel =
          this.cleanLabel(label) || `Unbenannter Datenfluss (${id})`;
        unconnectedDataflows.push(flowLabel);
        stats.dataFlows++;
      }
      return;
    }

    // Handle regular elements (must have geometry)
    if (!geometry) return;

    const elementType = this.mapTARAflowType(objType);
    if (!elementType) return;

    // Handle Assets separately - check BEFORE creating DFDElement
    if (elementType === "Asset") {
      // Get position - for elements with parent groups, position is relative
      let x = parseFloat(geometry.getAttribute("x") || "0");
      let y = parseFloat(geometry.getAttribute("y") || "0");
      const width = parseFloat(geometry.getAttribute("width") || "100");
      const height = parseFloat(geometry.getAttribute("height") || "100");

      // If element has a parent (group), find parent's position and add it
      if (parent && parent !== "1" && parent !== "0") {
        const parentObj = this.findObjectById(obj.ownerDocument!, parent);
        if (parentObj) {
          const parentCell = parentObj.getElementsByTagName("mxCell")[0];
          if (parentCell) {
            const parentGeom = parentCell.getElementsByTagName("mxGeometry")[0];
            if (parentGeom) {
              const parentX = parseFloat(parentGeom.getAttribute("x") || "0");
              const parentY = parseFloat(parentGeom.getAttribute("y") || "0");
              x += parentX;
              y += parentY;
            }
          }
        }
      }

      rawAssets.push({
        id: this.cleanLabel(label) || "A-xx",
        xmlId: id,
        label: this.cleanLabel(label) || "A-xx",
        position: { x, y },
        size: { width, height },
      });
      // Don't add to elements or update stats here
      return;
    }

    // Get position - for elements with parent groups, position is relative
    // We need to check if parent is a group and add parent's position
    let x = parseFloat(geometry.getAttribute("x") || "0");
    let y = parseFloat(geometry.getAttribute("y") || "0");
    const width = parseFloat(geometry.getAttribute("width") || "100");
    const height = parseFloat(geometry.getAttribute("height") || "100");

    // If element has a parent (group), find parent's position and add it
    if (parent && parent !== "1" && parent !== "0") {
      const parentObj = this.findObjectById(obj.ownerDocument!, parent);
      if (parentObj) {
        const parentCell = parentObj.getElementsByTagName("mxCell")[0];
        if (parentCell) {
          const parentGeom = parentCell.getElementsByTagName("mxGeometry")[0];
          if (parentGeom) {
            const parentX = parseFloat(parentGeom.getAttribute("x") || "0");
            const parentY = parseFloat(parentGeom.getAttribute("y") || "0");
            x += parentX;
            y += parentY;
          }
        }
      }
    }

    const element: DFDElement = {
      id,
      type: elementType as DFDElementType,  // Now safe - Asset already handled
      name: this.cleanLabel(label) || elementType,
      position: { x, y },
      size: { width, height },
      properties: {},
      displayId:
        this.extractTrustBoundaryId(
          this.cleanLabel(label) || elementType || ""
        ) || "",
    };

    // Debug log for Trust Boundaries
    if (elementType === "TrustBoundary") {
      console.log(
        `[DFDParser] TrustBoundary parsed: id=${id}, name="${element.name}", label="${label}", displayId="${element.displayId}"`
      );
    }

    elements.push(element);
    this.updateStats(stats, elementType as DFDElementType);
  }

  /**
   * Find object element by ID
   */
  private findObjectById(doc: Document, id: string): Element | null {
    const objects = doc.getElementsByTagName("object");
    for (let i = 0; i < objects.length; i++) {
      if (objects[i].getAttribute("id") === id) {
        return objects[i];
      }
    }
    return null;
  }

  /**
   * Extract waypoints from geometry (for curved/orthogonal dataflows)
   */
  private extractWaypoints(
    geometry: Element | undefined
  ): Array<{ x: number; y: number }> {
    if (!geometry) return [];

    const waypoints: Array<{ x: number; y: number }> = [];

    const arrays = geometry.getElementsByTagName("Array");
    for (let i = 0; i < arrays.length; i++) {
      if (arrays[i].getAttribute("as") === "points") {
        const points = arrays[i].getElementsByTagName("mxPoint");
        for (let j = 0; j < points.length; j++) {
          waypoints.push({
            x: parseFloat(points[j].getAttribute("x") || "0"),
            y: parseFloat(points[j].getAttribute("y") || "0"),
          });
        }
      }
    }

    return waypoints;
  }

  private processCell(
    cell: Element,
    elements: DFDElement[],
    connections: DFDConnection[],
    rawAssets: Array<{ id: string; xmlId: string; label: string; position: { x: number; y: number }; size: { width: number; height: number } }>,
    unconnectedDataflows: string[],
    stats: DFDStats
  ): void {
    const id = cell.getAttribute("id") || "";
    const value = cell.getAttribute("value") || "";
    const source = cell.getAttribute("source");
    const target = cell.getAttribute("target");

    // Check both 'type' (lowercase) and 'Type' (uppercase) attributes
    const cellType = (
      cell.getAttribute("type") ||
      cell.getAttribute("Type") ||
      ""
    ).toLowerCase();
    const isEdge = cell.getAttribute("edge") === "1";
    const style = cell.getAttribute("style") || "";
    const parent = cell.getAttribute("parent");

    // Skip root cells
    if (this.isRootCell(id)) return;

    // Skip IdLabel elements (they are decorative labels, not DFD elements)
    if (cellType === "idlabel") return;

    // Skip group containers (style contains "group")
    // The actual elements are the children inside the groups
    if (style.includes("group")) return;

    // Skip mxCell elements that are children of <object> elements
    // These are already processed in processObject()
    const parentElement = cell.parentElement;
    if (parentElement && parentElement.tagName.toLowerCase() === "object") {
      return;
    }

    // Skip if this cell has a parent group (not root)
    if (parent && parent !== "0" && parent !== "1") {
      // This is likely a child of a group, skip it
      return;
    }

    // Check if this is a Dataflow (either by type or by edge attribute)
    const isDataflow = cellType === "dataflow" || isEdge;

    if (isDataflow) {
      if (source && target) {
        // Properly connected dataflow
        connections.push(this.createConnection(id, source, target, value, ""));
        stats.dataFlows++;
      } else {
        // Unconnected dataflow - has coordinates but not connected to elements
        const label =
          this.cleanLabel(value) || `Unbenannter Datenfluss (${id})`;
        unconnectedDataflows.push(label);
        stats.dataFlows++; // Still count it in stats
      }
      return;
    }

    // Process element (non-dataflow)
    const geometry = cell.getElementsByTagName("mxGeometry")[0];
    if (geometry) {
      // Check if this is an asset first
      const cellType = (
        cell.getAttribute("type") ||
        cell.getAttribute("Type") ||
        ""
      ).toLowerCase();
      
      if (cellType === "asset") {
        const id = cell.getAttribute("id") || "";
        const value = cell.getAttribute("value") || "";
        const x = parseFloat(geometry.getAttribute("x") || "0");
        const y = parseFloat(geometry.getAttribute("y") || "0");
        const width = parseFloat(geometry.getAttribute("width") || "100");
        const height = parseFloat(geometry.getAttribute("height") || "100");
        
        rawAssets.push({
          id: this.cleanLabel(value) || "A-xx",
          xmlId: id,
          label: this.cleanLabel(value) || "A-xx",
          position: { x, y },
          size: { width, height },
        });
        return;
      }
      
      // Regular element
      const element = this.createElementFromCell(cell, geometry);
      if (element) {
        // Check if not already added via object processing
        const exists = elements.find((e) => e.id === element.id);
        if (!exists) {
          elements.push(element);
          this.updateStats(stats, element.type);
        }
      }
    }
  }

  private isRootCell(id: string): boolean {
    return id === "0" || id === "1";
  }

  private createConnection(
    id: string,
    from: string,
    to: string,
    label: string,
    description: string
  ): DFDConnection {
    return {
      id,
      from,
      to,
      label: this.cleanLabel(label),
      displayId: "",

      properties: {
        description: description || "",
        protocol: "",
        encrypted: false,
      },
    };
  }

  /**
   * Clean HTML from label (DrawIO sometimes wraps text in divs)
   */
  private cleanLabel(label: string): string {
    if (!label) return "";

    // Remove HTML tags and decode entities
    const cleaned = label
      .replace(/<[^>]*>/g, " ") // Replace HTML tags with space
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&nbsp;/g, " ")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ") // Collapse multiple spaces
      .trim();

    return cleaned;
  }

  private createElementFromCell(
    cell: Element,
    geometry: Element
  ): DFDElement | null {
    const id = cell.getAttribute("id") || "";
    const value = cell.getAttribute("value") || "";
    const type = this.determineElementType(cell);

    if (!type) return null;
    
    // Assets should be handled separately, not as regular elements
    if (type === "Asset") return null;

    const x = parseFloat(geometry.getAttribute("x") || "0");
    const y = parseFloat(geometry.getAttribute("y") || "0");
    const width = parseFloat(geometry.getAttribute("width") || "100");
    const height = parseFloat(geometry.getAttribute("height") || "100");

    // For elements without explicit names, use the type as name
    const name = this.cleanLabel(value) || type;

    return {
      id,
      type: type as DFDElementType,  // Safe now - Asset already filtered
      name,
      displayId: name,
      position: { x, y },
      size: { width, height },
      properties: {},
    };
  }

  private determineElementType(cell: Element): DFDElementType | "Asset" | null {
    // TARAflow Library can use either 'type' or 'Type' attribute
    const taraflowType = cell.getAttribute("type") || cell.getAttribute("Type");
    if (taraflowType) {
      return this.mapTARAflowType(taraflowType);
    }

    // Fallback: style-based detection
    const style = cell.getAttribute("style") || "";
    return this.mapStyleToType(style);
  }

  private mapTARAflowType(type: string): DFDElementType | "Asset" | null {
    const typeMap: Record<string, DFDElementType | "Asset"> = {
      // External entities (various names used in different TARAflow versions)
      externalentity: "ExternalEntity",
      interactor: "ExternalEntity",
      actor: "ExternalEntity",
      external: "ExternalEntity",

      // Process
      process: "Process",

      // Multiprocess
      multiprocess: "Multiprocess",
      "multi-process": "Multiprocess",

      // Data Store
      datastore: "DataStore",
      datastorage: "DataStore",
      database: "DataStore",
      storage: "DataStore",

      // Trust Boundary
      trustboundary: "TrustBoundary",
      boundary: "TrustBoundary",

      // Physical Interface & Interface
      physicalinterface: "PhysicalInterface",
      interface: "Interface",

      // Asset - special handling
      asset: "Asset",

      // DataFlow - should be handled as connection, but including for completeness
      dataflow: "DataFlow",
      flow: "DataFlow",
    };
    return typeMap[type.toLowerCase()] || null;
  }

  private mapStyleToType(style: string): DFDElementType | null {
    if (style.includes("ellipse")) return "Process";
    if (style.includes("cylinder") || style.includes("parallelogram"))
      return "DataStore";
    if (style.includes("dashed")) return "TrustBoundary";
    if (style.includes("rectangle")) return "ExternalEntity";
    return null;
  }

  private updateStats(stats: DFDStats, type: DFDElementType): void {
    stats.totalElements++;
    switch (type) {
      case "ExternalEntity":
        stats.externalEntities++;
        break;
      case "Process":
        stats.processes++;
        break;
      case "Multiprocess":
        stats.multiprocesses++;
        break;
      case "DataStore":
        stats.dataStores++;
        break;
      case "TrustBoundary":
        stats.trustBoundaries++;
        break;
      case "PhysicalInterface":
        stats.physicalInterfaces++;
        break;
      case "Interface":
        stats.interfaces++;
        break;
    }
  }

  /**
   * Consolidate raw assets: Group by asset name, collect xmlIds/positions/sizes
   */
  private consolidateAssets(
    rawAssets: Array<{
      id: string;
      xmlId: string;
      label: string;
      position: { x: number; y: number };
      size: { width: number; height: number };
    }>
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
        xmlIds: group.xmlIds,
        positions: group.positions,
        sizes: group.sizes,
        linkedElements: [],
        properties: {},
      });
    });

    return assets;
  }
}

// Export singleton instance
export const dfdParser = new DFDParser();
export default dfdParser;