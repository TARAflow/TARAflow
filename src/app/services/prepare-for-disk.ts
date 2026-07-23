// ==================== PREPARE FOR DISK ====================
// Single Responsibility: decide what a .tara.json is allowed to contain.
//
// WHY THIS IS ITS OWN MODULE
// --------------------------
// This logic used to live privately inside project-repository.ts, which meant
// only the repository's two write paths applied it. Every other writer —
// useProjectPersistence (Electron IPC, File System Access, download),
// useProjectFileDownload, projectService.exportProject,
// storageService.exportProjectAsJSON — called JSON.stringify(project) directly
// and shipped the runtime-only fields to disk.
//
// The concrete leak: `filePath` is the absolute path of the file on the
// author's machine. It ended up inside committed test fixtures and tripped the
// pre-commit secret scan; more importantly, every project file handed to a
// customer or attached to an audit carried the author's local directory layout.
// `hasUnsavedChanges` (a UI flag) and the recomputed `dfd.graph` (large, and
// rebuilt on load anyway) rode along the same way.
//
// It cannot live in project-repository.ts and be shared, because
// storage-service.ts needs it too and project-repository already imports from
// storage-service — exporting it there would close an import cycle.
//
// RULE: nothing writes or exports a Project without going through here.
// Adding a runtime-only field to Project means adding it to the Omit below.

import type { Project } from "../models/project-types";

/** A Project as it may appear in a .tara.json — runtime-only fields removed. */
export type ProjectOnDisk = Omit<Project, "hasUnsavedChanges" | "filePath">;

/**
 * Strip runtime-only and derived data from a project before it leaves the app.
 *
 * - `filePath`            where this file happens to live on THIS machine; set
 *                         again on load, and a privacy leak when shared.
 * - `hasUnsavedChanges`   UI state; meaningless once written.
 * - `dfd.graph`           derived, rebuilt on load, and large.
 *
 * Pure: returns a new object, mutates nothing. The in-memory project keeps its
 * filePath — it is needed for the next save.
 */
export function prepareForDisk(project: Project): ProjectOnDisk {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { hasUnsavedChanges, filePath, ...rest } = project;
  return {
    ...rest,
    dfd: project.dfd ? { ...project.dfd, graph: undefined } : null,
  };
}

/**
 * The canonical on-disk representation: prepareForDisk + the formatting every
 * writer was duplicating. Use this instead of JSON.stringify(project, null, 2).
 */
export function serialiseProject(project: Project): string {
  return JSON.stringify(prepareForDisk(project), null, 2);
}
