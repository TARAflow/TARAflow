// Legend of the EL badges and the safety-zone frame below the DFD statistics
// (0.20). The marks are display only (patch 23) — never in the stored
// diagram — so the legend follows the model and DocProjectData.dfdMarks.
import { describe, it, expect } from "vitest";
import { dfdBadgeLegend } from "features/documentation/utils/dfd-badge-legend";
import { MarkdownGenerator } from "features/documentation/utils/generators/markdown-generator";
import { AsciidocGenerator } from "features/documentation/utils/generators/asciidoc-generator";
import { HtmlGenerator } from "features/documentation/utils/generators/html-generator";
import { StrictdocGenerator } from "features/documentation/utils/generators/strictdoc-generator";
import { DEFAULT_CHAPTER_CONFIG, createDefaultDocData } from "features/documentation/models/doc-types";
import type { DFDElement } from "features/dfd/models/dfd-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const t = ((_k: string, d?: string) => d ?? _k) as never;

const el = (id: string, type: string, properties: object): DFDElement => ({ id, type, name: id, properties }) as unknown as DFDElement;
const ON = { badges: true, en50742: true };

describe("dfdBadgeLegend", () => {
  it("nothing without marks", () => {
    expect(dfdBadgeLegend(undefined, ON, "en")).toBeUndefined();
    expect(dfdBadgeLegend([el("tb", "TrustBoundary", {})], ON, "en")).toBeUndefined();
    expect(dfdBadgeLegend([el("tb", "TrustBoundary", { defaultExposureLevel: "EL2" })], undefined, "en")).toBeUndefined();
  });

  it("one row per kind of mark the images show", () => {
    const model = [el("tb", "TrustBoundary", { defaultExposureLevel: "EL2" }), el("pb", "PhysicalBoundary", { physicalExposureLevel: "PEL1" })];
    expect(dfdBadgeLegend(model, ON, "en")?.rows.map(([mark]) => mark)).toEqual(["EL0 … EL4", "PEL0 … PEL4"]);
    const zone = [el("tb", "TrustBoundary", { safetyZone: "yes", defaultExposureLevel: "EL2" })];
    expect(dfdBadgeLegend(zone, ON, "en")?.rows.map(([mark]) => mark)).toEqual(["EL0 … EL4", "Safety · ELn"]);
    // the zone outside an EN 50742 project is not drawn
    expect(dfdBadgeLegend(zone, { badges: true, en50742: false }, "en")?.rows.map(([mark]) => mark)).toEqual(["EL0 … EL4"]);
  });

  it("badges off: only the zone frame, named as a frame; German", () => {
    const zone = [el("tb", "TrustBoundary", { safetyZone: "yes", defaultExposureLevel: "EL2" })];
    const legend = dfdBadgeLegend(zone, { badges: false, en50742: true }, "de");
    expect(legend).toMatchObject({ title: "Legende zum Diagramm", headers: ["Markierung", "Bedeutung"], total: [] });
    expect(legend?.rows.map(([mark]) => mark)).toEqual(["gelber, gestrichelter Rahmen"]);
  });

  describe("in the DFD chapter of every format — a table without a total row", () => {
    const project = (elements: DFDElement[], marks = ON): Any => ({
      info: { name: "P", description: "d", version: "1", team: [], created: new Date("2026-01-01"), lastModified: new Date("2026-10-01"), tags: { domain: [], platform: [], regulation: [], custom: [] } },
      assets: null,
      risks: null,
      attackTree: null,
      dfd: { elements, connections: [], assets: [], xml: "<mxfile/>", lastModified: "" },
      dfdMarks: marks,
      computed: { moscowLabels: new Map(), impactLabels: new Map() },
    });
    const cfg = (): Any => ({
      ...createDefaultDocData().configuration,
      language: "en",
      chapters: DEFAULT_CHAPTER_CONFIG.filter((c) => c.id === "dfd"),
    });
    const model = [el("tb", "TrustBoundary", { defaultExposureLevel: "EL2" })];

    it("markdown, asciidoc, html, strictdoc", () => {
      const md = new MarkdownGenerator(project(model), cfg(), t).generate().content;
      expect(md).toContain("| Mark | Meaning |");
      expect(md).toMatch(/\| EL0 … EL4 \| Exposure level of a trust or chip boundary[^\n]*\|\n\n/);
      expect(new AsciidocGenerator(project(model), cfg(), t).generate().content).toMatch(/\| EL0 … EL4 \| [^\n]*\n\|===/);
      const html = new HtmlGenerator(project(model), cfg(), t).generate().content;
      expect(html).toMatch(/<td>EL0 … EL4<\/td><td>[^<]*<\/td><\/tr>\n<\/table>/);
      expect(new StrictdocGenerator(project(model), cfg(), t).generate().content).toContain("TITLE: Diagram legend");
      expect(new MarkdownGenerator(project(model, { badges: false, en50742: false }), cfg(), t).generate().content).not.toContain(
        "| Mark | Meaning |",
      );
    });
  });
});
