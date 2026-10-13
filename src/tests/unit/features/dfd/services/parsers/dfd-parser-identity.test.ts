// Leveled-DFD Phase 1.2 — logical identity across pages (design §5.2, §16).
//
// Hand-built leveled Smoke Detector excerpt (design §3):
//   System            MP-1 Sensor Module, MP-2 Controller Module, DF-7 MP-1 → MP-2
//   Sensor Module     P-2 (new), MP-2 (ref), DF-7 (ref) P-2 → MP-2
//   Controller Module MP-1 (ref), P-5 (new), DF-7 (ref) MP-1 → P-5
import { describe, it, expect } from "vitest";
import { dfdParser } from "features/dfd/services/dfd-parser";

const geometry = (x: number) =>
  `<mxGeometry x="${x}" y="10" width="120" height="60" as="geometry"/>`;

const node = (
  id: string,
  type: string,
  label: string,
  displayId: string,
  x: number,
  identity = "",
) =>
  `<object label="${label}" type="${type}" id="${id}" ${identity}>
     <mxCell style="ellipse;" vertex="1" parent="1">${geometry(x)}</mxCell>
   </object>
   <object label="${displayId}" type="idlabel" id="${id}_id">
     <mxCell connectable="0" parent="${id}" vertex="1">
       <mxGeometry width="35" height="18" relative="1" as="geometry"/>
     </mxCell>
   </object>`;

const flow = (
  id: string,
  label: string,
  displayId: string,
  source: string,
  target: string,
  identity = "",
) =>
  `<object label="${label}" type="dataflow" id="${id}" ${identity}>
     <mxCell style="endArrow=classic;" edge="1" parent="1" source="${source}" target="${target}">
       <mxGeometry relative="1" as="geometry"/>
     </mxCell>
   </object>
   <object label="${displayId}" type="idlabel" id="${id}_id">
     <mxCell connectable="0" parent="${id}" vertex="1">
       <mxGeometry width="35" height="18" relative="1" as="geometry"/>
     </mxCell>
   </object>`;

const page = (id: string, name: string, cells: string) =>
  `<diagram id="${id}" name="${name}"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells}</root></mxGraphModel></diagram>`;

const ref = (tfId: string) => `tfRole="ref" tfId="${tfId}"`;

const SYSTEM = page(
  "sys",
  "System",
  node("mp1", "multiprocess", "Sensor Module", "MP-1", 10) +
    node("mp2", "multiprocess", "Controller Module", "MP-2", 300) +
    flow("df7", "stream sensor data", "DF-7", "mp1", "mp2"),
);
const SENSOR = page(
  "sen",
  "Sensor Module",
  node("sen_p2", "process", "Sample Smoke Sensor", "P-2", 10) +
    node(
      "sen_mp2",
      "multiprocess",
      "Controller Module",
      "MP-2",
      500,
      ref("mp2"),
    ) +
    flow(
      "sen_df7",
      "stream sensor data",
      "DF-7",
      "sen_p2",
      "sen_mp2",
      ref("df7"),
    ),
);
const CONTROLLER = page(
  "ctl",
  "Controller Module",
  node("ctl_mp1", "multiprocess", "Sensor Module", "MP-1", 10, ref("mp1")) +
    node("ctl_p5", "process", "Evaluate Alarm", "P-5", 300) +
    flow(
      "ctl_df7",
      "stream sensor data",
      "DF-7",
      "ctl_mp1",
      "ctl_p5",
      ref("df7"),
    ),
);

const mxfile = (...pages: string[]) => `<mxfile>${pages.join("")}</mxfile>`;

