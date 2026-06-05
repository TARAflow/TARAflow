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

import {
  ALL_ELEMENT_TEMPLATES as CATALOG_EL,
  ALL_INTERACTION_TEMPLATES as CATALOG_INT,
} from "./catalog/threats/index";

import mitigationsSpoofingData from "./catalog/mitigations/mitigations-spoofing.json";
import mitigationsTamperingData from "./catalog/mitigations/mitigations-tampering.json";
import mitigationsRepudiationData from "./catalog/mitigations/mitigations-repudiation.json";
import mitigationsInformationData from "./catalog/mitigations/mitigations-information.json";
import mitigationsDenialData from "./catalog/mitigations/mitigations-denial.json";
import mitigationsElevationData from "./catalog/mitigations/mitigations-elevation.json";
import mitigationsInterfaceData from "./catalog/mitigations/mitigations-interface.json";
import mitigationsChipBoundaryData from "./catalog/mitigations/mitigations-chipboundary.json";
import mitigationsPhysicalBoundaryData from "./catalog/mitigations/mitigations-physicalboundary.json";
import verificationsSpoofingData from "./catalog/verifications/verifications-spoofing.json";
import verificationsTamperingData from "./catalog/verifications/verifications-tampering.json";
import verificationsRepudiationData from "./catalog/verifications/verifications-repudiation.json";
import verificationsInformationData from "./catalog/verifications/verifications-information.json";
import verificationsDenialData from "./catalog/verifications/verifications-denial.json";
import verificationsElevationData from "./catalog/verifications/verifications-elevation.json";
import verificationsInterfaceData from "./catalog/verifications/verifications-interface.json";
import verificationsChipBoundaryData from "./catalog/verifications/verifications-chipboundary.json";
import verificationsPhysicalBoundaryData from "./catalog/verifications/verifications-physicalboundary.json";

// ==================== CATALOG SINGLETONS ====================

const ALL_ELEMENT_TEMPLATES: ElementTemplate[] = [...CATALOG_EL];
 
const ALL_INTERACTION_TEMPLATES: InteractionTemplate[] = [...CATALOG_INT];

const ALL_MITIGATIONS: MitigationEntry[] = [
  ...((mitigationsSpoofingData as any).mitigations ?? []),
  ...((mitigationsTamperingData as any).mitigations ?? []),
  ...((mitigationsRepudiationData as any).mitigations ?? []),
  ...((mitigationsInformationData as any).mitigations ?? []),
  ...((mitigationsDenialData as any).mitigations ?? []),
  ...((mitigationsElevationData as any).mitigations ?? []),
  ...((mitigationsInterfaceData as any).mitigations ?? []),
  ...((mitigationsChipBoundaryData as any).mitigations ?? []),
  ...((mitigationsPhysicalBoundaryData as any).mitigations ?? []),
];

