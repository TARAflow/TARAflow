// ==================== GENERATORS INDEX ====================
// Barrel export for all document generators
// Location: features/documentation/utils/generators/index.ts

export {
  BaseDocumentGenerator,
  type TranslationFn,
  type GenerationContext,
  type ChapterContent,
  type DocumentGeneratorResult,
} from "./base-generator";

export { MarkdownGenerator } from "./markdown-generator";
export { AsciidocGenerator } from "./asciidoc-generator";
export { HtmlGenerator } from "./html-generator";
export { PdfGenerator, type PdfOptions } from "./pdf-generator-renderer";
