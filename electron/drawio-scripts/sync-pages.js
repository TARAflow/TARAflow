// electron/drawio-scripts/sync-pages.js
// ==================== SYNC PAGES (draw.io frame) ====================
// Leveled DFD 5d–5h: create child pages (with their context copies), set
// the page link on multiprocess cells, rename pages, remove pages and cells.
// Planned by planPageSync in the renderer; idempotent: an existing page is
// not created twice, a page with the wanted name is not renamed. The
// user's page is shown again afterwards.
//
// A function expression, read as text at build time (?raw) and called as
// (script)(spec) with the spec as a JSON literal (review finding 5).
/* global Draw */
(function (spec) {
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
  var copies = [];
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
    // Context copies (5f): clone cells of the MP's home page onto its
    // child page with their geometry. cloneCells needs the source page
    // shown: a flow whose MP end is not cloned then keeps a free end
    // at the old position. Nested DFD elements are not copied (labels
    // are). A loose flow end is connected to the copy of its element
    // that is already on the child page (ctx.existing).
    (spec.context || []).forEach(function(ctx) {
      var from = find(ctx.fromPageId);
      var to = find(ctx.toPageId);
      if (!from || !to) { errors.push('page not found for context: ' + ctx.toPageId); return; }
      show(from);
      var graph = ui.editor.graph;
      var originals = [];
      (ctx.cells || []).forEach(function(id) {
        var cell = graph.model.getCell(id);
        if (cell) originals.push(cell); else errors.push('context cell not found: ' + id);
      });
      if (originals.length === 0) return;
      var clones = graph.cloneCells(originals, true, null, true);
      var typeOf = function(c) {
        return (c && c.value && typeof c.value === 'object' && c.value.getAttribute) ?
          c.value.getAttribute('type') : null;
      };
      var kept = [];
      var originalOf = [];
      for (var i = 0; i < clones.length; i++) {
        var clone = clones[i];
        if (!clone) continue;
        for (var j = clone.getChildCount() - 1; j >= 0; j--) {
          var childType = typeOf(clone.getChildAt(j));
          if (childType && childType !== 'idlabel') clone.remove(j);
        }
        kept.push(clone);
        originalOf.push(originals[i]);
      }
      show(to);
      graph = ui.editor.graph;
      var model = graph.model;
      model.beginUpdate();
      try {
        graph.addCells(kept, graph.getDefaultParent());
        for (var k = 0; k < kept.length; k++) {
          var copy = kept[k];
          var original = originalOf[k];
          if (model.isEdge(copy)) {
            var ends = [true, false];
            for (var e = 0; e < ends.length; e++) {
              var isSource = ends[e];
              if (model.getTerminal(copy, isSource) != null) continue;
              var terminal = original.getTerminal(isSource);
              var there = terminal && ctx.existing ? ctx.existing[terminal.id] : null;
              var target = there ? model.getCell(there) : null;
              if (target) {
                model.setTerminal(copy, target, isSource);
                var geo = model.getGeometry(copy);
                if (geo) {
                  geo = geo.clone();
                  geo.setTerminalPoint(null, isSource);
                  model.setGeometry(copy, geo);
                }
              }
            }
          }
          copies.push({ pageId: ctx.toPageId, from: original.id, to: copy.id });
        }
      } finally {
        model.endUpdate();
      }
    });

    // Context copies that left the context of a pure context page
    // (5f): exactly the listed cells, connected edges are not taken
    // along (they are listed themselves when they leave too).
    (spec.removeCells || []).forEach(function(r) {
      var host = find(r.pageId);
      if (!host) return;
      show(host);
      var graph = ui.editor.graph;
      var cells = [];
      (r.cellIds || []).forEach(function(id) {
        var cell = graph.model.getCell(id);
        if (cell) cells.push(cell);
      });
      if (cells.length > 0) graph.removeCells(cells, false);
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
  return { success: true, created: created, copies: copies, errors: errors };
})
