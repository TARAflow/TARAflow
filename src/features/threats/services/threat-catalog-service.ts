// ==================== THREAT CATALOG SERVICE ====================
// Loads the four language-neutral catalog files and provides:
//   - Localized text via i18next (no isGerman, no locale === 'de')
//   - Context filtering by ProjectSettings (wired; activated in Step 4)
//   - Mitigation / verification ref resolution (MitigationDraft[] / VerificationDraft[])

import i18n from "i18next";
import type { StrideCategory } from "shared";
import type {
  ElementTemplate,
  InteractionTemplate,
  MitigationEntry,
  VerificationEntry,
  MitigationDraft,
  VerificationDraft,
  TemplateContext,
  ThreatProjectData,
} from "../models/threat-types";

import elementTemplatesData from "./catalog/element-templates.json";
import interactionTemplatesData from "./catalog/interaction-templates.json";
import mitigationsData from "./catalog/mitigations.json";
import verificationsData from "./catalog/verifications.json";
import embeddedElementTemplatesData from "./catalog/embedded-element-templates.json";
import embeddedInteractionTemplatesData from "./catalog/embedded-interaction-templates.json";
import multiprocessElementTemplatesData from "./catalog/multiprocess-element-templates.json";
import multiprocessInteractionTemplatesData from "./catalog/multiprocess-interaction-templates.json";

// ==================== CATALOG SINGLETONS ====================

const ALL_ELEMENT_TEMPLATES: ElementTemplate[] = [
  ...((elementTemplatesData as any).elementTemplates ?? []),
  ...((embeddedElementTemplatesData as any).elementTemplates ?? []),
  ...((multiprocessElementTemplatesData as any).elementTemplates ?? []),
];
 
const ALL_INTERACTION_TEMPLATES: InteractionTemplate[] = [
  ...((interactionTemplatesData as any).interactionTemplates ?? []),
  ...((embeddedInteractionTemplatesData as any).interactionTemplates ?? []),
  ...((multiprocessInteractionTemplatesData as any).interactionTemplates ?? []),
];

const ALL_MITIGATIONS: MitigationEntry[] =
  (mitigationsData as any).mitigations ?? [];

const ALL_VERIFICATIONS: VerificationEntry[] =
  (verificationsData as any).verifications ?? [];

// ==================== CONTEXT FILTERING ====================

/**
 * Returns true when a template's context matches the project and/or element.
 *
 * Matching rules:
 *   systemClass  → element-level (elementProps.systemClass)
 *   chipType     → element-level (elementProps.chipType)
 *   regulation   → project-level (project.info.tags.regulation)
 *   platform     → project-level (project.info.tags.platform) — deprecated fallback
 *   domain       → project-level (project.info.tags.domain) — deprecated fallback
 *
 * AND logic across keys, OR logic within a key.
 * Missing or empty array = universal (always matches).
 */
export function matchesContext(
  templateCtx: TemplateContext,
  project: ThreatProjectData,
  elementProps: Record<string, unknown> | null,
): boolean {
  const { systemClass, chipType, regulation, platform, domain } = templateCtx;
  const tags = project.info?.tags;

  // ── Element-level checks ──────────────────────────────────────────────────

  if (systemClass?.length) {
    const elemClass = elementProps?.["systemClass"] as string | undefined;
    if (!elemClass || !systemClass.includes(elemClass)) return false;
  }

  if (chipType?.length) {
    const elemChipType = elementProps?.["chipType"] as string | undefined;
    if (!elemChipType || !chipType.includes(elemChipType)) return false;
  }

  // ── Project-level checks ──────────────────────────────────────────────────

  if (regulation?.length && tags) {
    if (!regulation.some((r) => tags.regulation.includes(r))) return false;
  }

  // Deprecated — platform fallback
  if (platform?.length && tags) {
    if (!platform.some((p) => tags.platform.includes(p))) return false;
  }

  // Deprecated — domain fallback
  if (domain?.length && tags) {
    if (!domain.some((d) => tags.domain.includes(d))) return false;
  }

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
  project?: ThreatProjectData,
  elementProps: Record<string, unknown> | null = null,
): ElementTemplate[] {
  return ALL_ELEMENT_TEMPLATES.filter((t) => {
    if (t.strideCategory !== strideCategory) return false;
    if (!t.elementTypes.includes(elementType)) return false;
    if (project && !matchesContext(t.context, project, elementProps))
      return false;
    return true;
  });
}

