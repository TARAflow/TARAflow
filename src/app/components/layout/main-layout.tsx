import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  CreateProjectInput,
  Project,
  ProjectMetadata,
} from "../../models/project-types";
import { ProjectSidebar } from "../project-sidebar";
import { PhaseTabs } from "../navigation/phase-tab-bar";
import { EmptyState } from "./empty-state-layout";
import { GeneralTab } from "features/overview";
import {
  DFDTab,
  DFDUpdateResult,
  DFDGraphAnalysisContext,
  DefaultDFDGraphBuilder,
} from "features/dfd";
import { AssetsTab, AssetUpdateResult } from "features/assets";
import {
  StrideMethod,
  ThreatData,
  ThreatsTab,
  type ThreatUpdateResult,
} from "features/threats";
import {
  resolveMitigationDrafts,
  resolveVerificationDrafts,
} from "features/threats/services/threat-catalog-service";
import { RisksTab, RiskUpdateResult, ThreatReference } from "features/risks";
import {
  AttackTreeTab,
  AttackTreeUpdateResult,
  extractAssetReferences,
  extractThreatReferencesForAttackTree,
  extractRiskReferences,
  extractDFDElementReferences,
  extractMitigationReferences,
} from "features/attacktree";
import { DocTab, DocUpdateResult } from "features/documentation";
import { IntegrationTab, type IntegrationTabData } from "features/integration";
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
import { projectService } from "../../services/project-service";
import storageService from "../../services/storage-service";
import { OpenProjectDialog } from "../dialogs/open-project-dialog";
import { UnsavedChangesDialog } from "../dialogs/unsaved-changes-dialog";
import { CloseProjectDialog } from "../dialogs/close-project-dialog";
import { PHASES } from "shared";
import { getPhaseStatusIcon, getPhaseStatusColor } from "shared";
import type { GeneralTabData, ProjectInfoData } from "features/overview";
import { AuditTab } from "features/audit";
import type { AuditUpdateResult } from "features/audit/models/audit-types";

import { transformProjectToDocData } from "app/services/doc-transform";
import { useTranslation } from "react-i18next";
import {
  type AssetDataReference,
  type DFDReference,
  Toast,
  ToastContainer,
  useToast,
} from "shared";
import { useAutoSave } from "../../hooks/use-auto-save";
import { useProjectFileDownload } from "../../hooks/use-project-file-download";
import { useProjectPersistence } from "../../hooks//use-project-persistence";
import { useBidirectionalAssetSync } from "../../hooks/use-bidirectional-asset-sync";
import {
  mapDFDAssetsToAssetFeature,
  mapDFDConnectionsToAssetFeature,
  mapDFDElementsToAssetFeature,
} from "../../utils/dfd-to-asset-mapper";

import { useControlInstanceDerivation } from "app/hooks/use-control-instance-derivation";
import { getAllMitigations } from "features/threats/services/threat-catalog-service";
import { useSecurityDrift } from "app/hooks/use-security-drift";

// ==================== MAIN LAYOUT ====================

