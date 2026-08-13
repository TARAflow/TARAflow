// ============ AUDIT VERIFICATION — CHECK: message schema ============
// Thin adapter: map the SHARED validateAuditMessage predicate (in ../message)
// onto per-commit Findings. The predicate is the single source of truth shared
// with the commit-msg git hook, so the local hook and the engine never drift.

import type { Check } from "../verify-context";
import { makeFinding } from "../findings";
import { validateAuditMessage } from "../message";

// Re-export so existing importers of REQUIRED_TARA_TRAILERS keep working.
export { REQUIRED_TARA_TRAILERS } from "../message";

export const checkMessageSchema: Check = async ({ history }) => {
  const findings = [];
  for (const c of history) {
    for (const p of validateAuditMessage(c.message)) {
      if (p.kind === "bad-subject") {
        findings.push(
          makeFinding("MSG_SCHEMA", {
            commit: c.hash,
            message:
              "Commit subject is neither a [TARA] <round> header nor an audit: infra commit.",
            context: { subject: p.subject },
          }),
        );
      } else {
        findings.push(
          makeFinding("MSG_SCHEMA", {
            commit: c.hash,
            message: `Missing required trailer(s): ${p.missing.join(", ")}.`,
            context: { missing: p.missing },
          }),
        );
      }
    }
  }
  return findings;
};
