// EL badges and the safety-zone style in the diagram (0.20, user 2026-11-21):
// written by the app from the element properties, read-only in draw.io,
// deterministic, removed by the project setting, skipped by the parser.
import { describe, it, expect } from "vitest";
import { applyDfdBadges, badgeText, DFD_BADGE_TYPE, SAFETY_ZONE_COLOR, type BadgeElement } from "features/dfd/services/dfd-badges";
import { DFDParser } from "features/dfd/services/dfd-parser";
import type { DFDPage } from "features/dfd/models/dfd-types";
import { mxfile, page, ref } from "../../../../fixtures/leveled-dfd-xml";

const TB_STYLE = "html=1;fontColor=#FF3333;dashed=1;strokeWidth=2;strokeColor=#FF3333;fillColor=none;";

const boundary = (id: string, type: string, label: string, style = TB_STYLE) =>
  `<object label="${label}" type="${type}" id="${id}"><mxCell connectable="0" parent="1" style="${style}" vertex="1"><mxGeometry height="300" width="500" x="0" y="0" as="geometry"/></mxCell></object>`;
const iface = (id: string, label: string) =>
  `<object label="${label}" type="interface" id="${id}"><mxCell connectable="0" parent="1" style="whiteSpace=wrap;dashed=1;" vertex="1"><mxGeometry height="40" width="40" x="600" y="100" as="geometry"/></mxCell></object>`;
const proc = (id: string) =>
  `<object label="Ctrl" type="process" id="${id}"><mxCell parent="1" style="ellipse;" vertex="1"><mxGeometry height="60" width="60" x="50" y="50" as="geometry"/></mxCell></object>`;

const single = (cells: string) => mxfile(page("p1", "Page-1", cells));
const els = (entries: [string, BadgeElement][]) => new Map(entries);
const ON = { enabled: true, en50742: true };

const badges = (xml: string) => {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  return Array.from(doc.getElementsByTagName("object"))
    .filter((o) => o.getAttribute("type") === DFD_BADGE_TYPE)
    .map((o) => {
      const cell = o.getElementsByTagName("mxCell")[0];
      return { id: o.getAttribute("id"), label: o.getAttribute("label"), parent: cell.getAttribute("parent"), style: cell.getAttribute("style") ?? "", cell };
    });
};
const styleOf = (xml: string, id: string) =>
  new DOMParser().parseFromString(xml, "text/xml").querySelector(`object[id="${id}"] > mxCell`)?.getAttribute("style") ?? "";

const DIAGRAM = single(
  boundary("tb", "trustboundary", "Machine [TB]") +
    boundary("cb", "chipboundary", "MCU [CB]") +
    boundary("pb", "physicalboundary", "Cabinet [PB]") +
    iface("if", "USB") +
    proc("p"),
);
const ELEMENTS = els([
  ["tb", { type: "TrustBoundary", properties: { defaultExposureLevel: "EL2" } }],
  ["cb", { type: "ChipBoundary", properties: { defaultExposureLevel: "EL1" } }],
  ["pb", { type: "PhysicalBoundary", properties: { physicalExposureLevel: "PEL3" } }],
  ["if", { type: "Interface", properties: { exposureLevel: "EL4" } }],
  ["p", { type: "Process", properties: {} }],
]);

