// ==================== USE PROJECT MANAGER ====================
// Single Responsibility: manage the full project list state and all
// project lifecycle operations.
//
// Renamed from use-projects.ts (Phase D). The old file had the right
// structure but was never wired into main-layout. This version is
// the authoritative state owner consumed by ProjectShell via Context.
//
// Key design decisions:
//   - projectsRef keeps a current copy of projects[] so callbacks
//     can read the latest state without closing over stale values.
//   - updateProject uses functional setProjects() — safe for concurrent
//     updates (DFD autosave + bidirectional asset sync firing together).
//   - syncProjectToStorage is the single write path for all saves.

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { Project, ProjectMetadata } from "../models/project-types";
import { projectService } from "../services/project-service";
import { projectRepository } from "../services/project-repository";
import { projectRegistry } from "../services/project-registry";
import storageService from "../services/storage-service";
import { useProjectPersistence } from "./use-project-persistence";
import { useAutoSave } from "./use-auto-save";
import { useProjectFileDownload } from "./use-project-file-download";
import { DefaultDFDGraphBuilder } from "features/dfd";
import { useToast } from "shared";
import { commitAssetSync } from "../utils/commit-asset-sync";
import { buildAssetHazardLinks } from "../utils/build-asset-hazard-links";
import { commitHazardSafety } from "../utils/commit-hazard-safety";

// HazardItem safety chokepoint — runs right after commitAssetSync. Re-rates
// CAUSE assets (physicalImpact / aggregatedImpact) from the bowtie via the
// Safety Override. Reference-guarded: returns the same Project when no cause
// asset changes, so it is a cheap no-op on DFD-only edits.
function commitProjectSafety(project: Project): Project {
  const summaries = buildAssetHazardLinks(project.hazards);
  const assets = commitHazardSafety(project.assets, summaries) ?? null;
  return assets === project.assets ? project : { ...project, assets };
}

// ==================== TYPES ====================

export interface UseProjectManagerReturn {
  // State
  projects: Project[];
  activeProjectId: string | null;
  activeProject: Project | undefined;
  openProjects: Project[];
  recentProjectsMetadata: ProjectMetadata[];
  isLoading: boolean;
  activePhase: number;

  // Setters needed by ProjectShell
  setActivePhase: (phase: number) => void;

  // Project operations
  updateProject: (patch: Partial<Project> & { id: string }) => Promise<void>;
  syncProjectToStorage: (project: Project) => Promise<boolean>;
  switchProject: (projectId: string) => void;
  saveProject: (projectId: string) => Promise<void>;
  closeProject: (projectId: string) => Promise<void>;
  deleteProject: (projectId: string) => Promise<boolean>;
  activateProject: (project: Project) => void;

  // File operations (used by ProjectShell dialogs)
  loadProjects: () => Promise<void>;
  loadRecentProjects: () => Promise<void>;
  handleOpenFromFile: (filePath: string) => Promise<void>;
  handleImportFile: (project: any) => Promise<void>;

  // Persistence (passed through to dialogs)
  persistence: ReturnType<typeof useProjectPersistence>;
  downloadProject: ReturnType<typeof useProjectFileDownload>["downloadProject"];
}

// ==================== HOOK ====================

