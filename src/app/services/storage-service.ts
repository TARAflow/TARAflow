// ==================== STORAGE SERVICE ====================
// Wrapper for browser localStorage API with error handling and type safety

import { PhaseStatus, PhaseStatusMap } from "shared";
import {
  migrateProjectTags,
  EMPTY_PROJECT_TAGS,
  ProjectSettingsData,
} from "features/overview";
import { Project, ProjectMetadata } from "../models/project-types";

export interface StorageResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const STORAGE_PREFIX = "taraflow_";
const PROJECT_PREFIX = `${STORAGE_PREFIX}project_`;
const SETTINGS_KEY = `${STORAGE_PREFIX}settings`;
const METADATA_KEY = `${STORAGE_PREFIX}metadata`;
const RECENT_PROJECTS_KEY = `${STORAGE_PREFIX}recent_projects`; // Browser fallback

// ==================== DEFAULT VALUES ====================

const DEFAULT_PHASE_STATUS: PhaseStatusMap = {
  0: "not-started",
  1: "not-started",
  2: "not-started",
  3: "not-started",
  4: "not-started",
  5: "not-started",
  6: "not-started", // Documentation
  7: "not-started", // Audit
  8: "not-started", // Integration
};

const DEFAULT_SETTINGS: ProjectSettingsData = {
  strictMode: false,
  autoSave: true,
  autoSaveInterval: 2, // Auto-save every 2 seconds
};

const RECENT_FILES_KEY = `${STORAGE_PREFIX}recent_files`;

class StorageService {
  private isAvailable(): boolean {
    return (
      typeof window !== "undefined" &&
      typeof window.localStorage !== "undefined"
    );
  }

  private isElectron(): boolean {
    return (
      typeof window !== "undefined" &&
      typeof (window as any).electron?.file !== "undefined"
    );
  }

  private handleError(operation: string, error: any): StorageResult<any> {
    console.error(`Storage ${operation} failed:`, error);
    return { success: false, error: error.message || `Failed to ${operation}` };
  }

  async get<T = any>(key: string): Promise<StorageResult<T>> {
    if (!this.isAvailable())
      return this.handleError("get", new Error("Storage not available"));

    try {
      const raw = localStorage.getItem(key);
      if (!raw) return { success: false, error: "Key not found" };

      return { success: true, data: JSON.parse(raw) };
    } catch (error) {
      return this.handleError("get", error);
    }
  }

  async set<T = any>(key: string, value: T): Promise<StorageResult<T>> {
    if (!this.isAvailable())
      return this.handleError("set", new Error("Storage not available"));

    try {
      localStorage.setItem(key, JSON.stringify(value));
      return { success: true, data: value };
    } catch (error) {
      return this.handleError("set", error);
    }
  }

  async delete(key: string): Promise<StorageResult<boolean>> {
    if (!this.isAvailable())
      return this.handleError("delete", new Error("Storage not available"));

    try {
      localStorage.removeItem(key);
      return { success: true, data: true };
    } catch (error) {
      return this.handleError("delete", error);
    }
  }

  async list(
    prefix: string = STORAGE_PREFIX,
  ): Promise<StorageResult<string[]>> {
    if (!this.isAvailable())
      return this.handleError("list", new Error("Storage not available"));

    try {
      const keys = Object.keys(localStorage).filter((k) =>
        k.startsWith(prefix),
      );
      return { success: true, data: keys };
    } catch (error) {
      return this.handleError("list", error);
    }
  }

  // ==================== PROJECT REPAIR ====================

