// Review finding 1: one parse and one effective model per DFD state. Every
// consumer — the save path, the validator, the table groups, the
// parent-level flows, the asset roll-up — shares them; a change of an
// ordinary property neither parses again nor rebuilds the model.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DFDParser, dfdParser } from "features/dfd/services/dfd-parser";
import { buildAnalysisView } from "features/dfd/services/build-dfd-graph";
import {
  analyseLeveled,
  clearLeveledAnalysisCache,
  parseDfd,
} from "features/dfd/services/leveled/leveled-analysis";
import { multiprocessGroupsOf } from "features/dfd/services/leveled/table-groups";
import { parentLevelFlowsOf } from "features/dfd/services/leveled/parent-level-flows";
import { assetRollupsOfSource } from "features/dfd/services/leveled/asset-rollup";
import { dfdService } from "features/dfd/services/dfd-service";
import type { DFDConnection, DFDElement, DFDPage, DFDProjectData } from "features/dfd/models/dfd-types";
import { CONTROLLER, LEVELED_PAGES, SENSOR, SYSTEM, mxfile } from "../../../../../fixtures/leveled-dfd-xml";

const XML = mxfile(SYSTEM, SENSOR, CONTROLLER);

function sourceOf(pages: DFDPage[] = LEVELED_PAGES) {
  const { elements, connections } = dfdParser.parse(XML, pages);
  return { xml: XML, pages, elements, connections, assets: [] };
}

describe("shared leveled analysis", () => {
  let parseSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    clearLeveledAnalysisCache();
    parseSpy = vi.spyOn(DFDParser.prototype, "parse");
  });
  afterEach(() => parseSpy.mockRestore());

  it("parses a DFD state once for all consumers", () => {
    const source = sourceOf();
    parseSpy.mockClear();
    const analysis = analyseLeveled(source);
    buildAnalysisView(source);
    multiprocessGroupsOf(source);
    parentLevelFlowsOf(source);
    assetRollupsOfSource(source);
    expect(parseDfd(XML, LEVELED_PAGES)).toBe(analysis.parse);
    expect(parseSpy).toHaveBeenCalledTimes(1);
  });

  it("keeps parse and model when only an ordinary property changes", () => {
    const source = sourceOf();
    const first = analyseLeveled(source);
    parseSpy.mockClear();
    const edited = {
      ...source,
      elements: source.elements.map((e: DFDElement) =>
        e.id === "sen_p2" ? { ...e, properties: { ...e.properties, description: "changed" } } : e,
      ),
    };
    const second = analyseLeveled(edited);
    expect(parseSpy).not.toHaveBeenCalled();
    expect(second.parse).toBe(first.parse);
    expect(second.model).toBe(first.model);
    // The records are current.
    expect((second.records.elements.get("sen_p2")!.properties as { description?: string }).description).toBe(
      "changed",
    );
  });

  it("does not parse again for a new page thumbnail", () => {
    const source = sourceOf();
    analyseLeveled(source);
    parseSpy.mockClear();
    analyseLeveled({ ...source, pages: source.pages.map((p) => ({ ...p, thumbnail: "data:image/svg+xml,x" })) });
    expect(parseSpy).not.toHaveBeenCalled();
  });

  it("rebuilds the model, not the parse, when a property the model reads changes", () => {
    const source = sourceOf();
    const first = analyseLeveled(source);
    parseSpy.mockClear();
    const excluded = {
      ...source,
      connections: source.connections.map((c: DFDConnection) => ({
        ...c,
        properties: { ...c.properties, excludeFromThreatGen: true },
      })),
    };
    const second = analyseLeveled(excluded);
    expect(parseSpy).not.toHaveBeenCalled();
    expect(second.parse).toBe(first.parse);
    expect(second.model).not.toBe(first.model);
  });
});

describe("save path and the shared parse", () => {
  it("parses the XML of a save once — save path, validation, roll-up and graph share it", () => {
    clearLeveledAnalysisCache();
    const spy = vi.spyOn(DFDParser.prototype, "parse");
    try {
      const project = {
        id: "p",
        name: "count",
        dfd: { xml: XML, elements: [], connections: [], assets: [], pages: LEVELED_PAGES },
        phaseStatus: {},
        settings: {},
        lastModified: "",
      } as unknown as DFDProjectData;
      const first = dfdService.saveDFDFromXml(project, XML);
      expect(spy).toHaveBeenCalledTimes(1);
      // Saved again without a change of the drawing: no parse at all.
      dfdService.saveDFDFromXml({ ...project, dfd: first.dfd } as DFDProjectData, XML);
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  it("gives every record its own properties — later steps write into them", () => {
    clearLeveledAnalysisCache();
    const project = {
      id: "p",
      name: "shared-parse",
      dfd: { xml: XML, elements: [], connections: [], assets: [], pages: LEVELED_PAGES },
      phaseStatus: {},
      settings: { autoSave: true, autoSaveInterval: 2 },
      lastModified: "",
    } as unknown as DFDProjectData;
    const result = dfdService.saveDFDFromXml(project, XML);
    expect(result.success).toBe(true);
    const shared = parseDfd(XML, result.dfd.pages);
    for (const e of result.dfd.elements) {
      const parsed = shared.elements.find((p) => p.id === e.id);
      expect(e).not.toBe(parsed);
      if (parsed?.properties) expect(e.properties).not.toBe(parsed.properties);
    }
  });
});
