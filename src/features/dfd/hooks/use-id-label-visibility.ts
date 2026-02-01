import { useState, useCallback, RefObject } from 'react';

  interface UseIdLabelVisibilityProps {
    iframeRef: RefObject<HTMLIFrameElement | null>;
    getCurrentXML: () => Promise<string | null>;
    sendAction: (action: string, data?: any) => void;
    save?: () => Promise<any>;
  }

export const useIdLabelVisibility = ({
  iframeRef,
  getCurrentXML,
  sendAction,
  save
}: UseIdLabelVisibilityProps) => {
  
  // State: welche idLabels sind sichtbar
  const [visibilityState, setVisibilityState] = useState<Record<string, boolean>>({});

  /**
   * Lädt das Protection Plugin in draw.io
   */
  const loadProtectionPlugin = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentWindow) {
      console.warn('iframe not ready for plugin loading');
      return;
    }

    const pluginCode = `
      Draw.loadPlugin(function(ui) {
        console.log('[TARAflow] idLabel Protection Plugin loaded');
        
        const graph = ui.editor.graph;
        
        // Protection: idLabels können nicht gelöscht werden
        const originalIsCellDeletable = graph.isCellDeletable;
        graph.isCellDeletable = function(cell) {
          if (cell && cell.getAttribute && cell.getAttribute('type') === 'idlabel') {
            console.log('[TARAflow] Delete prevented for idLabel');
            return false;
          }
          return originalIsCellDeletable.apply(this, arguments);
        };
        
        console.log('[TARAflow] idLabel protection active');
      });
    `;

    // UTF-8 safe Base64 encoding
    const utf8_to_b64 = (str: string) => {
      return btoa(unescape(encodeURIComponent(str)));
    };

    const pluginDataUrl = 'data:text/javascript;base64,' + utf8_to_b64(pluginCode);

    // Plugin via postMessage laden
    iframe.contentWindow.postMessage(
      JSON.stringify({
        action: 'configure',
        config: {
          plugins: [pluginDataUrl]
        }
      }),
      '*'
    );

    console.log('[TARAflow] Protection plugin sent to draw.io');
  }, [iframeRef]);

  /**
   * Toggle die Sichtbarkeit eines idLabels
   */
  const toggleIdLabel = useCallback(async (elementId: string): Promise<boolean> => {
    const xml = await getCurrentXML();
    if (!xml) {
      console.error('No XML available for toggle');
      return false;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');

    // Finde das dataflow Element
    const dataflow = doc.querySelector(`object[id="${elementId}"]`);
    if (!dataflow) {
      console.error('Dataflow element not found:', elementId);
      return false;
    }

    // Finde das idLabel child
    const idLabel = dataflow.querySelector('object[type="idlabel"]');
    if (!idLabel) {
      console.error('idLabel not found for element:', elementId);
      return false;
    }

    // Toggle visible attribute
    const currentVisible = idLabel.getAttribute('visible') || '1';
    const newVisible = currentVisible === '0' ? '1' : '0';
    
    idLabel.setAttribute('visible', newVisible);

    // Style update für sofortige visuelle Änderung
    const mxCell = idLabel.querySelector('mxCell');
    if (mxCell) {
      let style = mxCell.getAttribute('style') || '';
      
      // Opacity für visuelles Feedback
      if (newVisible === '0') {
        if (!style.includes('opacity=0')) {
          style += ';opacity=0';
        }
      } else {
        style = style.replace(/;?opacity=0;?/g, '');
      }
      
      mxCell.setAttribute('style', style);
    }

    console.log(`[TARAflow] Toggle idLabel ${elementId}: ${currentVisible} → ${newVisible}`);

    // Aktualisiertes XML zurück zu draw.io
    const updatedXml = new XMLSerializer().serializeToString(doc);
    
    sendAction('load', {
      xml: updatedXml,
      autosave: 1
    });

    // Optional speichern
    if (save) {
      await save();
    }

    const isVisible = newVisible === '1';
    
    // State aktualisieren
    setVisibilityState(prev => ({
      ...prev,
      [elementId]: isVisible
    }));

    return isVisible;
  }, [getCurrentXML, sendAction, save]);

  /**
   * Initialisiere den Visibility State aus dem XML
   */
  const initializeVisibilityState = useCallback(async () => {
    const xml = await getCurrentXML();
    if (!xml) return;

    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');

    const dataflows = doc.querySelectorAll('object[type="dataflow"]');
    const newState: Record<string, boolean> = {};

    dataflows.forEach(dataflow => {
      const id = dataflow.getAttribute('id');
      const idLabel = dataflow.querySelector('object[type="idlabel"]');
      
      if (id && idLabel) {
        const visible = idLabel.getAttribute('visible') || '1';
        newState[id] = visible === '1';
      }
    });

    setVisibilityState(newState);
    console.log('[TARAflow] Visibility state initialized:', newState);
  }, [getCurrentXML]);

  return {
    visibilityState,
    toggleIdLabel,
    loadProtectionPlugin,
    initializeVisibilityState
  };
};