import { app, BrowserWindow, Menu } from "electron";
import path from "path";
import { registerOAuthProtocol, setupOAuthHandler } from "./oauth-handler";
import { buildAppMenu } from "./app-menu";
import { hardenWindowNavigation, makeIsInternalUrl } from "./window-navigation";

import { registerShellHandlers } from "./ipc/shell-handlers";
import { registerPdfHandlers } from "./ipc/pdf-handlers";
import { registerJiraHandlers } from "./ipc/jira-handlers";
import { registerDrawioHandlers } from "./ipc/drawio-handlers";
import { registerGitHandlers } from "./ipc/git-handlers";
import { registerAuditHandlers } from "./ipc/audit-handlers";
import { registerUpdateHandlers } from "./ipc/update-handlers";
import { registerCredentialHandlers } from "./ipc/credential-handlers";
import { registerFileHandlers } from "./ipc/file-handlers";
import { registerMetadataHandlers } from "./ipc/metadata-handlers";

// ==================== IPC REGISTRATION ====================
// Each domain owns its own ipcMain.handle calls (and any private state, e.g.
// git-handlers.ts's bound GitService, drawio-handlers.ts's cached frame).
// main.ts just wires them up once at startup — see electron/ipc/*.ts for the
// actual handler implementations. This file used to be ~900 lines with every
// handler inline; it's app lifecycle + window creation now.
registerShellHandlers();
registerPdfHandlers();
registerJiraHandlers();
registerDrawioHandlers();
registerGitHandlers();
registerAuditHandlers();
registerUpdateHandlers();
registerCredentialHandlers();
registerFileHandlers();
registerMetadataHandlers();

// ==================== WINDOW CREATION ====================

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  const t0 = Date.now();
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: `TARAflow ${app.getVersion()}`,
    icon: path.join(
      __dirname,
      process.platform === "win32"
        ? "../build-resources/icon.ico"
        : "../build-resources/icon.png",
    ),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    // Dev mode shows immediately (old default Electron behavior) — Vite dev
    // serves unbundled modules on demand and typically takes ~2-3s to reach
    // did-finish-load for a dependency-heavy app like this one (confirmed by
    // measurement, not a bug). Waiting on that in dev just turns a harmless
    // brief flash into a multi-second stare at nothing, for no benefit: a
    // packaged build loads a pre-bundled dist/index.html from disk and is
    // fast, which is where the anti-flash dance below actually pays off.
    show: app.isPackaged ? false : true,
  });

  if (app.isPackaged) {
    // "ready-to-show" turned out to not reliably fire in this app at all
    // (confirmed: the fallback below used to fire on *every* dev:electron
    // run — that was actually just dev-mode's inherent ~2-3s Vite load time
    // outrunning the timeout, not a real failure; see the isPackaged check
    // above). "did-finish-load" fires more reliably and races against it;
    // whichever comes first shows the window. The timeout stays as a
    // last-resort safety net for the packaged/FUSE-AppImage case that
    // originally surfaced this (ready-to-show never fired there at all).
    let shown = false;
    const showOnce = (source: string) => {
      if (shown) return;
      shown = true;
      clearTimeout(showFallbackTimer);
      console.log(
        `[Main] showing window (trigger: ${source}, +${Date.now() - t0}ms)`,
      );
      win.show();
    };

    win.once("ready-to-show", () => showOnce("ready-to-show"));
    win.webContents.once("did-finish-load", () => showOnce("did-finish-load"));

    const READY_TO_SHOW_TIMEOUT_MS = 500;
    const showFallbackTimer = setTimeout(() => {
      console.warn(
        `[Main] neither "ready-to-show" nor "did-finish-load" fired within ${READY_TO_SHOW_TIMEOUT_MS}ms — showing window anyway`,
      );
      showOnce("timeout");
    }, READY_TO_SHOW_TIMEOUT_MS);
  }

  // Diagnostics for the underlying cause — if the fallback above ever fires,
  // these logs should show whether the page failed to load, the renderer
  // crashed, or the GPU process died.
  win.webContents.on(
    "did-fail-load",
    (_e, errorCode, errorDescription, validatedURL) => {
      console.error(
        `[Main] did-fail-load: code=${errorCode} desc="${errorDescription}" url=${validatedURL}`,
      );
    },
  );
  win.webContents.on("render-process-gone", (_e, details) => {
    console.error(`[Main] render-process-gone: reason=${details.reason}`);
  });
  app.on("gpu-process-crashed" as any, (_e: unknown, killed: boolean) => {
    console.error(`[Main] gpu-process-crashed: killed=${killed}`);
  });

  win.setTitle(`TARAflow ${app.getVersion()}`);

  mainWindow = win;

  hardenWindowNavigation(win.webContents, makeIsInternalUrl(app.isPackaged));

  // ==================== Force-close: bypass draw.io's iframe beforeunload ====================
  // draw.io (embedded as an iframe) installs window.onbeforeunload as soon as a
  // diagram/project is open. Electron's `will-prevent-unload` does NOT reliably
  // fire for SUBFRAME beforeunload, so on Windows the native X silently hangs
  // once a project is open (no project → no iframe guard → closes fine). Force-
  // destroy on close to skip all unload guards; saving is handled in-app, not via
  // the browser beforeunload. (This makes the `will-prevent-unload` handler below
  // redundant — `close` fires first — but it's kept as harmless belt-and-braces.)
  let allowClose = false;
  win.on("close", (event) => {
    if (allowClose) return;
    event.preventDefault();
    allowClose = true;
    win.destroy();
  });

  // ==================== DISABLE BROWSER ZOOM ====================

  // Block zoom-changed event (pinch / Ctrl+wheel) and reset immediately.
  // Keyboard shortcuts (Ctrl/Cmd + "+"/"-"/"0") are blocked at the source:
  // app-menu.ts builds its own View submenu without the zoom role items, so
  // those accelerators are never registered in the first place.
  win.webContents.on("zoom-changed", (_event, zoomDirection) => {
    console.log(`[Main] Zoom change blocked: ${zoomDirection}`);
    win.webContents.setZoomLevel(0);
  });

  // Set initial zoom
  win.webContents.setZoomLevel(0);
  win.webContents.setZoomFactor(1.0);

  // ==================== FIX: beforeunload aus draw.io überspringen ====================
  win.webContents.on("will-prevent-unload", (event) => {
    console.log("[Main] beforeunload blockiert Close – wird übersprungen");
    event.preventDefault();
  });

  // Load app: filesystem in production, Vite dev server in development
  console.log(`[Main] starting page load (+${Date.now() - t0}ms)`);
  win.webContents.on("did-finish-load", () => {
    console.log(
      `[Main] did-finish-load fired (+${Date.now() - t0}ms) [diagnostic, non-gating]`,
    );
  });
  if (app.isPackaged) {
    // Production: load the built index.html from filesystem — no server needed
    // Renderer lives at dist/ in the project root;
    // inside the AppImage: resources/app/dist/index.html
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  } else {
    // Development: load from Vite dev server
    win.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  }

  // Cleanup on close
  win.on("closed", () => {
    mainWindow = null;
  });
}

registerOAuthProtocol();

app.whenReady().then(() => {
  Menu.setApplicationMenu(buildAppMenu());
  createWindow();
  setupOAuthHandler(() => mainWindow);
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