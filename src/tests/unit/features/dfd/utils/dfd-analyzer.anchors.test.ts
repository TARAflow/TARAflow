// src/tests/unit/features/dfd/utils/dfd-analyzer.anchors.test.ts
//
// The interface a data flow passes is found on the line exit anchor →
// waypoints → entry anchor. The parser keeps draw.io's exitX/exitY and
// entryX/entryY on the connection; without them the line runs from the
// shape's centre.
//
//   src (0,0 100x100) ── exit (100,50) ──► W (300,-100) ──► entry (450,0)
//                                                            dst (400,0 100x100)
//   IF "B" (380,-10 20x20) lies on W → centre of dst (450,50), not on
//   W → entry anchor.

import { describe, it, expect } from "vitest";
import { dfdParser } from "features/dfd/services/dfd-parser";
import { DefaultDFDGraphBuilder } from "features/dfd/services/dfd-graph-builder";

const vertex = (type: string, id: string, x: number, y: number, w: number, h: number) =>
  `<object label="${id}" type="${type}" id="${id}">` +
  `<mxCell style="rounded=0;" vertex="1" parent="1">` +
  `<mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell></object>`;

const flow = (anchors: string) =>
  `<object label="f" type="dataflow" id="f">` +
  `<mxCell style="endArrow=classic;edgeStyle=orthogonalEdgeStyle;${anchors}" edge="1" parent="1" source="src" target="dst">` +
  `<mxGeometry relative="1" as="geometry"><Array as="points"><mxPoint x="300" y="-100"/></Array></mxGeometry>` +
  `</mxCell></object>`;

const xml = (anchors: string) =>
  `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>` +
  vertex("externalentity", "src", 0, 0, 100, 100) +
  vertex("process", "dst", 400, 0, 100, 100) +
  vertex("interface", "B", 380, -10, 20, 20) +
  flow(anchors) +
  `</root></mxGraphModel>`;

function interfacesOf(anchors: string) {
  const parse = dfdParser.parse(xml(anchors));
  const graph = new DefaultDFDGraphBuilder().build({
    elements: parse.elements,
    connections: parse.connections,
    assets: [],
  });
  return { parse, interfaceIds: graph.dataFlowAnalysis.get("f")?.interfaceIds ?? [] };
}

describe("data-flow line uses the draw.io anchors", () => {
  const ANCHORED = "exitX=1;exitY=0.5;exitDx=0;exitDy=0;entryX=0.5;entryY=0;entryDx=0;entryDy=0;";

  it("keeps the anchors on the parsed connection", () => {
    const { parse } = interfacesOf(ANCHORED);
    expect(parse.connections[0]).toMatchObject({ exitX: 1, exitY: 0.5, entryX: 0.5, entryY: 0 });
  });

  it("an interface next to the anchored line is not crossed", () => {
    expect(interfacesOf(ANCHORED).interfaceIds).toEqual([]);
  });

  it("without anchors the line runs to the centre and crosses it", () => {
    expect(interfacesOf("").interfaceIds).toEqual(["B"]);
  });
});
