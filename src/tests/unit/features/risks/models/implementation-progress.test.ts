// tests/unit/features/risks/models/implementation-progress.test.ts
//
// The risk's implementation status from its mitigations: the lowest state
// counts. User 2026-11-10: one mitigation implemented, one verified → the
// risk is implemented, not verified (before, one verified was enough).

import { describe, expect, it } from "vitest";
import { deriveImplementationProgress, type MitigationStatus } from "features/risks/models/risk-mitigation-types";

const of = (...statuses: MitigationStatus[]) => deriveImplementationProgress(statuses.map((status, i) => ({ id: `M-${i}`, status })));

describe("deriveImplementationProgress", () => {
  it("verified only when every active mitigation is verified", () => {
    expect(of("implemented", "verified")).toBe("implemented");
    expect(of("verified", "verified")).toBe("verified");
    expect(of("verified", "rejected")).toBe("verified");
    expect(of("implemented", "implemented")).toBe("implemented");
  });

  it("the other rules are unchanged", () => {
    expect(deriveImplementationProgress([])).toBe("not_started");
    expect(of("rejected", "rejected")).toBe("rejected");
    expect(of("verified", "in_review")).toBe("in_review");
    expect(of("verified", "open")).toBe("in_progress");
    expect(of("open", "open")).toBe("open");
  });
});
