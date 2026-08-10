// ============ AUDIT VERIFICATION — CHECK: protection attestation ============
// Server-side branch protection (path-based review on `.tara/`, branch rules) is
// the PREVENTION layer; the engine is DETECTION. The engine cannot observe a
// hosting provider's policy locally, so it only RECORDS the expectation — an
// informational finding, never a pass/fail. Emitted when the policy names
// protected branches.

import type { Check } from "../verify-context";
import { makeFinding } from "../findings";

export const checkProtectionAttestation: Check = async ({ policy }) => {
  if (!policy.protectedBranches.length) return [];
  return [
    makeFinding("PROTECTION_ATTESTATION", {
      context: { branches: policy.protectedBranches },
      message: `Branch protection is expected on: ${policy.protectedBranches.join(
        ", ",
      )} — not observable locally (server-side control).`,
    }),
  ];
};
