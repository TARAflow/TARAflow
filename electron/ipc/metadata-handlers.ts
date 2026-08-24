// electron/ipc/metadata-handlers.ts
// ==================== METADATA SERVICE (Recent Projects) ====================

import { app, ipcMain } from "electron";
import fs from "fs/promises";
import path from "path";

const getUserDataPath = () => app.getPath("userData");
const getRecentProjectsPath = () =>
  path.join(getUserDataPath(), "recent-projects.json");

export function registerMetadataHandlers() {
  // Get recent projects metadata
  ipcMain.handle("metadata:getRecentProjects", async () => {
    try {
      const metadataPath = getRecentProjectsPath();
      const exists = await fs
        .access(metadataPath)
        .then(() => true)
        .catch(() => false);

      if (!exists) {
        return { success: true, data: [] };
      }

      const data = await fs.readFile(metadataPath, "utf-8");
      const metadata = JSON.parse(data);
      return { success: true, data: metadata };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Save recent projects metadata
  ipcMain.handle("metadata:saveRecentProjects", async (_, metadata: any[]) => {
    try {
      const metadataPath = getRecentProjectsPath();

      // Ensure directory exists
      const dir = path.dirname(metadataPath);
      await fs.mkdir(dir, { recursive: true });

      await fs.writeFile(
        metadataPath,
        JSON.stringify(metadata, null, 2),
        "utf-8",
      );
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Remove project from metadata.
  //
  // NOTE: confirmed unused by the renderer (grep -rn "removeProject" src/ only
  // hits global.d.ts's type declaration, no actual caller). The previous
  // implementation was a dead stub anyway — it called
  // `ipcMain.emit("metadata:getRecentProjects")` (doesn't invoke the handler
  // or return its result) and unconditionally returned `{ success: true }`
  // without touching the file. Fixed here to actually filter by id, matching
  // ProjectMetadata.id (src/.../project-types.ts) — but since nothing calls
  // this yet, that's for whenever it does get wired up in the renderer.
  ipcMain.handle("metadata:removeProject", async (_, projectId: string) => {
    try {
      const metadataPath = getRecentProjectsPath();
      const exists = await fs
        .access(metadataPath)
        .then(() => true)
        .catch(() => false);

      if (!exists) {
        return { success: true };
      }

      const data = await fs.readFile(metadataPath, "utf-8");
      const metadata = JSON.parse(data);
      const filtered = Array.isArray(metadata)
        ? metadata.filter((item: any) => item?.id !== projectId)
        : metadata;

      await fs.writeFile(
        metadataPath,
        JSON.stringify(filtered, null, 2),
        "utf-8",
      );
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
