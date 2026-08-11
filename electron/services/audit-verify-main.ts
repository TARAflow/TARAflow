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
//
// BUILD: this file is esbuild-bundled (see the `bundle:audit-main` npm script)
// into a self-contained dist-electron/services/audit-verify-main.cjs, so the
// engine + its deps are inlined and no TS path aliases survive to runtime.
// `canonicalStringify` is imported from the project-types-FREE ./tcs-serialize
// module (relative), so the Electron typecheck does not drag the Project type
// graph. It is the SAME serializer prepare-for-disk uses to write .tara.json —
// one source of truth for "canonical", which the TCS reproducibility check
// depends on.

import { createGitReaderExec } from "audit/services/verify/git-reader-exec";
import { verifyAudit } from "audit/services/verify/engine";
import { makePolicy } from "audit/services/verify/policy";
import type { FindingsResult } from "audit/services/verify/findings";
import { canonicalStringify } from "../../src/app/services/tcs-serialize";

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