// ==================== COMPONENT SOURCE — ELECTRON ADAPTERS ====================
// Binds readComponentSource to the main process: file reads through
// window.electron.file, git through the one git path (git:rawInDir). The
// import is an Electron feature (design §2: browser mode not supported).

import { createIpcFileIO, createIpcGitRunner } from "features/audit/services/audit-git-adapters";
import {
  readComponentSource,
  type ComponentSourceResult,
} from "./component-source";

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

/** readComponentSource with the Electron file reader and git runner. */
export function readComponentSourceFromDisk(filePath: string): Promise<ComponentSourceResult> {
  const io = createIpcFileIO();
  return readComponentSource(filePath, (p) => io.read(p), createIpcGitRunner());
}
