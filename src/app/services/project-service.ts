// ==================== PROJECT SERVICE ====================
// Single Responsibility: business logic for project lifecycle.
//
// After Phase B:
//   I/O          → projectRepository
//   Metadata     → projectRegistry
//   Migration    → migration-service (called inside projectRepository)
//   Primitives   → storageService (browser fallback only)
//
// This service knows WHAT to do — Repository knows HOW to store it.

import { storageService, type StorageResult } from "./storage-service";
import { projectRepository } from "./project-repository";
import { projectRegistry } from "./project-registry";
import {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
} from "../models/project-types";
import type { ProjectSettingsData } from "features/overview";
import { PhaseStatus, formatExportFilename, migrateProjectTags } from "shared";
import { parseAndRepair } from "./migration-service";
import { serialiseProject } from "./prepare-for-disk";

// ==================== HELPERS ====================

function isElectron(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as any).electron?.file !== "undefined"
  );
}

// ==================== SERVICE ====================

class ProjectService {
  // ── Factory ──────────────────────────────────────────────────────────────

  /**
   * Build a new empty Project object — no I/O, no dialog.
   * The caller (main-layout) owns the save dialog and the first write.
   */
  createProject(input: CreateProjectInput): StorageResult<Project> {
    try {
      const project = projectRepository.createEmpty(
        input.name,
        input.description,
        input.version,
        input.responsible,
        input.isHighImpact,
      );
      return { success: true, data: project };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  // ── Read ─────────────────────────────────────────────────────────────────

  async getAllProjects(): Promise<StorageResult<Project[]>> {
    if (isElectron()) {
      return projectRepository.loadAll();
    }
    return storageService.getAllProjects();
  }

  async getProject(projectId: string): Promise<StorageResult<Project>> {
    if (isElectron()) {
      return projectRepository.loadById(projectId);
    }
    return storageService.getProject(projectId);
  }

  // ── Write ─────────────────────────────────────────────────────────────────

  /**
   * Persist a project — routes to the correct backend.
   * Electron: writes to .tara.json + updates registry
   * Browser:  writes to localStorage
   */
  async saveProject(project: Project): Promise<StorageResult<Project>> {
    if (isElectron()) {
      return projectRepository.save(project);
    }
    return storageService.saveProject(project);
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async updateProject(
    projectId: string,
    updates: UpdateProjectInput,
  ): Promise<StorageResult<Project>> {
    try {
      const result = await this.getProject(projectId);
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
        info: { ...project.info, lastModified: now },
        hasUnsavedChanges: false,
      };

      return this.saveProject(updated);
    } catch (err: any) {
      return {
        success: false,
        error: err.message ?? "Failed to update project",
      };
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async deleteProject(projectId: string): Promise<StorageResult<boolean>> {
    // Remove from registry (Electron) or localStorage (Browser)
    if (isElectron()) {
      return projectRepository.unregister(projectId);
    }
    return storageService.deleteProject(projectId);
  }

  // ── Lifecycle helpers ─────────────────────────────────────────────────────

  async markProjectOpened(id: string): Promise<StorageResult<Project>> {
    const r = await this.getProject(id);
    if (!r.success || !r.data) return { success: false, error: "Not found" };

    const updated: Project = {
      ...r.data,
      lastOpened: new Date().toISOString(),
      isOpen: true,
    };
    return this.saveProject(updated);
  }

  async markProjectClosed(id: string): Promise<StorageResult<Project>> {
    const r = await this.getProject(id);
    if (!r.success || !r.data) return { success: false, error: "Not found" };

    const updated: Project = {
      ...r.data,
      isOpen: false,
      hasUnsavedChanges: false,
    };
    return this.saveProject(updated);
  }

  // ── Duplicate ─────────────────────────────────────────────────────────────

  async duplicateProject(projectId: string): Promise<StorageResult<Project>> {
    const result = await this.getProject(projectId);
    if (!result.success || !result.data) {
      return { success: false, error: "Project not found" };
    }

    const original = result.data;
    const now = new Date().toISOString();

    const copy: Project = {
      ...original,
      id: `proj_${Date.now()}`,
      filePath: undefined, // Copy has no file until user saves it
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

    // Copy is not written to disk here — main-layout will call saveNewProject
    // via useProjectPersistence after the save dialog completes.
    return { success: true, data: copy };
  }

  // ── Export ────────────────────────────────────────────────────────────────

  async exportProject(
    projectId: string,
  ): Promise<StorageResult<{ blob: Blob; filename: string }>> {
    const result = await this.getProject(projectId);
    if (!result.success || !result.data) {
      return { success: false, error: result.error ?? "Project not found" };
    }

    const project = result.data;
    const blob = new Blob([serialiseProject(project)], {
      type: "application/json",
    });
    const filename = formatExportFilename(project.info.name);
    return { success: true, data: { blob, filename } };
  }

  // ── Import ────────────────────────────────────────────────────────────────

  /**
   * Parse and validate a project file.
   * Does NOT write to disk — the caller decides where to save it
   * (native dialog in Electron, download in browser).
   */
  async parseImportFile(file: File): Promise<StorageResult<Project>> {
    try {
      const text = await file.text();
      const raw = JSON.parse(text);
      const project = parseAndRepair(raw);

      if (!project) {
        return {
          success: false,
          error: "Invalid or unrecoverable project file",
        };
      }

      return { success: true, data: project };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Import a project as a new copy (new ID, name suffixed with "(Imported)").
   * Returns the project object — caller saves it.
   */
  async importProjectAsCopy(file: File): Promise<StorageResult<Project>> {
    const result = await this.parseImportFile(file);
    if (!result.success || !result.data) return result;

    const now = new Date().toISOString();
    const imported: Project = {
      ...result.data,
      id: `proj_${Date.now()}`,
      filePath: undefined,
      info: {
        ...result.data.info,
        name: `${result.data.info.name} (Imported)`,
        created: now,
        lastModified: now,
      },
      lastOpened: now,
      isOpen: true,
      hasUnsavedChanges: false,
    };

    return { success: true, data: imported };
  }

  /**
   * Import overwriting an existing project (same ID).
   * Returns the project object — caller saves it.
   */
  async importProjectOverwrite(file: File): Promise<StorageResult<Project>> {
    const result = await this.parseImportFile(file);
    if (!result.success || !result.data) return result;

    const now = new Date().toISOString();
    const imported: Project = {
      ...result.data,
      info: { ...result.data.info, lastModified: now },
      lastOpened: now,
      isOpen: true,
      hasUnsavedChanges: false,
    };

    return { success: true, data: imported };
  }

  // ── Phase status ──────────────────────────────────────────────────────────

  async updatePhaseStatus(
    projectId: string,
    phase: number,
    status: PhaseStatus,
  ): Promise<StorageResult<Project>> {
    const result = await this.getProject(projectId);
    if (!result.success || !result.data) {
      return { success: false, error: "Project not found" };
    }

    const updated: Project = {
      ...result.data,
      phaseStatus: { ...result.data.phaseStatus, [phase]: status },
      info: { ...result.data.info, lastModified: new Date().toISOString() },
    };

    return this.saveProject(updated);
  }
}

export const projectService = new ProjectService();