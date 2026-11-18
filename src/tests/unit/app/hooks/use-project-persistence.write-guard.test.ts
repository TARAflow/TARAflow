// src/tests/unit/app/hooks/use-project-persistence.write-guard.test.ts
//
// Manual test 2026-11-17 (REPO_DIRTY after opening / after an Audit
// commit): the Electron save leaves the file alone when the new content
// differs only in timestamps, and writes it otherwise.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useProjectPersistence } from "app/hooks/use-project-persistence";
import { serialiseProject } from "app/services/prepare-for-disk";
import type { Project } from "app/models/project-types";
import { loadProjectFixture } from "../../../fixtures/load-fixture";
import { parseAndRepair } from "app/services/migration-service";

const base = parseAndRepair(loadProjectFixture("SmokeDetector.tara.json")) as Project;
const project = (patch: Partial<Project> = {}): Project =>
  ({ ...base, ...patch, filePath: "/p/x.tara.json" }) as Project;

let onDisk: string | null;
const writeProject = vi.fn(async (_path: string, text: string) => {
  onDisk = text;
  return { success: true, data: _path };
});

beforeEach(() => {
  writeProject.mockClear();
  (window as any).electron = {
    file: {
      writeProject,
      readProject: vi.fn(async () => (onDisk === null ? { success: false, error: "ENOENT" } : { success: true, data: onDisk })),
    },
  };
});
afterEach(() => {
  delete (window as any).electron;
});

describe("saveExistingProject — write guard", () => {
  it("only timestamps changed: no write, still a success", async () => {
    onDisk = serialiseProject(project());
    const { result } = renderHook(() => useProjectPersistence());
    const later = project({ info: { ...base.info, lastModified: "2030-01-01T00:00:00.000Z" } });
    const r = await result.current.saveExistingProject(later);
    expect(r.success).toBe(true);
    expect(writeProject).not.toHaveBeenCalled();
  });

  it("a real change: written", async () => {
    onDisk = serialiseProject(project());
    const { result } = renderHook(() => useProjectPersistence());
    const renamed = project({ info: { ...base.info, name: "Renamed" } });
    await result.current.saveExistingProject(renamed);
    expect(writeProject).toHaveBeenCalledTimes(1);
    expect(onDisk).toContain('"name": "Renamed"');
  });

  it("no file yet: written", async () => {
    onDisk = null;
    const { result } = renderHook(() => useProjectPersistence());
    await result.current.saveExistingProject(project());
    expect(writeProject).toHaveBeenCalledTimes(1);
  });
});
