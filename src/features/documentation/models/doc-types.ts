// ==================== DOCUMENTATION TYPES (HYBRID APPROACH) ====================
// Direct references to feature types + minimal computed values
// Location: features/documentation/models/doc-types.ts

import type { PhaseStatusMap, StrideMethod, StrideCategory } from "shared";

// ==================== DIRECT IMPORTS FROM FEATURES ====================
// Single Source of Truth - no duplication!

import type { ProjectInfoData } from "../../overview/models/overview-types";
import type { DFDData } from "../../dfd/models/dfd-types";
import type { AssetData } from "../../assets/models/asset-types";
import type { ThreatData } from "../../threats/models/threat-types";
import type { RiskData } from "../../risks/models/risk-types";
import type { AttackTreeData } from "../../attacktree/models/attacktree-types";

// ==================== DOCUMENT FORMAT ====================

export type DocFormat = "markdown" | "asciidoc" | "html" | "pdf";
export type DocLanguage = "en" | "de";

// ==================== CHAPTER CONFIGURATION ====================

export type DocChapterId =
  | "executive-summary"
  | "applicable-regulations"
  | "system-overview"
  | "dfd"
  | "dfd-descriptions"
  | "assets"
  | "threats-per-element"
  | "threats-per-interaction"
  | "risks-per-element"
  | "risks-per-interaction"
  | "accepted-risks"
  | "attack-trees"
  | "appendix";

export interface DocChapterConfig {
  id: DocChapterId;
  enabled: boolean;
  autoHideIfEmpty: boolean;
  customTitle?: string;
  customTitleDE?: string;
}

export const CHAPTER_TITLES: Record<DocChapterId, { en: string; de: string }> = {
  "executive-summary": { en: "Executive Summary", de: "Zusammenfassung" },
  "applicable-regulations": {
    en: "Applicable Regulations",
    de: "Anwendbare Regulierungen",
  },
  "system-overview": { en: "System Overview", de: "Systemübersicht" },
  dfd: { en: "Data Flow Diagram", de: "Datenflussdiagramm" },
  "dfd-descriptions": {
    en: "DFD Element Descriptions",
    de: "DFD-Elementbeschreibungen",
  },
  assets: { en: "Asset Inventory", de: "Asset-Inventar" },
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
  "attack-trees": { en: "Attack Trees", de: "Angriffsbäume" },
  appendix: { en: "Appendix", de: "Anhang" },
};

export const DEFAULT_CHAPTER_CONFIG: DocChapterConfig[] = [
  { id: "executive-summary", enabled: true, autoHideIfEmpty: false },
  { id: "applicable-regulations", enabled: true, autoHideIfEmpty: true },
  { id: "system-overview", enabled: true, autoHideIfEmpty: false },
  { id: "dfd", enabled: true, autoHideIfEmpty: true },
  { id: "dfd-descriptions", enabled: true, autoHideIfEmpty: true },
  { id: "assets", enabled: true, autoHideIfEmpty: true },
  { id: "threats-per-element", enabled: true, autoHideIfEmpty: true },
  { id: "threats-per-interaction", enabled: true, autoHideIfEmpty: true },
  { id: "risks-per-element", enabled: true, autoHideIfEmpty: true },
  { id: "risks-per-interaction", enabled: true, autoHideIfEmpty: true },
  { id: "accepted-risks", enabled: true, autoHideIfEmpty: true },
  { id: "attack-trees", enabled: true, autoHideIfEmpty: true },
  { id: "appendix", enabled: false, autoHideIfEmpty: true },
];

// ==================== TEMPLATE CONFIGURATION ====================

export interface DocTemplateConfig {
  organizationName: string;
  logoPath?: string;
  headerText?: string;
  footerText?: string;
  classification?: "public" | "internal" | "confidential" | "restricted";
  versionMode: "auto" | "custom";
  customVersion?: string;
  includeToc: boolean;
  includePageNumbers: boolean;
  dateFormat: "iso" | "eu" | "us";
}

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

export interface DocConfiguration {
  format: DocFormat;
  language: DocLanguage;
  chapters: DocChapterConfig[];
  template: DocTemplateConfig;
}

export const DEFAULT_DOC_CONFIGURATION: DocConfiguration = {
  format: "markdown",
  language: "en",
  chapters: [...DEFAULT_CHAPTER_CONFIG],
  template: { ...DEFAULT_TEMPLATE_CONFIG },
};

// ==================== DOCUMENT DATA ====================

export interface DocData {
  configuration: DocConfiguration;
  generatedContent?: string;
  lastGenerated?: string;
  validation?: DocValidation;
  lastModified: string;
}

export interface DocValidation {
  isComplete: boolean;
  errors: string[];
  warnings: string[];
  lastValidated: string;
}

// ==================== COMPUTED VALUES (CACHED) ====================

/**
 * Pre-computed values for performance
 * These are calculated once during transform and cached
 */
export interface DocComputedValues {
  /** Active STRIDE methods based on actual content */
  activeStrideMethods: StrideMethod[];

  /** Current language for label lookups */
  language: DocLanguage;

  /** Cached impact labels (asset ID -> label) */
  impactLabels: Map<string, string>;

  /** Cached risk labels (risk ID -> label) */
  riskBeforeLabels: Map<string, string>;
  riskAfterLabels: Map<string, string>;

  /** Cached STRIDE names (category -> name) */
  strideNames: Map<StrideCategory, string>;

