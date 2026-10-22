// Leveled-DFD Phase 5j — data flows analysed on a parent level (design
// §6.5, D4): the flows in state "fallback", for the threats tab banner.
import { describe, it, expect } from "vitest";
import { dfdParser } from "features/dfd/services/dfd-parser";
import { parentLevelFlowsOf } from "features/dfd";
import type { DFDPage } from "features/dfd/models/dfd-types";
import {
  CONTROLLER,
  LEVELED_PAGES,
  SENSOR,
  SYSTEM,
  mxfile,
  node,
  page,
} from "../../../../../fixtures/leveled-dfd-xml";

const source = (xml: string, pages: DFDPage[] = LEVELED_PAGES) => {
  const { elements, connections } = dfdParser.parse(xml, pages);
  return { xml, pages, elements, connections, assets: [] };
};

describe("parentLevelFlowsOf", () => {
  it("is empty while every flow resolves to parts", () => {
    expect(parentLevelFlowsOf(source(mxfile(SYSTEM, SENSOR, CONTROLLER)))).toEqual([]);
  });

  it("lists a flow not drawn below a decomposed multiprocess", () => {
    // The controller page has a part of its own (MP-2 is decomposed) but
    // does not draw DF-7: its target stays MP-2 (D4).
    const ctl = page(
      "ctl",
      "Controller Module",
      node("ctl_p5", "process", "Evaluate Alarm", "P-5", 300),
    );
    expect(parentLevelFlowsOf(source(mxfile(SYSTEM, SENSOR, ctl)))).toEqual([
      {
        tfId: "df7",
        label: "DF-7 stream sensor data",
        from: "P-2 Sample Smoke Sensor",
        to: "MP-2 Controller Module",
        reason: "unresolved",
      },
    ]);
  });

  it("is empty for a classic DFD", () => {
    const xml = mxfile(page("p1", "Page-1", node("a", "process", "A", "P-1", 10)));
    expect(parentLevelFlowsOf(source(xml, []))).toEqual([]);
  });
});