describe("logical identity across pages", () => {
  const result = dfdParser.parse(mxfile(SYSTEM, SENSOR, CONTROLLER));

  it("merges context copies into one logical element per tfId", () => {
    expect(result.elements.map((e) => [e.id, e.displayId, e.name])).toEqual([
      ["mp1", "MP-1", "Sensor Module"],
      ["mp2", "MP-2", "Controller Module"],
      ["sen_p2", "P-2", "Sample Smoke Sensor"],
      ["ctl_p5", "P-5", "Evaluate Alarm"],
    ]);
  });

  it("takes the logical record from the definition, not from a copy", () => {
    const mp2 = result.elements.find((e) => e.id === "mp2")!;
    expect(mp2.position).toEqual({ x: 300, y: 10 }); // System page, not x=500
  });

  it("keeps one logical flow whose record is the definition's", () => {
    expect(
      result.connections.map((c) => [c.id, c.displayId, c.from, c.to]),
    ).toEqual([["df7", "DF-7", "mp1", "mp2"]]);
  });

  it("records every occurrence with its page-local endpoints resolved to tfIds", () => {
    const flows = result.occurrences.filter((o) => o.kind === "connection");
    expect(
      flows.map((o) => [
        o.pageId,
        o.cellId,
        o.tfId,
        o.role,
        o.sourceTfId,
        o.targetTfId,
      ]),
    ).toEqual([
      ["sys", "df7", "df7", "definition", "mp1", "mp2"],
      ["sen", "sen_df7", "df7", "ref", "sen_p2", "mp2"],
      ["ctl", "ctl_df7", "df7", "ref", "mp1", "ctl_p5"],
    ]);
  });

  it("records element occurrences per page with their role", () => {
    const nodes = result.occurrences.filter((o) => o.kind === "element");
    expect(nodes.map((o) => [o.pageId, o.cellId, o.tfId, o.role])).toEqual([
      ["sys", "mp1", "mp1", "definition"],
      ["sys", "mp2", "mp2", "definition"],
      ["sen", "sen_p2", "sen_p2", "definition"],
      ["sen", "sen_mp2", "mp2", "ref"],
      ["ctl", "ctl_mp1", "mp1", "ref"],
      ["ctl", "ctl_p5", "ctl_p5", "definition"],
    ]);
  });

  it("counts logical elements and flows, not occurrences", () => {
    expect(result.stats.multiprocesses).toBe(2);
    expect(result.stats.processes).toBe(2);
    expect(result.stats.dataFlows).toBe(1);
  });
});

describe("page order does not decide the record", () => {
  it("a definition on a later page wins over an earlier copy", () => {
    const result = dfdParser.parse(mxfile(SENSOR, SYSTEM));
    const mp2 = result.elements.find((e) => e.id === "mp2")!;
    expect(mp2.position).toEqual({ x: 300, y: 10 });
    expect(result.connections.map((c) => [c.id, c.from, c.to])).toEqual([
      ["df7", "mp1", "mp2"],
    ]);
  });
});

describe("explicit tfId on a definition (after move / adoption)", () => {
  it("uses the tfId as identity and resolves endpoints to it", () => {
    const xml = mxfile(
      page(
        "sys",
        "System",
        node(
          "cell_a",
          "multiprocess",
          "Sensor Module",
          "MP-1",
          10,
          'tfId="mp1"',
        ) +
          node("mp2", "multiprocess", "Controller Module", "MP-2", 300) +
          flow("df7", "stream sensor data", "DF-7", "cell_a", "mp2"),
      ),
    );
    const result = dfdParser.parse(xml);
    expect(result.elements.map((e) => e.id)).toEqual(["mp1", "mp2"]);
    expect(result.connections[0]).toMatchObject({
      id: "df7",
      from: "mp1",
      to: "mp2",
    });
    expect(result.occurrences[0]).toMatchObject({
      cellId: "cell_a",
      tfId: "mp1",
      role: "definition",
    });
  });
});

describe("context copy without definition (dangling, design §5.2.1)", () => {
  it("keeps the logical element from the copy — never dropped", () => {
    const result = dfdParser.parse(mxfile(SENSOR));
    expect(result.elements.map((e) => [e.id, e.displayId])).toEqual([
      ["sen_p2", "P-2"],
      ["mp2", "MP-2"],
    ]);
    expect(result.connections.map((c) => [c.id, c.from, c.to])).toEqual([
      ["df7", "sen_p2", "mp2"],
    ]);
    expect(result.occurrences.every((o) => o.pageId === "sen")).toBe(true);
  });
});

describe("single page without identity attributes", () => {
  it("is unchanged: tfId = cell id, every occurrence a definition", () => {
    const result = dfdParser.parse(mxfile(SYSTEM));
    expect(result.elements.map((e) => e.id)).toEqual(["mp1", "mp2"]);
    expect(result.connections.map((c) => [c.id, c.from, c.to])).toEqual([
      ["df7", "mp1", "mp2"],
    ]);
    expect(
      result.occurrences.every(
        (o) => o.role === "definition" && o.tfId === o.cellId,
      ),
    ).toBe(true);
  });
});
