// electron/ipc/credential-handlers.ts
// ==================== CREDENTIAL SERVICE ====================

import { ipcMain } from "electron";
import { credentialService } from "../services/credential-service-main";

export function registerCredentialHandlers() {
  // Git Tokens
  ipcMain.handle("credentials:saveGitToken", async (_, account, token) => {
    await credentialService.saveGitToken(account, token);
  });

  ipcMain.handle("credentials:getGitToken", async (_, account) => {
    return await credentialService.getGitToken(account);
  });

  ipcMain.handle("credentials:deleteGitToken", async (_, account) => {
    return await credentialService.deleteGitToken(account);
  });

  // GPG Keys
  ipcMain.handle("credentials:saveGPGKey", async (_, keyId, privateKey) => {
    await credentialService.saveGPGKey(keyId, privateKey);
  });

  ipcMain.handle("credentials:getGPGKey", async (_, keyId) => {
    return await credentialService.getGPGKey(keyId);
  });

  ipcMain.handle("credentials:deleteGPGKey", async (_, keyId) => {
    return await credentialService.deleteGPGKey(keyId);
  });

  ipcMain.handle("credentials:hasGPGKey", async (_, keyId) => {
    return await credentialService.hasGPGKey(keyId);
  });

  // SSH Keys
  ipcMain.handle(
    "credentials:saveSSHKeyPath",
    async (_, identifier, keyPath) => {
      await credentialService.saveSSHKeyPath(identifier, keyPath);
    },
  );

  ipcMain.handle("credentials:getSSHKeyPath", async (_, identifier) => {
    return await credentialService.getSSHKeyPath(identifier);
  });
}