// ============ AUDIT VERIFICATION — CHECK: repo state ============
// A dirty working tree or a detached HEAD is a warning: it doesn't taint the
// signed history, but a clean, on-branch checkout is what a trustworthy audit
// repo should present at verify time.

import type { Check } from "../verify-context";
import { makeFinding } from "../findings";

export const checkRepoState: Check = async ({ reader }) => {
  const findings = [];
  if (!(await reader.isWorkingTreeClean())) {
    findings.push(makeFinding("REPO_DIRTY"));
  }
  if (await reader.isHeadDetached()) {
    findings.push(makeFinding("REPO_DETACHED_HEAD"));
  }
  return findings;
};
