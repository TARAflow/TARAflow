// taraflow-reporter/tests/component/dfd-figures-report.test.ts
//
// Leveled-DFD Phase 7a (design §12.1, item 4): every format renders one
// captioned figure per page in page-tree order, and a page without a stored
// image says so; a classic project renders its single figure as before.

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

/** Index of each needle in order; fails if one is missing or out of order. */
const inOrder = (text: string, needles: string[]) => {
  const at = needles.map((n) => text.indexOf(n));
  expect(at.every((i) => i >= 0)).toBe(true);
  expect([...at].sort((a, b) => a - b)).toEqual(at);
};

const NO_IMAGE = "No image of this page is stored yet";

describe("DFD figures per page (leveled DFD, 7a)", () => {
  const data = leveledDocData();

  it("markdown: image, then the caption, per page", () => {
    const out = generate(data, "markdown");
    inOrder(out, [
      `![Data Flow Diagram](${TOP})`,
      '*Page "Top"*',
      `![Data Flow Diagram](${SEN})`,
      '*Page "Sensor Head" (decomposes MP-1 Sensor Head)*',
      NO_IMAGE,
      '*Page "Smoke Detector Controller" (decomposes MP-2 Smoke Detector Controller)*',
    ]);
  });

  it("asciidoc: a titled image block per page", () => {
    const out = generate(data, "asciidoc");
    inOrder(out, [
      `.Page "Top"\nimage::${TOP}[Data Flow Diagram]`,
      `.Page "Sensor Head" (decomposes MP-1 Sensor Head)\nimage::${SEN}[Data Flow Diagram]`,
      `.Page "Smoke Detector Controller" (decomposes MP-2 Smoke Detector Controller)\n_${NO_IMAGE}`,
    ]);
  });

  it("html: a figure with figcaption per page, caption escaped", () => {
    const out = generate(data, "html");
    inOrder(out, [
      `<img src="${TOP}" alt="Data Flow Diagram" class="dfd-image">`,
      "<figcaption>Page &quot;Top&quot;</figcaption>",
      `<img src="${SEN}"`,
      '<p class="dfd-no-image">',
    ]);
  });

  it("strictdoc: an RST figure with caption per page", () => {
    const out = generate(data, "strictdoc");
    inOrder(out, [
      `.. figure:: ${TOP}\n   :alt: Data Flow Diagram\n\n   Page "Top"`,
      `.. figure:: ${SEN}`,
      `**Page "Smoke Detector Controller" (decomposes MP-2 Smoke Detector Controller)**: ${NO_IMAGE}`,
    ]);
  });

  it("captions in German", () => {
    const out = generate(data, "markdown", "de");
    expect(out).toContain("*Seite „Sensor Head“ (zerlegt MP-1 Sensor Head)*");
    expect(out).toContain("Für diese Seite ist noch kein Bild gespeichert");
  });
});

describe("DFD figure of a classic project (unchanged)", () => {
  const data = toDocProjectData(project, "en");
  const image = data.dfd?.thumbnail || "dfd.png";

  it.each([
    ["markdown", `![Data Flow Diagram](${image})`],
    ["asciidoc", `image::${image}[Data Flow Diagram]`],
    ["html", `<img src="${image}" alt="Data Flow Diagram" class="dfd-image">`],
    ["strictdoc", `.. image:: ${image}\n   :alt: Data Flow Diagram`],
  ] as const)("%s renders the single figure as before", (format, line) => {
    const out = generate(data, format);
    expect(out).toContain(line);
    expect(out).not.toContain("Page \"");
  });
});
