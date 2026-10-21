// taraflow-reporter/tests/unit/dom-parser-parity.test.ts
//
// Leveled DFD (Phase 7): the CLI reporter parses the draw.io XML with
// @xmldom/xmldom, the app with the browser's DOMParser. Both must yield the
// same parse and the same leveled analysis — otherwise CLI and app reports
// would differ.

import { afterEach, describe, expect, it } from "vitest";
import { DOMParser as XmldomParser, XMLSerializer as XmldomSerializer } from "@xmldom/xmldom";
import { dfdParser } from "../../../src/features/dfd/services/dfd-parser";
import {
  analyseLeveled,
  clearLeveledAnalysisCache,
} from "../../../src/features/dfd/services/leveled/leveled-analysis";
import { multiprocessGroupsFrom } from "../../../src/features/dfd/services/leveled/table-groups";
import { parentLevelFlowsFrom } from "../../../src/features/dfd/services/leveled/parent-level-flows";
import { installDomParser } from "../../cli/dom-parser-node";
import type { DFDConnection, DFDElement, DFDPage } from "../../../src/features/dfd/models/dfd-types";
import fixture from "../../../src/tests/fixtures/leveled/smoke-detector-leveled.json";

const browserParser = globalThis.DOMParser;
const browserSerializer = globalThis.XMLSerializer;
afterEach(() => {
  globalThis.DOMParser = browserParser;
  globalThis.XMLSerializer = browserSerializer;
  clearLeveledAnalysisCache();
});

/** Maps and sets as plain arrays, so results compare with toEqual. */
const plain = (value: unknown) =>
  JSON.parse(
    JSON.stringify(value, (_key, v) =>
      v instanceof Map ? [...v.entries()] : v instanceof Set ? [...v] : v,
    ),
  );

function analyse() {
  clearLeveledAnalysisCache();
  const analysis = analyseLeveled({
    xml: fixture.leveledXml,
    pages: fixture.pages as DFDPage[],
    elements: fixture.leveledElements as unknown as DFDElement[],
    connections: fixture.connections as unknown as DFDConnection[],
  });
  return plain({
    parse: analysis.parse,
    tree: analysis.tree,
    homePages: analysis.homePages,
    model: analysis.model,
    groups: multiprocessGroupsFrom(analysis),
    parentLevelFlows: parentLevelFlowsFrom(analysis),
    singlePage: dfdParser.parse(fixture.singlePageXml),
  });
}

/** As in the CLI: no DOM of its own, then installDomParser. */
function withXmldom<T>(run: () => T): T {
  const g = globalThis as { DOMParser?: unknown; XMLSerializer?: unknown };
  g.DOMParser = undefined;
  g.XMLSerializer = undefined;
  installDomParser();
  expect(globalThis.DOMParser).toBe(XmldomParser);
  expect(globalThis.XMLSerializer).toBe(XmldomSerializer);
  return run();
}

describe("DOM parser parity (browser vs. @xmldom/xmldom)", () => {
  it("parses and analyses the leveled SmokeDetector identically", () => {
    const browser = analyse();
    const xmldom = withXmldom(analyse);
    expect(xmldom.parse.elements.length).toBeGreaterThan(10);
    expect(xmldom.parse.pages).toHaveLength(3);
    expect(xmldom).toEqual(browser);
  });

  it("keeps an existing DOM (the app's, or one set before)", () => {
    installDomParser();
    expect(globalThis.DOMParser).toBe(browserParser);
    expect(globalThis.XMLSerializer).toBe(browserSerializer);
  });
});
