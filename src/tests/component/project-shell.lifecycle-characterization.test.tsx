// src/tests/component/project-shell.lifecycle-characterization.test.tsx
//
// Characterization coverage for Save-Path Consolidation Step 1, items #3/#5/#7
// from the cartography table: the three project-shell.tsx lifecycle ops whose
// direct setProjects/setActiveProjectId calls include an activeProjectId
// REASSIGNMENT decision (which project becomes active next). These are the
// riskiest to route through new manager methods because the reassignment
// logic reads from a state snapshot captured in the callback closure
// (`projects` / `openProjects` as of render time), not from projectsRef —
// a future manager method must reproduce that exact selection, not merely
// "some plausible" fallback.
//
// Scope: this file intentionally uses the REAL useProjectManager (only ITS
// transitive dependencies are mocked, same pattern as
// update-project-lost-update.test.ts / import-path-parity.test.ts) composed
// through a REAL ProjectShell render. Only leaf UI (ProjectSidebar, the six
// dialogs, WorkspaceLayout, EmptyState) is replaced with minimal stand-ins
// that expose their callback props as buttons — mirroring how
// attacktree-editor.validation-render.test.tsx stubs CodeMirror to a
// textarea: semantically faithful, not reimplemented.
//
// ASSUMPTION FLAGGED FOR REVIEW: the vi.mock paths below for the child
// components are inferred from project-shell.tsx's relative imports
// (`../project-sidebar` → app/components/project-sidebar, `../dialogs/*` →
// app/components/dialogs/*, `./workspace-layout` / `./empty-state-layout` →
// app/components/layout/*) and from the existing alias convention seen in
// update-project-lost-update.test.ts. I could not confirm these against the
// real file tree. If a mock silently fails to intercept, Vitest will try to
// render the REAL (heavy) component instead and this will surface as a
// resolve/render error, not a wrong assertion — please run once and report
// the exact error if that happens, rather than any of these being "close
// enough".

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  act,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import type { Project } from "app/models/project-types";

// ==================== HOISTED SHARED MOCK STATE ====================
// vi.mock factories are hoisted above top-level const/let, so any object a
// factory needs to share with the test body must go through vi.hoisted.

const h = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
  persistence: {
    mode: "file-system-access" as const,
    hasFileReference: true,
    saveNewProject: vi.fn(),
    saveExistingProject: vi.fn(),
    clearCurrentFile: vi.fn(),
  },
}));

// ==================== react-i18next ====================

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
}));

// ==================== shared (Toast/ToastContainer/useToast) ====================

vi.mock("shared", () => ({
  useToast: () => h.toast,
  Toast: () => null,
  ToastContainer: () => null,
}));

// ==================== use-project-manager's OWN dependencies ====================
// (the hook itself is REAL — see module comment above)

vi.mock("app/services/project-service", () => ({
  projectService: {
    getAllProjects: vi.fn(),
    createProject: vi.fn(),
    deleteProject: vi.fn(),
    importProjectAsCopy: vi.fn(),
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
    exportProjectAsJSON: vi.fn(),
  },
}));

vi.mock("app/hooks/use-project-persistence", () => ({
  useProjectPersistence: () => h.persistence,
}));

vi.mock("app/hooks/use-auto-save", () => ({ useAutoSave: vi.fn() }));

vi.mock("app/hooks/use-project-file-download", () => ({
  useProjectFileDownload: () => ({ downloadProject: vi.fn() }),
}));

