// Phase statuses derived in the commit chain: General and Attack Tree on
// every commit, Assets and Risk also on load — an example project written
// elsewhere (Headlamp, ISO/SAE 21434) showed only Threats as complete.
import { describe, it, expect } from "vitest";
import { commitLoadedPhaseStatus, commitPhaseStatus } from "app/services/phase-status-commit";
import { mergeProjectPatch } from "app/services/project-commit";
import { DEFAULT_PHASE_STATUS } from "app/services/migration-service";
import type { Project } from "app/models/project-types";

const INFO = {
  name: "Headlamp",
  description: "TARA",
  version: "1.0",
  responsible: "JPM",
  tags: { custom: [], domain: ["Automotive"], platform: [], regulation: ["ISO 21434"] },
};

const project = (over: Partial<Project> = {}) =>
  ({
    id: "p1",
    info: INFO,
    phaseStatus: { ...DEFAULT_PHASE_STATUS },
    settings: { autoSave: false },
    hazards: null,
    assets: null,
    risks: null,
    attackTrees: null,
    ...over,
  }) as unknown as Project;

describe("commitPhaseStatus", () => {
  it("derives General and Attack Tree", () => {
    const p = commitPhaseStatus(
      project({
        attackTrees: { trees: [{ validation: { errors: [] } }] } as never,
        risks: { risks: [{ sourceStrideMethod: "attack-path", attackTreeAssessment: {} }] } as never,
      }),
    );
    expect(p.phaseStatus[0]).toBe("complete");
    expect(p.phaseStatus[5]).toBe("complete");
  });

  it("the same project when nothing changes", () => {
    const once = commitPhaseStatus(project());
    expect(commitPhaseStatus(once)).toBe(once);
  });

  it("runs on every edit (mergeProjectPatch)", () => {
    const merged = mergeProjectPatch(project(), { id: "p1", info: { ...INFO, version: "" } as never }, "now");
    expect(merged.phaseStatus[0]).toBe("in-progress");
  });
});

describe("commitLoadedPhaseStatus", () => {
  it("Risk from the validation the risk tab stored with its data", () => {
    const p = commitLoadedPhaseStatus(
      project({ risks: { risks: [{}], validation: { isComplete: true, errors: [], warnings: [] } } as never }),
    );
    expect(p.phaseStatus[6]).toBe("complete");
  });

  it("leaves a phase without data as it is", () => {
    const p = commitLoadedPhaseStatus(project({ phaseStatus: { ...DEFAULT_PHASE_STATUS, 3: "in-progress" } }));
    expect(p.phaseStatus[3]).toBe("in-progress");
    expect(p.phaseStatus[6]).toBe("not-started");
  });
});
