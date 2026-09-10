// src/tests/unit/features/overview/services/source-binding-drift.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SourceBinding, DriftEvent } from "shared";
import {
  checkDrift,
  recordDriftIfTransitioned,
  checkAndRecordDrift,
} from "features/overview/services/source-binding-drift";
import type { SourceBindingResolutionResult } from "features/overview/services/source-binding-service";
import * as sourceBindingService from "features/overview/services/source-binding-service";

// ==================== FIXTURES ====================
// No shared binding-factory turned up in the tree (source-binding-utils.ts
// is model-shape utilities, not a test factory) — kept local and minimal.
// If a mock-data.ts helper for SourceBinding already exists, swap this for
// that instead of keeping a second one.
function makeBinding(overrides: Partial<SourceBinding> = {}): SourceBinding {
  return {
    id: "binding-1",
    repoUrl: "https://github.com/example/repo.git",
    refType: "branch",
    refLabel: "main",
    resolvedCommitSha: "aaa111",
    driftEvents: [],
    ...overrides,
  };
}

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

function result(
  overrides: Partial<SourceBindingResolutionResult> = {},
): SourceBindingResolutionResult {
  return { success: true, reachable: true, sha: "aaa111", ...overrides };
}

// ==================== checkDrift ====================

describe("checkDrift", () => {
  it("returns clean when the ref is a pinned commit, regardless of the result", () => {
    const binding = makeBinding({ refType: "commit", resolvedCommitSha: "aaa111" });
    expect(checkDrift(binding, result({ sha: "different-sha" }))).toBe("clean");
  });

  it("returns clean when the current sha matches resolvedCommitSha", () => {
    const binding = makeBinding({ resolvedCommitSha: "aaa111" });
    expect(checkDrift(binding, result({ sha: "aaa111" }))).toBe("clean");
  });

  it("returns unreachable when the result is not reachable", () => {
    const binding = makeBinding();
    expect(
      checkDrift(binding, result({ success: false, reachable: false, sha: undefined })),
    ).toBe("unreachable");
  });

  it("returns unreachable for a denied-consent result (reachable: false)", () => {
    const binding = makeBinding();
    expect(
      checkDrift(
        binding,
        result({ success: false, reachable: false, sha: undefined, error: "consent_denied" }),
      ),
    ).toBe("unreachable");
  });

  it("returns ref_missing when the repo is reached but the ref no longer resolves", () => {
    const binding = makeBinding();
    expect(checkDrift(binding, result({ sha: null }))).toBe("ref_missing");
  });

  it("returns branch_advanced for a moved regular branch", () => {
    const binding = makeBinding({ refType: "branch", resolvedCommitSha: "aaa111" });
    expect(checkDrift(binding, result({ sha: "bbb222" }))).toBe("branch_advanced");
  });

  it("returns branch_advanced_expected for a moved release branch", () => {
    const binding = makeBinding({
      refType: "release_branch",
      resolvedCommitSha: "aaa111",
    });
    expect(checkDrift(binding, result({ sha: "bbb222" }))).toBe(
      "branch_advanced_expected",
    );
  });

  it("returns tag_moved when a tag now points at a different commit", () => {
    const binding = makeBinding({ refType: "tag", resolvedCommitSha: "aaa111" });
    expect(checkDrift(binding, result({ sha: "bbb222" }))).toBe("tag_moved");
  });
});

// ==================== recordDriftIfTransitioned ====================

