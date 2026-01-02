// ==================== useProjects HOOK ====================
// Custom hook for managing project state and operations

import { useState, useEffect, useCallback } from 'react';
import {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
} from "../models/project-types";
import { projectService } from "../services/project-service";
import { MAX_OPEN_PROJECTS } from "../config/phase-config";

// ==================== TYPES ====================

export interface UseProjectsReturn {
  // State
  projects: Project[];
  activeProjectId: string | null;
  activeProject: Project | null;
  openProjects: Project[];
  recentProjects: Project[];
  loading: boolean;
  error: string | null;

  // Project Operations
  createProject: (input: CreateProjectInput) => Promise<Project | null>;
  openProject: (projectId: string) => Promise<boolean>;
  closeProject: (projectId: string) => Promise<boolean>;
  switchProject: (projectId: string) => void;
  updateProject: (
    projectId: string,
    updates: UpdateProjectInput
  ) => Promise<boolean>;
  deleteProject: (projectId: string) => Promise<boolean>;
  duplicateProject: (projectId: string) => Promise<Project | null>;
  exportProject: (projectId: string) => Promise<boolean>;
  importProject: (file: File, overwrite?: boolean) => Promise<Project | null>;
  searchProjects: (query: string) => Project[];

  // Project State Updates
  setActiveProjectId: (projectId: string | null) => void;
  refreshProjects: () => Promise<void>;
  markProjectUnsaved: (projectId: string, hasChanges: boolean) => void;
}

// ==================== HOOK ====================

