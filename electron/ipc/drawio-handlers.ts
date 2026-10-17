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

            // Diagnosis for the leveled-DFD page features (5c, 5d).
            console.log('[Plugin] page API:', JSON.stringify({
              pages: ui.pages ? ui.pages.length : null,
              createPage: typeof ui.createPage,
              insertPage: typeof ui.insertPage,
              selectPage: typeof ui.selectPage,
              createTabForPage: typeof ui.createTabForPage,
              updateTabContainer: typeof ui.updateTabContainer,
              RenamePage: typeof RenamePage,
              setLinkForCell: typeof ui.editor.graph.setLinkForCell
            }));

            // Page tabs (leveled DFD 5c): TARAflow decorates draw.io's own
            // tab bar — a tooltip and a finding badge per page — instead of
            // a second page tree. The info is pushed by drawio:setPageTabInfo;
            // without it, or in a draw.io without updateTabContainer, the
            // tabs stay as they are.
            // draw.io caches page tabs (btPageTabCache) and resets a reused
            // tab's title to the page name, so the decoration runs after
            // every updateTabContainer over all tabs (data-index → page).
            var decorateTabs = function() {
              var info = Draw._taraflowPageTabInfo || {};
              var container = ui.tabContainer;
              if (!container || !ui.pages) return;
              var tabs = container.querySelectorAll('.gePageTab');
              for (var i = 0; i < tabs.length; i++) {
                var tab = tabs[i];
                var page = ui.pages[parseInt(tab.getAttribute('data-index'), 10)];
                var old = tab.querySelector('[data-taraflow-badge]');
                if (old) old.parentNode.removeChild(old);
                var pageInfo = page && page.getId ? info[page.getId()] : null;
                if (!pageInfo) continue;
                tab.setAttribute('title', pageInfo.title);
                if (pageInfo.badge) {
                  var badge = document.createElement('span');
                  badge.textContent = String(pageInfo.badge.count);
                  badge.setAttribute('data-taraflow-badge', pageInfo.badge.severity);
                  badge.style.cssText =
                    'display:inline-block;min-width:14px;padding:0 4px;margin-left:4px;' +
                    'border-radius:7px;font-size:10px;line-height:14px;text-align:center;' +
                    'color:#fff;background:' +
                    (pageInfo.badge.severity === 'error' ? '#d32f2f' : '#ed6c02') + ';';
                  tab.appendChild(badge);
                }
              }
            };
            Draw._taraflowDecorateTabs = decorateTabs;
            if (typeof ui.updateTabContainer === 'function') {
              var updateTabs = ui.updateTabContainer;
              ui.updateTabContainer = function() {
                var result = updateTabs.apply(this, arguments);
                try { decorateTabs(); } catch (e) {
                  console.warn('[Plugin] Page tab decoration failed:', e);
                }
                return result;
              };
            }

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

  // Leveled DFD (5c): tooltip and finding badge per page tab, see the
  // createTabForPage wrapper in the plugin. The info goes into the script as
  // a JSON literal.
  ipcMain.handle(
    "drawio:setPageTabInfo",
    async (_, info: Record<string, unknown> | null) => {
      if (!cachedDrawioFrame)
        return { success: false, error: "No drawio frame cached" };
      const infoJs = JSON.stringify(info ?? {});
      try {
        await cachedDrawioFrame.executeJavaScript(`
        (function() {
          Draw._taraflowPageTabInfo = ${infoJs};
          var ui = Draw._taraflowUi;
          if (ui && typeof ui.updateTabContainer === 'function') ui.updateTabContainer();
          else if (Draw._taraflowDecorateTabs) Draw._taraflowDecorateTabs();
          return true;
        })()
      `);
        return { success: true };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    },
  );

  // Leveled DFD (5d, D15–D17; 5e): create child pages, set the page link on
  // the multiprocess cells, rename pages, remove pages. Planned by planPageSync in the
  // renderer; the spec goes into the script as a JSON literal. Idempotent:
  // an existing page is not created twice, a page with the wanted name is
  // not renamed. The user's page is shown again afterwards.
  ipcMain.handle("drawio:syncPages", async (_, spec: unknown) => {
    if (!cachedDrawioFrame)
      return { success: false, error: "No drawio frame cached" };
    const specJs = JSON.stringify(spec ?? {});
    try {
      const result = await cachedDrawioFrame.executeJavaScript(`
      (function() {
        var spec = ${specJs};
        var ui = Draw._taraflowUi;
        if (!ui || !ui.pages || typeof ui.createPage !== 'function' ||
            typeof ui.insertPage !== 'function' || typeof ui.selectPage !== 'function') {
          return {
            success: false,
            error: 'draw.io page API not available',
            api: ui ? {
              pages: ui.pages ? ui.pages.length : null,
              createPage: typeof ui.createPage,
              insertPage: typeof ui.insertPage,
              selectPage: typeof ui.selectPage,
              RenamePage: typeof RenamePage
            } : 'no ui'
          };
        }
        var find = function(id) {
          for (var i = 0; i < ui.pages.length; i++) {
            if (ui.pages[i].getId() === id) return ui.pages[i];
          }
          return null;
        };
        var show = function(page) {
          if (page && ui.currentPage !== page) ui.selectPage(page);
        };
        var userPage = ui.currentPage;
        var created = [];
        var errors = [];
        try {
          (spec.create || []).forEach(function(c) {
            if (!find(c.pageId)) {
              var page = ui.createPage(c.name, c.pageId);
              // insertPage does nothing while the graph is not editable.
              ui.insertPage(page, ui.pages.length);
              if (!find(c.pageId)) {
                errors.push('page not inserted (diagram not editable?): ' + c.name);
                return;
              }
              created.push(c.pageId);
            }
            (c.links || []).forEach(function(ref) {
              var host = find(ref.pageId);
              if (!host) { errors.push('page not found: ' + ref.pageId); return; }
              show(host);
              var graph = ui.editor.graph;
              var cell = graph.model.getCell(ref.cellId);
              if (!cell) { errors.push('cell not found: ' + ref.cellId); return; }
              graph.setLinkForCell(cell, 'data:page/id,' + c.pageId);
            });
          });
          // Page links on cells drawn after their page was created (5e).
          (spec.link || []).forEach(function(l) {
            var host = find(l.pageId);
            if (!host || !find(l.target)) { errors.push('page not found for link: ' + l.cellId); return; }
            show(host);
            var graph = ui.editor.graph;
            var cell = graph.model.getCell(l.cellId);
            if (!cell) { errors.push('cell not found: ' + l.cellId); return; }
            graph.setLinkForCell(cell, 'data:page/id,' + l.target);
          });
          // Child pages the analyst chose to delete with their MP (5e).
          // removePage does nothing while the graph is not enabled; then the
          // same undoable ChangePage it would execute is executed directly.
          (spec.remove || []).forEach(function(pageId) {
            var page = find(pageId);
            if (!page) return;
            var before = ui.pages.length;
            if (typeof ui.removePage === 'function') ui.removePage(page);
            if (find(pageId) && typeof ChangePage === 'function' && ui.pages.length > 1) {
              var next = ui.currentPage !== page ? ui.currentPage :
                ui.pages[(ui.pages.indexOf(page) + 1) % ui.pages.length];
              ui.editor.graph.model.execute(new ChangePage(ui, page, next));
            }
            if (find(pageId)) {
              errors.push('page not removed: ' + pageId + ' (graph enabled: ' +
                ui.editor.graph.isEnabled() + ', pages: ' + before + ' -> ' + ui.pages.length + ')');
            }
          });
          (spec.rename || []).forEach(function(r) {
            var page = find(r.pageId);
            if (!page || page.getName() === r.name) return;
            if (typeof RenamePage === 'function') {
              ui.editor.graph.model.execute(new RenamePage(ui, page, r.name));
            } else {
              page.setName(r.name);
              if (typeof ui.updateTabContainer === 'function') ui.updateTabContainer();
            }
          });
        } finally {
          if (userPage && find(userPage.getId())) show(userPage);
        }
        return { success: true, created: created, errors: errors };
      })()
    `);
      return result ?? { success: false, error: "No result" };
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