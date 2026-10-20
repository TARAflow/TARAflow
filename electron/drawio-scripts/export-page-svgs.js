// electron/drawio-scripts/export-page-svgs.js
// ==================== EXPORT PAGE SVGS (draw.io frame) ====================
// Leveled DFD 5i (D18): one SVG per page without switching the page the
// user sees — pages other than the current one are rendered in a
// temporary graph.
//
// A function expression, read as text at build time (?raw) and called as
// (script)(pageIds) with the ids as a JSON literal (review finding 5).
/* global Draw, Editor, mxConstants, mxUtils */
(function (ids) {
  var ui = Draw._taraflowUi;
  if (!ui || !ui.pages || typeof ui.createTemporaryGraph !== 'function' ||
      typeof ui.updatePageRoot !== 'function') {
    return { success: false, error: 'draw.io page export API not available' };
  }
  var svgs = {};
  var errors = [];
  var background = ui.editor.graph.background;
  if (background == mxConstants.NONE) background = null;
  ids.forEach(function(id) {
    var page = null;
    for (var i = 0; i < ui.pages.length; i++) {
      if (ui.pages[i].getId() === id) { page = ui.pages[i]; break; }
    }
    if (!page) { errors.push('page not found: ' + id); return; }
    var graph = ui.editor.graph;
    var temporary = null;
    try {
      if (page !== ui.currentPage) {
        temporary = ui.createTemporaryGraph(graph.getStylesheet());
        temporary.background = graph.background;
        document.body.appendChild(temporary.container);
        ui.updatePageRoot(page);
        temporary.model.setRoot(page.root);
        graph = temporary;
      }
      var svg = graph.getSvg(background, 1, 1, null, null, true);
      svgs[id] = Editor.createSvgDataUri(mxUtils.getXml(svg));
    } catch (e) {
      errors.push('export failed for ' + id + ': ' + e.message);
    } finally {
      if (temporary && temporary.container.parentNode) {
        temporary.container.parentNode.removeChild(temporary.container);
      }
    }
  });
  return { success: true, svgs: svgs, errors: errors };
})