  /**
   * Repairs incomplete project data by filling in missing required fields
   */
  private repairProject(project: any): Project | null {
    // Minimum required: id and name
    if (!project.id || !project.info) {
      console.warn("Cannot repair project without id or name:", project);
      return null;
    }

    const now = new Date().toISOString();

    const repaired: Project = {
      // Required fields with defaults
      id: project.id,
      info: {
        ...project.info,
        tags: migrateProjectTags(project.info.tags ?? []),
        team: project.info.team ?? [],
        lastModified: project.info.lastModified ?? now,
      },
      lastOpened: project.lastOpened ?? now,
      currentPhase: project.currentPhase ?? 0,
      strideMethod: project.strideMethod ?? null,
      methodSelected: project.methodSelected ?? false,

      // Ensure phaseStatus is complete
      phaseStatus: {
        0: project.phaseStatus?.[0] ?? "not-started",
        1: project.phaseStatus?.[1] ?? "not-started",
        2: project.phaseStatus?.[2] ?? "not-started",
        3: project.phaseStatus?.[3] ?? "not-started",
        4: project.phaseStatus?.[4] ?? "not-started",
        5: project.phaseStatus?.[5] ?? "not-started",
        6: project.phaseStatus?.[6] ?? "not-started",
        7: project.phaseStatus?.[7] ?? "not-started",
        8: project.phaseStatus?.[7] ?? "not-started",
      },

      // Ensure settings is complete
      settings: {
        strictMode: project.settings?.strictMode ?? false,
        autoSave: project.settings?.autoSave ?? true,
        autoSaveInterval: project.settings?.autoSaveInterval ?? 30,
      },

      // Arrays with defaults
      assets: project.assets ?? null,
      threats: project.threats ?? null,
      risks: project.risks ?? null,
      attackTrees: project.attackTrees ?? null,
      documentation: null,
      audit: null,
      integration: project.integration ?? null,

      // Other fields
      status: project.status ?? "draft",
      dfd: project.dfd ?? null,
      isOpen: project.isOpen ?? false,
      hasUnsavedChanges: project.hasUnsavedChanges ?? false,
    };

    return repaired;
  }

  /**
   * Validates if a project has all required fields
   */
  private isValidProject(project: any): project is Project {
    return (
      project &&
      typeof project.id === "string" &&
      typeof project.name === "string" &&
      project.phaseStatus &&
      typeof project.phaseStatus[0] !== "undefined"
    );
  }

  // ==================== RECENT FILES (METADATA) ====================

  /**
   * Update recent files metadata
   * Electron: Uses app.getPath('userData')/recent-projects.json via IPC
   * Browser: Uses localStorage as fallback
   */
  private async updateRecentFile(project: Project): Promise<void> {
    if (!project.filePath && this.isElectron()) {
      // Electron mode requires filePath
      console.warn("Cannot update metadata without filePath in Electron mode");
      return;
    }

    const metadata: ProjectMetadata = {
      id: project.id,
      filePath: project.filePath || "",
      lastOpened: project.lastOpened || new Date().toISOString(),
      info: project.info,
      status: project.status,
      currentPhase: project.currentPhase,
      completedPhases: Object.values(project.phaseStatus).filter(
        (s) => s === "complete",
      ).length,
      totalPhases: Object.keys(project.phaseStatus).length,
    };

    if (this.isElectron()) {
      // Electron: Use IPC to save to userData
      try {
        const result = await (
          window as any
        ).electron.metadata.getRecentProjects();
        let recentProjects: ProjectMetadata[] =
          result.success && result.data ? result.data : [];

        // Remove existing entry
        recentProjects = recentProjects.filter((p) => p.id !== project.id);

        // Add at beginning
        recentProjects.unshift(metadata);

        // Keep last 20
        recentProjects = recentProjects.slice(0, 20);

        await (window as any).electron.metadata.saveRecentProjects(
          recentProjects,
        );
      } catch (error) {
        console.error("Failed to update metadata in Electron:", error);
      }
    } else {
      // Browser: Use localStorage fallback
      const result = await this.get<ProjectMetadata[]>(RECENT_PROJECTS_KEY);
      let recentProjects: ProjectMetadata[] =
        result.success && result.data ? result.data : [];

      recentProjects = recentProjects.filter((p) => p.id !== project.id);
      recentProjects.unshift(metadata);
      recentProjects = recentProjects.slice(0, 20);

      await this.set(RECENT_PROJECTS_KEY, recentProjects);
    }
  }

