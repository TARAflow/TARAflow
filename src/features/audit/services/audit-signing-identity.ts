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

import type { SignerEntry } from "./audit-signer-manifest";

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
