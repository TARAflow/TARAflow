// ==================== AUDIT VERIFY (main) ====================
// Runs the Audit Verification Engine in the MAIN process (Node — it may spawn
// git). The renderer never spawns git; it calls this via the `audit:verify` IPC
// and receives only the serializable FindingsResult. Suggested location:
// electron/services/audit-verify-main.ts.
//
// Envelope: the app-standard { success, data | error }. Verify FINDINGS
// (pass/fail + the finding list) live INSIDE `data`; `success: false` means the
// engine could not run at all (no repo, bad policy, git failure) — a different
// axis from "the audit trail has problems".

import { createGitReaderExec } from "../../src/features/audit/services/verify/git-reader-exec";
import { verifyAudit } from "../../src/features/audit/services/verify/engine";
import { makePolicy } from "../../src/features/audit/services/verify/policy";
import type { FindingsResult } from "../../src/features/audit/services/verify/findings";
import { canonicalStringify } from "../../src/app/services/prepare-for-disk";

/** Policy as the renderer supplies it (the anchor is pinned out-of-band). */
export interface AuditVerifyPolicyInput {
  bootstrapAnchor: string;
  ref?: string;
  strict?: boolean;
  mandateFourEyes?: boolean;
  protectedBranches?: string[];
}

export interface AuditVerifyParams {
  /** Repo to verify. Falls back to the bound audit repo when omitted. */
  repoPath?: string;
  policy: AuditVerifyPolicyInput;
}

export type AuditVerifyResult =
  | { success: true; data: FindingsResult }
  | { success: false; error: string };

/**
 * Verify an audit repository. `boundRepoPath` is the currently bound audit repo
 * root (from git:setRepoPath) and is used when the caller doesn't pass an
 * explicit repoPath.
 */
export async function runAuditVerify(
  params: AuditVerifyParams,
  boundRepoPath?: string,
): Promise<AuditVerifyResult> {
  try {
    const repoPath = params?.repoPath ?? boundRepoPath;
    if (!repoPath) {
      return {
        success: false,
        error: "No repository path — open a project first, or pass repoPath.",
      };
    }
    if (!params?.policy?.bootstrapAnchor) {
      return {
        success: false,
        error: "policy.bootstrapAnchor is required (the pinned audit anchor).",
      };
    }

    const reader = createGitReaderExec(repoPath);
    const policy = makePolicy(params.policy);
    const data = await verifyAudit({
      reader,
      policy,
      canonicalize: canonicalStringify,
    });
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message ?? String(err) };
  }
}
