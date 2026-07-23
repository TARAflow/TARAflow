// src/tests/unit/app/services/prepare-for-disk.test.ts
//
// What a .tara.json may contain. The rule exists because it was broken: the
// stripping logic was private to project-repository, so the five other writers
// (useProjectPersistence's three modes, useProjectFileDownload,
// projectService.exportProject, storageService.exportProjectAsJSON) serialised
// the raw Project and shipped `filePath` — the author's absolute path — into
// every file they produced, including committed test fixtures.
//
// These tests pin the contract itself. The companion guard is the grep in
// no-raw-project-serialisation.test.ts: this file says WHAT is correct, that
// one says every writer actually goes through it.

import { describe, it, expect } from "vitest";
import {
  prepareForDisk,
  serialiseProject,
} from "app/services/prepare-for-disk";
import type { Project } from "app/models/project-types";

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "proj_1",
    schemaVersion: 3,
    info: {
      name: "Simple Test Project",
      description: "",
      version: "1.0",
      responsible: "JPM",
      created: "2026-05-22T11:53:20.822Z",
      lastModified: "2026-07-23T15:24:14.999Z",
      tags: {},
      team: [],
      isHighImpact: false,
    },
    lastOpened: "2026-07-23T11:42:34.690Z",
    currentPhase: 5,
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
    isOpen: true,
    hasUnsavedChanges: true,
    filePath: "/home/someone/Projects/TARAflow/secret/path.tara.json",
    ...overrides,
  } as unknown as Project;
}

describe("prepareForDisk — runtime-only fields never reach disk", () => {
  it("drops filePath", () => {
    // THE leak: an absolute path on the author's machine, in every file
    // handed to a customer or committed as a fixture.
    expect(prepareForDisk(makeProject())).not.toHaveProperty("filePath");
  });

  it("drops hasUnsavedChanges", () => {
    expect(prepareForDisk(makeProject())).not.toHaveProperty(
      "hasUnsavedChanges",
    );
  });

  it("leaves the in-memory project untouched", () => {
    // filePath is still needed for the NEXT save — stripping must not mutate.
    const project = makeProject();
    prepareForDisk(project);
    expect(project.filePath).toBe(
      "/home/someone/Projects/TARAflow/secret/path.tara.json",
    );
    expect(project.hasUnsavedChanges).toBe(true);
  });

  it("keeps everything else", () => {
    const result = prepareForDisk(makeProject()) as Record<string, unknown>;
    for (const key of [
      "id",
      "schemaVersion",
      "info",
      "currentPhase",
      "phaseStatus",
      "settings",
      "status",
      "attackTrees",
      "risks",
      "isOpen",
    ]) {
      expect(result, `${key} must survive`).toHaveProperty(key);
    }
  });
});

describe("prepareForDisk — derived DFD data", () => {
  it("clears the computed graph but keeps the rest of the dfd", () => {
    const project = makeProject({
      dfd: {
        xml: "<mxfile/>",
        elements: [{ id: "P-1" }],
        graph: { huge: "recomputed on load" },
      },
    } as unknown as Partial<Project>);

    const result = prepareForDisk(project) as unknown as {
      dfd: Record<string, unknown>;
    };
    expect(result.dfd.graph).toBeUndefined();
    expect(result.dfd.xml).toBe("<mxfile/>");
    expect(result.dfd.elements).toEqual([{ id: "P-1" }]);
  });

  it("normalises a missing dfd to null", () => {
    const result = prepareForDisk(makeProject({ dfd: undefined } as never));
    expect(result.dfd).toBeNull();
  });
});

describe("serialiseProject", () => {
  it("produces JSON that carries no runtime-only field", () => {
    const parsed = JSON.parse(serialiseProject(makeProject()));
    expect(parsed).not.toHaveProperty("filePath");
    expect(parsed).not.toHaveProperty("hasUnsavedChanges");
  });

  it("contains no absolute home path anywhere in the output", () => {
    // Broader than the key check: catches a path that reappears under some
    // other key later (the pre-commit hook scans the whole file, not one key).
    const json = serialiseProject(makeProject());
    expect(json).not.toMatch(/\/home\/[^"]+/);
  });

  it("stays human-readable (2-space indent) for reviewable diffs", () => {
    expect(serialiseProject(makeProject())).toContain('\n  "id": "proj_1"');
  });
});
