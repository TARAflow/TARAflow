// @vitest-environment node
//
// taraflow-reporter/tests/component/pdf-generator.test.ts
//
// Phase 6 component test: generatePdfBufferCli() should produce a real,
// non-empty PDF buffer (checked via the "%PDF" magic bytes at the start
// of the file) without needing a headless browser.
//
// Forces Node environment instead of the project-wide jsdom default
// (vitest.config.ts): pdfmake/pdfkit do `typeof window !== "undefined"`
// environment detection internally, and jsdom's simulated `window` global
// fools them into taking the browser font-loading path even though this
// is genuinely Node — causing "Not a supported font format" here despite
// the exact same code working fine under `npm run report:cli` (real Node,
// no jsdom).

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { generatePdfBufferCli } from "../../../src/features/documentation/utils/generators/cli-generators";
import { toDocProjectData } from "../../cli/to-doc-project-data";
import type { Project } from "../../../src/app/models/project-types";
import { DEFAULT_DOC_CONFIGURATION } from "../../../src/features/documentation/models/doc-types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(
  __dirname,
  "../../../src/tests/fixtures/Simple_Test_Project.tara.json",
);

const stubT = (key: string, defaultValue?: string): string =>
  defaultValue ?? key;

describe("generatePdfBufferCli", () => {
  it("generates a non-empty, valid PDF buffer without a headless browser", async () => {
    const raw = readFileSync(fixturePath, "utf-8");
    const project = JSON.parse(raw) as Project;
    const docData = toDocProjectData(project, "en");

    const config = { ...DEFAULT_DOC_CONFIGURATION, format: "pdf" as const };
    const buffer = await generatePdfBufferCli(docData, config, stubT);

    expect(buffer.length).toBeGreaterThan(0);
    // Every valid PDF file starts with this magic byte sequence.
    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });
});
