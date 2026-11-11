// ==================== DOCUMENTATION TYPES (HYBRID APPROACH) ====================
// Direct references to feature types + minimal computed values
// Location: features/documentation/models/doc-types.ts

import type {
  CalcStamp,
  PhaseStatusMap,
  StrideMethod,
  StrideCategory,
} from "shared";

// ==================== DIRECT IMPORTS FROM FEATURES ====================
// Single Source of Truth - no duplication!

import type { ProjectInfoData } from "features/overview";
import type { DFDData } from "features/dfd";
import type { AssetData } from "features/assets";
import type { ThreatData } from "features/threats";
import type { RiskData } from "features/risks";
import type { AttackTreeData } from "features/attacktree";
import type { ItemDefinition } from "shared/models/item-definition-types";
import type { UncreditedResiduals } from "shared/services/credited-residual";
import type { CybersecurityConcept, VerificationEntry } from "shared/models/cybersecurity-concept-types";

// ==================== DOCUMENT FORMAT ====================

export type DocFormat = "markdown" | "asciidoc" | "html" | "pdf" | "strictdoc";
export type DocLanguage = "en" | "de";

// ==================== CHAPTER CONFIGURATION ====================

export type DocChapterId =
  | "executive-summary"
  | "applicable-regulations"
  | "methodology"
  | "system-overview"
  | "item-definition"
  | "dfd"
  | "dfd-descriptions"
  | "assets"
  | "asset-element-relations"
  | "threats-per-element"
  | "threats-per-interaction"
  | "threats-attack-path"
  | "risks-per-element"
  | "risks-per-interaction"
  | "risks-attack-path"
  | "srsl-assessment"
  | "accepted-risks"
  | "traceability-matrix"
  | "goals-claims"
  | "compliance-matrix"
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
  methodology: { en: "Methodology", de: "Methodik" },
  "system-overview": { en: "System Overview", de: "Systemübersicht" },
  "item-definition": { en: "Item Definition", de: "Item-Definition" },
  dfd: { en: "Data Flow Diagram", de: "Datenflussdiagramm" },
  "dfd-descriptions": {
    en: "DFD Element Descriptions",
    de: "DFD-Elementbeschreibungen",
  },
  assets: { en: "Asset Inventory", de: "Asset-Inventar" },
  "asset-element-relations": {
    en: "Asset-Element Relations",
    de: "Asset-Element-Beziehungen",
  },
  "threats-per-element": {
    en: "Threat Analysis (STRIDE per Element)",
    de: "Bedrohungsanalyse (STRIDE pro Element)",
  },
  "threats-per-interaction": {
    en: "Threat Analysis (STRIDE per Interaction)",
    de: "Bedrohungsanalyse (STRIDE pro Interaktion)",
  },
  "threats-attack-path": {
    en: "Threat Scenarios (Attack Path)",
    de: "Bedrohungsszenarien (Angriffspfad)",
  },
  "risks-per-element": {
    en: "Risk Assessment (STRIDE per Element)",
    de: "Risikobewertung (STRIDE pro Element)",
  },
  "risks-per-interaction": {
    en: "Risk Assessment (STRIDE per Interaction)",
    de: "Risikobewertung (STRIDE pro Interaktion)",
  },
  "risks-attack-path": {
    en: "Risk Assessment (Threat Scenarios)",
    de: "Risikobewertung (Bedrohungsszenarien)",
  },
  "srsl-assessment": {
    en: "SRSL Assessment (EN 50742 Approach A)",
    de: "SRSL-Bewertung (EN 50742 Approach A)",
  },

  "accepted-risks": {
    en: "Accepted Risks (Won't Address)",
    de: "Akzeptierte Risiken (Wird nicht behandelt)",
  },
  "traceability-matrix": {
    en: "Traceability Matrix (ISO/SAE 21434)",
    de: "Rückverfolgbarkeitsmatrix (ISO/SAE 21434)",
  },
  "goals-claims": {
    en: "Cybersecurity Goals and Claims",
    de: "Cybersecurity Goals und Claims",
  },
  // One chapter for every active standard (CM-9) — IEC 62443-4-2 and EN 50742 A (CM-13).
  "compliance-matrix": {
    en: "Requirement Matrix",
    de: "Anforderungsmatrix",
  },
  "attack-trees": { en: "Attack Trees", de: "Angriffsbäume" },
  appendix: { en: "Appendix", de: "Anhang" },
};

