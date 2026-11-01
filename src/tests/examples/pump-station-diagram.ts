// src/tests/examples/pump-station-diagram.ts
//
// The draw.io diagram of the "Pump Station Controller" example (IEC 62443-4-2 /
// CRA, iec-62443-4-2-cra-coverage.md IEC-10): plain draw.io XML with the
// styles the TARAflow shape library uses, laid out on one page. The project
// generator (pump-station-example.ts) lets the app's own DFD parser turn it
// into elements and flows, so diagram and records cannot drift apart.
//
//   left        Operator, Maintenance Technician, Debug Probe — each a straight
//               flow through its interface on the cabinet's left border
//   centre      Control Network [CN] ⊃ Control Cabinet [CAB]: HMI Runtime,
//               Pump Controller (PLC), Recipes & Configuration
//   right       Pumps & Valves at the top (fieldbus IF-4), below it SCADA,
//               Update Server, Engineering Workstation, Remote Access Gateway
//               — one straight flow each through IF-3 Ethernet
//
// Flow pairs (HMI ↔ PLC, SCADA ↔ PLC, fieldbus, PLC ↔ store) run as
// parallel lines; anchors and waypoints are explicit, so draw.io draws what
// the interface detection computes (it reads the same anchors and segments).

const STYLE = {
  physicalboundary:
    "html=1;fontColor=#1B4F8A;fontStyle=1;align=left;verticalAlign=top;spacing=0;fillColor=none;dashed=1;strokeWidth=2;strokeColor=#1B4F8A;spacingLeft=4;spacingTop=-3;connectable=0;dashPattern=12 12;",
  trustboundary:
    "html=1;fontColor=#FF3333;fontStyle=1;align=left;verticalAlign=top;spacing=0;fillColor=none;dashed=1;strokeWidth=2;strokeColor=#FF3333;spacingLeft=4;spacingTop=-3;connectable=0;",
  process: "rounded=1;whiteSpace=wrap;html=1;arcSize=50;",
  multiprocess: "shape=ext;double=1;rounded=1;whiteSpace=wrap;html=1;arcSize=50;margin=1;strokeWidth=2;",
  datastorage: "html=1;dashed=0;whiteSpace=wrap;shape=partialRectangle;right=0;left=0;strokeWidth=3;",
  externalentity: "rounded=0;whiteSpace=wrap;html=1;strokeWidth=1;",
  interface: "whiteSpace=wrap;html=1;dashed=1;strokeWidth=2;",
  // White label background: the line does not run through the text.
  dataflow: "endArrow=classic;html=1;rounded=0;labelBackgroundColor=#ffffff;",
  // As in the shape library: sizes horizontally to the id (autosize, no wrap).
  idlabel: "rounded=0;html=1;strokeColor=#0000CC;fillColor=none;autosize=1;",
} as const;

type ShapeType = Exclude<keyof typeof STYLE, "dataflow" | "idlabel">;

