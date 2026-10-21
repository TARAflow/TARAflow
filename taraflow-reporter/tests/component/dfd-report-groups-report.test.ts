// taraflow-reporter/tests/component/dfd-report-groups-report.test.ts
//
// Leveled-DFD Phase 7d: in every format the threat and risk chapters of a
// leveled DFD are one table per group — Top level, each top-level
// decomposed multiprocess, Not in the DFD — and a risk follows its threat.
// A classic project keeps one table per chapter.

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
const t = (key: string, defaultValue?: string) => defaultValue ?? key;

const xml = mxfile(
  SYSTEM.replace(
    "</root>",
    node("ee1", "externalentity", "Debugger", "EE-1", 900) + flow("df8", "debug", "DF-8", "ee1", "mp1") + "</root>",
  ),
  SENSOR,
  CONTROLLER,
);

/** One threat (and its risk) per element: Top, MP-1, MP-2 and one gone from the DFD. */
function leveledDocData(): DocProjectData {
  const base = toDocProjectData(project, "en");
  const { elements, connections } = dfdParser.parse(xml, LEVELED_PAGES);
  const table = base.threats!.perElementTables[0];
  const template = table.threats[0];
  const riskTemplate = base.risks!.risks.find((r) => r.sourceStrideMethod === "per-element")!;
  const on = [
    ["T-TOP", "ee1", "Debugger"],
    ["T-SEN", "sen_p2", "Sample Smoke Sensor"],
    ["T-CTL", "ctl_p5", "Evaluate Alarm"],
    ["T-GONE", "nope", "Removed"],
  ] as const;
  const threats = on.map(([displayId, elementId, elementName]) => ({
    ...template,
    id: `id-${displayId}`,
    displayId,
    linkedElement: { ...template.linkedElement!, elementId, elementName },
    dataFlow: null,
  }));
  const risks = on.map(([displayId]) => ({
    ...riskTemplate,
    id: `risk-${displayId}`,
    threatId: `id-${displayId}`,
    threatDisplayId: displayId,
  }));
  return {
    ...base,
    dfd: { ...base.dfd!, xml, pages: LEVELED_PAGES, elements, connections } as unknown as DocProjectData["dfd"],
    threats: { ...base.threats!, perElementTables: [{ ...table, threats }], perInteractionTables: [] },
    risks: { ...base.risks!, risks },
  };
}

const generate = (data: DocProjectData, format: DocFormat, language: "en" | "de" = "en") =>
  createCliGenerator(data, { ...DEFAULT_DOC_CONFIGURATION, format, language }, t).generate().content;

/** Fails unless every needle occurs, in this order, from `start` on. */
const inOrder = (text: string, needles: string[], start = 0) => {
  let from = start;
  for (const needle of needles) {
    const at = text.indexOf(needle, from);
    expect(at, `"${needle}" after position ${from}`).toBeGreaterThanOrEqual(0);
    from = at + needle.length;
  }
};

describe("threat and risk chapters grouped (leveled DFD, 7d)", () => {
  const data = leveledDocData();
  const GROUPS = ["Top level", "MP-1 Sensor Module", "MP-2 Controller Module", "Not in the DFD"];

  it("markdown: a heading and table per group, in both chapters", () => {
    const out = generate(data, "markdown");
    const threats = out.indexOf("## Threat Analysis (STRIDE per Element)");
    const risks = out.indexOf("## Risk Assessment (STRIDE per Element)");
    expect(threats).toBeGreaterThan(0);
    expect(risks).toBeGreaterThan(threats);
    inOrder(
      out,
      GROUPS.flatMap((g, i) => [`### ${g}`, ["T-TOP", "T-SEN", "T-CTL", "T-GONE"][i]]),
      threats,
    );
    inOrder(
      out,
      GROUPS.flatMap((g, i) => [`### ${g}`, ["T-TOP", "T-SEN", "T-CTL", "T-GONE"][i]]),
      risks,
    );
  });

  it("asciidoc, html, strictdoc: the same groups", () => {
    const sections = (text: string, open: (g: string) => string) =>
      inOrder(text, GROUPS.map(open), text.indexOf("STRIDE per Element"));
    sections(generate(data, "asciidoc"), (g) => `=== ${g}`);
    sections(generate(data, "html"), (g) => `<h3>${g}</h3>`);
    sections(generate(data, "strictdoc"), (g) => `TITLE: ${g}`);
  });

  it("strictdoc: the group sections are balanced in both chapters", () => {
    const generator = createCliGenerator(
      data,
      { ...DEFAULT_DOC_CONFIGURATION, format: "strictdoc", language: "en" },
      t,
    ) as unknown as { generateAllChapters(): { id: string; content: string }[] };
    const chapters = generator
      .generateAllChapters()
      .filter((c) => c.id === "threats-per-element" || c.id === "risks-per-element");
    expect(chapters).toHaveLength(2);
    for (const { content } of chapters) {
      expect(content.match(/^\[SECTION\]$/gm)?.length).toBe(content.match(/^\[\/SECTION\]$/gm)?.length);
    }
  });

  it("German", () => {
    inOrder(generate(data, "markdown", "de"), ["### Oberste Ebene", "### MP-1 Sensor Module", "### Nicht im DFD"]);
  });
});

describe("threat and risk chapters of a classic project (unchanged)", () => {
  it("has no group headings", () => {
    const out = generate(toDocProjectData(project, "en"), "markdown");
    expect(out).not.toContain("### Top level");
    expect(out).not.toContain("### Not in the DFD");
  });
});
