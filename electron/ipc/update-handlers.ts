// electron/ipc/update-handlers.ts
// ==================== UPDATE CHECK ====================

import { ipcMain } from "electron";
import { handleUpdateCheck } from "../services/update/update-check-main";

export function registerUpdateHandlers() {
  // Notify-only update check (see electron/services/update). Never rejects.
  ipcMain.handle("update:check", (_e, opts) => handleUpdateCheck(opts));
}