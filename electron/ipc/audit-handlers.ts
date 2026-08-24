// electron/ipc/audit-handlers.ts
// ==================== AUDIT VERIFICATION ====================
// Engine runs here in main (it spawns git); renderer gets only the result.
// Falls back to the bound audit repo (git:setRepoPath, tracked in
// git-handlers.ts) when no repoPath is passed.

import { ipcMain } from "electron";
import { runAuditVerify } from "../services/audit-verify-main";
import { getGitService } from "./git-handlers";

export function registerAuditHandlers() {
  ipcMain.handle("audit:verify", async (_e, params) => {
    return runAuditVerify(params, getGitService()?.getRepoPath());
  });
}