  /**
   * Get recent files metadata
   */
  public async getRecentFiles(): Promise<ProjectMetadata[]> {
    if (this.isElectron()) {
      try {
        const result = await (
          window as any
        ).electron.metadata.getRecentProjects();
        return result.success && result.data ? result.data : [];
      } catch (error) {
        console.error("Failed to get metadata from Electron:", error);
        return [];
      }
    } else {
      const result = await this.get<ProjectMetadata[]>(RECENT_PROJECTS_KEY);
      return result.success && result.data ? result.data : [];
    }
  }

  /**
   * Remove from recent files
   */
  private async removeRecentFile(projectId: string): Promise<void> {
    if (this.isElectron()) {
      try {
        const result = await (
          window as any
        ).electron.metadata.getRecentProjects();
        if (result.success && result.data) {
          const filtered = result.data.filter(
            (p: ProjectMetadata) => p.id !== projectId,
          );
          await (window as any).electron.metadata.saveRecentProjects(filtered);
        }
      } catch (error) {
        console.error("Failed to remove metadata in Electron:", error);
      }
    } else {
      const recentFiles = await this.getRecentFiles();
      const filtered = recentFiles.filter((f) => f.id !== projectId);
      await this.set(RECENT_PROJECTS_KEY, filtered);
    }
  }

  // ==================== PROJECTS ====================

