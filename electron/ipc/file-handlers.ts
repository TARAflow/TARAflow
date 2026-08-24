// electron/ipc/file-handlers.ts
// ==================== FILE I/O SERVICE ====================

import {
  ipcMain,
  BrowserWindow,
  dialog,
  type OpenDialogOptions,
} from "electron";
import fs from "fs/promises";
import path from "path";
import { homedir } from "os";

export function registerFileHandlers() {
  // Save Dialog
  ipcMain.handle("file:saveDialog", async (event, defaultName: string) => {
    try {
      const parentWindow = BrowserWindow.fromWebContents(event.sender);
      const options = {
        title: "Save Project",
        defaultPath: `${defaultName}.tara.json`,
        filters: [
          { name: "TARAflow Projects", extensions: ["tara.json"] },
          { name: "All Files", extensions: ["*"] },
        ],
      };
      const result = parentWindow
        ? await dialog.showSaveDialog(parentWindow, options)
        : await dialog.showSaveDialog(options);

      if (result.canceled || !result.filePath) {
        return { success: false, error: "Save canceled" };
      }

      return { success: true, data: result.filePath };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Generic single-file picker (SSH keys, allowed_signers pubkeys, …).
  // Distinct from file:openDialog on purpose: that one is project-specific
  // (title, tara.json filter, no hidden files). Key files live in ~/.ssh — a
  // DOT-dir you can't enter without showHiddenFiles. `~` is expanded here
  // since the renderer has no homedir.
  ipcMain.handle("file:pickFile", async (event, options) => {
    try {
      const expandHome = (p: string | undefined) =>
        p && p.startsWith("~") ? homedir() + p.slice(1) : p;

      const parentWindow = BrowserWindow.fromWebContents(event.sender);
      const dialogOptions: OpenDialogOptions = {
        title: options?.title ?? "Select file",
        defaultPath: expandHome(options?.defaultPath),
        buttonLabel: options?.buttonLabel,
        filters: options?.filters,
        properties: ["openFile", "showHiddenFiles", "dontAddToRecent"],
      };
      const result = parentWindow
        ? await dialog.showOpenDialog(parentWindow, dialogOptions)
        : await dialog.showOpenDialog(dialogOptions);

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: "canceled" };
      }
      return { success: true, data: result.filePaths[0] };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Open Dialog
  ipcMain.handle("file:openDialog", async (event) => {
    try {
      const parentWindow = BrowserWindow.fromWebContents(event.sender);
      const options: OpenDialogOptions = {
        title: "Open Project",
        filters: [
          { name: "TARAflow Projects", extensions: ["tara.json"] },
          { name: "All Files", extensions: ["*"] },
        ],
        properties: ["openFile"],
      };
      const result = parentWindow
        ? await dialog.showOpenDialog(parentWindow, options)
        : await dialog.showOpenDialog(options);

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: "Open canceled" };
      }

      return { success: true, data: result.filePaths[0] };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Write Project
  ipcMain.handle(
    "file:writeProject",
    async (_, filePath: string, projectData: string) => {
      try {
        await fs.writeFile(filePath, projectData, "utf-8");
        return { success: true, data: filePath };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );

  // Read Project
  ipcMain.handle("file:readProject", async (_, filePath: string) => {
    try {
      const data = await fs.readFile(filePath, "utf-8");
      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Generic text read — used by the audit feature for .gitattributes (and
  // later allowed_signers / hook files). A MISSING file is not an error: it
  // returns { success:true, data:null } so callers can distinguish "absent"
  // (→ create it) from a real read failure (→ { success:false }).
  ipcMain.handle("file:readText", async (_, filePath: string) => {
    try {
      const data = await fs.readFile(filePath, "utf-8");
      return { success: true, data };
    } catch (error: any) {
      if (error?.code === "ENOENT") {
        return { success: true, data: null };
      }
      return { success: false, error: error.message };
    }
  });

  // Generic text write — counterpart to file:readText.
  ipcMain.handle(
    "file:writeText",
    async (_, filePath: string, content: string) => {
      try {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, content, "utf-8");
        return { success: true, data: filePath };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  );

  // Make a file executable (git hooks need +x on Unix; harmless on Windows).
  ipcMain.handle("file:makeExecutable", async (_, filePath: string) => {
    try {
      await fs.chmod(filePath, 0o755);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}