const ALL_VERIFICATIONS: VerificationEntry[] = [
  ...((verificationsSpoofingData as any).verifications ?? []),
  ...((verificationsTamperingData as any).verifications ?? []),
  ...((verificationsRepudiationData as any).verifications ?? []),
  ...((verificationsInformationData as any).verifications ?? []),
  ...((verificationsDenialData as any).verifications ?? []),
  ...((verificationsElevationData as any).verifications ?? []),
  ...((verificationsInterfaceData as any).verifications ?? []),
  ...((verificationsChipBoundaryData as any).verifications ?? []),
  ...((verificationsPhysicalBoundaryData as any).verifications ?? []),
];

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
  elementProps: Record<string, unknown> | null = null,
): boolean {
  const {
    systemClass,
    chipType,
    technology,
    protocol,
    entityType,
    interfaceType,
    regulation,
    platform,
    domain,
    boundaryType,
    serviceAccessPolicy,
    physicalMobility,
    accessibility,
    monitoringType,
    debugInterfaceAccessible,
    removableMediaAccessible,
    failSafeOutputState,
    processSemantic,
    accountManagement,
    updateMechanism,
    authenticatorStorage,
    backupMechanism,
    cryptoStandard,
    sideChannelProtection,
    location,
    redundancy,
    safetyFunction,
    accessMode,
  } = templateCtx;
  const tags = project.info?.tags;

  // ── Element-level checks ──────────────────────────────────────────────────

  if (systemClass?.length) {
    const v = elementProps?.["systemClass"] as string | undefined;
    if (!v || !systemClass.includes(v)) return false;
  }

  if (chipType?.length) {
    const v = elementProps?.["chipType"] as string | undefined;
    if (!v || !chipType.includes(v)) return false;
  }

  if (sideChannelProtection?.length) {
    // Default "none" when property is absent — unprotected chips are in scope.
    const v =
      (elementProps?.["sideChannelProtection"] as string | undefined) ?? "none";
    if (!sideChannelProtection.includes(v)) return false;
  }

  if (technology?.length) {
    const v = elementProps?.["technology"] as string | undefined;
    if (!v || !technology.includes(v)) return false;
  }

  if (protocol?.length) {
    const v = elementProps?.["protocol"] as string | undefined;
    if (!v || !protocol.includes(v)) return false;
  }

  if (entityType?.length) {
    const v = elementProps?.["entityType"] as string | undefined;
    if (!v || !entityType.includes(v)) return false;
  }

  if (interfaceType?.length) {
    const v = elementProps?.["type"] as string | undefined;
    if (!v || !interfaceType.includes(v)) return false;
  }

  // ── Physical Boundary context ─────────────────────────────────────────────

  if (boundaryType?.length) {
    const v = elementProps?.["boundaryType"] as string | undefined;
    if (!v || !boundaryType.includes(v)) return false;
  }

  if (serviceAccessPolicy?.length) {
    const controls = elementProps?.["implementedControls"] as
      | Record<string, unknown>
      | undefined;
    const v = controls?.["serviceAccessPolicy"] as string | undefined;
    if (!v || !serviceAccessPolicy.includes(v)) return false;
  }

  if (physicalMobility?.length) {
    const v = elementProps?.["physicalMobility"] as string | undefined;
    if (!v || !physicalMobility.includes(v)) return false;
  }

  if (accessibility?.length) {
    const v = elementProps?.["accessibility"] as string | undefined;
    if (!v || !accessibility.includes(v)) return false;
  }

  if (monitoringType?.length) {
    const v = elementProps?.["monitoringType"] as string | undefined;
    if (!v || !monitoringType.includes(v)) return false;
  }

  // Boolean flags — only match when explicitly true in context
  if (debugInterfaceAccessible === true) {
    if (elementProps?.["debugInterfaceAccessible"] !== true) return false;
  }

  if (removableMediaAccessible === true) {
    if (elementProps?.["removableMediaAccessible"] !== true) return false;
  }

  // ── Process / Multiprocess context ───────────────────────────────────────

  if (failSafeOutputState?.length) {
    const v = elementProps?.["failSafeOutputState"] as string | undefined;
    if (!v || !failSafeOutputState.includes(v)) return false;
  }

  if (processSemantic?.length) {
    const v = elementProps?.["processSemantic"] as string | undefined;
    if (!v || !processSemantic.includes(v)) return false;
  }

  if (accountManagement?.length) {
    const v = elementProps?.["accountManagement"] as string | undefined;
    if (!v || !accountManagement.includes(v)) return false;
  }

  if (updateMechanism?.length) {
    const v = elementProps?.["updateMechanism"] as string | undefined;
    if (!v || !updateMechanism.includes(v)) return false;
  }

  if (authenticatorStorage?.length) {
    const v = elementProps?.["authenticatorStorage"] as string | undefined;
    if (!v || !authenticatorStorage.includes(v)) return false;
  }

  if (backupMechanism?.length) {
    const v = elementProps?.["backupMechanism"] as string | undefined;
    if (!v || !backupMechanism.includes(v)) return false;
  }

  if (cryptoStandard?.length) {
    const v = elementProps?.["cryptoStandard"] as string | undefined;
    if (!v || !cryptoStandard.includes(v)) return false;
  }

  // ── DataFlow context ──────────────────────────────────────────────────────

  if (location?.length) {
    const v = elementProps?.["location"] as string | undefined;
    if (!v || !location.includes(v)) return false;
  }

  if (redundancy?.length) {
    const v = elementProps?.["redundancy"] as string | undefined;
    if (!v || !redundancy.includes(v)) return false;
  }

  if (safetyFunction?.length) {
    const v = elementProps?.["safetyFunction"] as string | undefined;
    if (!v || !safetyFunction.includes(v)) return false;
  }

  if (accessMode?.length) {
    const v = elementProps?.["accessMode"] as string | undefined;
    if (!v || !accessMode.includes(v)) return false;
  }

  // ── Project-level checks ──────────────────────────────────────────────────

  if (regulation?.length && tags) {
    if (!regulation.some((r) => tags.regulation.includes(r))) return false;
  }

  if (platform?.length && tags) {
    if (!platform.some((p) => tags.platform.includes(p))) return false;
  }

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

export function getLocalizedElementThreat(
  templateId: string,
  domain: string = "general",
): string {
  const key = `${domain}.${templateId}.threat`;
  const result = i18n.t(key, {
    ns: "element-threats-attacks",
    defaultValue: "__MISSING__",
  });
  if (result === "__MISSING__") {
    if (domain !== "general") {
      console.error(
        `[ThreatCatalog] Missing element threat text: domain="${domain}" id="${templateId}" — falling back to "general"`,
      );
      return i18n.t(`general.${templateId}.threat`, {
        ns: "element-threats-attacks",
      });
    }
    console.error(
      `[ThreatCatalog] Missing element threat text: domain="general" id="${templateId}"`,
    );
  }
  return result;
}

export function getLocalizedElementAttack(
  templateId: string,
  domain: string = "general",
): string {
  const key = `${domain}.${templateId}.attack`;
  const result = i18n.t(key, {
    ns: "element-threats-attacks",
    defaultValue: "__MISSING__",
  });
  if (result === "__MISSING__") {
    if (domain !== "general") {
      console.error(
        `[ThreatCatalog] Missing element attack text: domain="${domain}" id="${templateId}" — falling back to "general"`,
      );
      return i18n.t(`general.${templateId}.attack`, {
        ns: "element-threats-attacks",
      });
    }
    console.error(
      `[ThreatCatalog] Missing element attack text: domain="general" id="${templateId}"`,
    );
  }
  return result;
}

export function getLocalizedElementCause(
  templateId: string,
  domain: string = "general",
): string {
  const key = `${domain}.${templateId}.cause`;
  const result = i18n.t(key, {
    ns: "element-threats-attacks",
    defaultValue: "__MISSING__",
  });
  if (result === "__MISSING__") {
    if (domain !== "general") {
      return i18n.t(`general.${templateId}.cause`, {
        ns: "element-threats-attacks",
        defaultValue: "",
      });
    }
    return "";
  }
  return result;
}

type InteractionPlaceholders = {
  sourceName: string;
  targetName: string;
  dataFlowName: string;
  trustBoundaryName: string;
  sourceType?: string;
  targetType?: string;
};

export function getLocalizedInteractionThreat(
  templateId: string,
  placeholders: InteractionPlaceholders,
  domain: string = "general",
): string {
  const key = `${domain}.${templateId}.threat`;
  const result = i18n.t(key, {
    ns: "interaction-threats-attacks",
    interpolation: { escapeValue: false },
    defaultValue: "__MISSING__",
    ...placeholders,
  });
  if (result === "__MISSING__") {
    if (domain !== "general") {
      console.error(
        `[ThreatCatalog] Missing interaction threat text: domain="${domain}" id="${templateId}" — falling back to "general"`,
      );
      return i18n.t(`general.${templateId}.threat`, {
        ns: "interaction-threats-attacks",
        interpolation: { escapeValue: false },
        ...placeholders,
      });
    }
    console.error(
      `[ThreatCatalog] Missing interaction threat text: domain="general" id="${templateId}"`,
    );
  }
  return result;
}

export function getLocalizedInteractionAttack(
  templateId: string,
  placeholders: InteractionPlaceholders,
  domain: string = "general",
): string {
  const key = `${domain}.${templateId}.attack`;
  const result = i18n.t(key, {
    ns: "interaction-threats-attacks",
    interpolation: { escapeValue: false },
    defaultValue: "__MISSING__",
    ...placeholders,
  });
  if (result === "__MISSING__") {
    if (domain !== "general") {
      console.error(
        `[ThreatCatalog] Missing interaction attack text: domain="${domain}" id="${templateId}" — falling back to "general"`,
      );
      return i18n.t(`general.${templateId}.attack`, {
        ns: "interaction-threats-attacks",
        interpolation: { escapeValue: false },
        ...placeholders,
      });
    }
    console.error(
      `[ThreatCatalog] Missing interaction attack text: domain="general" id="${templateId}"`,
    );
  }
  return result;
}

export function getLocalizedInteractionCause(
  templateId: string,
  placeholders: InteractionPlaceholders,
  domain: string = "general",
): string {
  const key = `${domain}.${templateId}.cause`;
  const result = i18n.t(key, {
    ns: "interaction-threats-attacks",
    interpolation: { escapeValue: false },
    defaultValue: "__MISSING__",
    ...placeholders,
  });
  if (result === "__MISSING__") {
    if (domain !== "general") {
      return i18n.t(`general.${templateId}.cause`, {
        ns: "interaction-threats-attacks",
        interpolation: { escapeValue: false },
        defaultValue: "",
        ...placeholders,
      });
    }
    return "";
  }
  return result;
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