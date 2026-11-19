// ==================== COMPONENT SNAPSHOT ====================
// Multi-project TARA (doc/Done/multi-project-tara-design.md v3, §4.2): the
// analysis-relevant part of a component TARA that a machine TARA embeds. Not
// a new exchange format — the component's own data model, reduced. Typed
// here in the app layer because it is made of several features' data; the
// feature-agnostic import record is in shared/models/component-import-types.

import type { Assumption, CybersecurityConcept, ItemFunction, ItemSectionId, ProjectTags, SourceBinding, SourceRef } from "shared";
import type { Project } from "./project-types";

type NonNull<T> = Exclude<T, null | undefined>;
type DfdData = NonNull<Project["dfd"]>;
type ThreatData = NonNull<Project["threats"]>;
type AssetData = NonNull<Project["assets"]>;
type RiskEntry = NonNull<Project["risks"]>["risks"][number];

/** The DFD without derived or presentation data (graph, thumbnail, stats, validation). */
export type SnapshotDfd = Pick<DfdData, "xml" | "elements" | "connections" | "assets" | "pages">;

/** Threat tables with their relevance decisions; the project mitigations of the catalog. */
export interface SnapshotThreats {
  perElementTables: ThreatData["perElementTables"];
  perInteractionTables: ThreatData["perInteractionTables"];
  customMitigations: NonNull<ThreatData["configuration"]>["customMitigations"];
  customVerifications: NonNull<ThreatData["configuration"]>["customVerifications"];
}

/**
 * A risk of the component reduced to what crosses (design §4.2, §7): which
 * threat, the treatment and its measures, and the raw values of the
 * component-intrinsic likelihood factors. No impact values, no risk levels,
 * no aggregated feasibility, no context-dependent factors, no ticket data.
 */
export interface SnapshotRisk {
  id: string;
  threatId: string;
  strideCategory: RiskEntry["strideCategory"];
  sourceStrideMethod: RiskEntry["sourceStrideMethod"];
  treatment: RiskEntry["treatment"];
  treatmentJustification?: string;
  selectedMitigations: { id?: string; notes?: string; status: string }[];
  selectedVerifications: string[];
  /** Rated (> 0) intrinsic factors only, sorted by factorId. */
  intrinsicFactors: { factorId: string; value: number }[];
}

/**
 * Assets without impact ratings and physical impact — impact stays behind
 * (§7.3); their security goals without per-goal impact and consequence.
 */
export type SnapshotAsset = Omit<
  AssetData["assets"][number],
  | "impactRatings"
  | "overallImpact"
  | "aggregatedImpact"
  | "physicalImpact"
  | "physicalImpactSource"
  | "physicalImpactRationale"
>;

/** Assumptions on the environment without the person who owns them. */
export type SnapshotAssumption = Omit<Assumption, "owner">;

/**
 * The component's overview at the commit (design §4.2, user 2026-11-11): what
 * the machine shows per component in its Overview and the report — the
 * description, who answers for it, its scope, the Item Definition texts and
 * functions, and the code repositories it was analysed against. Pinned like
 * everything else: a changed description is a newer state.
 */
export interface SnapshotAbout {
  description?: string;
  /** The component's responsible — the contact for revision requests (phase 6). Not the team. */
  responsible?: string;
  tags?: ProjectTags;
  safetyRelevant?: boolean;
  /** Item Definition texts with their document reference; no links into the component's model. */
  sections?: Partial<Record<ItemSectionId, { text?: string; source?: SourceRef }>>;
  /** Functions without the link to a component asset. */
  functions?: Omit<ItemFunction, "functionAssetId">[];
  /** Project source bindings: repository, ref and the pinned commit — no drift log, no credentials. */
  sourceBindings?: Pick<SourceBinding, "id" | "repoUrl" | "refType" | "refLabel" | "resolvedCommitSha">[];
}

export interface ComponentSnapshot {
  snapshotFormat: 1;
  component: { projectId: string; name: string; version?: string };
  /** Absent in snapshots taken before 2026-11-11 (unreleased 0.19 state). */
  about?: SnapshotAbout;
  dfd: SnapshotDfd | null;
  threats: SnapshotThreats | null;
  attackTrees: Project["attackTrees"];
  risks: SnapshotRisk[];
  assets: SnapshotAsset[];
  assetRelations: AssetData["relations"];
  concept: Pick<CybersecurityConcept, "goals" | "claims">;
  assumptions: SnapshotAssumption[];
  /**
   * Components the component itself imported (design §6.5, E8): they come
   * along as they are — their pages are already in `dfd` — and are needed
   * for provenance and the cycle check.
   */
  components?: Project["components"];
}
