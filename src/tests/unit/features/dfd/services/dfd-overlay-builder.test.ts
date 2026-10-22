// Asset overlay (leveled-dfd-multi-diagram-design.md §4): every page stays
// in the overlay, and a record is highlighted by all cells that show it —
// definition and context copies. Before, only the first <diagram> was read
// and the overlay replaced the file with that one page.
import { describe, it, expect } from "vitest";
import { buildOverlayXml } from "features/dfd/services/dfd-overlay-builder";
import { dfdParser } from "features/dfd/services/dfd-parser";
import { buildCellIdentityIndex } from "features/dfd/services/leveled";
import type { DFDAsset } from "features/dfd/models/dfd-asset-types";
import type { DFDConnection, DFDElement } from "features/dfd/models/dfd-types";
import { CONTROLLER, LEVELED_PAGES, SENSOR, SYSTEM, flow, mxfile, node, page } from "../../../../fixtures/leveled-dfd-xml";

const ASSET = { id: "as1", displayId: "AS-1", name: "Alarm state", assetGroup: "data" } as DFDAsset;
const withAsset = (elements: DFDElement[], id: string) =>
  elements.map((e) => (e.id === id ? { ...e, assetRelations: [{ assetId: "as1", relationType: "processes" }] } : e)) as DFDElement[];

const highlighted = (xml: string) => {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  return Array.from(doc.getElementsByTagName("diagram")).map((d) => ({
    page: d.getAttribute("id"),
    cells: Array.from(d.querySelectorAll("object"))
      .filter((o) => o.querySelector("mxCell")?.getAttribute("style")?.includes("strokeWidth=3"))
      .map((o) => o.getAttribute("id")),
    badges: d.querySelectorAll('mxCell[id^="taraflow-overlay-badge-"]').length,
  }));
};

describe("buildOverlayXml — leveled DFD", () => {
  const xml = mxfile(SYSTEM, SENSOR, CONTROLLER);
  const { elements, occurrences } = dfdParser.parse(xml, LEVELED_PAGES);
  const index = buildCellIdentityIndex(LEVELED_PAGES, occurrences);

  it("keeps every page and highlights the definition and its context copies", async () => {
    const overlay = await buildOverlayXml("as1", [ASSET], withAsset(elements, "mp2"), [], xml, index.occurrencesOf);
    expect(highlighted(overlay!)).toEqual([
      { page: "sys", cells: ["mp2"], badges: 1 },
      { page: "sen", cells: ["sen_mp2"], badges: 1 },
      { page: "ctl", cells: [], badges: 0 },
    ]);
  });

  it("a part on its child page only", async () => {
    const overlay = await buildOverlayXml("as1", [ASSET], withAsset(elements, "ctl_p5"), [], xml, index.occurrencesOf);
    expect(highlighted(overlay!).map((p) => p.cells)).toEqual([[], [], ["ctl_p5"]]);
  });
});

describe("buildOverlayXml — classic DFD", () => {
  it("the record id is the cell id", async () => {
    const xml = mxfile(page("p1", "Page-1", node("a", "process", "Sensor", "P-1", 10)));
    const { elements } = dfdParser.parse(xml);
    const overlay = await buildOverlayXml("as1", [ASSET], withAsset(elements, "a"), [], xml);
    expect(highlighted(overlay!)).toEqual([{ page: "p1", cells: ["a"], badges: 1 }]);
  });
});

describe("buildOverlayXml — a flow that is the asset", () => {
  const related = (connections: DFDConnection[], relationType: string) =>
    connections.map((c) => ({ ...c, assetRelations: [{ assetId: "as1", relationType }] })) as DFDConnection[];
  const badge = (xml: string) => {
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    const cell = doc.querySelector('mxCell[id^="taraflow-overlay-badge-"]');
    const geo = cell?.querySelector("mxGeometry");
    return cell
      ? { value: cell.getAttribute("value"), filled: /fillColor=#/.test(cell.getAttribute("style") ?? ""), x: geo?.getAttribute("x"), y: geo?.getAttribute("y") }
      : null;
  };
  const twoNodes = node("a", "process", "Sensor", "P-1", 10) + node("b", "process", "Alarm", "P-2", 300);

  it("is_an: a filled badge on the middle of the line", async () => {
    const xml = mxfile(page("p1", "Page-1", twoNodes + flow("f", "alarm", "DF-1", "a", "b")));
    const { connections } = dfdParser.parse(xml);
    const overlay = await buildOverlayXml("as1", [ASSET], [], related(connections, "is_an"), xml);
    // centres (70, 40) and (360, 40): middle (215, 40); badge 50 × 16
    expect(badge(overlay!)).toEqual({ value: "is_an", filled: true, x: "190", y: "32" });
  });

  it("is_an: the middle follows the waypoints", async () => {
    const bent = flow("f", "alarm", "DF-1", "a", "b").replace(
      '<mxGeometry relative="1" as="geometry"/>',
      '<mxGeometry relative="1" as="geometry"><Array as="points"><mxPoint x="70" y="200"/><mxPoint x="360" y="200"/></Array></mxGeometry>',
    );
    const xml = mxfile(page("p1", "Page-1", twoNodes + bent));
    const { connections } = dfdParser.parse(xml);
    const overlay = await buildOverlayXml("as1", [ASSET], [], related(connections, "is_an"), xml);
    // 160 + 290 + 160: half way is 145 along the bottom segment → (215, 200)
    expect(badge(overlay!)).toMatchObject({ x: "190", y: "192" });
  });

  it("transports: the line only, no badge", async () => {
    const xml = mxfile(page("p1", "Page-1", twoNodes + flow("f", "alarm", "DF-1", "a", "b")));
    const { connections } = dfdParser.parse(xml);
    const overlay = await buildOverlayXml("as1", [ASSET], [], related(connections, "transports"), xml);
    expect(badge(overlay!)).toBeNull();
    expect(overlay).toContain("strokeWidth=3");
  });
});
