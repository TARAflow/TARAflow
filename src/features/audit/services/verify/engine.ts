// ==================== AUDIT VERIFICATION — ENGINE (orchestrator) ============
// Runs the whole verification: resolve the target ref, run the trust walk (the
// authority chain), run the standalone checks, and assemble the serializable
// FindingsResult. One engine, many callers (Audit UI, CLI, CI, hooks). Suggested
// location: src/features/audit/services/verify/engine.ts.
//
// The reader and the canonical serializer are INJECTED, so this core stays pure
// and offline-testable; the wiring (main process / CLI) supplies a real
// git-backed reader and the real `canonicalStringify`.
//
// DEFERRED checks (not yet wired): hooks-version (needs a reader method to read
// installed hooks — lands with the thin hooks) and round-monotonicity (needs a
// defined round-number source).

import type { CommitInfo, GitReader } from "./git-reader";
import type { Policy } from "./policy";
import type { Finding, FindingsResult } from "./findings";
import { makeFinding, toResult } from "./findings";
import { ALLOWED_SIGNERS_REL_PATH } from "../audit-signer-manifest";
import { runTrustWalk } from "./trust-walk";
import type { Check, VerifyContext } from "./verify-context";
import { checkRepoState } from "./checks/repo-state";
import { checkHistoryShape } from "./checks/history-shape";
import { checkAnchorTag } from "./checks/anchor-tag";
import { checkMessageSchema } from "./checks/message-schema";
import { checkFourEyes } from "./checks/four-eyes";
import { checkTcsRepro } from "./checks/tcs-repro";
import { checkProtectionAttestation } from "./checks/protection-attestation";

const MANIFEST = ALLOWED_SIGNERS_REL_PATH;

/** The standalone checks the engine runs after the trust walk, in order. */
const CHECKS: Check[] = [
  checkRepoState,
  checkHistoryShape,
  checkAnchorTag,
  checkMessageSchema,
  checkFourEyes,
  checkTcsRepro,
  checkProtectionAttestation,
];

export interface VerifyOptions {
  reader: GitReader;
  policy: Policy;
  /** TCS canonical serializer (real `canonicalStringify` in production). */
  canonicalize: (value: unknown) => string;
}

/**
 * Verify an audit repository against the policy and return the findings result.
 * `result` is "fail" iff there is any error-severity finding (after `--strict`
 * promotion).
 */
export async function verifyAudit(
  opts: VerifyOptions,
): Promise<FindingsResult> {
  const { reader, policy, canonicalize } = opts;
  const anchor = policy.bootstrapAnchor;
  const findings: Finding[] = [];

  const tip = await reader.resolveRef(policy.ref);
  if (tip === null) {
    findings.push(
      makeFinding("ENGINE_ERROR", {
        message: `Target ref '${policy.ref}' was not found.`,
        context: { ref: policy.ref },
      }),
    );
    return toResult(findings, policy.strict);
  }

  // ── Trust chain (self-contained; reports any anchor mismatch itself) ────────
  findings.push(...(await runTrustWalk({ reader, anchor, tip })));

  // ── History for the standalone checks — only when the anchor is usable.
  // When it isn't, the trust walk has already reported the mismatch and the
  // history-based checks simply produce nothing.
  // NOTE: the trust walk also fetches history internally; a future verification
  // cache (AVE-v1 Performance) removes this second read.
  let history: CommitInfo[] = [];
  const anchorUsable =
    (await reader.isAncestor(anchor, tip)) &&
    (await reader.readFileAt(anchor, MANIFEST)) !== null;
  if (anchorUsable) {
    history = await reader.history(anchor, tip);
  }

  const ctx: VerifyContext = {
    reader,
    anchor,
    tip,
    history,
    policy,
    canonicalize,
  };
  for (const check of CHECKS) {
    findings.push(...(await check(ctx)));
  }

  return toResult(findings, policy.strict);
}
