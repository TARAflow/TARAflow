// Leveled-DFD test builders (leveled-dfd-multi-diagram-design.md §3, §16).
//
// Hand-built leveled Smoke Detector excerpt — TARAflow's own example, no
// external model:
//   System            MP-1 Sensor Module, MP-2 Controller Module, DF-7 MP-1 → MP-2
//   Sensor Module     P-2 (new), MP-2 (copy), DF-7 (copy) P-2 → MP-2
//   Controller Module MP-1 (copy), P-5 (new), DF-7 (copy) MP-1 → P-5
//
// The XML is plain draw.io. Which cells are context copies is stated by the
// identity links in dfd.pages (LEVELED_PAGES), never by XML attributes.
import type { DFDCellLink, DFDPage } from "features/dfd/models/dfd-types";

const geometry = (x: number) =>
  `<mxGeometry x="${x}" y="10" width="120" height="60" as="geometry"/>`;

export const node = (
  id: string,
  type: string,
  label: string,
  displayId: string,
  x: number,
) =>
  `<object label="${label}" type="${type}" id="${id}">
     <mxCell style="ellipse;" vertex="1" parent="1">${geometry(x)}</mxCell>
   </object>
   <object label="${displayId}" type="idlabel" id="${id}_id">
     <mxCell connectable="0" parent="${id}" vertex="1">
       <mxGeometry width="35" height="18" relative="1" as="geometry"/>
     </mxCell>
   </object>`;

export const flow = (
  id: string,
  label: string,
  displayId: string,
  source: string,
  target: string,
) =>
  `<object label="${label}" type="dataflow" id="${id}">
     <mxCell style="endArrow=classic;" edge="1" parent="1" source="${source}" target="${target}">
       <mxGeometry relative="1" as="geometry"/>
     </mxCell>
   </object>
   <object label="${displayId}" type="idlabel" id="${id}_id">
     <mxCell connectable="0" parent="${id}" vertex="1">
       <mxGeometry width="35" height="18" relative="1" as="geometry"/>
     </mxCell>
   </object>`;

export const page = (id: string, name: string, cells: string) =>
  `<diagram id="${id}" name="${name}"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells}</root></mxGraphModel></diagram>`;

export const mxfile = (...pages: string[]) =>
  `<mxfile>${pages.join("")}</mxfile>`;

export const ref = (cellId: string, tfId: string): DFDCellLink => ({
  cellId,
  tfId,
  role: "ref",
});

export const SYSTEM = page(
  "sys",
  "System",
  node("mp1", "multiprocess", "Sensor Module", "MP-1", 10) +
    node("mp2", "multiprocess", "Controller Module", "MP-2", 300) +
    flow("df7", "stream sensor data", "DF-7", "mp1", "mp2"),
);

export const SENSOR = page(
  "sen",
  "Sensor Module",
  node("sen_p2", "process", "Sample Smoke Sensor", "P-2", 10) +
    node("sen_mp2", "multiprocess", "Controller Module", "MP-2", 500) +
    flow("sen_df7", "stream sensor data", "DF-7", "sen_p2", "sen_mp2"),
);

export const CONTROLLER = page(
  "ctl",
  "Controller Module",
  node("ctl_mp1", "multiprocess", "Sensor Module", "MP-1", 10) +
    node("ctl_p5", "process", "Evaluate Alarm", "P-5", 300) +
    flow("ctl_df7", "stream sensor data", "DF-7", "ctl_mp1", "ctl_p5"),
);

/** dfd.pages of the three pages above, with their identity links. */
export const LEVELED_PAGES: DFDPage[] = [
  { pageId: "sys", name: "System", order: 0 },
  {
    pageId: "sen",
    name: "Sensor Module",
    decomposes: "mp1",
    order: 0,
    links: [ref("sen_mp2", "mp2"), ref("sen_df7", "df7")],
  },
  {
    pageId: "ctl",
    name: "Controller Module",
    decomposes: "mp2",
    order: 1,
    links: [ref("ctl_mp1", "mp1"), ref("ctl_df7", "df7")],
  },
];
