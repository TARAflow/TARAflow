import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "path";
import { registerOAuthProtocol, setupOAuthHandler } from "./oauth-handler";
import { GitService } from "./services/git-service-main";
import { credentialService } from "./services/credential-service-main";

// ==================== IPC HANDLERS ====================

ipcMain.handle("shell:openExternal", async (_, url: string) => {
  await shell.openExternal(url);
});

// ==================== GIT SERVICE ====================

let gitService: GitService;

// Repository
ipcMain.handle("git:isRepository", async () => {
  if (!gitService) gitService = new GitService(".");
  return await gitService.isRepository();
});

ipcMain.handle("git:initRepository", async () => {
  if (!gitService) gitService = new GitService(".");
  return await gitService.initRepository();
});

// Status
ipcMain.handle("git:getStatus", async () => {
  return await gitService.getStatus();
});

ipcMain.handle("git:isClean", async () => {
  return await gitService.isClean();
});

// Commit
ipcMain.handle("git:stageAll", async () => {
  return await gitService.stageAll();
});

ipcMain.handle("git:commit", async (_, message, config) => {
  return await gitService.commit(message, config);
});

// Branches
ipcMain.handle("git:getBranches", async () => {
  return await gitService.getBranches();
});

ipcMain.handle("git:getCurrentBranch", async () => {
  return await gitService.getCurrentBranch();
});

ipcMain.handle("git:createBranch", async (_, name, checkout) => {
  return await gitService.createBranch(name, checkout);
});

ipcMain.handle("git:checkoutBranch", async (_, name) => {
  return await gitService.checkoutBranch(name);
});

ipcMain.handle("git:branchExists", async (_, name) => {
  return await gitService.branchExists(name);
});

// Remote
ipcMain.handle("git:addRemote", async (_, name, url) => {
  return await gitService.addRemote(name, url);
});

ipcMain.handle("git:getRemotes", async () => {
  return await gitService.getRemotes();
});

ipcMain.handle("git:remoteExists", async (_, name) => {
  return await gitService.remoteExists(name);
});

// Push
ipcMain.handle("git:push", async (_, remote, branch, config) => {
  return await gitService.push(remote, branch, config);
});

// Log
ipcMain.handle("git:getLog", async (_, maxCount) => {
  return await gitService.getLog(maxCount);
});

ipcMain.handle("git:getLatestCommit", async () => {
  return await gitService.getLatestCommit();
});

// Diff
ipcMain.handle("git:getDiff", async (_, filePath) => {
  return await gitService.getDiff(filePath);
});

// Raw
ipcMain.handle("git:raw", async (_, command) => {
  return await gitService.raw(command);
});

// ==================== CREDENTIAL SERVICE ====================

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
ipcMain.handle("credentials:saveSSHKeyPath", async (_, identifier, keyPath) => {
  await credentialService.saveSSHKeyPath(identifier, keyPath);
});

ipcMain.handle("credentials:getSSHKeyPath", async (_, identifier) => {
  return await credentialService.getSSHKeyPath(identifier);
});

// ==================== WINDOW CREATION ====================

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow = win;

  // ==================== DISABLE BROWSER ZOOM ====================

  // Block zoom-changed event and reset immediately
  win.webContents.on("zoom-changed", (_event, zoomDirection) => {
    console.log(`[Main] Zoom change blocked: ${zoomDirection}`);
    win.webContents.setZoomLevel(0);
  });

  // Periodically enforce zoom level (catches edge cases)
  const enforceZoom = () => {
    if (!win.isDestroyed()) {
      const currentZoom = win.webContents.getZoomLevel();
      if (currentZoom !== 0) {
        console.log(`[Main] Resetting zoom from ${currentZoom} to 0`);
        win.webContents.setZoomLevel(0);
      }
    }
  };

  const zoomInterval = setInterval(enforceZoom, 100);

  win.on("closed", () => {
    clearInterval(zoomInterval);
  });

  // Set initial zoom
  win.webContents.setZoomLevel(0);
  win.webContents.setZoomFactor(1.0);

  // Load Vite Dev Server
  win.loadURL("http://localhost:5173");
  win.webContents.openDevTools();

  // Cleanup on close
  win.on("closed", () => {
    clearInterval(zoomInterval);
    mainWindow = null;
  });
}

registerOAuthProtocol();

app.whenReady().then(() => {
  createWindow();
  setupOAuthHandler(mainWindow);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});