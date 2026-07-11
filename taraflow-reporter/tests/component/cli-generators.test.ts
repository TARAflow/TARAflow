// @vitest-environment node
//
// taraflow-reporter/tests/component/cli-generators.test.ts
//
// Component test for createCliGenerator(): instantiates each of the four
// pure generators against the real fixture project and checks that
// generate() produces non-empty content, and that requesting "pdf" throws
// the expected Phase-6 placeholder error instead of silently failing.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { createCliGenerator } from "../../../src/features/documentation/utils/generators/cli-generators";
import { toDocProjectData } from "../../cli/to-doc-project-data";
import type { Project } from "../../../src/app/models/project-types";
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

function loadFixtureProject(): Project {
  const raw = readFileSync(fixturePath, "utf-8");
  return JSON.parse(raw) as Project;
}

// Minimal stub translation function. The real CLI wires a genuine
// i18next-backed t() (see cli/taraflow-report.ts + cli/i18n-node.ts), but
// the pure generators only call the injected t() for tag-category labels —
// a passthrough is enough to exercise the generation path here.
const stubT = (key: string, defaultValue?: string): string =>
  defaultValue ?? key;

const PURE_FORMATS: DocFormat[] = ["markdown", "asciidoc", "html", "strictdoc"];

describe("createCliGenerator", () => {
  const project = loadFixtureProject();
  const docData = toDocProjectData(project, "en");

  it.each(PURE_FORMATS)(
    "generates non-empty content for format '%s'",
    (format) => {
      const config: DocConfiguration = { ...DEFAULT_DOC_CONFIGURATION, format };
      const generator = createCliGenerator(docData, config, stubT);
      const result = generator.generate();

      expect(result.content.length).toBeGreaterThan(0);
      expect(result.format).toBe(format);
    },
  );

  it("throws a clear, actionable error for format 'pdf' (Phase 6 not implemented)", () => {
    const config: DocConfiguration = {
      ...DEFAULT_DOC_CONFIGURATION,
      format: "pdf",
    };

    expect(() => createCliGenerator(docData, config, stubT)).toThrow(/Phase 6/);
  });
});
