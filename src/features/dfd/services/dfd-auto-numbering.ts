// ==================== DFD AUTO NUMBERING SERVICE ====================
// Single Responsibility: Auto-number IdLabels from top-left to bottom-right
//
// Leveled DFDs (leveled-dfd-multi-diagram-design.md §8, D19): hierarchical
// numbers. The root page numbers 1..n per prefix; the child page of the
// multiprocess MP-m numbers its own definitions m.1..m.n per prefix (P-1.3,
// DS-1.1, DF-1.2, a nested MP-1.2 and below it P-1.2.1). Pages are numbered
// in tree order, so a multiprocess has its number before its child page;
// each page is sorted with the configured position strategy on its own
// geometry. Only definitions take a number; context copies show the number
// of their definition, so a flow of the top page keeps its top number on
// the child pages. A logical element with copies but no definition
// (dangling), and the definitions on a page the tree cannot place, take
// numbers of the root page after its own definitions. A single page has no
// links, so every cell is a definition and the result is exactly the
// classic positional numbering.

import { inspectDrawioPages, describeUnsupportedPageLayout } from "shared";
import type { DFDPage } from "../models/dfd-types";
import {
  collectCellIdentities,
  identityOf,
  type CellIdentity,
} from "./parsers/identity-reader";
import { dfdParser } from "./dfd-parser";
import { buildPageTree, computeHomePages } from "./leveled";

/**
 * Configuration for element type prefixes
 * NOTE: Assets are excluded - they are references, not unique elements
 *       Multiple A-001 labels can reference the same asset
 */
export const ELEMENT_PREFIXES: Record<string, string> = {
  process: "P-",
  multiprocess: "MP-",
  dataflow: "DF-",
  datastorage: "DS-",
  datastore: "DS-",
  externalentity: "EE-",
  // asset: excluded - Assets are references, multiple can have same ID
  interface: "IF-",
  sensor: "SE-",
  actuator: "AC-",
};

/**
 * Element with position information for sorting
 */
interface ElementWithPosition {
  /** Page-local cell id. */
  id: string;
  type: string;
  /** Flows and elements are separate logical namespaces of tfIds. */
  isEdge: boolean;
  x: number;
  y: number;
  idLabelElement: Element | null;
  /** Y-offset of the IdLabel from the edge midpoint. Used as tiebreaker within
   *  tolerance band — reflects the user's visual placement of the number label. */
  idLabelOffsetY: number;
}

/** One draw.io page prepared for numbering. */
interface NumberingPage {
  pageId: string;
  /** tfId of the multiprocess this page decomposes (placed child pages). */
  decomposes?: string;
  identities: Map<string, CellIdentity>;
  /** Sorted with the position strategy. */
  elements: ElementWithPosition[];
}

/**
 * Numbering counters per type
 */
interface NumberingCounters {
  [type: string]: number;
}

/**
 * DFDAutoNumbering - Service to auto-number IdLabels in DFD diagrams
 */
export class DFDAutoNumbering {
  private readonly tolerance: number;
  private readonly sortStrategy: "top-down" | "left-right" | "diagonal";
  private readonly weightX: number;
  private readonly weightY: number;

  /**
   * @param tolerance    - Alignment tolerance in px. Within this band the IdLabel
   *                       Y-offset is used as tiebreaker (visual placement wins).
   * @param sortStrategy - "top-down": top wins, left tiebreaker.
   *                       "left-right": left wins, top tiebreaker.
   *                       "diagonal": weightX*x + weightY*y score.
   * @param weightX      - X weight for diagonal (default: 0.8)
   * @param weightY      - Y weight for diagonal (default: 1.0)
   */
  constructor(
    tolerance: number = 50,
    sortStrategy: "top-down" | "left-right" | "diagonal" = "diagonal",
    weightX: number = 0.8,
    weightY: number = 1.0,
  ) {
    this.tolerance = tolerance;
    this.sortStrategy = sortStrategy;
    this.weightX = weightX;
    this.weightY = weightY;
  }

