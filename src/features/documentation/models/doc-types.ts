// ==================== DOCUMENTATION TYPES ====================
// Core data models for the Documentation Generation feature
// NO dependency on app - follows Dependency Inversion Principle
//
// Architecture:
// - Configurable document format (Markdown, AsciiDoc)
// - Configurable chapters (enable/disable)
// - Template customization (header, footer, logo)
// - Multi-language support (DE/EN independent of UI)

import type { PhaseStatusMap, StrideMethod } from "shared";

// ==================== DOCUMENT FORMAT ====================

/**
 * Supported document output formats
 */
export type DocFormat = "markdown" | "asciidoc";

/**
 * Document language (independent of UI language)
 */
export type DocLanguage = "en" | "de";

// ==================== CHAPTER CONFIGURATION ====================

/**
 * Available chapters in the document
 */
export type DocChapterId =
  | "executive-summary"
  | "system-overview"
  | "dfd"
  | "assets"
  | "threats-per-element"
  | "threats-per-interaction"
  | "risks-per-element"
  | "risks-per-interaction"
  | "accepted-risks"
  | "appendix";

/**
 * Chapter configuration
 */
export interface DocChapterConfig {
  id: DocChapterId;
  enabled: boolean;
  /** Auto-hide if content is empty */
  autoHideIfEmpty: boolean;
  /** Custom title override (optional) */
  customTitle?: string;
  customTitleDE?: string;
}

/**
 * Default chapter titles
 */
export const CHAPTER_TITLES: Record<DocChapterId, { en: string; de: string }> = {
  "executive-summary": {
    en: "Executive Summary",
    de: "Zusammenfassung",
  },
  "system-overview": {
    en: "System Overview",
    de: "Systemübersicht",
  },
  dfd: {
    en: "Data Flow Diagram",
    de: "Datenflussdiagramm",
  },
  assets: {
    en: "Asset Inventory",
    de: "Asset-Inventar",
  },
  "threats-per-element": {
    en: "Threat Analysis (STRIDE per Element)",
    de: "Bedrohungsanalyse (STRIDE pro Element)",
  },
  "threats-per-interaction": {
    en: "Threat Analysis (STRIDE per Interaction)",
    de: "Bedrohungsanalyse (STRIDE pro Interaktion)",
  },
  "risks-per-element": {
    en: "Risk Assessment (STRIDE per Element)",
    de: "Risikobewertung (STRIDE pro Element)",
  },
  "risks-per-interaction": {
    en: "Risk Assessment (STRIDE per Interaction)",
    de: "Risikobewertung (STRIDE pro Interaktion)",
  },
  "accepted-risks": {
    en: "Accepted Risks (Won't Address)",
    de: "Akzeptierte Risiken (Wird nicht behandelt)",
  },
  appendix: {
    en: "Appendix",
    de: "Anhang",
  },
};

/**
 * Default chapter configuration
 */
export const DEFAULT_CHAPTER_CONFIG: DocChapterConfig[] = [
  { id: "executive-summary", enabled: true, autoHideIfEmpty: false },
  { id: "system-overview", enabled: true, autoHideIfEmpty: false },
  { id: "dfd", enabled: true, autoHideIfEmpty: true },
  { id: "assets", enabled: true, autoHideIfEmpty: true },
  { id: "threats-per-element", enabled: true, autoHideIfEmpty: true },
  { id: "threats-per-interaction", enabled: true, autoHideIfEmpty: true },
  { id: "risks-per-element", enabled: true, autoHideIfEmpty: true },
  { id: "risks-per-interaction", enabled: true, autoHideIfEmpty: true },
  { id: "accepted-risks", enabled: true, autoHideIfEmpty: true },
  { id: "appendix", enabled: false, autoHideIfEmpty: true },
];

// ==================== TEMPLATE CONFIGURATION ====================

/**
 * Template configuration for customization
 */
export interface DocTemplateConfig {
  /** Company/Organization name */
  organizationName: string;

  /** Logo path (relative to document) */
  logoPath?: string;

  /** Header text (appears on each page in PDF) */
  headerText?: string;

  /** Footer text (appears on each page in PDF) */
  footerText?: string;

  /** Classification level */
  classification?: "public" | "internal" | "confidential" | "restricted";

  /** Document version (auto or custom) */
  versionMode: "auto" | "custom";
  customVersion?: string;

  /** Include table of contents */
  includeToc: boolean;

  /** Include page numbers (for PDF) */
  includePageNumbers: boolean;

  /** Date format */
  dateFormat: "iso" | "eu" | "us";
}

/**
 * Default template configuration
 */
export const DEFAULT_TEMPLATE_CONFIG: DocTemplateConfig = {
  organizationName: "",
  logoPath: undefined,
  headerText: undefined,
  footerText: undefined,
  classification: undefined,
  versionMode: "auto",
  customVersion: undefined,
  includeToc: true,
  includePageNumbers: true,
  dateFormat: "iso",
};

// ==================== DOCUMENT CONFIGURATION ====================

/**
 * Complete document generation configuration
 */
export interface DocConfiguration {
  /** Output format */
  format: DocFormat;

  /** Document language */
  language: DocLanguage;

  /** Chapter configuration */
  chapters: DocChapterConfig[];

  /** Template configuration */
  template: DocTemplateConfig;
}

/**
 * Default document configuration
 */
export const DEFAULT_DOC_CONFIGURATION: DocConfiguration = {
  format: "markdown",
  language: "en",
  chapters: [...DEFAULT_CHAPTER_CONFIG],
  template: { ...DEFAULT_TEMPLATE_CONFIG },
};

