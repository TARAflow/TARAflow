// ==================== AUDIT VERIFICATION — TRUST WALK ====================
// The core of the engine (AVE-v1.md "Trust reconstruction"): reconstruct
// authority from the immutable, signed history and flag every commit whose
// signer was NOT authorized by the manifest as it stood BEFORE that commit.
// Authority is anchored to POSITION in signed history, never to a timestamp.
// Suggested location: src/features/audit/services/verify/trust-walk.ts.
//
// SCOPE: this module is ONLY the trust chain — anchor bootstrap rules,
// per-commit signature + authorized-before, and manifest-authority
// (maintainer-only manifest changes + the "never without a maintainer"
// invariant). History shape, repo state, TCS reproducibility, message schema,
// four-eyes, hooks, rounds are SEPARATE check modules. The engine composes them.
//
// It runs against the GitReader PORT, so it is fully unit-testable with the
// in-memory fake — no real git.

import type { CommitHash, GitReader, VerifyResult } from "./git-reader";
import { makeFinding, type Finding } from "./findings";
import {
  parseAllowedSigners,
  serializeAllowedSigners,
  maintainers,
  ALLOWED_SIGNERS_REL_PATH,
  type SignerEntry,
} from "../audit-signer-manifest";

const MANIFEST = ALLOWED_SIGNERS_REL_PATH;

export interface TrustWalkInput {
  reader: GitReader;
  /** The pinned bootstrap anchor (from policy, out-of-band). */
  anchor: CommitHash;
  /** The target-ref tip to walk up to. */
  tip: CommitHash;
}

/** The manifest entries in a commit's tree (empty when the file is absent). */
async function manifestAt(
  reader: GitReader,
  commit: CommitHash,
): Promise<SignerEntry[]> {
  const text = await reader.readFileAt(commit, MANIFEST);
  return text ? parseAllowedSigners(text) : [];
}

/** Does this commit touch the signer manifest? */
async function changesManifest(
  reader: GitReader,
  commit: CommitHash,
): Promise<boolean> {
  const changed = await reader.changedPaths(commit);
  return changed.some((c) => c.path === MANIFEST);
}

/**
 * Turn a verification result into a finding (or null when "good"). "bad" is
 * reported as SIGNER_NOT_AUTHORIZED — v1 does not separate "signer not in the
 * pre-commit manifest" from "cryptographically invalid signature" (both are
 * errors); the optional message notes the anchor's self-anchoring case.
 */
function signatureFinding(
  result: VerifyResult,
  commit: CommitHash,
  context?: Record<string, unknown>,
  badMessage?: string,
): Finding | null {
  if (result === "good") return null;
  if (result === "none") return makeFinding("SIG_UNSIGNED", { commit, context });
  if (result === "error") {
    return makeFinding("ENGINE_ERROR", {
      commit,
      message: "Signature verification could not be completed.",
    });
  }
  // result === "bad"
  return makeFinding("SIGNER_NOT_AUTHORIZED", {
    commit,
    context,
    message: badMessage,
  });
}

/**
 * Reconstruct authority over `anchor..tip` and return the trust-chain findings.
 * A clean trail yields at most a PRE_ANCHOR_COMMITS info; any error finding
 * means the chain is broken.
 */
