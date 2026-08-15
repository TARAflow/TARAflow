// ==================== AUDIT VERIFY — FINDING EXPLANATIONS ====================
// Renderer-side, plain-language explanations for engine findings. The engine
// (findings.ts) is i18n-free and emits a stable RULE CODE (FindingId) plus an
// English DEFAULT_MESSAGE aimed at CLI/CI/auditors. This module turns that code
// into a human title + an actionable "what to do" hint for the GUI — and, being
// keyed on the same FindingId, it is reused by the Phase-5 audit report.
//
// Completeness is compiler-enforced: EXPLANATIONS is Record<FindingId, …>, so a
// new rule code cannot ship without an explanation. Localization is optional and
// additive: each string resolves through i18n key
// `audit.verify.finding.<ID>.{title|hint}` with the English text as fallback.
//
// Lives at: src/features/audit/services/verify/finding-explanations.ts

import type { FindingId } from "./findings";

export interface FindingExplanation {
  /** One-line, plain-language summary of what the finding means. */
  title: string;
  /** Actionable next step for the user. Empty string = nothing to do. */
  hint: string;
}

type Translate = (key: string, fallback: string) => string;

/** English defaults — the source of truth; i18n overlays these by key. */
const EXPLANATIONS: Record<FindingId, FindingExplanation> = {
  // ── Anchor / bootstrap ─────────────────────────────────────────────────
  ANCHOR_NOT_FOUND: {
    title: "No signer manifest in the history",
    hint: "Bootstrap the trail: add a signer on the Signers tab — that creates the manifest and its first commit.",
  },
  ANCHOR_MISMATCH: {
    title: "The trail starts from a different root than expected",
    hint: "The pinned anchor doesn't match this history. Re-pin it to this repo's bootstrap commit, or check you're on the right branch.",
  },
  ANCHOR_TAG_MOVED: {
    title: "The audit-root tag points somewhere else",
    hint: "Move the audit-root tag onto the bootstrap commit — or ignore this if the tag is intentionally elsewhere.",
  },
  ANCHOR_SIGNER_NOT_MAINTAINER: {
    title: "The first signer isn't a maintainer",
    hint: "The bootstrap commit must be signed by someone listed as a maintainer in the manifest it introduces.",
  },
  PRE_ANCHOR_COMMITS: {
    title: "Some commits come before the audit start",
    hint: "These predate the trail and aren't verified — expected right after bootstrapping an existing project.",
  },

  // ── Signatures + authority ─────────────────────────────────────────────
  SIG_UNSIGNED: {
    title: "A commit isn't signed",
    hint: "Enable commit signing in the audit config and re-commit — unsigned commits can't be attributed to a signer.",
  },
  SIG_BAD: {
    title: "A signature isn't valid",
    hint: "The signature couldn't be verified against the signer's key. Re-sign the commit with a valid key.",
  },
  SIGNER_NOT_AUTHORIZED: {
    title: "A commit was signed by someone not yet authorized",
    hint: "The signer wasn't in the manifest before this commit. A maintainer must add them before they sign.",
  },
  MANIFEST_NOT_MAINTAINER: {
    title: "A manifest change wasn't made by a maintainer",
    hint: "Only maintainers may change .tara/allowed_signers. Have a maintainer make the change.",
  },
  MANIFEST_NO_MAINTAINER: {
    title: "The signer manifest has no maintainer",
    hint: "Add at least one maintainer on the Signers tab, otherwise the manifest can never be changed again.",
  },
  MANIFEST_EMPTY: {
    title: "The signer manifest is empty",
    hint: "Add a signer on the Signers tab.",
  },

  // ── Commit message + review ────────────────────────────────────────────
  MSG_SCHEMA: {
    title: "A commit message doesn't follow the required format",
    hint: "Use '[TARA] <round>' with the required trailers, or 'audit:' for infra commits. The managed hook enforces this going forward.",
  },
  REVIEW_MISSING: {
    title: "A change is missing a reviewer",
    hint: "Add a 'Reviewed-by' trailer naming a second person when four-eyes review is required.",
  },
  REVIEW_SELF: {
    title: "The author reviewed their own change",
    hint: "The reviewer must be a different person than the author.",
  },

  // ── History shape + repo state ─────────────────────────────────────────
  HISTORY_NONLINEAR: {
    title: "The history isn't linear",
    hint: "An unexpected merge or rewrite was found. Keep the audit branch linear (fast-forward only).",
  },
  HISTORY_ORPHAN: {
    title: "A commit has no path back to the start",
    hint: "A commit doesn't trace back to the anchor — a sign of a rewrite. Investigate the history.",
  },
  REPO_DIRTY: {
    title: "There are uncommitted changes",
    hint: "Commit or discard the working-tree changes, then verify again.",
  },
  REPO_DETACHED_HEAD: {
    title: "You're not on a branch (detached HEAD)",
    hint: "Check out the audit branch before verifying.",
  },

  // ── TCS byte-reproducibility ───────────────────────────────────────────
  TCS_NONREPRODUCIBLE: {
    title: "A project file isn't in canonical form",
    hint: "Re-save the .tara.json with the current app so it matches the canonical (reproducible) format.",
  },
  TCS_PARSE_ERROR: {
    title: "A project file couldn't be read",
    hint: "A .tara.json is corrupt or truncated. Restore it from git history.",
  },
  TCS_UNKNOWN_VERSION: {
    title: "A project file uses a newer format",
    hint: "This file records a TCS version this build doesn't know — update the app.",
  },

  // ── Hooks + protection attestation ─────────────────────────────────────
  HOOKS_VERSION_MISMATCH: {
    title: "The installed git hooks are outdated",
    hint: "Re-install the managed hooks (Install git hooks) to get the current version.",
  },
  HOOKS_MISSING: {
    title: "The git hooks aren't installed",
    hint: "Install the managed hooks to guard commits locally (the CLI/CI check stays authoritative).",
  },
  PROTECTION_ATTESTATION: {
    title: "Branch protection is recorded, not checked here",
    hint: "Confirm branch protection on your git host — it can't be observed from the local repo.",
  },

  // ── Round monotonicity (retired; kept for completeness) ────────────────
  ROUND_NONMONOTONIC: {
    title: "Round numbers aren't increasing",
    hint: "Informational — rounds are repeatable workflow phases, not a counter.",
  },
  ROUND_SKIPPED: {
    title: "A round number was skipped",
    hint: "Informational — usually harmless.",
  },

  // ── Engine ─────────────────────────────────────────────────────────────
  ENGINE_ERROR: {
    title: "A check couldn't complete",
    hint: "One check failed to run; the technical message has details. The rest of the result is still valid.",
  },
};

/** i18n key for a finding's plain-language title/hint. */
export function findingExplanationKey(
  id: FindingId,
  part: "title" | "hint",
): string {
  return `audit.verify.finding.${id}.${part}`;
}

/** Localized plain-language explanation for a finding (English fallback). */
export function explainFinding(
  id: FindingId,
  translate: Translate,
): FindingExplanation {
  const def = EXPLANATIONS[id] ?? { title: id, hint: "" };
  return {
    title: translate(findingExplanationKey(id, "title"), def.title),
    hint: translate(findingExplanationKey(id, "hint"), def.hint),
  };
}

export const FINDING_EXPLANATIONS = EXPLANATIONS;