export const DEFAULT_CHAPTER_CONFIG: DocChapterConfig[] = [
  { id: "executive-summary", enabled: true, autoHideIfEmpty: false },
  { id: "applicable-regulations", enabled: true, autoHideIfEmpty: true },
  { id: "methodology", enabled: true, autoHideIfEmpty: true },
  { id: "system-overview", enabled: true, autoHideIfEmpty: false },
  // Item definition (WP-09-01, ISO 21434 plan A-5): what is analysed.
  { id: "item-definition", enabled: true, autoHideIfEmpty: true },
  { id: "dfd", enabled: true, autoHideIfEmpty: true },
  { id: "dfd-descriptions", enabled: true, autoHideIfEmpty: true },
  { id: "assets", enabled: true, autoHideIfEmpty: true },
  { id: "asset-element-relations", enabled: true, autoHideIfEmpty: true },
  { id: "threats-per-element", enabled: true, autoHideIfEmpty: true },
  { id: "threats-per-interaction", enabled: true, autoHideIfEmpty: true },
  // Attack trees before the threat scenarios they produce (ISO 21434 plan F10).
  { id: "attack-trees", enabled: true, autoHideIfEmpty: true },
  { id: "threats-attack-path", enabled: true, autoHideIfEmpty: true },
  { id: "risks-per-element", enabled: true, autoHideIfEmpty: true },
  { id: "risks-per-interaction", enabled: true, autoHideIfEmpty: true },
  { id: "risks-attack-path", enabled: true, autoHideIfEmpty: true },
  { id: "srsl-assessment", enabled: true, autoHideIfEmpty: true },
  { id: "accepted-risks", enabled: true, autoHideIfEmpty: true },
  // Goals, claims, verification (WP-09-03/04/05, plan Phase 4) — the
  // outcome of the treatment decisions, before the matrix that lists them.
  { id: "goals-claims", enabled: true, autoHideIfEmpty: true },
  { id: "traceability-matrix", enabled: true, autoHideIfEmpty: true },
  // IEC 62443-4-2 / CRA requirement matrix (iec-62443-4-2-cra-coverage.md
  // §5): the Statement of Applicability derived from the analysed model —
  // only for projects tagged "IEC 62443" or "EN IEC 62443 (CRA)".
  { id: "compliance-matrix", enabled: true, autoHideIfEmpty: true },
  { id: "appendix", enabled: false, autoHideIfEmpty: true },
];

/**
 * Ensure a (possibly older, persisted) chapter list contains every default
 * chapter, in the canonical order, preserving each existing chapter's enabled
 * state / settings. New default chapters (e.g. the EN 50742 SRSL assessment
 * added later) are inserted so existing projects pick them up without a
 * migration.
 */
export function withDefaultChapters(
  chapters: DocChapterConfig[] | undefined,
): DocChapterConfig[] {
  const byId = new Map((chapters ?? []).map((c) => [c.id, c]));
  return DEFAULT_CHAPTER_CONFIG.map((def) => byId.get(def.id) ?? { ...def });
}

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
  /**
   * Outside ISO/SAE 21434 the item definition is the system definition —
   * chapter title and texts without "item" and clause numbers. Absent = ISO
   * wording (data built without the app's transform).
   */
  neutralItemDefinition?: boolean;

  /** Active STRIDE methods based on actual content */
  activeStrideMethods: StrideMethod[];

  /** Current language for label lookups */
  language: DocLanguage;

  /** Cached impact labels (asset ID -> label) */
  impactLabels: Map<string, string>;

  /** Cached STRIDE names (category -> name) */
  strideNames: Map<StrideCategory, string>;

  /** Cached MoSCoW labels (priority -> label) */
  moscowLabels: Map<string, string>;

  /** Cached status labels (status -> label) */
  statusLabels: Map<string, string>;

  /**
   * Methodology record, derived by the app layer (buildMethodologyRecord,
   * ISO/SAE 21434 conformance plan 0b/0d) — the report's methodology chapter
   * renders exactly this, so it cannot describe another method than the one
   * applied. Absent → no methodology chapter.
   */
  methodology?: DocMethodology;
  /**
   * TARA verification status as of the document's creation (ISO/SAE 21434
   * RQ-09-07, plan Phase 4, decision 25), derived by the app layer — only
   * under iso-21434. Absent → no status in the document.
   */
  verification?: DocVerification;
  /**
   * Requirement matrices (iec-62443-4-2-cra-coverage.md §5), one per active
   * standard in registry order (model coverage plan §2.5, CM-9), evaluated by
   * the app layer (buildDocCompliance) — only for projects whose tags select
   * a standard. Absent → no matrix chapter.
   */
  compliance?: DocCompliance[];
  /**
   * Risks whose residual risk is not credited (multi-project TARA I7 (4)):
   * risk id → the measures that do not hold. The report data's risks already
   * carry the credited values (app/services/doc-residual.ts); this is for the
   * "not credited" note. Absent → every residual counts.
   */
  uncreditedResiduals?: UncreditedResiduals;
  /**
   * The threats of the imported components (multi-project TARA phase 6a-1),
   * per component and method, each threat once — built by the app layer from
   * the snapshots. Absent → no imports.
   */
  importedThreats?: DocImportedThreatGroup[];
  /**
   * Risks of imported components (risk id → note): the instance, the
   * component's commit, the factors prefilled from the component and those
   * this TARA overrode, the quantity. Absent → no imports.
   */
  importedRiskNotes?: Map<string, DocImportedRiskNote>;
  /**
   * The attack trees of imported components (6a-1b, ISO/SAE 21434: their
   * paths make the risks): per component and tree the structure once, the
   * paths per instance rated with this TARA's configuration and its window
   * of opportunity per step. Absent → no imported trees.
   */
  importedAttackTrees?: DocImportedAttackTree[];
}

