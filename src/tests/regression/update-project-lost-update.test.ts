// src/tests/regression/update-project-lost-update.test.ts
//
// Regression coverage for the lost-update race fixed in updateProject
// (use-project-manager.ts): previously it took a FULL Project object that
// each caller built from its own `activeProjectRef.current` snapshot, then
// replaced the project entry wholesale. Two callers firing close together
// (e.g. AssetsTab's 1s debounced save, and useBidirectionalAssetSync
// reacting to that very save) could each build their replacement from a
// snapshot that hadn't seen the other's change yet — whichever replacement
// landed last in setProjects won COMPLETELY, silently discarding the other
// caller's edit. This is exactly what made a freshly typed asset
// description ("ddddd") disappear in production.
//
// Fix: updateProject now takes a PARTIAL patch and merges it against the
// freshest state inside setProjects' functional updater. These tests
// exercise that merge directly, with all I/O dependencies mocked out so we
// isolate the actual race condition rather than testing persistence.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { Project } from "app/models/project-types";

// ==================== MOCKS ====================
// Only the exports use-project-manager.ts actually imports from each module.
// vi.mock paths use the "app/" alias (vitest.config.ts) so they resolve to
// the same absolute files regardless of relative imports inside the SUT.

vi.mock("app/services/project-service", () => ({
  projectService: {
    getAllProjects: vi.fn(),
  },
}));

vi.mock("app/services/project-repository", () => ({
  projectRepository: {
    loadAll: vi.fn(),
    loadById: vi.fn(),
    save: vi.fn(),
    loadFromPath: vi.fn(),
    createEmpty: vi.fn(),
    unregister: vi.fn(),
  },
}));