vi.mock("features/dfd", () => ({
  DefaultDFDGraphBuilder: vi.fn().mockImplementation(() => ({
    build: vi.fn(),
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

// ==================== Leaf UI stand-ins ====================

vi.mock("app/components/project-sidebar", () => ({
  ProjectSidebar: (props: any) => (
    <div data-testid="sidebar">
      {props.projects.map((p: Project) => (
        <div
          key={p.id}
          data-testid={`row-${p.id}`}
          data-open={String(p.isOpen)}
        >
          <button onClick={() => props.onProjectSelect(p.id)}>
            select-{p.id}
          </button>
          <button onClick={() => props.onProjectClose(p.id)}>
            close-{p.id}
          </button>
          <button onClick={() => props.onProjectOpen(p.id)}>open-{p.id}</button>
          <button onClick={() => props.onProjectDelete(p.id)}>
            delete-{p.id}
          </button>
        </div>
      ))}
      <button onClick={props.onOpenDialog}>open-dialog</button>
      <button onClick={props.onNewProject}>new-project-dialog</button>
      <button onClick={props.onImportProject}>import-dialog</button>
      <div data-testid="active-id">{props.activeProjectId ?? "null"}</div>
      <div data-testid="active-phase">{props.isCollapsed ? "" : ""}</div>
    </div>
  ),
}));

vi.mock("app/components/layout/workspace-layout", () => ({
  WorkspaceLayout: () => <div data-testid="workspace" />,
}));

vi.mock("app/components/layout/empty-state-layout", () => ({
  EmptyState: () => <div data-testid="empty-state" />,
}));

vi.mock("app/components/dialogs/new-project-dialog", () => ({
  NewProjectDialog: (props: any) => (
    <div data-testid="new-project-dialog">
      <button
        onClick={() =>
          props.onCreate({
            name: "Brand New",
            description: "desc",
            version: "1.0",
            responsible: "me",
            isHighImpact: false,
            tags: [],
          })
        }
      >
        confirm-create
      </button>
    </div>
  ),
}));

vi.mock("app/components/dialogs/import-project-dialog", () => ({
  ImportProjectDialog: (props: any) => (
    <div data-testid="import-project-dialog">
      <button
        onClick={() => props.onImport(new File(["{}"], "x.tara.json"), {})}
      >
        confirm-import
      </button>
    </div>
  ),
}));

vi.mock("app/components/dialogs/open-project-dialog", () => {
  return {
    OpenProjectDialog: (props: any) => {
      const [value, setValue] = React.useState("");
      return (
        <div data-testid="open-dialog">
          <input
            data-testid="open-dialog-id-input"
            value={value}
            onChange={(e: any) => setValue(e.target.value)}
          />
          <button onClick={() => props.onOpen(value)}>open-selected</button>
        </div>
      );
    },
  };
});

vi.mock("app/components/dialogs/delete-project-dialog", () => ({
  DeleteProjectDialog: (props: any) => (
    <div data-testid="delete-dialog">
      <button onClick={props.onConfirm}>confirm-delete</button>
      <button onClick={props.onCancel}>cancel-delete</button>
    </div>
  ),
}));

vi.mock("app/components/dialogs/unsaved-changes-dialog", () => ({
  UnsavedChangesDialog: (props: any) => (
    <div data-testid="unsaved-dialog">
      <button onClick={() => props.onSave()}>save-and-switch</button>
      <button onClick={() => props.onDiscard()}>discard-and-switch</button>
    </div>
  ),
}));

vi.mock("app/components/dialogs/close-project-dialog", () => ({
  CloseProjectDialog: (props: any) => (
    <div data-testid="close-dialog">
      <button onClick={() => props.onSave()}>save-and-close</button>
      <button onClick={() => props.onDiscard()}>discard-and-close</button>
    </div>
  ),
}));

// ==================== IMPORTS (after mocks) ====================

import { ProjectShell } from "app/components/layout/project-shell";
import { projectService } from "app/services/project-service";
import { projectRepository } from "app/services/project-repository";
import { DefaultDFDGraphBuilder } from "features/dfd";
import { commitAssetSync } from "app/utils/commit-asset-sync";
import { commitHazardSafety } from "app/utils/commit-hazard-safety";

// ==================== FIXTURES ====================

function makeProject(overrides: Partial<Project> = {}): Project {
  const id = overrides.id ?? `proj-${Math.random().toString(36).slice(2)}`;
  return {
    id,
    info: { name: id, lastModified: "2020-01-01T00:00:00.000Z" },
    settings: { autoSave: false, strictMode: false, autoSaveInterval: 2 },
    phaseStatus: {},
    currentPhase: 0,
    isOpen: true,
    hasUnsavedChanges: false,
    lastOpened: "2020-01-01T00:00:00.000Z",
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

async function renderShellWith(initialProjects: Project[]) {
  (projectService.getAllProjects as any).mockResolvedValue({
    success: true,
    data: initialProjects,
  });
  (h.persistence.saveExistingProject as any).mockResolvedValue({
    success: true,
  });

  const view = render(<ProjectShell />);
  await waitFor(() =>
    expect(screen.getByTestId("sidebar")).toBeInTheDocument(),
  );
  await waitFor(() =>
    expect(
      screen.queryAllByTestId(/^row-/).length,
    ).toBe(initialProjects.length),
  );
  return view;
}

function activeIdShown(): string {
  return screen.getByTestId("active-id").textContent!;
}

describe("ProjectShell lifecycle — activeProjectId reassignment characterization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.persistence.saveExistingProject.mockResolvedValue({ success: true });
  });

  // ── #5: close ─────────────────────────────────────────────────────────

  describe("closeProject — closing the ACTIVE project", () => {
    it("reassigns activeProjectId to the first remaining OPEN project, in openProjects order, and clears the file reference", async () => {
      // openProjects order comes from Project[] array order (filter, not
      // sort) — pin that "first remaining" means "first in array order",
      // not e.g. most-recently-opened.
      const a = makeProject({ id: "A", isOpen: true });
      const b = makeProject({ id: "B", isOpen: true });
      const c = makeProject({ id: "C", isOpen: true });
      await renderShellWith([a, b, c]);

      // Manager auto-activates the first open project on load (see
      // loadProjects' `firstOpen` logic) — confirm the precondition.
      await waitFor(() => expect(activeIdShown()).toBe("A"));

      await act(async () => {
        screen.getByRole("button", { name: "close-A" }).click();
      });

      // A has hasUnsavedChanges: false → closeProject runs immediately,
      // no CloseProjectDialog.
      await waitFor(() => expect(activeIdShown()).toBe("B"));

      expect(h.persistence.saveExistingProject).toHaveBeenCalledWith(
        expect.objectContaining({ id: "A", isOpen: false }),
      );
      expect(h.persistence.clearCurrentFile).toHaveBeenCalledTimes(1);

      // A's row must now show isOpen: false while B/C remain open.
      expect(screen.getByTestId("row-A")).toHaveAttribute("data-open", "false");
      expect(screen.getByTestId("row-B")).toHaveAttribute("data-open", "true");
    });

    it("does NOT call clearCurrentFile when closing a project that is not the active one", async () => {
      const a = makeProject({ id: "A", isOpen: true });
      const b = makeProject({ id: "B", isOpen: true });
      await renderShellWith([a, b]);
      await waitFor(() => expect(activeIdShown()).toBe("A"));

      await act(async () => {
        screen.getByRole("button", { name: "close-B" }).click();
      });

      await waitFor(() =>
        expect(screen.getByTestId("row-B")).toHaveAttribute(
          "data-open",
          "false",
        ),
      );
      // Active project (A) is untouched.
      expect(activeIdShown()).toBe("A");
      expect(h.persistence.clearCurrentFile).not.toHaveBeenCalled();
    });

    it("reassigns activeProjectId to null when the last open project is closed", async () => {
      const a = makeProject({ id: "A", isOpen: true });
      await renderShellWith([a]);
      await waitFor(() => expect(activeIdShown()).toBe("A"));

      await act(async () => {
        screen.getByRole("button", { name: "close-A" }).click();
      });

      await waitFor(() => expect(activeIdShown()).toBe("null"));
      expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    });

    it("TARGET BEHAVIOR (post Step-2 fix): 'save and close' persists ONCE, with isOpen:false AND hasUnsavedChanges:false in the same write", async () => {
      // Decision (2024): the pre-existing double-write (once to clear
      // hasUnsavedChanges via confirmProjectClose's own save, once more via
      // closeProject to also set isOpen:false) is intentionally collapsed
      // into a single write inside the new manager closeProject(id). This
      // replaces the earlier characterization of the double-write as
      // CURRENT behavior — that test is superseded by this one.
      const a = makeProject({ id: "A", isOpen: true, hasUnsavedChanges: true });
      const b = makeProject({ id: "B", isOpen: true });
      await renderShellWith([a, b]);
      await waitFor(() => expect(activeIdShown()).toBe("A"));

      await act(async () => {
        screen.getByRole("button", { name: "close-A" }).click();
      });

      expect(screen.getByTestId("close-dialog")).toBeInTheDocument();
      expect(h.persistence.saveExistingProject).not.toHaveBeenCalled();

      await act(async () => {
        screen.getByRole("button", { name: "save-and-close" }).click();
      });

      await waitFor(() => expect(activeIdShown()).toBe("B"));

      const aCalls = (
        h.persistence.saveExistingProject as any
      ).mock.calls.filter((c: any[]) => c[0].id === "A");
      expect(aCalls.length).toBe(1);
      expect(aCalls[0][0]).toEqual(
        expect.objectContaining({ isOpen: false, hasUnsavedChanges: false }),
      );
    });

    it("TARGET BEHAVIOR: 'discard and close' now ALSO persists with hasUnsavedChanges:false — there is no longer a distinct on-disk outcome for discard vs. save", async () => {
      // Decision: since edits are meant to already be autosaved, "discard"
      // no longer means "leave hasUnsavedChanges:true on disk" (the OLD
      // behavior, which this test replaces). Closing always leaves a
      // clean on-disk state.
      const a = makeProject({ id: "A", isOpen: true, hasUnsavedChanges: true });
      const b = makeProject({ id: "B", isOpen: true });
      await renderShellWith([a, b]);
      await waitFor(() => expect(activeIdShown()).toBe("A"));

      await act(async () => {
        screen.getByRole("button", { name: "close-A" }).click();
      });
      await act(async () => {
        screen.getByRole("button", { name: "discard-and-close" }).click();
      });

      await waitFor(() => expect(activeIdShown()).toBe("B"));
      const aCalls = (
        h.persistence.saveExistingProject as any
      ).mock.calls.filter((c: any[]) => c[0].id === "A");
      expect(aCalls.length).toBe(1);
      expect(aCalls[0][0]).toEqual(
        expect.objectContaining({ isOpen: false, hasUnsavedChanges: false }),
      );
    });
  });

  // ── #7: delete ────────────────────────────────────────────────────────

  describe("confirmDeleteProject — deleting the ACTIVE project", () => {
    it("reassigns activeProjectId to the first remaining OPEN project computed from the PRE-delete `projects` snapshot", async () => {
      const a = makeProject({ id: "A", isOpen: true });
      const b = makeProject({ id: "B", isOpen: true });
      const c = makeProject({ id: "C", isOpen: false }); // not open — must be skipped
      await renderShellWith([a, b, c]);
      await waitFor(() => expect(activeIdShown()).toBe("A"));

      (projectService.deleteProject as any).mockResolvedValue({
        success: true,
      });

      await act(async () => {
        screen.getByRole("button", { name: "delete-A" }).click();
      });
      expect(screen.getByTestId("delete-dialog")).toBeInTheDocument();

      await act(async () => {
        screen.getByRole("button", { name: "confirm-delete" }).click();
      });

      await waitFor(() =>
        expect(screen.queryByTestId("row-A")).not.toBeInTheDocument(),
      );
      // B is open and survives the filter → becomes active. C is skipped
      // because isOpen: false, even though it's still in the list.
      expect(activeIdShown()).toBe("B");
      expect(projectService.deleteProject).toHaveBeenCalledWith("A");
    });

    it("does NOT reassign activeProjectId when deleting a project that is not active", async () => {
      const a = makeProject({ id: "A", isOpen: true });
      const b = makeProject({ id: "B", isOpen: true });
      await renderShellWith([a, b]);
      await waitFor(() => expect(activeIdShown()).toBe("A"));

      (projectService.deleteProject as any).mockResolvedValue({
        success: true,
      });

      await act(async () => {
        screen.getByRole("button", { name: "delete-B" }).click();
      });
      await act(async () => {
        screen.getByRole("button", { name: "confirm-delete" }).click();
      });

      await waitFor(() =>
        expect(screen.queryByTestId("row-B")).not.toBeInTheDocument(),
      );
      expect(activeIdShown()).toBe("A");
    });

    it("leaves activeProjectId untouched if the delete itself fails", async () => {
      const a = makeProject({ id: "A", isOpen: true });
      await renderShellWith([a]);
      await waitFor(() => expect(activeIdShown()).toBe("A"));

      (projectService.deleteProject as any).mockResolvedValue({
        success: false,
        error: "disk full",
      });

      await act(async () => {
        screen.getByRole("button", { name: "delete-A" }).click();
      });
      await act(async () => {
        screen.getByRole("button", { name: "confirm-delete" }).click();
      });

      await waitFor(() => expect(h.toast.error).toHaveBeenCalled());
      // A is still there and still active — no optimistic removal.
      expect(screen.getByTestId("row-A")).toBeInTheDocument();
      expect(activeIdShown()).toBe("A");
    });
  });

  // ── #3: auto-close-oldest inside handleProjectOpen ──────────────────────

  describe("handleProjectOpen — auto-close of the oldest project at MAX_OPEN", () => {
    it("closes the OLDEST open project (by lastOpened, falling back to info.lastModified) to make room, then opens the requested one", async () => {
      // MAX_OPEN = 10 (project-shell.tsx). Build exactly 10 open projects
      // with distinct lastOpened timestamps; "old-1" is deliberately the
      // oldest.
      const openProjects = Array.from({ length: 10 }, (_, i) =>
        makeProject({
          id: i === 0 ? "old-1" : `p${i}`,
          isOpen: true,
          lastOpened: new Date(2020, 0, i === 0 ? 1 : i + 10).toISOString(),
        }),
      );
      await renderShellWith(openProjects);
      await waitFor(() =>
        expect(screen.queryAllByTestId(/^row-/)).toHaveLength(10),
      );

      const newProject = makeProject({ id: "new-11", isOpen: false });
      (projectRepository.loadById as any).mockResolvedValue({
        success: true,
        data: newProject,
      });

      await act(async () => {
        screen.getByRole("button", { name: "open-dialog" }).click();
      });
      fireEvent.change(screen.getByTestId("open-dialog-id-input"), {
        target: { value: "new-11" },
      });
      await act(async () => {
        screen.getByRole("button", { name: "open-selected" }).click();
      });

      await waitFor(() =>
        expect(screen.getByTestId("row-new-11")).toBeInTheDocument(),
      );

      // The oldest (old-1) was closed to make room.
      expect(screen.getByTestId("row-old-1")).toHaveAttribute(
        "data-open",
        "false",
      );
      expect(h.toast.warning).toHaveBeenCalledWith(
        expect.stringContaining("old-1"),
      );

      // The newly opened project became active — NOT old-1, even though
      // old-1's close ran through the same activeProjectId-reassignment
      // shaped code as #5/#7. This is the ordering dependency flagged in
      // the cartography: the auto-close's own (irrelevant, since old-1
      // wasn't active) reassignment must not race with or override the
      // explicit setActiveProjectId(newProject.id) that follows it.
      expect(activeIdShown()).toBe("new-11");

      // Net open count returns to 10 (9 after auto-close + 1 newly opened).
      const openCount = screen
        .queryAllByTestId(/^row-/)
        .filter((el) => el.getAttribute("data-open") === "true").length;
      expect(openCount).toBe(10);
    });

    it("TARGET BEHAVIOR (post Step-2 fix): if the project being auto-closed is the ACTIVE one, activeProjectId IS reassigned and clearCurrentFile DOES fire — routed through the unified closeProject(id)", async () => {
      // Decision (2024): auto-close now calls the SAME closeProject(id) the
      // manual close button uses (Option A from the cartography's #1/#3
      // discussion), rather than its own simpler inline duplicate. This
      // replaces the earlier characterization of "auto-close never touches
      // activeProjectId" as CURRENT (pre-fix) behavior — that test is
      // superseded by this one.
      const openProjects = Array.from({ length: 10 }, (_, i) =>
        makeProject({
          id: i === 0 ? "old-active" : `p${i}`,
          isOpen: true,
          lastOpened: new Date(2020, 0, i === 0 ? 1 : i + 10).toISOString(),
        }),
      );
      await renderShellWith(openProjects);
      await waitFor(() => expect(activeIdShown()).toBe("old-active"));

      const newProject = makeProject({ id: "new-11", isOpen: false });
      (projectRepository.loadById as any).mockResolvedValue({
        success: true,
        data: newProject,
      });

      await act(async () => {
        screen.getByRole("button", { name: "open-dialog" }).click();
      });
      fireEvent.change(screen.getByTestId("open-dialog-id-input"), {
        target: { value: "new-11" },
      });
      await act(async () => {
        screen.getByRole("button", { name: "open-selected" }).click();
      });

      await waitFor(() =>
        expect(screen.getByTestId("row-new-11")).toBeInTheDocument(),
      );

      expect(screen.getByTestId("row-old-active")).toHaveAttribute(
        "data-open",
        "false",
      );
      // The unified closeProject(id) now reassigns + clears the file
      // reference for old-active BEFORE the subsequent explicit
      // setActiveProjectId(newProject.id) runs — both fire, and the final
      // visible state is still correct (new-11 active), but
      // clearCurrentFile is now observably called once, where before it
      // was never called in this path at all.
      expect(h.persistence.clearCurrentFile).toHaveBeenCalledTimes(1);
      expect(activeIdShown()).toBe("new-11");
    });
  });

  // ── #2: reopen an already-open project (early-return branch) ───────────

  describe("handleProjectOpen — early return when target is already open", () => {
    it("switches directly via setActiveProjectId/setActivePhase, without touching persistence or projectRepository at all", async () => {
      const a = makeProject({ id: "A", isOpen: true, currentPhase: 0 });
      const b = makeProject({ id: "B", isOpen: true, currentPhase: 3 });
      await renderShellWith([a, b]);
      await waitFor(() => expect(activeIdShown()).toBe("A"));

      await act(async () => {
        screen.getByRole("button", { name: "open-B" }).click();
      });

      await waitFor(() => expect(activeIdShown()).toBe("B"));
      // The early-return branch never reaches loadById or
      // syncProjectToStorage — pin that it's a pure state switch, no I/O.
      expect(projectRepository.loadById).not.toHaveBeenCalled();
      expect(h.persistence.saveExistingProject).not.toHaveBeenCalled();
    });
  });

  // ── #4: normal open-from-recent flow (no auto-close needed) ─────────────

  describe("handleProjectOpen — normal open (below MAX_OPEN, target not yet in state)", () => {
    it("loads the project, persists it, appends it to the list, and activates it — no auto-close side effects", async () => {
      const a = makeProject({ id: "A", isOpen: true });
      await renderShellWith([a]);
      await waitFor(() => expect(activeIdShown()).toBe("A"));

      const loaded = makeProject({ id: "B", isOpen: false, currentPhase: 2 });
      (projectRepository.loadById as any).mockResolvedValue({
        success: true,
        data: loaded,
      });

      await act(async () => {
        screen.getByRole("button", { name: "open-dialog" }).click();
      });
      fireEvent.change(screen.getByTestId("open-dialog-id-input"), {
        target: { value: "B" },
      });
      await act(async () => {
        screen.getByRole("button", { name: "open-selected" }).click();
      });

      await waitFor(() => expect(activeIdShown()).toBe("B"));
      expect(screen.getByTestId("row-B")).toHaveAttribute("data-open", "true");
      expect(screen.getByTestId("row-A")).toHaveAttribute("data-open", "true");
      expect(h.persistence.saveExistingProject).toHaveBeenCalledWith(
        expect.objectContaining({ id: "B", isOpen: true }),
      );
      // No auto-close warning — well under MAX_OPEN.
      expect(h.toast.warning).not.toHaveBeenCalled();
    });
  });

  // ── #1: confirmProjectSwitch (unsaved-changes gate before switching) ────

  describe("confirmProjectSwitch — switching away from an unsaved active project", () => {
    it("'save and switch' persists the CURRENT active project (hasUnsavedChanges cleared) before activating the target", async () => {
      const a = makeProject({ id: "A", isOpen: true, hasUnsavedChanges: true });
      const b = makeProject({ id: "B", isOpen: true, currentPhase: 4 });
      await renderShellWith([a, b]);
      await waitFor(() => expect(activeIdShown()).toBe("A"));

      await act(async () => {
        screen.getByRole("button", { name: "select-B" }).click();
      });

      // A has unsaved changes → gated by UnsavedChangesDialog, not an
      // immediate switch.
      expect(screen.getByTestId("unsaved-dialog")).toBeInTheDocument();
      expect(activeIdShown()).toBe("A");

      await act(async () => {
        screen.getByRole("button", { name: "save-and-switch" }).click();
      });

      await waitFor(() => expect(activeIdShown()).toBe("B"));
      expect(h.persistence.saveExistingProject).toHaveBeenCalledWith(
        expect.objectContaining({ id: "A", hasUnsavedChanges: false }),
      );
    });

    it("'discard and switch' activates the target WITHOUT persisting the current project at all", async () => {
      const a = makeProject({ id: "A", isOpen: true, hasUnsavedChanges: true });
      const b = makeProject({ id: "B", isOpen: true });
      await renderShellWith([a, b]);
      await waitFor(() => expect(activeIdShown()).toBe("A"));

      await act(async () => {
        screen.getByRole("button", { name: "select-B" }).click();
      });
      await act(async () => {
        screen.getByRole("button", { name: "discard-and-switch" }).click();
      });

      await waitFor(() => expect(activeIdShown()).toBe("B"));
      expect(h.persistence.saveExistingProject).not.toHaveBeenCalled();
      // A's in-memory hasUnsavedChanges flag is untouched by a discard —
      // only a subsequent explicit save would clear it.
      expect(screen.getByTestId("row-A")).toBeInTheDocument();
    });

    it("switching to a project with NO unsaved changes on the source skips the dialog entirely", async () => {
      const a = makeProject({
        id: "A",
        isOpen: true,
        hasUnsavedChanges: false,
      });
      const b = makeProject({ id: "B", isOpen: true });
      await renderShellWith([a, b]);
      await waitFor(() => expect(activeIdShown()).toBe("A"));

      await act(async () => {
        screen.getByRole("button", { name: "select-B" }).click();
      });

      expect(screen.queryByTestId("unsaved-dialog")).not.toBeInTheDocument();
      await waitFor(() => expect(activeIdShown()).toBe("B"));
    });
  });

  // ── #8: new project creation ─────────────────────────────────────────────

  describe("NewProjectDialog.onCreate — addProject", () => {
    it("creates, persists, and immediately activates the new project at phase 0", async () => {
      const a = makeProject({ id: "A", isOpen: true, currentPhase: 3 });
      await renderShellWith([a]);
      await waitFor(() => expect(activeIdShown()).toBe("A"));

      (projectService.createProject as any).mockReturnValue({
        success: true,
        data: makeProject({ id: "brand-new", isOpen: true, currentPhase: 0 }),
      });
      (h.persistence.saveNewProject as any).mockResolvedValue({
        success: true,
        data: { filePath: "/tmp/brand-new.tara.json" },
      });

      await act(async () => {
        screen.getByRole("button", { name: "new-project-dialog" }).click();
      });
      expect(screen.getByTestId("new-project-dialog")).toBeInTheDocument();

      await act(async () => {
        screen.getByRole("button", { name: "confirm-create" }).click();
      });

      await waitFor(() => expect(activeIdShown()).toBe("brand-new"));
      expect(screen.getByTestId("row-brand-new")).toHaveAttribute(
        "data-open",
        "true",
      );
      // A (previously active, phase 3) is untouched by the new project's
      // creation — only the new project is added to the list.
      expect(screen.getByTestId("row-A")).toBeInTheDocument();
    });

    it("does NOT add or activate anything if projectService.createProject fails", async () => {
      const a = makeProject({ id: "A", isOpen: true });
      await renderShellWith([a]);
      await waitFor(() => expect(activeIdShown()).toBe("A"));

      (projectService.createProject as any).mockReturnValue({
        success: false,
        error: "invalid name",
      });

      await act(async () => {
        screen.getByRole("button", { name: "new-project-dialog" }).click();
      });
      await act(async () => {
        screen.getByRole("button", { name: "confirm-create" }).click();
      });

      await waitFor(() => expect(h.toast.error).toHaveBeenCalled());
      expect(activeIdShown()).toBe("A");
      expect(h.persistence.saveNewProject).not.toHaveBeenCalled();
    });
  });

  // ── #9: ImportProjectDialog now routes through handleImportFile ────────

  describe("ImportProjectDialog.onImport — now applies the full pipeline via handleImportFile", () => {
    it("TARGET BEHAVIOR (post-fix): ensureProjectGraph/commitAssetSync/commitHazardSafety all run for a dialog-based import, closing the gap import-path-parity.test.ts documented", async () => {
      const a = makeProject({ id: "A", isOpen: true });
      await renderShellWith([a]);
      await waitFor(() => expect(activeIdShown()).toBe("A"));

      const importedRaw = makeProject({
        id: "imported-1",
        isOpen: true,
        dfd: {
          elements: [{ id: "P-1", type: "Process" }],
          connections: [],
          assets: [],
        } as any,
      });
      (projectService.importProjectAsCopy as any).mockResolvedValue({
        success: true,
        data: importedRaw,
      });

      await act(async () => {
        screen.getByRole("button", { name: "import-dialog" }).click();
      });
      expect(screen.getByTestId("import-project-dialog")).toBeInTheDocument();

      await act(async () => {
        screen.getByRole("button", { name: "confirm-import" }).click();
      });

      await waitFor(() => expect(activeIdShown()).toBe("imported-1"));

      // Before the fix, NONE of these three ran for a dialog-based import —
      // see import-path-parity.test.ts's "dialog path" characterization.
      expect(DefaultDFDGraphBuilder).toHaveBeenCalled();
      expect(commitAssetSync).toHaveBeenCalled();
      expect(commitHazardSafety).toHaveBeenCalled();

      // handleImportFile owns persistence now — the shell no longer calls
      // saveExistingProject/registry.upsert itself for this path.
      expect(h.persistence.saveExistingProject).toHaveBeenCalledWith(
        expect.objectContaining({ id: "imported-1" }),
      );
    });

    it("still surfaces an error and does not activate anything if importProjectAsCopy itself fails", async () => {
      const a = makeProject({ id: "A", isOpen: true });
      await renderShellWith([a]);
      await waitFor(() => expect(activeIdShown()).toBe("A"));

      (projectService.importProjectAsCopy as any).mockResolvedValue({
        success: false,
        error: "corrupt file",
      });

      await act(async () => {
        screen.getByRole("button", { name: "import-dialog" }).click();
      });
      await act(async () => {
        screen.getByRole("button", { name: "confirm-import" }).click();
      });

      await waitFor(() => expect(h.toast.error).toHaveBeenCalled());
      expect(activeIdShown()).toBe("A");
    });
  });
});