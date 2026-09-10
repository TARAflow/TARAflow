// src/tests/unit/app/services/general-tab-update.test.ts
//
// Regression guard for the seam that silently dropped project-level source
// bindings: the read side (generalTabData) omitted `sourceBindings` and the
// write side (handleGeneralTabUpdate) omitted it too, so pressing Save was a
// no-op for the whole feature — yet every leaf test (component/hook/utils/
// service) stayed green because the break lived ABOVE them, in the wiring into
// the project patch. buildGeneralTabPatch is that wiring, extracted so it can
// be pinned here. If someone drops `sourceBindings` from the patch again, this
// fails instead of the feature silently dying.

import { describe, it, expect } from "vitest";
import { buildGeneralTabPatch } from "app/services/general-tab-update";
import type { Project } from "app/models/project-types";
import type { GeneralTabData } from "features/overview";
import type { SourceBinding } from "shared";
import { EMPTY_PROJECT_TAGS } from "shared";

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "proj_1",
    schemaVersion: 3,
    info: {
      name: "Test Project",
      description: "",
      version: "1.0",
      responsible: "JPM",
      created: "2026-05-22T11:53:20.822Z",
      lastModified: "2026-07-23T15:24:14.999Z",
      tags: { ...EMPTY_PROJECT_TAGS },
      team: [],
      isHighImpact: false,
    },
    currentPhase: 0,
    strideMethod: null,
    methodSelected: false,
    phaseStatus: {},
    settings: {},
    status: "draft",
    hazards: null,
    dfd: null,
    assets: null,
    threats: null,
    risks: null,
    attackTrees: null,
    documentation: null,
    audit: null,
    integration: null,
    ...overrides,
  } as unknown as Project;
}

function makeGeneralTabData(
  overrides: Partial<GeneralTabData> = {},
): GeneralTabData {
  return {
    info: {
      name: "Test Project",
      description: "",
      version: "1.0",
      responsible: "JPM",
      created: "2026-05-22T11:53:20.822Z",
      lastModified: "2026-07-23T15:24:14.999Z",
      tags: { ...EMPTY_PROJECT_TAGS },
      team: [],
      isHighImpact: false,
    },
    settings: {},
    phaseStatus: {},
    ...overrides,
  } as unknown as GeneralTabData;
}

const bindings: SourceBinding[] = [
  {
    id: "b-1",
    repoUrl: "https://github.com/org/repo.git",
    refType: "tag",
    refLabel: "v2.3.1",
    driftEvents: [],
  },
];

describe("buildGeneralTabPatch — source-binding wiring", () => {
  it("carries project-level sourceBindings from the tab data into the patch", () => {
    const patch = buildGeneralTabPatch(
      makeProject(),
      makeGeneralTabData({ sourceBindings: bindings }),
    );
    expect(patch.sourceBindings).toEqual(bindings);
  });

  it("takes the sourceBindings from the incoming edit, not the stale project", () => {
    // current already has one binding; the tab edit replaces the set. The
    // patch must reflect the EDIT, not what the project happened to hold.
    const current = makeProject({
      sourceBindings: [
        {
          id: "old",
          repoUrl: "https://github.com/org/old.git",
          refType: "branch",
          refLabel: "main",
          driftEvents: [],
        },
      ],
    });
    const patch = buildGeneralTabPatch(
      current,
      makeGeneralTabData({ sourceBindings: bindings }),
    );
    expect(patch.sourceBindings).toEqual(bindings);
    // and the source project is not mutated in the process
    expect(current.sourceBindings?.[0]?.id).toBe("old");
  });

  it("passes undefined sourceBindings through as undefined (blackbox project — the normal case)", () => {
    const patch = buildGeneralTabPatch(
      makeProject(),
      makeGeneralTabData({ sourceBindings: undefined }),
    );
    expect(patch.sourceBindings).toBeUndefined();
  });

  it("still carries the ordinary general-tab fields (id/info/settings/phaseStatus)", () => {
    // Guards against the extraction accidentally narrowing the patch.
    const patch = buildGeneralTabPatch(
      makeProject(),
      makeGeneralTabData({ sourceBindings: bindings }),
    );
    expect(patch.id).toBe("proj_1");
    expect(patch).toHaveProperty("info");
    expect(patch).toHaveProperty("settings");
    expect(patch).toHaveProperty("phaseStatus");
  });
});