describe("dfd badges", () => {
  it("writes the level at the top right of every boundary and interface — read-only text", () => {
    const out = applyDfdBadges(DIAGRAM, ELEMENTS, undefined, ON);
    const list = badges(out);
    expect(list.map((b) => [b.parent, b.label])).toEqual([
      ["tb", "EL2"],
      ["cb", "EL1"],
      ["pb", "PEL3"],
      ["if", "EL4"],
    ]);
    for (const b of list) {
      expect(b.id).toBe(`${b.parent}-elbadge`);
      for (const flag of ["editable=0", "movable=0", "resizable=0", "deletable=0", "connectable=0", "locked=1"]) {
        expect(b.style).toContain(flag);
      }
      const geometry = b.cell.getElementsByTagName("mxGeometry")[0];
      expect([geometry.getAttribute("relative"), geometry.getAttribute("x"), geometry.getAttribute("y")]).toEqual(["1", "1", "0"]);
    }
    // the interface badge sits above the small interface, the boundary badges inside
    const offsetY = (parent: string) =>
      list.find((b) => b.parent === parent)!.cell.getElementsByTagName("mxPoint")[0].getAttribute("y");
    expect(offsetY("if")).toBe("-16");
    expect(offsetY("tb")).toBe("2");
    // a badge takes the colour of its boundary
    expect(list[0].style).toContain("fontColor=#FF3333");
  });

  it("no badge without a level, for other element types or an unknown value", () => {
    const out = applyDfdBadges(
      DIAGRAM,
      els([
        ["tb", { type: "TrustBoundary", properties: {} }],
        ["cb", { type: "ChipBoundary", properties: { defaultExposureLevel: "not_specified" } }],
        ["p", { type: "Process", properties: { exposureLevel: "EL2" } }],
      ]),
      undefined,
      ON,
    );
    expect(out).toBe(DIAGRAM);
    expect(badgeText("process", { type: "Process", properties: { exposureLevel: "EL2" } }, true)).toBeUndefined();
  });

  it("is deterministic: a second run changes nothing; a new level replaces the badge under the same id", () => {
    const once = applyDfdBadges(DIAGRAM, ELEMENTS, undefined, ON);
    expect(applyDfdBadges(once, ELEMENTS, undefined, ON)).toBe(once);

    const changed = new Map(ELEMENTS);
    changed.set("tb", { type: "TrustBoundary", properties: { defaultExposureLevel: "EL3" } });
    const twice = applyDfdBadges(once, changed, undefined, ON);
    const tb = badges(twice).filter((b) => b.parent === "tb");
    expect(tb.map((b) => [b.id, b.label])).toEqual([["tb-elbadge", "EL3"]]);
    expect(badges(twice)).toHaveLength(4);
  });

  it("the same badges in another formatting count as unchanged (draw.io writes the XML itself)", () => {
    const once = applyDfdBadges(DIAGRAM, ELEMENTS, undefined, ON);
    const reformatted = once.replace(/></g, ">\n<");
    expect(applyDfdBadges(reformatted, ELEMENTS, undefined, ON)).toBe(reformatted);
  });

  it("the setting off removes every badge; a copied badge of a deleted element goes too", () => {
    const once = applyDfdBadges(DIAGRAM, ELEMENTS, undefined, ON);
    expect(badges(applyDfdBadges(once, ELEMENTS, undefined, { ...ON, enabled: false }))).toEqual([]);
    // a badge left from a draw.io copy (other id, stale text) is replaced
    const stale = once.replace('id="tb-elbadge"', 'id="xyz"').replace('label="EL2"', 'label="EL0"');
    const fixed = badges(applyDfdBadges(stale, ELEMENTS, undefined, ON)).filter((b) => b.parent === "tb");
    expect(fixed.map((b) => [b.id, b.label])).toEqual([["tb-elbadge", "EL2"]]);
  });

  it("a badge id taken by another cell gets a suffix", () => {
    const xml = single(boundary("tb", "trustboundary", "Machine [TB]") + proc("tb-elbadge"));
    const out = applyDfdBadges(xml, ELEMENTS, undefined, ON);
    expect(badges(out).map((b) => b.id)).toEqual(["tb-elbadge-2"]);
    expect(applyDfdBadges(out, ELEMENTS, undefined, ON)).toBe(out);
  });

  describe("safety zone", () => {
    const zone = (props: object) => els([["tb", { type: "TrustBoundary", properties: { safetyZone: "yes", ...props } }]]);
    const XML = single(boundary("tb", "trustboundary", "Machine [TB]"));

    it("draws the zone yellow and dashed; its badge reads Safety · EL", () => {
      const out = applyDfdBadges(XML, zone({ defaultExposureLevel: "EL2" }), undefined, ON);
      const style = styleOf(out, "tb");
      expect(style).toContain(`strokeColor=${SAFETY_ZONE_COLOR}`);
      expect(style).toContain(`fontColor=${SAFETY_ZONE_COLOR}`);
      expect(style).toContain("dashed=1");
      expect(style).toContain("strokeWidth=2"); // the rest stays
      expect(badges(out).map((b) => b.label)).toEqual(["Safety · EL2"]);
      expect(badges(out)[0].style).toContain(`fontColor=${SAFETY_ZONE_COLOR}`);
      expect(applyDfdBadges(out, zone({ defaultExposureLevel: "EL2" }), undefined, ON)).toBe(out);
    });

    it("without an EL the badge reads Safety; with the setting off the zone stays yellow", () => {
      expect(badges(applyDfdBadges(XML, zone({}), undefined, ON)).map((b) => b.label)).toEqual(["Safety"]);
      const off = applyDfdBadges(XML, zone({}), undefined, { ...ON, enabled: false });
      expect(badges(off)).toEqual([]);
      expect(styleOf(off, "tb")).toContain(`strokeColor=${SAFETY_ZONE_COLOR}`);
    });

    it("unmarking restores the boundary's own colours exactly", () => {
      const custom = single(boundary("tb", "trustboundary", "Machine [TB]", "html=1;strokeColor=#0000FF;strokeWidth=3;"));
      const marked = applyDfdBadges(custom, zone({}), undefined, ON);
      const unmarked = applyDfdBadges(
        marked,
        els([["tb", { type: "TrustBoundary", properties: { safetyZone: "no" } }]]),
        undefined,
        ON,
      );
      expect(styleOf(unmarked, "tb")).toBe("html=1;strokeColor=#0000FF;strokeWidth=3;");
      expect(unmarked).not.toContain("tfSafetyPrevious");
    });

    it("only in an EN 50742 project", () => {
      const out = applyDfdBadges(XML, zone({ defaultExposureLevel: "EL2" }), undefined, { ...ON, en50742: false });
      expect(styleOf(out, "tb")).toBe(TB_STYLE);
      expect(badges(out).map((b) => b.label)).toEqual(["EL2"]);
    });
  });

  it("leveled DFD: context copies carry the badge of their element; every page on its own", () => {
    const xml = mxfile(
      page("top", "System", boundary("tb", "trustboundary", "Machine [TB]") + iface("if", "USB")),
      page("child", "Sub", iface("c1", "USB") + iface("if", "Other")),
    );
    const pages: DFDPage[] = [
      { pageId: "top", name: "System", order: 0 },
      { pageId: "child", name: "Sub", order: 1, links: [ref("c1", "if"), { cellId: "if", tfId: "if2", role: "definition" }] },
    ];
    const out = applyDfdBadges(
      xml,
      els([
        ["tb", { type: "TrustBoundary", properties: { defaultExposureLevel: "EL1" } }],
        ["if", { type: "Interface", properties: { exposureLevel: "EL3" } }],
        ["if2", { type: "Interface", properties: {} }],
      ]),
      pages,
      ON,
    );
    const doc = new DOMParser().parseFromString(out, "text/xml");
    const onPage = (id: string) =>
      Array.from(doc.querySelector(`diagram[id="${id}"]`)!.getElementsByTagName("object"))
        .filter((o) => o.getAttribute("type") === DFD_BADGE_TYPE)
        .map((o) => [o.getElementsByTagName("mxCell")[0].getAttribute("parent"), o.getAttribute("label")]);
    expect(onPage("top")).toEqual([
      ["tb", "EL1"],
      ["if", "EL3"],
    ]);
    // the copy c1 shows the level of "if"; the cell "if" on this page is another element
    expect(onPage("child")).toEqual([["c1", "EL3"]]);
  });

  it("the parser does not see the badges — same elements, connections and stats", () => {
    const parser = new DFDParser();
    const before = parser.parse(DIAGRAM);
    const after = parser.parse(applyDfdBadges(DIAGRAM, ELEMENTS, undefined, ON));
    expect(after.elements).toEqual(before.elements);
    expect(after.connections).toEqual(before.connections);
    expect(after.stats).toEqual(before.stats);
  });

  it("unreadable or empty XML is returned as it is", () => {
    expect(applyDfdBadges("", ELEMENTS, undefined, ON)).toBe("");
    expect(applyDfdBadges("<mxfile><diagram", ELEMENTS, undefined, ON)).toBe("<mxfile><diagram");
  });
});
