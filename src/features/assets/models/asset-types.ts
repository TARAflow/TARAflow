// ==================== ASSET TYPES ====================
// Core data models for the Assets feature
// NO dependency on app - follows Dependency Inversion Principle

import type { PhaseStatusMap } from "shared";

// ==================== IMPACT RATING SCALES ====================

/**
 * Available impact rating scales
 */
export type ImpactScaleType = "3-level" | "4-level" | "5-level";

export interface ImpactScaleConfig {
  type: ImpactScaleType;
  levels: ImpactLevel[];
}

export interface ImpactLevel {
  value: number;
  label: string;
  labelDE: string;
  color: string; // Tailwind color class or hex
}

export const IMPACT_SCALES: Record<ImpactScaleType, ImpactScaleConfig> = {
  "3-level": {
    type: "3-level",
    levels: [
      { value: 1, label: "Low", labelDE: "Niedrig", color: "green" },
      { value: 2, label: "Medium", labelDE: "Mittel", color: "yellow" },
      { value: 3, label: "High", labelDE: "Hoch", color: "red" },
    ],
  },
  "4-level": {
    type: "4-level",
    levels: [
      { value: 1, label: "Low", labelDE: "Niedrig", color: "green" },
      { value: 2, label: "Medium", labelDE: "Mittel", color: "yellow" },
      { value: 3, label: "High", labelDE: "Hoch", color: "orange" },
      { value: 4, label: "Critical", labelDE: "Kritisch", color: "red" },
    ],
  },
  "5-level": {
    type: "5-level",
    levels: [
      { value: 1, label: "Low", labelDE: "Niedrig", color: "green" },
      { value: 2, label: "Medium", labelDE: "Mittel", color: "yellow" },
      { value: 3, label: "High", labelDE: "Hoch", color: "orange" },
      { value: 4, label: "Very High", labelDE: "Sehr Hoch", color: "red" },
      { value: 5, label: "Critical", labelDE: "Kritisch", color: "purple" },
    ],
  },
};

// ==================== IMPACT CALCULATION ====================

export type ImpactCalculationMethod = "conservative" | "average";

// ==================== LEVEL THRESHOLD CALCULATION ====================

/**
 * How to round calculated impact values to level thresholds
 * - "round": Standard rounding (Math.round) - symmetric thresholds at .5
 * - "ceil": Conservative rounding (Math.ceil) - always round up to higher level
 */
export type ImpactRoundingMethod = "round" | "ceil";

// ==================== IMPACT CRITERIA ====================

/**
 * Categories for impact criteria
 */
export type ImpactCriteriaCategory = "business" | "physical";

/**
 * Predefined impact criteria that users can choose from
 */
export interface ImpactCriterionDefinition {
  id: string;
  category: ImpactCriteriaCategory;
  name: string;
  nameDE: string;
  description: string;
  descriptionDE: string;
}

/**
 * All available predefined impact criteria
 */
