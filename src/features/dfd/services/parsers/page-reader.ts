// ==================== PAGE READER ====================
// Leveled-DFD Phase 1.1 (leveled-dfd-multi-diagram-design.md §5.1, §11.1).
//
// Splits a draw.io XML string into its pages, each as its own DOM Document,
// so the element / connection parsers can run per page instead of over the
// whole mxfile. Per page matters because draw.io cell ids are only unique
// within a page (and "0"/"1" repeat on every page), so id-label lookups,
// group positions and edge endpoints must never be resolved across pages.
//
// Accepted inputs:
//   - a bare <mxGraphModel> (no <mxfile>/<diagram>) → one page, pageId ""
//   - <mxfile> with one or more uncompressed <diagram> pages
//   - an empty <diagram/> → a page without cells
//
// Compressed pages (base64 text instead of <mxGraphModel>) are NOT decoded:
// TARAflow's embedded draw.io writes uncompressed XML, and the Phase 0 guard
// (shared/utils/drawio-page-layout.ts) refuses compressed layouts before they
// reach the parser. A compressed page throws here instead of being read as
// empty — never a silent partial model.

import { parseXmlString } from "./xml-parser";

export interface DrawioPage {
  /** draw.io <diagram id>; "" for a bare <mxGraphModel>. */
  pageId: string;
  /** draw.io <diagram name>; "" if unnamed or bare. */
  name: string;
  /** Position in document order (0-based). */
  index: number;
  /** The page's own document, rooted at <mxGraphModel>. */
  doc: Document;
}

const EMPTY_MODEL =
  '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>';

/**
 * Split a draw.io XML string into its pages.
 *
 * Returns an empty array for empty input. A bare <mxGraphModel> yields one
 * page with pageId "" so callers can treat both formats alike.
 *
 * @throws Error on a compressed page — never silently returns a partial or
 *         empty page for content it cannot read.
 */
export function readDrawioPages(xml: string | null | undefined): DrawioPage[] {
  if (!xml || xml.trim() === "") return [];

  const root = parseXmlString(xml);
  const diagrams = Array.from(root.getElementsByTagName("diagram"));

  if (diagrams.length === 0) {
    return [{ pageId: "", name: "", index: 0, doc: root }];
  }

  const serializer = new XMLSerializer();

  return diagrams.map((diagram, index) => {
    const pageId = diagram.getAttribute("id") ?? "";
    const name = diagram.getAttribute("name") ?? "";
    const model = diagram.getElementsByTagName("mxGraphModel")[0];

    if (model) {
      return {
        pageId,
        name,
        index,
        doc: parseXmlString(serializer.serializeToString(model)),
      };
    }

    const text = (diagram.textContent ?? "").trim();
    if (text === "") {
      return { pageId, name, index, doc: parseXmlString(EMPTY_MODEL) };
    }

    throw new Error(
      `draw.io page "${name || pageId}" is stored compressed; compressed pages are not supported`,
    );
  });
}