  /**
   * Auto-number all IdLabels in the XML from top-left to bottom-right
   * @param xml   - The Draw.io XML string
   * @param pages - dfd.pages (page tree and identity links); absent for a
   *                classic single-page project. A multi-page file is only
   *                numbered when every page is adopted (listed here).
   * @returns The XML string with updated IdLabels
   */
  public autoNumber(xml: string, pages?: readonly DFDPage[]): string {
    if (!xml || xml.trim() === "") {
      return xml;
    }

    // Phase 0 guard (leveled-DFD design §13), narrowed in Phase 3a: without
    // the identity links of dfd.pages, numbering several pages would number
    // context copies of the same element independently and destroy
    // cross-page IDs; on a compressed page it would see nothing. Unadopted
    // or compressed layouts are left untouched.
    const pageLayout = inspectDrawioPages(
      xml,
      pages?.map((page) => page.pageId),
    );
    if (!pageLayout.supported) {
      console.warn(
        "[AutoNumbering] Skipped:",
        describeUnsupportedPageLayout(pageLayout),
      );
      return xml;
    }

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, "text/xml");

      // Check for parse errors
      const parseError = doc.querySelector("parsererror");
      if (parseError) {
        console.error("XML parse error:", parseError.textContent);
        return xml;
      }

      // Per page: elements with positions and IdLabels, sorted top-left to
      // bottom-right on that page's own geometry; pages in tree order.
      const numberingPages = this.pagesInTreeOrder(
        this.pageScopes(doc),
        xml,
        pages,
      ).map(({ pageId, scope, decomposes }) => {
        const elementsWithPositions = this.findElementsWithPositions(scope);
        console.log(
          `[AutoNumbering] Found elements on page "${pageId}":`,
          elementsWithPositions.map((e) => ({
            id: e.id,
            type: e.type,
            hasIdLabel: !!e.idLabelElement,
            x: e.x,
            y: e.y,
          })),
        );
        return {
          pageId,
          decomposes,
          identities: collectCellIdentities(
            pages?.find((page) => page.pageId === pageId)?.links,
          ),
          elements: this.sortElementsByPosition(elementsWithPositions),
        };
      });

      // Number per prefix across all pages
      this.applyNumbering(numberingPages);