export const PREDEFINED_IMPACT_CRITERIA: ImpactCriterionDefinition[] = [
  // Business / Organizational
  {
    id: "financial_damage",
    category: "business",
    name: "Financial Damage",
    nameDE: "Finanzieller Schaden",
    description: "Costs from outages, SLA violations, RMA, fines",
    descriptionDE: "Kosten durch Ausfälle, SLA-Verletzungen, RMA, Bußgelder",
  },
  {
    id: "regulatory_compliance",
    category: "business",
    name: "Regulatory / Compliance",
    nameDE: "Regulatorik / Compliance",
    description: "Violations of GDPR, ISO 27001, FDA, etc.",
    descriptionDE: "Verstöße gegen DSGVO, ISO 27001, FDA, etc.",
  },
  {
    id: "reputation",
    category: "business",
    name: "Reputation / Brand",
    nameDE: "Reputation / Marke",
    description: "Loss of customer trust, negative media",
    descriptionDE: "Verlust von Kundenvertrauen, negative Medien",
  },
  {
    id: "privacy",
    category: "business",
    name: "Privacy / Data Protection",
    nameDE: "Datenschutz",
    description: "Sensitivity/amount of affected personal data",
    descriptionDE: "Sensitivität/Anzahl betroffener personenbezogener Daten",
  },
  {
    id: "operational",
    category: "business",
    name: "Operational Impact",
    nameDE: "Betriebliche Auswirkung",
    description: "Disruption of critical processes",
    descriptionDE: "Störung kritischer Prozesse",
  },
  {
    id: "affected_users",
    category: "business",
    name: "Affected Users / Systems",
    nameDE: "Betroffene Nutzer / Systeme",
    description: "How many users, units, machines or systems are affected",
    descriptionDE: "Wie viele Nutzer, Einheiten, Maschinen oder Systeme sind betroffen",
  },
  {
    id: "recoverability",
    category: "business",
    name: "Recoverability",
    nameDE: "Wiederherstellbarkeit",
    description: "Effort and time to restore asset after loss or manipulation",
    descriptionDE: "Aufwand und Zeit zur Wiederherstellung nach Verlust oder Manipulation",
  },
  // Physical
  {
    id: "safety",
    category: "physical",
    name: "Safety Impact",
    nameDE: "Sicherheitsauswirkung",
    description: "Risk to persons through physical damage",
    descriptionDE: "Gefährdung von Personen durch physische Schäden",
  },
  {
    id: "physical_damage",
    category: "physical",
    name: "Physical Asset Damage",
    nameDE: "Physischer Anlagenschaden",
    description: "Destruction or damage to physical assets",
    descriptionDE: "Zerstörung oder Beschädigung physischer Assets",
  },
  {
    id: "environmental",
    category: "physical",
    name: "Environmental Impact",
    nameDE: "Umweltauswirkung",
    description: "Environmental damage through manipulated processes",
    descriptionDE: "Umweltschäden durch manipulierte Prozesse",
  },
  {
    id: "supply_chain",
    category: "physical",
    name: "Supply Chain / Logistics",
    nameDE: "Lieferkette / Logistik",
    description: "Disruption of physical supply and transport chains",
    descriptionDE: "Störung physischer Liefer- und Transportketten",
  },
];

// ==================== SECURITY GOALS (CIANAAA) ====================

export type SecurityGoalType =
  | "C"    // Confidentiality
  | "I"    // Integrity
  | "A"    // Availability
  | "N"    // Non-repudiation
  | "AuthZ" // Authorization
  | "AuthN" // Authentication
  | "Acc"; // Accountability

export interface SecurityGoalDefinition {
  type: SecurityGoalType;
  name: string;
  nameDE: string;
  description: string;
  descriptionDE: string;
  templateEN: string;
  templateDE: string;
}

export const SECURITY_GOALS: SecurityGoalDefinition[] = [
  {
    type: "C",
    name: "Confidentiality",
    nameDE: "Vertraulichkeit",
    description: "Protection against unauthorized disclosure",
    descriptionDE: "Schutz vor unbefugter Offenlegung",
    templateEN: "Data must only be accessible by authorized personnel",
    templateDE: "Daten dürfen nur von autorisierten Personen eingesehen werden",
  },
  {
    type: "I",
    name: "Integrity",
    nameDE: "Integrität",
    description: "Protection against unauthorized modification",
    descriptionDE: "Schutz vor unbefugter Änderung",
    templateEN: "Data must be protected against unauthorized modification",
    templateDE: "Daten müssen vor unbefugter Änderung geschützt werden",
  },
  {
    type: "A",
    name: "Availability",
    nameDE: "Verfügbarkeit",
    description: "Ensuring timely and reliable access",
    descriptionDE: "Gewährleistung rechtzeitigen und zuverlässigen Zugriffs",
    templateEN: "System must maintain required availability levels",
    templateDE: "System muss erforderliche Verfügbarkeitsstufen einhalten",
  },
  {
    type: "N",
    name: "Non-repudiation",
    nameDE: "Nichtabstreitbarkeit",
    description: "Ensuring actions cannot be denied",
    descriptionDE: "Sicherstellung, dass Aktionen nicht abgestritten werden können",
    templateEN: "All actions must be traceable and undeniable",
    templateDE: "Alle Aktionen müssen nachvollziehbar und nicht abstreitbar sein",
  },
  {
    type: "AuthZ",
    name: "Authorization",
    nameDE: "Autorisierung",
    description: "Controlling access rights and permissions",
    descriptionDE: "Kontrolle von Zugriffsrechten und Berechtigungen",
    templateEN: "Access must be restricted based on defined permissions",
    templateDE: "Zugriff muss basierend auf definierten Berechtigungen eingeschränkt werden",
  },
  {
    type: "AuthN",
    name: "Authentication",
    nameDE: "Authentifizierung",
    description: "Verifying identity of users or systems",
    descriptionDE: "Überprüfung der Identität von Benutzern oder Systemen",
    templateEN: "Identity must be verified before granting access",
    templateDE: "Identität muss vor Gewährung des Zugriffs verifiziert werden",
  },
  {
    type: "Acc",
    name: "Accountability",
    nameDE: "Rechenschaftspflicht",
    description: "Tracking and logging of actions",
    descriptionDE: "Verfolgung und Protokollierung von Aktionen",
    templateEN: "All actions must be logged for audit purposes",
    templateDE: "Alle Aktionen müssen zu Prüfungszwecken protokolliert werden",
  },
];

