// src/tests/examples/pump-station-diagram.ts
//
// The draw.io diagram of the "Pump Station Controller" example (IEC 62443-4-2 /
// CRA, iec-62443-4-2-cra-coverage.md IEC-10): plain draw.io XML with the
// styles the TARAflow shape library uses, laid out on one page. The project
// generator (pump-station-example.ts) lets the app's own DFD parser turn it
// into elements and flows, so diagram and records cannot drift apart.
//
//   left        Operator, Maintenance Technician, Debug Probe (factory only)
//   centre      Control Network [CN] ⊃ Control Cabinet [CAB]:
//               HMI Runtime, Pump Controller (PLC), Configuration Store,
//               interfaces Touch Panel, Service USB, Ethernet, Fieldbus, JTAG
//   right       Control Room SCADA, Update Server, Engineering Workstation,
//               Remote Access Gateway
//   bottom      Pumps & Valves (field devices)

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
  dataflow: "endArrow=classic;html=1;rounded=0;",
  idlabel: "rounded=0;whiteSpace=wrap;html=1;strokeColor=#0000CC;fillColor=none;",
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
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const idLabel = (owner: string, displayId: string) =>
  `<object label="${esc(`<font style="font-size: 10px">${displayId}</font>`)}" type="idlabel" id="${owner}-lbl">
            <mxCell connectable="0" parent="${owner}" vertex="1" style="${STYLE.idlabel}">
              <mxGeometry height="18" width="40" relative="1" as="geometry"/>
            </mxCell>
          </object>`;

const shapeXml = (s: Shape) =>
  `<object label="${esc(s.label)}" type="${s.type}" id="${s.id}">
            <mxCell parent="1" vertex="1" style="${STYLE[s.type]}">
              <mxGeometry x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" as="geometry"/>
            </mxCell>
          </object>
          ${s.type.endsWith("boundary") ? "" : idLabel(s.id, s.displayId)}`;

const edgeXml = (e: Edge) =>
  `<object label="${esc(e.label)}" type="dataflow" id="${e.id}">
            <mxCell parent="1" edge="1" source="${e.from}" target="${e.to}" style="${STYLE.dataflow}">
              <mxGeometry relative="1" as="geometry"/>
            </mxCell>
          </object>
          ${idLabel(e.id, e.displayId)}`;

// ── Layout ──────────────────────────────────────────────────────────────────

export const SHAPES: Shape[] = [
  // Boundaries first (drawn behind the nodes).
  { id: "tb-cn", displayId: "CN", type: "trustboundary", label: "Control Network [CN]", x: 330, y: 70, w: 740, h: 680 },
  { id: "pb-cab", displayId: "CAB", type: "physicalboundary", label: "Control Cabinet [CAB]", x: 380, y: 120, w: 640, h: 560 },
  // Inside the cabinet.
  { id: "p-hmi", displayId: "P-1", type: "process", label: "HMI Runtime", x: 430, y: 170, w: 130, h: 50 },
  { id: "mp-plc", displayId: "MP-1", type: "multiprocess", label: "Pump Controller (PLC)", x: 600, y: 330, w: 170, h: 80 },
  { id: "ds-cfg", displayId: "DS-1", type: "datastorage", label: "Recipes & Configuration", x: 610, y: 560, w: 150, h: 40 },
  // Interfaces on the cabinet border, where the flows cross it.
  { id: "if-touch", displayId: "IF-1", type: "interface", label: "Touch Panel", x: 362, y: 168, w: 36, h: 56 },
  { id: "if-usb", displayId: "IF-2", type: "interface", label: "Service USB", x: 362, y: 340, w: 36, h: 60 },
  { id: "if-eth", displayId: "IF-3", type: "interface", label: "Ethernet", x: 1002, y: 270, w: 36, h: 200 },
  { id: "if-fieldbus", displayId: "IF-4", type: "interface", label: "Fieldbus", x: 640, y: 662, w: 70, h: 36 },
  { id: "if-jtag", displayId: "IF-5", type: "interface", label: "JTAG", x: 470, y: 600, w: 60, h: 40 },
  // Left side.
  { id: "ee-op", displayId: "EE-1", type: "externalentity", label: "Operator", x: 110, y: 170, w: 120, h: 50 },
  { id: "ee-maint", displayId: "EE-2", type: "externalentity", label: "Maintenance Technician", x: 90, y: 345, w: 140, h: 50 },
  { id: "ee-dbg", displayId: "EE-8", type: "externalentity", label: "Debug Probe", x: 110, y: 690, w: 120, h: 50 },
  // Right side.
  { id: "ee-scada", displayId: "EE-3", type: "externalentity", label: "Control Room SCADA", x: 1200, y: 190, w: 150, h: 50 },
  { id: "ee-upd", displayId: "EE-4", type: "externalentity", label: "Update Server", x: 1200, y: 290, w: 150, h: 50 },
  { id: "ee-eng", displayId: "EE-6", type: "externalentity", label: "Engineering Workstation", x: 1200, y: 390, w: 150, h: 50 },
  { id: "ee-gw", displayId: "EE-5", type: "externalentity", label: "Remote Access Gateway", x: 1200, y: 490, w: 150, h: 50 },
  // Bottom.
  { id: "ee-field", displayId: "EE-7", type: "externalentity", label: "Pumps & Valves", x: 610, y: 820, w: 150, h: 50 },
];

export const EDGES: Edge[] = [
  { id: "df-1", displayId: "DF-1", label: "push pump command [cmd]", from: "ee-op", to: "p-hmi" },
  { id: "df-2", displayId: "DF-2", label: "push setpoint [cmd]", from: "p-hmi", to: "mp-plc" },
  { id: "df-3", displayId: "DF-3", label: "stream process values [stream]", from: "mp-plc", to: "p-hmi" },
  { id: "df-4", displayId: "DF-4", label: "stream plant values [stream]", from: "mp-plc", to: "ee-scada" },
  { id: "df-5", displayId: "DF-5", label: "push remote setpoint [cmd]", from: "ee-scada", to: "mp-plc" },
  { id: "df-6", displayId: "DF-6", label: "push firmware image [cmd]", from: "ee-upd", to: "mp-plc" },
  { id: "df-7", displayId: "DF-7", label: "push PLC program [cmd]", from: "ee-eng", to: "mp-plc" },
  { id: "df-8", displayId: "DF-8", label: "push remote service command [cmd]", from: "ee-gw", to: "mp-plc" },
  { id: "df-9", displayId: "DF-9", label: "push service command [cmd]", from: "ee-maint", to: "mp-plc" },
  { id: "df-10", displayId: "DF-10", label: "push actuator command [cmd]", from: "mp-plc", to: "ee-field" },
  { id: "df-11", displayId: "DF-11", label: "stream sensor values [stream]", from: "ee-field", to: "mp-plc" },
  { id: "df-12", displayId: "DF-12", label: "write recipes", from: "mp-plc", to: "ds-cfg" },
  { id: "df-13", displayId: "DF-13", label: "read configuration", from: "ds-cfg", to: "mp-plc" },
  { id: "df-14", displayId: "DF-14", label: "pull debug session [req_resp]", from: "ee-dbg", to: "if-jtag" },
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