  async getProject(projectId: string): Promise<StorageResult<Project>> {
    // In Electron mode, try to find filePath from recent files
    if (this.isElectron()) {
      const recentFiles = await this.getRecentFiles();
      const metadata = recentFiles.find((f) => f.id === projectId);

      if (metadata?.filePath) {
        try {
          const result = await (window as any).electron.file.readProject(
            metadata.filePath,
          );

          if (!result.success) {
            return { success: false, error: result.error };
          }

          const rawProject = JSON.parse(result.data) as any;
          if (Array.isArray(rawProject.info?.tags)) {
            rawProject.info.tags = migrateProjectTags(rawProject.info.tags);
          }
          const project = rawProject as Partial<Project>;

          // Check if project needs repair
          if (!this.isValidProject(project)) {
            const repaired = this.repairProject(project);
            if (!repaired) {
              return {
                success: false,
                error: "Project is corrupted and cannot be repaired",
              };
            }
            return { success: true, data: repaired };
          }

          const data = result.data as any;
          if (Array.isArray(data.info?.tags)) {
            data.info.tags = migrateProjectTags(data.info.tags);
          }
          return { success: true, data: data as Project };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }
    }

    // Browser Mode: localStorage fallback
    const result = await this.get<Partial<Project>>(
      `${PROJECT_PREFIX}${projectId}`,
    );

    if (!result.success || !result.data) {
      return { success: false, error: result.error || "Project not found" };
    }

    // Check if project needs repair
    if (!this.isValidProject(result.data)) {
      console.warn(`Project ${projectId} is incomplete, attempting repair...`);
      const repaired = this.repairProject(result.data);

      if (!repaired) {
        return {
          success: false,
          error: "Project is corrupted and cannot be repaired",
        };
      }

      // Save repaired project
      await this.saveProject(repaired);
      return { success: true, data: repaired };
    }

    return { success: true, data: result.data as Project };
  }

  async saveProject(project: Project): Promise<StorageResult<Project>> {
    const projectToSave: Project = {
      ...project,
      dfd: project.dfd
        ? {
            ...project.dfd,
            graph: undefined,
          }
        : null,
    };

    if (this.isElectron() && projectToSave.filePath) {
      // Electron Mode: Write to file
      try {
        const projectData = JSON.stringify(projectToSave, null, 2);
        const result = await (window as any).electron.file.writeProject(
          projectToSave.filePath,
          projectData,
        );

        if (!result.success) {
          return { success: false, error: result.error };
        }

        await this.updateRecentFile(projectToSave);
        return { success: true, data: project };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    } else {
      // Browser Mode: localStorage fallback
      return this.set<Project>(`${PROJECT_PREFIX}${project.id}`, projectToSave);
    }
  }

  async deleteProject(projectId: string): Promise<StorageResult<boolean>> {
    // Remove from recent files in Electron mode
    if (this.isElectron()) {
      await this.removeRecentFile(projectId);
    }

    // Delete from localStorage (Browser mode or metadata)
    return this.delete(`${PROJECT_PREFIX}${projectId}`);
  }

  async listProjects(): Promise<StorageResult<string[]>> {
    const result = await this.list(PROJECT_PREFIX);
    if (!result.success || !result.data) return result;

    return {
      success: true,
      data: result.data.map((key) => key.replace(PROJECT_PREFIX, "")),
    };
  }

  async getAllProjects(): Promise<StorageResult<Project[]>> {
    try {
      if (this.isElectron()) {
        // Electron Mode: Load from recent files
        const recentFiles = await this.getRecentFiles();
        const projects: Project[] = [];
        const failedIds: string[] = [];

        for (const metadata of recentFiles) {
          try {
            const result = await (window as any).electron.file.readProject(
              metadata.filePath,
            );

            if (result.success) {
              const raw = JSON.parse(result.data) as any;
              if (Array.isArray(raw.info?.tags)) {
                raw.info.tags = migrateProjectTags(raw.info.tags);
              }
              const project = raw as Project;
              projects.push(project);
            } else {
              failedIds.push(metadata.id);
            }
          } catch (error) {
            console.warn(`Failed to load project ${metadata.id}:`, error);
            failedIds.push(metadata.id);
          }
        }

        // Remove failed projects from recent files
        for (const id of failedIds) {
          await this.removeRecentFile(id);
        }

        return { success: true, data: projects };
      }

      // Browser Mode: Load from localStorage
      const listResult = await this.listProjects();
      if (!listResult.success || !listResult.data)
        return { success: false, error: "Failed to list projects" };

      const projects: Project[] = [];
      const failedIds: string[] = [];

      for (const id of listResult.data) {
        const r = await this.getProject(id);
        if (r.success && r.data) {
          projects.push(r.data);
        } else {
          console.warn(`Failed to load project ${id}:`, r.error);
          failedIds.push(id);
        }
      }

      // Optionally delete corrupted projects
      for (const id of failedIds) {
        console.warn(`Removing corrupted project: ${id}`);
        await this.deleteProject(id);
      }

      return { success: true, data: projects };
    } catch (error) {
      return this.handleError("getAllProjects", error);
    }
  }

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.get(key);
      return result.success;
    } catch {
      return false;
    }
  }

  /**
   * Check if a project exists
   */
  async projectExists(projectId: string): Promise<boolean> {
    return this.exists(`${PROJECT_PREFIX}${projectId}`);
  }

  public createEmptyProject(
    name: string,
    description: string,
    version: string = "1.0",
    responsible: string = "",
    isHighImpact: boolean = false,
    filePath?: string,
  ): Project {
    const now = new Date().toISOString();

    return {
      id: `proj_${Date.now()}`,

      // Project metadata
      info: {
        name,
        description,
        version,
        responsible,
        created: now,
        lastModified: now,
        tags: { ...EMPTY_PROJECT_TAGS },
        team: responsible ? [responsible] : [],
        isHighImpact,
      },

      lastOpened: now,
      currentPhase: 0,
      strideMethod: null,
      methodSelected: false,

      phaseStatus: { ...DEFAULT_PHASE_STATUS },
      settings: { ...DEFAULT_SETTINGS },

      status: "draft",

      dfd: null,
      assets: null,
      threats: null,
      risks: null,
      attackTrees: null,
      documentation: null,
      audit: null,
      integration: null,

      isOpen: true,
      hasUnsavedChanges: false,
      filePath: filePath,
    };
  }

