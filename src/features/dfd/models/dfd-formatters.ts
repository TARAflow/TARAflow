// ==================== DFD FORMATTERS ====================
// Formatting and text display functions for DFD elements
// Single Responsibility: Convert enum/type values to human-readable text

import type {
  DFDElementType,
  AssetRelationType,
  SecurityLevel,
  TrustLevel,
} from "./dfd-types";
import { DFD_ELEMENT_CONFIG, ALLOWED_ASSET_RELATIONS } from "./dfd-constants";

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
    public: { en: "Public", de: "Öffentlich" },
    internal: { en: "Internal", de: "Intern" },
    confidential: { en: "Confidential", de: "Vertraulich" },
    secret: { en: "Secret", de: "Geheim" },
  };
  return labels[level]?.[language] ?? level;
}

/**
 * Get human-readable text for trust level
 */
export function getTrustLevelText(
  level: TrustLevel | undefined,
  language: DocLanguage = "en"
): string {
  if (!level) return language === "de" ? "Unbekannt" : "Unknown";

  const labels: Record<TrustLevel, { en: string; de: string }> = {
    trusted: { en: "Trusted", de: "Vertrauenswürdig" },
    untrusted: { en: "Untrusted", de: "Nicht vertrauenswürdig" },
    unknown: { en: "Unknown", de: "Unbekannt" },
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
    Process: { en: "Processes", de: "Prozesse" },
    Multiprocess: { en: "Multiprocesses", de: "Multiprozesse" },
    DataStore: { en: "Data Stores", de: "Datenspeicher" },
    DataFlow: { en: "Data Flows", de: "Datenflüsse" },
    TrustBoundary: { en: "Trust Boundaries", de: "Vertrauensgrenzen" },
    Interface: { en: "Interfaces", de: "Schnittstellen" },
  };
  return plurals[type]?.[language] ?? getDFDElementTypeText(type, language);
}

// ==================== ASSET RELATION FORMATTERS ====================

/**
 * Get allowed asset relation types for a given element type
 */
export function getAllowedAssetRelations(
  elementType: DFDElementType
): AssetRelationType[] {
  return ALLOWED_ASSET_RELATIONS[elementType] || [];
}

/**
 * Check if a relation type is allowed for an element type
 */
export function isAssetRelationAllowed(
  elementType: DFDElementType,
  relationType: AssetRelationType
): boolean {
  return ALLOWED_ASSET_RELATIONS[elementType]?.includes(relationType) ?? false;
}

/**
 * Get human-readable text for asset relation type
 */
export function getAssetRelationTypeText(
  relationType: AssetRelationType,
  language: DocLanguage = "en"
): string {
  const labels: Record<AssetRelationType, { en: string; de: string }> = {
    stores: {
      en: "Stores",
      de: "Speichert",
    },

    read: {
      en: "Processes (read / compute)",
      de: "Verarbeitet (lesen / berechnen)",
    },

    modify: {
      en: "Processes (modify / change)",
      de: "Verarbeitet (verändert)",
    },

    creates: {
      en: "Creates",
      de: "Erzeugt",
    },

    deletes: {
      en: "Destroys",
      de: "Löscht",
    },

    transports: {
      en: "Transports",
      de: "Transportiert",
    },
  };

  return labels[relationType]?.[language] ?? relationType;
}