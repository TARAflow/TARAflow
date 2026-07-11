// @vitest-environment node
//
// taraflow-reporter/tests/integration/report-pipeline.test.ts
//
// Phase 7 smoke test: exercises the full CLI pipeline exactly as
// cli/taraflow-report.ts does — loadProject → toDocProjectData →
// initI18nNode → createCliGenerator → generate() — against the real
// fixture project, and asserts the output is non-empty and contains
// content that does NOT depend on which chapters happen to have data
// (e.g. Assets is auto-hidden when empty — see DEFAULT_CHAPTER_CONFIG in
// doc-types.ts — so we deliberately don't assert on that chapter here).

import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { fileURLToPath } from "url";
import { loadProject } from "../../cli/load-project";
import { toDocProjectData } from "../../cli/to-doc-project-data";
import { initI18nNode } from "../../cli/i18n-node";
import { createCliGenerator } from "../../../src/features/documentation/utils/generators/cli-generators";
import {
  DEFAULT_DOC_CONFIGURATION,
  type DocConfiguration,
  type DocFormat,
} from "../../../src/features/documentation/models/doc-types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(
  __dirname,
  "../../../src/tests/fixtures/Simple_Test_Project.tara.json",
);

const t = (key: string, defaultValue?: string): string => defaultValue ?? key;

describe("full report pipeline (Phase 7 smoke test)", () => {
  beforeAll(async () => {
    await initI18nNode("en");
  });

  it("generates a non-empty markdown report with the project name and always-visible chapters", async () => {
    const { project } = await loadProject(fixturePath);
    const docData = toDocProjectData(project, "en");

    const config: DocConfiguration = {
      ...DEFAULT_DOC_CONFIGURATION,
      format: "markdown",
      language: "en",
    };

    const generator = createCliGenerator(docData, config, t);
    const result = generator.generate();

    expect(result.content.length).toBeGreaterThan(0);
    // Header is unconditional (base-generator.ts generate() always calls
    // generateHeader()), so the project name is a safe, data-independent check.
    expect(result.content).toContain(project.info.name);
    // executive-summary and system-overview both have autoHideIfEmpty: false
    // in DEFAULT_CHAPTER_CONFIG — guaranteed present regardless of fixture data.
    expect(result.content).toContain("Executive Summary");
    expect(result.content).toContain("System Overview");
  });

  it("round-trips through every non-PDF format without throwing", async () => {
    const { project } = await loadProject(fixturePath);
    const docData = toDocProjectData(project, "en");

    const formats: DocFormat[] = ["markdown", "asciidoc", "html", "strictdoc"];
    for (const format of formats) {
      const config: DocConfiguration = { ...DEFAULT_DOC_CONFIGURATION, format };
      const generator = createCliGenerator(docData, config, t);
      expect(() => generator.generate()).not.toThrow();
    }
  });
});
