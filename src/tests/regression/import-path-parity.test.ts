// src/tests/regression/import-path-parity.test.ts
//
// Characterization coverage for Save-Path Consolidation Step 1, item #9
// (project-shell.tsx's ImportProjectDialog.onImport vs use-project-manager's
// handleImportFile).
//
// FINDING, confirmed against real code (not assumed): these are two
// independent import pipelines that both exist today and produce
// DIFFERENT results for structurally identical input.
//
//   project-shell.tsx (ImportProjectDialog.onImport):
//     projectService.importProjectAsCopy(file)
//       → parseImportFile → parseAndRepair(raw)
//       → { ...result.data, id, filePath, info, lastOpened, isOpen,
//           hasUnsavedChanges }
//     — never calls ensureProjectGraph / commitAssetSync / commitProjectSafety.
//
//   use-project-manager.ts (handleImportFile):
//     commitProjectSafety(commitAssetSync(undefined, ensureProjectGraph({
//       ...rawProject, isOpen: true, lastOpened, hasUnsavedChanges,
//     })))
//     — applies all three.
//
// This is NOT a hypothesis to verify; it's a fact about which functions
// project-service.ts imports (it imports neither DefaultDFDGraphBuilder,
// commitAssetSync, nor commitHazardSafety — grep confirms). The two tests
// below pin the CURRENT, DIVERGENT behavior of each path in isolation, so
// that whichever path Step 2 decides to route project-shell's dialog
// through, we have a documented "before" to diff against — and so that if
// the intended fix is "make ImportProjectDialog call handleImportFile
// instead of projectService.importProjectAsCopy directly", the reviewer can
// see exactly what changes for the user (DFD graph now built, asset/hazard
// sync now applied) rather than discovering it in production.
//
// These tests are NOT "THE BUG" / "THE FIX" style — neither behavior is
// wrong per se (importProjectAsCopy's job was arguably always meant to be
// "read + rename", with the manager's pipeline applied downstream). The
// divergence itself is the finding. Do not "fix" one side to match the
// other without first confirming with the person which side is authoritative.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { Project } from "app/models/project-types";

// ==================== SHARED MOCKS ====================
// Same minimal-surface mocking style as update-project-lost-update.test.ts —
// only the exports each SUT actually imports.

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

vi.mock("shared", () => ({
  useToast: () => ({ error: vi.fn(), warning: vi.fn(), success: vi.fn() }),
  formatExportFilename: vi.fn((name: string) => `${name}.tara.json`),
  migrateProjectTags: vi.fn((tags: unknown) => tags),
}));

// ---- deps only used by the use-project-manager (handleImportFile) side ----
//
// IMPORTANT: we deliberately do NOT vi.mock("app/services/project-service")
// here. use-project-manager imports the real projectService (for
// getAllProjects on mount), and the second half of this file imports the
// SAME real projectService to test importProjectAsCopy directly. vi.mock
// replaces a module path for every importer in the file — mocking it would
// have made both tests see the same fake object, which is exactly the
// failure this comment is here to prevent from being reintroduced. Instead
// we let the real project-service.ts run and mock only ITS dependency
// (storage-service, since isElectron() is false in this test environment)
// to control what getAllProjects returns on mount.

vi.mock("app/hooks/use-project-persistence", () => ({
  useProjectPersistence: () => ({
    saveExistingProject: vi.fn().mockResolvedValue({ success: true }),
  }),
}));

vi.mock("app/hooks/use-auto-save", () => ({ useAutoSave: vi.fn() }));

vi.mock("app/hooks/use-project-file-download", () => ({
  useProjectFileDownload: () => ({ downloadProject: vi.fn() }),
}));

// Return a NON-undefined, recognizable graph so we can assert it landed
// (or didn't) on the resulting project.
const FAKE_GRAPH = { builtBy: "DefaultDFDGraphBuilder", nodes: [], edges: [] };
const buildSpy = vi.fn().mockReturnValue(FAKE_GRAPH);
vi.mock("features/dfd", () => ({
  DefaultDFDGraphBuilder: vi.fn().mockImplementation(() => ({
    build: buildSpy,
  })),
}));

vi.mock("app/utils/commit-asset-sync", () => ({
  commitAssetSync: vi.fn((_prev: unknown, next: unknown) => next),
}));

vi.mock("app/utils/build-asset-hazard-links", () => ({
  buildAssetHazardLinks: vi.fn(() => ({})),
}));

vi.mock("app/utils/commit-hazard-safety", () => ({
  commitHazardSafety: vi.fn((assets: unknown) => assets),
}));

// ---- deps only used by the project-service (importProjectAsCopy) side ----

vi.mock("app/services/migration-service", () => ({
  parseAndRepair: vi.fn(),
}));

vi.mock("app/services/prepare-for-disk", () => ({
  serialiseProject: vi.fn(),
}));

// ==================== IMPORTS (after mocks) ====================

