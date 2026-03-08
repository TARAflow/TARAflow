// ==================== DFD FORMATTERS ====================
// Formatting and text display functions for DFD elements
// Single Responsibility: convert enum/type values to human-readable text

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
 * Returns human-readable text for a security level
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
 * Returns human-readable text for a trust level
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
 * Returns the DFD element type text (singular)
 */
export function getDFDElementTypeText(
  type: DFDElementType,
  language: DocLanguage = "en"
): string {
  const config = DFD_ELEMENT_CONFIG[type];
  return language === "de" ? config.nameDE : config.name;
}

/**
 * Returns the DFD element type text (plural, for section headers)
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
 * Display text for an asset group
 * Used in tab labels: [Data] [Systems] [Process] [Infra] [People]
 */
export function getAssetGroupText(
  group: AssetGroup,
  language: DocLanguage = "en"
): string {
  const config = ASSET_GROUP_CONFIG[group];
  return language === "de" ? config.labelDE : config.label;
}

/**
 * Colour configuration for an asset group
 * Used for DrawIO labels and UI badges
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
 * Display text for a relation type — group-specific
 *
 * "monitors" has a different meaning in each group:
 * - Process group:  monitors the process
 * - System group:   reads system state
 * - Infra group:    monitors physical parameters
 *
 * Therefore assetGroup is a required parameter.
 *
 * @example
 * getRelationTypeText("monitors", "system")  // → "Monitors"
 * getRelationTypeText("monitors", "infra")   // → "Monitors" (Physical)
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
 * Display text for a System Uses qualifier
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
 * Short label for DrawIO asset label display
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
  // is_an gets a special short label
  if (relationType === "is_an") {
    return `${assetDisplayId} ≡`;
  }
  return `${assetDisplayId} ${relationType}`;
}
