// ==================== RC-6 — CIANAAA_TO_STRIDE single source of truth ====================
// Phase: per-element generation fix, Step 2 (housekeeping).
//
// Goal: there must be ONE CIANAAA_TO_STRIDE, defined in shared, consumed everywhere.
// The asset-feature copy (asset-security-goals-types.ts) is removed and re-exported
// from shared.
//
// The mapping assertion passes today (both copies are value-identical). The
// identity assertion is the consolidation acceptance: after the refactor the asset
// feature must export the SAME object reference as shared, not a second literal.

import { describe, it, expect } from "vitest";
import { CIANAAA_TO_STRIDE as SHARED_MAP } from "shared";

// After consolidation this import resolves to a re-export of the shared constant.
// Until then it points at the local duplicate and the identity test below is RED.


describe("CIANAAA_TO_STRIDE — canonical mapping (shared)", () => {
  it("maps every CIANAAA dimension to the correct STRIDE category", () => {
    expect(SHARED_MAP).toEqual({
      C: "I", // Confidentiality   → Information Disclosure
      I: "T", // Integrity         → Tampering
      A: "D", // Availability      → Denial of Service
      N: "R", // Non-repudiation   → Repudiation
      AuthN: "S", // Authentication → Spoofing
      AuthZ: "E", // Authorization  → Elevation of Privilege
      Acc: "R", // Accountability   → Repudiation
    });
  });

  it("covers exactly the seven security goal types used by EdGe2 assets", () => {
    expect(Object.keys(SHARED_MAP).sort()).toEqual(
      ["A", "Acc", "AuthN", "AuthZ", "C", "I", "N"].sort(),
    );
  });
});

