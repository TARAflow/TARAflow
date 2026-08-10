// ============ AUDIT VERIFICATION — CHECK: message schema ============
// Each commit on the target ref must be either an `audit:` infra commit (exempt
// from the round schema) or a `[TARA] <round>` assessment commit carrying the
// required trailers. The required set matches what the commit-flow always writes
// (audit-types.generateCommitMessage) — parse what we write. Adjust the constant
// here if the writer changes.

import type { Check } from "../verify-context";
import { makeFinding } from "../findings";
import { parseCommitMessage, isAuditSubject, taraRound } from "../message";

/** Trailers the commit-flow always emits for a [TARA] round. */
export const REQUIRED_TARA_TRAILERS = [
  "Affected-Phases",
  "Batch-Size",
  "Author",
  "Date",
] as const;

export const checkMessageSchema: Check = async ({ history }) => {
  const findings = [];
  for (const c of history) {
    const { subject, trailers } = parseCommitMessage(c.message);

    if (isAuditSubject(subject)) continue; // infra: exempt from the round schema

    if (taraRound(subject) === null) {
      findings.push(
        makeFinding("MSG_SCHEMA", {
          commit: c.hash,
          message:
            "Commit subject is neither a [TARA] <round> header nor an audit: infra commit.",
          context: { subject },
        }),
      );
      continue;
    }

    const missing = REQUIRED_TARA_TRAILERS.filter((k) => !(k in trailers));
    if (missing.length) {
      findings.push(
        makeFinding("MSG_SCHEMA", {
          commit: c.hash,
          message: `Missing required trailer(s): ${missing.join(", ")}.`,
          context: { missing },
        }),
      );
    }
  }
  return findings;
};
