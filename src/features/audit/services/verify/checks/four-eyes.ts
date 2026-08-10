// ============ AUDIT VERIFICATION — CHECK: four-eyes ============
// Where the policy mandates review, every `[TARA]` round must carry a
// `Reviewed-by` trailer, and the reviewer must not be the author (a reviewer
// approving their own work is not four-eyes). Infra `audit:` commits are
// single-actor authority changes and are not subject to this rule. Off unless
// `policy.mandateFourEyes`.

import type { Check } from "../verify-context";
import { makeFinding } from "../findings";
import { parseCommitMessage, taraRound } from "../message";

export const checkFourEyes: Check = async ({ history, policy }) => {
  if (!policy.mandateFourEyes) return [];

  const findings = [];
  for (const c of history) {
    const { trailers } = parseCommitMessage(c.message);
    if (taraRound(c.subject) === null) continue; // only [TARA] rounds

    const reviewers = trailers["Reviewed-by"] ?? [];
    if (reviewers.length === 0) {
      findings.push(makeFinding("REVIEW_MISSING", { commit: c.hash }));
      continue;
    }

    // The reviewer must differ from the author (by git identity or Author trailer).
    const authorIdentities = new Set(
      [
        c.author.name,
        c.author.email,
        ...(trailers["Author"] ?? []),
      ].map((s) => s.trim().toLowerCase()),
    );
    if (reviewers.some((r) => authorIdentities.has(r.trim().toLowerCase()))) {
      findings.push(
        makeFinding("REVIEW_SELF", {
          commit: c.hash,
          context: { reviewer: reviewers },
        }),
      );
    }
  }
  return findings;
};
