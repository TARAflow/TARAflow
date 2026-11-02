// Derived exposure level of a data flow (dfd-graph-builder.ts,
// deriveExposureLevels): a crossing flow takes max(TB_from.EL, TB_to.EL);
// when it no longer crosses — boundary removed or resized, endpoints moved
// into one zone — a derived EL is cleared, a manual one stays. Bug class:
// stale derived fields after a driver change (reported 2026-11-02).
import { describe, it, expect } from "vitest";
import { dfdParser } from "features/dfd/services/dfd-parser";
import { DefaultDFDGraphBuilder } from "features/dfd/services/dfd-graph-builder";
import type { DFDConnection, DFDElement } from "features/dfd/models/dfd-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const builder = new DefaultDFDGraphBuilder();
const tb = (id: string, el: string) => ({ id, type: "TrustBoundary", properties: { defaultExposureLevel: el } }) as unknown as DFDElement;
const flow = (properties: Record<string, unknown>) => ({ id: "f", from: "a", to: "b", properties }) as unknown as DFDConnection;
const analysis = (crosses: boolean) =>
  new Map([["f", { crossesTrustBoundary: crosses, fromTrustBoundaryIds: crosses ? ["tb1"] : [], toTrustBoundaryIds: crosses ? ["tb2"] : [] } as Any]]);

function derive(conn: DFDConnection, crosses: boolean | undefined) {
  builder.deriveExposureLevels(
    [tb("tb1", "EL3"), tb("tb2", "EL1")],
    [conn],
    crosses === undefined ? new Map() : analysis(crosses),
    new Map(),
    new Map(),
  );
  return conn.properties as Any;
}

describe("deriveExposureLevels — data flows", () => {
  it("a crossing flow gets the higher EL of its boundaries, derived", () => {
    expect(derive(flow({}), true)).toMatchObject({ exposureLevel: "EL3", exposureLevelSource: "derived" });
  });

  it("no longer crossing: the derived EL is cleared", () => {
    const props = derive(flow({ exposureLevel: "EL3", exposureLevelSource: "derived" }), false);
    expect(props.exposureLevel).toBeUndefined();
    expect(props.exposureLevelSource).toBeUndefined();
  });

  it("a manual EL on a non-crossing flow is kept", () => {
    expect(derive(flow({ exposureLevel: "EL2", exposureLevelSource: "manual" }), false)).toMatchObject({
      exposureLevel: "EL2",
      exposureLevelSource: "manual",
    });
  });

  it("a flow without analysis (dangling endpoint) is left as it is", () => {
    expect(derive(flow({ exposureLevel: "EL3", exposureLevelSource: "derived" }), undefined)).toMatchObject({
      exposureLevel: "EL3",
      exposureLevelSource: "derived",
    });
  });
});

describe("end to end: the flow stops crossing", () => {
  const vertex = (type: string, id: string, x: number, y: number, w: number, h: number) =>
    `<object label="${id}" type="${type}" id="${id}">` +
    `<mxCell style="rounded=0;" vertex="1" parent="1">` +
    `<mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell></object>`;
  const xml = (boundaries: string) =>
    `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>` +
    boundaries +
    vertex("process", "a", 0, 0, 100, 100) +
    vertex("process", "b", 400, 0, 100, 100) +
    `<object label="f" type="dataflow" id="f"><mxCell style="endArrow=classic;" edge="1" parent="1" source="a" target="b">` +
    `<mxGeometry relative="1" as="geometry"/></mxCell></object>` +
    `</root></mxGraphModel>`;
  const TWO_ZONES = vertex("trustboundary", "tb1", -20, -20, 160, 160) + vertex("trustboundary", "tb2", 380, -20, 160, 160);
  const ONE_ZONE = vertex("trustboundary", "tb1", -20, -20, 560, 160); // tb1 enlarged over both, tb2 gone

  function run(first: string, second: string) {
    const parse = dfdParser.parse(xml(first));
    for (const e of parse.elements) if (e.type === "TrustBoundary") (e.properties as Any).defaultExposureLevel = "EL3";
    builder.build({ elements: parse.elements, connections: parse.connections, assets: [] });
    const conn = parse.connections.find((c) => c.id === "f")!;
    const before = { ...(conn.properties as Any) };
    // Redrawn: new geometry, the flow keeps its stored properties.
    const next = dfdParser.parse(xml(second));
    for (const e of next.elements) if (e.type === "TrustBoundary") (e.properties as Any).defaultExposureLevel = "EL3";
    builder.build({ elements: next.elements, connections: [conn], assets: [] });
    return { before, after: conn.properties as Any };
  }

  it("both processes end up in one enlarged zone: the derived EL3 is cleared", () => {
    const { before, after } = run(TWO_ZONES, ONE_ZONE);
    expect(before).toMatchObject({ exposureLevel: "EL3", exposureLevelSource: "derived" });
    expect(after.exposureLevel).toBeUndefined();
    expect(after.exposureLevelSource).toBeUndefined();
  });

  it("all boundaries deleted: cleared as well", () => {
    expect(run(TWO_ZONES, "").after.exposureLevel).toBeUndefined();
  });

  it("only one boundary deleted: the flow still crosses the other one — EL3 stays", () => {
    const { after } = run(TWO_ZONES, vertex("trustboundary", "tb1", -20, -20, 160, 160));
    expect(after).toMatchObject({ exposureLevel: "EL3", exposureLevelSource: "derived" });
  });
});
