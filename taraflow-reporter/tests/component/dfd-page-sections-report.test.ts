// taraflow-reporter/tests/component/dfd-page-sections-report.test.ts
//
// Leveled-DFD Phase 7a/7b: in every format the DFD chapter of a leveled DFD
// reads title → statistics → one section per page (heading, figure, the
// element table of that page); the element descriptions chapter no longer
// repeats the overview. A classic project renders as before.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { createCliGenerator } from "../../../src/features/documentation/utils/generators/cli-generators";
import { toDocProjectData } from "../../cli/to-doc-project-data";
import type { Project } from "../../../src/app/models/project-types";
import {
  DEFAULT_DOC_CONFIGURATION,
  type DocFormat,
  type DocProjectData,
} from "../../../src/features/documentation/models/doc-types";
import fixture from "../../../src/tests/fixtures/leveled/smoke-detector-leveled.json";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const project = JSON.parse(
  readFileSync(path.join(__dirname, "../../../src/tests/fixtures/Simple_Test_Project.tara.json"), "utf-8"),
) as Project;
const t = (key: string, defaultValue?: string) => defaultValue ?? key;

const TOP = "data:image/svg+xml;base64,VE9Q";
const SEN = "data:image/svg+xml;base64,U0VO";

function leveledDocData(): DocProjectData {
  const base = toDocProjectData(project, "en");
  return {
    ...base,
    dfd: {
      ...base.dfd!,
      xml: fixture.leveledXml,
      thumbnail: TOP,
      pages: fixture.pages.map((p) =>
        p.pageId === "sys" ? { ...p, thumbnail: TOP } : p.pageId === "sen" ? { ...p, thumbnail: SEN } : p,
      ),
      elements: fixture.leveledElements,
      connections: fixture.connections,
    } as unknown as DocProjectData["dfd"],
  };
}

const generate = (data: DocProjectData, format: DocFormat, language: "en" | "de" = "en") =>
  createCliGenerator(data, { ...DEFAULT_DOC_CONFIGURATION, format, language }, t).generate().content;

/** Fails unless every needle occurs, in this order. */
const inOrder = (text: string, needles: string[]) => {
  let from = 0;
  for (const needle of needles) {
    const at = text.indexOf(needle, from);
    expect(at, `"${needle}" after position ${from}`).toBeGreaterThanOrEqual(0);
    from = at + needle.length;
  }
};

const TOP_T = 'Page "Top"';
const SEN_T = 'Page "Sensor Head" (decomposes MP-1 Sensor Head)';
const CTL_T = 'Page "Smoke Detector Controller" (decomposes MP-2 Smoke Detector Controller)';
const NO_IMAGE = "No image of this page is stored yet";

describe("DFD chapter of a leveled DFD (7a/7b)", () => {
  const data = leveledDocData();

  it("markdown: statistics first, then per page heading, figure, table", () => {
    inOrder(generate(data, "markdown"), [
      "## Data Flow Diagram",
      "### DFD Statistics",
      `### ${TOP_T}`,
      `![Data Flow Diagram](${TOP})`,
      "| ID | Name | Type | Description | Assets |",
      "[EE-1](#element-EE-1)",
      `### ${SEN_T}`,
      `![Data Flow Diagram](${SEN})`,
      "[P-1](#element-P-1)",
      `### ${CTL_T}`,
      `_${NO_IMAGE}`,
      "[P-5](#element-P-5)",
    ]);
  });

  it("asciidoc", () => {
    inOrder(generate(data, "asciidoc"), [
      "=== DFD Statistics",
      `=== ${TOP_T}`,
      `image::${TOP}[Data Flow Diagram]`,
      "<<element-EE-1,EE-1>>",
      `=== ${SEN_T}`,
      `image::${SEN}[Data Flow Diagram]`,
      "<<element-P-1,P-1>>",
    ]);
  });

  it("html", () => {
    inOrder(generate(data, "html"), [
      "<h3>DFD Statistics</h3>",
      "<h3>Page &quot;Top&quot;</h3>",
      `<img src="${TOP}" alt="Data Flow Diagram" class="dfd-image">`,
      '<a href="#element-EE-1">EE-1</a>',
      "<h3>Page &quot;Sensor Head&quot; (decomposes MP-1 Sensor Head)</h3>",
      '<a href="#element-P-1">P-1</a>',
      '<p class="dfd-no-image">',
      "</section>",
    ]);
  });

  it("strictdoc: a nested section per page", () => {
    inOrder(generate(data, "strictdoc"), [
      "TITLE: Data Flow Diagram",
      "DFD Statistics:",
      `TITLE: ${TOP_T}`,
      `.. image:: ${TOP}\n   :alt: Data Flow Diagram`,
      "[EE-1](#element-EE-1)",
      `TITLE: ${SEN_T}`,
      `TITLE: ${CTL_T}`,
      NO_IMAGE,
    ]);
  });

  it("the element descriptions no longer repeat the overview", () => {
    for (const format of ["markdown", "asciidoc", "html", "strictdoc"] as const) {
      const out = generate(data, format);
      expect(out).not.toContain("quick overview of all DFD elements");
    }
  });

  it("German", () => {
    const out = generate(data, "markdown", "de");
    inOrder(out, ["### DFD-Statistiken", "### Seite „Top“", "### Seite „Sensor Head“ (zerlegt MP-1 Sensor Head)"]);
    expect(out).toContain("Für diese Seite ist noch kein Bild gespeichert");
  });
});

describe("DFD chapter of a classic project (unchanged)", () => {
  const data = toDocProjectData(project, "en");
  const image = data.dfd?.thumbnail || "dfd.png";

  it.each([
    ["markdown", `![Data Flow Diagram](${image})`, "### DFD Statistics"],
    ["asciidoc", `image::${image}[Data Flow Diagram]`, "=== DFD Statistics"],
    ["html", `<img src="${image}" alt="Data Flow Diagram" class="dfd-image">`, "<h3>DFD Statistics</h3>"],
    ["strictdoc", `.. image:: ${image}\n   :alt: Data Flow Diagram`, "DFD Statistics:"],
  ] as const)("%s: figure, then statistics, then the one overview", (format, figure, stats) => {
    const out = generate(data, format);
    inOrder(out, [figure, stats, "quick overview of all DFD elements"]);
    expect(out).not.toContain('Page "');
  });
});