export async function runTrustWalk({
  reader,
  anchor,
  tip,
}: TrustWalkInput): Promise<Finding[]> {
  const findings: Finding[] = [];

  // ── The pinned anchor must be in the target ref's history ──────────────────
  if (!(await reader.isAncestor(anchor, tip))) {
    findings.push(
      makeFinding("ANCHOR_MISMATCH", {
        commit: anchor,
        message:
          "The pinned bootstrap anchor is not an ancestor of the target ref.",
        context: { anchor, tip },
      }),
    );
    return findings;
  }

  // ── The anchor must INTRODUCE the manifest (self-anchoring root) ────────────
  const introducedText = await reader.readFileAt(anchor, MANIFEST);
  if (introducedText === null) {
    findings.push(
      makeFinding("ANCHOR_MISMATCH", {
        commit: anchor,
        message: "The pinned anchor does not contain the signer manifest.",
      }),
    );
    return findings;
  }

  const history = await reader.history(anchor, tip);
  const anchorInfo = history[0];

  // The anchor's parent(s) must LACK the manifest — otherwise the real
  // introducing commit is earlier and the pin points too late.
  for (const parent of anchorInfo.parents) {
    if ((await reader.readFileAt(parent, MANIFEST)) !== null) {
      findings.push(
        makeFinding("ANCHOR_MISMATCH", {
          commit: anchor,
          message:
            "The signer manifest already exists before the pinned anchor; the anchor is not the introducing commit.",
          context: { earlierManifestAt: parent },
        }),
      );
      return findings;
    }
  }

  const introduced = parseAllowedSigners(introducedText);

  // ── Anchor signature: its signer must be present in the manifest it
  //    introduces (trusted only because the hash is pinned out-of-band). ──────
  const anchorSig = await reader.verifyCommitAgainst(
    anchor,
    serializeAllowedSigners(introduced),
  );
  const anchorSigFinding = signatureFinding(
    anchorSig,
    anchor,
    { author: anchorInfo.author.email },
    "The bootstrap commit's signer is not present in the manifest it introduces.",
  );
  if (anchorSigFinding) findings.push(anchorSigFinding);

  // ── Anchor manifest content invariants + anchor-signer-is-maintainer ───────
  if (introduced.length === 0) {
    findings.push(makeFinding("MANIFEST_EMPTY", { commit: anchor }));
  } else if (maintainers(introduced).length === 0) {
    // No maintainer at birth → the manifest could never be legitimately changed.
    findings.push(makeFinding("MANIFEST_NO_MAINTAINER", { commit: anchor }));
  } else if (anchorSig === "good") {
    // The bootstrap signer must itself be a maintainer in the introduced set.
    const maintSig = await reader.verifyCommitAgainst(
      anchor,
      serializeAllowedSigners(maintainers(introduced)),
    );
    if (maintSig !== "good") {
      findings.push(
        makeFinding("ANCHOR_SIGNER_NOT_MAINTAINER", {
          commit: anchor,
          context: { author: anchorInfo.author.email },
        }),
      );
    }
  }

  // ── Walk every commit after the anchor ─────────────────────────────────────
  for (let i = 1; i < history.length; i++) {
    const c = history[i];
    const parent = c.parents[0]; // first-parent; merges are a history-shape concern
    const before = parent ? await manifestAt(reader, parent) : [];

    // Signature + authorized-before: the signer must be in the manifest as it
    // stood BEFORE this commit (never the commit's own tree — no self-authorizing).
    const sig = await reader.verifyCommitAgainst(
      c.hash,
      serializeAllowedSigners(before),
    );
    const sigFinding = signatureFinding(sig, c.hash, {
      author: c.author.email,
    });
    if (sigFinding) findings.push(sigFinding);

    // Manifest-changing commit → maintainer-only + the resulting-state invariant.
    if (await changesManifest(reader, c.hash)) {
      if (sig === "good") {
        const maintSig = await reader.verifyCommitAgainst(
          c.hash,
          serializeAllowedSigners(maintainers(before)),
        );
        if (maintSig !== "good") {
          findings.push(
            makeFinding("MANIFEST_NOT_MAINTAINER", {
              commit: c.hash,
              context: { author: c.author.email },
            }),
          );
        }
      }
      const after = await manifestAt(reader, c.hash);
      if (after.length === 0) {
        findings.push(makeFinding("MANIFEST_EMPTY", { commit: c.hash }));
      } else if (maintainers(after).length === 0) {
        findings.push(makeFinding("MANIFEST_NO_MAINTAINER", { commit: c.hash }));
      }
    }
  }

  // ── Pre-anchor commits are outside the audit scope (informational) ─────────
  const preAnchor = await reader.countAncestors(anchor);
  if (preAnchor > 0) {
    findings.push(
      makeFinding("PRE_ANCHOR_COMMITS", {
        commit: anchor,
        context: { count: preAnchor },
      }),
    );
  }

  return findings;
}
