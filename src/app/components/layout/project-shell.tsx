// ==================== PROJECT SHELL ====================
// Single Responsibility: manage the project list, provide ProjectContext,
// render the sidebar and all project-level dialogs.
//
// What lives here:
//   - useProjectManager (all project state + operations)
//   - ProjectContext.Provider
//   - ProjectSidebar
//   - All project dialogs (New, Open, Import, Delete, Close, Unsaved)
//   - Project lifecycle: open, close, switch, delete, export
//
// What does NOT live here:
//   - Feature tab rendering (WorkspaceLayout)
//   - Tab-specific handlers (WorkspaceLayout)
//   - DFD / Asset / Threat data (feature tabs)

import React, { useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Toast, ToastContainer, useToast } from "shared";
import type { Project } from "../../models/project-types";

import { ProjectContext } from "../../contexts/project-context";
import { useProjectManager } from "../../hooks/use-project-manager";

import { ProjectSidebar } from "../project-sidebar";
import { WorkspaceLayout } from "./workspace-layout";
import { EmptyState } from "./empty-state-layout";

import {
  NewProjectDialog,
  NewProjectData,
} from "../dialogs/new-project-dialog";
import {
  ImportProjectDialog,
  ImportOptions,
  ImportResult,
} from "../dialogs/import-project-dialog";
import { DeleteProjectDialog } from "../dialogs/delete-project-dialog";
import { OpenProjectDialog } from "../dialogs/open-project-dialog";
import { UnsavedChangesDialog } from "../dialogs/unsaved-changes-dialog";
import { CloseProjectDialog } from "../dialogs/close-project-dialog";

import { projectService } from "../../services/project-service";
import { projectRegistry } from "../../services/project-registry";
import storageService from "../../services/storage-service";
import { projectRepository } from "../../services/project-repository";

// ==================== COMPONENT ====================

