// features/documentation/utils/generators/cli-generators.ts
//
// Phase 2 (TARAflow CLI Report Plan) — CLI-Generator-Factory.
//
// Importiert die vier reinen Generatoren DIREKT, nicht über
// generators/index.ts — der Barrel dort reexportiert zusätzlich
// PdfGenerator aus pdf-generator-renderer.ts (window/IPC-gekoppelt,
// nur UI). Ein Import des Barrels würde diesen Renderer-Pfad in den
// CLI-Graphen ziehen und damit die Purity Boundary verletzen.
//
// UI bleibt unberührt: doc-generator.ts (die bestehende UI-Factory,
// createDocumentGenerator) wird von diesem File nicht angefasst und
// weiterhin vom bestehenden Hook genutzt.
//
// Verifiziert gegen die echte doc-generator.ts:
//   - createDocumentGenerator schaltet über config.format, nicht über
//     einen separaten Parameter. createCliGenerator hier macht dasselbe,
//     damit die Aufruf-Konventionen zwischen UI- und CLI-Factory identisch
//     bleiben.
//   - getFileExtension(format) existiert bereits in doc-generator.ts,
//     ist für sich genommen pure Logik (nur ein switch über Format-
//     Strings) — ABER doc-generator.ts importiert am Dateikopf aus dem
//     "./generators"-Barrel (der PdfGenerator/pdf-generator-renderer
//     mitschleppt). Jeder Import AUS doc-generator.ts, auch nur für
//     getFileExtension, würde also transitiv den unreinen Barrel laden.
//     Da doc-generator.ts laut Plan zu den nie angefassten Files gehört,
//     wird die Format→Extension-Logik hier minimal dupliziert statt
//     doc-generator.ts zu refactoren.

import type {
  DocConfiguration,
  DocProjectData,
  DocFormat,
} from "../../models/doc-types";
import type {
  TranslationFn,
  DocumentGeneratorResult,
} from "./base-generator";
import type { PdfOptions } from "./pdf-generator-adaptive";
import { MarkdownGenerator } from "./markdown-generator";
import { AsciidocGenerator } from "./asciidoc-generator";
import { HtmlGenerator } from "./html-generator";
import { StrictdocGenerator } from "./strictdoc-generator";

// ==================== TYPES ====================

export interface CliGenerator {
  generate(): DocumentGeneratorResult;
  getFormat(): string;
  getFileExtension(): string;
}

// ==================== FILE EXTENSION (dupliziert aus doc-generator.ts) ====================
//
// Bewusst dupliziert statt importiert — siehe Kommentar oben. Muss bei
// Änderungen an doc-generator.ts::getFileExtension synchron gehalten
// werden (aktuell 5 Formate: markdown, asciidoc, html, pdf, strictdoc).

export function getFileExtensionCli(format: DocFormat): string {
  switch (format) {
    case "markdown":
      return "md";
    case "asciidoc":
      return "adoc";
    case "html":
      return "html";
    case "pdf":
      return "pdf";
    case "strictdoc":
      return "sdoc";
    default:
      return "txt";
  }
}

// ==================== FACTORY ====================

/**
 * Creates a document generator for the CLI path. Mirrors
 * createDocumentGenerator aus doc-generator.ts (schaltet ebenfalls über
 * config.format), minus dem PDF-Branch (siehe Phase 6).
 */
export function createCliGenerator(
  project: DocProjectData,
  config: DocConfiguration,
  t: TranslationFn,
): CliGenerator {
  switch (config.format) {
    case "markdown":
      return new MarkdownGenerator(project, config, t);
    case "asciidoc":
      return new AsciidocGenerator(project, config, t);
    case "html":
      return new HtmlGenerator(project, config, t);
    case "strictdoc":
      return new StrictdocGenerator(project, config, t);
    case "pdf":
      // PDF requires a headless browser (Puppeteer/Playwright). Not wired
      // into the CLI path yet — see Phase 6. Note: package.json no longer
      // lists Puppeteer as a dependency (the UI path switched to Electron's
      // webContents.printToPDF in pdf-generator-main.ts, which has no Node
      // equivalent). Phase 6 must add Puppeteer/Playwright fresh, scoped to
      // the CLI build only, not the Electron app.
      throw new Error(
        "PDF requires --format pdf path (Phase 6) — not yet implemented for CLI.",
      );
    default:
      throw new Error(`Unsupported document format: ${config.format}`);
  }
}

/**
 * Thin wrapper: create the right generator and produce the document.
 */
export function generateDocumentCli(
  project: DocProjectData,
  config: DocConfiguration,
  t: TranslationFn,
): DocumentGeneratorResult {
  const generator = createCliGenerator(project, config, t);
  return generator.generate();
}

// ==================== PDF (Phase 6 — Node, kein Headless-Browser) ====================
//
// Bewusst NICHT Teil von createCliGenerator()/CliGenerator — PDF liefert
// binären Buffer-Content, nicht string wie die vier Text-Formate (gleiche
// Trennung wie beim UI-Pendant PdfGeneratorAdaptive, das generate() und
// generatePdfBuffer() ebenfalls als zwei getrennte Methoden führt).
//
// Dynamischer Import von PdfMakeConverter + pdf-generator-node: Wer nur
// markdown/asciidoc/html/strictdoc anfordert, zieht pdfmake nie in den
// Graphen.

const DEFAULT_PDF_OPTIONS_CLI: PdfOptions = {
  format: "A4",
  landscape: false,
  margin: { top: 20, right: 15, bottom: 20, left: 15 },
  displayHeaderFooter: true,
  printBackground: true,
  scale: 1,
};

export async function generatePdfBufferCli(
  project: DocProjectData,
  config: DocConfiguration,
  t: TranslationFn,
  pdfOptions: Partial<PdfOptions> = {},
): Promise<Buffer> {
  const { PdfMakeConverter } = await import("./pdfmake-converter");
  const { generatePdfBufferNode } = await import("./pdf-generator-node");

  const converter = new PdfMakeConverter(project, config, t);
  const docDefinition = converter.createDocumentDefinition({
    ...DEFAULT_PDF_OPTIONS_CLI,
    ...pdfOptions,
  });

  return generatePdfBufferNode(docDefinition);
}