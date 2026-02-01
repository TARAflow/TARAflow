// ==================== USE ASSET ASSIGNMENT HOOK ====================
// Manages asset assignment to DFD elements via draw.io context menu

import { useState, useCallback, RefObject } from 'react';

interface UseAssetAssignmentProps {
  iframeRef: RefObject<HTMLIFrameElement | null>;
}

interface AssetDialogState {
  open: boolean;
  elementId: string | null;
  elementLabel: string | null;
}

export const useAssetAssignment = ({ iframeRef }: UseAssetAssignmentProps) => {
  
  // Dialog state
  const [dialogState, setDialogState] = useState<AssetDialogState>({
    open: false,
    elementId: null,
    elementLabel: null,
  });

  /**
   * Lädt das Plugin in draw.io das das Context Menu erweitert
   * WICHTIG: Muss VOR dem iframe load passieren (via URL Parameter)
   */
  const getPluginUrl = useCallback((): string => {
    const pluginCode = `
      (function() {
        console.log('[TARAflow Plugin] Starting initialization...');
        
        // Warte auf editorUi
        var checkInterval = setInterval(function() {
          if (window.editorUi) {
            console.log('[TARAflow Plugin] editorUi found, installing...');
            clearInterval(checkInterval);
            
            var ui = window.editorUi;
            var graph = ui.editor.graph;
            
            // Context Menu erweitern
            var originalCreatePopup = ui.menus.createPopupMenu;
            
            ui.menus.createPopupMenu = function(menu, cell, evt) {
              // Original Menu aufrufen
              originalCreatePopup.apply(this, arguments);
              
              // Custom Items für dataflow, process, datastore, interface
              if (cell && cell.getAttribute) {
                var cellType = cell.getAttribute('type');
                console.log('[TARAflow Plugin] Context menu for type:', cellType);
                
                if (cellType === 'dataflow' || cellType === 'process' || 
                    cellType === 'datastore' || cellType === 'interface') {
                  menu.addSeparator();
                  
                  // Asset Management Menu Item
                  menu.addItem('Manage Assets...', null, function() {
                    console.log('[TARAflow Plugin] Opening asset dialog for:', cell.id);
                    
                    // PostMessage an React senden
                    window.parent.postMessage({
                      type: 'TARAFLOW_OPEN_ASSET_DIALOG',
                      payload: {
                        elementId: cell.id,
                        elementLabel: cell.getAttribute('label') || cell.getAttribute('name') || cell.id
                      }
                    }, '*');
                  }, null, null, true, true);
                  
                  console.log('[TARAflow Plugin] Asset menu item added');
                }
              }
            };
            
            console.log('[TARAflow Plugin] Installation complete!');
          }
        }, 100);
        
        // Timeout nach 10 Sekunden
        setTimeout(function() {
          clearInterval(checkInterval);
          console.warn('[TARAflow Plugin] Timeout - editorUi not found');
        }, 10000);
      })();
    `;

    // UTF-8 safe Base64 encoding
    const utf8_to_b64 = (str: string) => {
      return btoa(unescape(encodeURIComponent(str)));
    };

    const pluginDataUrl = 'data:text/javascript;base64,' + utf8_to_b64(pluginCode);
    
    console.log('[AssetAssignment] Plugin URL generated');
    return pluginDataUrl;
  }, []);

  /**
   * Nicht mehr gebraucht - Plugin wird via URL geladen
   */
  const loadAssetMenuPlugin = useCallback(() => {
    console.log('[AssetAssignment] Plugin loading via URL parameter (no postMessage needed)');
  }, []);

  /**
   * Öffnet den Asset Dialog für ein Element
   */
  const openDialog = useCallback((elementId: string, elementLabel: string) => {
    console.log('[AssetAssignment] Opening dialog for element:', elementId);
    setDialogState({
      open: true,
      elementId,
      elementLabel,
    });
  }, []);

  /**
   * Schließt den Dialog
   */
  const closeDialog = useCallback(() => {
    console.log('[AssetAssignment] Closing dialog');
    setDialogState({
      open: false,
      elementId: null,
      elementLabel: null,
    });
  }, []);

  return {
    dialogState,
    getPluginUrl,
    loadAssetMenuPlugin,
    openDialog,
    closeDialog,
  };
};