/** One rated path of an imported tree in one instance. */
export interface DocImportedAttackPath {
  /** "SD1:AT-1.2" — the attack-path threats' numbering with the prefix. */
  id: string;
  chain: string[];
  potential?: number;
  /** With this TARA's feasibility configuration; absent while a step is unrated. */
  feasibility?: string;
  relevance: { relevance: string; strideCategory?: string }[];
  /** The window of opportunity per step: this TARA's rating, else the component's value as a suggestion. */
  steps: { name?: string; window?: string; componentWindow?: string; ratable: boolean }[];
}

export interface DocImportedAttackTree {
  componentName: string;
  at: DocComponentAt;
  /** The tree's number in the component (AT-<n>). */
  treeNumber: number;
  /** The component's tree — its structure is shown once. */
  tree: AttackTreeData["trees"][number];
  instances: { prefix: string; paths: DocImportedAttackPath[] }[];
}

/** Where an imported component's state comes from, for "Name @ a1b2c3d4". */
export interface DocComponentAt {
  tag?: string;
  /** Full commit sha; the report shows 8 characters. */
  commit?: string;
  unpinned?: boolean;
}

/** One imported threat — once per component, the instances below where they differ. */
export interface DocImportedThreat {
  /** The threat's id in the component, e.g. "P2-T-1". */
  displayId: string;
  /** The instance threats ("SD1:P2-T-1", …) — link targets of the risk rows. */
  instanceIds: string[];
  strideCategory: ThreatData["perElementTables"][number]["threats"][number]["strideCategory"];
  elementOrFlow: string;
  trustBoundary?: string;
  threatDescription: string;
  attackDescription: string;
  proposedMitigations: ThreatData["perElementTables"][number]["threats"][number]["proposedMitigations"];
  proposedVerifications: ThreatData["perElementTables"][number]["threats"][number]["proposedVerifications"];
  /** The component's relevance decision. */
  relevance: string;
  /** Only the instances that differ: a relevance override of this TARA, another counterpart on a boundary flow. */
  differences: { prefix: string; override?: { relevance: string; rationale: string }; counterpart?: string }[];
}

export interface DocImportedThreatGroup {
  componentName: string;
  at: DocComponentAt;
  method: "per-element" | "per-interaction";
  /** Instance prefixes, e.g. ["SD1", "SD2"]. */
  instances: string[];
  threats: DocImportedThreat[];
}

/** The provenance of an imported risk's rating (E10). */
export interface DocImportedRiskNote {
  componentName: string;
  prefix: string;
  at: DocComponentAt;
  /** Identical units this instance stands for; 1 = one. */
  quantity: number;
  /** Factor ids whose value is the component's (prefilled, not changed). */
  prefilled: string[];
  /** Factor ids prefilled from the component but rated anew by this TARA, with the rationale. */
  overridden: { factorId: string; rationale?: string }[];
}

/** SL-C values of one FR (D-2, D-4, D-14). */
export interface DocComplianceVector {
  fr: string;
  target?: number;
  achievedComponent: number;
  achievedWithSupport: number;
  plannedComponent: number;
  plannedWithSupport: number;
}

/** One row of the Statement of Applicability, names already resolved. */
/** A catalog (or project) mitigation suggested for a gap, its text in the document language (FX-23). */
export interface DocMitigationSuggestion {
  id: string;
  text: string;
}

export interface DocComplianceRow {
  label: string;
  /** The row's group: FR for IEC 62443-4-2, the group id for EN 50742 A. */
  fr: string;
  minSl: number | null;
  /** CRA Annex I Part I letters (CRA edition). */
  cra?: string[];
  status: string;
  source?: string;
  failing: string[];
  unknown: string[];
  supporting: string[];
  mitigations: string[];
  /** Mitigations whose effectiveness is unclear (an imported component's, phase 4b) — not counted. */
  unclearMitigations?: string[];
  /** Cited component claims that do not count (phase 4c): unclear, not effective, or covering part of the row. */
  uncountedClaims?: { id: string; reason: "unclear" | "not_effective" | "partial" }[];
  claims: string[];
  reasoning?: string;
  /** "Title — summary in our own words" (D-27), document language; never normative text. */
  summary: string;
  checklist: string[];
  contradiction?: boolean;
  statementModelChanged?: boolean;
  statementSuperseded?: boolean;
  /** Counts for SL-C (component) in the achieved run (D-14). */
  countsForComponent: boolean;
  /** Catalog mitigations naming the row's requirements, with their text in the document language — for gaps. */
  suggestions: DocMitigationSuggestion[];
  /** EN 50742 A: risks (labels) that fail the row or are not rated yet. */
  risks?: string[];
}

