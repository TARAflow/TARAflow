// ==================== THREAT CATALOG SERVICE ====================
// Loads the four language-neutral catalog files and provides:
//   - Localized text via i18next (no isGerman, no locale === 'de')
//   - Context filtering by ProjectSettings (wired; activated in Step 4)
//   - Mitigation / verification ref resolution (MitigationDraft[] / VerificationDraft[])

import i18n from "i18next";
import type { AttackVector, ProjectTags, StrideCategory } from "shared";
import type {
  ElementTemplate,
  InteractionTemplate,
  MitigationEntry,
  ProjectMitigation,
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
import { getMitigationCatalogVersion, registeredProjectMitigations } from "shared/services/project-mitigation-registry";

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
/**
 * The context keys matchesContext reads (FX-7) — a catalog key outside this
 * list would be silently ignored; the guard test checks every catalog entry.
 */
export const MATCHED_CONTEXT_KEYS = [
  "systemClass", "chipType", "technology", "protocol", "entityType", "interfaceType", "regulation", "platform", "domain",
  "boundaryType", "serviceAccessPolicy", "physicalMobility", "accessibility", "monitoringType", "debugInterfaceAccessible",
  "removableMediaAccessible", "failSafeOutputState", "processSemantic", "accountManagement", "updateMechanism",
  "authenticatorStorage", "backupMechanism", "cryptoStandard", "sideChannelProtection", "location", "redundancy",
  "safetyFunction", "accessMode", "storeAccessModel", "physicalPathProtection", "encryptionInTransit",
] as const;

export function matchesContext(
  templateCtx: TemplateContext,
  project: ThreatProjectData,
  elementProps: Record<string, unknown> | null = null,
): boolean {
  return contextMatch(templateCtx, project, elementProps).matches;
}

/**
 * The match and how many of its constraints rest on an assumed weak value
 * (FX-7): a template matched by facts is more specific than one matched by
 * an assumption about an unset property — it is chosen first.
 */
export function contextMatch(
  templateCtx: TemplateContext,
  project: ThreatProjectData,
  elementProps: Record<string, unknown> | null = null,
): { matches: boolean; assumed: number } {
  let assumed = 0;
  const no = { matches: false, assumed: 0 };
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
    storeAccessModel,
    physicalPathProtection,
    encryptionInTransit,
  } = templateCtx;
  /**
   * FX-7: a key that names a missing or weak control matches an UNSET
   * property as that weak value — an unfinished model never looks safer than
   * a complete one (unset = unknown). Keys that say what an element IS
   * (systemClass, protocol, …) still need the value.
   */
  const weak = (wanted: string[], property: string, weakValue: string): boolean => {
    const value = elementProps?.[property];
    const unset = value === undefined || value === null || value === "" || value === "not_specified";
    const entries = (unset ? [weakValue] : [value].flat()) as string[];
    const hit = entries.some((v) => wanted.includes(v));
    if (hit && unset) assumed++;
    return hit;
  };
  // Login settings are weak when unset only where the element authenticates.
  const authenticates = ((): boolean => {
    const required = elementProps?.["authenticationRequired"];
    const boundary = elementProps?.["boundaryAuthentication"];
    const set = (v: unknown) => v !== undefined && v !== null && v !== "" && v !== "not_specified";
    return (set(required) && required !== "no") || (set(boundary) && boundary !== "none");
  })();
  const weakLogin = (wanted: string[], property: string, weakValue: string): boolean => {
    const value = elementProps?.[property];
    if ((value === undefined || value === "" || value === "not_specified") && !authenticates) return false;
    return weak(wanted, property, weakValue);
  };
  const tags = project.info?.tags;

  // ── Element-level checks ──────────────────────────────────────────────────

  if (systemClass?.length) {
    const v = elementProps?.["systemClass"] as string | undefined;
    if (!v || !systemClass.includes(v)) return no;
  }

  if (chipType?.length) {
    const v = elementProps?.["chipType"] as string | undefined;
    if (!v || !chipType.includes(v)) return no;
  }

  if (sideChannelProtection?.length) {
    // Default "none" when property is absent — unprotected chips are in scope.
    if (!weak(sideChannelProtection, "sideChannelProtection", "none")) return no;
  }

  if (technology?.length) {
    const v = elementProps?.["technology"] as string | undefined;
    if (!v || !technology.includes(v)) return no;
  }

  if (storeAccessModel?.length) {
    const v = elementProps?.["accessModel"] as string | undefined;
    if (!v || !storeAccessModel.includes(v)) return no;
  }

  if (protocol?.length) {
    const v = elementProps?.["protocol"] as string | undefined;
    if (!v || !protocol.includes(v)) return no;
  }

  if (entityType?.length) {
    const v = elementProps?.["entityType"] as string | undefined;
    if (!v || !entityType.includes(v)) return no;
  }

  if (interfaceType?.length) {
    const v = elementProps?.["type"] as string | undefined;
    if (!v || !interfaceType.includes(v)) return no;
  }

  // ── Physical Boundary context ─────────────────────────────────────────────

  if (boundaryType?.length) {
    const v = elementProps?.["boundaryType"] as string | undefined;
    if (!v || !boundaryType.includes(v)) return no;
  }

  if (serviceAccessPolicy?.length) {
    const controls = elementProps?.["implementedControls"] as
      | Record<string, unknown>
      | undefined;
    const v = controls?.["serviceAccessPolicy"] as string | undefined;
    if (!v || !serviceAccessPolicy.includes(v)) return no;
  }

  if (physicalMobility?.length) {
    const v = elementProps?.["physicalMobility"] as string | undefined;
    if (!v || !physicalMobility.includes(v)) return no;
  }

  if (accessibility?.length) {
    const v = elementProps?.["accessibility"] as string | undefined;
    if (!v || !accessibility.includes(v)) return no;
  }

  if (monitoringType?.length) {
    if (!weak(monitoringType, "monitoringType", "none")) return no;
  }

  // Boolean flags — only match when explicitly true in context
  if (debugInterfaceAccessible === true) {
    if (elementProps?.["debugInterfaceAccessible"] !== true) return no;
  }

  if (removableMediaAccessible === true) {
    if (elementProps?.["removableMediaAccessible"] !== true) return no;
  }

  // ── Process / Multiprocess context ───────────────────────────────────────

  if (failSafeOutputState?.length) {
    if (!weak(failSafeOutputState, "failSafeOutputState", "not_defined")) return no;
  }

  if (processSemantic?.length) {
    const v = elementProps?.["processSemantic"] as string | undefined;
    if (!v || !processSemantic.includes(v)) return no;
  }

  if (accountManagement?.length) {
    if (!weakLogin(accountManagement, "accountManagement", "local_only")) return no;
  }

  if (updateMechanism?.length) {
    if (!weak(updateMechanism, "updateMechanism", "none")) return no;
  }

  if (authenticatorStorage?.length) {
    if (!weakLogin(authenticatorStorage, "authenticatorStorage", "software_only")) return no;
  }

  if (backupMechanism?.length) {
    if (!weak(backupMechanism, "backupMechanism", "none")) return no;
  }

  if (cryptoStandard?.length) {
    if (!weak(cryptoStandard, "cryptoStandard", "not_assessed")) return no;
  }

  // ── DataFlow context ──────────────────────────────────────────────────────

  if (location?.length) {
    const v = elementProps?.["location"] as string | undefined;
    if (!v || !location.includes(v)) return no;
  }

  if (redundancy?.length) {
    if (!weak(redundancy, "redundancy", "none")) return no;
  }

  if (safetyFunction?.length) {
    const v = elementProps?.["safetyFunction"] as string | undefined;
    if (!v || !safetyFunction.includes(v)) return no;
  }

  if (accessMode?.length) {
    if (!weak(accessMode, "accessMode", "read_write")) return no;
  }

  if (physicalPathProtection?.length) {
    if (!weak(physicalPathProtection, "physicalPathProtection", "none")) return no;
  }

  if (encryptionInTransit?.length) {
    if (!weak(encryptionInTransit, "encryptionInTransit", "none")) return no;
  }

  // ── Project-level checks ──────────────────────────────────────────────────

  if (regulation?.length && tags) {
    if (!regulation.some((r) => tags.regulation.includes(r))) return no;
  }

  if (platform?.length && tags) {
    if (!platform.some((p) => tags.platform.includes(p))) return no;
  }

  if (domain?.length && tags) {
    if (!domain.some((d) => tags.domain.includes(d))) return no;
  }

  return { matches: true, assumed };
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
  return bySpecificity(
    ALL_ELEMENT_TEMPLATES.filter((t) => t.strideCategory === strideCategory && t.elementTypes.includes(elementType)),
    project,
    elementProps,
  );
}

