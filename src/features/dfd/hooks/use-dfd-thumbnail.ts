// ==================== USE DFD THUMBNAIL HOOK ====================
// Single Responsibility: Manage thumbnail generation and preview state

import { useState, useCallback, useEffect } from "react";
import type { DFDProjectData } from "../models/dfd-types";
import type { UseDrawioBridgeReturn } from "./use-drawio-bridge";

// ==================== TYPES ====================

export interface UseDFDThumbnailOptions {
  restoreFromProject?: boolean; // Whether to restore thumbnail from project.dfd.thumbnail
}

export interface UseDFDThumbnailReturn {
  // Current preview image (base64 data URL)
  preview: string | null;

  // Actions
  generate: () => Promise<string | null>;
  setPreview: (imageData: string | null) => void;
  clearPreview: () => void;
}

// ==================== HOOK ====================

export function useDFDThumbnail(
  bridge: UseDrawioBridgeReturn,
  project: DFDProjectData,
  options: UseDFDThumbnailOptions = {},
): UseDFDThumbnailReturn {
  const { restoreFromProject = true } = options;

  // ==================== STATE ====================

  const [preview, setPreviewInternal] = useState<string | null>(null);

  // ==================== THUMBNAIL GENERATION ====================

  /**
   * Generate thumbnail from current DFD
   * Returns base64 image data URL
   */
  const generate = useCallback(async (): Promise<string | null> => {
    console.log("[useDFDThumbnail] Generating thumbnail...");

    try {
      const imageData = await bridge.exportImage();

      if (imageData) {
        setPreviewInternal(imageData);
        console.log("[useDFDThumbnail] Thumbnail generated successfully");
      } else {
        console.warn("[useDFDThumbnail] No image data returned");
      }

      return imageData;
    } catch (error) {
      console.error("[useDFDThumbnail] Thumbnail generation failed:", error);
      return null;
    }
  }, [bridge]);

  // ==================== STATE MANAGEMENT ====================

  const setPreview = useCallback((imageData: string | null) => {
    setPreviewInternal(imageData);
  }, []);

  const clearPreview = useCallback(() => {
    setPreviewInternal(null);
  }, []);

  // ==================== RESTORE FROM PROJECT ====================

  useEffect(() => {
    if (!restoreFromProject) return;

    // Restore thumbnail when project changes or when returning to this project
    const savedThumbnail = project.dfd?.thumbnail;

    if (savedThumbnail && savedThumbnail !== preview) {
      console.log("[useDFDThumbnail] Restoring thumbnail from project");
      setPreviewInternal(savedThumbnail);
    } else if (!savedThumbnail && preview) {
      // Clear preview if project has no thumbnail
      console.log("[useDFDThumbnail] Clearing preview (no saved thumbnail)");
      setPreviewInternal(null);
    }
  }, [project.id, project.dfd?.thumbnail, restoreFromProject]);

  // ==================== RETURN ====================

  return {
    preview,
    generate,
    setPreview,
    clearPreview,
  };
}

export default useDFDThumbnail;