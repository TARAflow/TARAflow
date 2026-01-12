import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "path";
import { registerOAuthProtocol, setupOAuthHandler } from "./oauth-handler";

// ==================== IPC HANDLERS ====================

ipcMain.handle("shell:openExternal", async (_, url: string) => {
  await shell.openExternal(url);
});

// ==================== Helper ====================

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
    mainWindow = null; // ← Reset
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
