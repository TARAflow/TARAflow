// ==================== AUDIT VERIFY (renderer) ====================
// Thin renderer-side wrapper over the `audit:verify` IPC. The engine runs in
// MAIN (it spawns git); the renderer only sends the policy and receives the
// FindingsResult. Suggested location:
// src/features/audit/services/audit-verify-renderer.ts.
//
// Mirrors git-service-renderer / credential-service-renderer: unwrap the
// { success, data | error } envelope; a false success is an engine/environment
// failure and throws. Verify FINDINGS (pass/fail) are inside the returned
// FindingsResult — a "fail" result is NOT an exception.

import type { FindingsResult } from "./verify/findings";

export interface AuditVerifyPolicyInput {
  bootstrapAnchor: string;
  ref?: string;
  strict?: boolean;
  mandateFourEyes?: boolean;
  protectedBranches?: string[];
}

export interface AuditVerifyParams {
  /** Repo to verify; main falls back to the bound audit repo when omitted. */
  repoPath?: string;
  policy: AuditVerifyPolicyInput;
}

type Envelope =
  | { success: true; data: FindingsResult }
  | { success: false; error: string };

/**
 * Verify the audit trail. Resolves with the FindingsResult (inspect
 * `.result` for pass/fail); rejects only when the engine could not run
 * (no repo bound, git failure, bad policy).
 */
export async function verifyAuditRepo(
  params: AuditVerifyParams,
): Promise<FindingsResult> {
  if (!window.audit?.verify) {
    throw new Error("Audit API not available");
  }
  const res = (await window.audit.verify(params)) as Envelope;
  if (!res.success) {
    throw new Error(res.error);
  }
  return res.data;
}
