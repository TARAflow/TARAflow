import { app, BrowserWindow, ipcMain, shell, dialog } from "electron";
import path from "path";
import fs from "fs/promises";
import { registerOAuthProtocol, setupOAuthHandler } from "./oauth-handler";
import simpleGit from "simple-git";
import { GitService } from "./services/git-service-main";
import { credentialService } from "./services/credential-service-main";
import {
  generatePdfBuffer,
  generatePdfFile,
} from "./services/pdf-generator-main";

// ==================== PDF GENERATION ====================

// Generate PDF buffer from HTML
ipcMain.handle(
  "pdf:generateBuffer",
  async (_, html: string, puppeteerOptions: object) => {
    try {
      const buffer = await generatePdfBuffer(html, puppeteerOptions);
      return { success: true, data: buffer };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
);

// Generate PDF file and save
ipcMain.handle(
  "pdf:generateFile",
  async (_, html: string, puppeteerOptions: object, outputPath: string) => {
    try {
      await generatePdfFile(html, puppeteerOptions, outputPath);
      return { success: true, data: outputPath };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
);

// ==================== JIRA PROXY (GEGEN CORS) ====================

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

// ==================== USER DATA PATH ====================

const getUserDataPath = () => app.getPath("userData");
const getRecentProjectsPath = () =>
  path.join(getUserDataPath(), "recent-projects.json");

// ==================== IPC HANDLERS ====================

ipcMain.handle("shell:openExternal", async (_, url: string) => {
  await shell.openExternal(url);
});

// ==================== DRAWIO PLUGIN INJECTION ====================

let cachedDrawioFrame: any = null;

ipcMain.handle("drawio:injectPlugin", async (event) => {
  try {
    const webContents = event.sender;

    // Finde alle frames
    const frames = webContents.mainFrame.frames;
    console.log(
      "[Main] Available frames:",
      frames.map((f) => f.url),
    );

    // Finde DrawIO iframe
    const drawioFrame = frames.find(
      (f) =>
        f.url.includes("embed.diagrams.net") || f.url.includes("diagrams.net"),
    );

    if (!drawioFrame) {
      console.error("[Main] DrawIO frame not found");
      return {
        success: false,
        error: "DrawIO frame not found",
        availableFrames: frames.map((f) => f.url),
      };
    }

    console.log("[Main] Found DrawIO frame:", drawioFrame.url);

    // No polling needed — library loading happens inside Draw.loadPlugin
    // callback which draw.io fires when it is ready. The pluginCode below
    // registers the callback via Draw.loadPlugin(fn) which executes fn(ui)
    // once draw.io initialises — ui is guaranteed available at that point.

    // Plugin Code
    const pluginCode = `
      (function() {
        console.log('[Plugin Injection] Starting...');
        console.log('[Plugin Injection] typeof Draw:', typeof Draw);
        console.log('[Plugin Injection] typeof mxEvent:', typeof mxEvent);
        
        if (typeof Draw === 'undefined') {
          return { 
            success: false, 
            error: 'Draw object not found',
            globals: Object.keys(window).filter(k => k.includes('draw') || k.includes('Draw') || k.includes('mx'))
          };
        }
        
        if (!Draw.loadPlugin) {
          return { 
            success: false, 
            error: 'Draw.loadPlugin not available',
            drawKeys: Object.keys(Draw)
          };
        }
        
        try {
          Draw.loadPlugin(function(ui) {
            Draw._taraflowUi = ui;
            console.log('[Plugin] ✅ Selection Plugin loaded successfully!');

            // Load DFD libraries from customEntries registered via configure message.
            // drawio-controller.ts owns the data — this code only triggers the load
            // once ui is guaranteed available inside the loadPlugin callback.
            setTimeout(function() {
              try {
                var sidebar = ui.sidebar;
                if (!sidebar || !sidebar.customEntries) return;

                // Hide all default palettes from localStorage cache
                Object.keys(sidebar.palettes).forEach(function(k) {
                  if (k === 'search') return;
                  var p = sidebar.palettes[k];
                  if (p && p[0]) p[0].style.display = 'none';
                  if (p && p[1]) p[1].style.display = 'none';
                });

                sidebar.customEntries.forEach(function(group) {
                  (group.entries || []).forEach(function(entry) {
                    (entry.libs || []).slice().reverse().forEach(function(libDef) {
                      if (!libDef.data) return;
                      var title = (libDef.title && (libDef.title.main || libDef.title)) || entry.id;
                      var lib = new LocalLibrary(ui, libDef.data, title);
                      ui.loadLibrary(lib, true);

                      setTimeout(function() {
                        var hash = lib.getHash();
                        var p = sidebar.palettes[hash];
                        if (!p) return;
                        var container = p[1] && p[1].querySelector('.geSidebar');
                        var images = JSON.parse(
                          libDef.data.replace('<mxlibrary>', '').replace('</mxlibrary>', '')
                        );
                        if (container && container.children.length === 0) {
                          ui.addLibraryEntries(images, container);
                        }
                        if (p[0]) p[0].style.display = '';
                        if (p[1]) p[1].style.display = '';
                      }, 200);
                    });
                  });
                });

                console.log('[Plugin] DFD libraries loaded from customEntries');
              } catch(libErr) {
                console.warn('[Plugin] Library load failed:', libErr.message);
              }
            }, 100);

            // Setup selection listener
            ui.editor.graph.getSelectionModel().addListener(mxEvent.CHANGE, function() {
              var cells = ui.editor.graph.getSelectionCells();
              var selection = cells.map(function(c) {
                return { 
                  id: c.id, 
                  value: c.value,
                  type: c.getAttribute ? c.getAttribute('type') : null
                };
              });
              
              console.log('[Plugin] Selection changed:', selection);
              
              window.parent.postMessage(JSON.stringify({
                event: 'selection',
                selection: selection
              }), '*');
            });

            // Viewport restore handler
            window.addEventListener('message', function(evt) {
              try {
                var msg = (typeof evt.data === 'string') ? JSON.parse(evt.data) : evt.data;
                if (msg.action === 'taraflow:setViewport') {
                  var view = ui.editor.graph.view;
                  view.setScale(msg.scale);
                  view.setTranslate(msg.translate.x, msg.translate.y);
                  view.revalidate();
                }
              } catch(e) {}
            }, false);
          });
          
          
          return { success: true, message: 'Plugin loaded successfully' };
        } catch (error) {
          return { 
            success: false, 
            error: 'Plugin load failed: ' + error.message,
            stack: error.stack
          };
        }
      })();
    `;

    // Execute in DrawIO frame
    const result = await drawioFrame.executeJavaScript(pluginCode);
    console.log("[Main] Plugin injection result:", result);

    // Cache frame for setViewport IPC handler
    cachedDrawioFrame = drawioFrame ?? null;

    return result || { success: true };
  } catch (error: any) {
    console.error("[Main] Plugin injection error:", error);
    return {
      success: false,
      error: error.message,
      stack: error.stack,
    };
  }
});

// ==================== DRAWIO SET VIEWPORT ====================

ipcMain.handle(
  "drawio:setViewport",
  async (
    _,
    viewport: {
      translate: { x: number; y: number };
      scale: number;
      scrollLeft?: number;
      scrollTop?: number;
    },
  ) => {
    if (!cachedDrawioFrame)
      return { success: false, error: "No drawio frame cached" };
    try {
      const scale = viewport.scale;
      const tx = viewport.translate.x;
      const ty = viewport.translate.y;
      const sl = viewport.scrollLeft ?? 0;
      const st = viewport.scrollTop ?? 0;

      await cachedDrawioFrame.executeJavaScript(`
      (function() {
        var ui = Draw._taraflowUi;
        if (!ui) { console.warn('[Main:setViewport] No taraflowUi'); return false; }
        var view = ui.editor.graph.view;
        view.setScale(${scale});
        view.setTranslate(${tx}, ${ty});
        if (ui.editor.graph.container) {
          ui.editor.graph.container.scrollLeft = ${sl};
          ui.editor.graph.container.scrollTop = ${st};
        }
        view.revalidate();

        return true;
      })()
    `);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },
);

// ==================== DRAWIO SELECT CELL ====================

ipcMain.handle("drawio:selectCell", async (_, cellId: string) => {
  if (!cachedDrawioFrame)
    return { success: false, error: "No drawio frame cached" };
  try {
    await cachedDrawioFrame.executeJavaScript(`
      (function() {
        var ui = Draw._taraflowUi;
        if (!ui) { console.warn('[Main:selectCell] No taraflowUi'); return false; }
        var graph = ui.editor.graph;
        var cell = graph.model.getCell("${cellId}");
        if (!cell) { console.warn('[Main:selectCell] Cell not found: ${cellId}'); return false; }
        graph.setSelectionCell(cell);
        graph.scrollCellToVisible(cell, true);
        return true;
      })()
    `);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
});

// ==================== DRAWIO GET SCROLL ====================

ipcMain.handle("drawio:getScroll", async () => {
  if (!cachedDrawioFrame) return { scrollLeft: 0, scrollTop: 0 };
  try {
    const result = await cachedDrawioFrame.executeJavaScript(`
      (function() {
        var ui = Draw._taraflowUi;
        if (!ui) return { scrollLeft: 0, scrollTop: 0 };
        var container = ui.editor.graph.container;
        return {
          scrollLeft: container ? container.scrollLeft : 0,
          scrollTop: container ? container.scrollTop : 0
        };
      })()
    `);
    return result || { scrollLeft: 0, scrollTop: 0 };
  } catch (e) {
    return { scrollLeft: 0, scrollTop: 0 };
  }
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
ipcMain.handle("git:stage", (_e, relPaths) => gitService.stage(relPaths));

ipcMain.handle("git:commit", (_e, m, cfg, sign, relPaths) =>
  gitService.commit(m, cfg, sign, relPaths),
);

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

// Raw git in an ARBITRARY directory — for repo discovery (rev-parse) and the
// .gitattributes check (check-attr), which must run in a dir that may not be the
// bound repo (and before any repo is selected). Uses its own simpleGit(dir), but
// stays in the main process, so the "one git path" rule (no git in the renderer)
// still holds. Never throws to the renderer: a non-zero exit is returned as { code }.
ipcMain.handle("git:rawInDir", async (_, dir: string, args: string[]) => {
  try {
    const stdout = await simpleGit(dir).raw(args);
    return { success: true, data: { stdout, stderr: "", code: 0 } };
  } catch (err: any) {
    // simple-git throws on non-zero exit (e.g. rev-parse outside a repo)
    return {
      success: true,
      data: {
        stdout: err?.git?.stdout ?? "",
        stderr: String(err?.message ?? err),
        code: typeof err?.exitCode === "number" ? err.exitCode : 128,
      },
    };
  }
});

// Rebind the bound GitService to the discovered audit repo root. Called on
// project open (after discovery) before any stateful op (commit/branch/push).
ipcMain.handle("git:setRepoPath", async (_, root: string) => {
  try {
    gitService = new GitService(root);
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
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

// ==================== FILE I/O SERVICE ====================

// Save Dialog
ipcMain.handle("file:saveDialog", async (_, defaultName: string) => {
  try {
    const result = await dialog.showSaveDialog({
      title: "Save Project",
      defaultPath: `${defaultName}.tara.json`,
      filters: [
        { name: "TARAflow Projects", extensions: ["tara.json"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });

    if (result.canceled || !result.filePath) {
      return { success: false, error: "Save canceled" };
    }

    return { success: true, data: result.filePath };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Open Dialog
ipcMain.handle("file:openDialog", async () => {
  try {
    const result = await dialog.showOpenDialog({
      title: "Open Project",
      filters: [
        { name: "TARAflow Projects", extensions: ["tara.json"] },
        { name: "All Files", extensions: ["*"] },
      ],
      properties: ["openFile"],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: "Open canceled" };
    }

    return { success: true, data: result.filePaths[0] };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Write Project
ipcMain.handle(
  "file:writeProject",
  async (_, filePath: string, projectData: string) => {
    try {
      await fs.writeFile(filePath, projectData, "utf-8");
      return { success: true, data: filePath };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
);

// Read Project
ipcMain.handle("file:readProject", async (_, filePath: string) => {
  try {
    const data = await fs.readFile(filePath, "utf-8");
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Generic text read — used by the audit feature for .gitattributes (and later
// allowed_signers / hook files). A MISSING file is not an error: it returns
// { success:true, data:null } so callers can distinguish "absent" (→ create it)
// from a real read failure (→ { success:false }).
ipcMain.handle("file:readText", async (_, filePath: string) => {
  try {
    const data = await fs.readFile(filePath, "utf-8");
    return { success: true, data };
  } catch (error: any) {
    if (error?.code === "ENOENT") {
      return { success: true, data: null };
    }
    return { success: false, error: error.message };
  }
});

// Generic text write — counterpart to file:readText.
ipcMain.handle(
  "file:writeText",
  async (_, filePath: string, content: string) => {
    try {
      await fs.writeFile(filePath, content, "utf-8");
      return { success: true, data: filePath };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
);

// ==================== METADATA SERVICE ====================

// Get recent projects metadata
ipcMain.handle("metadata:getRecentProjects", async () => {
  try {
    const metadataPath = getRecentProjectsPath();
    const exists = await fs
      .access(metadataPath)
      .then(() => true)
      .catch(() => false);

    if (!exists) {
      return { success: true, data: [] };
    }

    const data = await fs.readFile(metadataPath, "utf-8");
    const metadata = JSON.parse(data);
    return { success: true, data: metadata };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Save recent projects metadata
ipcMain.handle("metadata:saveRecentProjects", async (_, metadata: any[]) => {
  try {
    const metadataPath = getRecentProjectsPath();

    // Ensure directory exists
    const dir = path.dirname(metadataPath);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(
      metadataPath,
      JSON.stringify(metadata, null, 2),
      "utf-8",
    );
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Remove project from metadata
ipcMain.handle("metadata:removeProject", async (_, projectId: string) => {
  try {
    const result = await ipcMain.emit("metadata:getRecentProjects");
    // This is a simplified version - proper implementation below
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// ==================== WINDOW CREATION ====================

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
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
  });

  mainWindow = win;

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

  // ==================== FIX: beforeunload aus draw.io überspringen ====================
  win.webContents.on("will-prevent-unload", (event) => {
    console.log("[Main] beforeunload blockiert Close – wird übersprungen");
    event.preventDefault();
  });

  // Load app: filesystem in production, Vite dev server in development
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