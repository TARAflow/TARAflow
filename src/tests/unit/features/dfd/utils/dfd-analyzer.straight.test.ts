// src/tests/unit/features/dfd/utils/dfd-analyzer.straight.test.ts
//
// Manual test 2026-11-17: in the import example the debugger flow ran as a
// straight diagonal line through the JTAG interface, and the interface was
// reported "not crossed by any data flow". Without waypoints every flow was
// checked as one of the two L-paths draw.io's orthogonal routing could take
// — both pass beside the interface. A flow without `edgeStyle` is a straight
// line; it is checked as one now. The geometry is the example's (Debugger →
// Sensor Diagnostic Controller, JTAG between them).

import { describe, expect, it } from "vitest";
import { dfdParser } from "features/dfd/services/dfd-parser";
import { DefaultDFDGraphBuilder } from "features/dfd/services/dfd-graph-builder";

const vertex = (type: string, id: string, x: number, y: number, w: number, h: number) =>
  `<object label="${id}" type="${type}" id="${id}">` +
  `<mxCell style="rounded=0;" vertex="1" parent="1">` +
  `<mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell></object>`;

const ANCHORS = "exitX=0.5;exitY=0;exitDx=0;exitDy=0;entryX=0.25;entryY=1;entryDx=0;entryDy=0;";
const flow = (edgeStyle: string) =>
  `<object label="pull debug commands" type="dataflow" id="df8">` +
  `<mxCell style="endArrow=classic;html=1;rounded=0;${edgeStyle}${ANCHORS}" edge="1" parent="1" source="dbg" target="p3">` +
  `<mxGeometry relative="1" as="geometry"/></mxCell></object>`;

const interfacesOf = (edgeStyle: string) => {
  const xml =
    `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>` +
    vertex("externalentity", "dbg", 200, 850, 90, 40) +
    vertex("process", "p3", 340, 350, 155, 50) +
    vertex("interface", "jtag", 270, 660, 50, 50) +
    flow(edgeStyle) +
    `</root></mxGraphModel>`;
  const parse = dfdParser.parse(xml);
  const graph = new DefaultDFDGraphBuilder().build({ elements: parse.elements, connections: parse.connections, assets: [] });
  return { connection: parse.connections[0], interfaceIds: graph.dataFlowAnalysis.get("df8")?.interfaceIds ?? [] };
};

describe("a straight flow through an interface", () => {
  it("without edgeStyle: straight, and it passes the interface", () => {
    const r = interfacesOf("");
    expect(r.connection.straight).toBe(true);
    expect(r.interfaceIds).toEqual(["jtag"]);
  });

  it("edgeStyle=none is straight too", () => {
    expect(interfacesOf("edgeStyle=none;").interfaceIds).toEqual(["jtag"]);
  });

  it("orthogonal: as before, the L-paths — beside the interface", () => {
    const r = interfacesOf("edgeStyle=orthogonalEdgeStyle;");
    expect(r.connection.straight).toBeUndefined();
    expect(r.interfaceIds).toEqual([]);
  });

  it("a record saved before the field existed is checked as before", () => {
    const { connection } = interfacesOf("");
    const { straight: _s, ...old } = connection;
    const parse = dfdParser.parse(
      `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>` +
        vertex("externalentity", "dbg", 200, 850, 90, 40) +
        vertex("process", "p3", 340, 350, 155, 50) +
        vertex("interface", "jtag", 270, 660, 50, 50) +
        `</root></mxGraphModel>`,
    );
    const graph = new DefaultDFDGraphBuilder().build({ elements: parse.elements, connections: [old], assets: [] });
    expect(graph.dataFlowAnalysis.get("df8")?.interfaceIds).toEqual([]);
  });
});
