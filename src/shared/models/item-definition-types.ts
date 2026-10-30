// shared/models/item-definition-types.ts
//
// Item Definition (ISO/SAE 21434 9.3, RQ-09-01/02 → WP-09-01; IEC 62443-4-1
// SRM-2/3; EN 50742 4.3) — preset-independent, stored as ONE object
// `project.itemDefinition` (conformance plan Phase 1 stage A, decisions 8, 12,
// 24). The sections follow the requirements, not the arc42 order; arc42 (or any
// other document) is the source, referenced, not copied.
//
// "Purpose and functions" takes over the project description: its text stays
// in `info.description` (decision 8, no migration); the section entry only
// carries its source and model links.
//
// In shared: the Overview tab edits it, the report renders it, DFD trust
// boundaries reference its assumptions.

/** The sections of the Definition sub-tab. */
export type ItemSectionId =
  | "boundary" // RQ-09-01 a) item boundary
  | "functions" // RQ-09-01 b) purpose and functions — text in info.description
  | "architecture" // RQ-09-01 c) preliminary architecture
  | "environment" // RQ-09-02 operational environment
  | "constraints"; // supporting: constraints, legal requirements

export const ITEM_SECTION_IDS: readonly ItemSectionId[] = [
  "boundary",
  "functions",
  "architecture",
  "environment",
  "constraints",
];

/**
 * Lifecycle phases of an item function (RQ-09-01 b NOTE 2: functions over the
 * lifecycle) — TARAflow design decision 24.
 */
export type LifecyclePhase = "production" | "operation" | "maintenance" | "decommissioning";

export const LIFECYCLE_PHASES: readonly LifecyclePhase[] = [
  "production",
  "operation",
  "maintenance",
  "decommissioning",
];

/** Where a section's content comes from (stage A: by hand; B: import; C: repository). */
export interface SourceRef {
  /** e.g. "arc42 AiO 2.0" */
  document: string;
  /** e.g. "§3 Context and scope" */
  section?: string;
  /** Document version when not in a repository. */
  version?: string;
  /** An existing project SourceBinding (repository + pinned commit), stage C. */
  bindingId?: string;
  /** File in that repository, e.g. docs/arc42/03_context.adoc. */
  path?: string;
  /** Hash of the imported section text (stage B). */
  contentHash?: string;
  importedAt?: string;
}

export interface ItemSection {
  /** The analyst's summary or an excerpt (not used for "functions"). */
  text?: string;
  source?: SourceRef;
  /** Linked model items: DFD element / page ids, asset ids. */
  modelRefs?: string[];
}

export interface ItemFunction {
  id: string;
  name: string;
  description?: string;
  lifecyclePhases: LifecyclePhase[];
  /** The function asset it corresponds to, if any. */
  functionAssetId?: string;
}

export type AssumptionStatus = "open" | "confirmed" | "invalid";

/** An assumption on the operational environment (RQ-09-02 NOTE 8), ASM-nn. */
export interface Assumption {
  id: string;
  /** "ASM-01" */
  displayId: string;
  text: string;
  source?: SourceRef;
  owner?: string;
  /** ISO date by which it should be reviewed. */
  reviewBy?: string;
  status: AssumptionStatus;
}

export interface ItemDefinition {
  sections: Partial<Record<ItemSectionId, ItemSection>>;
  functions: ItemFunction[];
  assumptions: Assumption[];
  /** Highest ASM number ever issued — numbers are never reused (like M-C-nnn). */
  assumptionSeq?: number;
}

export function emptyItemDefinition(): ItemDefinition {
  return { sections: {}, functions: [], assumptions: [] };
}

// ==================== ASSUMPTIONS ====================

const assumptionNumber = (displayId: string) => Number(/^ASM-(\d+)$/.exec(displayId)?.[1] ?? 0);

/** Highest ASM number issued so far: the definition's counter or any in use. */
export function issuedAssumptionNumber(def: Pick<ItemDefinition, "assumptions" | "assumptionSeq">): number {
  return Math.max(def.assumptionSeq ?? 0, ...def.assumptions.map((a) => assumptionNumber(a.displayId)));
}

/**
 * "ASM-01", "ASM-02" … — one past the highest number ever issued (`issued`)
 * or in use; a deleted number is never issued again (review 2026-10-30).
 */
export function nextAssumptionDisplayId(assumptions: readonly Assumption[], issued = 0): string {
  const max = Math.max(issued, ...assumptions.map((a) => assumptionNumber(a.displayId)));
  return `ASM-${String(max + 1).padStart(2, "0")}`;
}

/** Store the assumptions; the counter keeps every number issued, deleted ones included. */
export function withAssumptions(def: ItemDefinition, assumptions: Assumption[]): ItemDefinition {
  return { ...def, assumptions, assumptionSeq: Math.max(issuedAssumptionNumber(def), issuedAssumptionNumber({ assumptions })) };
}

let assumptionIdSeq = 0;

/** A new open assumption with the next display id (not yet stored). */
export function newAssumption(assumptions: readonly Assumption[], text: string, issued = 0): Assumption {
  assumptionIdSeq += 1;
  return {
    id: `asm-${Date.now().toString(36)}-${assumptionIdSeq.toString(36)}`,
    displayId: nextAssumptionDisplayId(assumptions, issued),
    text: text.trim(),
    status: "open",
  };
}
