// electron/ipc/jira-handlers.ts
// ==================== JIRA PROXY (GEGEN CORS) ====================

import { ipcMain } from "electron";
import { credentialService } from "../services/credential-service-main";

export function registerJiraHandlers() {
  ipcMain.handle("jira:request", async (_, { url, options }) => {
    try {
      const response = await fetch(url, {
        method: options.method || "GET",
        headers: {
          ...options.headers,
          "User-Agent": "Electron-App",
        },
        body: options.body ?? undefined,
      });

      const text = await response.text();
      let data: any = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }

      return { ok: response.ok, status: response.status, data };
    } catch (error: any) {
      console.error("Jira proxy error:", error);
      return { ok: false, status: 0, error: error.message };
    }
  });

  // Jira Credentials (via OS Keychain)
  ipcMain.handle("jira:saveToken", async (_, { account, token }) => {
    try {
      await credentialService.saveJiraToken(account, token);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("jira:getToken", async (_, { account }) => {
    try {
      const token = await credentialService.getJiraToken(account);
      return { success: true, token };
    } catch (error: any) {
      return { success: false, error: error.message, token: null };
    }
  });

  ipcMain.handle("jira:deleteToken", async (_, { account }) => {
    try {
      await credentialService.deleteJiraToken(account);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}