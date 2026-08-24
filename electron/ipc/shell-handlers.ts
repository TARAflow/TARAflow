// electron/ipc/shell-handlers.ts
// ==================== SHELL ====================

import { ipcMain, shell } from "electron";

export function registerShellHandlers() {
  ipcMain.handle("shell:openExternal", async (_, url: string) => {
    await shell.openExternal(url);
  });
}