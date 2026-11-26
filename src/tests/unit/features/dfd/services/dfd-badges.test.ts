// EL badges and the safety-zone frame (0.20): display only — the app puts
// them into the editor's diagram, every save strips them (patch 23). Apply
// and strip are textual: strip(apply(xml)) is the input byte for byte, also
// for draw.io's own formatting of the cells.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  applyDfdBadges,
  badgeText,
  stripDfdBadges,
  DFD_BADGE_TYPE,
  DFD_ZONE_TYPE,
  SAFETY_ZONE_COLOR,
  type BadgeElement,
} from "features/dfd/services/dfd-badges";
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

const decorations = (xml: string, type: string) => {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  return Array.from(doc.getElementsByTagName("object"))
    .filter((o) => o.getAttribute("type") === type)
    .map((o) => {
      const cell = o.getElementsByTagName("mxCell")[0];
      return { id: o.getAttribute("id"), label: o.getAttribute("label"), parent: cell.getAttribute("parent"), style: cell.getAttribute("style") ?? "", cell };
    });
};
const badges = (xml: string) => decorations(xml, DFD_BADGE_TYPE);
const zones = (xml: string) => decorations(xml, DFD_ZONE_TYPE);
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

describe("dfd badges — apply", () => {
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
      for (const flag of ["editable=0", "movable=0", "resizable=0", "deletable=0", "selectable=0", "connectable=0", "locked=1", "pointerEvents=0"]) {
        expect(b.style).toContain(flag);
      }
      const geometry = b.cell.getElementsByTagName("mxGeometry")[0];
      expect([geometry.getAttribute("relative"), geometry.getAttribute("x"), geometry.getAttribute("y")]).toEqual(["1", "1", "0"]);
    }
    const offsetY = (parent: string) =>
      list.find((b) => b.parent === parent)!.cell.getElementsByTagName("mxPoint")[0].getAttribute("y");
    expect(offsetY("if")).toBe("-16");
    expect(offsetY("tb")).toBe("2");
    expect(list[0].style).toContain("fontColor=#FF3333");
  });

  it("no badge without a level, for other element types or an unknown value: the input as it is", () => {
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
    expect(badges(twice).filter((b) => b.parent === "tb").map((b) => [b.id, b.label])).toEqual([["tb-elbadge", "EL3"]]);
    expect(badges(twice)).toHaveLength(4);
  });

  it("the setting off removes every badge; a stale copied badge is replaced", () => {
    const once = applyDfdBadges(DIAGRAM, ELEMENTS, undefined, ON);
    expect(applyDfdBadges(once, ELEMENTS, undefined, { ...ON, enabled: false })).toBe(DIAGRAM);
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
    expect(onPage("child")).toEqual([["c1", "EL3"]]);
  });

  it("unreadable or empty XML is returned as it is", () => {
    expect(applyDfdBadges("", ELEMENTS, undefined, ON)).toBe("");
    expect(applyDfdBadges("<mxfile><diagram", ELEMENTS, undefined, ON)).toBe("<mxfile><diagram");
  });
});

describe("safety zone — a frame of its own, the boundary untouched", () => {
  const zone = (props: object) => els([["tb", { type: "TrustBoundary", properties: { safetyZone: "yes", ...props } }]]);
  const XML = single(boundary("tb", "trustboundary", "Machine [TB]"));

  it("a yellow dashed, read-only frame of the boundary's size; badge Safety · EL; the boundary's own style unchanged", () => {
    const out = applyDfdBadges(XML, zone({ defaultExposureLevel: "EL2" }), undefined, ON);
    const [frame] = zones(out);
    expect(frame.parent).toBe("tb");
    expect(frame.style).toContain(`strokeColor=${SAFETY_ZONE_COLOR}`);
    expect(frame.style).toContain("dashed=1");
    for (const flag of ["movable=0", "deletable=0", "selectable=0", "locked=1", "pointerEvents=0"]) expect(frame.style).toContain(flag);
    const geometry = frame.cell.getElementsByTagName("mxGeometry")[0];
    expect([geometry.getAttribute("width"), geometry.getAttribute("height")]).toEqual(["500", "300"]);
    expect(styleOf(out, "tb")).toBe(TB_STYLE);
    expect(badges(out).map((b) => b.label)).toEqual(["Safety · EL2"]);
    expect(badges(out)[0].style).toContain(`fontColor=${SAFETY_ZONE_COLOR}`);
    expect(applyDfdBadges(out, zone({ defaultExposureLevel: "EL2" }), undefined, ON)).toBe(out);
  });

  it("badges off: the frame stays; unmarked: the frame goes", () => {
    const off = applyDfdBadges(XML, zone({}), undefined, { ...ON, enabled: false });
    expect(badges(off)).toEqual([]);
    expect(zones(off)).toHaveLength(1);
    expect(applyDfdBadges(off, els([["tb", { type: "TrustBoundary", properties: { safetyZone: "no" } }]]), undefined, ON)).toBe(XML);
  });

  it("only in an EN 50742 project", () => {
    const out = applyDfdBadges(XML, zone({ defaultExposureLevel: "EL2" }), undefined, { ...ON, en50742: false });
    expect(zones(out)).toEqual([]);
    expect(badges(out).map((b) => b.label)).toEqual(["EL2"]);
  });
});