export interface Shape {
  id: string;
  displayId: string;
  type: ShapeType;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Edge {
  id: string;
  displayId: string;
  label: string;
  from: string;
  to: string;
  /** Anchors on the source / target shape (draw.io exitX/Y, entryX/Y; 0 … 1). */
  exit: [number, number];
  entry: [number, number];
  /** Bends of an orthogonal route. */
  points?: [number, number][];
  /** Where the label sits along the edge (-1 source … 1 target). */
  labelAt?: number;
  /** Where the id box sits; default: the other half of the edge. */
  idAt?: number;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Width of an id box for its text — the rule of the auto-numbering (fitIdLabelWidth). */
const idWidth = (displayId: string, min: number) => Math.max(min, Math.ceil(displayId.length * 10 * 0.62 + 8));

const idLabel = (owner: string, displayId: string) =>
  `<object label="${esc(`<font style="font-size: 10px">${displayId}</font>`)}" type="idlabel" id="${owner}-lbl">
            <mxCell connectable="0" parent="${owner}" vertex="1" style="${STYLE.idlabel}">
              <mxGeometry height="18" width="${idWidth(displayId, 35)}" relative="1" as="geometry"/>
            </mxCell>
          </object>`;

const shapeXml = (s: Shape) =>
  `<object label="${esc(s.label)}" type="${s.type}" id="${s.id}">
            <mxCell parent="1" vertex="1" style="${STYLE[s.type]}">
              <mxGeometry x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" as="geometry"/>
            </mxCell>
          </object>
          ${s.type.endsWith("boundary") ? "" : idLabel(s.id, s.displayId)}`;

const edgeXml = (e: Edge) => {
  const anchors = `exitX=${e.exit[0]};exitY=${e.exit[1]};exitDx=0;exitDy=0;entryX=${e.entry[0]};entryY=${e.entry[1]};entryDx=0;entryDy=0;`;
  const points = e.points?.length
    ? `<Array as="points">${e.points.map(([x, y]) => `<mxPoint x="${x}" y="${y}"/>`).join("")}</Array>`
    : "";
  const at = e.labelAt ?? 0;
  return `<object label="${esc(e.label)}" type="dataflow" id="${e.id}">
            <mxCell parent="1" edge="1" source="${e.from}" target="${e.to}" style="${STYLE.dataflow}${anchors}">
              <mxGeometry x="${at}" relative="1" as="geometry">${points}</mxGeometry>
            </mxCell>
          </object>
          ${edgeIdLabel(e.id, e.displayId, e.idAt ?? (at === 0 ? -0.6 : -at))}`;
};

/** The id box of a flow, on the other half of the edge than its text. */
const edgeIdLabel = (owner: string, displayId: string, at: number) =>
  `<object label="${esc(`<font style="font-size: 10px">${displayId}</font>`)}" type="idlabel" id="${owner}-lbl">
            <mxCell connectable="0" parent="${owner}" vertex="1" style="${STYLE.idlabel}">
              <mxGeometry x="${at}" height="18" width="${idWidth(displayId, 40)}" relative="1" as="geometry">
                <mxPoint x="${-idWidth(displayId, 40) / 2}" y="-9" as="offset"/>
              </mxGeometry>
            </mxCell>
          </object>`;

// ── Layout ──────────────────────────────────────────────────────────────────

export const SHAPES: Shape[] = [
  // Boundaries first (drawn behind the nodes).
  { id: "tb-cn", displayId: "CN", type: "trustboundary", label: "Control Network [CN]", x: 380, y: 50, w: 790, h: 720 },
  { id: "pb-cab", displayId: "CAB", type: "physicalboundary", label: "Control Cabinet [CAB]", x: 430, y: 100, w: 680, h: 620 },
  // Inside the cabinet.
  { id: "p-hmi", displayId: "P-1", type: "process", label: "HMI Runtime", x: 470, y: 190, w: 140, h: 60 },
  { id: "mp-plc", displayId: "MP-1", type: "multiprocess", label: "Pump Controller (PLC)", x: 780, y: 290, w: 180, h: 280 },
  { id: "ds-cfg", displayId: "DS-1", type: "datastorage", label: "Recipes & Configuration", x: 780, y: 660, w: 180, h: 40 },
  // Interfaces on the cabinet border, where the flows cross it.
  { id: "if-touch", displayId: "IF-1", type: "interface", label: "Touch Panel", x: 412, y: 190, w: 36, h: 60 },
  { id: "if-usb", displayId: "IF-2", type: "interface", label: "Service USB", x: 412, y: 405, w: 36, h: 60 },
  { id: "if-jtag", displayId: "IF-5", type: "interface", label: "JTAG", x: 412, y: 600, w: 36, h: 50 },
  { id: "if-fieldbus", displayId: "IF-4", type: "interface", label: "Fieldbus", x: 1092, y: 105, w: 36, h: 70 },
  { id: "if-eth", displayId: "IF-3", type: "interface", label: "Ethernet", x: 1092, y: 290, w: 36, h: 280 },
  // Left side.
  { id: "ee-op", displayId: "EE-1", type: "externalentity", label: "Operator", x: 20, y: 190, w: 130, h: 60 },
  { id: "ee-maint", displayId: "EE-2", type: "externalentity", label: "Maintenance Technician", x: 20, y: 410, w: 130, h: 50 },
  { id: "ee-dbg", displayId: "EE-8", type: "externalentity", label: "Debug Probe", x: 20, y: 600, w: 130, h: 50 },
  // Right side, top to bottom.
  { id: "ee-field", displayId: "EE-7", type: "externalentity", label: "Pumps & Valves", x: 1380, y: 110, w: 170, h: 60 },
  { id: "ee-scada", displayId: "EE-3", type: "externalentity", label: "Control Room SCADA", x: 1380, y: 300, w: 170, h: 60 },
  { id: "ee-upd", displayId: "EE-4", type: "externalentity", label: "Update Server", x: 1380, y: 390, w: 170, h: 40 },
  { id: "ee-eng", displayId: "EE-6", type: "externalentity", label: "Engineering Workstation", x: 1380, y: 460, w: 170, h: 40 },
  { id: "ee-gw", displayId: "EE-5", type: "externalentity", label: "Remote Access Gateway", x: 1380, y: 530, w: 170, h: 40 },
];

// Anchor helpers: a point on a shape's side as draw.io fractions.
const shape = (id: string) => SHAPES.find((s) => s.id === id)!;
const left = (id: string, y: number): [number, number] => [0, (y - shape(id).y) / shape(id).h];
const right = (id: string, y: number): [number, number] => [1, (y - shape(id).y) / shape(id).h];
const top = (id: string, x: number): [number, number] => [(x - shape(id).x) / shape(id).w, 0];
const bottom = (id: string, x: number): [number, number] => [(x - shape(id).x) / shape(id).w, 1];

export const EDGES: Edge[] = [
  // Left: straight through IF-1, IF-2, IF-5; text between the entity and the cabinet.
  { id: "df-1", displayId: "DF-1", label: "push pump command [cmd]", from: "ee-op", to: "p-hmi",
    exit: right("ee-op", 220), entry: left("p-hmi", 220), labelAt: -0.2, idAt: -0.88 },
  { id: "df-9", displayId: "DF-9", label: "push service command [cmd]", from: "ee-maint", to: "mp-plc",
    exit: right("ee-maint", 435), entry: left("mp-plc", 435), labelAt: -0.55, idAt: 0.6 },
  { id: "df-14", displayId: "DF-14", label: "pull debug session [req_resp]", from: "ee-dbg", to: "if-jtag",
    exit: right("ee-dbg", 625), entry: left("if-jtag", 625), labelAt: 0.12, idAt: -0.88 },
  // HMI ↔ PLC: nested L-routes over the top of the PLC, no crossing.
  { id: "df-2", displayId: "DF-2", label: "push setpoint [cmd]", from: "p-hmi", to: "mp-plc",
    exit: right("p-hmi", 200), entry: top("mp-plc", 880), points: [[880, 200]], labelAt: -0.25, idAt: 0.75 },
  { id: "df-3", displayId: "DF-3", label: "stream process values [stream]", from: "mp-plc", to: "p-hmi",
    exit: top("mp-plc", 840), entry: right("p-hmi", 240), points: [[840, 240]], labelAt: 0.18, idAt: -0.82 },
  // Fieldbus to the pumps at the top right, through IF-4.
  { id: "df-10", displayId: "DF-10", label: "push actuator command [cmd]", from: "mp-plc", to: "ee-field",
    exit: top("mp-plc", 910), entry: left("ee-field", 125), points: [[910, 125]], labelAt: 0.6, idAt: -0.7 },
  { id: "df-11", displayId: "DF-11", label: "stream sensor values [stream]", from: "ee-field", to: "mp-plc",
    exit: left("ee-field", 155), entry: top("mp-plc", 940), points: [[940, 155]], labelAt: -0.56, idAt: 0.8 },
  // Right: one straight line each through IF-3; text between the cabinet and the entity,
  // id box between the PLC and the cabinet wall.
  { id: "df-4", displayId: "DF-4", label: "stream plant values [stream]", from: "mp-plc", to: "ee-scada",
    exit: right("mp-plc", 315), entry: left("ee-scada", 315), labelAt: 0.45, idAt: -0.6 },
  { id: "df-5", displayId: "DF-5", label: "push remote setpoint [cmd]", from: "ee-scada", to: "mp-plc",
    exit: left("ee-scada", 345), entry: right("mp-plc", 345), labelAt: -0.45, idAt: 0.6 },
  { id: "df-6", displayId: "DF-6", label: "push firmware image [cmd]", from: "ee-upd", to: "mp-plc",
    exit: left("ee-upd", 410), entry: right("mp-plc", 410), labelAt: -0.45, idAt: 0.6 },
  { id: "df-7", displayId: "DF-7", label: "push PLC program [cmd]", from: "ee-eng", to: "mp-plc",
    exit: left("ee-eng", 480), entry: right("mp-plc", 480), labelAt: -0.45, idAt: 0.6 },
  { id: "df-8", displayId: "DF-8", label: "push remote service command [cmd]", from: "ee-gw", to: "mp-plc",
    exit: left("ee-gw", 550), entry: right("mp-plc", 550), labelAt: -0.45, idAt: 0.6 },
  // PLC ↔ store: two parallel vertical lines, texts at different heights.
  { id: "df-12", displayId: "DF-12", label: "write recipes", from: "mp-plc", to: "ds-cfg",
    exit: bottom("mp-plc", 830), entry: top("ds-cfg", 830), labelAt: -0.4, idAt: 0.6 },
  { id: "df-13", displayId: "DF-13", label: "read configuration", from: "ds-cfg", to: "mp-plc",
    exit: top("ds-cfg", 910), entry: bottom("mp-plc", 910), labelAt: -0.4, idAt: 0.6 },
];

export function pumpStationXml(): string {
  const cells = [...SHAPES.map(shapeXml), ...EDGES.map(edgeXml)].join("\n          ");
  return `<mxfile host="embed.diagrams.net">
  <diagram id="pump-station" name="Pump Station">
    <mxGraphModel dx="1400" dy="900" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1654" pageHeight="1169" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
          ${cells}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;
}
