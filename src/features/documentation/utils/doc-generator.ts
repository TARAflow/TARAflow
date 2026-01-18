// ==================== DOCUMENT GENERATOR ====================
// Public API for document generation
// Location: features/documentation/utils/doc-generator.ts
//
// This is the main entry point for document generation.
// Use the factory function to create the appropriate generator.

import type { DocConfiguration, DocProjectData, DocFormat } from "../models/doc-types";
import {
  BaseDocumentGenerator,
  MarkdownGenerator,
  AsciidocGenerator,
  HtmlGenerator,
  PdfGenerator,
  type TranslationFn,
  type DocumentGeneratorResult,
  type PdfOptions,
} from "./generators";

// Re-export types for convenience
export type { TranslationFn, DocumentGeneratorResult, PdfOptions };

// ==================== FACTORY FUNCTION ====================

/**
 * Create a document generator for the specified format
 */
export function createDocumentGenerator(
  project: DocProjectData,
  config: DocConfiguration,
  t: TranslationFn,
  options?: { pdfOptions?: PdfOptions }
): BaseDocumentGenerator {
  switch (config.format) {
    case "markdown":
      return new MarkdownGenerator(project, config, t);
    case "asciidoc":
      return new AsciidocGenerator(project, config, t);
    case "html":
      return new HtmlGenerator(project, config, t);
    case "pdf":
      return new PdfGenerator(project, config, t, options?.pdfOptions);
    default:
      throw new Error(`Unsupported document format: ${config.format}`);
  }
}

// ==================== CONVENIENCE FUNCTION ====================

/**
 * Generate a document (convenience wrapper)
 * 
 * @param project - Project data
 * @param config - Document configuration
 * @param t - Translation function
 * @param options - Optional generation options (e.g., PDF options)
 * @returns Generated document result with content, format, and filename
 * 
 * @example
 * ```typescript
 * // Markdown
 * const result = generateDocument(projectData, config, t);
 * 
 * // PDF with custom options
 * const pdfResult = generateDocument(projectData, pdfConfig, t, {
 *   pdfOptions: { format: "A4", landscape: false }
 * });
 * ```
 */
export function generateDocument(
  project: DocProjectData,
  config: DocConfiguration,
  t: TranslationFn,
  options?: { pdfOptions?: PdfOptions }
): DocumentGeneratorResult {
  const generator = createDocumentGenerator(project, config, t, options);
  return generator.generate();
}

// ==================== VALIDATION ====================

/**
 * Validate project data for documentation generation
 */
export function validateProjectForDoc(project: DocProjectData): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required fields
  if (!project.info.name) {
    errors.push("Project name is required");
  }

  // Check for empty sections (warnings)
  if (!project.dfd) {
    warnings.push("No DFD available");
  }

  // Check DFD elements with optional chaining
  if (project.dfd && (project.dfd.elements?.length ?? 0) === 0) {
    warnings.push("DFD has no element descriptions");
  }

  // Check assets
  const assetCount = project.assets?.assets?.length ?? 0;
  if (assetCount === 0) {
    warnings.push("No assets defined");
  }

  // Check threats from tables
  const perElementThreats =
    project.threats?.perElementTables?.flatMap((t) => t.threats) ?? [];
  const perInteractionThreats =
    project.threats?.perInteractionTables?.flatMap((t) => t.threats) ?? [];
  const totalThreats = perElementThreats.length + perInteractionThreats.length;

  if (totalThreats === 0) {
    warnings.push("No threats identified");
  }

  // Check risks (excluding won't)
  const allRisks = project.risks?.risks ?? [];
  const activeRisks = allRisks.filter((r) => r.moscowPriority !== "wont");

  if (activeRisks.length === 0) {
    warnings.push("No risks assessed");
  }

  // Check for won't risks without justification
  const wontRisks = allRisks.filter((r) => r.moscowPriority === "wont");
  const missingJustifications = wontRisks.filter(
    (r) => !r.wontJustification || r.wontJustification.trim() === "",
  );
  if (missingJustifications.length > 0) {
    warnings.push(
      `${missingJustifications.length} accepted risk(s) missing justification`,
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Get file extension for a format
 */
export function getFileExtension(format: DocFormat): string {
  switch (format) {
    case "markdown":
      return "md";
    case "asciidoc":
      return "adoc";
    case "html":
      return "html";
    case "pdf":
      return "pdf";
    default:
      return "txt";
  }
}

/**
 * Get MIME type for a format
 */
export function getMimeType(format: DocFormat): string {
  switch (format) {
    case "markdown":
      return "text/markdown";
    case "asciidoc":
      return "text/asciidoc";
    case "html":
      return "text/html";
    case "pdf":
      return "application/pdf";
    default:
      return "text/plain";
  }
}

/**
 * Get supported formats
 */
export function getSupportedFormats(): DocFormat[] {
  return ["markdown", "asciidoc", "html", "pdf"];
}

/**
 * Check if a format is supported
 */
export function isFormatSupported(format: string): format is DocFormat {
  return getSupportedFormats().includes(format as DocFormat);
}