      // Serialize back to XML
      const serializer = new XMLSerializer();
      return serializer.serializeToString(doc);
    } catch (error) {
      console.error("Auto-numbering failed:", error);
      return xml;
    }
  }

  /**
   * The pages of the document as search scopes: each <diagram>'s
   * <mxGraphModel>, or the whole document for a bare <mxGraphModel>. Cell
   * ids are only unique within a page, so every lookup stays in its scope.
   */
  private pageScopes(
    doc: Document,
  ): { pageId: string; scope: Document | Element }[] {
    const diagrams = Array.from(doc.getElementsByTagName("diagram"));
    if (diagrams.length === 0) return [{ pageId: "", scope: doc }];
    return diagrams.flatMap((diagram) => {
      const model = diagram.getElementsByTagName("mxGraphModel")[0];
      return model
        ? [{ pageId: diagram.getAttribute("id") ?? "", scope: model }]
        : [];
    });
  }

  /**
   * Pages in tree order (root, then child pages depth-first by order) —
   * the same page tree the analysis uses — with the multiprocess each placed
   * child page decomposes. Pages the tree could not place follow in
   * document order, without one. A single page needs no tree.
   */
  private pagesInTreeOrder<T extends { pageId: string }>(
    scopes: T[],
    xml: string,
    pages: readonly DFDPage[] | undefined,
  ): (T & { decomposes?: string })[] {
    if (scopes.length < 2) return scopes;
    const parse = dfdParser.parse(xml, pages);
    const homePages = computeHomePages(parse.occurrences);
    const tree = buildPageTree({
      parsedPages: parse.pages,
      persistedPages: pages,
      elements: parse.elements,
      occurrences: parse.occurrences,
      homePages,
    });
    const rank = new Map(tree.pages.map((page, index) => [page.pageId, index]));
    const decomposedBy = new Map(
      [...tree.childPageOf].map(([mp, pageId]) => [pageId, mp]),
    );
    const docIndex = new Map(scopes.map((scope, index) => [scope, index]));
    return [...scopes]
      .sort(
        (a, b) =>
          (rank.get(a.pageId) ?? rank.size) -
            (rank.get(b.pageId) ?? rank.size) ||
          docIndex.get(a)! - docIndex.get(b)!,
      )
      .map((scope) => ({
        ...scope,
        decomposes: decomposedBy.get(scope.pageId),
      }));
  }

  /**
   * Find all DFD elements with their positions and associated IdLabels
   * within one page (or a bare document).
   */
  private findElementsWithPositions(
    scope: Document | Element,
  ): ElementWithPosition[] {
    const elements: ElementWithPosition[] = [];
    const objects = scope.getElementsByTagName("object");

    // First pass: Build a map of all objects by ID and collect group positions
    const objectMap = new Map<string, Element>();
    const groupPositions = new Map<string, { x: number; y: number }>();

    Array.from(objects).forEach((obj) => {
      const id = obj.getAttribute("id");
      if (id) {
        objectMap.set(id, obj);
      }

      const mxCell = obj.getElementsByTagName("mxCell")[0];
      if (!mxCell) return;

      const style = mxCell.getAttribute("style") || "";
      if (style.includes("group")) {
        const geometry = mxCell.getElementsByTagName("mxGeometry")[0];
        if (geometry && id) {
          groupPositions.set(id, {
            x: parseFloat(geometry.getAttribute("x") || "0"),
            y: parseFloat(geometry.getAttribute("y") || "0"),
          });
        }
      }
    });

    // Build element position cache for edge midpoint calculation
    const elementPositionCache = new Map<
      string,
      { x: number; y: number; w: number; h: number }
    >();
    Array.from(objects).forEach((obj) => {
      const id = obj.getAttribute("id");
      if (!id) return;
      const mxCell = obj.getElementsByTagName("mxCell")[0];
      if (!mxCell) return;
      const geometry = mxCell.getElementsByTagName("mxGeometry")[0];
      if (!geometry) return;
      const x = parseFloat(geometry.getAttribute("x") || "0");
      const y = parseFloat(geometry.getAttribute("y") || "0");
      const w = parseFloat(geometry.getAttribute("width") || "0");
      const h = parseFloat(geometry.getAttribute("height") || "0");
      const parent = mxCell.getAttribute("parent");
      const groupOffset =
        parent && groupPositions.has(parent)
          ? groupPositions.get(parent)!
          : { x: 0, y: 0 };
      elementPositionCache.set(id, {
        x: x + groupOffset.x,
        y: y + groupOffset.y,
        w,
        h,
      });
    });

    // Second pass: Find elements and their IdLabels
    Array.from(objects).forEach((obj) => {
      const type = (obj.getAttribute("type") || "").toLowerCase();
      const id = obj.getAttribute("id");

      if (!id || !type) return;

      // Skip idlabels and unknown types
      if (type === "idlabel" || !this.isValidElementType(type)) return;

      const mxCell = obj.getElementsByTagName("mxCell")[0];
      if (!mxCell) return;

      const style = mxCell.getAttribute("style") || "";
      if (style.includes("group")) return; // Skip group containers

      // Get position — edges use source/target midpoint
      const isEdge = mxCell.getAttribute("edge") === "1";
      let position: { x: number; y: number };

      if (isEdge) {
        position = this.getEdgeMidpoint(mxCell, elementPositionCache);
      } else {
        position = this.getElementPosition(mxCell, groupPositions);
      }

      // Find associated IdLabel
      const idLabel = this.findIdLabelForElement(id, obj, scope, objectMap);

      if (idLabel) {
        console.log(
          `[AutoNumbering] Found IdLabel for ${type} (${id}):`,
          idLabel.getAttribute("label") || "no label attr",
        );
      } else {
        console.log(`[AutoNumbering] No IdLabel found for ${type} (${id})`);
      }

      // Extract IdLabel Y-offset for use as tiebreaker within tolerance band.
      // The user places the IdLabel where it visually belongs — this reflects
      // intended reading order better than any geometric approximation.
      let idLabelOffsetY = 0;
      if (idLabel) {
        const labelCell = idLabel.getElementsByTagName("mxCell")[0];
        const labelGeom = labelCell?.getElementsByTagName("mxGeometry")[0];
        const offsetPt = labelGeom?.getElementsByTagName("mxPoint")[0];
        if (offsetPt) {
          idLabelOffsetY = parseFloat(offsetPt.getAttribute("y") || "0");
        }
      }

      elements.push({
        id,
        type: this.normalizeType(type),
        isEdge,
        x: position.x,
        y: position.y,
        idLabelElement: idLabel,
        idLabelOffsetY,
      });
    });

    return elements;
  }

  /**
   * Calculate the representative point of an edge for sorting purposes.
   *
   * Priority:
   * 1. Average of Array waypoints (as="points") — reflects the actual routed path.
   *    Two edges between the same pair of nodes can have very different paths;
   *    the waypoint average is the only reliable discriminator.
   * 2. Midpoint between source and target element centres — used when no
   *    explicit waypoints are present (straight/auto-routed edges).
   * 3. Standalone mxPoint waypoints without an "as" attribute (rare fallback).
   * 4. Single endpoint centre if only one side is known.
   */
  private getEdgeMidpoint(
    mxCell: Element,
    positionCache: Map<string, { x: number; y: number; w: number; h: number }>,
  ): { x: number; y: number } {
    const sourceId = mxCell.getAttribute("source");
    const targetId = mxCell.getAttribute("target");

    const geometry = mxCell.getElementsByTagName("mxGeometry")[0];

    // Priority 1: Array waypoints — use average, not just the midpoint index.
    // Edges sharing the same source/target pair (e.g. request vs response)
    // are only distinguishable by their routed path, not by endpoint midpoint.
    if (geometry) {
      const arrays = geometry.getElementsByTagName("Array");
      for (let i = 0; i < arrays.length; i++) {
        if (arrays[i].getAttribute("as") === "points") {
          const pts = arrays[i].getElementsByTagName("mxPoint");
          if (pts.length > 0) {
            let sumX = 0,
              sumY = 0;
            for (let j = 0; j < pts.length; j++) {
              sumX += parseFloat(pts[j].getAttribute("x") || "0");
              sumY += parseFloat(pts[j].getAttribute("y") || "0");
            }
            return { x: sumX / pts.length, y: sumY / pts.length };
          }
        }
      }
    }

    // Priority 2: midpoint between source/target element centres
    const src = sourceId ? positionCache.get(sourceId) : undefined;
    const tgt = targetId ? positionCache.get(targetId) : undefined;

    if (src && tgt) {
      return {
        x: (src.x + src.w / 2 + tgt.x + tgt.w / 2) / 2,
        y: (src.y + src.h / 2 + tgt.y + tgt.h / 2) / 2,
      };
    }

    // Priority 3: standalone mxPoint waypoints (exclude sourcePoint / targetPoint)
    if (geometry) {
      const points = Array.from(
        geometry.getElementsByTagName("mxPoint"),
      ).filter((p) => !p.getAttribute("as"));
      if (points.length > 0) {
        let sumX = 0,
          sumY = 0;
        points.forEach((p) => {
          sumX += parseFloat(p.getAttribute("x") || "0");
          sumY += parseFloat(p.getAttribute("y") || "0");
        });
        return { x: sumX / points.length, y: sumY / points.length };
      }
    }

    // Last resort: single known endpoint
    if (src) return { x: src.x + src.w / 2, y: src.y + src.h / 2 };
    if (tgt) return { x: tgt.x + tgt.w / 2, y: tgt.y + tgt.h / 2 };

    return { x: 0, y: 0 };
  }

  /**
   * Check if type is a valid DFD element type for auto-numbering
   * NOTE: Assets are excluded - they are references, not unique elements
   */
  private isValidElementType(type: string): boolean {
    const validTypes = [
      "process",
      "multiprocess",
      "dataflow",
      "datastorage",
      "datastore",
      "externalentity",
      // 'asset' excluded - Assets are references
      "interface",
      "sensor",
      "actuator",
    ];
    return validTypes.includes(type.toLowerCase());
  }

  /**
   * Normalize type names (e.g., datastorage → datastore)
   */
  private normalizeType(type: string): string {
    const typeMap: Record<string, string> = {
      datastorage: "datastore",
    };
    return typeMap[type.toLowerCase()] || type.toLowerCase();
  }

  /**
   * Get absolute position of an element
   */
  private getElementPosition(
    mxCell: Element,
    groupPositions: Map<string, { x: number; y: number }>,
  ): { x: number; y: number } {
    const geometry = mxCell.getElementsByTagName("mxGeometry")[0];

    let x = 0;
    let y = 0;

    if (geometry) {
      x = parseFloat(geometry.getAttribute("x") || "0");
      y = parseFloat(geometry.getAttribute("y") || "0");
    }

    // Add parent group position if element is in a group
    const parent = mxCell.getAttribute("parent");
    if (parent && groupPositions.has(parent)) {
      const groupPos = groupPositions.get(parent)!;
      x += groupPos.x;
      y += groupPos.y;
    }

    return { x, y };
  }

  /**
   * Find the IdLabel element associated with an element
   * Tries multiple strategies
   */
  private findIdLabelForElement(
    elementId: string,
    elementObj: Element,
    scope: Document | Element,
    objectMap: Map<string, Element>,
  ): Element | null {
    const objects = scope.getElementsByTagName("object");

    // Strategy 1: IdLabel with parent = elementId (new structure after stencil fix)
    for (let i = 0; i < objects.length; i++) {
      const obj = objects[i];
      const type = (obj.getAttribute("type") || "").toLowerCase();

      if (type === "idlabel") {
        const mxCell = obj.getElementsByTagName("mxCell")[0];
        const parent = mxCell?.getAttribute("parent");

        if (parent === elementId) {
          return obj;
        }
      }
    }

    // Strategy 2: IdLabel in same group as element
    const elementMxCell = elementObj.getElementsByTagName("mxCell")[0];
    const elementParent = elementMxCell?.getAttribute("parent");

    if (elementParent && elementParent !== "1" && elementParent !== "0") {
      // Element is in a group, look for IdLabel in same group
      for (let i = 0; i < objects.length; i++) {
        const obj = objects[i];
        const type = (obj.getAttribute("type") || "").toLowerCase();

        if (type === "idlabel") {
          const mxCell = obj.getElementsByTagName("mxCell")[0];
          const parent = mxCell?.getAttribute("parent");

          if (parent === elementParent) {
            return obj;
          }
        }
      }
    }

    // Strategy 3: Look for object without type but with idlabel-like content in same group
    if (elementParent && elementParent !== "1" && elementParent !== "0") {
      for (let i = 0; i < objects.length; i++) {
        const obj = objects[i];
        const type = obj.getAttribute("type");
        const label = obj.getAttribute("label") || "";

        // Object without type attribute but with label that looks like IdLabel
        if (!type && this.looksLikeIdLabel(label)) {
          const mxCell = obj.getElementsByTagName("mxCell")[0];
          const parent = mxCell?.getAttribute("parent");

          if (parent === elementParent || parent === elementId) {
            return obj;
          }
        }
      }
    }

    return null;
  }

  /**
   * Check if a value looks like an IdLabel (e.g., "P-xx", "DF-1", etc.)
   */
  private looksLikeIdLabel(value: string): boolean {
    // Strip HTML tags for check
    const cleanValue = value.replace(/<[^>]*>/g, "").trim();

    // More flexible patterns that match various formats
    // Numbers may be hierarchical in leveled DFDs ("P-1.3", "P-1.xx").
    const patterns = [
      /^P-(?:\d+\.)*\d*x*$/i,
      /^MP-(?:\d+\.)*\d*x*$/i,
      /^DF-(?:\d+\.)*\d*x*$/i,
      /^DS-(?:\d+\.)*\d*x*$/i,
      /^EE-(?:\d+\.)*\d*x*$/i,
      /^A-(?:\d+\.)*\d*x*$/i,
      /^IF-(?:\d+\.)*\d*x*$/i,
    ];
    return patterns.some((p) => p.test(cleanValue));
  }

  /**
   * Sort elements by position using a score function:
   *
   *   top-down:   score = y + x*0.1
   *     → Top wins strongly. Elements within `tolerance` px on Y are treated
   *       as the same row; X breaks the tie (left wins).
   *
   *   left-right: score = x + y*0.1
   *     → Left wins strongly. Elements within `tolerance` px on X are treated
   *       as the same column; Y breaks the tie (top wins).
   *
   *   diagonal: score = weightX*x + weightY*y
   *     → Weighted combination. Default 0.8x + 1.0y gives slight Y preference.
   *       Within tolerance band: IdLabel Y-offset used as tiebreaker.
   */
  private sortElementsByPosition(
    elements: ElementWithPosition[],
  ): ElementWithPosition[] {
    if (this.sortStrategy === "diagonal") {
      console.log(
        `[AutoNumbering] diagonal sort — weightX=${this.weightX} weightY=${this.weightY} tolerance=n/a`,
      );
    }
    return [...elements].sort((a, b) => {
      if (this.sortStrategy === "diagonal") {
        const scoreA = this.weightX * a.x + this.weightY * a.y;
        const scoreB = this.weightX * b.x + this.weightY * b.y;
        const scoreDiff = scoreA - scoreB;
        // Diagonal uses continuous scoring — no tolerance band needed.
        // idLabelOffsetY only kicks in for truly tied scores (floating-point safe: < 1px).
        if (Math.abs(scoreDiff) < 1) {
          return a.idLabelOffsetY - b.idLabelOffsetY;
        }
        return scoreDiff;
      }

      if (this.sortStrategy === "left-right") {
        const xDiff = a.x - b.x;
        if (Math.abs(xDiff) <= this.tolerance) {
          const yDiff = a.y - b.y;
          if (Math.abs(yDiff) <= this.tolerance)
            return a.idLabelOffsetY - b.idLabelOffsetY;
          return yDiff;
        }
        return xDiff;
      }

      // top-down: top wins. Within row band: left wins; IdLabel offset as final tiebreaker.
      const yDiff = a.y - b.y;
      if (Math.abs(yDiff) <= this.tolerance) {
        const xDiff = a.x - b.x;
        if (Math.abs(xDiff) <= this.tolerance)
          return a.idLabelOffsetY - b.idLabelOffsetY;
        return xDiff;
      }
      return yDiff;
    });
  }

  /**
   * Apply numbering per type (pages and their elements already in numbering
   * order).
   *
   *   1. definitions take the next number of their type in their page's
   *      namespace — "" on the root page, the decomposed multiprocess's
   *      number ("1", "1.2") on its child page — once per logical element
   *      (tfId); a second definition of the same tfId (duplicated page,
   *      reassigned in Phase 3b) shows the same number
   *   2. logical elements without a definition (dangling) take the next
   *      number of the root namespace at their first copy
   *   3. every labelled occurrence — definition or copy — shows the number
   *      of its logical element
   */
  private applyNumbering(pages: NumberingPage[]): void {
    // Counters per namespace and type
    const counters = new Map<string, NumberingCounters>();
    const numbers = new Map<
      string,
      { label: string; prefix: string; number: string }
    >();
    const logicalKey = (page: NumberingPage, element: ElementWithPosition) =>
      `${element.isEdge ? "connection" : "element"}\u0000${
        identityOf(page.identities, element.id).tfId
      }`;
    // Namespace of a page: the number of the multiprocess it decomposes,
    // root namespace "" if it decomposes none or that MP has no number.
    const namespaceOf = (page: NumberingPage) =>
      page.decomposes
        ? (numbers.get(`element\u0000${page.decomposes}`)?.number ?? "")
        : "";

    for (const definitionsOnly of [true, false]) {
      for (const page of pages) {
        const namespace = definitionsOnly ? namespaceOf(page) : "";
        for (const element of page.elements) {
          if (!element.idLabelElement) continue;
          const { role } = identityOf(page.identities, element.id);
          if (definitionsOnly && role !== "definition") continue;
          const key = logicalKey(page, element);
          if (numbers.has(key)) continue;

          const type = element.type;
          const prefix = this.getPrefixForType(type);
          if (!prefix) continue;

          // Initialize counter for type if needed
          const typeCounters = counters.get(namespace) ?? {};
          counters.set(namespace, typeCounters);
          if (typeCounters[type] === undefined) {
            typeCounters[type] = 1;
          }
          const number = namespace
            ? `${namespace}.${typeCounters[type]}`
            : `${typeCounters[type]}`;
          numbers.set(key, { label: `${prefix}${number}`, prefix, number });
          typeCounters[type]++;
        }
      }
    }

    for (const page of pages) {
      for (const element of page.elements) {
        if (!element.idLabelElement) continue;
        const number = numbers.get(logicalKey(page, element));
        if (!number) continue;

        // Update the IdLabel
        this.updateIdLabel(element.idLabelElement, number.label, number.prefix);

        console.log(
          `[AutoNumbering] Updated ${element.type} (${element.id}) to ${number.label}`,
        );
      }
    }
  }

  /**
   * Get prefix for element type
   */
  private getPrefixForType(type: string): string | null {
    return ELEMENT_PREFIXES[type.toLowerCase()] || null;
  }

  /**
   * Update an IdLabel element with a new label value
   */
  private updateIdLabel(
    idLabelElement: Element,
    newLabel: string,
    prefix: string,
  ): void {
    // Handle <object> element
    if (idLabelElement.tagName === "object") {
      const currentLabel = idLabelElement.getAttribute("label") || "";

      // Replace the label content
      const newLabelWithFormat = this.replaceIdLabelContent(
        currentLabel,
        newLabel,
        prefix,
      );
      idLabelElement.setAttribute("label", newLabelWithFormat);

      console.log(
        `[AutoNumbering] Object label: "${currentLabel}" -> "${newLabelWithFormat}"`,
      );
    }
  }

  /**
   * Replace IdLabel content while preserving HTML formatting
   * Handles various formats:
   * - Plain: "P-xx" -> "P-1"
   * - HTML: "<font style="font-size: 10px">P-xx</font>" -> "<font style="font-size: 10px">P-1</font>"
   * - Span: "<span style="font-size: 10px">EE-xx</span>" -> "<span style="font-size: 10px">EE-1</span>"
   */
  private replaceIdLabelContent(
    currentLabel: string,
    newLabel: string,
    prefix: string,
  ): string {
    // If no HTML, just return new label
    if (!currentLabel.includes("<")) {
      return newLabel;
    }

    // Build regex to find the old label pattern
    // Escape the prefix for regex (e.g., "MP-" needs to escape the "-")
    const escapedPrefix = prefix.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");

    // Pattern matches: prefix followed by digits and/or x's, hierarchical
    // in leveled DFDs — the whole number is replaced, never only its head
    // e.g., "P-xx", "P-1", "MP-xx", "EE-123", "A-xx", "P-1.3", "P-1.xx"
    const labelPattern = new RegExp(
      `${escapedPrefix}[\\dxX]+(?:\\.[\\dxX]+)*`,
      "i",
    );

    // Check if the pattern exists in the label
    if (labelPattern.test(currentLabel)) {
      // Replace the matched pattern with the new label
      const result = currentLabel.replace(labelPattern, newLabel);
      console.log(
        `[AutoNumbering] Regex replace: "${currentLabel}" -> "${result}"`,
      );
      return result;
    }

    // Fallback: Try to find any IdLabel-like pattern and replace
    const anyLabelPattern = /([PMDS]P?-|DF-|EE-|A-|IF-)[\dxX]+(?:\.[\dxX]+)*/i;
    if (anyLabelPattern.test(currentLabel)) {
      const result = currentLabel.replace(anyLabelPattern, newLabel);
      console.log(
        `[AutoNumbering] Fallback replace: "${currentLabel}" -> "${result}"`,
      );
      return result;
    }

    // Last resort: Extract text between tags and replace entirely
    const tagMatch = currentLabel.match(/^(<[^>]+>)(.*?)(<\/[^>]+>)$/);
    if (tagMatch) {
      const result = `${tagMatch[1]}${newLabel}${tagMatch[3]}`;
      console.log(
        `[AutoNumbering] Tag replace: "${currentLabel}" -> "${result}"`,
      );
      return result;
    }

    // If all else fails, just return the new label
    console.log(`[AutoNumbering] No match, using plain: "${newLabel}"`);
    return newLabel;
  }

  /**
   * Get statistics about what would be numbered
   */
  public getNumberingPreview(xml: string): Record<string, number> {
    if (!xml || xml.trim() === "") {
      return {};
    }

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, "text/xml");

      const elements = this.findElementsWithPositions(doc);
      const counts: Record<string, number> = {};

      elements.forEach((el) => {
        if (el.idLabelElement) {
          const type = el.type;
          counts[type] = (counts[type] || 0) + 1;
        }
      });

      return counts;
    } catch {
      return {};
    }
  }
}

// Export singleton instance
export const dfdAutoNumbering = new DFDAutoNumbering();

export default DFDAutoNumbering;