export function findElementTemplate(
  strideCategory: StrideCategory,
  elementType: string,
  project?: ThreatProjectData,
  elementProps?: Record<string, unknown>,
): ElementTemplate | undefined {
  return getApplicableElementTemplates(
    strideCategory,
    elementType,
    project,
    elementProps,
  )[0];
}

// ==================== INTERACTION TEMPLATE ACCESS ====================

export function getAllInteractionTemplates(): InteractionTemplate[] {
  return ALL_INTERACTION_TEMPLATES;
}

export function getAllMitigations(): MitigationEntry[] {
  return ALL_MITIGATIONS;
}

export function getAllVerifications(): VerificationEntry[] {
  return ALL_VERIFICATIONS;
}

export function getApplicableInteractionTemplates(
  strideCategory: StrideCategory,
  perspective: "sender" | "receiver",
  threatData?: ThreatProjectData,
  elementProps: Record<string, unknown> | null = null,
): InteractionTemplate[] {
  return ALL_INTERACTION_TEMPLATES.filter((t) => {
    if (t.strideCategory !== strideCategory) return false;
    if (t.perspective !== perspective) return false;
    if (threatData && !matchesContext(t.context, threatData, elementProps))
      return false;
    return true;
  });
}

export function findInteractionTemplate(
  strideCategory: StrideCategory,
  perspective: "sender" | "receiver",
  threatData?: ThreatProjectData,
  elementProps: Record<string, unknown> | null = null,
): InteractionTemplate | undefined {
  return getApplicableInteractionTemplates(
    strideCategory,
    perspective,
    threatData,
    elementProps,
  )[0];
}

// ==================== LOCALIZATION ====================

export function getLocalizedElementThreat(templateId: string): string {
  return i18n.t(`${templateId}.threat`, { ns: "element-threats-attacks" });
}

export function getLocalizedElementAttack(templateId: string): string {
  return i18n.t(`${templateId}.attack`, { ns: "element-threats-attacks" });
}

export function getLocalizedElementCause(templateId: string): string {
  return i18n.t(`${templateId}.cause`, {
    ns: "element-threats-attacks",
    defaultValue: "",
  });
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

// ==================== RESOLVED TYPES ====================

/**
 * Resolved form of a MitigationDraft for display in the Threat Eval dialog.
 * Catalog entries: id + localized text + optional analyst notes.
 * Custom entries: no id, notes is the primary display text.
 */
export interface ResolvedMitigationDraft {
  /** Catalog ID — undefined for custom entries */
  id?: string;
  /** Localized catalog text — empty string for custom entries */
  text: string;
  /** Analyst annotation or custom entry description */
  notes?: string;
  /** True when no catalog id is present */
  isCustom: boolean;
}

/** Resolved form of a VerificationDraft — same shape as ResolvedMitigationDraft */
export interface ResolvedVerificationDraft {
  id?: string;
  text: string;
  notes?: string;
  isCustom: boolean;
}

// ==================== REF RESOLUTION ====================

/**
 * Resolves a MitigationDraft[] into display-ready objects.
 *
 * Catalog entry (draft.id defined):
 *   text  = localized string from mitigations namespace
 *   notes = analyst annotation (may be undefined)
 *
 * Custom entry (draft.id undefined):
 *   text  = "" (no catalog entry)
 *   notes = analyst-supplied description (the primary display text)
 */
export function resolveMitigationDrafts(
  drafts: MitigationDraft[]
): ResolvedMitigationDraft[] {
  return drafts.map((draft) => ({
    id: draft.id,
    text: draft.id ? getLocalizedMitigation(draft.id) : "",
    notes: draft.notes,
    isCustom: !draft.id,
  }));
}

/**
 * Resolves a VerificationDraft[] into display-ready objects.
 * Same logic as resolveMitigationDrafts.
 */
export function resolveVerificationDrafts(
  drafts: VerificationDraft[]
): ResolvedVerificationDraft[] {
  return drafts.map((draft) => ({
    id: draft.id,
    text: draft.id ? getLocalizedVerification(draft.id) : "",
    notes: draft.notes,
    isCustom: !draft.id,
  }));
}