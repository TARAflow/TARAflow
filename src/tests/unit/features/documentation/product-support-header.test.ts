// Product support data in the report header (model coverage plan F-28,
// CM-7b): model designation, vulnerability contact and support end appear
// as rows of the header table when stated — directly below the
// criticality, without breaking the Markdown table — and nothing changes
// when they are not.

import { describe, it, expect } from "vitest";

import { MarkdownGenerator } from "features/documentation/utils/generators/markdown-generator";
import { HtmlGenerator } from "features/documentation/utils/generators/html-generator";
import { transformProjectToDocData } from "app/services/doc-transform";
import { createDefaultDocData } from "features/documentation/models/doc-types";
import { DEFAULT_ASSET_CONFIGURATION } from "features/assets/models/asset-types";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";
import type { Project } from "app/models/project-types";

const t = ((_k: string, d?: string) => d ?? _k) as never;

const project = (productSupport?: Record<string, string>) =>
  ({
    id: "p",
    info: {
      name: "P",
      version: "1",
      responsible: "R",
      created: "2026-10-01T00:00:00.000Z",
      lastModified: "2026-10-01T00:00:00.000Z",
      team: [],
      tags: { domain: [], platform: [], regulation: [], custom: [] },
      ...(productSupport ? { productSupport } : {}),
    },
    assets: { configuration: { ...DEFAULT_ASSET_CONFIGURATION }, assets: [] },
    risks: { configuration: { ...DEFAULT_CONFIGURATION }, risks: [] },
    attackTrees: null,
  }) as unknown as Project;

const header = (G: typeof HtmlGenerator | typeof MarkdownGenerator, lang: "en" | "de", p: Project) => {
  const content = new G(transformProjectToDocData(p, lang), { ...createDefaultDocData().configuration, language: lang }, t)
    .generate().content;
  const tags = content.indexOf("### Tags");
  return content.slice(0, tags > 0 ? tags : 3000);
};

const SUPPORT = { modelDesignation: "PSC-200 rev. B", securityContact: "psirt@example.com", supportEnd: "2032-12-31" };

describe("report header — product support (F-28)", () => {
  it("Markdown (en): three rows right below the criticality, one table", () => {
    const md = header(MarkdownGenerator, "en", project(SUPPORT));
    const lines = md.split("\n");
    const at = lines.findIndex((l) => l.startsWith("| **Criticality**"));
    expect(lines[at + 1]).toBe("| **Model designation** | PSC-200 rev. B |");
    expect(lines[at + 2]).toBe("| **Vulnerability contact** | psirt@example.com |");
    expect(lines[at + 3]).toMatch(/^\| \*\*Security updates until\*\* \| .*2032.* \|$/);
  });

  it("Markdown (de): only the stated value, no empty line inside the table", () => {
    const md = header(MarkdownGenerator, "de", project({ securityContact: "psirt@example.com" }));
    const lines = md.split("\n");
    const at = lines.findIndex((l) => l.startsWith("| **Kritikalität**"));
    expect(lines[at + 1]).toBe("| **Kontakt für Schwachstellen** | psirt@example.com |");
    expect(md).not.toContain("Modellbezeichnung");
  });

  it("not stated: the header is the same as before", () => {
    const without = header(MarkdownGenerator, "en", project());
    expect(without).not.toMatch(/Model designation|Vulnerability contact|Security updates until/);
    const lines = without.split("\n");
    const at = lines.findIndex((l) => l.startsWith("| **Criticality**"));
    expect(lines[at]).toMatch(/\|$/); // nothing appended to the row
  });

  it("HTML: the rows in the metadata table", () => {
    const html = new HtmlGenerator(
      transformProjectToDocData(project(SUPPORT), "en"),
      { ...createDefaultDocData().configuration, language: "en" },
      t,
    ).generate().content;
    expect(html).toContain("<tr><th>Model designation</th><td>PSC-200 rev. B</td></tr>");
    expect(html).toContain("<tr><th>Vulnerability contact</th><td>psirt@example.com</td></tr>");
  });
});
