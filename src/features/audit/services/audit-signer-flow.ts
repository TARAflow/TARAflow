// ==================== AUDIT SIGNER FLOW (pure) ====================
// Add or remove an authorized signer = read the committed manifest → mutate it
// with the pure core (audit-signer-manifest.ts) → serialize → write → a
// PATH-SCOPED, SIGNED `audit:` commit on `.tara/allowed_signers`.
//
// Pure and dependency-injected (no React, no window, no git) so it is unit-
// testable; the hook supplies real FileIO + the existing GitService commit
// path. It REUSES the ordinary signed-commit plumbing — an infra commit is just
// "different message, different pathspec", not a second git path.
//
// IMPORTANT SCOPE: this WRITE flow does NOT enforce "the signer must already be
// authorized by the manifest before this commit". That authorization-over-
// history rule is the Audit Verification Engine's job at verify time (Phase 4).
// Here we simply sign with the configured audit key (which is authorized).

import type { GitOperationResult, GitCommitResult } from "../models/git-types";
import type { AuditConfig } from "../models/audit-types";
import type { FileIO } from "./audit-repo-attributes";
import {
  parseAllowedSigners,
  serializeAllowedSigners,
  addSigner,
  removeSigner,
  entryFromPubkey,
  isAuthorized,
  allowedSignersPathOf,
  ALLOWED_SIGNERS_REL_PATH,
  type SignerEntry,
} from "./audit-signer-manifest";

// ── Deps + I/O ───────────────────────────────────────────────────────────────

export interface SignerFlowDeps {
  fileIO: FileIO;
  /** Stage repo-relative paths (existing path-scoped stage). */
  stage: (relPaths: string[]) => Promise<GitOperationResult<void>>;
  /** Existing signed, path-scoped commit (reused as-is). */
  commit: (
    message: string,
    config: AuditConfig,
    signCommit: boolean,
    relPaths: string[],
  ) => Promise<GitOperationResult<GitCommitResult>>;
}

export type SignerFlowResult =
  | { ok: true; commit: GitCommitResult; entries: SignerEntry[] }
  | { ok: false; error: string };

/** Load + parse the manifest; a missing file is an empty manifest (not an error). */
async function readManifest(
  fileIO: FileIO,
  absPath: string,
): Promise<SignerEntry[]> {
  const text = await fileIO.read(absPath); // null on ENOENT (FileIO contract)
  return text ? parseAllowedSigners(text) : [];
}

// ── Add ──────────────────────────────────────────────────────────────────────

export interface AddSignerInput {
  repoRoot: string;
  config: AuditConfig;
  /** Commit-author email git verifies the signature's principal against. */
  principal: string;
  /** Raw contents of a `*.pub` file OR pasted pubkey text — same parser. */
  pubkey: string;
  /** Optional custom commit subject; defaults to a descriptive audit: line. */
  message?: string;
}

/**
 * Add a signer and commit the manifest. Idempotent: if the exact principal+key
 * is already present, nothing is written and no commit is made (returns ok with
 * the unchanged manifest and no commit).
 */
export async function runAddSigner(
  deps: SignerFlowDeps,
  input: AddSignerInput,
): Promise<SignerFlowResult> {
  const { repoRoot, config, principal, pubkey, message } = input;

  let entry: SignerEntry;
  try {
    entry = entryFromPubkey(principal, pubkey);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Invalid public key",
    };
  }

  const absPath = allowedSignersPathOf(repoRoot);
  const before = await readManifest(deps.fileIO, absPath);
  const after = addSigner(before, entry);

  // No-op: the key was already authorized. Don't create an empty commit.
  if (after === before || after.length === before.length) {
    return { ok: true, commit: undefined as never, entries: before };
  }

  const subject = message ?? `audit: authorize signer ${principal}`;
  return writeAndCommit(deps, config, absPath, after, subject);
}

// ── Remove ───────────────────────────────────────────────────────────────────

export interface RemoveSignerInput {
  repoRoot: string;
  config: AuditConfig;
  keyType: string;
  keyBlob: string;
  message?: string;
}

/**
 * Remove every entry with this public key and commit. If the key isn't present,
 * it's a no-op (ok, unchanged, no commit).
 */
export async function runRemoveSigner(
  deps: SignerFlowDeps,
  input: RemoveSignerInput,
): Promise<SignerFlowResult> {
  const { repoRoot, config, keyType, keyBlob, message } = input;

  const absPath = allowedSignersPathOf(repoRoot);
  const before = await readManifest(deps.fileIO, absPath);

  if (!isAuthorized(before, keyType, keyBlob)) {
    return { ok: true, commit: undefined as never, entries: before };
  }
  const after = removeSigner(before, keyType, keyBlob);

  // Guard: never leave the manifest empty (would lock the trail — no authorized
  // signer could ever sign the next commit). The last signer can't remove
  // themselves; that's a deliberate floor, not an off-by-one.
  if (after.length === 0) {
    return {
      ok: false,
      error:
        "Refusing to remove the last authorized signer — the manifest would " +
        "be empty and no one could sign further audit commits",
    };
  }

  const subject = message ?? `audit: revoke signer ${keyType} ${keyBlob}`;
  return writeAndCommit(deps, config, absPath, after, subject);
}

// ── Shared write + commit ────────────────────────────────────────────────────

async function writeAndCommit(
  deps: SignerFlowDeps,
  config: AuditConfig,
  absPath: string,
  entries: SignerEntry[],
  subject: string,
): Promise<SignerFlowResult> {
  try {
    await deps.fileIO.write(absPath, serializeAllowedSigners(entries));
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to write manifest",
    };
  }

  const rel = [ALLOWED_SIGNERS_REL_PATH];

  const staged = await deps.stage(rel);
  if (!staged.success) {
    return { ok: false, error: staged.error ?? "Failed to stage manifest" };
  }

  // Infra commit: ALWAYS signed (it changes the trust root), path-scoped to the
  // manifest, `audit:` category — never a `[TARA] <round>` commit.
  const committed = await deps.commit(subject, config, true, rel);
  if (!committed.success || !committed.data) {
    return { ok: false, error: committed.error ?? "Failed to commit manifest" };
  }

  return { ok: true, commit: committed.data, entries };
}
