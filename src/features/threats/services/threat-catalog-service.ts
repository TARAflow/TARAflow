// ==================== THREAT CATALOG SERVICE ====================
// Loads the four language-neutral catalog files and provides:
//   - Localized text via i18next (no isGerman, no locale === 'de')
//   - Context filtering by ProjectSettings (wired; activated in Step 4)
//   - Mitigation / verification ref resolution

import i18n from "i18next";
import type { StrideCategory } from "shared";
import type {
  ElementTemplate,
  InteractionTemplate,
  MitigationEntry,
  VerificationEntry,
  TemplateContext,
  ProjectSettings,
  ThreatTemplate,
  MitigationTemplate,
  VerificationTemplate,
} from "../models/threat-types";

import elementTemplatesData from "./element-templates.json";
import interactionTemplatesData from "./interaction-templates.json";
import mitigationsData from "./mitigations.json";
import verificationsData from "./verifications.json";

// ==================== CATALOG SINGLETONS ====================

const ALL_ELEMENT_TEMPLATES: ElementTemplate[] =
  (elementTemplatesData as any).elementTemplates ?? [];

const ALL_INTERACTION_TEMPLATES: InteractionTemplate[] =
  (interactionTemplatesData as any).interactionTemplates ?? [];

const ALL_MITIGATIONS: MitigationEntry[] =
  (mitigationsData as any).mitigations ?? [];

const ALL_VERIFICATIONS: VerificationEntry[] =
  (verificationsData as any).verifications ?? [];

// ==================== CONTEXT FILTERING ====================

/**
 * Returns true when a template's context matches the given project settings.
 * AND logic across keys (industry AND platform AND standards must all match).
 * OR logic within a key (any single value in the array suffices).
 * Missing or empty array = universal (always matches).
 *
 * NOTE: Context filtering is wired here but NOT yet activated in the generators
 * (Step 4). Generators currently call getAllElementTemplates() directly.
 */
export function matchesContext(
  templateCtx: TemplateContext,
  settings: ProjectSettings
): boolean {
  const { industry, platform, standards } = templateCtx;
  if (industry?.length && !industry.includes(settings.industry)) return false;
  if (platform?.length && !platform.includes(settings.platform)) return false;
  if (
    standards?.length &&
    !standards.some((s) => settings.standards.includes(s))
  )
    return false;
  return true;
}

// ==================== ELEMENT TEMPLATE ACCESS ====================

export function getAllElementTemplates(): ElementTemplate[] {
  return ALL_ELEMENT_TEMPLATES;
}

/**
 * Returns element templates filtered by strideCategory, elementType,
 * and (when settings provided) project context.
 */
export function getApplicableElementTemplates(
  strideCategory: StrideCategory,
  elementType: string,
  settings?: ProjectSettings
): ElementTemplate[] {
  return ALL_ELEMENT_TEMPLATES.filter((t) => {
    if (t.strideCategory !== strideCategory) return false;
    if (!t.elementTypes.includes(elementType)) return false;
    if (settings && !matchesContext(t.context, settings)) return false;
    return true;
  });
}

export function findElementTemplate(
  strideCategory: StrideCategory,
  elementType: string,
  settings?: ProjectSettings
): ElementTemplate | undefined {
  return getApplicableElementTemplates(
    strideCategory,
    elementType,
    settings
  )[0];
}

// ==================== INTERACTION TEMPLATE ACCESS ====================

export function getAllInteractionTemplates(): InteractionTemplate[] {
  return ALL_INTERACTION_TEMPLATES;
}

export function getApplicableInteractionTemplates(
  strideCategory: StrideCategory,
  perspective: "sender" | "receiver",
  settings?: ProjectSettings
): InteractionTemplate[] {
  return ALL_INTERACTION_TEMPLATES.filter((t) => {
    if (t.strideCategory !== strideCategory) return false;
    if (t.perspective !== perspective) return false;
    if (settings && !matchesContext(t.context, settings)) return false;
    return true;
  });
}

export function findInteractionTemplate(
  strideCategory: StrideCategory,
  perspective: "sender" | "receiver",
  settings?: ProjectSettings
): InteractionTemplate | undefined {
  return getApplicableInteractionTemplates(
    strideCategory,
    perspective,
    settings
  )[0];
}

// ==================== LOCALIZATION ====================

/**
 * Returns the localized threat description for an element template.
 * Uses i18next — no isGerman flag needed.
 */
export function getLocalizedElementThreat(templateId: string): string {
  return i18n.t(`${templateId}.threat`, { ns: "element-threats-attacks" });
}

export function getLocalizedElementAttack(templateId: string): string {
  return i18n.t(`${templateId}.attack`, { ns: "element-threats-attacks" });
}

/** Returns the root cause description for an element template, empty string if not defined. */
export function getLocalizedElementCause(templateId: string): string {
  return i18n.t(`${templateId}.cause`, { ns: "element-threats-attacks", defaultValue: "" });
}

