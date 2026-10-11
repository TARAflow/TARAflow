// app/services/project-migration-open.ts
//
// The single place where a migration found on load becomes a file change.
// Loading never writes (project-repository.loadFromPath); only opening one
// project does, and only after `confirm` agreed. Used by both open paths
// (recent list and file dialog).

import type { Project } from "../models/project-types";
import { CURRENT_SCHEMA_VERSION } from "./schema-version";
import { migrationBackupPath, type LoadedProject } from "./project-repository";

export interface MigrationPrompt {
  projectName: string;
  filePath: string;
  fromVersion: number;
  toVersion: number;
  backupPath: string;
}

export type ConfirmMigration = (prompt: MigrationPrompt) => Promise<boolean>;

export type CommitMigration = (
  filePath: string,
  project: Project,
  fromVersion: number,
  originalText: string,
) => Promise<{ success: boolean; error?: string }>;

export type OpenMigrationResult =
  | { status: "unchanged"; project: Project }
  | { status: "migrated"; project: Project; fromVersion: number; backupPath: string }
  | { status: "cancelled" }
  | { status: "failed"; error: string };

/** Strips the load metadata; returns the plain project. */
export function stripLoadMetadata(loaded: LoadedProject): Project {
  const { _migrated, _fromVersion, _originalText, ...project } = loaded;
  return project as Project;
}

/**
 * Settles a loaded project before it is opened. Not migrated → unchanged.
 * Migrated → ask (when `confirm` is given), then backup + write via `commit`.
 */
export async function settleMigrationOnOpen(
  loaded: LoadedProject,
  commit: CommitMigration,
  confirm?: ConfirmMigration,
): Promise<OpenMigrationResult> {
  const project = stripLoadMetadata(loaded);
  if (!loaded._migrated) return { status: "unchanged", project };

  const filePath = loaded.filePath;
  const fromVersion = loaded._fromVersion ?? 0;
  if (!filePath || loaded._originalText === undefined) {
    return { status: "failed", error: "Migrated project has no file to convert" };
  }
  const backupPath = migrationBackupPath(filePath, fromVersion);

  if (confirm) {
    const ok = await confirm({
      projectName: project.info?.name ?? "",
      filePath,
      fromVersion,
      toVersion: CURRENT_SCHEMA_VERSION,
      backupPath,
    });
    if (!ok) return { status: "cancelled" };
  }

  const result = await commit(filePath, project, fromVersion, loaded._originalText);
  if (!result.success) {
    return { status: "failed", error: result.error ?? "Conversion failed" };
  }
  return { status: "migrated", project, fromVersion, backupPath };
}