// ==================== ASSET CONFIGURATION ====================

/**
 * Project-specific asset configuration
 */
export interface AssetConfiguration {
  /** Selected impact criteria IDs (4-6 recommended) */
  impactCriteria: string[];

  /** Impact rating scale */
  impactScale: ImpactScaleType;

  /** Calculation method for overall impact */
  calculationMethod: ImpactCalculationMethod;

  /** Rounding method for level threshold calculation */
  roundingMethod: ImpactRoundingMethod;
}

/**
 * Default configuration for new projects
 */
export const DEFAULT_ASSET_CONFIGURATION: AssetConfiguration = {
  impactCriteria: [
    "financial_damage",
    "regulatory_compliance",
    "reputation",
    "operational",
    "safety",
  ],
  impactScale: "4-level",
  calculationMethod: "conservative",
  roundingMethod: "round",
};

// ==================== ASSET DATA ====================

/**
 * Impact rating for a single criterion
 */
export interface ImpactRating {
  criterionId: string;
  value: number; // 1-3, 1-4, or 1-5 depending on scale
}

/**
 * Security goal with formal description
 */
export interface SecurityGoal {
  type: SecurityGoalType;
  enabled: boolean;
  formalDescription: string;
}

/**
 * Link to a DFD element
 */
export interface DFDElementLink {
  elementId: string;
  elementName: string;
  elementType: string;
}

/**
 * Core Asset data structure
 */
export interface Asset {
  /** Unique ID (e.g., "A-001", "A-01", "A-1") */
  id: string;
  
  /** Numeric part for sorting and renumbering */
  numericId: number;
  
  /** Asset name/description */
  name: string;
  
  /** Detailed description */
  description: string;
  
  /** Impact ratings per criterion */
  impactRatings: ImpactRating[];
  
  /** Calculated overall impact (based on configuration) */
  overallImpact: number;
  
  /** Selected security goals with formal descriptions */
  securityGoals: SecurityGoal[];
  
  /** Linked DFD elements */
  linkedDFDElements: DFDElementLink[];
  
  /** Source: was this created from DFD or manually? */
  source: "dfd" | "manual";
  
  /** Is this asset synced with DFD? */
  syncedWithDFD: boolean;
  
  /** Timestamps */
  created: string;
  lastModified: string;
}

// ==================== ASSET DATA CONTAINER ====================

/**
 * Complete asset data for a project
 */
export interface AssetData {
  /** Project-specific configuration */
  configuration: AssetConfiguration;
  
  /** List of assets */
  assets: Asset[];
  
  /** DFD image for preview (base64 or URL) */
  dfdPreviewImage?: string;
  
  /** Validation state */
  validation?: AssetValidation;
  
  /** Last modified timestamp */
  lastModified: string;
}

export interface AssetValidation {
  isComplete: boolean;
  errors: string[];
  warnings: string[];
  lastValidated: string;
}

// ==================== EXPORT/IMPORT TYPES ====================

/**
 * Options for asset export
 */
export interface AssetExportOptions {
  includeConfiguration: boolean;
  includeAssets: boolean;
}

/**
 * Exported asset data structure
 */
export interface AssetExportData {
  version: string;
  exportedAt: string;
  projectName?: string;
  configuration?: AssetConfiguration;
  assets?: Asset[];
}

/**
 * Options for asset import
 */
export interface AssetImportOptions {
  importConfiguration: boolean;
  importAssets: boolean;
  mergeAssets: boolean; // true = merge with existing, false = replace
}

// ==================== ASSET PROJECT INTERFACE ====================
// What Assets feature needs from a project (Dependency Inversion)

export interface AssetProjectData {
  id: string;
  name: string;
  assets: AssetData | null;
  phaseStatus: PhaseStatusMap;
  /** DFD data for extracting asset labels */
  dfdXml?: string;
  dfdPreviewImage?: string;
  lastModified: string;
}

// ==================== ASSET UPDATE RESULT ====================
// What Assets returns to app layer after updates

