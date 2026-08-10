// ==================== AUDIT VERIFICATION — FINDINGS (pure) ====================
// The result model of the Audit Verification Engine (AVE v1, design §5.D /
// AVE-v1.md). Suggested location: features/audit/verify/findings.ts.
//
// ONE ENGINE, MANY CALLERS (Audit UI, CLI `taraflow verify`, CI, hooks, the
// Report Generator) — so the finding is a MACHINE contract, not prose:
//   - `id`      is a STABLE RULE CODE, repeatable across commits. Two commits
//               failing the same rule produce two findings with the same `id`
//               and different `commit`. CI keys on it; auditors allowlist on it;
//               the report groups on it.
//   - `context` carries the STRUCTURED payload (expected vs. actual hash, the
//               signer principal, the offending path, the TCS version …).
//   - `message` is an ENGLISH DEFAULT only. The engine runs in main / the CLI,
//               where there is no i18n; the Audit UI and the Report Generator
//               localize from `id` + `context`. Never treat `message` as the
//               contract.
//
// Pure and dependency-free (no git, no I/O, no React) so it is fully
// unit-testable. The trust walk and the individual checks CONSTRUCT findings
// with `makeFinding`; the engine ASSEMBLES them with `toResult`.

// ── Version ──────────────────────────────────────────────────────────────────

/** AVE ruleset version. A change to what counts as pass/fail is a new version
 *  (AVE-v1.md §Versioning); it is recorded in every result so old results stay
 *  interpretable. */
export const AVE_VERSION = 1;

// ── Severity ─────────────────────────────────────────────────────────────────

export type Severity = "error" | "warning" | "info";

// ── Rule codes (the check catalogue, AVE-v1.md) ──────────────────────────────
//
// Grouped by area. Adding a rule = add its id here AND a row in DEFAULT_SEVERITY
// and DEFAULT_MESSAGE below — the `Record<FindingId, …>` typing makes the
// compiler reject a half-added rule.

export type FindingId =
  // Anchor / bootstrap (the pinned root — AVE-v1.md "bootstrap anchor")
  | "ANCHOR_NOT_FOUND" // no commit adds .tara/allowed_signers
  | "ANCHOR_MISMATCH" // the manifest-introducing root ≠ pinned bootstrapAnchor
  | "ANCHOR_TAG_MOVED" // an `audit-root` tag exists but does not point at the anchor
  | "ANCHOR_SIGNER_NOT_MAINTAINER" // bootstrap signer is not a maintainer in the introduced manifest
  | "PRE_ANCHOR_COMMITS" // N commits precede the anchor (Pre-Audit, out of scope)
  // Signatures + authority (per commit; trust walk)
  | "SIG_UNSIGNED" // commit carries no signature
  | "SIG_BAD" // signature present but not cryptographically valid
  | "SIGNER_NOT_AUTHORIZED" // signer ∉ manifest effective BEFORE the commit
  | "MANIFEST_NOT_MAINTAINER" // manifest-changing commit signed by a non-maintainer (before)
  | "MANIFEST_NO_MAINTAINER" // manifest at some position has zero maintainers (invariant)
  | "MANIFEST_EMPTY" // manifest at some position is empty
  // Commit message + review
  | "MSG_SCHEMA" // `[TARA] <round>` header / required trailers malformed
  | "REVIEW_MISSING" // no `Reviewed-by` where policy mandates four-eyes
  | "REVIEW_SELF" // reviewer == author (four-eyes violated)
  // History shape + repo state
  | "HISTORY_NONLINEAR" // non-linear history / unexpected merge (rewrite evidence)
  | "HISTORY_ORPHAN" // orphan commit — no ancestry path to the anchor
  | "REPO_DIRTY" // working tree not clean at verify time
  | "REPO_DETACHED_HEAD" // HEAD is detached
  // TCS byte-reproducibility (per changed *.tara.json)
  | "TCS_NONREPRODUCIBLE" // blob ≠ canonicalStringify(JSON.parse(blob))
  | "TCS_PARSE_ERROR" // a *.tara.json blob does not parse
  | "TCS_UNKNOWN_VERSION" // file records a TCS version this engine does not know
  // Hooks + protection attestation
  | "HOOKS_VERSION_MISMATCH" // installed hooks ≠ expected version
  | "HOOKS_MISSING" // expected hooks not installed
  | "PROTECTION_ATTESTATION" // branch-protection expectations (informational for hosted remotes)
  // Round monotonicity (optional check)
  | "ROUND_NONMONOTONIC" // round numbers not monotonic
  | "ROUND_SKIPPED" // a round number was skipped
  // Engine
  | "ENGINE_ERROR"; // a single check could not complete (a TOTAL failure is an
