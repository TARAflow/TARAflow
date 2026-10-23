// @vitest-environment node
//
// The chapter structure of a generated report. Found in the StrictDoc
// output: every DFD element type opened a [SECTION] that was never closed
// (Smoke Detector: 142 opened, 133 closed), so every later chapter nested
// one level deeper. The cause was general: since 1a64e57 the "DFD element
// descriptions" chapter lost its frame (title, intro) in every format —
// its TOC entry pointed nowhere.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { createCliGenerator } from "../../../src/features/documentation/utils/generators/cli-generators";
import { toDocProjectData } from "../../cli/to-doc-project-data";
import type { Project } from "../../../src/app/models/project-types";
import { DEFAULT_DOC_CONFIGURATION, type DocFormat } from "../../../src/features/documentation/models/doc-types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const project = JSON.parse(
  readFileSync(path.join(__dirname, "../../../src/tests/fixtures/Simple_Test_Project.tara.json"), "utf-8"),
) as Project;
const stubT = (key: string, defaultValue?: string): string => defaultValue ?? key;
const generate = (format: DocFormat) =>
  createCliGenerator(toDocProjectData(project, "en"), { ...DEFAULT_DOC_CONFIGURATION, format }, stubT).generate()
    .content;

describe("report structure", () => {
  it("StrictDoc: every [SECTION] is closed, chapters stay on the top level", () => {
    const lines = generate("strictdoc").split("\n");
    let depth = 0;
    const top: string[] = [];
    lines.forEach((line, i) => {
      if (line === "[SECTION]") {
        depth++;
        if (depth === 1) top.push(lines[i + 1].replace("TITLE: ", ""));
      } else if (line === "[/SECTION]") {
        depth--;
        expect(depth).toBeGreaterThanOrEqual(0);
      }
    });
    expect(depth).toBe(0);
    expect(top).toContain("DFD Element Descriptions");
    expect(top).toContain("Asset Inventory");
    expect(top).not.toContain("Security Goals"); // a subsection of the asset chapter
  });

  it("every format has the DFD element descriptions chapter heading", () => {
    expect(generate("markdown")).toContain("## DFD Element Descriptions");
    expect(generate("asciidoc")).toMatch(/^== DFD Element Descriptions$/m);
    expect(generate("html")).toContain("<h2>DFD Element Descriptions</h2>");
  });
});