  public exportProjectAsJSON(project: Project): void {
    const json = JSON.stringify(project, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const filename = `${project.info.name.replace(/[^a-z0-9]/gi, "_")}_TARA_${
      new Date().toISOString().split("T")[0]
    }.json`;

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();

    URL.revokeObjectURL(url);
  }

  /**
   * Load project from file (Electron mode)
   */
  public async loadProjectFromFile(
    filePath: string,
  ): Promise<StorageResult<Project>> {
    if (!this.isElectron()) {
      return {
        success: false,
        error: "File loading only available in Electron mode",
      };
    }

    try {
      const result = await (window as any).electron.file.readProject(filePath);

      if (!result.success) {
        return { success: false, error: result.error };
      }

      const rawProject = JSON.parse(result.data);
      const project = this.repairProject(rawProject);

      if (!project) {
        return {
          success: false,
          error: "Invalid project structure - missing id or name",
        };
      }

      // Set filePath
      project.filePath = filePath;

      // Update timestamps
      const now = new Date().toISOString();
      project.lastOpened = now;
      project.isOpen = true;
      project.hasUnsavedChanges = false;

      // Save to update metadata
      await this.saveProject(project);

      return { success: true, data: project };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  public async importProjectFromJSON(
    file: File,
    filePath?: string,
  ): Promise<StorageResult<Project>> {
    try {
      const text = await file.text();
      const rawProject = JSON.parse(text);

      // Attempt to repair if incomplete
      const project = this.repairProject(rawProject);

      if (!project) {
        return {
          success: false,
          error: "Invalid project structure - missing id or name",
        };
      }

      // Check for duplicate ID
      const exists = await this.projectExists(project.id);
      if (exists) {
        project.id = `proj_${Date.now()}`;
      }

      // Update timestamps
      const now = new Date().toISOString();
      project.info.lastModified = now;
      project.lastOpened = now;
      project.isOpen = true;
      project.hasUnsavedChanges = false;

      // Set filePath if provided (Electron mode)
      if (filePath) {
        project.filePath = filePath;
      }

      const result = await this.saveProject(project);
      if (!result.success) {
        return { success: false, error: "Failed to save imported project" };
      }

      return { success: true, data: result.data };
    } catch (error) {
      return { success: false, error: `Failed to parse JSON: ${error}` };
    }
  }

  // ==================== SETTINGS ====================
  getSettings<T = any>() {
    return this.get<T>(SETTINGS_KEY);
  }

  saveSettings<T = any>(settings: T) {
    return this.set<T>(SETTINGS_KEY, settings);
  }

  // ==================== METADATA ====================
  getMetadata<T = any>() {
    return this.get<T>(METADATA_KEY);
  }

  saveMetadata<T = any>(metadata: T) {
    return this.set<T>(METADATA_KEY, metadata);
  }

  // ==================== UTILITIES ====================

  /**
   * Clear all TARAflow data from localStorage
   */
  async clearAllData(): Promise<StorageResult<boolean>> {
    try {
      const keys = Object.keys(localStorage).filter((k) =>
        k.startsWith(STORAGE_PREFIX),
      );
      keys.forEach((k) => localStorage.removeItem(k));
      return { success: true, data: true };
    } catch (error) {
      return this.handleError("clearAllData", error);
    }
  }

  /**
   * Get storage usage info
   */
  getStorageInfo(): { used: number; available: number; projectCount: number } {
    const keys = Object.keys(localStorage).filter((k) =>
      k.startsWith(STORAGE_PREFIX),
    );
    const projectKeys = keys.filter((k) => k.startsWith(PROJECT_PREFIX));

    let used = 0;
    keys.forEach((k) => {
      const item = localStorage.getItem(k);
      if (item) used += item.length * 2; // UTF-16 = 2 bytes per char
    });

    return {
      used,
      available: 5 * 1024 * 1024, // ~5MB typical limit
      projectCount: projectKeys.length,
    };
  }
}

export const storageService = new StorageService();
export default storageService;