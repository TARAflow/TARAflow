// ==================== PROJECT REPOSITORY ====================
// Single Responsibility: read and write .tara.json project files.
//
// What belongs here:
//   - Load a project from disk (Electron IPC or File System Access API)
//   - Save a project to disk
//   - Create an empty project object (factory, no I/O)
//   - Strip derived data before writing (delegated to prepare-for-disk)
//
// What does NOT belong here:
//   - Which files exist (that is ProjectRegistry's job)
//   - Business rules (ProjectService's job)
//   - localStorage primitives (StorageService's job)
//   - Schema migration (MigrationService's job)
//
// Browser fallback:
//   When no file is linked (browser mode without File System Access API),
//   save/load silently succeed — the caller (main-layout / useProjectPersistence)
//   handles the download/upload flow instead.

import type { Project } from "../models/project-types";
import type { StorageResult } from "./storage-service";
import { serialiseProject } from "./prepare-for-disk";
import { parseAndRepairWithMetadata } from "./migration-service";
import { projectRegistry } from "./project-registry";
import {
  DEFAULT_PHASE_STATUS,
  DEFAULT_SETTINGS,
} from "./migration-service";
import { EMPTY_PROJECT_TAGS } from "shared";
import { CURRENT_SCHEMA_VERSION } from "./schema-version";

// ==================== HELPERS ====================

function isElectron(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as any).electron?.file !== "undefined"
  );
}

/** POSIX/Windows-safe dirname for a project file path (renderer, no node path). */
function dirnameOf(filePath: string): string {
  const cut = filePath.replace(/[/\\][^/\\]*$/, "");
  return cut.length ? cut : filePath;
}

// ── Signing-key hydration ───────────────────────────────────────────────────
// The on-disk .tara.json deliberately does NOT carry the signing key path / id
// (a per-user, machine-local value stripped by prepare-for-disk). On open we
// re-hydrate it so signing keeps working across sessions.
//
// SOURCE = a resolution chain, extended by PREPENDING a source (never a
// user-facing toggle). Today: git config `user.signingkey`, which resolveGitSigning
// already writes on every commit — the machine-local, git-native home for the key.
//   - format "ssh" → user.signingkey is the key PATH   → signing.sshSigningKeyPath
//   - format "gpg" → user.signingkey is the key ID     → signing.keyId
// LATER (2a): prepend a credential-service lookup:
//   return (await fromCredentialService(id)) ?? (await fromGitConfig(filePath));

/** Read `git config --get user.signingkey` from the file's repo. */
async function fromGitConfig(filePath: string): Promise<string | undefined> {
  try {
    const res = await (window as any).git?.rawInDir(dirnameOf(filePath), [
      "config",
      "--get",
      "user.signingkey",
    ]);
    const value =
      res && res.success ? String(res.data?.stdout ?? "").trim() : "";
    return value || undefined;
  } catch {
    return undefined; // hydration is best-effort — never break a load
  }
}

/** Resolve the signing key for a repo. Extend by prepending sources (see above). */
async function resolveSigningKey(
  filePath: string,
): Promise<string | undefined> {
  return fromGitConfig(filePath);
}

/**
 * Re-hydrate the stripped signing key into a freshly loaded project, in place.
 * No-op unless signing is enabled and the key is currently absent (so an
 * un-stripped legacy file is left untouched). Best-effort: a failure or a repo
 * that has never committed simply leaves the key unset (the user re-picks it).
 */
async function hydrateSigningKey(
  project: Project,
  filePath: string,
): Promise<void> {
  const signing = project.audit?.config?.signing;
  if (!signing || !signing.enabled) return;

  const alreadyHasKey =
    signing.format === "gpg" ? !!signing.keyId : !!signing.sshSigningKeyPath;
  if (alreadyHasKey) return;

  const key = await resolveSigningKey(filePath);
  if (!key) return;

  if (signing.format === "gpg") signing.keyId = key;
  else signing.sshSigningKeyPath = key;
}

// ==================== REPOSITORY CLASS ====================

class ProjectRepository {
  // ── Factory ─────────────────────────────────────────────────────────────

  /**
   * Build a new empty Project object.
   * Pure factory — no I/O, no storage.
   * The caller is responsible for saving after the file dialog completes.
   */
  createEmpty(
    name: string,
    description: string,
    version: string = "1.0",
    responsible: string = "",
    isHighImpact: boolean = false,
  ): Project {
    const now = new Date().toISOString();

    return {
      id: `proj_${Date.now()}`,
      schemaVersion: CURRENT_SCHEMA_VERSION,
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
      hazards: null,
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
    };
  }

  // ── Read ────────────────────────────────────────────────────────────────

