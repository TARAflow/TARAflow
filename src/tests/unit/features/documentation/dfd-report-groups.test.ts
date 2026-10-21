// Leveled-DFD Phase 7d: the report's threat and risk tables are grouped like
// the app's accordions — Top level, one group per top-level decomposed
// multiprocess, "Not in the DFD" last; every item in exactly one group.
import { describe, it, expect } from "vitest";
import { dfdParser } from "features/dfd/services/dfd-parser";
import { reportGroupsOf, type DfdItemRef } from "features/documentation/utils/dfd-report-groups";
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

const SYS = SYSTEM.replace(
  "</root>",
  node("ee1", "externalentity", "Debugger", "EE-1", 900) + flow("df8", "debug", "DF-8", "ee1", "mp1") + "</root>",
);
const xml = mxfile(SYS, SENSOR, CONTROLLER);
const { elements, connections } = dfdParser.parse(xml, LEVELED_PAGES);
const dfd = { xml, pages: LEVELED_PAGES, elements, connections };

type Item = { id: string; ref?: DfdItemRef };
const ITEMS: Item[] = [
  { id: "sen", ref: { elementId: "sen_p2" } },
  { id: "top", ref: { elementId: "ee1" } },
  { id: "gone", ref: { elementId: "nope" } },
  { id: "ctl", ref: { elementId: "ctl_p5" } },
  { id: "df7", ref: { connectionId: "df7" } },
  { id: "noRef" },
];
const grouped = (lang: "en" | "de" = "en") => reportGroupsOf(dfd, lang, ITEMS, (i) => i.ref)!;

describe("reportGroupsOf", () => {
  it("groups like the app: Top level, the multiprocesses in page order, Not in the DFD", () => {
    expect(grouped().map((g) => [g.title, g.items.map((i) => i.id)])).toEqual([
      ["Top level", ["top", "df7"]],
      ["MP-1 Sensor Module", ["sen"]],
      ["MP-2 Controller Module", ["ctl"]],
      ["Not in the DFD", ["gone", "noRef"]],
    ]);
  });

  it("speaks German", () => {
    expect(grouped("de").map((g) => g.title)).toEqual([
      "Oberste Ebene",
      "MP-1 Sensor Module",
      "MP-2 Controller Module",
      "Nicht im DFD",
    ]);
  });

  it("leaves out empty groups", () => {
    const only = reportGroupsOf(dfd, "en", [ITEMS[0]], (i) => i.ref)!;
    expect(only.map((g) => g.title)).toEqual(["MP-1 Sensor Module"]);
  });

  it("is undefined for a classic DFD (flat tables)", () => {
    expect(reportGroupsOf({ xml: fixture.singlePageXml }, "en", ITEMS, (i) => i.ref)).toBeUndefined();
  });
});