export const ProjectShell: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();

  const manager = useProjectManager();

  const {
    projects,
    activeProject,
    activeProjectId,
    openProjects,
    recentProjectsMetadata,
    isLoading,
    activePhase,
    setActivePhase,
    updateProject,
    closeProject,
    deleteProject,
    activateProject,
    syncProjectToStorage,
    switchProject,
    saveProject,
    loadRecentProjects,
    handleOpenFromFile,
    handleImportFile,
    persistence,
    downloadProject,
  } = manager;

  // ── Dialog state ──────────────────────────────────────────────────────────

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showOpenDialog, setShowOpenDialog] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [pendingProjectId, setPendingProjectId] = useState<string | null>(null);
  const [projectToClose, setProjectToClose] = useState<string | null>(null);

  // ── Project switch with unsaved check ────────────────────────────────────

  const handleProjectSwitch = useCallback(
    (projectId: string) => {
      if (activeProject?.hasUnsavedChanges) {
        setPendingProjectId(projectId);
        setShowUnsavedDialog(true);
      } else {
        switchProject(projectId);
      }
    },
    [activeProject?.hasUnsavedChanges, switchProject],
  );

  const confirmProjectSwitch = useCallback(
    async (save: boolean) => {
      if (save && activeProject) {
        await saveProject(activeProject.id);
      }
      if (pendingProjectId) {
        // NOTE: switchProject no-ops if the target isn't isOpen (a guard
        // the old inline version didn't have). Every pendingProjectId here
        // comes from handleProjectSwitch, which is only ever invoked with
        // ids from the currently-open sidebar list — so this is stricter
        // in theory, not in observed practice. Flagging in case a future
        // caller of handleProjectSwitch passes a closed project's id.
        switchProject(pendingProjectId);
      }
      setShowUnsavedDialog(false);
      setPendingProjectId(null);
    },
    [activeProject, pendingProjectId, saveProject, switchProject],
  );

  // ── Project open (from recent list) ──────────────────────────────────────

  const handleProjectOpen = useCallback(
    async (projectId: string) => {
      const existing = projects.find((p) => p.id === projectId);
      if (existing?.isOpen) {
        switchProject(projectId);
        return;
      }

      const loadResult = await projectRepository.loadById(projectId);
      if (!loadResult.success || !loadResult.data) {
        toast.error(`Cannot open project: ${loadResult.error}`);
        return;
      }

      try {
        const now = new Date().toISOString();
        const { _migrated, _fromVersion, ...rawLoaded } =
          loadResult.data as any;

        const fullProject = {
          ...rawLoaded,
          isOpen: true,
          lastOpened: now,
          hasUnsavedChanges: false,
        };

        if (_migrated) {
          toast.success(
            `Project "${fullProject.info.name}" was migrated from schema v${_fromVersion}. ` +
              `A backup of the original file was saved alongside it.`,
          );
        }

        // Auto-close oldest if at limit
        const MAX_OPEN = 10;
        if (openProjects.length >= MAX_OPEN) {
          const oldest = [...openProjects].sort(
            (a, b) =>
              new Date(a.lastOpened || a.info?.lastModified || 0).getTime() -
              new Date(b.lastOpened || b.info?.lastModified || 0).getTime(),
          )[0];

          if (oldest) {
            await closeProject(oldest.id);
            toast.warning(`Auto-closed "${oldest.info?.name}"`);
          }
        }

        // syncProjectToStorage already toasts on failure internally (see
        // use-project-manager.ts) — gate activation on its result so a
        // failed write doesn't leave the UI showing an "opened" project
        // that never actually landed on disk. Matches the discipline
        // closeProject/deleteProject/saveProject already follow; this was
        // the one inconsistent holdout (see
        // project-shell.lifecycle-characterization.test.tsx, "Gap #3").
        const success = await syncProjectToStorage(fullProject);
        if (!success) return;
        activateProject(fullProject);
      } catch (error: any) {
        toast.error(`Failed to open project: ${error.message}`);
      }
    },
    [
      activateProject,
      closeProject,
      openProjects,
      projects,
      switchProject,
      syncProjectToStorage,
      toast,
    ],
  );

  // ── Project close ─────────────────────────────────────────────────────────

  const closeProjectAndRefresh = useCallback(
    async (projectId: string) => {
      await closeProject(projectId);
      await loadRecentProjects();
    },
    [closeProject, loadRecentProjects],
  );

  const handleProjectClose = useCallback(
    (projectId: string) => {
      const project = projects.find((p) => p.id === projectId);
      if (!project) return;

      if (project.hasUnsavedChanges) {
        setProjectToClose(projectId);
        setShowCloseDialog(true);
      } else {
        void closeProjectAndRefresh(projectId);
      }
    },
    [closeProjectAndRefresh, projects],
  );

  const confirmProjectClose = useCallback(
    async (save: boolean) => {
      if (!projectToClose) return;
      // closeProject persists hasUnsavedChanges:false in its own single
      // write now — nothing left to save separately here.
      if (save) {
        const project = projects.find((p) => p.id === projectToClose);
        toast.success(`Project "${project?.info?.name}" saved`);
      }
      await closeProjectAndRefresh(projectToClose);
      setShowCloseDialog(false);
      setProjectToClose(null);
    },
    [closeProjectAndRefresh, projectToClose, projects, toast],
  );

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDeleteRequest = useCallback((projectId: string) => {
    setProjectToDelete(projectId);
    setShowDeleteDialog(true);
  }, []);

  const confirmDeleteProject = useCallback(async () => {
    if (!projectToDelete) return;
    await deleteProject(projectToDelete);
    setShowDeleteDialog(false);
    setProjectToDelete(null);
  }, [deleteProject, projectToDelete]);

  // ── Export ────────────────────────────────────────────────────────────────

  const handleExportProject = useCallback(
    (projectId: string) => {
      const project = projects.find((p) => p.id === projectId);
      if (!project) {
        toast.warning("Project not found");
        return;
      }
      try {
        storageService.exportProjectAsJSON(project);
        toast.success(`Project "${project.info?.name}" exported`);
      } catch (error) {
        toast.error(`Export failed: ${error}`);
      }
    },
    [projects, toast],
  );

  // ── Context value ─────────────────────────────────────────────────────────
  // Memoized so WorkspaceLayout and other consumers only re-render when
  // values they actually use change — not on every ProjectShell render.

  const contextValue = React.useMemo(
    () => ({
      projects,
      activeProject,
      activeProjectId,
      openProjects,
      recentProjectsMetadata,
      isLoading,
      activePhase,
      setActivePhase,
      updateProject,
      switchProject: handleProjectSwitch,
      saveProject,
    }),
    [
      projects,
      activeProject,
      activeProjectId,
      openProjects,
      recentProjectsMetadata,
      isLoading,
      activePhase,
      setActivePhase,
      updateProject,
      handleProjectSwitch,
      saveProject,
    ],
  );

  // ── Loading screen ────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading projects...</div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <ProjectContext.Provider value={contextValue}>
      <div className="flex h-screen bg-gray-50">
        <style>
          {`
            @keyframes slide-in {
              from { transform: translateX(100%); opacity: 0; }
              to { transform: translateX(0); opacity: 1; }
            }
            .animate-slide-in {
              animation: slide-in 0.3s ease-out;
            }
          `}
        </style>

        <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />

        <ProjectSidebar
          projects={projects}
          activeProjectId={activeProjectId}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
          onProjectSelect={handleProjectSwitch}
          onProjectClose={handleProjectClose}
          onProjectOpen={handleProjectOpen}
          onProjectDelete={handleDeleteRequest}
          onProjectExport={handleExportProject}
          onProjectSave={saveProject}
          onNewProject={() => setShowNewDialog(true)}
          onImportProject={() => setShowImportDialog(true)}
          onOpenDialog={() => setShowOpenDialog(true)}
        />

        <div className="flex-1 flex flex-col overflow-hidden">
          {activeProject ? (
            <WorkspaceLayout />
          ) : (
            <EmptyState onOpenProject={() => setShowOpenDialog(true)} />
          )}
        </div>

        {/* ── Dialogs ──────────────────────────────────────────────────── */}

        {showOpenDialog && (
          <OpenProjectDialog
            recentProjects={recentProjectsMetadata}
            onOpen={handleProjectOpen}
            onOpenFile={handleOpenFromFile}
            onImportFile={
              persistence.mode === "localStorage" ? handleImportFile : undefined
            }
            onClose={() => setShowOpenDialog(false)}
          />
        )}

        {showUnsavedDialog && activeProject && (
          <UnsavedChangesDialog
            projectName={activeProject.info?.name || ""}
            onSave={() => confirmProjectSwitch(true)}
            onDiscard={() => confirmProjectSwitch(false)}
            onCancel={() => setShowUnsavedDialog(false)}
          />
        )}

        {showCloseDialog && projectToClose && (
          <CloseProjectDialog
            projectName={
              projects.find((p) => p.id === projectToClose)?.info?.name || ""
            }
            onSave={() => confirmProjectClose(true)}
            onDiscard={() => confirmProjectClose(false)}
            onCancel={() => setShowCloseDialog(false)}
          />
        )}

        {showDeleteDialog && projectToDelete && (
          <DeleteProjectDialog
            itemName={
              projects.find((p) => p.id === projectToDelete)?.info?.name || ""
            }
            itemType="project"
            onConfirm={confirmDeleteProject}
            onCancel={() => {
              setShowDeleteDialog(false);
              setProjectToDelete(null);
            }}
          />
        )}

        {showNewDialog && (
          <NewProjectDialog
            onCreate={async (data: NewProjectData) => {
              const result = projectService.createProject({
                name: data.name,
                description: data.description,
                version: data.version,
                responsible: data.responsible,
                isHighImpact: data.isHighImpact,
              });

              if (!result.success || !result.data) {
                toast.error(`Failed to create project: ${result.error}`);
                setShowNewDialog(false);
                return;
              }

              const projectWithTags: Project = {
                ...result.data,
                info: {
                  ...result.data.info,
                  tags: data.tags,
                  safetyRelevant: data.safetyRelevant ?? false,
                },
              };

              const saveResult =
                await persistence.saveNewProject(projectWithTags);

              if (!saveResult.success) {
                if (saveResult.error !== "Save canceled") {
                  toast.error(`Failed to save: ${saveResult.error}`);
                  setShowNewDialog(false);
                }
                return;
              }

              const savedProject: Project = {
                ...projectWithTags,
                filePath: saveResult.data?.filePath ?? projectWithTags.filePath,
              };

              await projectRegistry.upsert(savedProject);

              activateProject(savedProject);
              setShowNewDialog(false);
              toast.success(`Project "${savedProject.info.name}" created!`);
            }}
            onClose={() => setShowNewDialog(false)}
          />
        )}

        {showImportDialog && (
          <ImportProjectDialog
            onImport={async (
              file: File,
              _options: ImportOptions,
            ): Promise<ImportResult> => {
              const result = await projectService.importProjectAsCopy(file);
              if (result.success && result.data) {
                // Route through the SAME pipeline handleOpenFromFile and
                // direct-file imports use — ensureProjectGraph,
                // commitAssetSync, commitProjectSafety — which
                // importProjectAsCopy alone never applied (see
                // import-path-parity.test.ts). handleImportFile also owns
                // persistence (saveExistingProject + registry upsert) and
                // its own success toast now, so this handler no longer
                // duplicates either.
                const { id, info } = result.data;
                await handleImportFile(result.data);
                return {
                  success: true,
                  projectId: id,
                  projectName: info?.name || "",
                };
              } else {
                toast.error(`Import failed: ${result.error}`);
                return {
                  success: false,
                  errors: [result.error || "Unknown error"],
                };
              }
            }}
            onClose={() => setShowImportDialog(false)}
          />
        )}

        {persistence.mode === "file-system-access" &&
          persistence.hasFileReference && (
            <div className="fixed bottom-4 left-4 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700 flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Linked to local file — auto-save enabled
            </div>
          )}
      </div>
    </ProjectContext.Provider>
  );
};