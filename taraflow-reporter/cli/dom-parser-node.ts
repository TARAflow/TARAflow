// taraflow-reporter/cli/dom-parser-node.ts
//
// Leveled DFD (leveled-dfd-multi-diagram-design.md, Phase 7): the report
// needs the same analysis of the draw.io XML as the app — pages, parts of
// the multiprocesses, flows analysed on parent level. The DFD parser reads
// the XML with DOMParser and splits the pages with XMLSerializer; Node has
// neither, @xmldom/xmldom provides both (the parsers use DOM Level 2 Core
// only, see parsers/xml-parser.ts).

import { DOMParser, XMLSerializer } from "@xmldom/xmldom";

/**
 * Makes globalThis.DOMParser and XMLSerializer available. Installed as a
 * pair — a serializer of one DOM cannot read the nodes of another — and
 * only where neither exists yet (the app's are kept).
 */
export function installDomParser(): void {
  const g = globalThis as { DOMParser?: unknown; XMLSerializer?: unknown };
  if (g.DOMParser !== undefined || g.XMLSerializer !== undefined) return;
  g.DOMParser = DOMParser;
  g.XMLSerializer = XMLSerializer;
}
