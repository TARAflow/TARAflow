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

/** Where an imported component TARA came from (design §4.1). */
export interface ComponentSource {
  /** Remote URL of the component repository — never a local path. */
  repoUrl?: string;
  branch?: string;
  /** Only tagged states are offered when set, e.g. "camera-tara/v*". */
  tagPattern?: string;
  /** Tag of the imported commit, if any. */
  tag?: string;
  commitSha: string;
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

/** One use of an imported component in the machine DFD (design §6.4). */
export interface ComponentInstance {
  id: string;
  importId: string;
  multiprocessTfId: string;
  /** Display-id prefix, e.g. "CAM1". */
  prefix: string;
  eeMapping: { componentEeId: string; machineTfId: string }[];
  assumptions: ComponentAssumptionStatus[];
}
