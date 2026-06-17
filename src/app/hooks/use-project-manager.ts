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
  setActiveProjectId: (id: string | null) => void;
  setActivePhase: (phase: number) => void;
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;

  // Project operations
  updateProject: (project: Project) => Promise<void>;
  syncProjectToStorage: (project: Project) => Promise<boolean>;
  switchProject: (projectId: string) => void;
  saveProject: (projectId: string) => Promise<void>;

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
  // All feature tab handlers call this. Uses functional updater +
  // ref pattern to prevent stale-closure overwrites.

  const updateProject = useCallback(
    async (updatedProject: Project): Promise<void> => {
      const now = new Date().toISOString();

      // Phase 2 — single sync chokepoint. Every feature tab writes through
      // updateProject, so re-syncing AssetData from DFD here means no write path
      // can strand or drift assets. Reference-guarded + idempotent → cheap no-op
      // when DFD assets are unchanged.
      const previous = projectsRef.current.find(
        (p) => p.id === updatedProject.id,
      );
      const synced = commitAssetSync(previous, updatedProject);
      const safe = commitProjectSafety(synced);

      const projectWithChanges: Project = {
        ...safe,
        info: { ...safe.info, lastModified: now },
        hasUnsavedChanges: true,
      };

      setProjects((prev) =>
        prev.map((p) => (p.id === updatedProject.id ? projectWithChanges : p)),
      );

      if (updatedProject.settings?.autoSave) {
        const savedProject: Project = {
          ...projectWithChanges,
          hasUnsavedChanges: false,
        };
        const success = await syncProjectToStorage(savedProject);
        if (success) {
          setProjects((prev) =>
            prev.map((p) => (p.id === updatedProject.id ? savedProject : p)),
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

    setActiveProjectId,
    setActivePhase,
    setProjects,

    updateProject,
    syncProjectToStorage,
    switchProject,
    saveProject,

    loadProjects,
    loadRecentProjects,
    handleOpenFromFile,
    handleImportFile,

    persistence,
    downloadProject,
  };
}