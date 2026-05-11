// ==================== USE DRAWIO OVERLAY HOOK ====================
// Transient asset highlighting on the draw.io canvas.

import { useCallback, useRef, useState } from "react";
import type { DFDAsset } from "../models/dfd-asset-types";
import type { DFDElement, DFDConnection } from "../models/dfd-types";
import { buildOverlayXml } from "../services/dfd-overlay-builder";
import type { DrawioExportResult, DrawioViewport } from "../models/drawio-types";

// ==================== TYPES ====================

export interface UseDrawioOverlayOptions {
  exportXML: () => Promise<DrawioExportResult>;

  // 🔥 WICHTIG: echte CLEAN Quelle (Backend / Store / initial load XML)
  getProjectXml?: () => string;

  loadXMLTransient: (xml: string, viewport?: DrawioViewport) => void;
}

export interface UseDrawioOverlayReturn {
  isOverlayActive: boolean;

  showOverlay: (
    assetIds: string[],
    assets: DFDAsset[],
    elements: any[],
    connections: DFDConnection[],
  ) => Promise<void>;

  clearOverlay: () => void;

  invalidateBase: () => void;
}

// ==================== HOOK ====================

export function useDrawioOverlay(
  options: UseDrawioOverlayOptions,
): UseDrawioOverlayReturn {
  const { exportXML, loadXMLTransient, getProjectXml } = options;

  const [isOverlayActive, setIsOverlayActive] = useState(false);

  const baseXmlRef = useRef<string | null>(null);
  const viewportRef = useRef<DrawioViewport | null>(null);

  // ==================== SNAPSHOT ====================

  const captureBase = async () => {
    try {
      const projectXml = getProjectXml?.();

      if (projectXml) {
        baseXmlRef.current = projectXml;
        return;
      }

      // fallback (nur wenn nötig)
      const result = await exportXML();

      baseXmlRef.current = result.xml;
      viewportRef.current = {
        translate: result.translate,
        scale: result.scale,
        scrollLeft: result.scrollLeft,
        scrollTop: result.scrollTop,
      };
    } catch (err) {
      console.error("[useDrawioOverlay] captureBase failed:", err);
      baseXmlRef.current = null;
      viewportRef.current = null;
    }
  };

  // ==================== INVALIDATE ====================

  const invalidateBase = useCallback(() => {
    baseXmlRef.current = null;
    viewportRef.current = null;
  }, []);

  // ==================== SHOW OVERLAY ====================

  const showOverlay = useCallback(
    async (
      assetIds: string[],
      assets: DFDAsset[],
      elements: any[],
      connections: DFDConnection[],
    ) => {
      try {
        // empty → restore
        if (assetIds.length === 0) {
          if (baseXmlRef.current) {
            loadXMLTransient(
              baseXmlRef.current,
              viewportRef.current ?? undefined,
            );
          }
          setIsOverlayActive(false);
          return;
        }

        // snapshot if needed
        if (!baseXmlRef.current) {
          await captureBase();
        }

        const baseXml = baseXmlRef.current;

        if (!baseXml) {
          console.error("[useDrawioOverlay] Missing base XML");
          return;
        }

        // build overlay
        let currentXml: string = baseXml;

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
      } catch (err) {
        console.error("[useDrawioOverlay] showOverlay failed:", err);
      }
    },
    [exportXML, loadXMLTransient],
  );

  // ==================== CLEAR ====================

  const clearOverlay = useCallback(() => {
    if (!baseXmlRef.current) {
      setIsOverlayActive(false);
      return;
    }

    loadXMLTransient(baseXmlRef.current, viewportRef.current ?? undefined);

    setIsOverlayActive(false);
  }, [loadXMLTransient]);

  return {
    isOverlayActive,
    showOverlay,
    clearOverlay,
    invalidateBase,
  };
}

export default useDrawioOverlay;