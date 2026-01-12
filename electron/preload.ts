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
});

console.log("Electron APIs exposed to renderer");
