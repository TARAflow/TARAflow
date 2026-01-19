import React, { useState, useEffect, useCallback } from "react";
import {
  CreateProjectInput,
  Project,
  ProjectMetadata,
} from "../../models/project-types";
import { ProjectSidebar } from "../project-sidebar";
import { PhaseTabs } from "../navigation/phase-tab-bar";
import { EmptyState } from "./empty-state-layout";
import { GeneralTab } from "features/overview";
import { DFDTab, DFDUpdateResult } from "features/dfd";
import { AssetsTab, AssetUpdateResult } from "features/assets";
import {
  StrideMethod,
  ThreatData,
  ThreatsTab,
  getEffectiveThreatDescription,
  getEffectiveAttackDescription,
  getSuggestedMitigations,
  type ThreatUpdateResult,
} from "features/threats";
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
import { Toast, ToastContainer, useToast } from "shared";
import { useAutoSave } from "../../hooks/use-auto-save";
import { useProjectFileDownload } from "../../hooks/use-project-file-download";
import { useProjectPersistence } from "../../hooks//use-project-persistence";
import {
  mapDFDAssetsToAssetFeature,
  mapDFDConnectionsToAssetFeature,
  mapDFDElementsToAssetFeature,
} from "../../utils/dfd-to-asset-mapper";

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

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const openProjects = projects.filter((p) => p.isOpen);

  const [recentProjectsMetadata, setRecentProjectsMetadata] = useState<
    ProjectMetadata[]
  >([]);

  const { downloadProject } = useProjectFileDownload();
  const persistence = useProjectPersistence();

  console.log("Persistence mode:", persistence.mode);

  // ==================== LOAD RECENT PROJECTS ====================
  useEffect(() => {
    loadRecentProjects();
  }, []);

  const loadRecentProjects = async () => {
    const metadata = await storageService.getRecentFiles();
    setRecentProjectsMetadata(metadata);
  };

  // STEP 3: Add handler for opening from file (add near other handlers)
  const handleOpenFromFile = async () => {
    const result = await persistence.openProject();

    if (result.success && result.data?.project) {
      const project = result.data.project;

      // Save to localStorage (for metadata)
      await storageService.saveProject(project);

      setProjects([...projects, project]);
      setActiveProjectId(project.id);
      setActivePhase(project.currentPhase);

      if (persistence.mode === "file-system-access") {
        toast.success(
          `Project "${project.info.name}" opened and linked to file!`,
        );
      } else {
        toast.success(`Project "${project.info.name}" opened!`);
      }

      await loadRecentProjects();
    } else if (result.error && result.error !== "User canceled") {
      toast.error(`Failed to open: ${result.error}`);
    }
  };

  const handleImportFile = async (project: any) => {
    try {
      // Validate project structure
      if (!project.id || !project.info || !project.dfd) {
        throw new Error("Invalid project structure");
      }

      // Save to localStorage (Browser mode)
      await storageService.saveProject(project);

      // Add to projects list
      setProjects([...projects, project]);
      setActiveProjectId(project.id);
      setActivePhase(project.currentPhase || 0);

      // Update metadata
      await loadRecentProjects();

      toast.success(`Project "${project.info.name}" imported successfully!`);
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
        // Filter out invalid/incomplete projects
        const validProjects = result.data.filter((p) => {
          const isValid = p && p.id && p.info && p.phaseStatus;
          if (!isValid) {
            console.warn("Skipping invalid project:", p?.id || "unknown");
            // Optionally remove invalid project from storage
            if (p?.id) {
              storageService.deleteProject(p.id);
            }
          }
          return isValid;
        });

        setProjects(validProjects);

        // Set active project to first open project
        const firstOpen = validProjects.find((p) => p.isOpen);
        if (firstOpen) {
          setActiveProjectId(firstOpen.id);
          setActivePhase(firstOpen.currentPhase ?? 0);
        }

        if (validProjects.length < (result.data?.length || 0)) {
          toast.warning(
            `${
              result.data.length - validProjects.length
            } invalid project(s) were removed`,
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

  const syncProjectToStorage = async (project: Project): Promise<boolean> => {
    const result = await storageService.saveProject(project);
    if (!result.success) {
      toast.error(`Failed to save: ${result.error}`);
      return false;
    }
    return true;
  };

  // ==================== PROJECT HANDLERS ====================

  const handleProjectOpen = async (projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    if (!project || project.isOpen) return;

    const now = new Date().toISOString();

    // Check if max open projects reached
    if (openProjects.length >= MAX_OPEN_PROJECTS) {
      // Auto-close oldest project
      const oldestProject = [...openProjects].sort(
        (a, b) =>
          new Date(a.lastOpened || a.info?.lastModified || 0).getTime() -
          new Date(b.lastOpened || b.info?.lastModified || 0).getTime()
      )[0];

      const closedProject = { ...oldestProject, isOpen: false };
      const openedProject = { ...project, isOpen: true, lastOpened: now };

      // Sync both to storage
      await syncProjectToStorage(closedProject);
      await syncProjectToStorage(openedProject);

      setProjects(
        projects.map((p) => {
          if (p.id === oldestProject.id) return closedProject;
          if (p.id === projectId) return openedProject;
          return p;
        })
      );

      toast.error(`Auto-closed "${oldestProject.info?.name}" (oldest project)`);
    } else {
      const openedProject = { ...project, isOpen: true, lastOpened: now };
      await syncProjectToStorage(openedProject);

      setProjects(
        projects.map((p) => (p.id === projectId ? openedProject : p))
      );
    }

    setActiveProjectId(projectId);
    setActivePhase(project.currentPhase);
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
      setProjects(
        projects.map((p) => (p.id === activeProject.id ? savedProject : p))
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
          projects.map((p) => (p.id === projectToClose ? savedProject : p))
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

    // Update local state immediately for responsiveness
    setProjects(
      projects.map((p) => (p.id === updatedProject.id ? projectWithChanges : p))
    );

    // Auto-save if enabled
    if (updatedProject.settings.autoSave) {
      const savedProject: Project = {
        ...projectWithChanges,
        hasUnsavedChanges: false,
      };

      const success = await syncProjectToStorage(savedProject);
      if (success) {
        setProjects(
          projects.map((p) => (p.id === updatedProject.id ? savedProject : p))
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
      setProjects(projects.map((p) => (p.id === projectId ? savedProject : p)));
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
  /**
   * Handle DFD tab updates
   * Converts DFDUpdateResult to full Project update
   */
  const handleDFDUpdate = useCallback(
    async (updates: DFDUpdateResult) => {
      if (!activeProject) return;

      // Mapping der alten Threats auf neue displayIds
      const syncedThreats = activeProject.threats
        ? {
            ...activeProject.threats,
            perInteractionTables:
              activeProject.threats.perInteractionTables?.map((table) => ({
                ...table,
                threats: table.threats.map((threat) => {
                  if (!threat.linkedElement) return threat;

                  const elem = updates.dfd?.elements?.find(
                    (e) => e.id === threat.linkedElement!.elementId
                  );
                  if (!elem) return threat;

                  return {
                    ...threat,
                    linkedElement: {
                      ...threat.linkedElement,
                      displayId: elem.displayId, // aktualisierte displayId
                      elementName: elem.name, // optional
                    },
                  };
                }),
              })),
          }
        : null;

      const updatedProject: Project = {
        ...activeProject,
        dfd: updates.dfd,
        phaseStatus: updates.phaseStatus,
        threats: syncedThreats,
      };

      await updateProject(updatedProject);
    },
    [activeProject]
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
    [activeProject]
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
    [activeProject]
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
    [activeProject]
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
    [activeProject, updateProject]
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
    [activeProject, updateProject]
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
    [activeProject, updateProject]
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
    strideMethod: StrideMethod
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
        const threatDescription = getEffectiveThreatDescription(threat, "en");
        const attackDescription = getEffectiveAttackDescription(threat, "en");

        // Get mitigation - use stored value, only fallback to suggestions if empty
        let mitigation = threat.mitigation || "";
        if (!mitigation && threat.interactionContext) {
          const suggestedMitigations = getSuggestedMitigations(threat, "en");
          if (suggestedMitigations.length > 0) {
            mitigation = suggestedMitigations.join("\n");
          }
        }

        references.push({
          id: threat.id,
          strideCategory: threat.strideCategory,
          threatDescription,
          attackDescription,
          mitigation,
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
    [activeProject]
  );

  // ==================== NEW/IMPORT HANDLERS ====================

  const handleNewProject = () => {
    setShowNewDialog(true);
  };

  const handleImportProject = () => {
    setShowImportDialog(true);
  };

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
              {activePhase === 1 && activeProject && (
                <DFDTab
                  project={{
                    id: activeProject.id,
                    name: activeProject.info?.name || "",
                    dfd: activeProject.dfd ?? null,
                    phaseStatus: activeProject.phaseStatus,
                    settings: activeProject.settings,
                    lastModified: activeProject.info?.lastModified || "",
                  }}
                  onUpdate={handleDFDUpdate}
                />
              )}
              {activePhase === 2 && activeProject && (
                <AssetsTab
                  project={{
                    id: activeProject.id,
                    name: activeProject.info?.name || "",
                    assets: activeProject.assets ?? null,
                    phaseStatus: activeProject.phaseStatus,

                    // Map DFD data to Asset interfaces (NO direct dependency)
                    dfdAssets: activeProject.dfd?.assets
                      ? mapDFDAssetsToAssetFeature(activeProject.dfd.assets)
                      : undefined,
                    dfdElements: activeProject.dfd?.elements
                      ? mapDFDElementsToAssetFeature(activeProject.dfd.elements)
                      : undefined,
                    dfdConnections: activeProject.dfd?.connections
                      ? mapDFDConnectionsToAssetFeature(
                          activeProject.dfd.connections,
                        )
                      : undefined,

                    dfdPreviewImage: activeProject.dfd?.thumbnail,
                    lastModified: activeProject.info?.lastModified || "",
                  }}
                  onUpdate={handleAssetsUpdate}
                />
              )}
              {activePhase === 3 && activeProject && (
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
                  }}
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
                    dfdPreviewImage: activeProject.dfd?.thumbnail,
                    lastModified: activeProject.info?.lastModified || "",
                  }}
                  onUpdate={handleRisksUpdate}
                  onPhaseComplete={() => setActivePhase(5)}
                />
              )}
              {activePhase === 5 && activeProject && (
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
            const result = await projectService.createProject({
              name: data.name,
              description: data.description,
              version: data.version,
              responsible: data.responsible,
              isHighImpact: data.isHighImpact,
            });

            if (result.success && result.data) {
              const projectWithTags: Project = {
                ...result.data,
                info: {
                  ...result.data.info,
                  tags: data.tags,
                },
              };

              // Save with unified persistence
              const saveResult =
                await persistence.saveNewProject(projectWithTags);

              if (saveResult.success) {
                // Also save to localStorage (for metadata)
                await storageService.saveProject(projectWithTags);

                setProjects([...projects, projectWithTags]);
                setActiveProjectId(projectWithTags.id);
                setActivePhase(0);

                // Mode-specific feedback
                if (persistence.mode === "file-system-access") {
                  toast.success(
                    `Project "${projectWithTags.info.name}" created and linked to file!`,
                  );
                } else {
                  toast.success(
                    `Project "${projectWithTags.info.name}" created!`,
                  );
                }
              } else if (saveResult.error !== "User canceled") {
                toast.error(`Failed to save: ${saveResult.error}`);
              }
            } else {
              toast.error(`Failed to create project: ${result.error}`);
            }
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