// electron/ipc/drawio-handlers.ts
// ==================== DRAWIO INTEGRATION ====================
// Everything that talks to the embedded draw.io iframe via
// executeJavaScript(). This is the string-templated JS the bigger refactor
// (typed MessageChannel + self-hosted draw.io) is meant to replace — until
// then, it's at least isolated here instead of living inline in main.ts.

import { ipcMain } from "electron";

let cachedDrawioFrame: any = null;

export function registerDrawioHandlers() {
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
          f.url.includes("embed.diagrams.net") ||
          f.url.includes("diagrams.net"),
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

            // Setup selection listener. Cell ids are only unique within a
            // page, so every selection carries the page it was made on
            // (leveled DFD, design §5.2).
            var currentPageId = function() {
              return ui.currentPage && ui.currentPage.getId ? ui.currentPage.getId() : null;
            };
            var postSelection = function(cells) {
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
                selection: selection,
                pageId: currentPageId()
              }), '*');
            };
            ui.editor.graph.getSelectionModel().addListener(mxEvent.CHANGE, function() {
              postSelection(ui.editor.graph.getSelectionCells());
            });
            // A page switch empties the selection; report it with the new page
            // so TARAflow knows which page the user is looking at.
            ui.editor.addListener('pageSelected', function() {
              postSelection([]);
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

  ipcMain.handle(
    "drawio:selectCell",
    async (_, cellId: string, pageId?: string | null) => {
      if (!cachedDrawioFrame)
        return { success: false, error: "No drawio frame cached" };
      // Ids go into the script as JSON literals, never spliced into code.
      const cellIdJs = JSON.stringify(String(cellId));
      const pageIdJs = JSON.stringify(pageId == null ? null : String(pageId));
      try {
        await cachedDrawioFrame.executeJavaScript(`
        (function() {
          var ui = Draw._taraflowUi;
          if (!ui) { console.warn('[Main:selectCell] No taraflowUi'); return false; }
          var cellId = ${cellIdJs};
          var pageId = ${pageIdJs};
          // Cell ids are page-local (leveled DFD, design §5.2): open the page
          // first if the cell lives on another one.
          if (pageId !== null && ui.pages && ui.currentPage &&
              ui.currentPage.getId() !== pageId) {
            var page = null;
            for (var i = 0; i < ui.pages.length; i++) {
              if (ui.pages[i].getId() === pageId) { page = ui.pages[i]; break; }
            }
            if (!page) { console.warn('[Main:selectCell] Page not found: ' + pageId); return false; }
            ui.selectPage(page);
          }
          var graph = ui.editor.graph;
          var cell = graph.model.getCell(cellId);
          if (!cell) { console.warn('[Main:selectCell] Cell not found: ' + cellId); return false; }
          graph.setSelectionCell(cell);
          graph.scrollCellToVisible(cell, true);
          return true;
        })()
      `);
        return { success: true };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    },
  );

  // Leveled DFD (page tree, 5c): open a draw.io page. The page id goes into
  // the script as a JSON literal.
  ipcMain.handle("drawio:selectPage", async (_, pageId: string) => {
    if (!cachedDrawioFrame)
      return { success: false, error: "No drawio frame cached" };
    const pageIdJs = JSON.stringify(String(pageId));
    try {
      const found = await cachedDrawioFrame.executeJavaScript(`
      (function() {
        var ui = Draw._taraflowUi;
        if (!ui || !ui.pages) return false;
        var pageId = ${pageIdJs};
        if (ui.currentPage && ui.currentPage.getId() === pageId) return true;
        for (var i = 0; i < ui.pages.length; i++) {
          if (ui.pages[i].getId() === pageId) { ui.selectPage(ui.pages[i]); return true; }
        }
        console.warn('[Main:selectPage] Page not found: ' + pageId);
        return false;
      })()
    `);
      return found ? { success: true } : { success: false, error: "Page not found" };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });

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
}