/** A claim the system around the component meets requirements (D-5, IEC-6). */
export interface DocMatrixClaim {
  /** "CLM-04" */
  id: string;
  /** The supporting measure. */
  statement: string;
  responsibleParty?: string;
  reviewBy?: string;
  /** Rows of the standard it covers. */
  rows: string[];
}

/** EN 50742 A (CM-13): the SRSL the risks give per safety function (coverage §9.3). */
export interface DocSrslSummary {
  /** WoO id (project-global, Overview); absent = not set. */
  windowOfOpportunity?: string;
  safetyFunctions: { name: string; srsl?: number; interfaces: string[] }[];
}

export interface DocCompliance {
  /** Short name of the standard — the part's title when the chapter has several (CM-9). */
  standardLabel: string;
  editionTitle: string;
  draft: boolean;
  /** CRA edition: with the Annex I Part I view. */
  cra: boolean;
  ccsc2Label: string;
  /** Display name of the component; absent = the whole model (D-7). */
  component?: string;
  deviceCategories?: { categories: string[]; confirmed: boolean };
  /**
   * The standard has security levels (IEC 62443-4-2): SL table, "SL-C from"
   * and the gaps against the SL-T. False for EN 50742 A — groups, the SRSL
   * per safety function and the open requirements instead (CM-13).
   */
  levels: boolean;
  vectors: DocComplianceVector[];
  /** EN 50742 A: SRSL per safety function, WoO. */
  srsl?: DocSrslSummary;
  /** Supporting claims covering rows of this standard (D-5, IEC-6). */
  claims?: DocMatrixClaim[];
  rows: DocComplianceRow[];
}

/** The verification status the document shows up front. */
export interface DocVerification {
  kind: "verified" | "changed" | "reconfirm" | "outdated" | "failed" | "none";
  latest?: VerificationEntry;
  maxAgeDays: number;
  /** ISO date the status refers to (document creation). */
  asOf: string;
}

/** What the methodology chapter needs from the app's methodology record. */
export interface DocMethodology {
  presetId: string;
  presetNameKey: string;
  impact: {
    scale: string;
    requiredScale?: string;
    scaleConforms: boolean;
    criteriaIds: string[];
    aggregation: string;
  };
  likelihood: {
    method: string;
    feasibilityMethod: string;
    likelihoodModel: string;
    gateRules: Readonly<Record<string, { readonly AND: string; readonly OR: string }>>;
    bands: readonly { level: string; minPotential: number }[];
  };
  treatment: {
    vocabulary: string;
    options: { stored: string; label: string }[];
  };
  securityProperties: readonly string[];
  calcStamps?: { risk: CalcStamp; path: CalcStamp };
  /** iso-21434: risk matrix (impact → feasibility → value 1–5), Annex H.8. */
  riskMatrix?: Readonly<Record<string, Readonly<Record<string, number>>>>;
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
  /** Item Definition (WP-09-01, ISO 21434 plan Phase 1 stage A); absent = none. */
  itemDefinition?: ItemDefinition;
  /** Goals, claims, verifications (WP-09-03/04/05, plan Phase 4); absent = none. */
  cybersecurityConcept?: CybersecurityConcept;
  /** Component under evaluation of the Compliance tab — model fields of the whole component are listed on it (CM-6). */
  complianceComponentId?: string;

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
}

// ==================== HELPER FUNCTIONS ====================

/** Chapter titles outside ISO/SAE 21434 (DocComputedValues.neutralItemDefinition). */
export const NEUTRAL_CHAPTER_TITLES: Partial<Record<DocChapterId, { en: string; de: string }>> = {
  "item-definition": { en: "System Definition", de: "Systemdefinition" },
};

export function getChapterTitle(
  chapterId: DocChapterId,
  language: DocLanguage,
  customTitle?: string,
  customTitleDE?: string,
  neutral = false,
): string {
  if (language === "de" && customTitleDE) return customTitleDE;
  if (language === "en" && customTitle) return customTitle;
  return ((neutral && NEUTRAL_CHAPTER_TITLES[chapterId]) || CHAPTER_TITLES[chapterId])[language];
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
    strictdoc: "StrictDoc",
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