  /** Cached MoSCoW labels (priority -> label) */
  moscowLabels: Map<string, string>;

  /** Cached status labels (status -> label) */
  statusLabels: Map<string, string>;
}

// ==================== COMPLETE PROJECT DATA ====================

/**
 * Project data for documentation generation
 * Uses DIRECT REFERENCES to feature types - no duplication!
 */
export interface DocProjectData {
  // Basic project metadata
  id: string;
  name: string;
  phaseStatus: PhaseStatusMap;
  lastModified: string;

  // Direct references to feature data (Single Source of Truth!)
  info: ProjectInfoData;
  dfd: DFDData | null;
  assets: AssetData | null;
  threats: ThreatData | null;
  risks: RiskData | null;
  attackTree: AttackTreeData | null;

  // Computed values (performance optimization)
  computed: DocComputedValues;

  // Documentation state
  documentation: DocData | null;
}

// ==================== UPDATE RESULT ====================

export interface DocUpdateResult {
  documentation: DocData;
  phaseStatus: PhaseStatusMap;
  lastModified: string;
}

// ==================== TAB PROPS ====================

export interface DocTabProps {
  project: DocProjectData;
  onUpdate: (updates: DocUpdateResult) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  onPhaseComplete?: () => void;
}

// ==================== HELPER FUNCTIONS ====================

export function getChapterTitle(
  chapterId: DocChapterId,
  language: DocLanguage,
  customTitle?: string,
  customTitleDE?: string,
): string {
  if (language === "de" && customTitleDE) return customTitleDE;
  if (language === "en" && customTitle) return customTitle;
  return CHAPTER_TITLES[chapterId][language];
}

export function isChapterVisible(
  chapter: DocChapterConfig,
  hasContent: boolean,
): boolean {
  if (!chapter.enabled) return false;
  if (chapter.autoHideIfEmpty && !hasContent) return false;
  return true;
}

export function formatDocDate(
  date: string | Date,
  format: DocTemplateConfig["dateFormat"],
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

export function createDefaultDocData(): DocData {
  return {
    configuration: { ...DEFAULT_DOC_CONFIGURATION },
    lastModified: new Date().toISOString(),
  };
}

export function getClassificationText(
  classification: DocTemplateConfig["classification"],
  language: DocLanguage,
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

export function getCriticalityText(
  isHighImpact: boolean,
  language: DocLanguage,
): string {
  if (isHighImpact) {
    return language === "de" ? "Kritisches System" : "Critical System";
  }
  return language === "de" ? "Standard System" : "Standard System";
}

export function getYesNoText(value: boolean, language: DocLanguage): string {
  return value
    ? language === "de"
      ? "Ja"
      : "Yes"
    : language === "de"
      ? "Nein"
      : "No";
}

export function getFormatDisplayName(format: DocFormat): string {
  const names: Record<DocFormat, string> = {
    markdown: "Markdown",
    asciidoc: "AsciiDoc",
    html: "HTML",
    pdf: "PDF",
  };
  return names[format] ?? format;
}

// ==================== LABEL HELPERS (Use Computed or Calculate) ====================

/**
 * Get impact label from computed cache or calculate on-demand
 */
export function getImpactLabel(
  impact: number,
  language: DocLanguage,
  computed?: DocComputedValues,
): string {
  // Try cache first
  if (computed?.impactLabels) {
    const cached = computed.impactLabels.get(impact.toString());
    if (cached) return cached;
  }

  // Fallback to calculation
  // This should ideally use the project's impact scale configuration
  if (impact >= 4) return language === "de" ? "Kritisch" : "Critical";
  if (impact >= 3) return language === "de" ? "Hoch" : "High";
  if (impact >= 2) return language === "de" ? "Mittel" : "Medium";
  return language === "de" ? "Niedrig" : "Low";
}

/**
 * Get risk label from computed cache or calculate on-demand
 */
export function getRiskLabel(
  risk: number,
  language: DocLanguage,
  computed?: DocComputedValues,
): string {
  // Try cache first
  if (computed?.riskBeforeLabels) {
    const cached = computed.riskBeforeLabels.get(risk.toString());
    if (cached) return cached;
  }

  // Fallback to calculation
  if (risk >= 4) return language === "de" ? "Kritisch" : "Critical";
  if (risk >= 3) return language === "de" ? "Hoch" : "High";
  if (risk >= 2) return language === "de" ? "Mittel" : "Medium";
  return language === "de" ? "Niedrig" : "Low";
}

/**
 * Get STRIDE name from computed cache or calculate on-demand
 */
export function getStrideName(
  category: StrideCategory,
  language: DocLanguage,
  computed?: DocComputedValues,
): string {
  // Try cache first
  if (computed?.strideNames) {
    const cached = computed.strideNames.get(category);
    if (cached) return cached;
  }

  // Fallback to lookup
  const names: Record<StrideCategory, { en: string; de: string }> = {
    S: { en: "Spoofing", de: "Spoofing" },
    T: { en: "Tampering", de: "Manipulation" },
    R: { en: "Repudiation", de: "Abstreitbarkeit" },
    I: { en: "Information Disclosure", de: "Informationspreisgabe" },
    D: { en: "Denial of Service", de: "Dienstverweigerung" },
    E: { en: "Elevation of Privilege", de: "Rechteausweitung" },
  };
  return names[category]?.[language] ?? category;
}
