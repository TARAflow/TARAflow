// @vitest-environment node
//
// taraflow-reporter/tests/component/dfd-figures-pdf.test.ts
//
// Leveled-DFD Phase 7a: the CLI PDF (pdfmake in Node, SVG rasterised with
// resvg) contains one figure per page with a stored image — the leveled
// analysis runs with @xmldom/xmldom as in the CLI.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { generatePdfBufferCli } from "../../../src/features/documentation/utils/generators/cli-generators";
import { toDocProjectData } from "../../cli/to-doc-project-data";
import { installDomParser } from "../../cli/dom-parser-node";
import type { Project } from "../../../src/app/models/project-types";
import {
  DEFAULT_DOC_CONFIGURATION,
  type DocProjectData,
} from "../../../src/features/documentation/models/doc-types";
import fixture from "../../../src/tests/fixtures/leveled/smoke-detector-leveled.json";
import { dfdParser } from "../../../src/features/dfd/services/dfd-parser";
import {
  CONTROLLER,
  LEVELED_PAGES,
  SENSOR,
  SYSTEM,
  flow,
  mxfile,
  node,
} from "../../../src/tests/fixtures/leveled-dfd-xml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const project = JSON.parse(
  readFileSync(path.join(__dirname, "../../../src/tests/fixtures/Simple_Test_Project.tara.json"), "utf-8"),
) as Project;

const svg = (fill: string) =>
  `data:image/svg+xml;base64,${Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="40" height="20" fill="${fill}"/></svg>`,
  ).toString("base64")}`;

/** Image XObjects in the PDF (one per embedded raster image). */
const imageCount = (pdf: Buffer) => (pdf.toString("latin1").match(/\/Subtype\s*\/Image/g) ?? []).length;

describe("CLI PDF with one figure per page", () => {
  it("embeds the image of every page that has one", async () => {
    installDomParser();
    const base = toDocProjectData(project, "en");
    const withPages = (thumbs: Record<string, string>): DocProjectData => ({
      ...base,
      dfd: {
        ...base.dfd!,
        xml: fixture.leveledXml,
        thumbnail: thumbs.sys,
        pages: fixture.pages.map((p) => (thumbs[p.pageId] ? { ...p, thumbnail: thumbs[p.pageId] } : p)),
        elements: fixture.leveledElements,
        connections: fixture.connections,
      } as unknown as DocProjectData["dfd"],
    });
    const config = { ...DEFAULT_DOC_CONFIGURATION, format: "pdf" as const };
    const t = (key: string, defaultValue?: string) => defaultValue ?? key;

    const pdf = (thumbs: Record<string, string>) => generatePdfBufferCli(withPages(thumbs), config, t);

    // A PNG with alpha is an image plus its mask, so count the step per page.
    const one = imageCount(await pdf({ sys: svg("#f00") }));
    const two = imageCount(await pdf({ sys: svg("#f00"), sen: svg("#0f0") }));
    const three = await pdf({ sys: svg("#f00"), sen: svg("#0f0"), ctl: svg("#00f") });
    expect(three.subarray(0, 5).toString()).toBe("%PDF-");
    expect(two - one).toBeGreaterThan(0);
    expect(imageCount(three) - two).toBe(two - one);
  });

  it("renders the table of flows analysed on a parent level (7c)", async () => {
    installDomParser();
    const xml = mxfile(
      SYSTEM.replace(
        "</root>",
        node("ee1", "externalentity", "Debugger", "EE-1", 900) + flow("df8", "debug", "DF-8", "ee1", "mp1") + "</root>",
      ),
      SENSOR,
      CONTROLLER,
    );
    const base = toDocProjectData(project, "en");
    const { elements, connections } = dfdParser.parse(xml, LEVELED_PAGES);
    const data = {
      ...base,
      dfd: { ...base.dfd!, xml, pages: LEVELED_PAGES, elements, connections },
    } as unknown as DocProjectData;
    const pdf = await generatePdfBufferCli(
      data,
      { ...DEFAULT_DOC_CONFIGURATION, format: "pdf" as const },
      (key: string, defaultValue?: string) => defaultValue ?? key,
    );
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
