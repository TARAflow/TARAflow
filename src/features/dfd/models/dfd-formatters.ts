// ==================== DFD FORMATTERS ====================
// Formatting and text display functions for DFD elements
// Single Responsibility: Convert enum/type values to human-readable text

import type { DFDElementType, SecurityLevel, TrustLevel } from "./dfd-types";
import type { AssetGroup, AnyAssetRelationType } from "./asset-relation-types";
import { DFD_ELEMENT_CONFIG } from "./dfd-constants";
import {
  DATA_RELATION_LABELS,
  PROCESS_RELATION_LABELS,
  SYSTEM_RELATION_LABELS,
  INFRA_RELATION_LABELS,
  HUMAN_RELATION_LABELS,
  SYSTEM_USES_QUALIFIER_LABELS,
  ASSET_GROUP_CONFIG,
} from "./asset-constants";
import type { SystemUsesQualifier } from "./asset-relation-types";

// ==================== LANGUAGE TYPE ====================

export type DocLanguage = "en" | "de";

// ==================== SECURITY LEVEL FORMATTERS ====================

/**
 * Get human-readable text for security level
 */
export function getSecurityLevelText(
  level: SecurityLevel | undefined,
  language: DocLanguage = "en"
): string {
  if (!level) return language === "de" ? "Keine" : "None";

  const labels: Record<SecurityLevel, { en: string; de: string }> = {
    public:       { en: "Public",       de: "Öffentlich" },
    internal:     { en: "Internal",     de: "Intern" },
    confidential: { en: "Confidential", de: "Vertraulich" },
    secret:       { en: "Secret",       de: "Geheim" },
  };
  return labels[level]?.[language] ?? level;
}

// ==================== TRUST LEVEL FORMATTERS ====================

/**
 * Get human-readable text for trust level
 */
export function getTrustLevelText(
  level: TrustLevel | undefined,
  language: DocLanguage = "en"
): string {
  if (!level) return language === "de" ? "Unbekannt" : "Unknown";

  const labels: Record<TrustLevel, { en: string; de: string }> = {
    trusted:   { en: "Trusted",   de: "Vertrauenswürdig" },
    untrusted: { en: "Untrusted", de: "Nicht vertrauenswürdig" },
    unknown:   { en: "Unknown",   de: "Unbekannt" },
  };
  return labels[level]?.[language] ?? level;
}

// ==================== DFD ELEMENT TYPE FORMATTERS ====================

/**
 * Get DFD element type text (singular)
 */
export function getDFDElementTypeText(
  type: DFDElementType,
  language: DocLanguage = "en"
): string {
  const config = DFD_ELEMENT_CONFIG[type];
  return language === "de" ? config.nameDE : config.name;
}

/**
 * Get DFD element type text (plural for section headers)
 */
export function getDFDElementTypePluralText(
  type: DFDElementType,
  language: DocLanguage = "en"
): string {
  const plurals: Record<DFDElementType, { en: string; de: string }> = {
    ExternalEntity: { en: "External Entities", de: "Externe Entitäten" },
    Process:        { en: "Processes",         de: "Prozesse" },
    Multiprocess:   { en: "Multiprocesses",    de: "Multiprozesse" },
    DataStore:      { en: "Data Stores",       de: "Datenspeicher" },
    DataFlow:       { en: "Data Flows",        de: "Datenflüsse" },
    TrustBoundary:  { en: "Trust Boundaries",  de: "Vertrauensgrenzen" },
    Interface:      { en: "Interfaces",        de: "Schnittstellen" },
  };
  return plurals[type]?.[language] ?? getDFDElementTypeText(type, language);
}

// ==================== ASSET GROUP FORMATTERS ====================

/**
 * Anzeigetext für eine Asset-Gruppe
 * Wird in Tab-Labels verwendet: [Data] [Systems] [Process] [Infra] [People]
 */
export function getAssetGroupText(
  group: AssetGroup,
  language: DocLanguage = "en"
): string {
  const config = ASSET_GROUP_CONFIG[group];
  return language === "de" ? config.labelDE : config.label;
}

/**
 * Farb-Konfiguration für eine Asset-Gruppe
 * Wird für DrawIO-Labels und UI-Badges verwendet
 */
export function getAssetGroupColor(group: AssetGroup): {
  color: string;
  colorLight: string;
} {
  const config = ASSET_GROUP_CONFIG[group];
  return { color: config.color, colorLight: config.colorLight };
}

// ==================== ASSET RELATION TYPE FORMATTERS ====================

/**
 * Anzeigetext für einen Relation-Typ — gruppenspezifisch
 *
 * "monitors" bedeutet in jeder Gruppe etwas anderes:
 * - Process-Gruppe: überwacht den Prozess
 * - System-Gruppe:  liest Systemzustand
 * - Infra-Gruppe:   überwacht physische Parameter
 *
 * Deshalb ist assetGroup ein Pflichtparameter.
 *
 * @example
 * getRelationTypeText("monitors", "system")  // → "Monitors"
 * getRelationTypeText("monitors", "infra")   // → "Monitors" (Physisch)
 */
export function getRelationTypeText(
  relationType: AnyAssetRelationType,
  assetGroup: AssetGroup,
  language: DocLanguage = "en"
): string {
  switch (assetGroup) {
    case "data": {
      const label = DATA_RELATION_LABELS[relationType as keyof typeof DATA_RELATION_LABELS];
      return label?.[language] ?? relationType;
    }
    case "process": {
      const label = PROCESS_RELATION_LABELS[relationType as keyof typeof PROCESS_RELATION_LABELS];
      return label?.[language] ?? relationType;
    }
    case "system": {
      const label = SYSTEM_RELATION_LABELS[relationType as keyof typeof SYSTEM_RELATION_LABELS];
      return label?.[language] ?? relationType;
    }
    case "infrastructure": {
      const label = INFRA_RELATION_LABELS[relationType as keyof typeof INFRA_RELATION_LABELS];
      return label?.[language] ?? relationType;
    }
    case "human": {
      const label = HUMAN_RELATION_LABELS[relationType as keyof typeof HUMAN_RELATION_LABELS];
      return label?.[language] ?? relationType;
    }
  }
}

/**
 * Anzeigetext für einen System-Uses-Qualifier
 *
 * @example
 * getSystemUsesQualifierText("authentication") // → "Authentication"
 */
export function getSystemUsesQualifierText(
  qualifier: SystemUsesQualifier,
  language: DocLanguage = "en"
): string {
  return SYSTEM_USES_QUALIFIER_LABELS[qualifier]?.[language] ?? qualifier;
}

/**
 * Kurz-Label für DrawIO Asset-Label-Anzeige
 * Format: "[AssetId] [relationType]"
 *
 * @example
 * getDrawIOAssetLabel("A1", "reads", "data")     // → "A1 reads"
 * getDrawIOAssetLabel("S2", "uses", "system")    // → "S2 uses"
 */
export function getDrawIOAssetLabel(
  assetDisplayId: string,
  relationType: AnyAssetRelationType,
  assetGroup: AssetGroup
): string {
  // is_an bekommt ein spezielles kurzes Label
  if (relationType === "is_an") {
    return `${assetDisplayId} ≡`;
  }
  return `${assetDisplayId} ${relationType}`;
}
