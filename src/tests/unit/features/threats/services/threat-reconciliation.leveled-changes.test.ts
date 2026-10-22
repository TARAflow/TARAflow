// Leveled DFD §10, reconciliation table — the model changes besides "leaf
// MP gets decomposed" (threat-reconciliation.leveled.test.ts):
//   decomposition undone · flow split into parent + refining flow ·
//   definition moved to another page · definition deleted, copies dangling.
// Ratings are never transferred; what the reconciliation reports per case is
// what the table in the design document promises.
import { describe, expect, it } from "vitest";
import { dfdParser } from "features/dfd/services/dfd-parser";
import { buildDfdGraph } from "features/dfd/services/build-dfd-graph";
import { DFDGraphAnalysisContext } from "features/dfd/adapters/dfd-graph-analysis-context";
import { makeDefinition } from "features/dfd/services/leveled/identity-links";
import type { DFDConnection, DFDPage } from "features/dfd/models/dfd-types";
import { toReferenceGraph } from "app/utils/to-reference-graph";
import { elementThreatGenerator } from "features/threats/services/per-element/element-generator";
import { interactionThreatGenerator } from "features/threats/services/per-interaction/interaction-generator";
import { reconcileForProject, type ThreatReconciliation } from "features/threats/services/threat-reconciliation";
import type { ThreatConfiguration, ThreatProjectData, ThreatTable } from "features/threats/models/threat-types";
import {
  CONTROLLER,
  LEVELED_PAGES,
  SENSOR,
  SYSTEM,
  flow,
  mxfile,
  node,
  page,
  ref,
} from "../../../../fixtures/leveled-dfd-xml";

type Method = "per-element" | "per-interaction";

/** A trust boundary; per interaction, only flows crossing one get threats. */
const boundary = (id: string, x: number, width: number) =>
  `<object label="Board [${id}]" type="trustboundary" id="${id}">` +
  `<mxCell style="rounded=0;dashed=1;" vertex="1" parent="1">` +
  `<mxGeometry x="${x}" y="0" width="${width}" height="120" as="geometry"/></mxCell></object>`;
// The Controller page with P-5 inside a boundary: DF-7 crosses it.
const CONTROLLER_TB = CONTROLLER.replace("</root>", boundary("cb", 250, 250) + "</root>");
const configOf = (method: Method) =>
  ({ activeMethod: method, forceClassicMode: false }) as unknown as ThreatConfiguration;

/** A project of the DFD; `props` adds properties to flow records (refines). */
function projectOf(
  xml: string,
  pages: DFDPage[],
  method: Method,
  threats: ThreatTable[] | null = null,
  props: Record<string, Record<string, unknown>> = {},
) {
  const parsed = dfdParser.parse(xml, pages);
  const connections = parsed.connections.map((c) =>
    props[c.id] ? ({ ...c, properties: { ...c.properties, ...props[c.id] } } as DFDConnection) : c,
  );
  const graph = buildDfdGraph({ xml, pages, elements: parsed.elements, connections, assets: [] });
  const tables = method === "per-element" ? { perElementTables: threats } : { perInteractionTables: threats };
  const project = {
    threats: threats ? { configuration: configOf(method), ...tables } : null,
    dfdGraph: toReferenceGraph(graph),
    assetDataRef: { assets: [] },
  } as unknown as ThreatProjectData;
  return { project, context: new DFDGraphAnalysisContext(graph), parsed };
}

const generate = (p: ReturnType<typeof projectOf>, method: Method) =>
  method === "per-element"
    ? elementThreatGenerator.generateThreatsForProject(p.project, configOf(method))
    : interactionThreatGenerator.generateThreatsForProject(p.project, p.context, configOf(method));

/** Regenerate after the change; what would happen to the stored threats. */
function reconcile(
  before: ReturnType<typeof projectOf>,
  after: (stored: ThreatTable[]) => ReturnType<typeof projectOf>,
  method: Method,
): ThreatReconciliation {
  const stored = generate(before, method);
  return reconcileForProject(after(stored).project, after(stored).context, configOf(method), method);
}

const elementsOf = (list: ThreatReconciliation["added"]) => [
  ...new Set(list.map((x) => x.threat.linkedElement?.elementId ?? x.threat.dataFlow?.connectionId)),
];

describe("decomposition undone (child page deleted)", () => {
  // Before: MP-1 detailed on the Sensor page (P-2). After: the page is gone.
  const before = (m: Method) => projectOf(mxfile(SYSTEM, SENSOR, CONTROLLER_TB), LEVELED_PAGES, m);
  const pagesAfter = LEVELED_PAGES.filter((p) => p.pageId !== "sen");
  const after = (m: Method) => (stored: ThreatTable[]) =>
    projectOf(mxfile(SYSTEM, CONTROLLER_TB), pagesAfter, m, stored);

  it("per element: the parts' threats are obsolete, the multiprocess' are new", () => {
    const r = reconcile(before("per-element"), after("per-element"), "per-element");
    expect(elementsOf(r.obsolete)).toContain("sen_p2");
    expect(elementsOf(r.added)).toContain("mp1");
    expect(elementsOf(r.obsolete)).not.toContain("df7");
  });

  it("per interaction: the flow keeps its threats, flagged as endpoint changed", () => {
    const r = reconcile(before("per-interaction"), after("per-interaction"), "per-interaction");
    const df7 = r.changed.filter((x) => x.threat.dataFlow?.connectionId === "df7");
    expect(df7.length).toBeGreaterThan(0);
    expect(df7.every((x) => x.reasons?.includes("endpoint"))).toBe(true);
    expect(elementsOf(r.obsolete)).not.toContain("df7");
  });
});

