// ==================== PROJECT SERVICE ====================
// Business logic for project management

import { storageService, type StorageResult } from "./storage-service";
import {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
} from "../models/project-types";
import {
  ProjectSettingsData,
  migrateProjectTags,
  isProjectTags,
} from "features/overview";

import { PhaseStatus, formatExportFilename } from "shared";

// ==================== PROJECT SERVICE CLASS ====================

class ProjectService {
  /**
   * Create new project
   */
  // ProjectService.ts
  async createProject(
    input: CreateProjectInput,
  ): Promise<StorageResult<Project>> {
    try {
      const project = storageService.createEmptyProject(
        input.name,
        input.description,
        input.version,
        input.responsible,
        input.isHighImpact,
        (input as any).filePath, // filePath from NewProjectData
      );
      const result = await storageService.saveProject(project);
      return result;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  getProject(projectId: string) {
    return storageService.getProject(projectId);
  }

  /**
   * Update project
   */
  async updateProject(
    projectId: string,
    updates: UpdateProjectInput,
  ): Promise<StorageResult<Project>> {
    try {
      const result = await storageService.getProject(projectId);

      if (!result.success || !result.data) {
        return { success: false, error: "Project not found" };
      }

      const project = result.data;
      const now = new Date().toISOString();

      const updatedSettings: ProjectSettingsData = {
        strictMode: updates.settings?.strictMode ?? project.settings.strictMode,
        autoSave: updates.settings?.autoSave ?? project.settings.autoSave,
        autoSaveInterval:
          updates.settings?.autoSaveInterval ??
          project.settings.autoSaveInterval,
      };

      const updated: Project = {
        ...project,
        ...updates,
        settings: updatedSettings,
        info: {
          ...project.info,
          lastModified: now,
        },
        hasUnsavedChanges: false,
      };

      return storageService.saveProject(updated);
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to update project",
      };
    }
  }

  deleteProject(id: string) {
    return storageService.deleteProject(id);
  }

  getAllProjects() {
    return storageService.getAllProjects();
  }

  /**
   * Duplicate project
   */
  async duplicateProject(projectId: string) {
    const result = await storageService.getProject(projectId);
    if (!result.success || !result.data) {
      return { success: false, error: "Project not found" };
    }

    const original = result.data;
    const now = new Date().toISOString();
    const newId = `proj_${Date.now()}`;

    const copy: Project = {
      ...original,
      id: newId,
      info: {
        ...original.info,
        name: `${original.info.name} (Copy)`,
        created: now,
        lastModified: now,
      },
      lastOpened: now,
      isOpen: true,
      hasUnsavedChanges: false,
    };

    return storageService.saveProject(copy);
  }

  /**
   * Export project
   */
  async exportProject(projectId: string) {
    const result = await storageService.getProject(projectId);
    if (!result.success || !result.data) {
      return { success: false, error: result.error || "Project not found" };
    }

    const project = result.data;
    const blob = new Blob([JSON.stringify(project, null, 2)], {
      type: "application/json",
    });
    const filename = formatExportFilename(project.info.name);

    return { success: true, data: { blob, filename } };
  }

  /**
   * Import project (overwrite or not)
   */
  async importProject(file: File, overwrite = false) {
    try {
      const text = await file.text();
      const raw = JSON.parse(text) as any;

      // Migration guard — convert legacy string[] tags
      if (Array.isArray(raw.info?.tags)) {
        raw.info.tags = migrateProjectTags(raw.info.tags as string[]);
      }

      const project = raw as Project;

      if (!this.validateProjectStructure(project)) {
        return { success: false, error: "Invalid project file" };
      }

      const exists = await storageService.projectExists(project.id);
      if (exists && !overwrite) {
        return { success: false, error: "Project exists already" };
      }

      const now = new Date().toISOString();
      const imported: Project = {
        ...project,
        info: {
          ...project.info,
          lastModified: now,
        },
        lastOpened: now,
        isOpen: true,
        hasUnsavedChanges: false,
      };

      const result = await storageService.saveProject(imported);
      return {
        success: result.success,
        data: result.data,
        error: result.error,
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Import as copy (always new ID)
   */
  async importProjectAsCopy(file: File) {
    try {
      const text = await file.text();
      const raw = JSON.parse(text) as any;

      if (Array.isArray(raw.info?.tags)) {
        raw.info.tags = migrateProjectTags(raw.info.tags as string[]);
      }

      const project = raw as Project;

      if (!this.validateProjectStructure(project)) {
        return { success: false, error: "Invalid project format" };
      }

      const now = new Date().toISOString();
      const newId = `proj_${Date.now()}`;

      const imported: Project = {
        ...project,
        id: newId,
        info: {
          ...project.info,
          name: `${project.info.name} (Imported)`,
          created: now,
          lastModified: now,
        },
        lastOpened: now,
        isOpen: true,
        hasUnsavedChanges: false,
      };

      const result = await storageService.saveProject(imported);
      return {
        success: result.success,
        data: result.data,
        error: result.error,
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Update phase status
   */
  async updatePhaseStatus(
    projectId: string,
    phase: number,
    status: PhaseStatus,
  ) {
    const result = await storageService.getProject(projectId);
    if (!result.success || !result.data) {
      return { success: false, error: "Project not found" };
    }

    const project = result.data;
    const now = new Date().toISOString();

    const updated: Project = {
      ...project,
      phaseStatus: {
        ...project.phaseStatus,
        [phase]: status,
      },
      info: {
        ...project.info,
        lastModified: now,
      },
    };

    return storageService.saveProject(updated);
  }

  async markProjectOpened(id: string) {
    const r = await storageService.getProject(id);
    if (!r.success || !r.data) return { success: false, error: "Not found" };

    const now = new Date().toISOString();
    const project: Project = {
      ...r.data,
      lastOpened: now,
      isOpen: true,
    };

    return storageService.saveProject(project);
  }

  async markProjectClosed(id: string) {
    const r = await storageService.getProject(id);
    if (!r.success || !r.data) return { success: false, error: "Not found" };

    const project: Project = {
      ...r.data,
      isOpen: false,
      hasUnsavedChanges: false,
    };

    return storageService.saveProject(project);
  }

  /**
   * Mark unsaved changes
   */
  async markUnsavedChanges(id: string, hasChanges: boolean) {
    const r = await storageService.getProject(id);
    if (!r.success || !r.data) return { success: false, error: "Not found" };

    const project: Project = { ...r.data, hasUnsavedChanges: hasChanges };
    return storageService.saveProject(project);
  }

  /**
   * Open projects
   */
  async getOpenProjects() {
    const r = await storageService.getAllProjects();
    if (!r.success || !r.data) return r;

    return {
      success: true,
      data: r.data.filter((p) => p.isOpen),
    };
  }

  /**
   * Recent projects
   */
  async getRecentProjects(limit = 10) {
    const r = await storageService.getAllProjects();
    if (!r.success || !r.data) return r;

    const recent = r.data
      .filter((p) => !p.isOpen)
      .sort(
        (a, b) =>
          new Date(b.lastOpened || b.info.lastModified).getTime() -
          new Date(a.lastOpened || a.info.lastModified).getTime(),
      )
      .slice(0, limit);

    return { success: true, data: recent };
  }

  /**
   * Open project from file (Electron mode)
   */
  async openProjectFromFile(filePath: string): Promise<StorageResult<Project>> {
    return storageService.loadProjectFromFile(filePath);
  }

  /**
   * Struct validation
   */
  // In validateProjectStructure — fix the broken check (was checking p.name
  // at top level, but name lives in p.info.name):
  private validateProjectStructure(p: any): p is Project {
    return (
      p &&
      typeof p.id === "string" &&
      p.info &&
      typeof p.info.name === "string" && // Fixed: was p.name
      typeof p.info.description === "string" // Fixed: was p.description
    );
  }
}

export const projectService = new ProjectService();