export function useProjectManager(): UseProjectManagerReturn {
  const toast = useToast();
  const persistence = useProjectPersistence();
  const { downloadProject } = useProjectFileDownload();

  // ── Core state ────────────────────────────────────────────────────────────

  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activePhase, setActivePhase] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [recentProjectsMetadata, setRecentProjectsMetadata] = useState<
    ProjectMetadata[]
  >([]);

  // ── Derived state ─────────────────────────────────────────────────────────

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId),
    [projects, activeProjectId],
  );

  const openProjects = useMemo(
    () => projects.filter((p) => p.isOpen),
    [projects],
  );

  // ── Stable ref — always current projects array ────────────────────────────
  // Callbacks that need the latest projects without closing over state
  // read from this ref instead.

  const projectsRef = useRef(projects);
  projectsRef.current = projects;

  const activeProjectRef = useRef(activeProject);
  activeProjectRef.current = activeProject;

  // ── Graph helper ──────────────────────────────────────────────────────────

  const ensureProjectGraph = useCallback((p: Project): Project => {
    if (p.dfd?.graph || !p.dfd?.elements?.length) return p;
    try {
      const graph = new DefaultDFDGraphBuilder().build(p.dfd);
      return { ...p, dfd: { ...p.dfd, graph } };
    } catch {
      return p;
    }
  }, []);

  // ── Storage sync ──────────────────────────────────────────────────────────

  // Stable ref to toast.error so syncProjectToStorage never needs to
  // be recreated when toast changes identity between renders.
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const syncProjectToStorage = useCallback(
    async (project: Project): Promise<boolean> => {
      const result = await persistence.saveExistingProject(project);
      if (!result.success) {
        toastRef.current.error(`Failed to save: ${result.error}`);
        return false;
      }
      await projectRegistry.upsert(project);
      return true;
    },
    // persistence is stable (useProjectPersistence uses useCallback internally).
    // toastRef is a ref — never changes identity.
    [persistence],
  );

  // ── Core write channel ────────────────────────────────────────────────────
  // All feature tab handlers call this. Accepts a PARTIAL patch (not a full
  // Project) and merges it against the freshest state inside setProjects'
  // functional updater — this is the fix for a real lost-update race:
  //
  //   Previously, updateProject took a full Project object that each caller
  //   built by spreading their OWN snapshot (`{...activeProjectRef.current,
  //   someField: ...}`) and then REPLACED the project entry wholesale. If two
  //   callers fired close together (e.g. AssetsTab's 1s debounced save, and
  //   useBidirectionalAssetSync reacting to that very save), each built its
  //   full replacement from a snapshot that didn't yet see the other's
  //   change — whichever replacement landed last in setProjects won
  //   COMPLETELY, silently discarding the other caller's edit (e.g. a
  //   just-typed asset description).
  //
  //   Merging the patch onto `p` (the freshest entry from React's own state
  //   queue, not a caller-side ref) inside the functional updater removes
  //   the race: every top-level field NOT included in the patch is always
  //   taken from the latest known state, regardless of how many callers
  //   fire concurrently.
  //
  //   Residual scope note: this fixes races on TOP-LEVEL Project fields
  //   (assets, dfd, threats, ...). A caller that patches a NESTED object
  //   (e.g. `dfd: {...current.dfd, ...updates.dfd}`) can still build that
  //   sub-object from a stale `current.dfd` — the same class of race one
  //   level deeper. None of today's callers do this for `assets`, which is
  //   what mattered here; revisit with a deeper merge if a similar bug
  //   surfaces for a nested field.

  const updateProject = useCallback(
    async (patch: Partial<Project> & { id: string }): Promise<void> => {
      const now = new Date().toISOString();

      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== patch.id) return p;

          const merged: Project = {
            ...p,
            ...patch,
            info: { ...p.info, ...patch.info, lastModified: now },
            hasUnsavedChanges: true,
          };

          const synced = commitAssetSync(p, merged);
          return commitProjectSafety(synced);
        }),
      );

      // Autosave decision + content: recompute the merge from
      // projectsRef.current (kept current every render) rather than trying
      // to read a value out of the setProjects updater above — an earlier
      // version used flushSync for that, which React refuses to run when
      // called from inside a lifecycle context (confirmed in production:
      // "flushSync was called from inside a lifecycle method", triggered by
      // useBidirectionalAssetSync's effect firing on mount). This redundant
      // merge can, in the rare case of two truly simultaneous updateProject
      // calls, lag one render behind for THIS immediate extra disk-write —
      // the in-memory state set above is unaffected and always correct, and
      // the next autosave interval or manual save captures the latest state
      // regardless.
      const latest = projectsRef.current.find((p) => p.id === patch.id);
      if (!latest) return;

      const mergedRaw: Project = {
        ...latest,
        ...patch,
        info: { ...latest.info, ...patch.info, lastModified: now },
        hasUnsavedChanges: true,
      };
      const mergedForAutoSave = commitProjectSafety(
        commitAssetSync(latest, mergedRaw),
      );

      if (mergedForAutoSave.settings?.autoSave) {
        const savedProject: Project = {
          ...mergedForAutoSave,
          hasUnsavedChanges: false,
        };
        const success = await syncProjectToStorage(savedProject);
        if (success) {
          setProjects((prev) =>
            prev.map((p) => (p.id === patch.id ? savedProject : p)),
          );
        }
      }
    },
    // syncProjectToStorage is now stable (no toast in deps)
    [syncProjectToStorage],
  );

  // ── Auto-save ─────────────────────────────────────────────────────────────

  useAutoSave(
    activeProject ?? null,
    {
      enabled: activeProject?.settings?.autoSave ?? true,
      interval: activeProject?.settings?.autoSaveInterval ?? 2,
      // Stable callbacks via ref — prevent useAutoSave from re-running
      // its interval setup on every render when toast changes identity.
      onSuccess: useCallback((projectId: string) => {
        console.log(`[useProjectManager] Auto-saved project ${projectId}`);
      }, []),
      onError: useCallback((_projectId: string, error: string) => {
        toastRef.current.error(`Auto-save failed: ${error}`);
      }, []),
    },
    persistence,
  );

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadRecentProjects = useCallback(async () => {
    await projectRegistry.migrateFromLegacyKey();
    const metadata = await projectRegistry.getAll();
    setRecentProjectsMetadata(metadata);
  }, []);

  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await projectService.getAllProjects();

      if (result.success && result.data) {
        const validProjects = result.data.filter((p) => {
          const isValid = p && p.id && p.info && p.phaseStatus;
          if (!isValid) {
            console.warn(
              "[useProjectManager] Skipping invalid project:",
              p?.id ?? "unknown",
            );
          }
          return isValid;
        });

        // Phase 2 — backfill: repair pre-existing store drift (stale
        // linkedDFDElements, stranded hazard targets) on load. Idempotent: a
        // no-op for already-consistent projects. In-memory only; persists on the
        // next write.
        const projectsWithGraph = validProjects
          .map(ensureProjectGraph)
          .map((p) => commitAssetSync(undefined, p))
          .map(commitProjectSafety);
        setProjects(projectsWithGraph);

        const firstOpen = projectsWithGraph.find((p) => p.isOpen);
        if (firstOpen) {
          setActiveProjectId(firstOpen.id);
          setActivePhase(firstOpen.currentPhase ?? 0);
        }

        if (validProjects.length < result.data.length) {
          toastRef.current.warning(
            `${result.data.length - validProjects.length} invalid project(s) were skipped`,
          );
        }
      }

      await loadRecentProjects();
    } catch (error) {
      toastRef.current.error(`Failed to load projects: ${error}`);
    } finally {
      setIsLoading(false);
    }
  }, [ensureProjectGraph, loadRecentProjects]);

  // Load on mount
  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // ── Project navigation ────────────────────────────────────────────────────

  const switchProject = useCallback((projectId: string) => {
    const project = projectsRef.current.find((p) => p.id === projectId);
    if (!project?.isOpen) return;
    setActiveProjectId(projectId);
    setActivePhase(project.currentPhase ?? 0);
  }, []);

  const saveProject = useCallback(
    async (projectId: string): Promise<void> => {
      const project = projectsRef.current.find((p) => p.id === projectId);
      if (!project) return;

      const now = new Date().toISOString();
      const savedProject: Project = {
        ...project,
        hasUnsavedChanges: false,
        info: { ...project.info, lastModified: now },
      };

      const success = await syncProjectToStorage(savedProject);
      if (success) {
        setProjects((prev) =>
          prev.map((p) => (p.id === projectId ? savedProject : p)),
        );
        toastRef.current.success(`Project "${project.info.name}" saved`);
      }
    },
    [syncProjectToStorage],
  );

  // ── Close ─────────────────────────────────────────────────────────────────
  // Single writer for "close a project": persists the current in-memory
  // content with isOpen:false AND hasUnsavedChanges:false in ONE write —
  // no separate pre-save step (see project-shell.tsx's confirmProjectClose,
  // which used to write twice: once to clear hasUnsavedChanges, once more
  // here to also set isOpen:false).
  //
  // Used by BOTH the manual close button/dialog AND handleProjectOpen's
  // auto-close-oldest-at-MAX_OPEN path. Previously auto-close had its own,
  // simpler inline duplicate that never touched activeProjectId at all —
  // if the oldest project being auto-closed happened to be the active one,
  // activeProjectId briefly kept pointing at a now-closed project (harmless
  // before only because the caller immediately overwrote it with the
  // newly-opened project's id). This unifies both paths onto one writer.
  const closeProject = useCallback(
    async (projectId: string): Promise<void> => {
      const project = projectsRef.current.find((p) => p.id === projectId);
      if (!project) return;

      const closedProject: Project = {
        ...project,
        isOpen: false,
        hasUnsavedChanges: false,
      };

      const success = await syncProjectToStorage(closedProject);
      if (!success) return;

      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? closedProject : p)),
      );

      if (activeProjectRef.current?.id === projectId) {
        const remaining = projectsRef.current.filter(
          (p) => p.isOpen && p.id !== projectId,
        );
        setActiveProjectId(remaining[0]?.id ?? null);
        setActivePhase(remaining[0]?.currentPhase ?? 0);
        persistence.clearCurrentFile();
      }
    },
    [persistence, syncProjectToStorage],
  );

  // ── Delete ────────────────────────────────────────────────────────────────
  // Same discipline as closeProject: reads from projectsRef (freshest
  // state) rather than closing over the `projects` render snapshot the way
  // project-shell's original confirmDeleteProject did. If the deleted
  // project was active, reassigns activeProjectId to the first remaining
  // OPEN project — identical selection rule to closeProject, computed from
  // the PRE-delete list filtered by id, matching the characterization
  // tests pinned before this refactor.
  //
  // Owns its own toast feedback (like saveProject/handleImportFile do),
  // unlike closeProject which stays silent and lets project-shell decide
  // when to toast (closeProject has no single "success" message — it's
  // used both for a user-visible close AND a background auto-close with a
  // different message). Delete only ever has one message, so it lives here.
  const deleteProject = useCallback(
    async (projectId: string): Promise<boolean> => {
      const project = projectsRef.current.find((p) => p.id === projectId);
      if (!project) return false;

      const result = await projectService.deleteProject(projectId);
      if (!result.success) {
        toastRef.current.error(`Failed to delete: ${result.error}`);
        return false;
      }

      setProjects((prev) => prev.filter((p) => p.id !== projectId));

      if (activeProjectRef.current?.id === projectId) {
        const remaining = projectsRef.current.filter(
          (p) => p.isOpen && p.id !== projectId,
        );
        setActiveProjectId(remaining[0]?.id ?? null);
        setActivePhase(remaining[0]?.currentPhase ?? 0);
      }

      toastRef.current.success(`Project "${project.info?.name}" deleted`);
      return true;
    },
    [],
  );

  // ── Activate (open or create) ───────────────────────────────────────────
  // Shared tail for "put this project in the list and make it current" —
  // the pattern handleOpenFromFile already used internally (append-or-
  // replace, then activate). Used by project-shell for:
  //   - the normal (non-early-return, non-auto-close) branch of
  //     handleProjectOpen, where a freshly loaded project may or may not
  //     already be in the list;
  //   - NewProjectDialog.onCreate, where the project is always new (the
  //     append branch always runs, but the exists-check is harmless).
  // Does NOT own persistence — callers persist first (loadById + sync, or
  // saveNewProject) and pass in the already-saved project.
  const activateProject = useCallback((project: Project): void => {
    setProjects((prev) => {
      const exists = prev.find((p) => p.id === project.id);
      return exists
        ? prev.map((p) => (p.id === project.id ? project : p))
        : [...prev, project];
    });
    setActiveProjectId(project.id);
    setActivePhase(project.currentPhase ?? 0);
  }, []);

  // ── File open / import ────────────────────────────────────────────────────

  const handleOpenFromFile = useCallback(
    async (filePath: string): Promise<void> => {
      const result = await projectRepository.loadFromPath(filePath);

      if (!result.success || !result.data) {
        toastRef.current.error(`Failed to read file: ${result.error}`);
        return;
      }

      const { _migrated, _fromVersion, ...rawProject } = result.data as any;
      const project = commitProjectSafety(
        commitAssetSync(
          undefined,
          ensureProjectGraph({
            ...rawProject,
            isOpen: true,
            lastOpened: new Date().toISOString(),
            hasUnsavedChanges: false,
          }),
        ),
      );

      await projectRegistry.upsert(project);

      if (_migrated) {
        toastRef.current.success(
          `Project "${project.info.name}" was migrated from schema v${_fromVersion}. ` +
            `A backup of the original file was saved alongside it.`,
        );
      }

      setProjects((prev) => {
        const exists = prev.find((p) => p.id === project.id);
        return exists
          ? prev.map((p) => (p.id === project.id ? project : p))
          : [...prev, project];
      });
      setActiveProjectId(project.id);
      setActivePhase(project.currentPhase ?? 0);

      toastRef.current.success(`Project "${project.info.name}" opened!`);
      await loadRecentProjects();
    },
    [ensureProjectGraph, loadRecentProjects],
  );

  const handleImportFile = useCallback(
    async (rawProject: any): Promise<void> => {
      try {
        if (!rawProject.id || !rawProject.info) {
          throw new Error("Invalid project structure");
        }

        const project = commitProjectSafety(
          commitAssetSync(
            undefined,
            ensureProjectGraph({
              ...rawProject,
              isOpen: true,
              lastOpened: new Date().toISOString(),
            }),
          ),
        );

        await persistence.saveExistingProject(project);
        await projectRegistry.upsert(project);

        setProjects((prev) => [...prev, project]);
        setActiveProjectId(project.id);
        setActivePhase(project.currentPhase || 0);

        await loadRecentProjects();
        toastRef.current.success(
          `Project "${project.info.name}" imported successfully!`,
        );
      } catch (error: any) {
        toastRef.current.error(`Failed to import project: ${error.message}`);
      }
    },
    [ensureProjectGraph, loadRecentProjects, persistence],
  );

  // ── Return ────────────────────────────────────────────────────────────────

  return {
    projects,
    activeProjectId,
    activeProject,
    openProjects,
    recentProjectsMetadata,
    isLoading,
    activePhase,

    setActivePhase,

    updateProject,
    syncProjectToStorage,
    switchProject,
    saveProject,
    closeProject,
    deleteProject,
    activateProject,

    loadProjects,
    loadRecentProjects,
    handleOpenFromFile,
    handleImportFile,

    persistence,
    downloadProject,
  };
}