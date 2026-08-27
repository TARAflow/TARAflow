// ==================== DFD PARSER ====================
// Single Responsibility: Orchestrate DFD parsing from DrawIO XML
// This is the public API for DFD parsing

import type { DFDElement, DFDConnection, DFDStats } from "../models/dfd-types";
import type { DFDAsset } from "../models/dfd-asset-types";

import { parseXmlString, extractXmlFromDrawioMsg } from "./parsers/xml-parser";
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
      return {
        elements: [],
        connections: [],
        assets: [],
        stats: createEmptyStats(),
        unconnectedDataflows: [],
      };
    }

    try {
      // 1. Parse XML to DOM
      const doc = parseXmlString(xml);

      // 2. Collect ID labels first (they reference parent elements)
      const idLabels = collectIdLabels(doc);

      // 3. Parse elements
      const elements = parseElements(doc);
      console.debug("assignElementDisplayIds: ", elements, idLabels);
      assignElementDisplayIds(elements, idLabels);

      // 4. Parse connections
      const { connections, unconnectedDataflows } = parseConnections(doc);
      assignConnectionDisplayIds(connections, idLabels);

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
      };
    } catch (error) {
      console.error("DFDParser: Failed to parse XML", error);

      // Return empty result on error
      return {
        elements: [],
        connections: [],
        assets: [],
        stats: createEmptyStats(),
        unconnectedDataflows: [],
      };
    }
  }

  /**
   * Extract XML from DrawioMsg JSON format
   */
  extractXmlFromDrawioMsg(drawioMsg: string): string | null {
    return extractXmlFromDrawioMsg(drawioMsg);
  }
}

// Export singleton instance
export const dfdParser = new DFDParser();
export default dfdParser;