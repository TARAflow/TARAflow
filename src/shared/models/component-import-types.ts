// ==================== COMPONENT IMPORT — SHARED TYPES ====================
// Multi-project TARA (doc/Open/multi-project-tara-design.md v3): a machine
// TARA imports the committed TARA of a reused component. These are the
// feature-agnostic parts — methodology fingerprint, import record, instances,
// assumption status. The snapshot's content is typed in the app layer
// (app/models/component-snapshot-types.ts), because it is made of the
// features' data.
//
// Phase 0 (patch 04): types only, nothing is stored in a project yet — the
// import record enters the project file with schema 14 (phase 1).

/**
 * Who rates a likelihood factor of an imported risk (design §7.2):
 *   intrinsic — describes the component (elapsed time, expertise, …); the
 *               component's raw value is taken over as prefill
 *   context   — depends on where the component is used (window of
 *               opportunity, exposure, …); always rated by the machine
 */
export type FactorClass = "intrinsic" | "context";

/**
 * The scale of one likelihood factor as the calculation reads it: its levels
 * in order with the stored value and, for score-table methods, the points of
 * the level. Labels are not part of it — they are presentation.
 */
export interface FactorScaleDefinition {
  levels: { key: string; value: number; points?: number }[];
}

/** One active intrinsic factor of a methodology, identified by its scale. */
export interface FingerprintFactor {
  factorId: string;
  /** 12-hex FNV-1a over the canonical JSON of the factor's scale definition. */
  scaleHash: string;
}

/**
 * The likelihood methodology of a project, reduced to what decides whether
 * imported factor values can be taken over: the method and the scale of each
 * active intrinsic factor. Impact scale, risk matrix and thresholds are not
 * part of it (design §7.2) — impact is never imported.
 */
export interface MethodologyFingerprint {
  likelihoodMethod: string;
  /** Sorted by factorId. */
  factors: FingerprintFactor[];
  /** 12-hex FNV-1a over likelihoodMethod + factors. */
  hash: string;
}

/**
 * Why a component state could not be pinned to a commit (design §4.1, user
 * 2026-11-07): imported anyway, with a clear warning (CMP_SOURCE_UNPINNED) —
 * only the content hash identifies the state.
 */
export type ComponentUnpinnedReason = "no_repo" | "untracked" | "dirty";

/** Where an imported component TARA came from (design §4.1). */
export interface ComponentSource {
  /** Remote URL of the component repository — never a local path. */
  repoUrl?: string;
  /** Path of the file inside its repository, e.g. "components/camera.tara.json". */
  path?: string;
  /** The component lies in the same repository as the machine file. */
  sameRepo?: boolean;
  branch?: string;
  /** Only tagged states are offered when set, e.g. "camera-tara/v*". */
  tagPattern?: string;
  /** Tag of the imported commit, if any. */
  tag?: string;
  /** The pinned commit; absent for an unpinned import (see `unpinned`). */
  commitSha?: string;
  /** Set when the state is not a commit — then commitSha, branch, tag are absent. */
  unpinned?: ComponentUnpinnedReason;
  /** Schema of the component file before it was migrated on import. */
  schemaVersion: number;
}

/** One imported component state (design §10) — one per component per machine. */
export interface ComponentImport<TSnapshot = unknown> {
  id: string;
  /** Project id of the component TARA. */
  componentId: string;
  name: string;
  source: ComponentSource;
  importedAt: string;
  methodology: MethodologyFingerprint;
  snapshot: TSnapshot;
  /** 12-hex FNV-1a over canonicalStringify(snapshot). */
  contentHash: string;
}

/** Status of one component assumption in one instance (design §7.6). */
export interface ComponentAssumptionStatus {
  instanceId: string;
  assumptionId: string;
  status: "open" | "fulfilled" | "not_fulfilled" | "not_applicable";
  evidence?: { elementIds?: string[]; mitigationIds?: string[]; note?: string };
  /** Mandatory for not_applicable. */
  rationale?: string;
}

/**
 * project.components (schema 14): the imported component states — one per
 * component (design §6.4, E12) — and their instances in the DFD.
 */
export interface ProjectComponents<TSnapshot = unknown> {
  imports: ComponentImport<TSnapshot>[];
  instances: ComponentInstance[];
}

/**
 * The machine's relevance decision on a threat of a component's boundary
 * flow (design §17 I3, patch 15): only boundary flows, both directions,
 * rationale mandatory. `componentRelevance` is the component's decision at
 * the time of the override — when the component later changes it, the
 * override is "to review" (re-check on update).
 */
export interface ComponentRelevanceOverride {
  /** Id of the threat in the component (snapshot). */
  threatKey: string;
  relevance: "unrated" | "relevant" | "not_relevant" | "uncertain";
  rationale: string;
  componentRelevance: "unrated" | "relevant" | "not_relevant" | "uncertain";
  /** ISO date of the decision. */
  date: string;
}

/**
 * The machine's window of opportunity on one path of a component's attack
 * tree (design §7.2, patch 17): context-dependent, so rated by the machine
 * per instance and pathKey. A renamed node changes the pathKey — the entry
 * is then orphaned (update preview, phase 5).
 */
export interface ComponentPathOverlay {
  /** Id of the tree in the component (snapshot). */
  treeKey: string;
  pathKey: string;
  windowOfOpportunity: "unlimited" | "easy" | "moderate" | "difficult";
  date: string;
}

/** One use of an imported component in the machine DFD (design §6.4). */
export interface ComponentInstance {
  id: string;
  importId: string;
  multiprocessTfId: string;
  /** Display-id prefix, e.g. "CAM1". */
  prefix: string;
  eeMapping: { componentEeId: string; machineTfId: string }[];
  assumptions: ComponentAssumptionStatus[];
  /** Relevance overrides on boundary-flow threats (I3). Absent: none. */
  relevanceOverrides?: ComponentRelevanceOverride[];
  /** Window of opportunity per component attack path (ISO, patch 17). Absent: none. */
  pathOverlays?: ComponentPathOverlay[];
  /**
   * How many identical units this instance stands for — same installation
   * context, one analysis (I5, user 2026-11-08). Absent: 1. Units in other
   * contexts are instances of their own.
   */
  quantity?: number;
}
