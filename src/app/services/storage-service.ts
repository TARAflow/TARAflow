// ==================== STORAGE SERVICE ====================
// Single Responsibility: localStorage primitives only.
//
// After Phase B this service is intentionally minimal:
//   get / set / delete / list  — raw key-value operations
//   Browser-mode project CRUD  — fallback when no file system is available
//   App settings / metadata    — small non-project data
//
// What was removed in Phase B:
//   isValidProject   → migration-service.ts
//   repairProject    → migration-service.ts
//   updateRecentFile → project-registry.ts
//   getRecentFiles   → project-registry.ts
//   removeRecentFile → project-registry.ts
//   getAllProjects (Electron branch) → project-repository.ts
//   loadProjectFromFile → project-repository.ts
//   saveProject (Electron branch)   → project-repository.ts
//   createEmptyProject → project-repository.ts
//   importProjectFromJSON → project-service.ts
//
// Browser-fallback project storage is intentionally preserved so the
// app can be tested in the browser and so a future browser build is
// possible without rewriting from scratch.

import { migrateProjectTags } from "shared";
import type { ProjectSettingsData } from "features/overview";
import type { Project } from "../models/project-types";
import { parseAndRepair } from "./migration-service";
import { migrateRiskData } from "features/risks";

export interface StorageResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ==================== CONSTANTS ====================

const STORAGE_PREFIX = "taraflow_";
const PROJECT_PREFIX = `${STORAGE_PREFIX}project_`;
const SETTINGS_KEY = `${STORAGE_PREFIX}settings`;

// ==================== STORAGE SERVICE ====================

class StorageService {
  // ── Availability ────────────────────────────────────────────────────────

  private isAvailable(): boolean {
    return (
      typeof window !== "undefined" &&
      typeof window.localStorage !== "undefined"
    );
  }

  private handleError(operation: string, error: any): StorageResult<any> {
    console.error(`[StorageService] ${operation} failed:`, error);
    return {
      success: false,
      error: error?.message ?? `Failed to ${operation}`,
    };
  }

  // ── Primitives ──────────────────────────────────────────────────────────

  async get<T = any>(key: string): Promise<StorageResult<T>> {
    if (!this.isAvailable())
      return this.handleError("get", new Error("localStorage not available"));

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
      return this.handleError("set", new Error("localStorage not available"));

    try {
      localStorage.setItem(key, JSON.stringify(value));
      return { success: true, data: value };
    } catch (error) {
      return this.handleError("set", error);
    }
  }

  async delete(key: string): Promise<StorageResult<boolean>> {
    if (!this.isAvailable())
      return this.handleError(
        "delete",
        new Error("localStorage not available"),
      );

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
      return this.handleError("list", new Error("localStorage not available"));

    try {
      const keys = Object.keys(localStorage).filter((k) =>
        k.startsWith(prefix),
      );
      return { success: true, data: keys };
    } catch (error) {
      return this.handleError("list", error);
    }
  }

  // ── Browser-mode project CRUD ────────────────────────────────────────────
  // Used when running in a browser without Electron.
  // In Electron mode these methods are not called — ProjectRepository handles
  // all file I/O and ProjectRegistry handles the metadata list.

  /**
   * Save a project to localStorage (browser fallback only).
   * In Electron mode callers should use ProjectRepository.save() instead.
   */
  async saveProject(project: Project): Promise<StorageResult<Project>> {
    const toStore: Project = {
      ...project,
      dfd: project.dfd ? { ...project.dfd, graph: undefined } : null,
      hasUnsavedChanges: undefined as any,
    };
    return this.set<Project>(`${PROJECT_PREFIX}${project.id}`, toStore);
  }

  /**
   * Load a project from localStorage (browser fallback only).
   */
  async getProject(projectId: string): Promise<StorageResult<Project>> {
    const result = await this.get<any>(`${PROJECT_PREFIX}${projectId}`);

    if (!result.success || !result.data) {
      return { success: false, error: result.error ?? "Project not found" };
    }

    const project = parseAndRepair(result.data);

    if (!project) {
      return {
        success: false,
        error: "Project is corrupted and cannot be repaired",
      };
    }

    if (project.risks) project.risks = migrateRiskData(project.risks);
    return { success: true, data: project };
  }

  /**
   * Delete a project from localStorage (browser fallback only).
   */
  async deleteProject(projectId: string): Promise<StorageResult<boolean>> {
    return this.delete(`${PROJECT_PREFIX}${projectId}`);
  }

  /**
   * List all project IDs stored in localStorage (browser fallback only).
   */
  async listProjectIds(): Promise<StorageResult<string[]>> {
    const result = await this.list(PROJECT_PREFIX);
    if (!result.success || !result.data) return result;

    return {
      success: true,
      data: result.data.map((key) => key.replace(PROJECT_PREFIX, "")),
    };
  }

  /**
   * Load all projects from localStorage (browser fallback only).
   * Skips and deletes corrupted entries.
   */
  async getAllProjects(): Promise<StorageResult<Project[]>> {
    try {
      const listResult = await this.listProjectIds();
      if (!listResult.success || !listResult.data)
        return { success: false, error: "Failed to list projects" };

      const projects: Project[] = [];
      const failedIds: string[] = [];

      for (const id of listResult.data) {
        const r = await this.getProject(id);
        if (r.success && r.data) {
          projects.push(r.data);
        } else {
          console.warn(
            `[StorageService] Failed to load project ${id}:`,
            r.error,
          );
          failedIds.push(id);
        }
      }

      for (const id of failedIds) {
        console.warn(`[StorageService] Removing corrupted project: ${id}`);
        await this.deleteProject(id);
      }

      return { success: true, data: projects };
    } catch (error) {
      return this.handleError("getAllProjects", error);
    }
  }

  // ── Settings ─────────────────────────────────────────────────────────────

  getSettings<T = any>() {
    return this.get<T>(SETTINGS_KEY);
  }

  saveSettings<T = any>(settings: T) {
    return this.set<T>(SETTINGS_KEY, settings);
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  /**
   * Export a project as a downloadable JSON file (browser mode).
   */
  exportProjectAsJSON(project: Project): void {
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
   * Clears all TARAflow data from localStorage.
   * Use with caution — for dev/testing only.
   */
  async clearAllData(): Promise<StorageResult<boolean>> {
    try {
      const keys = Object.keys(localStorage).filter(
        (k) => k.startsWith(STORAGE_PREFIX) || k.startsWith("taraflow:"),
      );
      keys.forEach((k) => localStorage.removeItem(k));
      return { success: true, data: true };
    } catch (error) {
      return this.handleError("clearAllData", error);
    }
  }

  /**
   * Returns storage usage info for diagnostics.
   */
  getStorageInfo(): { used: number; available: number; projectCount: number } {
    const keys = Object.keys(localStorage).filter((k) =>
      k.startsWith(STORAGE_PREFIX),
    );
    const projectKeys = keys.filter((k) => k.startsWith(PROJECT_PREFIX));
    let used = 0;
    keys.forEach((k) => {
      const item = localStorage.getItem(k);
      if (item) used += item.length * 2;
    });
    return {
      used,
      available: 5 * 1024 * 1024,
      projectCount: projectKeys.length,
    };
  }
}

export const storageService = new StorageService();
export default storageService;