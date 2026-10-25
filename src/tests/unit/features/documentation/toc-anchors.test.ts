// tests/unit/features/documentation/toc-anchors.test.ts
//
// ISO/SAE 21434 conformance plan F6: every table-of-contents link of the
// HTML and Markdown report resolves (anchor `chapter-<id>`, independent of
// title, language and custom titles), and a disabled chapter appears neither
// in the document nor in the TOC.

import { describe, it, expect } from "vitest";

import { MarkdownGenerator } from "features/documentation/utils/generators/markdown-generator";
import { HtmlGenerator } from "features/documentation/utils/generators/html-generator";
import { transformProjectToDocData } from "app/services/doc-transform";
import {
  DEFAULT_CHAPTER_CONFIG,
  createDefaultDocData,
  type DocChapterConfig,
} from "features/documentation/models/doc-types";
import { DEFAULT_ASSET_CONFIGURATION } from "features/assets/models/asset-types";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";
import type { Project } from "app/models/project-types";

const t = ((_k: string, d?: string) => d ?? _k) as never;

const project = {
  id: "p",
  info: {
    name: "P",
    version: "1",
    responsible: "",
    created: "2026-10-01T00:00:00.000Z",
    lastModified: "2026-10-01T00:00:00.000Z",
    team: [],
    tags: { domain: [], platform: [], regulation: ["ISO 21434"], custom: [] },
  },
  assets: { configuration: { ...DEFAULT_ASSET_CONFIGURATION }, assets: [] },
  risks: {
    configuration: { ...DEFAULT_CONFIGURATION, likelihoodMethod: "iso-21434" },
    risks: [],
  },
  attackTrees: null,
} as unknown as Project;

const generate = (G: typeof HtmlGenerator | typeof MarkdownGenerator, lang: "en" | "de", chapters: DocChapterConfig[]) =>
  new G(
    transformProjectToDocData(project, lang),
    { ...createDefaultDocData().configuration, language: lang, chapters },
    t,
  ).generate().content;

const tocTargets = (content: string) =>
  [...content.matchAll(/(?:href="#|\]\(#)(chapter-[a-z0-9-]+)/g)].map((m) => m[1]);
const anchors = (content: string) =>
  new Set([...content.matchAll(/id="(chapter-[a-z0-9-]+)"/g)].map((m) => m[1]));

describe("TOC links resolve", () => {
  const custom = DEFAULT_CHAPTER_CONFIG.map((c) =>
    c.id === "methodology" ? { ...c, customTitle: "Our (custom) method", customTitleDE: "Unsere Methode (ä)" } : c,
  );

  for (const G of [HtmlGenerator, MarkdownGenerator]) {
    for (const lang of ["en", "de"] as const) {
      it(`${G.name} ${lang}`, () => {
        const content = generate(G, lang, custom);
        const targets = tocTargets(content);
        expect(targets).toContain("chapter-methodology");
        expect(targets.filter((x) => !anchors(content).has(x))).toEqual([]);
      });
    }
  }
});

describe("disabled chapters", () => {
  // appendix always has content; disabled it must not appear
  const chapters = DEFAULT_CHAPTER_CONFIG.map((c) =>
    c.id === "appendix" ? { ...c, enabled: false } : c.id === "methodology" ? { ...c, enabled: true } : c,
  );

  for (const G of [HtmlGenerator, MarkdownGenerator]) {
    it(`${G.name}: neither in the document nor in the TOC`, () => {
      const content = generate(G, "en", chapters);
      expect(tocTargets(content)).not.toContain("chapter-appendix");
      expect(anchors(content).has("chapter-appendix")).toBe(false);
      expect(content).not.toContain("STRIDE Categories");
    });
  }

  it("enabled: appendix is there", () => {
    const enabled = chapters.map((c) => (c.id === "appendix" ? { ...c, enabled: true } : c));
    const html = generate(HtmlGenerator, "en", enabled);
    expect(tocTargets(html)).toContain("chapter-appendix");
    expect(html).toContain("STRIDE Categories");
  });
});
