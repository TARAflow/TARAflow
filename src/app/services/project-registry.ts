// ==================== PROJECT REGISTRY ====================
// Single Responsibility: manage lightweight project metadata.
//
// What belongs here:
//   id, filePath, name, lastOpened, isOpen, status, currentPhase
//
// What does NOT belong here:
//   DFD, assets, threats, risks — those live in the .tara.json file
//   and are loaded by ProjectRepository on demand.
//
// Storage:
//   Electron  → userData/recent-projects.json  (via IPC)
//   Browser   → localStorage key taraflow:registry
//
// The registry is the only place that knows which files exist on disk.
// ProjectRepository reads individual files; it never lists them itself.

import type { Project, ProjectMetadata } from "../models/project-types";

// ==================== CONSTANTS ====================

/** localStorage key for browser-mode registry (replaces the old taraflow_recent_projects) */
const REGISTRY_KEY = "taraflow:registry";

/** Maximum number of entries kept in the registry */
const MAX_REGISTRY_ENTRIES = 20;

// ==================== HELPERS ====================

function isElectron(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as any).electron?.metadata !== "undefined"
  );
}

function projectToMetadata(project: Project): ProjectMetadata {
  return {
    id: project.id,
    filePath: project.filePath ?? "",
    lastOpened: project.lastOpened ?? new Date().toISOString(),
    info: project.info,
    status: project.status,
    currentPhase: project.currentPhase,
    completedPhases: Object.values(project.phaseStatus).filter(
      (s) => s === "complete",
    ).length,
    totalPhases: Object.keys(project.phaseStatus).length,
  };
}

// ==================== REGISTRY CLASS ====================

class ProjectRegistry {

  // ── Read ────────────────────────────────────────────────────────────────

  async getAll(): Promise<ProjectMetadata[]> {
    if (isElectron()) {
      try {
        const result = await (window as any).electron.metadata.getRecentProjects();
        return result.success && result.data ? result.data : [];
      } catch (err) {
        console.error("[ProjectRegistry] getAll (Electron) failed:", err);
        return [];
      }
    }

    // Browser fallback
    try {
      const raw = localStorage.getItem(REGISTRY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  async getById(projectId: string): Promise<ProjectMetadata | null> {
    const all = await this.getAll();
    return all.find((m) => m.id === projectId) ?? null;
  }

  async getFilePath(projectId: string): Promise<string | null> {
    const meta = await this.getById(projectId);
    return meta?.filePath ?? null;
  }

  // ── Write ───────────────────────────────────────────────────────────────

  /**
   * Upsert a project's metadata entry.
   * Called after every successful save to keep the registry in sync.
   * Does NOT write the project file — that is ProjectRepository's job.
   */
  async upsert(project: Project): Promise<void> {
    // In Electron mode we require a filePath — without it the registry
    // entry would be useless (we can't reload the project later).
    if (isElectron() && !project.filePath) {
      console.warn(
        "[ProjectRegistry] upsert skipped — no filePath in Electron mode",
        project.id,
      );
      return;
    }

    const metadata = projectToMetadata(project);
    const all = await this.getAll();

    const updated = [
      metadata,
      ...all.filter((m) => m.id !== project.id),
    ].slice(0, MAX_REGISTRY_ENTRIES);

    await this._persist(updated);
  }

  /**
   * Update only the open/closed status without touching other metadata.
   * Avoids a full project read just to flip isOpen.
   * Note: ProjectMetadata does not currently carry isOpen — the isOpen flag
   * lives in the .tara.json file itself and is synced via upsert() on save.
   * This method is a no-op placeholder for when isOpen is promoted to the
   * registry schema (Phase D).
   */
  async markOpen(_projectId: string, _isOpen: boolean): Promise<void> {
    // Reserved for Phase D — no-op for now.
  }

  async remove(projectId: string): Promise<void> {
    const all = await this.getAll();
    const filtered = all.filter((m) => m.id !== projectId);
    await this._persist(filtered);
  }

  // ── Persistence ─────────────────────────────────────────────────────────

  private async _persist(entries: ProjectMetadata[]): Promise<void> {
    if (isElectron()) {
      try {
        await (window as any).electron.metadata.saveRecentProjects(entries);
      } catch (err) {
        console.error("[ProjectRegistry] _persist (Electron) failed:", err);
      }
      return;
    }

    // Browser fallback
    try {
      localStorage.setItem(REGISTRY_KEY, JSON.stringify(entries));
    } catch (err) {
      console.error("[ProjectRegistry] _persist (Browser) failed:", err);
    }
  }

  // ── Migration helpers ────────────────────────────────────────────────────

  /**
   * One-time migration from the old taraflow_recent_projects key.
   * Call once on app start. Safe to call multiple times (idempotent).
   *
   * This preserves Browser-mode data from before Phase B so existing
   * users don't lose their project history.
   */
  async migrateFromLegacyKey(): Promise<void> {
    const LEGACY_KEY = "taraflow_recent_projects";

    // Already migrated?
    const existing = localStorage.getItem(REGISTRY_KEY);
    if (existing) return;

    const legacy = localStorage.getItem(LEGACY_KEY);
    if (!legacy) return;

    try {
      const data = JSON.parse(legacy);
      if (Array.isArray(data) && data.length > 0) {
        localStorage.setItem(REGISTRY_KEY, legacy);
        console.info(
          `[ProjectRegistry] Migrated ${data.length} entries from legacy key`,
        );
      }
    } catch {
      // Corrupt legacy data — ignore
    }
  }
}

export const projectRegistry = new ProjectRegistry();
export default projectRegistry;