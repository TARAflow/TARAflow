// tests/unit/features/documentation/item-definition-chapter.test.ts
//
// ISO/SAE 21434 conformance plan Phase 1 stage A, A-5: the "item-definition"
// chapter (WP-09-01) — purpose and functions, the described sections with
// source and model links, the assumptions with the boundaries that rely on
// them; all presets, all formats, hidden while the Item Definition is empty.

import { describe, it, expect } from "vitest";

import { MarkdownGenerator } from "features/documentation/utils/generators/markdown-generator";
import { AsciidocGenerator } from "features/documentation/utils/generators/asciidoc-generator";
import { HtmlGenerator } from "features/documentation/utils/generators/html-generator";
import { StrictdocGenerator } from "features/documentation/utils/generators/strictdoc-generator";
import { PdfMakeConverter } from "features/documentation/utils/generators/pdfmake-converter";
import {
  hasItemDefinitionContent,
  itemDefinitionReportSections,
} from "features/documentation/utils/item-definition-report";
import {
  DEFAULT_CHAPTER_CONFIG,
  createDefaultDocData,
  withDefaultChapters,
} from "features/documentation/models/doc-types";
import type { ItemDefinition } from "shared";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const t = ((_k: string, d?: string) => d ?? _k) as never;

const definition = (): ItemDefinition => ({
  sections: {
    functions: { source: { document: "arc42", section: "§1" } },
    boundary: { text: "Detector head and loop interface.\n\nThe panel is not part of the item.", modelRefs: ["if1", "gone"] },
    environment: { text: "Office buildings", source: { document: "arc42", section: "§7", version: "2.1" } },
  },
  functions: [
    { id: "f1", name: "Detect smoke", description: "Optical chamber", lifecyclePhases: ["maintenance", "operation"], functionAssetId: "fu1" },
  ],
  assumptions: [
    { id: "a1", displayId: "ASM-01", text: "Loop wiring is not accessible", status: "confirmed", owner: "JM", reviewBy: "2027-01-31" },
    { id: "a2", displayId: "ASM-02", text: "Panel in a locked room", status: "invalid" },
  ],
});

const project = (itemDefinition?: ItemDefinition): Any => ({
  info: { name: "P", description: "Detects smoke and raises the alarm.", tags: { domain: [], platform: [], regulation: [], custom: [] } },
  dfd: {
    elements: [
      { id: "if1", displayId: "IF-1", name: "Loop interface", type: "Interface" },
      { id: "tb1", displayId: "TB-1", name: "Device", type: "TrustBoundary", properties: { assumptionIds: ["a1"] } },
    ],
    connections: [],
  },
  assets: { assets: [{ id: "fu1", displayId: "FU-001", name: "Smoke detection", assetGroup: "function" }] },
  risks: null,
  attackTree: null,
  ...(itemDefinition ? { itemDefinition } : {}),
  computed: { moscowLabels: new Map(), impactLabels: new Map() },
});
const cfg = (): Any => ({ ...createDefaultDocData().configuration, language: "en", chapters: DEFAULT_CHAPTER_CONFIG });
const chapter = (G: Any, p: Any) => new G(p, cfg(), t).generateItemDefinition("Item Definition");

describe("item-definition sections", () => {
  const sections = itemDefinitionReportSections(project(definition()), t);

  it("purpose (description), the described sections, then assumptions", () => {
    expect(sections.map((s) => s.title)).toEqual([
      "Purpose and functions",
      "Item boundary",
      "Operational environment",
      "Assumptions",
    ]);
  });

  it("purpose: description, its source and the function table", () => {
    const [purpose] = sections;
    expect(purpose.paragraphs).toEqual(["Detects smoke and raises the alarm."]);
    expect(purpose.facts).toEqual([["Source", "arc42, §1"]]);
    expect(purpose.table?.rows).toEqual([["Detect smoke", "Optical chamber", "operation, maintenance", "FU-001 Smoke detection"]]);
  });

  it("a section: paragraphs, model links by label, a removed link marked", () => {
    const boundary = sections[1];
    expect(boundary.paragraphs).toEqual(["Detector head and loop interface.", "The panel is not part of the item."]);
    expect(boundary.facts).toEqual([["Refers to", "IF-1 Loop interface; gone (removed)"]]);
    expect(sections[2].facts).toEqual([["Source", "arc42, §7, v2.1"]]);
  });

  it("assumptions with status, owner / review date and the boundaries that rely on them", () => {
    expect(sections[3].table?.rows).toEqual([
      ["ASM-01", "Loop wiring is not accessible", "confirmed", "JM / 2027-01-31", "TB-1 Device"],
      ["ASM-02", "Panel in a locked room", "invalid", "", ""],
    ]);
  });

  it("nothing beyond the description: no chapter", () => {
    expect(hasItemDefinitionContent(undefined)).toBe(false);
    expect(hasItemDefinitionContent({ sections: {}, functions: [], assumptions: [] })).toBe(false);
    expect(itemDefinitionReportSections(project(), t)).toEqual([]);
  });
});

describe("item-definition chapter", () => {
  it("markdown", () => {
    const c = chapter(MarkdownGenerator, project(definition()));
    expect(c.hasContent).toBe(true);
    expect(c.content).toMatch(/^## Item Definition/);
    expect(c.content).toContain("### Item boundary");
    expect(c.content).toContain("**Refers to**: IF-1 Loop interface; gone (removed)");
    expect(c.content).toContain("| ASM-01 | Loop wiring is not accessible | confirmed | JM / 2027-01-31 | TB-1 Device |");
  });

  it("AsciiDoc, HTML and StrictDoc", () => {
    const adoc = chapter(AsciidocGenerator, project(definition())).content;
    expect(adoc).toContain("=== Operational environment");
    expect(adoc).toContain("| Detect smoke | Optical chamber | operation, maintenance | FU-001 Smoke detection");
    const html = chapter(HtmlGenerator, project(definition())).content;
    expect(html).toContain('<section id="item-definition">');
    expect(html).toContain("<td>ASM-02</td>");
    const sdoc = chapter(StrictdocGenerator, project(definition())).content;
    expect(sdoc).toContain("TITLE: Assumptions");
    expect(sdoc).toContain("   * - ASM-01");
  });

  it("empty: hidden", () => {
    expect(chapter(MarkdownGenerator, project()).hasContent).toBe(false);
  });

  it("pdfmake renders the chapter", () => {
    const def = new PdfMakeConverter(
      project(definition()),
      { ...cfg(), chapters: DEFAULT_CHAPTER_CONFIG.filter((c) => c.id === "item-definition") },
      t,
    ).createDocumentDefinition();
    const json = JSON.stringify(def.content);
    expect(json).toContain('"text":"Item Definition","style":"h1"');
    expect(json).toContain('"text":"ASM-01"');
  });

  it("follows the system overview; stored chapter lists get it", () => {
    const ids = DEFAULT_CHAPTER_CONFIG.map((c) => c.id);
    expect(ids.indexOf("item-definition")).toBe(ids.indexOf("system-overview") + 1);
    const stored = DEFAULT_CHAPTER_CONFIG.filter((c) => c.id !== "item-definition");
    expect(withDefaultChapters(stored).map((c) => c.id)).toContain("item-definition");
  });
});
