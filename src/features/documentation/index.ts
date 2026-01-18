// ==================== DOCUMENTATION FEATURE ====================
// Phase 6: Documentation Generation
//
// Generates Markdown or AsciiDoc documents from project data
// including DFD, Assets, Threats, and Risk Assessment

// ==================== TYPES ====================
export type {
  DocFormat,
  DocLanguage,
  DocChapterId,
  DocChapterConfig,
  DocTemplateConfig,
  DocConfiguration,
  DocData,
  DocValidation,
  DocProjectData,
  DocUpdateResult,
  DocTabProps,
} from "./models/doc-types";

export {
  CHAPTER_TITLES,
  DEFAULT_CHAPTER_CONFIG,
  DEFAULT_TEMPLATE_CONFIG,
  DEFAULT_DOC_CONFIGURATION,
  getChapterTitle,
  isChapterVisible,
  formatDocDate,
  getClassificationText,
  createDefaultDocData,
} from "./models/doc-types";

// ==================== COMPONENTS ====================
export { DocTab } from "./components/doc-tab";
export { DocPreview } from "./components/doc-preview";
export { DocConfigDialog } from "./components/doc-config-dialog";

// ==================== SERVICES ====================
// export {
//   generateDocument,
//   validateProjectForDoc,
//   generateFilename,
//   getFileExtension,
// } from "./services/doc-generator";

// export {
//   MD_TEMPLATES,
//   ADOC_TEMPLATES,
//   replacePlaceholders,
//   escapeMarkdownTable,
//   escapeAsciiDocTable,
//   truncateText,
//   formatSecurityGoals,
//   formatMitigations,
// } from "./services/doc-templates";