export const useProjects = (): UseProjectsReturn => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // ==================== COMPUTED VALUES ====================

  const activeProject = projects.find((p) => p.id === activeProjectId) || null;

  const openProjects = projects
    .filter((p) => p.isOpen)
    .sort((a, b) => a.info.name.localeCompare(b.info.name));

  const recentProjects = projects
    .filter((p) => !p.isOpen)
    .sort((a, b) => {
      const dateA = new Date(b.lastOpened || b.info.lastModified).getTime();
      const dateB = new Date(a.lastOpened || a.info.lastModified).getTime();
      return dateA - dateB;
    })
    .slice(0, 10);

  // ==================== LOAD PROJECTS ====================

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await projectService.getAllProjects();

      if (!result.success || !result.data) {
        setError(result.error ?? "Failed to load projects");
        return;
      }

      const projects = result.data;
      setProjects(projects);

      // Set first open project as active (if any)
      const firstOpenProject = projects.find(
        (project) => project.isOpen === true
      );

      if (firstOpenProject) {
        setActiveProjectId(firstOpenProject.id);
      } else {
        setActiveProjectId(null);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("Failed to load projects");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // ==================== PROJECT OPERATIONS ====================

  const createProject = useCallback(
    async (input: CreateProjectInput): Promise<Project | null> => {
      try {
        const result = await projectService.createProject(input);

        if (result.success && result.data) {
          const newProject = result.data;
          setProjects((prev) => [...prev, newProject]);
          setActiveProjectId(newProject.id);
          return newProject;
        } else {
          setError(result.error || "Failed to create project");
          return null;
        }
      } catch (err: any) {
        setError(err.message || "Failed to create project");
        return null;
      }
    },
    []
  );

  const openProject = useCallback(
    async (projectId: string): Promise<boolean> => {
      try {
        // Check if max open projects reached
        if (openProjects.length >= MAX_OPEN_PROJECTS) {
          // Auto-close oldest project
          const oldestProject = [...openProjects].sort((a, b) => {
            const dateA = new Date(
              a.lastOpened || a.info.lastModified
            ).getTime();
            const dateB = new Date(
              b.lastOpened || b.info.lastModified
            ).getTime();
            return dateA - dateB;
          })[0];

          if (oldestProject) {
            await projectService.markProjectClosed(oldestProject.id);
          }
        }

        const result = await projectService.markProjectOpened(projectId);

        if (result.success && result.data) {
          setProjects((prev) =>
            prev.map((p) => {
              if (p.id === projectId) return result.data!;
              if (
                openProjects.length >= MAX_OPEN_PROJECTS &&
                p.id === openProjects[0]?.id
              ) {
                return { ...p, isOpen: false };
              }
              return p;
            })
          );

          setActiveProjectId(projectId);
          return true;
        } else {
          setError(result.error || "Failed to open project");
          return false;
        }
      } catch (err: any) {
        setError(err.message || "Failed to open project");
        return false;
      }
    },
    [openProjects]
  );

  const closeProject = useCallback(
    async (projectId: string): Promise<boolean> => {
      try {
        const result = await projectService.markProjectClosed(projectId);

        if (result.success && result.data) {
          setProjects((prev) =>
            prev.map((p) => (p.id === projectId ? result.data! : p))
          );

          // If closing active project, switch to another open project
          if (activeProjectId === projectId) {
            const remainingOpen = openProjects.filter(
              (p) => p.id !== projectId
            );
            setActiveProjectId(remainingOpen[0]?.id || null);
          }

          return true;
        } else {
          setError(result.error || "Failed to close project");
          return false;
        }
      } catch (err: any) {
        setError(err.message || "Failed to close project");
        return false;
      }
    },
    [activeProjectId, openProjects]
  );

  const switchProject = useCallback(
    (projectId: string) => {
      const project = projects.find((p) => p.id === projectId);
      if (project && project.isOpen) {
        setActiveProjectId(projectId);
      }
    },
    [projects]
  );

  const updateProject = useCallback(
    async (
      projectId: string,
      updates: UpdateProjectInput
    ): Promise<boolean> => {
      try {
        const result = await projectService.updateProject(projectId, updates);

        if (result.success && result.data) {
          setProjects((prev) =>
            prev.map((p) => (p.id === projectId ? result.data! : p))
          );
          return true;
        } else {
          setError(result.error || "Failed to update project");
          return false;
        }
      } catch (err: any) {
        setError(err.message || "Failed to update project");
        return false;
      }
    },
    []
  );

  const deleteProject = useCallback(
    async (projectId: string): Promise<boolean> => {
      try {
        const result = await projectService.deleteProject(projectId);

        if (result.success) {
          setProjects((prev) => prev.filter((p) => p.id !== projectId));

          // If deleting active project, switch to another
          if (activeProjectId === projectId) {
            const remainingOpen = openProjects.filter(
              (p) => p.id !== projectId
            );
            setActiveProjectId(remainingOpen[0]?.id || null);
          }

          return true;
        } else {
          setError(result.error || "Failed to delete project");
          return false;
        }
      } catch (err: any) {
        setError(err.message || "Failed to delete project");
        return false;
      }
    },
    [activeProjectId, openProjects]
  );

  const duplicateProject = useCallback(
    async (projectId: string): Promise<Project | null> => {
      try {
        const result = await projectService.duplicateProject(projectId);

        if (result.success && result.data) {
          const duplicated = result.data;
          setProjects((prev) => [...prev, duplicated]);
          setActiveProjectId(duplicated.id);
          return duplicated;
        } else {
          setError(result.error || "Failed to duplicate project");
          return null;
        }
      } catch (err: any) {
        setError(err.message || "Failed to duplicate project");
        return null;
      }
    },
    []
  );

  const exportProject = useCallback(
    async (projectId: string): Promise<boolean> => {
      try {
        const result = await projectService.exportProject(projectId);

        if (result.success && result.data) {
          const { blob, filename } = result.data;

          // Create download link
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          return true;
        } else {
          setError(result.error || "Failed to export project");
          return false;
        }
      } catch (err: any) {
        setError(err.message || "Failed to export project");
        return false;
      }
    },
    []
  );

  const importProject = useCallback(
    async (file: File, overwrite: boolean = false): Promise<Project | null> => {
      try {
        const result = overwrite
          ? await projectService.importProject(file, true)
          : await projectService.importProjectAsCopy(file);

        if (result.success && result.data) {
          const imported = result.data;

          setProjects((prev) => {
            const existing = prev.find((p) => p.id === imported.id);
            if (existing && overwrite) {
              return prev.map((p) => (p.id === imported.id ? imported : p));
            }
            return [...prev, imported];
          });

          setActiveProjectId(imported.id);
          return imported;
        } else {
          setError(result.error || "Failed to import project");
          return null;
        }
      } catch (err: any) {
        setError(err.message || "Failed to import project");
        return null;
      }
    },
    []
  );

  const searchProjects = useCallback(
    (query: string): Project[] => {
      if (!query.trim()) return projects;

      const lowerQuery = query.toLowerCase();
      return projects.filter(
        (project) =>
          project.info.name.toLowerCase().includes(lowerQuery) ||
          project.info.description.toLowerCase().includes(lowerQuery) ||
          project.info.tags.some((tag) =>
            tag.toLowerCase().includes(lowerQuery)
          )
      );
    },
    [projects]
  );

  const refreshProjects = useCallback(async () => {
    await loadProjects();
  }, [loadProjects]);

  const markProjectUnsaved = useCallback(
    (projectId: string, hasChanges: boolean) => {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId ? { ...p, hasUnsavedChanges: hasChanges } : p
        )
      );
    },
    []
  );

  // ==================== RETURN ====================

  return {
    // State
    projects,
    activeProjectId,
    activeProject,
    openProjects,
    recentProjects,
    loading,
    error,

    // Operations
    createProject,
    openProject,
    closeProject,
    switchProject,
    updateProject,
    deleteProject,
    duplicateProject,
    exportProject,
    importProject,
    searchProjects,

    // Utilities
    setActiveProjectId,
    refreshProjects,
    markProjectUnsaved,
  };
};

export default useProjects;