describe("strip — what is stored and hashed", () => {
  it("strip(apply(xml)) is the input byte for byte — every project fixture, zones and badges on", () => {
    const dir = join(__dirname, "../../../../fixtures");
    const files = ["SmokeDetector.tara.json", "Simple_Test_Project.tara.json", "cnc-ref.tara.json", "headlamp-iso21434.tara.json", "component-0.19/SmokeDetectorCase.tara.json"];
    let checked = 0;
    for (const file of files) {
      const project = JSON.parse(readFileSync(join(dir, file), "utf-8")) as { dfd?: { xml?: string; elements?: { id: string; type: string; properties?: Record<string, unknown> }[]; pages?: DFDPage[] } };
      const xml = project.dfd?.xml;
      if (!xml) continue;
      const elements = new Map((project.dfd!.elements ?? []).map((e) => [e.id, e.type === "TrustBoundary" ? { ...e, properties: { ...e.properties, safetyZone: "yes" } } : e]));
      const applied = applyDfdBadges(xml, elements, project.dfd!.pages, ON);
      expect(applied, file).not.toBe(xml);
      expect(stripDfdBadges(applied), file).toBe(xml);
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(4);
  });

  it("also in draw.io's own form: cells on lines of their own, other attribute order, other escaping", () => {
    const original = single(boundary("tb", "trustboundary", "Machine [TB]")).replace(/></g, ">\n        <");
    const drawio = original.replace(
      /(<object label="Machine \[TB\]"[\s\S]*?<\/object>)/,
      `$1
        <object id="tb-elzone" label="" type="elzone">
          <mxCell connectable="0" parent="tb" style="rounded=0;strokeColor=#E6B800;locked=1;" vertex="1">
            <mxGeometry height="300" width="500" as="geometry" />
          </mxCell>
        </object>
        <object id="tb-elbadge" label="Safety &#183; EL2" type="elbadge">
          <mxCell connectable="0" parent="tb" style="text;locked=1;" vertex="1">
            <mxGeometry height="16" relative="1" width="90" x="1" as="geometry">
              <mxPoint x="-90" y="2" as="offset" />
            </mxGeometry>
          </mxCell>
        </object>`,
    );
    expect(drawio).not.toBe(original);
    expect(stripDfdBadges(drawio)).toBe(original);
  });

  it("repairs a file of an earlier 0.20 build: badges out, the restyled zone back to its own colours", () => {
    const legacy = single(
      `<object label="Machine [TB]" type="trustboundary" id="tb" tfSafetyPrevious="strokeColor=#FF3333;fontColor=#FF3333;dashed=1"><mxCell connectable="0" parent="1" style="html=1;fontColor=#E6B800;dashed=1;strokeWidth=2;strokeColor=#E6B800;fillColor=none;" vertex="1"><mxGeometry height="300" width="500" x="0" y="0" as="geometry"/></mxCell></object>` +
        `<object label="Safety · EL2" type="elbadge" id="tb-elbadge"><mxCell parent="tb" vertex="1"><mxGeometry relative="1" as="geometry"/></mxCell></object>`,
    );
    const repaired = stripDfdBadges(legacy);
    expect(repaired).toBe(single(boundary("tb", "trustboundary", "Machine [TB]")));
  });

  it("nothing to take out: the same string", () => {
    expect(stripDfdBadges(DIAGRAM)).toBe(DIAGRAM);
    expect(stripDfdBadges("")).toBe("");
  });

  it("the parser does not see badges or the zone frame — same elements, connections and stats", () => {
    const parser = new DFDParser();
    const before = parser.parse(DIAGRAM);
    const zoned = new Map(ELEMENTS);
    zoned.set("tb", { type: "TrustBoundary", properties: { defaultExposureLevel: "EL2", safetyZone: "yes" } });
    const applied = applyDfdBadges(DIAGRAM, zoned, undefined, ON);
    expect(zones(applied)).toHaveLength(1);
    const after = parser.parse(applied);
    expect(after.elements).toEqual(before.elements);
    expect(after.connections).toEqual(before.connections);
    expect(after.stats).toEqual(before.stats);
  });
});

describe("the safety zone's word in the UI language (patch 24)", () => {
  it("badgeText and apply take the label; default Safety", () => {
    const zoneTb = { type: "TrustBoundary", properties: { safetyZone: "yes", defaultExposureLevel: "EL2" } };
    expect(badgeText("trustboundary", zoneTb, true)).toBe("Safety · EL2");
    expect(badgeText("trustboundary", zoneTb, true, "Sicherheit")).toBe("Sicherheit · EL2");
    const out = applyDfdBadges(single(boundary("tb", "trustboundary", "Machine [TB]")), els([["tb", zoneTb]]), undefined, { ...ON, safetyLabel: "Sicherheit" });
    expect(badges(out).map((b) => b.label)).toEqual(["Sicherheit · EL2"]);
  });
});