  /**
   * Load a project from a known file path (Electron mode).
   * Applies migration + repair pipeline automatically.
   *
   * @param filePath  the .tara.json path
   * @param options.hydrateSigning  re-hydrate the stripped signing key from the
   *   repo (one git call). Enabled for a single open (loadById); left OFF for
   *   the bulk recent-list load (loadAll), which doesn't need signing.
   */
  async loadFromPath(
    filePath: string,
    options: { hydrateSigning?: boolean } = {},
  ): Promise<
    StorageResult<Project & { _migrated?: boolean; _fromVersion?: number }>
  > {
    if (!isElectron()) {
      return { success: false, error: "loadFromPath requires Electron mode" };
    }

    try {
      const result = await (window as any).electron.file.readProject(filePath);

      if (!result.success) {
        return { success: false, error: result.error };
      }

      const raw = JSON.parse(result.data);

      let migrationResult;
      try {
        migrationResult = parseAndRepairWithMetadata(raw);
      } catch (migrationErr: any) {
        // Thrown by applyMigrations when schemaVersion > CURRENT_SCHEMA_VERSION.
        // Surface a clear user-facing error instead of a generic crash.
        return { success: false, error: migrationErr.message };
      }

      if (!migrationResult) {
        return {
          success: false,
          error: `Project at ${filePath} is corrupted and cannot be repaired`,
        };
      }

      const { project, migrated, fromVersion } = migrationResult;
      project.filePath = filePath;

      // Re-hydrate the stripped signing key (only when asked — see options).
      // Done BEFORE the migrated write-back below so the in-memory project the
      // caller edits this session has its key; the write-back re-strips it on
      // disk (prepareForDisk), which is correct and produces no churn.
      if (options.hydrateSigning) {
        await hydrateSigningKey(project, filePath);
      }

      if (migrated) {
        console.info(
          `[ProjectRepository] Migrated project ${project.id} ` +
            `from schema v${fromVersion} → v${CURRENT_SCHEMA_VERSION}: ${filePath}`,
        );

        // Write a backup of the original file before overwriting.
        // Backup path: /path/to/project.tara.json → /path/to/project.tara.v0.backup.json
        const backupPath = filePath.replace(
          /\.tara\.json$/i,
          `.tara.v${fromVersion}.backup.json`,
        );
        try {
          await (window as any).electron.file.writeProject(
            backupPath,
            result.data,
          );
          console.info(`[ProjectRepository] Backup written to: ${backupPath}`);
        } catch (backupErr) {
          // Backup failure is non-fatal — proceed with migration
          console.warn("[ProjectRepository] Backup write failed:", backupErr);
        }

        // Write the migrated file back to disk immediately so the next open
        // does not need to migrate again.
        const payload = serialiseProject(project); // TCS v1 canonical bytes
        await (window as any).electron.file.writeProject(filePath, payload);

        // Return migration metadata so main-layout can show a toast.
        return {
          success: true,
          data: { ...project, _migrated: true, _fromVersion: fromVersion },
        };
      }

      return { success: true, data: project };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Load a project by ID — resolves the file path from the registry first.
   * Convenience wrapper used by main-layout when opening from the recent list.
   * This is a SINGLE open, so the signing key is hydrated.
   */
  async loadById(projectId: string): Promise<StorageResult<Project>> {
    const filePath = await projectRegistry.getFilePath(projectId);

    if (!filePath) {
      return {
        success: false,
        error: `No file path found in registry for project ${projectId}`,
      };
    }

    return this.loadFromPath(filePath, { hydrateSigning: true });
  }

  // ── Write ───────────────────────────────────────────────────────────────

  /**
   * Write a project to its linked file on disk and update the registry.
   *
   * Electron:   writes to project.filePath via IPC, updates registry
   * Browser FS: caller owns the FileSystemFileHandle — this method is not
   *             used in that mode (useProjectPersistence handles it directly)
   * Fallback:   silent success — no file to write, caller downloads if needed
   */
  async save(project: Project): Promise<StorageResult<Project>> {
    if (!isElectron()) {
      // Browser mode: nothing to write here — caller handles download/FS API
      return { success: true, data: project };
    }

    if (!project.filePath) {
      // No file linked yet — project exists only in memory until the save
      // dialog completes. This is not an error.
      return { success: true, data: project };
    }

    try {
      const payload = serialiseProject(project); // TCS v1 canonical bytes
      const result = await (window as any).electron.file.writeProject(
        project.filePath,
        payload,
      );

      if (!result.success) {
        return { success: false, error: result.error };
      }

      // Keep registry in sync — metadata reflects the latest save
      await projectRegistry.upsert(project);

      return { success: true, data: project };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Save a project to a specific path (used after the native save dialog
   * returns a path for a new project).
   * Updates project.filePath in the returned object.
   */
  async saveToPath(
    project: Project,
    filePath: string,
  ): Promise<StorageResult<Project>> {
    const projectWithPath: Project = { ...project, filePath };
    return this.save(projectWithPath);
  }

  // ── Delete ──────────────────────────────────────────────────────────────

  /**
   * Remove a project from the registry.
   * Does NOT delete the .tara.json file from disk — the user owns their files.
   */
  async unregister(projectId: string): Promise<StorageResult<boolean>> {
    try {
      await projectRegistry.remove(projectId);
      return { success: true, data: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  // ── List ────────────────────────────────────────────────────────────────

  /**
   * Load all projects from the registry.
   * Failed/missing files are skipped and removed from the registry.
   * Returns only successfully loaded projects.
   *
   * Signing keys are NOT hydrated here — the recent list only needs project
   * data, and hydration would add a git call per entry. The key is hydrated
   * when a project is actually opened (loadById).
   */
  async loadAll(): Promise<StorageResult<Project[]>> {
    if (!isElectron()) {
      // Browser mode: StorageService handles localStorage-based project list
      return { success: true, data: [] };
    }

    const registryEntries = await projectRegistry.getAll();
    const projects: Project[] = [];
    const failedIds: string[] = [];

    for (const entry of registryEntries) {
      const result = await this.loadFromPath(entry.filePath);
      if (result.success && result.data) {
        projects.push(result.data);
      } else {
        console.warn(
          `[ProjectRepository] Failed to load ${entry.id} from ${entry.filePath}:`,
          result.error,
        );
        failedIds.push(entry.id);
      }
    }

    // Clean up stale registry entries (file deleted/moved by user)
    for (const id of failedIds) {
      await projectRegistry.remove(id);
    }

    return { success: true, data: projects };
  }
}

export const projectRepository = new ProjectRepository();
export default projectRepository;