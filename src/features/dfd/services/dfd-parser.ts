// ==================== DFD PARSER ====================
// Single Responsibility: Orchestrate DFD parsing from DrawIO XML
// This is the public API for DFD parsing

import type { DFDElement, DFDConnection, DFDStats } from "../models/dfd-types";
import type { DFDAsset } from "../models/dfd-asset-types";

import { extractXmlFromDrawioMsg } from "./parsers/xml-parser";
import { readDrawioPages } from "./parsers/page-reader";
import {
  parseElements,
  collectIdLabels,
  assignDisplayIds as assignElementDisplayIds,
} from "./parsers/element-parser";
import {
  parseConnections,
  assignDisplayIds as assignConnectionDisplayIds,
} from "./parsers/connection-parser";
import { calculateStats } from "./parsers/stats-calculator";
import { createEmptyStats } from "./parsers/parser-utils";

export interface ParseResult {
  elements: DFDElement[];
  connections: DFDConnection[];
  assets: DFDAsset[];
  stats: DFDStats;
  /** Labels of dataflows that are not connected to elements */
  unconnectedDataflows: string[];
  /**
   * Pages found in the XML, in document order. Empty for empty XML; one
   * entry with pageId "" for a bare <mxGraphModel>. Not persisted.
   */
  pages: ParsedPageInfo[];
  /**
   * One entry per parsed element / connection cell, recording on which page
   * it was drawn. Not persisted (the XML is the source of truth, D7). Basis
   * for the logical identity model of leveled-DFD Phase 1.2+.
   */
  occurrences: ParsedOccurrence[];
}

export interface ParsedPageInfo {
  pageId: string;
  name: string;
  index: number;
}

export interface ParsedOccurrence {
  kind: "element" | "connection";
  /** Id of the parsed DFDElement / DFDConnection this cell produced. */
  id: string;
  pageId: string;
  /** draw.io cell id of this occurrence. */
  cellId: string;
}

/**
 * DFDParser - Orchestrates parsing of DrawIO XML into structured DFD data
 * 
 * This class delegates to specialized parser modules:
 * - xml-parser: Low-level XML handling
 * - element-parser: Parse DFD elements
 * - connection-parser: Parse dataflows
 * - stats-calculator: Calculate statistics
 *
 * NOTE: Assets are NOT parsed from XML. They are references living in
 * dfd.assets[], linked to elements via element.assetRelations. There is no
 * "asset marker" shape on the canvas (removed — legacy relic). parse()
 * therefore always returns assets: []; the authoritative asset list is
 * carried by the project and reconciled in dfd-service.mergeAssetProperties.
 */
export class DFDParser {
  /**
   * Parse DrawIO XML string to structured data
   */
  parse(xml: string): ParseResult {
    // Early return for empty XML
    if (!xml || xml.trim() === "") {
      return emptyResult();
    }

    try {
      // 1. Split into pages. Cell ids are only unique within a page, so every
      //    lookup below (id labels, groups, edge endpoints) runs per page.
      const pages = readDrawioPages(xml);

      const elements: DFDElement[] = [];
      const connections: DFDConnection[] = [];
      const unconnectedDataflows: string[] = [];
      const occurrences: ParsedOccurrence[] = [];
      const seenElementIds = new Set<string>();
      const seenConnectionIds = new Set<string>();

      for (const page of pages) {
        // 2. Collect ID labels first (they reference parent elements)
        const idLabels = collectIdLabels(page.doc);

        // 3. Parse elements
        const pageElements = parseElements(page.doc);
        assignElementDisplayIds(pageElements, idLabels);

        // 4. Parse connections
        const pageConnections = parseConnections(page.doc);
        assignConnectionDisplayIds(pageConnections.connections, idLabels);

        // Phase 1.1: an element/connection id seen on an earlier page is not
        // added twice (same behaviour as the former whole-document parse).
        // Logical identity across pages (tfId / context copies) is Phase 1.2;
        // multi-page layouts are still refused by the Phase 0 guard.
        for (const element of pageElements) {
          occurrences.push({
            kind: "element",
            id: element.id,
            pageId: page.pageId,
            cellId: element.id,
          });
          if (seenElementIds.has(element.id)) continue;
          seenElementIds.add(element.id);
          elements.push(element);
        }
        for (const connection of pageConnections.connections) {
          occurrences.push({
            kind: "connection",
            id: connection.id,
            pageId: page.pageId,
            cellId: connection.id,
          });
          if (seenConnectionIds.has(connection.id)) continue;
          seenConnectionIds.add(connection.id);
          connections.push(connection);
        }
        unconnectedDataflows.push(...pageConnections.unconnectedDataflows);
      }

      // 5. Assets are not markers on the canvas — they live in dfd.assets[]
      // and are reconciled downstream in dfd-service. Parsing derives none.
      const assets: DFDAsset[] = [];

      // 6. Calculate statistics
      const stats = calculateStats(elements, connections, assets);

      return {
        elements,
        connections,
        assets,
        stats,
        unconnectedDataflows,
        pages: pages.map(({ pageId, name, index }) => ({ pageId, name, index })),
        occurrences,
      };
    } catch (error) {
      console.error("DFDParser: Failed to parse XML", error);

      // Return empty result on error
      return emptyResult();
    }
  }

  /**
   * Extract XML from DrawioMsg JSON format
   */
  extractXmlFromDrawioMsg(drawioMsg: string): string | null {
    return extractXmlFromDrawioMsg(drawioMsg);
  }
}

function emptyResult(): ParseResult {
  return {
    elements: [],
    connections: [],
    assets: [],
    stats: createEmptyStats(),
    unconnectedDataflows: [],
    pages: [],
    occurrences: [],
  };
}

// Export singleton instance
export const dfdParser = new DFDParser();
export default dfdParser;