export interface AssetUpdateResult {
  assets: AssetData;
  phaseStatus: PhaseStatusMap;
  lastModified: string;
}

// ==================== ASSET TAB PROPS ====================

export interface AssetTabProps {
  project: AssetProjectData;
  onUpdate: (updates: AssetUpdateResult) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  onPhaseComplete?: () => void;
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Generate next asset ID based on existing assets
 */
export function generateNextAssetId(existingAssets: Asset[]): string {
  if (existingAssets.length === 0) {
    return "A-01";
  }
  
  const maxNumeric = Math.max(...existingAssets.map(a => a.numericId));
  const nextNumeric = maxNumeric + 1;
  
  // Determine padding based on existing format
  const existingId = existingAssets[0]?.id || "A-01";
  const match = existingId.match(/A-(\d+)/);
  const padding = match ? match[1].length : 2;
  
  return `A-${String(nextNumeric).padStart(padding, "0")}`;
}

/**
 * Parse asset ID to extract numeric part
 */
export function parseAssetId(id: string): number {
  const match = id.match(/A-(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Renumber assets sequentially
 */
export function renumberAssets(assets: Asset[]): Asset[] {
  return assets
    .sort((a, b) => a.numericId - b.numericId)
    .map((asset, index) => {
      const newNumericId = index + 1;
      const padding = String(assets.length).length;
      const newId = `A-${String(newNumericId).padStart(Math.max(padding, 2), "0")}`;
      
      return {
        ...asset,
        id: newId,
        numericId: newNumericId,
      };
    });
}

/**
 * Calculate overall impact based on method and rounding
 */
export function calculateOverallImpact(
  ratings: ImpactRating[],
  method: ImpactCalculationMethod,
  roundingMethod: ImpactRoundingMethod = "round"
): number {
  if (ratings.length === 0) return 0;

  const values = ratings.map((r) => r.value).filter((v) => v > 0);
  if (values.length === 0) return 0;

  if (method === "conservative") {
    return Math.max(...values);
  } else {
    const sum = values.reduce((acc, val) => acc + val, 0);
    const avg = sum / values.length;

    // Apply rounding method
    if (roundingMethod === "ceil") {
      return Math.ceil(avg * 10) / 10; // Round up to 1 decimal
    }
    return Math.round(avg * 10) / 10; // Standard rounding to 1 decimal
  }
}

/**
 * Get the discrete level for a calculated impact value
 */
export function getImpactLevel(
  value: number,
  roundingMethod: ImpactRoundingMethod = "round"
): number {
  if (value <= 0) return 0;

  if (roundingMethod === "ceil") {
    return Math.ceil(value);
  }
  return Math.round(value);
}

/**
 * Create empty asset with defaults
 */
export function createEmptyAsset(
  id: string,
  configuration: AssetConfiguration
): Asset {
  const numericId = parseAssetId(id);

  return {
    id,
    numericId,
    name: "",
    description: "",
    impactRatings: configuration.impactCriteria.map((criterionId) => ({
      criterionId,
      value: 0,
    })),
    overallImpact: 0,
    securityGoals: SECURITY_GOALS.map((sg) => ({
      type: sg.type,
      enabled: false,
      formalDescription: "",
    })),
    linkedDFDElements: [],
    source: "manual",
    syncedWithDFD: false,
    created: new Date().toISOString(),
    lastModified: new Date().toISOString(),
  };
}

/**
 * Create default AssetData for new projects
 */
export function createDefaultAssetData(): AssetData {
  return {
    configuration: { ...DEFAULT_ASSET_CONFIGURATION },
    assets: [],
    lastModified: new Date().toISOString(),
  };
}

/**
 * Migrate configuration from older versions (without roundingMethod)
 */
export function migrateAssetConfiguration(
  config: Partial<AssetConfiguration>
): AssetConfiguration {
  return {
    impactCriteria:
      config.impactCriteria ?? DEFAULT_ASSET_CONFIGURATION.impactCriteria,
    impactScale: config.impactScale ?? DEFAULT_ASSET_CONFIGURATION.impactScale,
    calculationMethod:
      config.calculationMethod ?? DEFAULT_ASSET_CONFIGURATION.calculationMethod,
    roundingMethod:
      config.roundingMethod ?? DEFAULT_ASSET_CONFIGURATION.roundingMethod,
  };
}

export function impactValueToLevel(
  value: number,
  rounding: ImpactRoundingMethod
): number {
  if (rounding === "ceil") return Math.ceil(value);
  return Math.round(value);
}
