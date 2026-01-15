import { contextBridge, ipcRenderer, webFrame } from "electron";

console.log("=== PRELOAD LOADED ===");

// ==================== DISABLE BROWSER ZOOM ====================

// Disable pinch-to-zoom
webFrame.setVisualZoomLevelLimits(1, 1);

// Lock zoom level to 0 (100%)
webFrame.setZoomLevel(0);

console.log("Browser zoom disabled, draw.io can handle its own zoom");

// ==================== EXPOSE ELECTRON APIs ====================

contextBridge.exposeInMainWorld("electron", {
  // Shell API (für externe Links)
  shell: {
    openExternal: (url: string) =>
      ipcRenderer.invoke("shell:openExternal", url),
  },

  // OAuth API (für Deep Link Callbacks)
  oauth: {
    onCallback: (callback: (data: any) => void) => {
      ipcRenderer.on("oauth-callback", (_, data) => callback(data));
    },
    removeCallback: () => {
      ipcRenderer.removeAllListeners("oauth-callback");
    },
  },

  // Repository
  isRepository: () => ipcRenderer.invoke("git:isRepository"),
  initRepository: () => ipcRenderer.invoke("git:initRepository"),

  // Status
  getStatus: () => ipcRenderer.invoke("git:getStatus"),

  // Commit
  stageAll: () => ipcRenderer.invoke("git:stageAll"),
  commit: (message: string, config: any) =>
    ipcRenderer.invoke("git:commit", message, config),

  // Branches
  getBranches: () => ipcRenderer.invoke("git:getBranches"),
  getCurrentBranch: () => ipcRenderer.invoke("git:getCurrentBranch"),
  createBranch: (name: string, checkout: boolean) =>
    ipcRenderer.invoke("git:createBranch", name, checkout),
  checkoutBranch: (name: string) =>
    ipcRenderer.invoke("git:checkoutBranch", name),

  // Remote
  addRemote: (name: string, url: string) =>
    ipcRenderer.invoke("git:addRemote", name, url),
  remoteExists: (name: string) => ipcRenderer.invoke("git:remoteExists", name),
  push: (remote: string, branch: string, config: any) =>
    ipcRenderer.invoke("git:push", remote, branch, config),
});

console.log("Electron APIs exposed to renderer");