/**
 * Specificity-first: a template that matched on more context constraints is
 * more specific than a context-free one; general (context:{}) scores 0 and
 * therefore acts as the fallback. FX-7: constraints met only by an assumed
 * weak value count after the facts — a fact (technology = rtos_task) beats an
 * assumption (fail-safe state unset), an assumption beats no constraint.
 * Stable sort preserves catalog order on ties.
 */
function bySpecificity<T extends { context: TemplateContext }>(
  templates: readonly T[],
  project: ThreatProjectData | undefined,
  elementProps: Record<string, unknown> | null,
): T[] {
  return templates
    .map((t) => ({ t, m: project ? contextMatch(t.context, project, elementProps) : { matches: true, assumed: 0 } }))
    .filter((x) => x.m.matches)
    .sort((a, b) => {
      const facts = (x: typeof a) => contextSpecificity(x.t.context) - x.m.assumed;
      return facts(b) - facts(a) || b.m.assumed - a.m.assumed;
    })
    .map((x) => x.t);
}

/** Number of non-empty context constraints on a template. */
function contextSpecificity(ctx: TemplateContext): number {
  return Object.values(ctx ?? {}).filter((v) =>
    Array.isArray(v) ? v.length > 0 : v === true,
  ).length;
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

// ==================== PROJECT MITIGATIONS ====================
// Custom mitigation catalog design CM-2: the project's own mitigations
// (M-C-nnn) join the built-in catalog for every reader — closed loop,
// dialogs, report — so they work wherever a catalog id works. The open
// project registers them in the shared registry (app: workspace layout; CLI:
// before generating); the derived lookups below follow its version. Readers
// that memoize the catalog depend on useMitigationCatalogVersion().
// Generation does not use them: a generated threat's controls come from the
// built-in catalog, project mitigations are chosen by the analyst.

let derivedVersion = -1;
let projectMitigationById = new Map<string, ProjectMitigation>();
let catalogWithProject: MitigationEntry[] = ALL_MITIGATIONS;

function derived(): void {
  const version = getMitigationCatalogVersion();
  if (version === derivedVersion) return;
  derivedVersion = version;
  const entries = registeredProjectMitigations<ProjectMitigation>();
  projectMitigationById = new Map(entries.map((m) => [m.id, m]));
  catalogWithProject = entries.length > 0 ? [...ALL_MITIGATIONS, ...entries] : ALL_MITIGATIONS;
}

export function getProjectMitigations(): readonly ProjectMitigation[] {
  return registeredProjectMitigations<ProjectMitigation>();
}

export function getProjectMitigation(id: string): ProjectMitigation | undefined {
  derived();
  return projectMitigationById.get(id);
}

/** Built-in catalog plus the open project's mitigations. */
export function getAllMitigations(): MitigationEntry[] {
  derived();
  return catalogWithProject;
}

export function getAllVerifications(): VerificationEntry[] {
  return ALL_VERIFICATIONS;
}

// ==================== CATEGORY CONTROL SELECTION ====================
// Mitigation catalog design D3 / D4 (doc/InProgress/Threat/mitigation-
// catalog-attack-vector.md): the controls a threat without template-specific
// controls is topped up with — the attack-path threats and the generic
// element fallback.

export interface CategoryControlSelection {
  /** Path's attack vector; absent = the vector plays no part (as before). */
  attackVector?: AttackVector;
  /** Project tags for the context filter; absent = no filter. */
  tags?: ProjectTags;
  /** Ids already proposed — never returned again. */
  exclude?: ReadonlySet<string>;
  /** How many to return at most. */
  limit: number;
}

/** A catalog context against the project tags only (no element at hand). */
function fitsProject(ctx: TemplateContext, tags: ProjectTags | undefined): boolean {
  return !tags || matchesContext(ctx, { info: { tags } } as ThreatProjectData, null);
}

/**
 * Controls of one STRIDE category that fit the project (context, D4) and,
 * for an attack path with a vector, the vector (D3): controls stating the
 * vector come first, then vector-free ones; controls for other vectors are
 * left out. Catalog order within each group.
 */
export function selectCategoryControls(
  strideCategory: StrideCategory,
  selection: CategoryControlSelection,
): MitigationEntry[] {
  const { attackVector, tags, exclude, limit } = selection;
  const fitting = ALL_MITIGATIONS.filter(
    (m) =>
      m.strideCategory === strideCategory &&
      !exclude?.has(m.id) &&
      fitsProject(m.context, tags) &&
      (!attackVector || !m.attackVectors || m.attackVectors.includes(attackVector)),
  );
  const ordered = attackVector
    ? [...fitting.filter((m) => m.attackVectors), ...fitting.filter((m) => !m.attackVectors)]
    : fitting;
  return ordered.slice(0, Math.max(0, limit));
}

/** Verifications of one STRIDE category that fit the project (context, D4). */
export function selectCategoryVerifications(
  strideCategory: StrideCategory,
  selection: Omit<CategoryControlSelection, "attackVector">,
): VerificationEntry[] {
  const { tags, exclude, limit } = selection;
  return ALL_VERIFICATIONS.filter(
    (v) => v.strideCategory === strideCategory && !exclude?.has(v.id) && fitsProject(v.context, tags),
  ).slice(0, Math.max(0, limit));
}

export function getApplicableInteractionTemplates(
  strideCategory: StrideCategory,
  perspective: "sender" | "receiver",
  threatData?: ThreatProjectData,
  elementProps: Record<string, unknown> | null = null,
): InteractionTemplate[] {
    // Specificity-first, facts before assumptions (same rule as element templates).
    return bySpecificity(
      ALL_INTERACTION_TEMPLATES.filter((t) => t.strideCategory === strideCategory && t.perspective === perspective),
      threatData,
      elementProps,
    );
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
  const own = getProjectMitigation(mitigationId);
  if (own) return own.text;
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