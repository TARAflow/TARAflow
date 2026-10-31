// ==================== AUDIT SIGNING IDENTITY ====================
// A pre-commit guard: when signing is enabled, is the commit-author email
// authorized in the manifest at all? If not, git would happily produce a
// signature that later fails verification ("No principal matched") — a silent
// failure of the user's stated intent. Better to block BEFORE the commit.
//
// Team-capable by design: it checks whether authorEmail is ANY principal in
// the manifest, not whether it's a specific person. Adding a colleague (their
// email + key) as a signer makes their commits pass.
//
// Deliberately NOT checked here: that the LOCAL active signing key is exactly
// the one bound to this principal. That needs reading the key from disk and is
// caught anyway at verification time (git %G? / the Phase-4 engine). This guard
// is the friendly early warning, not the enforcement.
//
// Pure: (authorEmail, manifestEntries) → result. No git, no I/O.

import { parseAllowedSigners, type SignerEntry } from "./audit-signer-manifest";

export interface SigningIdentityResult {
  ok: boolean;
  reason?: "email-not-authorized" | "empty-manifest";
}

/**
 * Is `authorEmail` authorized to sign audit commits?
 * - empty manifest → not ok ("empty-manifest"): nothing is authorized yet.
 * - email present as some entry's principal → ok.
 * - otherwise → not ok ("email-not-authorized").
 */
export function checkSigningIdentity(input: {
  authorEmail: string;
  manifestEntries: SignerEntry[];
}): SigningIdentityResult {
  const { authorEmail, manifestEntries } = input;

  if (manifestEntries.length === 0) {
    return { ok: false, reason: "empty-manifest" };
  }

  const email = authorEmail.trim().toLowerCase();
  const authorized = manifestEntries.some(
    (e) => e.principal.trim().toLowerCase() === email,
  );

  return authorized
    ? { ok: true }
    : { ok: false, reason: "email-not-authorized" };
}

/** Why a commit cannot be signed as the repository requires; null = fine. */
export type CommitSigningProblem = "key-missing" | "empty-manifest" | "email-not-authorized";

/**
 * How this commit is signed (reviews 2026-10-31). One truth, the engine's: the
 * signer manifest COMMITTED at HEAD (`committedManifest`, null = none) — the
 * engine checks each commit against its parent's manifest, never the working
 * tree. With a manifest every later commit is verified (SIG_UNSIGNED is an
 * error), so the commit is signed whatever the project's switch or the box
 * say. A signature needs a key for the format (git-signing commits unsigned
 * without one) and an author email the manifest authorizes.
 */
export function commitSigning(input: {
  committedManifest: string | null;
  /** The history introduced the manifest (anchor) — required even if removed since. */
  anchored?: boolean;
  signCommit: boolean;
  signingEnabled: boolean;
  format: "ssh" | "gpg";
  sshSigningKeyPath?: string;
  keyId?: string;
  authorEmail: string;
}): { required: boolean; sign: boolean; problem: CommitSigningProblem | null } {
  // Once the repository signs, it always signs (user 2026-10-31) — the
  // anchor counts even after the manifest was removed (then nobody is
  // authorized: "empty-manifest", as the engine sees it).
  const required = input.committedManifest !== null || !!input.anchored;
  const sign = required || (input.signingEnabled && input.signCommit);
  if (!sign) return { required, sign, problem: null };
  const key = input.format === "ssh" ? input.sshSigningKeyPath : input.keyId;
  if (!key) return { required, sign, problem: "key-missing" };
  const ident = checkSigningIdentity({
    authorEmail: input.authorEmail,
    manifestEntries: input.committedManifest ? parseAllowedSigners(input.committedManifest) : [],
  });
  return { required, sign, problem: ident.ok ? null : (ident.reason ?? "email-not-authorized") };
}