describe("flow split into a parent and a refining flow", () => {
  // Top: EE e --f1--> MP m. Page m: copy of e, processes p and q inside a
  // boundary, f1 drawn e -> p (copy). After: f2 e -> q is drawn on page m
  // and refines f1.
  const cell = (type: string, id: string, x: number, label = id) =>
    `<object label="${label}" type="${type}" id="${id}"><mxCell style="ellipse;" vertex="1" parent="1">` +
    `<mxGeometry x="${x}" y="10" width="80" height="80" as="geometry"/></mxCell></object>`;
  const edge = (id: string, from: string, to: string, label = id) =>
    `<object label="${label}" type="DataFlow" id="${id}"><mxCell style="endArrow=classic;" edge="1" parent="1" ` +
    `source="${from}" target="${to}"><mxGeometry relative="1" as="geometry"/></mxCell></object>`;
  const top = page(
    "top",
    "Top",
    cell("ExternalEntity", "e", 10) + cell("Multiprocess", "m", 300) + edge("f1", "e", "m"),
  );
  const pm = (extra = "") =>
    page(
      "pm",
      "m",
      boundary("pb", 250, 350) + cell("ExternalEntity", "pm_e", 10, "e") + cell("Process", "p", 300) +
        cell("Process", "q", 450) + edge("pm_f1", "pm_e", "p", "f1") + extra,
    );
  const pages: DFDPage[] = [
    { pageId: "top", name: "Top", order: 0 },
    { pageId: "pm", name: "m", order: 0, decomposes: "m", links: [ref("pm_e", "e"), ref("pm_f1", "f1")] },
  ];

  it("keeps the parent's threats and generates the refining flow's as new", () => {
    const r = reconcile(
      projectOf(`<mxfile>${top}${pm()}</mxfile>`, pages, "per-interaction"),
      (stored) =>
        projectOf(`<mxfile>${top}${pm(edge("f2", "pm_e", "q"))}</mxfile>`, pages, "per-interaction", stored, {
          f2: { refines: "f1" },
        }),
      "per-interaction",
    );
    expect(elementsOf(r.added)).toEqual(["f2"]);
    expect(elementsOf([...r.unchanged, ...r.changed])).toContain("f1");
    expect(r.obsolete).toEqual([]);
  });
});

describe("definition of an element moved, or deleted with its copies left", () => {
  // An external entity on the System page (definition) with a context copy
  // on the Sensor page.
  const sysWithEe = SYSTEM.replace("</root>", node("ee", "externalentity", "Debugger", "EE-1", 900) + "</root>");
  const senWithCopy = SENSOR.replace("</root>", node("sen_ee", "externalentity", "Debugger", "EE-1", 700) + "</root>");
  const pagesWithCopy = LEVELED_PAGES.map((p) =>
    p.pageId === "sen" ? { ...p, links: [...(p.links ?? []), ref("sen_ee", "ee")] } : p,
  );
  const before = () => projectOf(mxfile(sysWithEe, senWithCopy, CONTROLLER), pagesWithCopy, "per-element");

  it("moved to another page: unchanged — the effective boundaries stay the same", () => {
    const b = before();
    const moved = makeDefinition(pagesWithCopy, b.parsed.occurrences, { pageId: "sen", cellId: "sen_ee" });
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    const r = reconcile(
      b,
      (stored) => projectOf(mxfile(sysWithEe, senWithCopy, CONTROLLER), moved.pages, "per-element", stored),
      "per-element",
    );
    const ee = (list: ThreatReconciliation["added"]) => list.filter((x) => x.threat.linkedElement?.elementId === "ee");
    expect(ee(r.unchanged).length).toBeGreaterThan(0);
    expect([...ee(r.added), ...ee(r.changed), ...ee(r.obsolete)]).toEqual([]);
  });

  it("deleted with a copy left: the element's threats are kept (dangling, analysed from the copy)", () => {
    const r = reconcile(
      before(),
      (stored) => projectOf(mxfile(SYSTEM, senWithCopy, CONTROLLER), pagesWithCopy, "per-element", stored),
      "per-element",
    );
    const ee = (list: ThreatReconciliation["added"]) => list.filter((x) => x.threat.linkedElement?.elementId === "ee");
    expect([...ee(r.unchanged), ...ee(r.changed)].length).toBeGreaterThan(0);
    expect(ee(r.obsolete)).toEqual([]);
  });
});
