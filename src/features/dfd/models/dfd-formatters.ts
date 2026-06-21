// ==================== DFD FORMATTERS ====================
// Formatting and text display functions for DFD elements.
// Single Responsibility: resolve enum/type values to human-readable text via i18n.
// No hardcoded language strings — every label comes from a translate function.

import type { TFunction } from "i18next";
import type { DFDElementType, SecurityLevel, TrustLevel } from "./dfd-types";
import type { AssetGroup, A2ARelationType } from "shared";
import { ASSET_GROUP_CONFIG, AnyAssetRelationType } from "shared";

/**
 * Minimal translate signature: `(key, defaultValue?) => string`.
 * Deliberately narrower than i18next's `TFunction` so that BOTH worlds satisfy it:
 *  - the UI passes the real i18next `t` (a `TFunction`, assignable to this);
 *  - the document generator passes its own `TranslationFn` (structurally identical).
 * Call as `t(key, "default")` — the string default works for both.
 */
export type TranslateFn = (key: string, defaultValue?: string) => string;

// Kept for fixed-language document generation (callers may resolve their
// TranslateFn from i18n.getFixedT(lang)). Display strings never live in code.
export type DocLanguage = "en" | "de";

// ==================== SECURITY LEVEL FORMATTERS ====================

export function getSecurityLevelText(
  level: SecurityLevel | undefined,
  t: TranslateFn,
): string {
  if (!level) return t("tabs.dfd.levels.security.none", "—");
  return t(`tabs.dfd.levels.security.${level}`, level);
}

// ==================== TRUST LEVEL FORMATTERS ====================

export function getTrustLevelText(
  level: TrustLevel | undefined,
  t: TranslateFn,
): string {
  if (!level) return t("tabs.dfd.levels.trust.unknown", "unknown");
  return t(`tabs.dfd.levels.trust.${level}`, level);
}

// ==================== DFD ELEMENT TYPE FORMATTERS ====================

export function getDFDElementTypeText(
  type: DFDElementType,
  t: TranslateFn,
): string {
  return t(`tabs.dfd.elementTypes.${type}.name`, type);
}

export function getDFDElementTypePluralText(
  type: DFDElementType,
  t: TranslateFn,
): string {
  return t(
    `tabs.dfd.elementTypes.${type}.plural`,
    getDFDElementTypeText(type, t),
  );
}

export function getDFDElementTypeDescriptionText(
  type: DFDElementType,
  t: TranslateFn,
): string {
  return t(`tabs.dfd.elementTypes.${type}.description`, "");
}

// ==================== ASSET GROUP FORMATTERS ====================
// UI-only callers — keep the full i18next TFunction (object-form options).

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