//                    exception → CLI exit 3; this id is for a check that failed
//                    while the rest of the run continued)

// ── Default severities ───────────────────────────────────────────────────────
//
// The single place severity is decided, so `--strict` promotion and the report
// reason about one source of truth. A check may OVERRIDE per finding via
// `makeFinding(id, { severity })`, but the default is here.

export const DEFAULT_SEVERITY: Record<FindingId, Severity> = {
  // Anchor / bootstrap
  ANCHOR_NOT_FOUND: "error",
  ANCHOR_MISMATCH: "error",
  ANCHOR_TAG_MOVED: "warning",
  ANCHOR_SIGNER_NOT_MAINTAINER: "error",
  PRE_ANCHOR_COMMITS: "info",
  // Signatures + authority
  SIG_UNSIGNED: "error",
  SIG_BAD: "error",
  SIGNER_NOT_AUTHORIZED: "error",
  MANIFEST_NOT_MAINTAINER: "error",
  MANIFEST_NO_MAINTAINER: "error",
  MANIFEST_EMPTY: "error",
  // Message + review
  MSG_SCHEMA: "warning",
  REVIEW_MISSING: "error",
  REVIEW_SELF: "error",
  // History + repo
  HISTORY_NONLINEAR: "error",
  HISTORY_ORPHAN: "error",
  REPO_DIRTY: "warning",
  REPO_DETACHED_HEAD: "warning",
  // TCS
  TCS_NONREPRODUCIBLE: "error",
  TCS_PARSE_ERROR: "error",
  TCS_UNKNOWN_VERSION: "info",
  // Hooks + protection
  HOOKS_VERSION_MISMATCH: "warning",
  HOOKS_MISSING: "warning",
  PROTECTION_ATTESTATION: "info",
  // Rounds
  ROUND_NONMONOTONIC: "warning",
  ROUND_SKIPPED: "warning",
  // Engine
  ENGINE_ERROR: "error",
};

// ── Default English messages ─────────────────────────────────────────────────
//
// Fallback prose only. A check with a `context` payload SHOULD pass a formatted
// `message`; these keep the CLI readable when it does not.

export const DEFAULT_MESSAGE: Record<FindingId, string> = {
  ANCHOR_NOT_FOUND:
    "No commit introduces the signer manifest (.tara/allowed_signers).",
  ANCHOR_MISMATCH:
    "The manifest-introducing root commit does not match the pinned bootstrap anchor.",
  ANCHOR_TAG_MOVED: "The audit-root tag does not point at the bootstrap anchor.",
  ANCHOR_SIGNER_NOT_MAINTAINER:
    "The bootstrap commit's signer is not a maintainer in the manifest it introduces.",
  PRE_ANCHOR_COMMITS:
    "Commits precede the audit anchor; they are outside the audit scope.",
  SIG_UNSIGNED: "Commit is not signed.",
  SIG_BAD: "Commit signature is not cryptographically valid.",
  SIGNER_NOT_AUTHORIZED:
    "Commit signer was not authorized by the manifest as it stood before the commit.",
  MANIFEST_NOT_MAINTAINER:
    "A commit changing the signer manifest was not signed by a maintainer authorized before it.",
  MANIFEST_NO_MAINTAINER:
    "The signer manifest has no maintainer at this position; manifest changes would be impossible.",
  MANIFEST_EMPTY: "The signer manifest is empty at this position.",
  MSG_SCHEMA:
    "Commit message does not follow the required header/trailer schema.",
  REVIEW_MISSING: "A required Reviewed-by trailer is missing.",
  REVIEW_SELF: "The reviewer is the same identity as the author (four-eyes violated).",
  HISTORY_NONLINEAR:
    "History is not linear (an unexpected merge or rewrite was found).",
  HISTORY_ORPHAN: "An orphan commit with no ancestry path to the anchor was found.",
  REPO_DIRTY: "The working tree is not clean.",
  REPO_DETACHED_HEAD: "HEAD is detached.",
  TCS_NONREPRODUCIBLE:
    "A .tara.json is not byte-identical to its canonical TCS re-serialization.",
  TCS_PARSE_ERROR: "A .tara.json could not be parsed.",
  TCS_UNKNOWN_VERSION:
    "A .tara.json records a TCS version this engine does not know.",
  HOOKS_VERSION_MISMATCH: "Installed git hooks do not match the expected version.",
  HOOKS_MISSING: "Expected git hooks are not installed.",
  PROTECTION_ATTESTATION:
    "Branch-protection expectations are recorded (not observable for hosted remotes).",
  ROUND_NONMONOTONIC: "Round numbers are not monotonic.",
  ROUND_SKIPPED: "A round number was skipped.",
  ENGINE_ERROR: "A verification check could not complete.",
};

