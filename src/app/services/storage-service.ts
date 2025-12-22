// ==================== STORAGE SERVICE ====================
// Wrapper for browser localStorage API with error handling and type safety

import { PhaseStatus, PhaseStatusMap } from "shared";
import { ProjectSettingsData } from "features/overview";
import { Project } from "../models/project-types";

export interface StorageResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const STORAGE_PREFIX = "coretm_";
const PROJECT_PREFIX = `${STORAGE_PREFIX}project_`;
const SETTINGS_KEY = `${STORAGE_PREFIX}settings`;
const METADATA_KEY = `${STORAGE_PREFIX}metadata`;

// ==================== DEFAULT VALUES ====================

const DEFAULT_PHASE_STATUS: PhaseStatusMap = {
  0: "not-started",
  1: "not-started",
  2: "not-started",
  3: "not-started",
  4: "not-started",
  5: "not-started",
  6: "not-started",
};

const DEFAULT_SETTINGS: ProjectSettingsData = {
  strictMode: false,
  autoSave: true,
  autoSaveInterval: 30,
};

class StorageService {
  private isAvailable(): boolean {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
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

  async list(prefix: string = STORAGE_PREFIX): Promise<StorageResult<string[]>> {
    if (!this.isAvailable())
      return this.handleError("list", new Error("Storage not available"));

    try {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith(prefix));
      return { success: true, data: keys };
    } catch (error) {
      return this.handleError("list", error);
    }
  }

  // ==================== PROJECT REPAIR ====================

  /**
   * Repairs incomplete project data by filling in missing required fields
   */
  private repairProject(project: Partial<Project>): Project | null {
    // Minimum required: id and name
    if (!project.id || !project.name) {
      console.warn('Cannot repair project without id or name:', project);
      return null;
    }

    const now = new Date().toISOString();

    const repaired: Project = {
      // Required fields with defaults
      id: project.id,
      name: project.name,
      description: project.description ?? "",
      version: project.version ?? "1.0",
      responsible: project.responsible ?? "",
      created: project.created ?? now,
      lastModified: project.lastModified ?? now,
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
        5: project.phaseStatus?.[3] ?? "not-started",
        6: project.phaseStatus?.[4] ?? "not-started",
      },

      // Ensure settings is complete
      settings: {
        strictMode: project.settings?.strictMode ?? false,
        autoSave: project.settings?.autoSave ?? true,
        autoSaveInterval: project.settings?.autoSaveInterval ?? 30,
      },

      // Arrays with defaults
      tags: project.tags ?? [],
      team: project.team ?? [],
      activityLog: project.activityLog ?? [],
      assets: project.assets ?? null,
      threats: project.threats ?? [],

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
      typeof project.id === 'string' &&
      typeof project.name === 'string' &&
      project.phaseStatus &&
      typeof project.phaseStatus[0] !== 'undefined'
    );
  }

  // ==================== PROJECTS ====================

  async getProject(projectId: string): Promise<StorageResult<Project>> {
    const result = await this.get<Partial<Project>>(`${PROJECT_PREFIX}${projectId}`);
    
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Project not found' };
    }

    // Check if project needs repair
    if (!this.isValidProject(result.data)) {
      console.warn(`Project ${projectId} is incomplete, attempting repair...`);
      const repaired = this.repairProject(result.data);
      
      if (!repaired) {
        return { success: false, error: 'Project is corrupted and cannot be repaired' };
      }

      // Save repaired project
      await this.saveProject(repaired);
      return { success: true, data: repaired };
    }

    return { success: true, data: result.data as Project };
  }

  saveProject(project: Project) {
    return this.set<Project>(`${PROJECT_PREFIX}${project.id}`, project);
  }

  deleteProject(projectId: string) {
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
    responsible: string = ''
  ): Project {
    const now = new Date().toISOString();

    return {
      id: `proj_${Date.now()}`,
      name,
      description,
      version: "1.0",
      responsible,
      created: now,
      lastModified: now,
      lastOpened: now,
      currentPhase: 0,
      strideMethod: null,
      methodSelected: false,
      phaseStatus: { ...DEFAULT_PHASE_STATUS },
      settings: { ...DEFAULT_SETTINGS },
      tags: [],
      team: responsible ? [responsible] : [],
      status: "draft",
      activityLog: [
        {
          timestamp: now,
          action: "CREATE",
          entity: "project",
          description: "Project created",
        },
      ],
      dfd: null,
      assets: null,
      threats: [],
      isOpen: true,
      hasUnsavedChanges: false,
    };
  }

  public exportProjectAsJSON(project: Project): void {
    const json = JSON.stringify(project, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const filename = `${project.name.replace(/[^a-z0-9]/gi, '_')}_TARA_${new Date()
      .toISOString()
      .split('T')[0]}.json`;

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();

    URL.revokeObjectURL(url);
  }

  public async importProjectFromJSON(file: File): Promise<StorageResult<Project>> {
    try {
      const text = await file.text();
      const rawProject = JSON.parse(text);

      // Attempt to repair if incomplete
      const project = this.repairProject(rawProject);
      
      if (!project) {
        return { success: false, error: 'Invalid project structure - missing id or name' };
      }

      // Check for duplicate ID
      const exists = await this.projectExists(project.id);
      if (exists) {
        project.id = `proj_${Date.now()}`;
      }

      // Update timestamps
      const now = new Date().toISOString();
      project.lastModified = now;
      project.lastOpened = now;
      project.isOpen = true;
      project.hasUnsavedChanges = false;

      const result = await this.saveProject(project);
      if (!result.success) {
        return { success: false, error: 'Failed to save imported project' };
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
   * Clear all CoReTM data from localStorage
   */
  async clearAllData(): Promise<StorageResult<boolean>> {
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith(STORAGE_PREFIX));
      keys.forEach(k => localStorage.removeItem(k));
      return { success: true, data: true };
    } catch (error) {
      return this.handleError('clearAllData', error);
    }
  }

  /**
   * Get storage usage info
   */
  getStorageInfo(): { used: number; available: number; projectCount: number } {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(STORAGE_PREFIX));
    const projectKeys = keys.filter(k => k.startsWith(PROJECT_PREFIX));
    
    let used = 0;
    keys.forEach(k => {
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
