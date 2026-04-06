// ==================== USE DRAWIO OVERLAY HOOK ====================
// Transient asset highlighting on the draw.io canvas.
//
// Supports multiple active assets simultaneously — all active assetIds
// are highlighted in a single overlay pass from the clean baseXml.

import { useCallback, useRef, useState } from "react";
import type { DFDAsset } from "../models/dfd-asset-types";
import type { DFDElement, DFDConnection } from "../models/dfd-types";
import { buildOverlayXml } from "../services/dfd-overlay-builder";
import type { DrawioExportResult, DrawioViewport } from "../models/drawio-types";

// ==================== TYPES ====================

export interface UseDrawioOverlayOptions {
  exportXML: () => Promise<DrawioExportResult>;
  loadXMLTransient: (xml: string, viewport?: DrawioViewport) => void;
}

export interface UseDrawioOverlayReturn {
  isOverlayActive: boolean;
  /**
   * Show overlay for one or more assetIds simultaneously.
   * Always rebuilds from clean baseXml — no accumulation.
   */
  showOverlay: (
    assetIds: string[],
    assets: DFDAsset[],
    elements: DFDElement[],
    connections: DFDConnection[],
  ) => Promise<void>;
  clearOverlay: () => void;
}

// ==================== HOOK ====================

export function useDrawioOverlay(
  options: UseDrawioOverlayOptions,
): UseDrawioOverlayReturn {
  const { exportXML, loadXMLTransient } = options;

  const [isOverlayActive, setIsOverlayActive] = useState(false);
  const baseXmlRef = useRef<string | null>(null);
  const viewportRef = useRef<DrawioViewport | null>(null);

  const showOverlay = useCallback(
    async (
      assetIds: string[],
      assets: DFDAsset[],
      elements: DFDElement[],
      connections: DFDConnection[],
    ) => {
      if (assetIds.length === 0) {
        // Nothing active — clear
        if (baseXmlRef.current) {
          loadXMLTransient(baseXmlRef.current, viewportRef.current ?? undefined);
          baseXmlRef.current = null;
          viewportRef.current = null;
        }
        setIsOverlayActive(false);
        return;
      }

      // Capture baseXml once before any overlay is applied
      if (!baseXmlRef.current) {
        try {
          const result = await exportXML();
          baseXmlRef.current = result.xml;
          viewportRef.current = {
            translate: result.translate,
            scale: result.scale,
            scrollLeft: result.scrollLeft,
            scrollTop: result.scrollTop,
          };
        } catch (err) {
          console.error("[useDrawioOverlay] Failed to export base XML:", err);
          return;
        }
      }

      // Build overlay for ALL active assets from clean baseXml
      let currentXml = baseXmlRef.current;
      for (const assetId of assetIds) {
        const overlayXml = await buildOverlayXml(
          assetId,
          assets,
          elements,
          connections,
          currentXml,
        );
        if (overlayXml) {
          currentXml = overlayXml;
        }
      }

      loadXMLTransient(currentXml, viewportRef.current ?? undefined);
      setIsOverlayActive(true);
    },
    [exportXML, loadXMLTransient],
  );

  const clearOverlay = useCallback(() => {
    if (!baseXmlRef.current) {
      setIsOverlayActive(false);
      return;
    }
    loadXMLTransient(baseXmlRef.current, viewportRef.current ?? undefined);
    baseXmlRef.current = null;
    viewportRef.current = null;
    setIsOverlayActive(false);
  }, [loadXMLTransient]);

  return {
    isOverlayActive,
    showOverlay,
    clearOverlay,
  };
}

export default useDrawioOverlay;