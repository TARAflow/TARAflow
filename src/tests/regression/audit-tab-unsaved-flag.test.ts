// src/tests/regression/audit-tab-unsaved-flag.test.ts
//
// Manual test 2026-11-17: on the Audit tab the sidebar showed the project
// as unsaved (yellow dots), and the dots stayed after the 15 s autosave.
//  1. Opening the tab reported "not dirty", which became
//     updateProject({ hasUnsavedChanges: false }) — and every patch marks the
//     project changed (mergeProjectPatch sets the flag, a new revision).
//  2. The interval autosave wrote the file but never cleared the flag.

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePinnedTabHandlers } from "app/hooks/workspace/use-pinned-tab-handlers";
import { useAutoSave } from "app/hooks/use-auto-save";
import type { Project } from "app/models/project-types";

afterEach(() => vi.useRealTimers());

const project = { id: "p1", hasUnsavedChanges: true, revision: 7, info: { name: "M" } } as unknown as Project;

describe("Audit tab: 'not dirty' is no update", () => {
  const handlers = () => {
    const updateProject = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      usePinnedTabHandlers({
        projectId: "p1",
        activeProjectRef: { current: project },
        projectsRef: { current: [project] },
        updateProject,
        toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } as never,
        t: ((k: string) => k) as never,
      }),
    );
    return { audit: result.current.auditHandlers, updateProject };
  };

  it("onDirtyChange(false) does not touch the project", () => {
    const { audit, updateProject } = handlers();
    audit.onDirtyChange(false);
    expect(updateProject).not.toHaveBeenCalled();
  });

  it("onDirtyChange(true) still marks it unsaved", () => {
    const { audit, updateProject } = handlers();
    audit.onDirtyChange(true);
    expect(updateProject).toHaveBeenCalledWith({ id: "p1", hasUnsavedChanges: true });
  });
});

describe("interval autosave: the written revision goes back to the caller", () => {
  it("onSuccess gets the project id and the revision that was written", async () => {
    vi.useFakeTimers();
    const onSuccess = vi.fn();
    const persistence = { saveExistingProject: vi.fn().mockResolvedValue({ success: true }) };
    renderHook(() => useAutoSave(project, { enabled: true, interval: 15, onSuccess }, persistence));
    await vi.advanceTimersByTimeAsync(15_000);
    expect(persistence.saveExistingProject).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith("p1", 7);
  });
});
