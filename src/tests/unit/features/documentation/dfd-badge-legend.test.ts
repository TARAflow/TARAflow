// Legend of the EL badges and the safety zone below the DFD statistics
// (0.20): read from the stored diagram, so it names what the figure shows.
import { describe, it, expect } from "vitest";
import { dfdBadgeLegend } from "features/documentation/utils/dfd-badge-legend";
import { MarkdownGenerator } from "features/documentation/utils/generators/markdown-generator";
import { AsciidocGenerator } from "features/documentation/utils/generators/asciidoc-generator";
import { HtmlGenerator } from "features/documentation/utils/generators/html-generator";
import { StrictdocGenerator } from "features/documentation/utils/generators/strictdoc-generator";
import { DEFAULT_CHAPTER_CONFIG, createDefaultDocData } from "features/documentation/models/doc-types";
import { applyDfdBadges } from "features/dfd/services/dfd-badges";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const t = ((_k: string, d?: string) => d ?? _k) as never;

const cell = (id: string, type: string, label: string) =>
  `<object label="${label}" type="${type}" id="${id}"><mxCell parent="1" style="strokeColor=#FF3333;" vertex="1"><mxGeometry height="100" width="100" as="geometry"/></mxCell></object>`;
const diagram = (cells: string) =>
  `<mxfile><diagram id="p" name="P"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells}</root></mxGraphModel></diagram></mxfile>`;
const PLAIN = diagram(cell("tb", "trustboundary", "Machine [TB]") + cell("pb", "physicalboundary", "Cabinet [PB]"));
const withBadges = (props: Record<string, object>, en50742 = true) =>
  applyDfdBadges(
    PLAIN,
    new Map([
      ["tb", { type: "TrustBoundary", properties: props.tb ?? {} }],
      ["pb", { type: "PhysicalBoundary", properties: props.pb ?? {} }],
    ]),
    undefined,
    { enabled: true, en50742 },
  );

describe("dfdBadgeLegend", () => {
  it("nothing without marks", () => {
    expect(dfdBadgeLegend(undefined, "en")).toBeUndefined();
    expect(dfdBadgeLegend(PLAIN, "en")).toBeUndefined();
  });

  it("one row per kind of mark in the figure", () => {
    const xml = withBadges({ tb: { defaultExposureLevel: "EL2" }, pb: { physicalExposureLevel: "PEL1" } });
    expect(dfdBadgeLegend(xml, "en")?.rows.map(([mark]) => mark)).toEqual(["EL0 … EL4", "PEL0 … PEL4"]);
    const zone = withBadges({ tb: { safetyZone: "yes", defaultExposureLevel: "EL2" } });
    // "Safety · EL2" names an EL too
    expect(dfdBadgeLegend(zone, "en")?.rows.map(([mark]) => mark)).toEqual(["EL0 … EL4", "Safety · ELn"]);
    const zoneOnly = applyDfdBadges(
      PLAIN,
      new Map([["tb", { type: "TrustBoundary", properties: { safetyZone: "yes" } }]]),
      undefined,
      { enabled: false, en50742: true },
    );
    // badges off: the yellow zone still needs its line
    expect(dfdBadgeLegend(zoneOnly, "de")).toMatchObject({ title: "Legende zum Diagramm", headers: ["Markierung", "Bedeutung"] });
    expect(dfdBadgeLegend(zoneOnly, "de")?.rows.map(([mark]) => mark)).toEqual(["Safety · ELn"]);
    expect(dfdBadgeLegend(zoneOnly, "de")?.total).toEqual([]);
  });

  describe("in the DFD chapter of every format — a table without a total row", () => {
    const project = (xml: string): Any => ({
      info: { name: "P", description: "d", version: "1", team: [], created: new Date("2026-01-01"), lastModified: new Date("2026-10-01"), tags: { domain: [], platform: [], regulation: [], custom: [] } },
      assets: null,
      risks: null,
      attackTree: null,
      dfd: { elements: [], connections: [], assets: [], xml, lastModified: "" },
      computed: { moscowLabels: new Map(), impactLabels: new Map() },
    });
    const cfg = (): Any => ({
      ...createDefaultDocData().configuration,
      language: "en",
      chapters: DEFAULT_CHAPTER_CONFIG.filter((c) => c.id === "dfd"),
    });
    const xml = withBadges({ tb: { defaultExposureLevel: "EL2" } });

    it("markdown, asciidoc, html, strictdoc", () => {
      const md = new MarkdownGenerator(project(xml), cfg(), t).generate().content;
      expect(md).toContain("| Mark | Meaning |");
      expect(md).toMatch(/\| EL0 … EL4 \| Exposure level of a trust or chip boundary[^\n]*\|\n\n/);
      expect(new AsciidocGenerator(project(xml), cfg(), t).generate().content).toMatch(/\| EL0 … EL4 \| [^\n]*\n\|===/);
      const html = new HtmlGenerator(project(xml), cfg(), t).generate().content;
      expect(html).toMatch(/<td>EL0 … EL4<\/td><td>[^<]*<\/td><\/tr>\n<\/table>/);
      expect(new StrictdocGenerator(project(xml), cfg(), t).generate().content).toContain("TITLE: Diagram legend");
      // without marks no legend
      expect(new MarkdownGenerator(project(PLAIN), cfg(), t).generate().content).not.toContain("| Mark | Meaning |");
    });
  });
});
