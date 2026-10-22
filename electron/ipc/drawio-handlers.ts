// electron/ipc/drawio-handlers.ts
// ==================== DRAWIO INTEGRATION ====================
// Everything that talks to the embedded draw.io iframe via
// executeJavaScript(). This is the string-templated JS the bigger refactor
// (typed MessageChannel + self-hosted draw.io) is meant to replace — until
// then, it's at least isolated here instead of living inline in main.ts.

import { ipcMain } from "electron";
// The scripts that run inside the draw.io frame live in .js files (lint and
// syntax checks apply) and are read as text at build time (review finding 5).
import pluginScript from "../drawio-scripts/plugin.js?raw";
import syncPagesScript from "../drawio-scripts/sync-pages.js?raw";
import exportPageSvgsScript from "../drawio-scripts/export-page-svgs.js?raw";

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
      const pluginCode = `(${pluginScript})()`;

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
          // An empty cell id only opens the page (e.g. "Open page" of a
          // decomposed multiprocess).
          if (cellId === '') return true;
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

  // Leveled DFD (5g): context copies per page ({ pageId: { cellId: true } }),
  // shown faded and dashed by the getCellStyle wrapper in the plugin. The
  // map goes into the script as a JSON literal.
  ipcMain.handle(
    "drawio:setContextCells",
    async (_, cells: Record<string, Record<string, true>> | null) => {
      if (!cachedDrawioFrame)
        return { success: false, error: "No drawio frame cached" };
      const cellsJs = JSON.stringify(cells ?? {});
      try {
        await cachedDrawioFrame.executeJavaScript(`
        (function() {
          Draw._taraflowContextCells = ${cellsJs};
          var ui = Draw._taraflowUi;
          if (ui && ui.editor && ui.editor.graph) ui.editor.graph.refresh();
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

  // Leveled DFD (5d, D15–D17; 5e; 5f): create child pages, copy their
  // context, set the page link on the multiprocess cells, rename pages,
  // remove pages. Planned by planPageSync in the
  // renderer; the spec goes into the script as a JSON literal. Idempotent:
  // an existing page is not created twice, a page with the wanted name is
  // not renamed. The user's page is shown again afterwards.
  ipcMain.handle("drawio:syncPages", async (_, spec: unknown) => {
    if (!cachedDrawioFrame)
      return { success: false, error: "No drawio frame cached" };
    const specJs = JSON.stringify(spec ?? {});
    try {
      const result = await cachedDrawioFrame.executeJavaScript(`(${syncPagesScript})(${specJs})`);
      return result ?? { success: false, error: "No result" };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });

  // Leveled DFD (5i, D18): one SVG thumbnail per page, without switching
  // the page the user sees. draw.io's own SVG export renders the current
  // page only; for another page this does what draw.io does for a page that
  // is not shown (EditorUi.getFileData): a temporary graph with the page's
  // root. The page ids go into the script as a JSON literal.
  ipcMain.handle("drawio:exportPageSvgs", async (_, pageIds: unknown) => {
    if (!cachedDrawioFrame)
      return { success: false, error: "No drawio frame cached" };
    const idsJs = JSON.stringify(Array.isArray(pageIds) ? pageIds.map(String) : []);
    try {
      const result = await cachedDrawioFrame.executeJavaScript(`(${exportPageSvgsScript})(${idsJs})`);
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