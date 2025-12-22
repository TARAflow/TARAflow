// dataflow-numbering-plugin.js
Draw.loadPlugin(function(ui)
{
    // helper: prüft, ob ein mxCell ein Dataflow-Element ist
    function isDataflowCell(cell)
    {
        if (!cell) return false;

        // Wenn value ein DOM-Element ist (Stencils), können attributes über getAttribute gelesen werden
        try {
            if (cell.getAttribute && typeof cell.getAttribute === 'function') {
                return cell.getAttribute('type') === 'Dataflow';
            }
            // Falls value ein DOM-Node ist (mxCell.value), prüfen wir dessen attribute
            if (cell.value && cell.value.getAttribute && typeof cell.value.getAttribute === 'function') {
                return cell.value.getAttribute('type') === 'Dataflow';
            }
        } catch (e) {
            // ignore
        }

        // Fallback: prüfen ob cell.type existiert
        try {
            return (cell.type === 'Dataflow') || (cell.getStyle && cell.getStyle().indexOf('type=Dataflow') >= 0);
        } catch (e) {
            return false;
        }
    }

    // Hauptfunktion: alle Dataflow-Zellen sammeln, sortieren und neu durchnummerieren
    function reindexAllDataflows(graph)
    {
        const model = graph.getModel();
        const cellsMap = model.cells || model.getCells ? model.cells : null;
        const list = [];

        if (cellsMap) {
            for (var id in cellsMap) {
                if (!cellsMap.hasOwnProperty(id)) continue;
                var c = cellsMap[id];
                if (isDataflowCell(c)) {
                    list.push(c);
                }
            }
        } else {
            // Backup: traverse model root
            var root = model.getRoot();
            function traverse(cell) {
                if (!cell) return;
                if (isDataflowCell(cell)) list.push(cell);
                var childCount = model.getChildCount(cell);
                for (var i = 0; i < childCount; i++) {
                    traverse(model.getChildAt(cell, i));
                }
            }
            traverse(root);
        }

        // Deterministische Sortierung: anhand cell.id lexikographisch
        list.sort(function(a, b) {
            var ai = (a.id || a.getId && a.getId()) + '';
            var bi = (b.id || b.getId && b.getId()) + '';
            return ai.localeCompare(bi);
        });

        // Update: setze Label und deaktiviere enumerate overlay (falls gesetzt)
        graph.getModel().beginUpdate();
        try {
            for (var i = 0; i < list.length; i++) {
                var cell = list[i];
                var idx = i + 1;
                var newLabel = 'DF-' + idx;

                // Setze das Label (beibehaltbar editierbar)
                try {
                    graph.labelChanged(cell, newLabel); // versucht, das Label sauber zu ändern
                } catch (e) {
                    try { graph.cellLabelChanged(cell, newLabel, false); } catch (e2) { /* ignore */ }
                }

                // Stelle sicher, dass enumerate ausgeschaltet ist (kein gelbes Badge)
                try {
                    graph.setCellStyles('enumerate', '0', [cell]);
                } catch (e) {
                    // fallback: setStyle manuell
                    try {
                        var s = cell.getStyle ? cell.getStyle() : (cell.style || '');
                        s = s.replace(/(?:^|;)enumerate=[^;]*/g, '');
                        s = s + ';enumerate=0';
                        graph.model.setStyle(cell, s);
                    } catch (e2) { /* ignore */ }
                }
            }
        } finally {
            graph.getModel().endUpdate();
        }
    }

    // Bei Laden des Editors / Diagramms: neu indexieren
    var graph = ui.editor.graph;

    // Wenn Editor fertig geladen ist (Diagramm geladen), neu indexieren.
    // Versuche verschiedene Events -> best effort
    try {
        // 1) wenn editor bereit ist
        ui.editor.addListener('diagramLoaded', function() {
            reindexAllDataflows(graph);
        });
    } catch (e) {
        // ignore if not supported
    }

    // Fallback: reindex ein paar 100ms nach startup, falls events fehlen
    window.setTimeout(function() {
        try { reindexAllDataflows(graph); } catch(e) {}
    }, 400);

    // Re-index, wenn Zellen eingefügt werden (z. B. beim Einfügen eines Stencils)
    try {
        graph.getModel().addListener(mxEvent.CHANGE, function(sender, evt) {
            // evt enthält das Edit-Objekt
            try {
                var edit = evt.getProperty ? evt.getProperty('edit') : (evt.edit || null);
                if (edit && edit.changes) {
                    // Änderungen prüfen: wenn Zellen hinzugefügt/gelöscht/umbenannt -> neu indexieren
                    var needs = false;
                    for (var i = 0; i < edit.changes.length; i++) {
                        var ch = edit.changes[i];
                        var cname = ch.constructor && ch.constructor.name ? ch.constructor.name : (ch.constructor || '');
                        if (cname.indexOf('Add') >= 0 || cname.indexOf('Cell') >= 0 || cname.indexOf('RootChange') >= 0 || cname.indexOf('Visible') >= 0) {
                            needs = true;
                            break;
                        }
                    }
                    if (needs) {
                        // leichte Verzögerung, damit alle Änderungen fertig sind
                        window.setTimeout(function() { reindexAllDataflows(graph); }, 50);
                    }
                }
            } catch (e) {
                // fallback: immer reindexen
                window.setTimeout(function() { reindexAllDataflows(graph); }, 50);
            }
        });
    } catch (e) {
        // fallback: attach graph listener
        try {
            graph.addListener(mxEvent.CELLS_ADDED, function() { window.setTimeout(function() { reindexAllDataflows(graph); }, 50); });
            graph.addListener(mxEvent.CELLS_REMOVED, function() { window.setTimeout(function() { reindexAllDataflows(graph); }, 50); });
        } catch (e2) { /* ignore */ }
    }

    // Optional: UI-Button zum manuellen Neu-Nummerieren
    ui.actions.addAction('reindex-dataflows', function()
    {
        reindexAllDataflows(graph);
    });

    // Ein kleines Menü-Item unter Extras -> Reindex Dataflows
    try {
        var menu = ui.menubar;
        // Wenn verfügbar, füge Button in die Toolbar ein (best-effort)
        if (ui.toolbar) {
            var button = ui.toolbar.addItem('DF#', 'Reindex DF', 'reindex-dataflows', ui);
            if (button) {
                button.setAttribute('title', 'Reindex Dataflows (DF-1, DF-2, ...)');
            }
        }
    } catch (e) { /* ignore */ }

    // End of plugin
});
