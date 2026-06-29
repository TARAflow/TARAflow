// ==================== USE DFD PERSISTENCE HOOK ====================
// Single Responsibility: Orchestrate save operations and dirty state tracking

import { useState, useCallback, useRef, useEffect } from "react";
import type { DFDProjectData, DFDUpdateResult, DFDData } from "../models/dfd-types";
import type { ValidationResult } from "../services/dfd-validator";
import { createDFDStorageAdapter } from "../services/dfd-storage-adapter";
import dfdService from "../services/dfd-service";

// ==================== TYPES ====================

export interface UseDFDPersistenceOptions {
  onUpdate?: (result: DFDUpdateResult) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  debounceDelay?: number; // Delay in ms for description edit saves (0 = disabled)
  drawioAutosaveDelay?: number; // Delay in ms for DrawIO autosave (default: 1500ms)
  /** Called after a successful DrawIO autosave — used to generate thumbnail */
  onAfterDrawioSave?: (result: DFDUpdateResult) => void;
}

export interface UseDFDPersistenceReturn {
  // State
  isDirty: boolean;

  // Actions
  save: (thumbnailData?: string) => Promise<DFDUpdateResult | null>;
  scheduleSave: (result: DFDUpdateResult) => void;
  scheduleDrawioSave: (xml: string) => void; // Debounced autosave triggered by DrawIO changes
  flush: () => void;
  markDirty: () => void;
  markClean: () => void;
}

// ==================== HOOK ====================

export function useDFDPersistence(
  project: DFDProjectData,
  options: UseDFDPersistenceOptions = {},
): UseDFDPersistenceReturn {
  const {
    onUpdate,
    onDirtyChange,
    debounceDelay = 500,
    drawioAutosaveDelay = 1500,
    onAfterDrawioSave,
  } = options;

  // ==================== STATE ====================

  const [isDirty, setIsDirty] = useState(false);

  // ==================== REFS ====================

  const pendingSaveRef = useRef<DFDUpdateResult | null>(null);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const drawioSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Always-current project ref — prevents stale closure in scheduleDrawioSave.
  // Without this, scheduleDrawioSave uses the project object from the render
  // when it was created, missing properties set via updateConnectionDescription
  // (which arrives via scheduleSave/onUpdate AFTER the drawio save fires).
  const projectRef = useRef<DFDProjectData>(project);
  projectRef.current = project;

  const pendingXmlRef = useRef<string | null>(null);

  // ==================== DIRTY STATE ====================

  const markDirty = useCallback(() => {
    setIsDirty(true);
    onDirtyChange?.(true);
  }, [onDirtyChange]);

  const markClean = useCallback(() => {
    setIsDirty(false);
    onDirtyChange?.(false);
  }, [onDirtyChange]);

  // ==================== SAVE OPERATIONS ====================

  /**
   * Immediate save (no debounce)
   * Used by Save button
   */
  const save = useCallback(
    async (thumbnailData?: string): Promise<DFDUpdateResult | null> => {
      console.log("[useDFDPersistence] Executing immediate save...");

      try {
        // Sync from legacy storage (draw.io writes there)
        // Use projectRef.current to include any pending property updates
        const currentProject = projectRef.current;
        const adapter = createDFDStorageAdapter(currentProject.id);
        adapter.syncFromLegacy();

        // Save via service
        const result = dfdService.saveDFD(currentProject);

        if (!result.success) {
          console.error("[useDFDPersistence] Save failed:", result.error);
          return null;
        }

        // Add thumbnail if provided
        if (thumbnailData) {
          result.dfd.thumbnail = thumbnailData;
        }

        // Build update result
        const updateResult: DFDUpdateResult = {
          dfd: result.dfd,
          phaseStatus: result.phaseStatus,
          lastModified: result.lastModified,
        };

        // Notify parent
        onUpdate?.(updateResult);

        // Mark as clean
        markClean();

        console.log("[useDFDPersistence] Save successful");
        return updateResult;
      } catch (error) {
        console.error("[useDFDPersistence] Save error:", error);
        return null;
      }
    },
    [project, onUpdate, markClean],
  );

  /**
   * Schedule a debounced save
   * Used for auto-save during description editing
   */
  const scheduleSave = useCallback(
    (result: DFDUpdateResult) => {
      if (debounceDelay <= 0) {
        // Debouncing disabled, save immediately
        onUpdate?.(result);
        markClean();
        return;
      }

      // Store pending save
      pendingSaveRef.current = result;
      markDirty();

      // Clear existing timer
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      // Schedule new save
      saveTimerRef.current = setTimeout(() => {
        console.log("[useDFDPersistence] Executing debounced save...");

        if (pendingSaveRef.current) {
          onUpdate?.(pendingSaveRef.current);
          pendingSaveRef.current = null;
          markClean();
        }

        saveTimerRef.current = null;
      }, debounceDelay);

      console.log(`[useDFDPersistence] Save scheduled in ${debounceDelay}ms`);
    },
    [debounceDelay, onUpdate, markDirty, markClean],
  );

  /**
   * Schedule a debounced save triggered by DrawIO autosave event.
   * Does NOT require a pre-built DFDUpdateResult — reads XML from localStorage
   * via dfdService.saveDFD() directly.
   * Separate timer from scheduleSave to avoid interfering with description edits.
   */
  const scheduleDrawioSave = useCallback(
    (xml: string) => {
      markDirty();
      pendingXmlRef.current = xml; // immer neuestes XML merken

      if (drawioSaveTimerRef.current) {
        clearTimeout(drawioSaveTimerRef.current);
      }

      drawioSaveTimerRef.current = setTimeout(async () => {
        const currentXml = pendingXmlRef.current;
        if (!currentXml) return;

        try {
          const currentProject = projectRef.current;

          // XML direkt verarbeiten — kein localStorage-Read mehr
          const result = dfdService.saveDFDFromXml(currentProject, currentXml);

          if (!result.success) {
            console.error(
              "[useDFDPersistence] DrawIO autosave failed:",
              result.error,
            );
            return;
          }

          const updateResult: DFDUpdateResult = {
            dfd: result.dfd,
            phaseStatus: result.phaseStatus,
            lastModified: result.lastModified,
          };

          onUpdate?.(updateResult);
          markClean();
          onAfterDrawioSave?.(updateResult);

          console.log("[useDFDPersistence] DrawIO autosave successful");
        } catch (error) {
          console.error("[useDFDPersistence] DrawIO autosave error:", error);
        }

        pendingXmlRef.current = null;
        drawioSaveTimerRef.current = null;
      }, drawioAutosaveDelay);
    },
    [markDirty, markClean, onUpdate, onAfterDrawioSave, drawioAutosaveDelay],
  );

  /**
   * Flush any pending debounced save immediately
   * Used when switching tabs/views or unmounting
   */
  const flush = useCallback(() => {
    // Clear both timers
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (drawioSaveTimerRef.current) {
      clearTimeout(drawioSaveTimerRef.current);
      drawioSaveTimerRef.current = null;
    }

    // Execute pending description-edit save
    if (pendingSaveRef.current) {
      console.log("[useDFDPersistence] Flushing pending save...");
      onUpdate?.(pendingSaveRef.current);
      pendingSaveRef.current = null;
      markClean();
    }
  }, [onUpdate, markClean]);

  // ==================== CLEANUP ====================

  useEffect(() => {
    return () => {
      // Flush on unmount
      flush();
    };
  }, [flush]);

  // ==================== RETURN ====================

  return {
    isDirty,
    save,
    scheduleSave,
    scheduleDrawioSave,
    flush,
    markDirty,
    markClean,
  };
}

export default useDFDPersistence;