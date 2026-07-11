#!/usr/bin/env node
// taraflow-reporter/taraflow-report.ts
//
// Phase 5 (TARAflow CLI Report Plan) — CLI entry point for headless report
// generation from .tara.json, no UI load, no Electron.
//
// Usage:
//   tsx --tsconfig tsconfig.cli.json taraflow-reporter/taraflow-report.ts <input.tara.json> \
//     --format <html|pdf|adoc|md|sdoc> [--lang de|en] [--out path] [--chapters id1,id2,...]
//
// Pipeline: loadProject → initI18nNode → toDocProjectData → createCliGenerator → writeFile
//
// Config defaults come from project.documentation.configuration (e.g. in
// Simple_Test_Project_tara.json, format was "strictdoc") — CLI flags
// override individual fields selectively, without discarding the rest of
// the saved configuration.

import path from "path";
import fs from "fs/promises";
import { loadProject } from "./cli/load-project";
import { toDocProjectData } from "./cli/to-doc-project-data";
import { initI18nNode, i18n } from "./cli/i18n-node";
import {
  createCliGenerator,
  generatePdfBufferCli,
  getFileExtensionCli,
} from "../src/features/documentation/utils/generators/cli-generators";
import type {
  DocConfiguration,
  DocFormat,
  DocLanguage,
  DocChapterConfig,
} from "../src/features/documentation/models/doc-types";

// ==================== ARG PARSING ====================

interface CliArgs {
  input: string;
  format: DocFormat;
  lang?: DocLanguage;
  out?: string;
  chapters?: string[];
}

const VALID_FORMATS: DocFormat[] = ["markdown", "asciidoc", "html", "pdf", "strictdoc"];
const VALID_LANGS: DocLanguage[] = ["en", "de"];

function printUsageAndExit(message?: string): never {
  if (message) console.error(`Error: ${message}\n`);
  console.error(
    "Usage: taraflow-report <input.tara.json> --format <markdown|asciidoc|html|pdf|strictdoc> " +
      "[--lang en|de] [--out path] [--chapters id1,id2,...]",
  );
  process.exit(1);
}

function parseArgs(argv: string[]): CliArgs {
  const [input, ...rest] = argv;
  if (!input) printUsageAndExit("Missing <input.tara.json>");

  let format: DocFormat | undefined;
  let lang: DocLanguage | undefined;
  let out: string | undefined;
  let chapters: string[] | undefined;

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    switch (arg) {
      case "--format": {
        const value = rest[++i];
        if (!VALID_FORMATS.includes(value as DocFormat)) {
          printUsageAndExit(`Invalid --format "${value}". Valid: ${VALID_FORMATS.join(", ")}`);
        }
        format = value as DocFormat;
        break;
      }
      case "--lang": {
        const value = rest[++i];
        if (!VALID_LANGS.includes(value as DocLanguage)) {
          printUsageAndExit(`Invalid --lang "${value}". Valid: ${VALID_LANGS.join(", ")}`);
        }
        lang = value as DocLanguage;
        break;
      }
      case "--out":
        out = rest[++i];
        break;
      case "--chapters":
        chapters = rest[++i]?.split(",").map((s) => s.trim()).filter(Boolean);
        break;
      default:
        printUsageAndExit(`Unknown argument "${arg}"`);
    }
  }

  if (!format) printUsageAndExit("Missing required --format flag");

  return { input, format, lang, out, chapters };
}

// ==================== MAIN ====================

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const { project, migrated, fromVersion } = await loadProject(args.input);
  if (migrated) {
    console.warn(
      `Note: project schema was migrated from v${fromVersion} during load ` +
        `(in-memory only — this CLI does not write the migrated file back to disk).`,
    );
  }

  const baseConfig = project.documentation?.configuration;
  if (!baseConfig) {
    printUsageAndExit(
      `Project ${args.input} has no documentation.configuration. ` +
        `Open it once in the UI and configure the Documentation tab first.`,
    );
  }

  const lang: DocLanguage = args.lang ?? baseConfig.language;

  const chapters = args.chapters
    ? baseConfig.chapters.map((c: DocChapterConfig) => ({
        ...c,
        enabled: args.chapters!.includes(c.id),
      }))
    : baseConfig.chapters;

  const config: DocConfiguration = {
    ...baseConfig,
    format: args.format,
    language: lang,
    chapters,
  };

  await initI18nNode(lang);
  const t = (key: string, defaultValue?: string): string =>
    i18n.getFixedT(lang)(key, { defaultValue });

  const docData = toDocProjectData(project, lang);

  const outPath =
    args.out ??
    path.join(
      path.dirname(path.resolve(args.input)),
      `${path.basename(args.input).replace(/\.tara\.json$/, "")}.${getFileExtensionCli(args.format)}`,
    );

  if (args.format === "pdf") {
    // Phase 6: PDF returns a Buffer (pdfmake, no headless browser),
    // no utf-8 encoding — writeFile with a Buffer writes binary data.
    const buffer = await generatePdfBufferCli(docData, config, t);
    await fs.writeFile(outPath, Uint8Array.from(buffer));
    console.log(`Report written to ${outPath}`);
    return;
  }

  const generator = createCliGenerator(docData, config, t);
  const result = generator.generate();

  await fs.writeFile(outPath, result.content, "utf-8");
  console.log(`Report written to ${outPath}`);
}

main().catch((error: any) => {
  console.error(error?.message ?? error);
  process.exit(1);
});