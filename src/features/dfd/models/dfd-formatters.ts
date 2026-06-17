// ==================== DFD FORMATTERS ====================
// Formatting and text display functions for DFD elements.
// Single Responsibility: convert enum/type values to human-readable text.

import type { TFunction } from "i18next";
import type { DFDElementType, SecurityLevel, TrustLevel } from "./dfd-types";
import type { AssetGroup, A2ARelationType } from "shared";
import { DFD_ELEMENT_CONFIG } from "./dfd-constants";
import { ASSET_GROUP_CONFIG, AnyAssetRelationType } from "shared";

export type DocLanguage = "en" | "de";

// ==================== SECURITY LEVEL FORMATTERS ====================

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

export function getDFDElementTypeText(
  type: DFDElementType,
  language: DocLanguage = "en"
): string {
  const config = DFD_ELEMENT_CONFIG[type];
  return language === "de" ? config.nameDE : config.name;
}

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
    ChipBoundary: { en: "Chip Boundaries", de: "Chip Boundaries" },
    PhysicalBoundary: { en: "Physical Boundaries", de: "Physische Grenzen" },
  };
  return plurals[type]?.[language] ?? getDFDElementTypeText(type, language);
}

// ==================== ASSET GROUP FORMATTERS ====================

/**
 * Display text for an asset group — reads from i18n.
 * Key: assets.groups.<group>
 */
export function getAssetGroupText(group: AssetGroup, t: TFunction): string {
  return t(`assets.groups.${group}`, { defaultValue: group });
}

/**
 * Color configuration for an asset group.
 * Still read from ASSET_GROUP_CONFIG — colors are not i18n concerns.
 */
export function getAssetGroupColor(group: AssetGroup): {
  color: string;
  colorLight: string;
} {
  const config = ASSET_GROUP_CONFIG[group];
  return { color: config.color, colorLight: config.colorLight };
}

// ==================== ASSET RELATION TYPE FORMATTERS ====================

export function getRelationTypeText(
  relationType: AnyAssetRelationType,
  assetGroup: AssetGroup,
  t: TFunction,
): string {
  return t(`assets.relations.element.${assetGroup}.${relationType}`, {
    defaultValue: relationType,
  });
}

export function getA2ARelationTypeText(
  relationType: A2ARelationType,
  t: TFunction,
): string {
  return t(`assets.relations.a2a.${relationType}`, {
    defaultValue: relationType,
  });
}

export function getQualifierText(
  qualifier: string,
  assetGroup: AssetGroup,
  t: TFunction,
): string {
  return t(`assets.relations.qualifiers.${assetGroup}.${qualifier}`, {
    defaultValue: qualifier,
  });
}

/**
 * Short label for DrawIO asset label display.
 * Format: "[AssetId] [relationType]"
 */
export function getDrawIOAssetLabel(
  assetDisplayId: string,
  relationType: AnyAssetRelationType,
): string {
  if (relationType === "is_an") return `${assetDisplayId} ≡`;
  return `${assetDisplayId} ${relationType}`;
}