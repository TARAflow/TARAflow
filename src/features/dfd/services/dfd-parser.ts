// ==================== DFD PARSER ====================
// Single Responsibility: Orchestrate DFD parsing from DrawIO XML
// This is the public API for DFD parsing

import type {
  DFDElement,
  DFDConnection,
  DFDPage,
  DFDStats,
} from "../models/dfd-types";
import type { DFDAsset } from "../models/dfd-asset-types";

import { extractXmlFromDrawioMsg } from "./parsers/xml-parser";
import { readDrawioPages } from "./parsers/page-reader";
import {
  collectCellIdentities,
  identityOf,
  type OccurrenceRole,
} from "./parsers/identity-reader";
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
   * it was drawn and which logical element / flow it shows. Not persisted
   * (the XML is the source of truth, D7).
   */
  occurrences: ParsedOccurrence[];
  /**
   * The parsed cells of every page as drawn — page-local cell ids, endpoints
   * and geometry, context copies included — before they are merged into
   * logical records. Input of the per-page geometry (interfaces crossed,
   * boundary membership) of the effective model. Not persisted.
   */
  pageCells: ParsedPageCells[];
}

export interface ParsedPageCells {
  pageId: string;
  /** Elements with page-local cell ids (copies included). */
  elements: DFDElement[];
  /** Connections with page-local cell ids and cell-id endpoints. */
  connections: DFDConnection[];
}

export interface ParsedPageInfo {
  pageId: string;
  name: string;
  index: number;
}

export interface ParsedOccurrence {
  kind: "element" | "connection";
  /**
   * Logical identity (§5.2): id of the DFDElement / DFDConnection this cell
   * shows. Equals cellId unless dfd.pages[].links links the cell elsewhere.
   */
  tfId: string;
  /** "definition" (home of the logical record) or "ref" (context copy). */
  role: OccurrenceRole;
  pageId: string;
  /** draw.io cell id of this occurrence (page-local). */
  cellId: string;
  /** Connections only: endpoints as drawn on THIS page, resolved to tfIds. */
  sourceTfId?: string;
  targetTfId?: string;
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
   * Parse DrawIO XML string to structured data.
   *
   * @param pages dfd.pages — supplies the identity links per page (§5.2).
   *              Absent for classic projects: every cell is a definition
   *              with tfId = cell id.
   */
  parse(xml: string, pages?: readonly DFDPage[]): ParseResult {
    // Early return for empty XML
    if (!xml || xml.trim() === "") {
      return emptyResult();
    }

    try {
      // 1. Split into pages. Cell ids are only unique within a page, so every
      //    lookup below (id labels, groups, edge endpoints) runs per page.
      const drawioPages = readDrawioPages(xml);
      const linksByPage = new Map(
        (pages ?? []).map((page) => [page.pageId, page.links]),
      );

      const unconnectedDataflows: string[] = [];
      const occurrences: ParsedOccurrence[] = [];
      const pageCells: ParsedPageCells[] = [];
      const elementRecords = new LogicalRecords<DFDElement>();
      const connectionRecords = new LogicalRecords<DFDConnection>();

      for (const page of drawioPages) {
        // 2. Collect ID labels first (they reference parent elements)
        const idLabels = collectIdLabels(page.doc);
        // Identity links of this page (dfd.pages[].links), by cell id
        const identities = collectCellIdentities(linksByPage.get(page.pageId));

        // 3. Parse elements (ids are still page-local cell ids here)
        const pageElements = parseElements(page.doc);
        assignElementDisplayIds(pageElements, idLabels);

        // 4. Parse connections
        const pageConnections = parseConnections(page.doc);
        assignConnectionDisplayIds(pageConnections.connections, idLabels);

        // Keep the page as drawn (copies made before re-keying mutates ids).
        pageCells.push({
          pageId: page.pageId,
          elements: pageElements.map((e) => ({ ...e })),
          connections: pageConnections.connections.map((c) => ({ ...c })),
        });

        // 5. Re-key from page-local cell ids to logical tfIds (§5.2).
        //    Endpoints are resolved on the page they are drawn on, so a flow
        //    attached to a context copy points to the copied element.
        for (const element of pageElements) {
          const cellId = element.id;
          const { tfId, role } = identityOf(identities, cellId);
          element.id = tfId;
          occurrences.push({ kind: "element", tfId, role, pageId: page.pageId, cellId });
          elementRecords.offer(tfId, role, element);
        }
        for (const connection of pageConnections.connections) {
          const cellId = connection.id;
          const { tfId, role } = identityOf(identities, cellId);
          connection.id = tfId;
          connection.from = identityOf(identities, connection.from).tfId;
          connection.to = identityOf(identities, connection.to).tfId;
          occurrences.push({
            kind: "connection",
            tfId,
            role,
            pageId: page.pageId,
            cellId,
            sourceTfId: connection.from,
            targetTfId: connection.to,
          });
          connectionRecords.offer(tfId, role, connection);
        }
        unconnectedDataflows.push(...pageConnections.unconnectedDataflows);
      }

      // 6. One logical record per tfId: context copies merge into their
      //    definition (its label, display id, position and endpoints win).
      const elements = elementRecords.records();
      const connections = connectionRecords.records();

      // 7. Assets are not markers on the canvas — they live in dfd.assets[]
      // and are reconciled downstream in dfd-service. Parsing derives none.
      const assets: DFDAsset[] = [];

      // 8. Calculate statistics
      const stats = calculateStats(elements, connections, assets);

      return {
        elements,
        connections,
        assets,
        stats,
        unconnectedDataflows,
        pages: drawioPages.map(({ pageId, name, index }) => ({
          pageId,
          name,
          index,
        })),
        occurrences,
        pageCells,
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

/**
 * Collects the parsed cells of all pages and keeps one record per tfId.
 *
 * - The first definition in document order provides the record; a context
 *   copy never overrides a definition.
 * - Without any definition (a dangling context copy, §5.2.1) the first copy
 *   provides the record, so the logical element stays in the model and is
 *   analysed conservatively; detection and repair are Phase 1.4.
 * - Several definitions of one tfId (paste / duplicated page) keep the
 *   first one; reassigning the others a fresh tfId is Phase 1.3.
 * - Records are returned in order of the first occurrence of their tfId,
 *   which for a single page without identity attributes is exactly the
 *   former document order.
 */
class LogicalRecords<T> {
  private readonly byTfId = new Map<string, { role: OccurrenceRole; record: T }>();

  offer(tfId: string, role: OccurrenceRole, record: T): void {
    const current = this.byTfId.get(tfId);
    if (!current || (current.role === "ref" && role === "definition")) {
      this.byTfId.set(tfId, { role, record });
    }
  }

  records(): T[] {
    return Array.from(this.byTfId.values(), (entry) => entry.record);
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
    pageCells: [],
  };
}

// Export singleton instance
export const dfdParser = new DFDParser();
export default dfdParser;