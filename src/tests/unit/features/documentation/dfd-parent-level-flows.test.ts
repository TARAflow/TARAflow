// Leveled-DFD Phase 7c: the report lists the data flows analysed on a parent
// level — their threats are provisional — with the reason, as the threats
// tab's banner does.
import { describe, it, expect } from "vitest";
import { dfdParser } from "features/dfd/services/dfd-parser";
import { dfdParentLevelFlowsOf } from "features/documentation/utils/dfd-parent-level-flows";
import {
  CONTROLLER,
  LEVELED_PAGES,
  SENSOR,
  SYSTEM,
  flow,
  mxfile,
  node,
} from "../../../fixtures/leveled-dfd-xml";
import fixture from "../../../fixtures/leveled/smoke-detector-leveled.json";
import type { DFDConnection, DFDElement, DFDPage } from "features/dfd/models/dfd-types";

// Top additionally holds EE-1 → MP-1 (DF-8), not drawn below MP-1.
const SYS = SYSTEM.replace(
  "</root>",
  node("ee1", "externalentity", "Debugger", "EE-1", 900) + flow("df8", "debug", "DF-8", "ee1", "mp1") + "</root>",
);
const dfdOf = (xml: string) => {
  const { elements, connections } = dfdParser.parse(xml, LEVELED_PAGES);
  return { xml, pages: LEVELED_PAGES, elements, connections };
};

describe("dfdParentLevelFlowsOf", () => {
  it("lists each flow analysed on a parent level with its endpoints and reason", () => {
    const report = dfdParentLevelFlowsOf(dfdOf(mxfile(SYS, SENSOR, CONTROLLER)), "en")!;
    expect(report.title).toBe("Data flows analysed on a parent level");
    expect(report.rows).toEqual([
      {
        flow: "DF-8 debug",
        from: "EE-1 Debugger",
        to: "MP-1 Sensor Module",
        reason: "not drawn on the child page of the multiprocess",
      },
    ]);
  });

  it("speaks German", () => {
    const report = dfdParentLevelFlowsOf(dfdOf(mxfile(SYS, SENSOR, CONTROLLER)), "de")!;
    expect(report.title).toBe("Auf Elternebene analysierte Datenflüsse");
    expect(report.rows[0].reason).toBe("nicht auf der Unterseite des Multiprozesses gezeichnet");
  });

  it("is undefined when every flow is resolved, and for a classic DFD", () => {
    expect(dfdParentLevelFlowsOf(dfdOf(mxfile(SYSTEM, SENSOR, CONTROLLER)), "en")).toBeUndefined();
    expect(
      dfdParentLevelFlowsOf(
        {
          xml: fixture.leveledXml,
          pages: fixture.pages as DFDPage[],
          elements: fixture.leveledElements as unknown as DFDElement[],
          connections: fixture.connections as unknown as DFDConnection[],
        },
        "en",
      ),
    ).toBeUndefined();
    expect(dfdParentLevelFlowsOf({ xml: fixture.singlePageXml }, "en")).toBeUndefined();
  });
});