vi.mock("app/services/project-registry", () => ({
  projectRegistry: {
    migrateFromLegacyKey: vi.fn().mockResolvedValue(undefined),
    getAll: vi.fn().mockResolvedValue([]),
    upsert: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("app/services/storage-service", () => ({
  default: {
    getAllProjects: vi.fn(),
    getProject: vi.fn(),
    saveProject: vi.fn(),
    deleteProject: vi.fn(),
  },
}));

vi.mock("app/hooks/use-project-persistence", () => ({
  useProjectPersistence: () => ({
    saveExistingProject: vi.fn().mockResolvedValue({ success: true }),
  }),
}));

vi.mock("app/hooks/use-auto-save", () => ({
  useAutoSave: vi.fn(),
}));

vi.mock("app/hooks/use-project-file-download", () => ({
  useProjectFileDownload: () => ({ downloadProject: vi.fn() }),
}));

vi.mock("features/dfd", () => ({
  DefaultDFDGraphBuilder: vi.fn().mockImplementation(() => ({
    build: vi.fn(),
  })),
}));

vi.mock("shared", () => ({
  useToast: () => ({
    error: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
  }),
}));

// commitAssetSync/commitHazardSafety are passthroughs here — their own
// correctness is covered by asset-sync-service.safety.test.ts and
// commit-hazard-safety.test.ts. Here we only need to observe HOW/WHEN
// use-project-manager calls them, not re-verify their internal logic.
vi.mock("app/utils/commit-asset-sync", () => ({
  commitAssetSync: vi.fn((_prev: unknown, next: unknown) => next),
}));

vi.mock("app/utils/build-asset-hazard-links", () => ({
  buildAssetHazardLinks: vi.fn(() => ({})),
}));

vi.mock("app/utils/commit-hazard-safety", () => ({
  // Must return the SAME assets reference to keep commitProjectSafety's
  // reference-guard a true no-op — returning a new object here would make
  // every updateProject call look like it changed assets.
  commitHazardSafety: vi.fn((assets: unknown) => assets),
}));

// ==================== IMPORTS (after mocks) ====================

import { useProjectManager } from "app/hooks/use-project-manager";
import { projectService } from "app/services/project-service";
import { commitAssetSync } from "app/utils/commit-asset-sync";

// ==================== FIXTURE ====================

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "proj-1",
    info: {
      name: "Test Project",
      lastModified: "2020-01-01T00:00:00.000Z",
      ...(overrides as any).info,
    },
    settings: { autoSave: false, strictMode: false, autoSaveInterval: 2 },
    phaseStatus: {},
    currentPhase: 0,
    isOpen: true,
    hasUnsavedChanges: false,
    dfd: null,
    assets: null,
    threats: null,
    risks: null,
    attackTrees: null,
    hazards: null,
    audit: null,
    documentation: null,
    integration: null,
    ...overrides,
  } as unknown as Project;
}

async function renderLoaded(initial: Project) {
  (projectService.getAllProjects as any).mockResolvedValue({
    success: true,
    data: [initial],
  });
  const view = renderHook(() => useProjectManager());
  await waitFor(() => expect(view.result.current.isLoading).toBe(false));
  await waitFor(() =>
    expect(view.result.current.projects).toHaveLength(1),
  );
  return view;
}

// ==================== TESTS ====================

describe("useProjectManager — updateProject lost-update race", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("merges a partial patch without touching fields the patch didn't include", async () => {
    const { result } = await renderLoaded(
      makeProject({ threats: { existing: true } as any }),
    );

    await act(async () => {
      await result.current.updateProject({
        id: "proj-1",
        assets: { changed: true } as any,
      });
    });

    const updated = result.current.projects.find((p) => p.id === "proj-1");
    expect((updated as any).assets).toEqual({ changed: true });
    expect((updated as any).threats).toEqual({ existing: true }); // preserved
  });

  it("THE FIX: two concurrent patches to DIFFERENT fields both survive", async () => {
    const { result } = await renderLoaded(makeProject());

    // Simulates AssetsTab's debounced save (assets) and
    // useBidirectionalAssetSync (dfd) firing back-to-back, neither waiting
    // for a re-render that would show it the other's change first.
    await act(async () => {
      await Promise.all([
        result.current.updateProject({
          id: "proj-1",
          assets: { description: "ddddd" } as any,
        }),
        result.current.updateProject({
          id: "proj-1",
          dfd: { assets: [] } as any,
        }),
      ]);
    });

    const updated = result.current.projects.find((p) => p.id === "proj-1");
    expect((updated as any).assets).toEqual({ description: "ddddd" });
    expect((updated as any).dfd).toEqual({ assets: [] });
  });

  it("three concurrent patches to three different fields all survive", async () => {
    // Same fix, higher fan-out — guards against a solution that only
    // happens to work for exactly two concurrent callers.
    const { result } = await renderLoaded(makeProject());

    await act(async () => {
      await Promise.all([
        result.current.updateProject({ id: "proj-1", assets: { a: 1 } as any }),
        result.current.updateProject({ id: "proj-1", threats: { b: 2 } as any }),
        result.current.updateProject({ id: "proj-1", risks: { c: 3 } as any }),
      ]);
    });

    const updated = result.current.projects.find((p) => p.id === "proj-1");
    expect((updated as any).assets).toEqual({ a: 1 });
    expect((updated as any).threats).toEqual({ b: 2 });
    expect((updated as any).risks).toEqual({ c: 3 });
  });

  it("commitAssetSync's 'previous' argument reflects the freshest state, not a stale snapshot", async () => {
    const { result } = await renderLoaded(makeProject());

    await act(async () => {
      await result.current.updateProject({
        id: "proj-1",
        threats: { a: 1 } as any,
      });
    });
    await act(async () => {
      await result.current.updateProject({
        id: "proj-1",
        risks: { b: 2 } as any,
      });
    });

    // The second call's "previous" (commitAssetSync's first argument) must
    // already contain the first call's change — proving the merge base
    // was fresh state, not a ref captured before the first update landed.
    const calls = (commitAssetSync as any).mock.calls;
    const secondCallPrevious = calls[calls.length - 1][0];
    expect(secondCallPrevious.threats).toEqual({ a: 1 });
  });

  it("always refreshes info.lastModified and sets hasUnsavedChanges: true, regardless of the patch", async () => {
    const { result } = await renderLoaded(
      makeProject({
        info: { name: "X", lastModified: "2020-01-01T00:00:00.000Z" } as any,
      }),
    );

    await act(async () => {
      // Patch explicitly tries to set hasUnsavedChanges: false — must be
      // overridden, matching pre-refactor behaviour exactly.
      await result.current.updateProject({
        id: "proj-1",
        hasUnsavedChanges: false,
      });
    });

    const updated = result.current.projects.find((p) => p.id === "proj-1");
    expect(updated?.hasUnsavedChanges).toBe(true);
    expect(updated?.info.lastModified).not.toBe("2020-01-01T00:00:00.000Z");
  });

  it("auto-save triggers off the MERGED project's settings, not the raw patch", async () => {
    // Typical callers never include `settings` in their patch — auto-save
    // must still fire correctly because it reads the merged result.
    const { result } = await renderLoaded(
      makeProject({
        settings: { autoSave: true, strictMode: false, autoSaveInterval: 2 },
      }),
    );

    await act(async () => {
      await result.current.updateProject({
        id: "proj-1",
        assets: { x: 1 } as any,
      });
    });

    await waitFor(() => {
      const updated = result.current.projects.find((p) => p.id === "proj-1");
      expect(updated?.hasUnsavedChanges).toBe(false);
    });
  });

  it("a patch for a non-existent project id is a safe no-op", async () => {
    const { result } = await renderLoaded(makeProject());

    await act(async () => {
      await result.current.updateProject({
        id: "does-not-exist",
        assets: {} as any,
      });
    });

    expect(result.current.projects).toHaveLength(1);
    expect(result.current.projects[0].id).toBe("proj-1");
    expect(result.current.projects[0]).toEqual(
      expect.objectContaining({ id: "proj-1" }),
    );
  });
});