export const MainLayout: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activePhase, setActivePhase] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [showOpenDialog, setShowOpenDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [pendingProjectId, setPendingProjectId] = useState<string | null>(null);
  const [projectToClose, setProjectToClose] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const MAX_OPEN_PROJECTS = 10;

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId),
    [projects, activeProjectId],
  );
  const openProjects = useMemo(
    () => projects.filter((p) => p.isOpen),
    [projects],
  );

  const [recentProjectsMetadata, setRecentProjectsMetadata] = useState<
    ProjectMetadata[]
  >([]);

  const { downloadProject } = useProjectFileDownload();
  const persistence = useProjectPersistence();

  console.log("Persistence mode:", persistence.mode);

  // ==================== GRAPH HELPER ====================
  // Ensures every loaded/opened/imported project has a computed DFD graph.
  // The graph is normally built in useDFDData on first DFD save — this ensures
  // it exists immediately so ThreatsTab is accessible without a prior DFD save.
  const ensureProjectGraph = (p: Project): Project => {
    if (p.dfd?.graph || !p.dfd?.elements?.length) return p;
    try {
      const graph = new DefaultDFDGraphBuilder().build(p.dfd);
      return { ...p, dfd: { ...p.dfd, graph } };
    } catch {
      return p;
    }
  };

  // ==================== LOAD RECENT PROJECTS ====================
  useEffect(() => {
    loadRecentProjects();
  }, []);

  const loadRecentProjects = async () => {
    const metadata = await storageService.getRecentFiles();
    setRecentProjectsMetadata(metadata);
  };

  // Called by OpenProjectDialog with the filePath already resolved by the
  // native dialog inside the dialog component. We must NOT open a second
  // dialog here — just read the file and register it.
  const handleOpenFromFile = async (filePath: string) => {
    try {
      const readResult = await (window as any).electron.file.readProject(
        filePath,
      );

      if (!readResult.success) {
        toast.error(`Failed to read file: ${readResult.error}`);
        return;
      }

      const raw = JSON.parse(readResult.data);
      const project = ensureProjectGraph({
        ...raw,
        filePath,
        isOpen: true,
        lastOpened: new Date().toISOString(),
        hasUnsavedChanges: false,
      });

      // Register in recent-projects.json so it appears in the sidebar.
      await storageService.updateRecentFile(project);

      setProjects((prev) => {
        const exists = prev.find((p) => p.id === project.id);
        return exists
          ? prev.map((p) => (p.id === project.id ? project : p))
          : [...prev, project];
      });
      setActiveProjectId(project.id);
      setActivePhase(project.currentPhase ?? 0);

      toast.success(`Project "${project.info.name}" opened!`);
      await loadRecentProjects();
    } catch (error: any) {
      toast.error(`Failed to open project: ${error.message}`);
    }
  };

  // Browser localStorage-fallback mode only.
  // In Electron mode this handler is not exposed (see OpenProjectDialog props).
  const handleImportFile = async (project: any) => {
    try {
      if (!project.id || !project.info) {
        throw new Error("Invalid project structure");
      }

      const projectWithGraph = ensureProjectGraph({
        ...project,
        isOpen: true,
        lastOpened: new Date().toISOString(),
      });

      // In localStorage fallback there is no real file — persistence adapter
      // silently succeeds. Still register metadata so it appears in recent list.
      await persistence.saveExistingProject(projectWithGraph);
      await storageService.updateRecentFile(projectWithGraph);

      setProjects((prev) => [...prev, projectWithGraph]);
      setActiveProjectId(projectWithGraph.id);
      setActivePhase(projectWithGraph.currentPhase || 0);

      await loadRecentProjects();
      toast.success(
        `Project "${projectWithGraph.info.name}" imported successfully!`,
      );
    } catch (error: any) {
      console.error("Failed to import project:", error);
      toast.error(`Failed to import project: ${error.message}`);
    }
  };

  // ==================== Setup Auto-Save ====================
  // Add after activeProject is available
  const toast = useToast();

  useAutoSave(
    activeProject ?? null,
    {
      enabled: activeProject?.settings.autoSave ?? true,
      interval: activeProject?.settings.autoSaveInterval ?? 2,
      onSuccess: (projectId) => {
        // Optional: Show subtle success indicator
        // toast.success('Project saved', 1000);
        console.log(`Auto-saved project ${projectId}`);
      },
      onError: (projectId, error) => {
        toast.error(`Auto-save failed: ${error}`);
      },
    },
    persistence,
  );

  // ==================== LOAD PROJECTS FROM STORAGE ====================

  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await storageService.getAllProjects();
      if (result.success && result.data) {
        // In Electron mode, getAllProjects() reads file content from disk but
        // does NOT include filePath (it reads from the file, not the metadata).
        // Inject filePath from the metadata registry so auto-save works.
        const recentFiles = await storageService.getRecentFiles();
        const filePathMap = new Map(recentFiles.map((f) => [f.id, f.filePath]));

        const validProjects = result.data
          .filter((p) => {
            const isValid = p && p.id && p.info && p.phaseStatus;
            if (!isValid) {
              console.warn("Skipping invalid project:", p?.id || "unknown");
              if (p?.id) storageService.deleteProject(p.id);
            }
            return isValid;
          })
          .map((p) => ({
            ...p,
            // Attach filePath so persistence adapter can write to the right file.
            filePath: p.filePath ?? filePathMap.get(p.id) ?? undefined,
          }));

        // Build computed graph for projects that have DFD elements.
        const projectsWithGraph = validProjects.map(ensureProjectGraph);
        setProjects(projectsWithGraph);

        // Restore active project (last open one).
        const firstOpen = projectsWithGraph.find((p) => p.isOpen);
        if (firstOpen) {
          setActiveProjectId(firstOpen.id);
          setActivePhase(firstOpen.currentPhase ?? 0);
        }

        if (validProjects.length < (result.data?.length || 0)) {
          toast.warning(
            `${result.data.length - validProjects.length} invalid project(s) were removed`,
          );
        }
      }
    } catch (error) {
      toast.error(`Error: ${error}` + " Failed to load projects from storage");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // ==================== SYNC HELPER ====================

  // Single save path for all project updates (DFD, assets, threats, etc.).
  // Uses persistence.saveExistingProject() so Electron writes to the linked
  // .tara.json file on disk. Falls back gracefully when no file is linked yet.
  const syncProjectToStorage = async (project: Project): Promise<boolean> => {
    const result = await persistence.saveExistingProject(project);
    if (!result.success) {
      toast.error(`Failed to save: ${result.error}`);
      return false;
    }
    // Keep metadata registry (recent-projects.json) in sync.
    await storageService.updateRecentFile(project);
    return true;
  };

  useBidirectionalAssetSync({
    project: activeProject,
    onUpdate: (updates) => {
      if (!activeProject) return;

      const updatedProject = {
        ...activeProject,
        ...updates,
        dfd: updates.dfd
          ? {
              ...activeProject.dfd,
              ...updates.dfd,
              // Preserve graph if it exists — do NOT throw if missing,
              // Assets→DFD name sync does not require a graph
              ...(activeProject.dfd?.graph
                ? { graph: activeProject.dfd.graph }
                : {}),
            }
          : activeProject.dfd,
        info: {
          ...activeProject.info,
          lastModified: new Date().toISOString(),
        },
      };

      updateProject(updatedProject);
    },
    enabled: true,
  });

  // ==================== PROJECT HANDLERS ====================

  const handleProjectOpen = async (projectId: string) => {
    // If already open in state, just switch to it.
    const existing = projects.find((p) => p.id === projectId);
    if (existing?.isOpen) {
      setActiveProjectId(projectId);
      setActivePhase(existing.currentPhase ?? 0);
      return;
    }

    // Load full project from disk using its filePath from the metadata registry.
    // The project object in state only carries metadata at this point — we need
    // the full file to get dfd, assets, threats, etc.
    const recentFiles = await storageService.getRecentFiles();
    const meta = recentFiles.find((f) => f.id === projectId);

    if (!meta?.filePath) {
      toast.error("Cannot open project: file path not found in registry");
      return;
    }

    try {
      const readResult = await (window as any).electron.file.readProject(
        meta.filePath,
      );

      if (!readResult.success) {
        toast.error(`Failed to read project file: ${readResult.error}`);
        return;
      }

      const now = new Date().toISOString();
      const raw = JSON.parse(readResult.data);
      const fullProject = ensureProjectGraph({
        ...raw,
        filePath: meta.filePath,
        isOpen: true,
        lastOpened: now,
        hasUnsavedChanges: false,
      });

      // Auto-close oldest if at limit
      if (openProjects.length >= MAX_OPEN_PROJECTS) {
        const oldest = [...openProjects].sort(
          (a, b) =>
            new Date(a.lastOpened || a.info?.lastModified || 0).getTime() -
            new Date(b.lastOpened || b.info?.lastModified || 0).getTime(),
        )[0];

        if (oldest) {
          const closedProject = { ...oldest, isOpen: false };
          await syncProjectToStorage(closedProject);
          setProjects((prev) =>
            prev.map((p) => (p.id === oldest.id ? closedProject : p)),
          );
          toast.warning(`Auto-closed "${oldest.info?.name}"`);
        }
      }

      // Write isOpen=true + lastOpened back to the file on disk.
      await syncProjectToStorage(fullProject);

      setProjects((prev) => {
        const exists = prev.find((p) => p.id === projectId);
        return exists
          ? prev.map((p) => (p.id === projectId ? fullProject : p))
          : [...prev, fullProject];
      });

      setActiveProjectId(projectId);
      setActivePhase(fullProject.currentPhase ?? 0);
    } catch (error: any) {
      toast.error(`Failed to open project: ${error.message}`);
    }
  };

  const handleProjectSwitch = (projectId: string) => {
    if (activeProject?.hasUnsavedChanges) {
      setPendingProjectId(projectId);
      setShowUnsavedDialog(true);
    } else {
      const newProject = projects.find((p) => p.id === projectId);
      setActiveProjectId(projectId);
      setActivePhase(newProject?.currentPhase || 0);
    }
  };

  const confirmProjectSwitch = async (save: boolean) => {
    if (save && activeProject) {
      const savedProject = { ...activeProject, hasUnsavedChanges: false };
      await syncProjectToStorage(savedProject);
      setProjects((prev) =>
        prev.map((p) => (p.id === activeProject.id ? savedProject : p)),
      );
      toast.success(`Project "${activeProject.info?.name}" saved`);
    }
    const newProject = projects.find((p) => p.id === pendingProjectId);
    setActiveProjectId(pendingProjectId);
    setActivePhase(newProject?.currentPhase || 0);
    setShowUnsavedDialog(false);
    setPendingProjectId(null);
  };

  const handleProjectClose = (projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;

    if (project.hasUnsavedChanges) {
      setProjectToClose(projectId);
      setShowCloseDialog(true);
    } else {
      closeProject(projectId);
    }
  };

  const closeProject = async (projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;

    const closedProject = { ...project, isOpen: false };
    await syncProjectToStorage(closedProject);

    setProjects(projects.map((p) => (p.id === projectId ? closedProject : p)));

    if (activeProjectId === projectId) {
      const remainingOpen = openProjects.filter((p) => p.id !== projectId);
      setActiveProjectId(remainingOpen[0]?.id || null);
      setActivePhase(remainingOpen[0]?.currentPhase || 0);

      // Clear file reference when closing
      persistence.clearCurrentFile(); // ← ADD THIS LINE
    }

    setShowCloseDialog(false);
    setProjectToClose(null);
    await loadRecentProjects();
  };

  const confirmProjectClose = async (save: boolean) => {
    if (save && projectToClose) {
      const project = projects.find((p) => p.id === projectToClose);
      if (project) {
        const savedProject = { ...project, hasUnsavedChanges: false };
        await syncProjectToStorage(savedProject);
        setProjects(
          projects.map((p) => (p.id === projectToClose ? savedProject : p)),
        );
        toast.success(`Project "${project.info?.name}" saved`);
      }
    }
    closeProject(projectToClose!);
  };

  // ==================== DELETE PROJECT ====================

  const handleDeleteRequest = (projectId: string) => {
    setProjectToDelete(projectId);
    setShowDeleteDialog(true);
  };

  const confirmDeleteProject = async () => {
    if (!projectToDelete) return;

    const project = projects.find((p) => p.id === projectToDelete);
    if (!project) return;

    const result = await storageService.deleteProject(projectToDelete);

    if (result.success) {
      // Remove from state
      const updatedProjects = projects.filter((p) => p.id !== projectToDelete);
      setProjects(updatedProjects);

      // If deleted project was active, switch to another
      if (activeProjectId === projectToDelete) {
        const remainingOpen = updatedProjects.filter((p) => p.isOpen);
        setActiveProjectId(remainingOpen[0]?.id || null);
        setActivePhase(remainingOpen[0]?.currentPhase || 0);
      }

      toast.success(`Project "${project.info?.name}" deleted`);
    } else {
      toast.error(`Failed to delete: ${result.error}`);
    }

    setShowDeleteDialog(false);
    setProjectToDelete(null);
  };

  // ==================== EXPORT PROJECT ====================

  const handleExportProject = async (projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) {
      toast.warning("Project not found");
      return;
    }

    try {
      // Use StorageService export method
      storageService.exportProjectAsJSON(project);
      toast.success(`Project "${project.info?.name}" exported`);
    } catch (error) {
      toast.error(`Export failed: ${error}`);
    }
  };

  // ==================== UPDATE PROJECT ====================

  const updateProject = async (updatedProject: Project) => {
    const now = new Date().toISOString();

    const projectWithChanges: Project = {
      ...updatedProject,
      info: {
        ...updatedProject.info,
        lastModified: now,
      },
      hasUnsavedChanges: true,
    };

    // Functional updater prevents stale-closure overwrites when multiple
    // handlers fire in quick succession (e.g. DFD + bidirectional asset sync).
    setProjects((prev) =>
      prev.map((p) => (p.id === updatedProject.id ? projectWithChanges : p)),
    );

    if (updatedProject.settings.autoSave) {
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
  };

  // ==================== SAVE PROJECT (Manual) ====================

  const handleSaveProject = async (projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;

    const now = new Date().toISOString();

    const savedProject: Project = {
      ...project,
      hasUnsavedChanges: false,
      info: {
        ...project.info,
        lastModified: now,
      },
    };

    const success = await syncProjectToStorage(savedProject);
    if (success) {
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? savedProject : p)),
      );
      toast.success(`Project "${project.info.name}" saved`);
    }
  };

  const handlePhaseChange = (phaseId: number) => {
    if (activeProject?.settings.strictMode) {
      const currentStatus =
        activeProject.phaseStatus[
          phaseId as keyof typeof activeProject.phaseStatus
        ];
      if (currentStatus === "not-started" && phaseId > 0) {
        const prevPhase =
          activeProject.phaseStatus[
            (phaseId - 1) as keyof typeof activeProject.phaseStatus
          ];
        if (prevPhase !== "complete") {
          toast.warning(
            "⚠️ Warning: Previous phase is not complete. Strict mode is enabled.",
          );
        }
      }
    }
    setActivePhase(phaseId);
    if (activeProject) {
      updateProject({ ...activeProject, currentPhase: phaseId });
    }
  };

  // ==================== GENERAL TAB DATA & HANDLER ====================

  const generalTabData: GeneralTabData | undefined = activeProject?.info
    ? {
        info: activeProject.info,
        settings: activeProject.settings,
        phaseStatus: activeProject.phaseStatus,
        dfdValidation: activeProject.dfd?.validation
          ? {
              valid: activeProject.dfd.validation.errors.length === 0,
              errors: activeProject.dfd.validation.errors,
              warnings: activeProject.dfd.validation.warnings,
            }
          : undefined,
      }
    : undefined;

  const handleGeneralTabUpdate = (data: GeneralTabData) => {
    if (!activeProject) return;

    const updatedProject: Project = {
      ...activeProject,
      info: data.info,
      settings: data.settings,
      phaseStatus: data.phaseStatus,
    };

    updateProject(updatedProject);
  };

  // ==================== DFD HANDLER ====================

  // Ref that always points to the current activeProject.
  // handleDFDUpdate uses this instead of closing over activeProject directly,
  // which would cause stale data to be written when the user switches projects
  // quickly while a DFD update is still in flight.
  const activeProjectRef = React.useRef<Project | undefined>(undefined);
  activeProjectRef.current = activeProject;

  const handleDFDUpdate = useCallback(
    async (updates: DFDUpdateResult) => {
      // Read from ref — guaranteed to be the project that is active RIGHT NOW,
      // not the one that was active when this callback was created.
      const current = activeProjectRef.current;
      if (!current) return;

      const graph = updates.dfd?.graph ?? current.dfd?.graph;
      if (!graph) {
        throw new Error(
          "[DFD] Invariant violation: graph must exist after DFD update",
        );
      }

      // Sync threat displayIds when DFD elements are renamed/renumbered.
      const syncedThreats = current.threats
        ? {
            ...current.threats,
            perInteractionTables: current.threats.perInteractionTables?.map(
              (table) => ({
                ...table,
                threats: table.threats.map((threat) => {
                  if (!threat.linkedElement) return threat;

                  const elem = updates.dfd?.elements?.find(
                    (e) => e.id === threat.linkedElement!.elementId,
                  );
                  if (!elem) return threat;

                  return {
                    ...threat,
                    linkedElement: {
                      ...threat.linkedElement,
                      displayId: elem.displayId,
                      elementName: elem.name,
                    },
                  };
                }),
              }),
            ),
          }
        : null;

      const updatedProject: Project = {
        ...current,
        dfd: {
          ...current.dfd,
          ...updates.dfd,
          graph,
        },
        phaseStatus: updates.phaseStatus,
        threats: syncedThreats,
      };

      await updateProject(updatedProject);
    },
    // Stable callback — never needs to be recreated because it reads the
    // current project via ref, not via closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ==================== Asset HANDLER ====================
  /**
   * Handle Assets tab updates
   * Converts AssetUpdateResult to full Project update
   */
  const handleAssetsUpdate = useCallback(
    async (updates: AssetUpdateResult) => {
      if (!activeProject) return;

      const updatedProject: Project = {
        ...activeProject,
        assets: updates.assets,
        phaseStatus: updates.phaseStatus,
      };

      await updateProject(updatedProject);
    },
    [activeProject],
  );

  // ==================== Threat HANDLER ====================
  /**
   * Handle Threats tab updates
   * Converts ThreatUpdateResult to full Project update
   */
  const handleThreatsUpdate = useCallback(
    async (updates: ThreatUpdateResult) => {
      if (!activeProject) return;

      const updatedProject: Project = {
        ...activeProject,
        threats: updates.threats,
        phaseStatus: updates.phaseStatus,
      };

      await updateProject(updatedProject);
    },
    [activeProject],
  );

  // ==================== Risk HANDLER ====================
  /**
   * Handle Risks tab updates
   * Converts RiskUpdateResult to full Project update
   */
  const handleRisksUpdate = useCallback(
    async (updates: RiskUpdateResult) => {
      if (!activeProject) return;

      const updatedProject: Project = {
        ...activeProject,
        risks: updates.risks,
        phaseStatus: updates.phaseStatus,
      };

      await updateProject(updatedProject);
    },
    [activeProject],
  );

  // ==================== Attack Tree HANDLER ====================
  const handleAttackTreeUpdate = useCallback(
    (updates: AttackTreeUpdateResult) => {
      if (!activeProject) return;

      const updatedProject: Project = {
        ...activeProject,
        attackTrees: updates.attackTrees,
        phaseStatus: updates.phaseStatus,
        info: {
          ...activeProject.info,
          lastModified: updates.lastModified, // beachte Hinweis unten
        },
      };

      updateProject(updatedProject);
    },
    [activeProject, updateProject],
  );

  // ==================== AUDIT TAB HANDLER ====================
  const handleAuditUpdate = useCallback(
    (updates: AuditUpdateResult) => {
      if (!activeProject) return;

      const updatedProject: Project = {
        ...activeProject,
        audit: updates.audit,
        phaseStatus: updates.phaseStatus,
        info: {
          ...activeProject.info,
          lastModified: updates.lastModified,
        },
      };

      updateProject(updatedProject);
    },
    [activeProject, updateProject],
  );

  const handleAuditDirtyChange = useCallback(
    (isDirty: boolean) => {
      if (!activeProject) return;

      const updatedProject: Project = {
        ...activeProject,
        hasUnsavedChanges: isDirty,
      };

      updateProject(updatedProject);
    },
    [activeProject, updateProject],
  );

  // ==================== Integration HANDLER ====================

  const handleIntegrationUpdate = (data: IntegrationTabData) => {
    if (!activeProject) return;

    const updatedProject: Project = {
      ...activeProject,
      integration: data.integration,
      hasUnsavedChanges: true,
    };

    updateProject(updatedProject);
  };

  // ==================== THREAT REFERENCE EXTRACTION ====================
  /**
   * Extract ThreatReferences from ThreatData for a specific STRIDE method
   *
   * IMPORTANT: Per-interaction threats store empty threatDescription and use
   * template localization. We use getEffectiveThreatDescription() to get the actual text.
   */
  const extractThreatReferences = (
    threatData: ThreatData | null | undefined,
    strideMethod: StrideMethod,
  ): ThreatReference[] => {
    if (!threatData) {
      return [];
    }

    // Select the correct threat tables based on method
    const tables =
      strideMethod === "per-element"
        ? threatData.perElementTables
        : threatData.perInteractionTables;

    if (!tables || tables.length === 0) {
      return [];
    }

    const references: ThreatReference[] = [];

    // Reverse index: elementId → assetIds
    // Source 1: asset.linkedDFDElements (explicit asset→element links)
    // Source 2: DFD element.assetRelations with relationType "is_an"
    const elementToAssetIds = new Map<string, string[]>();
    if (activeProject?.assets?.assets) {
      for (const asset of activeProject.assets.assets) {
        for (const el of asset.linkedDFDElements ?? []) {
          const ids = elementToAssetIds.get(el.elementId) ?? [];
          if (!ids.includes(asset.id)) ids.push(asset.id);
          elementToAssetIds.set(el.elementId, ids);
        }
      }
    }
    // is_an: DFD element is itself an asset (e.g. "Machine Operator" is_an "HU-001")
    const dfdElements = (activeProject?.dfd as any)?.elements ?? [];

    for (const el of dfdElements) {
      for (const rel of (el.assetRelations ?? []) as Array<{
        assetId: string;
        relationType: string;
      }>) {
        if (rel.relationType === "is_an") {
          const ids = elementToAssetIds.get(el.id) ?? [];
          if (!ids.includes(rel.assetId)) ids.push(rel.assetId);
          elementToAssetIds.set(el.id, ids);
        }
      }
    }

    for (const table of tables) {
      // Skip tables with no threats
      if (!table.threats || table.threats.length === 0) {
        continue;
      }

      for (const threat of table.threats) {
        // Extract element/dataflow name based on method
        let elementName: string | undefined;
        let dataFlowName: string | undefined;

        if (strideMethod === "per-element") {
          // Per-element: element info in linkedElement
          elementName =
            threat.linkedElement?.elementName ||
            threat.linkedElement?.elementId;
        } else {
          // Per-interaction: dataflow info in dataFlow
          dataFlowName = threat.dataFlow?.dataFlowName;
          // Can also use sourceName/targetName for display
          if (!dataFlowName && threat.dataFlow) {
            dataFlowName = `${threat.dataFlow.sourceName} → ${threat.dataFlow.targetName}`;
          }
        }

        // Get the effective threat description (handles template localization)
        // This is the same function used by ThreatTable
        // IMPORTANT: threatDescription is pre-filled by the generator at generate time.
        const threatDescription = threat.threatDescription;
        const attackDescription = threat.attackDescription;
        const causeDescription = threat.causeDescription;
        // Fallback: derive from assetDataRef when generator hasn't set linkedAssetIds yet
        const elementId =
          threat.linkedElement?.elementId ??
          threat.dataFlow?.connectionId ??
          threat.dataFlow?.fromElementId;

        const linkedAssetIds =
          (threat.linkedAssetIds?.length ?? 0) > 0
            ? threat.linkedAssetIds!
            : elementId
              ? (elementToAssetIds.get(elementId) ?? [])
              : [];

        references.push({
          id: threat.id,
          strideCategory: threat.strideCategory,
          threatDescription,
          attackDescription,
          causeDescription,
          linkedAssetIds,
          relevance: threat.relevance ?? "unrated",
          proposedMitigations: resolveMitigationDrafts(
            threat.proposedMitigations ?? [],
          ).map((m) => ({
            id: m.id,
            text: m.text,
            notes: m.notes,
            isCustom: m.isCustom,
          })),
          proposedVerifications: resolveVerificationDrafts(
            threat.proposedVerifications ?? [],
          ).map((v) => ({
            id: v.id,
            text: v.text,
            notes: v.notes,
            isCustom: v.isCustom,
          })),
          sourceStrideMethod: strideMethod,
          elementName,
          dataFlowName,
          trustBoundaryId: table.displayIdentifier,
          trustBoundaryName: table.trustBoundaryName,
        });
      }
    }

    return references;
  };

  // ==================== Documentation HANDLER ====================
  const handleDocUpdate = useCallback(
    (updates: DocUpdateResult) => {
      if (!activeProject) return;
      updateProject({
        ...activeProject,
        documentation: updates.documentation,
        phaseStatus: updates.phaseStatus,
      });
    },
    [activeProject],
  );

  // ==================== NEW/IMPORT HANDLERS ====================

  const handleNewProject = () => {
    setShowNewDialog(true);
  };

  const handleImportProject = () => {
    setShowImportDialog(true);
  };

  // ==================== MEMOIZED DFD DATA ====================
  // Prevent unnecessary re-renders by memoizing mapped DFD data
  // These only change when activeProject.dfd content actually changes

  /**
   * Stable project object for DFDTab.
   * Without this, the inline object literal in JSX creates a new reference
   * on every render of main-layout → useDFDEditor resets → DFDToolbar remounts
   * → 242 Popper resize listeners accumulate.
   * Dependencies are primitive IDs and stable sub-object references only.
   */
  const dfdTabProject = useMemo(
    () =>
      activeProject
        ? {
            id: activeProject.id,
            name: activeProject.info?.name ?? "",
            dfd: activeProject.dfd ?? null,
            phaseStatus: activeProject.phaseStatus,
            settings: activeProject.settings,
            lastModified: activeProject.info?.lastModified ?? "",
          }
        : null,
    // Use lastModified as a proxy for dfd content changes.
    // Avoids triggering remount on every setProjects() call where
    // the dfd object reference changes but content is identical.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      activeProject?.id,
      activeProject?.info?.name,
      activeProject?.info?.lastModified,
      activeProject?.dfd?.lastModified,
      activeProject?.phaseStatus,
      activeProject?.settings,
    ],
  );

  const memoizedDFDAssets = useMemo(() => {
    return activeProject?.dfd?.assets
      ? mapDFDAssetsToAssetFeature(activeProject.dfd.assets)
      : undefined;
  }, [activeProject?.dfd?.assets]);

  const memoizedDFDElements = useMemo(() => {
    return activeProject?.dfd?.elements
      ? mapDFDElementsToAssetFeature(activeProject.dfd.elements)
      : undefined;
  }, [activeProject?.dfd?.elements]);

  const memoizedDFDConnections = useMemo(() => {
    return activeProject?.dfd?.connections
      ? mapDFDConnectionsToAssetFeature(activeProject.dfd.connections)
      : undefined;
  }, [activeProject?.dfd?.connections]);

  const memoizedDFDContext = useMemo(() => {
    if (!activeProject?.dfd?.graph) return null;
    return new DFDGraphAnalysisContext(activeProject.dfd.graph);
  }, [activeProject?.dfd?.graph]);

  // Mitigation catalog is a module-level singleton — stable reference,
  // no need to memoize separately.
  const mitigationCatalog = getAllMitigations();

  const controlInstances = useControlInstanceDerivation(
    activeProject?.threats ?? null,
    activeProject?.risks ?? null,
    activeProject?.dfd ?? null,
    mitigationCatalog,
  );

  const securityDrifts = useSecurityDrift(
    controlInstances,
    activeProject?.dfd ?? null,
  );

  // ==================== MEMOIZED DFD DATA ====================
  const memoizedDFDReference = useMemo((): DFDReference | null => {
    const dfd = activeProject?.dfd;
    if (!dfd) return null;
    return {
      // Phase 3: process elements with safety annotations for Safety factor auto-enable
      processes: dfd.elements
        ?.filter((e) => e.type === "Process" || e.type === "Multiprocess")
        .map((e) => ({
          id: e.id,
          label: e.name ?? e.id,
          safetyAnnotation: (e.properties as any)?.safetyAnnotation
            ? {
                severity: (e.properties as any).safetyAnnotation.severity,
                description: (e.properties as any).safetyAnnotation.description,
              }
            : undefined,
        })),
      elements: dfd.elements?.map((e) => ({
        id: e.id,
        properties: e.properties as Record<string, unknown>,
      })),
      connections: dfd.connections?.map((c) => ({
        id: c.id,
        properties: c.properties as Record<string, unknown>,
      })),
    };
  }, [activeProject?.dfd]);

  // ==================== MEMOIZED THREAT DATA ====================

  const memoizedAssetDataRef = useMemo((): AssetDataReference | undefined => {
    const assets = activeProject?.assets?.assets;
    if (!assets || assets.length === 0) return undefined;

    const assetRefs = assets.map((a) => ({
      id: a.id,
      name: a.name,
      assetGroup: a.assetGroup,
      aggregatedImpact: a.aggregatedImpact,
      physicalImpact: a.physicalImpact,
      isHighValueAsset: a.properties?.isHighValueAsset,
      hasSafetyAnnotation:
        a.linkedDFDElements?.some(
          (el) => (el as any).safety && (el as any).safety.relevance !== "none",
        ) ?? false,
      linkedElementIds: a.linkedDFDElements?.map((el) => el.elementId) ?? [],
      // Only active goals (level !== "none") — used by RelationStrategy
      securityGoals:
        a.securityGoals
          ?.filter((g) => g.level !== "none")
          .map((g) => ({ type: g.type, level: g.level })) ?? [],
      // Phase 3: per-criterion impact ratings for 1:1 factor prefill in Risk Tab
      impactRatings:
        a.impactRatings?.map((r) => ({
          criterionId: r.criterionId,
          value: r.value,
        })) ?? [],
    }));

    const hasSafetyAssets = assetRefs.some(
      (a) => a.physicalImpact !== undefined || a.hasSafetyAnnotation,
    );

    return {
      assets: assetRefs,
      hasSafetyAssets,
      // Phase 3: asset impact scale for normalisation when scale ≠ risk scale
      impactScale:
        activeProject?.assets?.configuration?.impactScale ?? "4-level",
    };
  }, [
    activeProject?.assets?.assets,
    activeProject?.assets?.configuration?.impactScale,
  ]);

  // ==================== RENDER ====================

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading projects...</div>
      </div>
    );
  }

  return (
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

      {/* Toast Notification */}
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />

      {/* Sidebar */}
      <ProjectSidebar
        projects={projects}
        activeProjectId={activeProjectId}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onProjectSelect={handleProjectSwitch}
        onProjectClose={handleProjectClose}
        onProjectOpen={handleProjectOpen}
        onProjectDelete={handleDeleteRequest}
        onProjectExport={handleExportProject}
        onProjectSave={handleSaveProject}
        onNewProject={handleNewProject}
        onImportProject={handleImportProject}
        onOpenDialog={() => setShowOpenDialog(true)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeProject && generalTabData ? (
          <>
            {/* Phase Tabs */}
            <PhaseTabs
              project={activeProject}
              activePhase={activePhase}
              onPhaseChange={handlePhaseChange}
            />

            {/* Main Workspace */}
            <div className="flex-1 overflow-y-auto">
              {activePhase === 0 && (
                <GeneralTab
                  data={generalTabData}
                  phases={PHASES}
                  getStatusIcon={getPhaseStatusIcon}
                  getStatusColor={getPhaseStatusColor}
                  onUpdate={handleGeneralTabUpdate}
                />
              )}
              {/* DFDTab is always mounted when a project is open to prevent
                  draw.io iframe reload and Popper listener leaks on tab switch.
                  CSS display:none hides it without unmounting. */}
              {activeProject && dfdTabProject && (
                <div
                  style={{
                    display: activePhase === 1 ? "flex" : "none",
                    flexDirection: "column",
                    height: "100%",
                  }}
                >
                  <DFDTab
                    project={dfdTabProject}
                    onUpdate={handleDFDUpdate}
                    controlInstances={controlInstances}
                    securityDrifts={securityDrifts}
                  />
                </div>
              )}
              {activePhase === 2 && activeProject && (
                <AssetsTab
                  project={{
                    id: activeProject.id,
                    name: activeProject.info?.name || "",
                    assets: activeProject.assets ?? null,
                    phaseStatus: activeProject.phaseStatus,

                    // Use memoized DFD data (stable references)
                    dfdAssets: memoizedDFDAssets,
                    dfdElements: memoizedDFDElements,
                    dfdConnections: memoizedDFDConnections,

                    dfdPreviewImage: activeProject.dfd?.thumbnail,
                    lastModified: activeProject.info?.lastModified || "",
                  }}
                  onUpdate={handleAssetsUpdate}
                />
              )}
              {activePhase === 3 && activeProject && memoizedDFDContext && (
                <ThreatsTab
                  project={{
                    id: activeProject.id,
                    name: activeProject.info?.name || "",
                    threats: activeProject.threats ?? null,
                    phaseStatus: activeProject.phaseStatus,
                    dfdXml: activeProject.dfd?.xml,
                    dfdElements: activeProject.dfd?.elements || [],
                    dfdConnections: activeProject.dfd?.connections,
                    dfdPreviewImage: activeProject.dfd?.thumbnail,
                    assetIds: activeProject.assets?.assets?.map((a) => a.id),
                    lastModified: activeProject.info?.lastModified || "",
                    dfdGraph: activeProject.dfd?.graph,
                    assetDataRef: memoizedAssetDataRef,
                    dfd: memoizedDFDReference,
                  }}
                  dfdContext={memoizedDFDContext}
                  onUpdate={handleThreatsUpdate}
                />
              )}
              {activePhase === 4 && activeProject && (
                <RisksTab
                  project={{
                    id: activeProject.id,
                    name: activeProject.info?.name || "",
                    risks: activeProject.risks ?? null,
                    phaseStatus: activeProject.phaseStatus,
                    perElementThreats: extractThreatReferences(
                      activeProject.threats,
                      "per-element",
                    ),
                    perInteractionThreats: extractThreatReferences(
                      activeProject.threats,
                      "per-interaction",
                    ),
                    assetDataRef: memoizedAssetDataRef,
                    // Phase 3: DFD snapshot for Safety annotation detection
                    dfd: memoizedDFDReference,
                    dfdPreviewImage: activeProject.dfd?.thumbnail,
                    // Integration connection for Jira ticket linking
                    integration: activeProject.integration
                      ? {
                          connection: {
                            tool:
                              activeProject.integration.connection?.tool ??
                              "jira",
                            status:
                              activeProject.integration.connection?.status ??
                              "disconnected",
                            projectName:
                              activeProject.integration.connection?.projectName,
                            credentials: activeProject.integration.connection
                              ?.credentials as any,
                          },
                        }
                      : null,
                    lastModified: activeProject.info?.lastModified || "",
                  }}
                  onUpdate={handleRisksUpdate}
                  onPhaseComplete={() => setActivePhase(5)}
                />
              )}
              {/* AttackTreeTab permanently mounted to prevent AttackTreePreview
                  from unmounting on tab switch — each unmount+mount registers
                  a new window resize listener causing listener accumulation. */}
              {activeProject && (
                <div
                  style={{
                    display: activePhase === 5 ? "flex" : "none",
                    flexDirection: "column",
                    height: "100%",
                  }}
                >
                  <AttackTreeTab
                    project={{
                      id: activeProject.id,
                      name: activeProject.info?.name || "",
                      phaseStatus: activeProject.phaseStatus,
                      isHighImpact: activeProject.info?.isHighImpact || false,
                      attackTrees: activeProject.attackTrees,
                      assets: extractAssetReferences(activeProject),
                      threats:
                        extractThreatReferencesForAttackTree(activeProject),
                      risks: extractRiskReferences(activeProject),
                      dfdElements: extractDFDElementReferences(activeProject),
                      mitigations: extractMitigationReferences(activeProject),
                      dfdPreviewImage: activeProject.dfd?.thumbnail,
                      lastModified: activeProject.info?.lastModified || "",
                    }}
                    onUpdate={handleAttackTreeUpdate}
                    onPhaseComplete={() => setActivePhase(6)}
                  />
                </div>
              )}
              {activePhase === 6 && activeProject && (
                <DocTab
                  project={transformProjectToDocData(
                    activeProject,
                    i18n.language === "de" ? "de" : "en",
                  )}
                  onUpdate={handleDocUpdate}
                />
              )}
              {activePhase === 7 && activeProject && (
                <AuditTab
                  project={{
                    id: activeProject.id,
                    name: activeProject.info?.name || "",
                    audit: activeProject.audit,
                    phaseStatus: activeProject.phaseStatus,

                    // Full project snapshot for change detection
                    info: activeProject.info,
                    dfd: activeProject.dfd,
                    assets: activeProject.assets,
                    threats: activeProject.threats,
                    risks: activeProject.risks,
                    attackTrees: activeProject.attackTrees,

                    lastModified: activeProject.info?.lastModified || "",
                  }}
                  onUpdate={handleAuditUpdate}
                  onDirtyChange={handleAuditDirtyChange}
                  onPhaseComplete={() => {
                    console.log("Audit phase completed");
                  }}
                />
              )}
              {activePhase === 8 && activeProject && (
                <IntegrationTab
                  data={{
                    integration: activeProject.integration ?? null,
                  }}
                  onUpdate={handleIntegrationUpdate}
                />
              )}
            </div>
          </>
        ) : (
          <EmptyState onOpenProject={() => setShowOpenDialog(true)} />
        )}
      </div>

      {/* Dialogs */}
      {showOpenDialog && (
        <OpenProjectDialog
          recentProjects={recentProjectsMetadata}
          onOpen={handleProjectOpen}
          onOpenFile={handleOpenFromFile} // Now unified for all modes!
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

      {/* Delete Confirmation Dialog */}
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
            // Step 1: Build project object only — no save yet.
            // projectService.createProject() is now synchronous and
            // does NOT write to storage or open any dialog.
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

            // Step 2: Apply tags — data.tags comes from the dialog form.
            // data.filePath is NOT set here — new-project-dialog no longer
            // opens the save dialog itself; main-layout owns that.
            const projectWithTags: Project = {
              ...result.data,
              info: { ...result.data.info, tags: data.tags },
            };

            // Step 3: Show native save dialog and write to filesystem.
            // This is the ONE AND ONLY save dialog call for a new project.
            // new-project-dialog must not call electron.file.saveDialog()
            // because that would open a second dialog before this one.
            const saveResult =
              await persistence.saveNewProject(projectWithTags);

            if (!saveResult.success) {
              if (saveResult.error !== "Save canceled") {
                toast.error(`Failed to save: ${saveResult.error}`);
              }
              // Stay in dialog only if user canceled — close on real errors.
              if (saveResult.error !== "Save canceled") {
                setShowNewDialog(false);
              }
              return;
            }

            // Step 4: Attach the resolved filePath so auto-save can find the
            // file immediately without needing another dialog.
            const savedProject: Project = {
              ...projectWithTags,
              filePath: saveResult.data?.filePath ?? projectWithTags.filePath,
            };

            // Step 5: Register in recent-projects.json (Electron) or
            // localStorage (browser fallback).
            await storageService.updateRecentFile(savedProject);

            // Step 6: Update React state and close dialog.
            setProjects((prev) => [...prev, savedProject]);
            setActiveProjectId(savedProject.id);
            setActivePhase(0);
            setShowNewDialog(false);

            toast.success(`Project "${savedProject.info.name}" created!`);
          }}
          onClose={() => setShowNewDialog(false)}
        />
      )}

      {/* Import Project Dialog */}
      {showImportDialog && (
        <ImportProjectDialog
          onImport={async (
            file: File,
            options: ImportOptions,
          ): Promise<ImportResult> => {
            const result = await storageService.importProjectFromJSON(file);
            if (result.success && result.data) {
              setProjects([...projects, result.data]);
              setActiveProjectId(result.data.id);
              setActivePhase(0);
              toast.success(`Project "${result.data.info?.name}" imported!`);
              return {
                success: true,
                projectId: result.data.id,
                projectName: result.data.info?.name || "",
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
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            Linked to local file - auto-save enabled
          </div>
        )}

      {/* Toast Container - ALWAYS at the end */}
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  );
};

export default MainLayout;