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
import { checkComponentDrift, type ComponentDriftOptions, type ComponentDriftStatus } from "./component-drift";
import { resolveComponentPath } from "./component-paths";

/** True when the main-process APIs the import needs are present. */
export function componentImportAvailable(): boolean {
  return !!window.electron?.file?.pickFile && !!window.git?.rawInDir;
}

/** Asks for a component .tara.json; undefined when cancelled. */
export async function pickComponentFile(title: string): Promise<string | undefined> {
  const res = await window.electron?.file?.pickFile({
    title,
    filters: [{ name: "TARAflow project", extensions: ["json"] }],
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