/** Every known rule code, for iteration (tests, docs, an allowlist UI). */
export const ALL_FINDING_IDS = Object.keys(DEFAULT_SEVERITY) as FindingId[];

// ── The finding ──────────────────────────────────────────────────────────────

export interface Finding {
  /** Stable rule code — the machine contract. Repeatable across commits. */
  id: FindingId;
  /** Effective severity (may have been promoted by `--strict`). */
  severity: Severity;
  /** English default text. UI/report localize from `id` + `context` instead. */
  message: string;
  /** The commit this finding is about, when it is commit-scoped (full hash). */
  commit?: string;
  /** Structured payload for machine consumers and localized rendering. */
  context?: Record<string, unknown>;
}

/**
 * Construct a finding. Severity and message default to the registries above;
 * pass overrides for a context-aware message or a one-off severity. `commit`
 * and `context` are only attached when provided, so findings stay minimal and
 * byte-stable when serialized.
 */
export function makeFinding(
  id: FindingId,
  opts: {
    commit?: string;
    message?: string;
    context?: Record<string, unknown>;
    severity?: Severity;
  } = {},
): Finding {
  return {
    id,
    severity: opts.severity ?? DEFAULT_SEVERITY[id],
    message: opts.message ?? DEFAULT_MESSAGE[id],
    ...(opts.commit ? { commit: opts.commit } : {}),
    ...(opts.context ? { context: opts.context } : {}),
  };
}

// ── Aggregation ──────────────────────────────────────────────────────────────

export interface FindingsSummary {
  error: number;
  warning: number;
  info: number;
}

export interface FindingsResult {
  /** Ruleset version that produced this result. */
  aveVersion: number;
  /** Overall verdict — `fail` iff there is at least one error-severity finding. */
  result: "pass" | "fail";
  /** Whether warnings were promoted to errors for this result. */
  strict: boolean;
  /** Counts by (effective) severity. */
  summary: FindingsSummary;
  /** All findings, in the order the engine produced them (deterministic). */
  findings: Finding[];
}

/** Promote every warning to an error (the `--strict` transform). New array. */
export function applyStrict(findings: Finding[]): Finding[] {
  return findings.map((f) =>
    f.severity === "warning" ? { ...f, severity: "error" as const } : f,
  );
}

/** Count findings by severity. */
export function summarize(findings: Finding[]): FindingsSummary {
  const summary: FindingsSummary = { error: 0, warning: 0, info: 0 };
  for (const f of findings) summary[f.severity]++;
  return summary;
}

/** True iff any finding is error-severity. */
export function hasErrors(findings: Finding[]): boolean {
  return findings.some((f) => f.severity === "error");
}

/**
 * Assemble the serializable result. With `strict`, warnings are promoted first,
 * so both the emitted findings and the summary reflect the effective severity.
 * `result` is `fail` iff any (effective) error remains.
 */
export function toResult(findings: Finding[], strict = false): FindingsResult {
  const effective = strict ? applyStrict(findings) : findings;
  const summary = summarize(effective);
  return {
    aveVersion: AVE_VERSION,
    result: summary.error > 0 ? "fail" : "pass",
    strict,
    summary,
    findings: effective,
  };
}

/** Stable JSON form for CI / the Report Generator (one trailing newline). */
export function serializeFindings(result: FindingsResult): string {
  return JSON.stringify(result, null, 2) + "\n";
}
