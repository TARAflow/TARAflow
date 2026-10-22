// electron/drawio-scripts/plugin.js
// ==================== TARAFLOW PLUGIN (draw.io frame) ====================
// Runs inside the embedded draw.io iframe (executeJavaScript, see
// electron/ipc/drawio-handlers.ts). Registers the TARAflow plugin via
// Draw.loadPlugin: page tab decoration, context-copy display, the selection
// listener (a selection made with the mouse is reported after the release)
// and the viewport restore.
//
// A function expression, read as text at build time (?raw) and called as
// (script)() — kept in a .js file so lint and syntax checks apply
// (review finding 5).
/* global Draw, mxEvent */
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

      // Context copies (leveled DFD 5g): shown faded and dashed — in
      // the display only, the XML style is not changed (§5.2: the XML
      // stays plain draw.io). The cells per page are pushed by
      // drawio:setContextCells; a label child (ID label, edge label)
      // follows its element.
      var contextGraph = ui.editor.graph;
      var baseCellStyle = contextGraph.getCellStyle;
      contextGraph.getCellStyle = function(cell) {
        var style = baseCellStyle.apply(this, arguments);
        try {
          var byPage = Draw._taraflowContextCells;
          var page = ui.currentPage;
          var ids = (byPage && page) ? byPage[page.getId()] : null;
          if (ids && style) {
            var c = cell;
            for (var depth = 0; c && depth < 2; depth++) {
              if (ids[c.id]) {
                style.opacity = 45;
                style.textOpacity = 60;
                style.dashed = 1;
                break;
              }
              c = c.parent;
            }
          }
        } catch (e) {
          console.warn('[Plugin] Context copy style failed:', e);
        }
        return style;
      };

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
      // A selection made by pressing the mouse button is reported
      // only when the button is released. TARAflow opens its details
      // panel on a selection; doing that in the middle of the gesture
      // moved the diagram under the pointer. (The former workaround —
      // pointer-events:none on the iframe for one frame — let the
      // pointerup go past draw.io: mxGraph kept isMouseDown, dropped
      // every further mousedown and the element stuck to the pointer.)
      var selectionGraph = ui.editor.graph;
      var selectionPending = false;
      var flushSelection = function() {
        if (!selectionPending) return;
        selectionPending = false;
        postSelection(selectionGraph.getSelectionCells());
      };
      var flushAfterGesture = function() {
        // After mxGraph has handled the release (handlers first).
        window.setTimeout(flushSelection, 0);
      };
      selectionGraph.getSelectionModel().addListener(mxEvent.CHANGE, function() {
        if (selectionGraph.isMouseDown) {
          selectionPending = true;
          return;
        }
        selectionPending = false;
        postSelection(selectionGraph.getSelectionCells());
      });
      selectionGraph.addMouseListener({
        mouseDown: function() {},
        mouseMove: function() {},
        mouseUp: flushAfterGesture
      });
      // Also when the release happens outside the diagram or the
      // browser cancels the gesture.
      window.addEventListener('pointerup', flushAfterGesture, true);
      window.addEventListener('mouseup', flushAfterGesture, true);
      window.addEventListener('pointercancel', flushAfterGesture, true);
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
})
