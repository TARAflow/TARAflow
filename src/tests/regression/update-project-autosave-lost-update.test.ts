// src/tests/regression/update-project-autosave-lost-update.test.ts
//
// With autosave on, updateProject merged the patch into the project as it
// was when the call started, waited for the disk write and then REPLACED
// the project in memory with that copy — every change that arrived while
// the write was running was lost (2026-11-14: a component import's DFD,
// committed by the DFD tab during the write of the import's components
// block, fell back to the state before the import; the file was right, the
// memory was not, and the DFD tab offered "Adopt pages" after a project
// switch). After the write only the saved flag may change, and only when
// nothing changed since. Mocks as in update-project-lost-update.test.ts.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { Project } from "app/models/project-types";

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

// The disk write waits until the test releases it — the window in which a
// second update arrives.
const writes = vi.hoisted(() => ({ pending: [] as (() => void)[] }));
vi.mock("app/hooks/use-project-persistence", () => {
  const saveExistingProject = () =>
    new Promise<{ success: boolean }>((resolve) => {
      writes.pending.push(() => resolve({ success: true }));
    });
  return { useProjectPersistence: () => ({ saveExistingProject }) };
});

vi.mock("app/hooks/use-auto-save", () => ({
  useAutoSave: vi.fn(),
}));

vi.mock("app/hooks/use-project-file-download", () => ({
  useProjectFileDownload: () => ({ downloadProject: vi.fn() }),
}));

vi.mock("features/dfd", () => ({
  // The one graph entry point (leveled DFD Phase 2c).
  buildDfdGraph: vi.fn(),
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

// ISO calculation stamps (conformance plan 0c) — passthrough like the other
// commit steps; covered by commit-calc-stamps.test.ts. The real module pulls
// in feature models that need the full "shared", which is mocked here.
vi.mock("app/utils/commit-calc-stamps", () => ({
  commitCalcStamps: vi.fn((_prev: unknown, next: unknown) => next),
}));

// ISO risk values 1–5 (conformance plan 3a) — passthrough, covered by
// commit-iso-risk-values.test.ts.
vi.mock("app/utils/commit-iso-risk-values", () => ({
  commitIsoRiskValues: vi.fn((_prev: unknown, next: unknown) => next),
}));


import { useProjectManager } from "app/hooks/use-project-manager";
import { projectService } from "app/services/project-service";

const project = (): Project =>
  ({
    id: "proj-1",
    info: { name: "Machine", lastModified: "2020-01-01T00:00:00.000Z" },
    settings: { autoSave: true, strictMode: false, autoSaveInterval: 2 },
    phaseStatus: {},
    currentPhase: 0,
    isOpen: true,
    hasUnsavedChanges: false,
    dfd: { xml: "before", pages: [{ pageId: "top" }] },
    assets: null,
    threats: null,
    risks: null,
    attackTrees: null,
    hazards: null,
    audit: null,
    documentation: null,
    integration: null,
  }) as unknown as Project;

async function loaded() {
  (projectService.getAllProjects as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, data: [project()] });
  const view = renderHook(() => useProjectManager());
  await waitFor(() => expect(view.result.current.projects).toHaveLength(1));
  return view;
}
type Hook = { current: ReturnType<typeof useProjectManager> };
const current = (r: Hook) => r.current.projects.find((p) => p.id === "proj-1") as unknown as Record<string, unknown>;

describe("updateProject with autosave: a change during the disk write survives", () => {
  beforeEach(() => {
    writes.pending = [];
  });

  it("the components block is written, the DFD commit arrives meanwhile — both stay in memory", async () => {
    const { result } = await loaded();
    let first!: Promise<void>;
    let second!: Promise<void>;
    // 1. the import's components block: its write waits
    act(() => {
      first = result.current.updateProject({ id: "proj-1", components: { imports: ["c"] } as never });
    });
    // 2. meanwhile the DFD tab commits the new DFD (with the component page)
    act(() => {
      second = result.current.updateProject({ id: "proj-1", dfd: { xml: "after", pages: [{ pageId: "top" }, { pageId: "component" }] } as never });
    });
    await waitFor(() => expect(writes.pending).toHaveLength(2));
    // the first write ends after the DFD commit
    await act(async () => {
      writes.pending[0]();
      await first;
    });
    expect((current(result).dfd as { xml: string }).xml).toBe("after");
    expect(current(result).components).toEqual({ imports: ["c"] });
    // still unsaved: what came after the first write is not on disk by it
    expect(current(result).hasUnsavedChanges).toBe(true);
    await act(async () => {
      writes.pending[1]();
      await second;
    });
    expect((current(result).dfd as { pages: unknown[] }).pages).toHaveLength(2);
    expect(current(result).hasUnsavedChanges).toBe(false);
  });

  it("Ctrl+S: a DFD commit during the write stays; the project stays unsaved", async () => {
    const { result } = await loaded();
    let saving!: Promise<void>;
    act(() => {
      saving = result.current.saveProject("proj-1");
    });
    await waitFor(() => expect(writes.pending).toHaveLength(1));
    // the DFD tab saves on the same Ctrl+S
    let dfd!: Promise<void>;
    act(() => {
      dfd = result.current.updateProject({ id: "proj-1", dfd: { xml: "after", pages: [{ pageId: "top" }, { pageId: "component" }] } as never });
    });
    await waitFor(() => expect(writes.pending).toHaveLength(2));
    await act(async () => {
      writes.pending[0]();
      await saving;
    });
    expect((current(result).dfd as { xml: string }).xml).toBe("after");
    expect(current(result).hasUnsavedChanges).toBe(true);
    await act(async () => {
      writes.pending[1]();
      await dfd;
    });
    expect(current(result).hasUnsavedChanges).toBe(false);
  });
});