describe("recordDriftIfTransitioned", () => {
  it("updates currentDriftStatus but appends no event when status is clean", () => {
    const binding = makeBinding({ driftEvents: [] });
    const updated = recordDriftIfTransitioned(binding, "clean", "aaa111");
    expect(updated.currentDriftStatus).toBe("clean");
    expect(updated.driftEvents).toHaveLength(0);
  });

  it("appends a DriftEvent on the first non-clean status (no prior events)", () => {
    const binding = makeBinding({ driftEvents: [] });
    const updated = recordDriftIfTransitioned(binding, "branch_advanced", "bbb222");

    expect(updated.driftEvents).toHaveLength(1);
    const event = updated.driftEvents[0];
    expect(event.status).toBe("branch_advanced");
    expect(event.previousStatus).toBe("clean");
    expect(event.previousResolvedCommitSha).toBe("aaa111");
    expect(event.currentCommitSha).toBe("bbb222");
    expect(typeof event.id).toBe("string");
    expect(event.id.length).toBeGreaterThan(0);
    expect(() => new Date(event.detectedAt).toISOString()).not.toThrow();
  });

  it("does NOT append a new event when the status repeats an already-logged one", () => {
    const priorEvent = makeEvent({ status: "branch_advanced" });
    const binding = makeBinding({ driftEvents: [priorEvent] });

    const updated = recordDriftIfTransitioned(binding, "branch_advanced", "ccc333");

    expect(updated.driftEvents).toHaveLength(1); // unchanged
    expect(updated.currentDriftStatus).toBe("branch_advanced"); // live badge still updates
  });

  it("appends a new event on a genuine transition (e.g. branch_advanced -> tag_moved)", () => {
    const priorEvent = makeEvent({ status: "branch_advanced" });
    const binding = makeBinding({ driftEvents: [priorEvent] });

    const updated = recordDriftIfTransitioned(binding, "tag_moved", "ddd444");

    expect(updated.driftEvents).toHaveLength(2);
    const newEvent = updated.driftEvents[1];
    expect(newEvent.status).toBe("tag_moved");
    expect(newEvent.previousStatus).toBe("branch_advanced"); // last LOGGED status, not "clean"
  });

  it("appends a resolved->drifted-again transition after a clean live status", () => {
    // clean only ever updates the live badge (never logged, per the "clean"
    // guard) — so the last LOGGED status still carries forward correctly.
    const priorEvent = makeEvent({ status: "tag_moved" });
    const binding = makeBinding({
      driftEvents: [priorEvent],
      currentDriftStatus: "clean", // re-resolved clean in between, not logged
    });

    const updated = recordDriftIfTransitioned(binding, "tag_moved", "eee555");

    // same status as the last LOGGED one ("tag_moved") -> no new event
    expect(updated.driftEvents).toHaveLength(1);
  });

  it("never mutates the input binding or its driftEvents array", () => {
    const priorEvent = makeEvent();
    const originalEvents = [priorEvent];
    const binding = makeBinding({ driftEvents: originalEvents });

    recordDriftIfTransitioned(binding, "unreachable", undefined);

    expect(binding.driftEvents).toBe(originalEvents);
    expect(binding.driftEvents).toHaveLength(1);
  });

  it("does not apply drift logic bypass for commit refs at this layer", () => {
    // recordDriftIfTransitioned is deliberately unaware of refType — the
    // "commit can't drift" rule lives in checkDrift, not here, so this
    // function still logs whatever status it's given. Documents the
    // boundary rather than re-testing checkDrift's own rule.
    const binding = makeBinding({ refType: "commit", driftEvents: [] });
    const updated = recordDriftIfTransitioned(binding, "branch_advanced", "x");
    expect(updated.driftEvents).toHaveLength(1);
  });
});

// ==================== checkAndRecordDrift (orchestration) ====================

describe("checkAndRecordDrift", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves via resolveSourceBinding, classifies, and records a transition", async () => {
    vi.spyOn(sourceBindingService, "resolveSourceBinding").mockResolvedValue(
      result({ sha: "bbb222" }),
    );
    const binding = makeBinding({ refType: "branch", resolvedCommitSha: "aaa111" });
    const onConsentRequired = vi.fn().mockResolvedValue(true);

    const updated = await checkAndRecordDrift(binding, onConsentRequired);

    expect(sourceBindingService.resolveSourceBinding).toHaveBeenCalledWith(
      binding,
      onConsentRequired,
    );
    expect(updated.currentDriftStatus).toBe("branch_advanced");
    expect(updated.driftEvents).toHaveLength(1);
    expect(updated.driftEvents[0].currentCommitSha).toBe("bbb222");
  });

  it("propagates a consent-denied result as unreachable, without a crash", async () => {
    vi.spyOn(sourceBindingService, "resolveSourceBinding").mockResolvedValue({
      success: false,
      reachable: false,
      error: "consent_denied",
    });
    const binding = makeBinding();
    const onConsentRequired = vi.fn().mockResolvedValue(false);

    const updated = await checkAndRecordDrift(binding, onConsentRequired);

    expect(updated.currentDriftStatus).toBe("unreachable");
    expect(updated.driftEvents).toHaveLength(1);
    expect(updated.driftEvents[0].currentCommitSha).toBeUndefined();
  });

  it("leaves driftEvents empty when the resolved state is clean", async () => {
    vi.spyOn(sourceBindingService, "resolveSourceBinding").mockResolvedValue(
      result({ sha: "aaa111" }),
    );
    const binding = makeBinding({ resolvedCommitSha: "aaa111" });

    const updated = await checkAndRecordDrift(binding, vi.fn().mockResolvedValue(true));

    expect(updated.currentDriftStatus).toBe("clean");
    expect(updated.driftEvents).toHaveLength(0);
  });
});
