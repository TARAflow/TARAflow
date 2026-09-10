// src/tests/unit/features/overview/services/source-binding-findings.test.ts
import { describe, it, expect } from "vitest";
import type { DriftEvent } from "shared";
import {
  driftFindingFor,
  DEFAULT_SEVERITY,
  type DriftFindingId,
} from "features/overview/services/source-binding-findings";

function makeEvent(overrides: Partial<DriftEvent> = {}): DriftEvent {
  return {
    id: "evt-1",
    bindingId: "binding-1",
    detectedAt: "2026-01-01T00:00:00.000Z",
    status: "branch_advanced",
    previousStatus: "clean",
    previousResolvedCommitSha: "aaa111",
    ...overrides,
  };
}

describe("driftFindingFor", () => {
  it("maps each DriftStatus to its own stable finding id", () => {
    const cases: Array<[DriftEvent["status"], DriftFindingId]> = [
      ["branch_advanced", "source-binding.branch-advanced"],
      ["branch_advanced_expected", "source-binding.branch-advanced-expected"],
      ["tag_moved", "source-binding.tag-moved"],
      ["ref_missing", "source-binding.ref-missing"],
      ["unreachable", "source-binding.unreachable"],
    ];

    for (const [status, expectedId] of cases) {
      const finding = driftFindingFor(makeEvent({ status }));
      expect(finding.id).toBe(expectedId);
    }
  });

  it("applies the documented default severities (plan §7)", () => {
    // §7: non-clean drift statuses are warnings (review nudges); an expected
    // release-branch advance is info. No drift status is an "error".
    expect(driftFindingFor(makeEvent({ status: "tag_moved" })).severity).toBe(
      "warning",
    );
    expect(driftFindingFor(makeEvent({ status: "ref_missing" })).severity).toBe(
      "warning",
    );
    expect(driftFindingFor(makeEvent({ status: "unreachable" })).severity).toBe(
      "warning",
    );
    expect(driftFindingFor(makeEvent({ status: "branch_advanced" })).severity).toBe(
      "warning",
    );
    expect(
      driftFindingFor(makeEvent({ status: "branch_advanced_expected" })).severity,
    ).toBe("info");
  });

  it("includes commit when currentCommitSha is present", () => {
    const finding = driftFindingFor(
      makeEvent({ status: "tag_moved", currentCommitSha: "bbb222" }),
    );
    expect(finding.commit).toBe("bbb222");
  });

  it("omits commit for ref_missing and unreachable (nothing to compare)", () => {
    const refMissing = driftFindingFor(
      makeEvent({ status: "ref_missing", currentCommitSha: undefined }),
    );
    const unreachable = driftFindingFor(
      makeEvent({ status: "unreachable", currentCommitSha: undefined }),
    );
    expect(refMissing.commit).toBeUndefined();
    expect(unreachable.commit).toBeUndefined();
  });

  it("DEFAULT_SEVERITY covers every DriftFindingId exactly once", () => {
    const ids = Object.keys(DEFAULT_SEVERITY);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(5);
  });
});