export function getLocalizedInteractionThreat(
  templateId: string,
  placeholders: {
    sourceName: string;
    targetName: string;
    dataFlowName: string;
    trustBoundaryName: string;
    sourceType?: string;
    targetType?: string;
  }
): string {
  return i18n.t(`${templateId}.threat`, {
    ns: "interaction-threats-attacks",
    interpolation: { escapeValue: false },
    ...placeholders,
  });
}

export function getLocalizedInteractionAttack(
  templateId: string,
  placeholders: {
    sourceName: string;
    targetName: string;
    dataFlowName: string;
    trustBoundaryName: string;
    sourceType?: string;
    targetType?: string;
  }
): string {
  return i18n.t(`${templateId}.attack`, {
    ns: "interaction-threats-attacks",
    interpolation: { escapeValue: false },
    ...placeholders,
  });
}

/** Returns the root cause for an interaction template with placeholder resolution. */
export function getLocalizedInteractionCause(
  templateId: string,
  placeholders: {
    sourceName: string;
    targetName: string;
    dataFlowName: string;
    trustBoundaryName: string;
    sourceType?: string;
    targetType?: string;
  }
): string {
  return i18n.t(`${templateId}.cause`, {
    ns: "interaction-threats-attacks",
    interpolation: { escapeValue: false },
    defaultValue: "",
    ...placeholders,
  });
}

export function getLocalizedMitigation(mitigationId: string): string {
  return i18n.t(`${mitigationId}.mitigation`, { ns: "mitigations" });
}

export function getLocalizedVerification(verificationId: string): string {
  return i18n.t(`${verificationId}.verification`, { ns: "verifications" });
}

// ==================== REF RESOLUTION ====================

export interface ResolvedMitigation {
  id: string;
  text: string;
}

export interface ResolvedVerification {
  id: string;
  text: string;
}

export function resolveMitigations(ids: string[]): ResolvedMitigation[] {
  return ids.map((id) => ({ id, text: getLocalizedMitigation(id) }));
}

export function resolveVerifications(ids: string[]): ResolvedVerification[] {
  return ids.map((id) => ({ id, text: getLocalizedVerification(id) }));
}

// ==================== LEGACY CATALOG ADAPTER ====================
// Used by existing service interfaces (ThreatService.getMitigationTemplates etc.)
// until those interfaces are updated in a later step.

export function getLegacyMitigationTemplates(
  strideCategory?: StrideCategory,
  elementType?: string,
  customTemplates: MitigationTemplate[] = []
): MitigationTemplate[] {
  let entries = ALL_MITIGATIONS.filter((m) => {
    if (strideCategory && m.strideCategory !== strideCategory) return false;
    if (elementType === "PhysicalInterface" || elementType === "Interface") {
      return m.id.includes("-IF-");
    }
    if (elementType) return !m.id.includes("-IF-");
    return true;
  });

  const built: MitigationTemplate[] = entries.map((m) => ({
    id: m.id,
    strideCategory: m.strideCategory,
    mitigation: getLocalizedMitigation(m.id),
    mitigationDE: getLocalizedMitigation(m.id), // same — i18n handles language
    isCustom: m.isCustom,
  }));

  return [...built, ...customTemplates];
}

export function getLegacyVerificationTemplates(
  strideCategory?: StrideCategory,
  elementType?: string,
  customTemplates: VerificationTemplate[] = []
): VerificationTemplate[] {
  let entries = ALL_VERIFICATIONS.filter((v) => {
    if (strideCategory && v.strideCategory !== strideCategory) return false;
    if (elementType === "PhysicalInterface" || elementType === "Interface") {
      return v.id.includes("-IF-");
    }
    if (elementType) return !v.id.includes("-IF-");
    return true;
  });

  const built: VerificationTemplate[] = entries.map((v) => ({
    id: v.id,
    strideCategory: v.strideCategory,
    verification: getLocalizedVerification(v.id),
    verificationDE: getLocalizedVerification(v.id),
    isCustom: v.isCustom,
  }));

  return [...built, ...customTemplates];
}

export function getLegacyThreatTemplates(
  strideCategory?: StrideCategory,
  elementType?: string,
  customTemplates: ThreatTemplate[] = []
): ThreatTemplate[] {
  let templates = ALL_ELEMENT_TEMPLATES.filter((t) => {
    if (strideCategory && t.strideCategory !== strideCategory) return false;
    if (elementType && !t.elementTypes.includes(elementType)) return false;
    return true;
  });

  const built: ThreatTemplate[] = templates.map((t) => ({
    id: t.id,
    strideCategory: t.strideCategory,
    elementTypes: t.elementTypes,
    threat: getLocalizedElementThreat(t.id),
    threatDE: getLocalizedElementThreat(t.id),
    attack: getLocalizedElementAttack(t.id),
    attackDE: getLocalizedElementAttack(t.id),
    isCustom: t.isCustom,
  }));

  return [...built, ...customTemplates];
}