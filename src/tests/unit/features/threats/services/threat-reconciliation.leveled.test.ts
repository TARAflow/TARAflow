// Leveled DFD Phase 6e (§10, model change "Leaf MP gets decomposed"): the
// multiprocess' own per-element threats become obsolete, its new parts are
// new, the flow between the two multiprocesses keeps its threats.
import { describe, expect, it } from "vitest";
import { dfdParser } from "features/dfd/services/dfd-parser";
import { buildDfdGraph } from "features/dfd/services/build-dfd-graph";
import { DFDGraphAnalysisContext } from "features/dfd/adapters/dfd-graph-analysis-context";
import type { DFDPage } from "features/dfd/models/dfd-types";
import { toReferenceGraph } from "app/utils/to-reference-graph";
import { elementThreatGenerator } from "features/threats/services/per-element/element-generator";
import { reconcileForProject } from "features/threats/services/threat-reconciliation";
import type { ThreatConfiguration, ThreatProjectData, ThreatTable } from "features/threats/models/threat-types";
import { CONTROLLER, LEVELED_PAGES, SENSOR, SYSTEM, mxfile } from "../../../../fixtures/leveled-dfd-xml";

const CONFIG = { activeMethod: "per-element", forceClassicMode: false } as unknown as ThreatConfiguration;

function projectOf(xml: string, pages: DFDPage[], threats: ThreatTable[] | null = null) {
  const { elements, connections } = dfdParser.parse(xml, pages);
  const graph = buildDfdGraph({ xml, pages, elements, connections, assets: [] });
  const project = {
    threats: threats ? { configuration: CONFIG, perElementTables: threats } : null,
    dfdGraph: toReferenceGraph(graph),
    assetDataRef: { assets: [] },
  } as unknown as ThreatProjectData;
  return { project, context: new DFDGraphAnalysisContext(graph) };
}

describe("reconciliation when a multiprocess gets decomposed", () => {
  // Before: MP-1 has no child page yet (a leaf); MP-2 is decomposed.
  const pagesBefore = LEVELED_PAGES.filter((p) => p.pageId !== "sen");
  const before = projectOf(mxfile(SYSTEM, CONTROLLER), pagesBefore);
  const stored = elementThreatGenerator.generateThreatsForProject(before.project, CONFIG);
  // After: MP-1 is detailed on the Sensor page (P-2).
  const after = projectOf(mxfile(SYSTEM, SENSOR, CONTROLLER), LEVELED_PAGES, stored);
  const r = reconcileForProject(after.project, after.context, CONFIG, "per-element");
  const ids = (list: typeof r.added) => [...new Set(list.map((x) => x.threat.linkedElement?.elementId))];

  it("makes the multiprocess' own threats obsolete", () => {
    expect(ids(r.obsolete)).toEqual(["mp1"]);
  });

  it("generates the new part as new", () => {
    expect(ids(r.added)).toContain("sen_p2");
  });

  it("keeps the threats of the flow between the multiprocesses", () => {
    expect(ids([...r.unchanged, ...r.changed])).toContain("df7");
    expect(ids(r.obsolete)).not.toContain("df7");
  });
});
