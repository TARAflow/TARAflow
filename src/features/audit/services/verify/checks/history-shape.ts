// ============ AUDIT VERIFICATION — CHECK: history shape ============
// The audit trail is linear by construction (ff-only). A merge (a commit with
// more than one parent) is rewrite/branch evidence → HISTORY_NONLINEAR. A
// non-anchor commit with no parent is a disconnected root → HISTORY_ORPHAN.
// Pure over the fetched history — needs no reader.

import type { Check } from "../verify-context";
import { makeFinding } from "../findings";

export const checkHistoryShape: Check = async ({ history, anchor }) => {
  const findings = [];
  for (const c of history) {
    if (c.parents.length > 1) {
      findings.push(
        makeFinding("HISTORY_NONLINEAR", {
          commit: c.hash,
          context: { parents: c.parents },
        }),
      );
    }
    if (c.parents.length === 0 && c.hash !== anchor) {
      findings.push(makeFinding("HISTORY_ORPHAN", { commit: c.hash }));
    }
  }
  return findings;
};
