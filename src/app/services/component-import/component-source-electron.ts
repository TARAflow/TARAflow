// ==================== COMPONENT SOURCE — ELECTRON ADAPTERS ====================
// Binds readComponentSource to the main process: file reads through
// window.electron.file, git through the one git path (git:rawInDir). The
// import is an Electron feature (design §2: browser mode not supported).

import { createIpcFileIO, createIpcGitRunner } from "features/audit/services/audit-git-adapters";
import {
  readComponentSource,
  type ComponentSourceResult,
} from "./component-source";
import type { ComponentImport } from "shared";
import { checkComponentDrift, readNewerComponentState, type ComponentDriftOptions, type ComponentDriftStatus } from "./component-drift";
import { resolveComponentPath } from "./component-paths";

/** True when the main-process APIs the import needs are present. */
export function componentImportAvailable(): boolean {
  return !!window.electron?.file?.pickFile && !!window.git?.rawInDir;
}

/** The folder of a file path (either separator); undefined without one. */
export function folderOf(filePath: string | undefined): string | undefined {
  if (!filePath) return undefined;
  const i = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
  return i > 0 ? filePath.slice(0, i) : undefined;
}

/**
 * Asks for a component .tara.json; undefined when cancelled. Starts in the
 * machine's folder (manual test 2026-11-19: the dialog opened in Downloads,
 * while components mostly lie next to the machine, in its repository).
 */
export async function pickComponentFile(title: string, machineFilePath?: string): Promise<string | undefined> {
  const folder = folderOf(machineFilePath);
  const res = await window.electron?.file?.pickFile({
    title,
    filters: [{ name: "TARAflow project", extensions: ["json"] }],
    ...(folder ? { defaultPath: folder } : {}),
  });
  return res?.success && res.data ? res.data : undefined;
}

/**
 * readComponentSource with the Electron file reader and git runner;
 * machineFilePath tells whether the component lies in the machine's repository.
 */
export function readComponentSourceFromDisk(
  filePath: string,
  machineFilePath?: string,
): Promise<ComponentSourceResult> {
  const io = createIpcFileIO();
  return readComponentSource(filePath, (p) => io.read(p), createIpcGitRunner(), { machineFilePath });
}

/** The drift check (phase 5a) with the Electron file reader and git runner. */
export async function checkComponentDriftOnDisk(
  imported: ComponentImport,
  machineFilePath: string | undefined,
  options: ComponentDriftOptions = {},
): Promise<ComponentDriftStatus> {
  const git = createIpcGitRunner();
  const io = createIpcFileIO();
  const localPath = await resolveComponentPath(imported.componentId, imported.source, machineFilePath, git);
  return checkComponentDrift(imported, localPath, (p) => io.read(p), git, options);
}

/** The newer state the drift check found, read for the update (phase 5c) with the Electron adapters. */
export async function readNewerComponentStateOnDisk(
  imported: ComponentImport,
  machineFilePath: string | undefined,
  status: Extract<ComponentDriftStatus, { kind: "newer_available" }>,
): Promise<ComponentSourceResult> {
  const git = createIpcGitRunner();
  const io = createIpcFileIO();
  const localPath = await resolveComponentPath(imported.componentId, imported.source, machineFilePath, git);
  if (!localPath) return { ok: false, error: "not_found", detail: "path unknown" };
  return readNewerComponentState(imported, localPath, status, (p) => io.read(p), git);
}
