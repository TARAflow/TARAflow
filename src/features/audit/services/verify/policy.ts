// ==================== AUDIT VERIFICATION — POLICY ====================
// What the engine verifies AGAINST. The bootstrap anchor is supplied
// out-of-band (never read from the repo — a repo can't vouch for its own root),
// so it is REQUIRED here. Everything else has a default. Suggested location:
// src/features/audit/services/verify/policy.ts.
//
// v1 keeps this small; later fields (requireSigning, expectedHooksVersion,
// checkRoundMonotonicity) slot in as the corresponding checks land.

import type { CommitHash } from "./git-reader";

/** Default target ref for the audit trail. */
export const DEFAULT_REF = "audit";

export interface Policy {
  /** The pinned root commit hash, supplied out-of-band. The trusted origin. */
  bootstrapAnchor: CommitHash;
  /** The ref whose history is verified (e.g. "audit", or "main" for an audit-only repo). */
  ref: string;
  /** Promote warnings to errors (the `--strict` mode). */
  strict: boolean;
  /** Require a Reviewed-by (reviewer != author) on every [TARA] round. */
  mandateFourEyes: boolean;
  /** Branches expected to be server-side protected (informational attestation). */
  protectedBranches: string[];
}

/**
 * Build a policy, filling defaults. Throws if the bootstrap anchor is missing —
 * without a pinned anchor there is no trusted root and verification is
 * meaningless.
 */
export function makePolicy(input: {
  bootstrapAnchor: CommitHash;
  ref?: string;
  strict?: boolean;
  mandateFourEyes?: boolean;
  protectedBranches?: string[];
}): Policy {
  const anchor = input.bootstrapAnchor?.trim();
  if (!anchor) {
    throw new Error(
      "Policy requires a bootstrapAnchor (the pinned root commit hash, supplied out-of-band).",
    );
  }
  return {
    bootstrapAnchor: anchor,
    ref: input.ref ?? DEFAULT_REF,
    strict: input.strict ?? false,
    mandateFourEyes: input.mandateFourEyes ?? false,
    protectedBranches: input.protectedBranches ?? [],
  };
}
