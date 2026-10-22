// Leveled-DFD Phase 1.3 — duplicate definitions (design §5.2, D8):
// paste = new element, never merged; who keeps the tfId is deterministic.
// With page-local identity links the only way to duplicate a tfId is a
// duplicated page that keeps plain cell ids (draw.io "Duplicate page").
import { describe, it, expect } from "vitest";
import { dfdParser } from "features/dfd/services/dfd-parser";
import { findDuplicateDefinitions } from "features/dfd/services/leveled";
import {
  LEVELED_PAGES,
  SENSOR,
  SYSTEM,
  flow,
  mxfile,
  node,
  page,
} from "../../../../../fixtures/leveled-dfd-xml";

const occurrencesOf = (xml: string) => dfdParser.parse(xml).occurrences;
const cells = (list: { pageId: string; cellId: string }[]) =>
  list.map((o) => `${o.pageId}/${o.cellId}`);

// "Duplicate page" in draw.io: same cells, same cell ids, new page id.
const SYSTEM_COPY = page(
  "sys2",
  "System (copy)",
  node("mp1", "multiprocess", "Sensor Module", "MP-1", 10) +
    node("mp2", "multiprocess", "Controller Module", "MP-2", 300) +
    flow("df7", "stream sensor data", "DF-7", "mp1", "mp2"),
);

describe("findDuplicateDefinitions", () => {
  it("finds nothing in a consistent model; context copies never count", () => {
    const pages = LEVELED_PAGES.filter((p) => p.pageId !== "ctl");
    const occurrences = dfdParser.parse(
      mxfile(SYSTEM, SENSOR),
      pages,
    ).occurrences;
    expect(findDuplicateDefinitions(occurrences)).toEqual([]);
  });

  it("a duplicated page: the cells of the saved page keep their identity", () => {
    const previous = occurrencesOf(mxfile(SYSTEM));
    const current = occurrencesOf(mxfile(SYSTEM_COPY, SYSTEM)); // copy placed first
    const duplicates = findDuplicateDefinitions(current, previous);

    expect(duplicates.map((d) => [d.kind, d.tfId])).toEqual([
      ["element", "mp1"],
      ["element", "mp2"],
      ["connection", "df7"],
    ]);
    for (const d of duplicates) {
      expect(cells([d.keep])).toEqual([`sys/${d.tfId}`]);
      expect(cells(d.reassign)).toEqual([`sys2/${d.tfId}`]);
    }
  });

  it("links are page-local: a duplicated page's copies do not take the identity along", () => {
    // Sensor Module duplicated: same cell ids on "sen2", but the links of
    // "sen" do not apply there. Only the plain cell sen_p2 collides; the
    // copied sen_mp2 / sen_df7 are new elements of their own.
    const SENSOR_COPY = SENSOR.replace(
      'id="sen" name="Sensor Module"',
      'id="sen2" name="Sensor Module (copy)"',
    );
    const pages = LEVELED_PAGES.filter((p) => p.pageId !== "ctl");
    const previous = dfdParser.parse(mxfile(SYSTEM, SENSOR), pages).occurrences;
    const current = dfdParser.parse(
      mxfile(SYSTEM, SENSOR, SENSOR_COPY),
      pages,
    ).occurrences;
    const duplicates = findDuplicateDefinitions(current, previous);
    expect(
      duplicates.map((d) => [d.tfId, cells([d.keep])[0], cells(d.reassign)]),
    ).toEqual([["sen_p2", "sen/sen_p2", ["sen2/sen_p2"]]]);
  });

  it("without a saved state: the page first in tree order keeps the tfId", () => {
    const current = occurrencesOf(mxfile(SYSTEM_COPY, SYSTEM));
    const [d] = findDuplicateDefinitions(current, [], ["sys", "sys2"]);
    expect(cells([d.keep])).toEqual(["sys/mp1"]);
  });

  it("without saved state and tree order: document order decides", () => {
    const current = occurrencesOf(mxfile(SYSTEM_COPY, SYSTEM));
    const [d] = findDuplicateDefinitions(current);
    expect(cells([d.keep])).toEqual(["sys2/mp1"]);
  });

  it("if several cells existed before (external editing), tree order decides among them", () => {
    const both = occurrencesOf(mxfile(SYSTEM_COPY, SYSTEM));
    const [d] = findDuplicateDefinitions(both, both, ["sys", "sys2"]);
    expect(cells([d.keep])).toEqual(["sys/mp1"]);
    expect(cells(d.reassign)).toEqual(["sys2/mp1"]);
  });
});