import { useProjectManager } from "app/hooks/use-project-manager";
import { commitAssetSync } from "app/utils/commit-asset-sync";
import { commitHazardSafety } from "app/utils/commit-hazard-safety";
import { DefaultDFDGraphBuilder } from "features/dfd";

// project-service.ts is the REAL module under test here — only ITS
// dependencies (storage-service, project-repository, project-registry,
// migration-service, prepare-for-disk, shared) are mocked above. Both
// tests below import this SAME real singleton — see the comment on the
// project-service mock block for why it must not also be vi.mock'd.
import { projectService } from "app/services/project-service";
import storageService from "app/services/storage-service";
import { parseAndRepair } from "app/services/migration-service";

// ==================== FIXTURE ====================
// Structurally identical raw project fed into BOTH pipelines: has DFD
// elements but no graph, and assets, so both ensureProjectGraph and
// commitAssetSync would have visible work to do IF they were called.

function makeRawProject(): Project {
  return {
    id: "proj-import-1",
    info: {
      name: "Imported Project",
      lastModified: "2020-01-01T00:00:00.000Z",
    },
    dfd: {
      elements: [{ id: "P-1", type: "Process" }],
      connections: [],
      assets: [],
      // no `graph` key — this is what ensureProjectGraph checks for
    },
    assets: { configuration: {}, assets: [{ id: "A-1" }], lastModified: "x" },
    hazards: { list: [] },
    threats: null,
    risks: null,
    attackTrees: null,
    audit: null,
    documentation: null,
    integration: null,
    phaseStatus: {},
    currentPhase: 0,
    settings: { autoSave: false, strictMode: false, autoSaveInterval: 2 },
    isOpen: false,
    hasUnsavedChanges: false,
  } as unknown as Project;
}

describe("Import path parity — use-project-manager.handleImportFile vs project-service.importProjectAsCopy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("CURRENT BEHAVIOR (manager path): handleImportFile builds the DFD graph, syncs assets, and applies hazard safety", async () => {
    // use-project-manager's loadProjects() calls the REAL
    // projectService.getAllProjects(), which (isElectron() === false in
    // this test env) delegates to storageService.getAllProjects() — that's
    // the layer we control here.
    (storageService.getAllProjects as any).mockResolvedValue({
      success: true,
      data: [],
    });

    const { result } = renderHook(() => useProjectManager());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const raw = makeRawProject();

    await act(async () => {
      await result.current.handleImportFile(raw);
    });

    await waitFor(() =>
      expect(result.current.projects).toHaveLength(1),
    );

    // 1. Graph builder was invoked with the dfd that has elements but no graph.
    expect(DefaultDFDGraphBuilder).toHaveBeenCalled();
    expect(buildSpy).toHaveBeenCalledWith(
      expect.objectContaining({ elements: raw.dfd!.elements }),
    );

    // 2. commitAssetSync was invoked (asset/DFD sync pass).
    expect(commitAssetSync).toHaveBeenCalled();

    // 3. commitHazardSafety was invoked (safety override chokepoint).
    expect(commitHazardSafety).toHaveBeenCalled();

    // 4. The graph actually landed on the committed project.
    const imported = result.current.projects.find(
      (p) => p.id === "proj-import-1",
    );
    expect((imported as any).dfd.graph).toEqual(FAKE_GRAPH);
    expect(imported?.isOpen).toBe(true);
    expect(imported?.lastOpened).toBeTruthy();
  });

  it("CURRENT BEHAVIOR (dialog path): importProjectAsCopy does NOT build the DFD graph, sync assets, or apply hazard safety", async () => {
    const raw = makeRawProject();
    (parseAndRepair as any).mockReturnValue(raw);

    const fakeFile = { text: vi.fn().mockResolvedValue("{}") } as unknown as File;

    const result = await projectService.importProjectAsCopy(fakeFile);

    expect(result.success).toBe(true);
    if (!result.success || !result.data) throw new Error("expected success");

    // Sanity: the rename/re-id transform that IS part of this path still ran.
    expect(result.data.id).not.toBe("proj-import-1");
    expect(result.data.info.name).toBe("Imported Project (Imported)");
    expect(result.data.isOpen).toBe(true);

    // THE GAP: none of the three pipeline steps ran. dfd.graph is still
    // absent even though dfd.elements is non-empty — exactly the condition
    // that would trigger graph construction on the manager path above.
    expect((result.data as any).dfd.graph).toBeUndefined();

    // Asset data is passed through completely untouched (same reference
    // shape as the raw fixture) — commitAssetSync never ran on this path.
    expect((result.data as any).assets).toEqual(raw.assets);

    // These two mocks are shared with the manager-path test above but are
    // NOT imported by project-service.ts at all — asserting zero calls
    // here documents that fact at the test level, not just via code reading.
    expect(commitAssetSync).not.toHaveBeenCalled();
    expect(commitHazardSafety).not.toHaveBeenCalled();
    expect(DefaultDFDGraphBuilder).not.toHaveBeenCalled();
  });
});