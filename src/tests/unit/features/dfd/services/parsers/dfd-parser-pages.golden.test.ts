// Leveled-DFD Phase 1.1 — golden gate
// (leveled-dfd-multi-diagram-design.md §13, Phase 1 gate).
//
// The parser now runs per draw.io page. For every real single-page project
// the result must be identical to the former whole-document parse:
// same elements, connections, display ids, stats and unconnected flows.
import { describe, it, expect } from "vitest";
import { dfdParser } from "features/dfd/services/dfd-parser";
import { parseXmlString } from "features/dfd/services/parsers/xml-parser";
import {
  parseElements,
  collectIdLabels,
  assignDisplayIds as assignElementDisplayIds,
} from "features/dfd/services/parsers/element-parser";
import {
  parseConnections,
  assignDisplayIds as assignConnectionDisplayIds,
} from "features/dfd/services/parsers/connection-parser";
import { calculateStats } from "features/dfd/services/parsers/stats-calculator";
import { loadProjectFixture, FIXTURES } from "../../../../../fixtures/load-fixture";

/** The parse as it was before Phase 1.1: one pass over the whole document. */
function legacyParse(xml: string) {
  const doc = parseXmlString(xml);
  const idLabels = collectIdLabels(doc);
  const elements = parseElements(doc);
  assignElementDisplayIds(elements, idLabels);
  const { connections, unconnectedDataflows } = parseConnections(doc);
  assignConnectionDisplayIds(connections, idLabels);
  return {
    elements,
    connections,
    unconnectedDataflows,
    stats: calculateStats(elements, connections, []),
  };
}

const projects = [
  ["SmokeDetector", FIXTURES.smokeDetector],
  ["Simple_Test_Project", FIXTURES.simpleTest],
  ["cnc-ref", FIXTURES.cncRef],
  ["simple-controller.base", "examples/simple-controller.base.tara.json"],
] as const;

describe.each(projects)("per-page parse is identical for %s", (_name, file) => {
  const xml = loadProjectFixture(file).dfd?.xml ?? "";

  it("has a DFD to compare", () => {
    expect(xml.length).toBeGreaterThan(0);
  });

  it("produces the same elements, connections, stats and unconnected flows", () => {
    const legacy = legacyParse(xml);
    const result = dfdParser.parse(xml);
    expect(result.elements).toEqual(legacy.elements);
    expect(result.connections).toEqual(legacy.connections);
    expect(result.unconnectedDataflows).toEqual(legacy.unconnectedDataflows);
    expect(result.stats).toEqual(legacy.stats);
  });

  it("reports one page and one occurrence per element and connection", () => {
    const result = dfdParser.parse(xml);
    expect(result.pages).toHaveLength(1);
    expect(result.occurrences).toHaveLength(
      result.elements.length + result.connections.length,
    );
  });
});

describe("per-page parse keeps pages apart", () => {
  // Two pages whose cells share ids — legal in draw.io (ids are page-local).
  const page = (label: string, idLabel: string) =>
    `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
      <object label="${label}" type="process" id="n1">
        <mxCell style="rounded=1;" vertex="1" parent="1">
          <mxGeometry x="10" y="10" width="100" height="50" as="geometry"/>
        </mxCell>
      </object>
      <object label="${idLabel}" type="idlabel" id="n1_id">
        <mxCell connectable="0" parent="n1" vertex="1">
          <mxGeometry width="35" height="18" relative="1" as="geometry"/>
        </mxCell>
      </object>
    </root></mxGraphModel>`;
  const xml = `<mxfile><diagram id="a" name="A">${page("Gateway", "P-1")}</diagram><diagram id="b" name="B">${page("Sensor", "P-2")}</diagram></mxfile>`;

  it("resolves id labels per page and records both occurrences", () => {
    const result = dfdParser.parse(xml);
    // Phase 1.1: the second "n1" is not added again (logical identity is 1.2),
    // but its id label no longer leaks onto the first page's element.
    expect(result.elements.map((e) => [e.id, e.name, e.displayId])).toEqual([
      ["n1", "Gateway", "P-1"],
    ]);
    expect(result.occurrences.map((o) => [o.pageId, o.cellId])).toEqual([
      ["a", "n1"],
      ["b", "n1"],
    ]);
  });

  it("the former whole-document parse mixed the pages up", () => {
    const legacy = legacyParse(xml);
    // Last id label wins for the shared parent id "n1" → wrong display id.
    expect(legacy.elements[0].displayId).toBe("P-2");
  });
});