// ==================== DOCUMENT DATA ====================

/**
 * Generated document data
 */
export interface DocData {
  /** Current configuration */
  configuration: DocConfiguration;

  /** Generated document content (Markdown or AsciiDoc) */
  generatedContent?: string;

  /** Last generation timestamp */
  lastGenerated?: string;

  /** Validation state */
  validation?: DocValidation;

  /** Last modified timestamp */
  lastModified: string;
}

export interface DocValidation {
  isComplete: boolean;
  errors: string[];
  warnings: string[];
  lastValidated: string;
}

// ==================== DOCUMENT PROJECT INTERFACE ====================
// What Documentation feature needs from a project (Dependency Inversion)

/**
 * Simplified project info for documentation
 */
export interface DocProjectInfo {
  id: string;
  name: string;
  description: string;
  version: string;
  responsible: string;
  created: string;
  lastModified: string;
  tags: string[];
  team: string[];
}

/**
 * Simplified DFD data for documentation
 */
export interface DocDFDData {
  /** Has DFD content */
  hasDFD: boolean;
  /** DFD thumbnail/image path or base64 */
  imagePath?: string;
  /** Element count stats */
  stats?: {
    totalElements: number;
    externalEntities: number;
    processes: number;
    dataStores: number;
    dataFlows: number;
    trustBoundaries: number;
  };
  /** Element descriptions (future feature) */
  elementDescriptions?: Record<string, string>;
}

/**
 * Simplified asset for documentation
 */
export interface DocAsset {
  id: string;
  name: string;
  description: string;
  overallImpact: number;
  impactLabel: string;
  securityGoals: Array<{
    type: string;
    description: string;
  }>;
  linkedElements: string[];
}

/**
 * Simplified threat for documentation
 */
export interface DocThreat {
  id: string;
  strideCategory: string;
  strideName: string;
  elementOrFlow: string;
  trustBoundary: string;
  threatDescription: string;
  attackDescription: string;
  mitigation: string;
  verification: string;
}

/**
 * Simplified risk for documentation
 */
export interface DocRisk {
  id: string;
  threatId: string;
  strideCategory: string;
  strideName: string;
  threatDescription: string;
  riskBeforeMitigation: number;
  riskBeforeLabel: string;
  selectedMitigations: string[];
  riskAfterMitigation: number;
  riskAfterLabel: string;
  moscowPriority: string;
  moscowLabel: string;
  status: string;
  statusLabel: string;
  /** Only for Won't risks */
  wontJustification?: string;
}

/**
 * Complete project data for documentation generation
 */
export interface DocProjectData {
  id: string;
  name: string;
  phaseStatus: PhaseStatusMap;
  lastModified: string;

  /** Project info */
  info: DocProjectInfo;

  /** DFD data */
  dfd: DocDFDData;

  /** Assets */
  assets: DocAsset[];

  /** Threats per element */
  threatsPerElement: DocThreat[];

  /** Threats per interaction */
  threatsPerInteraction: DocThreat[];

  /** Risks per element */
  risksPerElement: DocRisk[];

  /** Risks per interaction */
  risksPerInteraction: DocRisk[];

  /** Won't risks (accepted) */
  wontRisks: DocRisk[];

  /** Active STRIDE methods */
  activeStrideMethods: StrideMethod[];

  /** Documentation configuration */
  documentation: DocData | null;
}

// ==================== DOCUMENT UPDATE RESULT ====================

export interface DocUpdateResult {
  documentation: DocData;
  phaseStatus: PhaseStatusMap;
  lastModified: string;
}

// ==================== DOCUMENT TAB PROPS ====================

export interface DocTabProps {
  project: DocProjectData;
  onUpdate: (updates: DocUpdateResult) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  onPhaseComplete?: () => void;
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Get chapter title based on language
 */
export function getChapterTitle(
  chapterId: DocChapterId,
  language: DocLanguage,
  customTitle?: string,
  customTitleDE?: string
): string {
  if (language === "de" && customTitleDE) return customTitleDE;
  if (language === "en" && customTitle) return customTitle;
  return CHAPTER_TITLES[chapterId][language];
}

/**
 * Check if a chapter should be visible
 */
export function isChapterVisible(
  chapter: DocChapterConfig,
  hasContent: boolean
): boolean {
  if (!chapter.enabled) return false;
  if (chapter.autoHideIfEmpty && !hasContent) return false;
  return true;
}

/**
 * Format date according to configuration
 */
export function formatDocDate(
  date: string | Date,
  format: DocTemplateConfig["dateFormat"]
): string {
  const d = typeof date === "string" ? new Date(date) : date;

  switch (format) {
    case "eu":
      return d.toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    case "us":
      return d.toLocaleDateString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
      });
    case "iso":
    default:
      return d.toISOString().split("T")[0];
  }
}

/**
 * Create default DocData for new projects
 */
export function createDefaultDocData(): DocData {
  return {
    configuration: { ...DEFAULT_DOC_CONFIGURATION },
    lastModified: new Date().toISOString(),
  };
}

/**
 * Get classification badge text
 */
export function getClassificationText(
  classification: DocTemplateConfig["classification"],
  language: DocLanguage
): string {
  if (!classification) return "";

  const labels: Record<string, { en: string; de: string }> = {
    public: { en: "PUBLIC", de: "ÖFFENTLICH" },
    internal: { en: "INTERNAL", de: "INTERN" },
    confidential: { en: "CONFIDENTIAL", de: "VERTRAULICH" },
    restricted: { en: "RESTRICTED", de: "EINGESCHRÄNKT" },
  };

  return labels[classification]?.[language] ?? classification.toUpperCase();
}