// shared/models/source-binding-types.ts
// ==================== SOURCE VERSION BINDING ====================
// New, deliberately separate from features/audit (AuditData tracks the TARA
// project's OWN audit-trail repo; this tracks EXTERNAL implementation
// repositories the analysed system is built from — no overlap, see
// source-version-binding-implementation-plan.md §2).
//
// Lives in shared/models (not a features/source-binding module) because the
// same SourceBinding shape is attached from two different features:
//   - features/overview (project-level scope, GeneralTabData.sourceBindings)
//   - features/dfd or features/assets (element-level scope, on
//     Function/Process/System AssetProperties) — not yet wired, see plan §3.5.
// A features/source-binding module can still host the resolution/drift
// SERVICES later (Phase 2/3); the TYPES need to be reachable from both
// consumers, so they belong here, mirroring how WindowOfOpportunity,
// RegulationPresetId etc. already live in "shared" for the same reason.

// ==================== CORE BINDING ====================

/**
 * How the ref was specified. "release_branch" is distinct from "branch":
 * expected to keep advancing (backported fixes) — its drift reads as
 * informational, not a warning, unlike a regular branch moving on.
 */
export type SourceRefType = "branch" | "release_branch" | "tag" | "commit";

export interface SourceBinding {
  id: string;

  /**
   * ALWAYS the remote URL (https or git@), never a local filesystem path.
   * This is what makes the binding portable across machines and analysts —
   * see LocalCheckoutHint below for where the local-checkout convenience
   * lives instead (never persisted into the project file).
   */
  repoUrl: string;

  refType: SourceRefType;

  /**
   * Human-entered label, e.g. "main", "release/2.x", "v2.3.1". Mutable —
   * never treat this alone as proof of a specific state.
   */
  refLabel: string;

  /**
   * Immutable pin, resolved from refLabel at binding time (Phase 2). This is
   * what gets cited in the compliance report — refLabel is display-only.
   * Undefined until the analyst resolves the binding for the first time.
   */
  resolvedCommitSha?: string;

  /** ISO timestamp of the last successful resolution. */
  resolvedAt?: string;

  /** Optional build provenance, added once CI integration exists (Phase 5). */
  buildArtifactHash?: string;
  buildRecordUrl?: string;

  /**
   * Live-computed, not persisted as truth — recomputed on demand (Phase 3).
   * The persisted, audit-relevant record is `driftEvents` below.
   */
  currentDriftStatus?: DriftStatus;

  /**
   * Log of every OBSERVED STATE TRANSITION (not every check — logged only
   * when currentDriftStatus differs from the most recently logged status,
   * see plan §6.3). Append-only. This is the traceability record.
   * Always present (possibly empty), never undefined, so downstream code
   * doesn't need an existence check before reading/appending.
   */
  driftEvents: DriftEvent[];

  /**
   * Optional credential reference for private repos (Phase 2) — third
   * consumer of the existing Keytar-backed GitAuthConfig pattern already
   * used by Audit and Integration/Jira. Absent for public repos.
   */
  credentialRef?: CredentialRef;
}

// ==================== DRIFT ====================

/**
 * Six possible outcomes of comparing recorded vs. current state.
 * "unreachable" is distinct from "ref_missing": the repo/host could not be
 * contacted at all (network, VPN, firewall, DNS — the common case for
 * on-prem Git servers) vs. the repo WAS reached but the specific ref no
 * longer exists there. Conflating these would hide genuine connectivity
 * problems behind a "your tag was deleted" message, and vice versa.
 */
export type DriftStatus =
  | "clean" // current commit matches resolvedCommitSha
  | "branch_advanced" // refType "branch": moved on — TARA out of sync
  | "branch_advanced_expected" // refType "release_branch": moved on — expected
  | "tag_moved" // refType "tag": points to a DIFFERENT commit than recorded.
  // More severe than staleness — an integrity signal, not just an age one.
  | "ref_missing" // repo reached, but ref no longer resolves there
  | "unreachable"; // could not contact the repo/host at all

/**
 * One documented state TRANSITION. Persisted, append-only — logged only on
 * transition, not on every drift check, to stay within the project file's
 * size budget (plan §6.3, §11 pt. 4).
 */
export interface DriftEvent {
  id: string;
  bindingId: string;
  detectedAt: string; // ISO timestamp
  status: Exclude<DriftStatus, "clean">;
  previousStatus: DriftStatus; // what it was before this transition
  previousResolvedCommitSha: string;
  /** Absent for "ref_missing" and "unreachable" — nothing to compare. */
  currentCommitSha?: string;
  /**
   * Optional analyst note, e.g. "release branch fast-forwarded with an
   * approved security patch, re-reviewed 2026-03-02". Not required to
   * create the event; can be added later without altering the event itself.
   */
  note?: string;
}

// ==================== CREDENTIALS ====================

/**
 * Deliberately shaped like AuditConfig.auth (GitAuthConfig) — same
 * mechanism, same Keytar-backed storage, just a third feature using it
 * (after Audit and Integration/Jira). No new secret-storage design needed.
 */
export interface CredentialRef {
  method: "pat" | "ssh";
  /**
   * Keytar account identifier — keyed by host (e.g. "github.com",
   * "gitlab.internal.example.com") so a token entered once for a host is
   * reusable across every SourceBinding pointing at that host, rather than
   * re-prompting per binding.
   */
  account?: string;
  sshKeyPath?: string;
}

// ==================== LOCAL-CHECKOUT CONVENIENCE ====================
// Machine-local only. Electron: userData / a local SQLite/JSON side-store,
// keyed by (projectId, bindingId) — NEVER serialized into the .tara.json
// project file, and never synced or exported. Declared here so both the
// (future) resolution service and any renderer-side cache share one shape.

export interface LocalCheckoutHint {
  bindingId: string;
  localPath: string;
}
