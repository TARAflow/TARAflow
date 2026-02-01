// ==================== USE DFD EDITOR HOOK (REFACTORED) ====================
// Single Responsibility: Orchestrate atomic hooks into unified API
// Follows Facade Pattern - simple interface, complex implementation

import { useCallback, useEffect } from "react";
import type {
  DFDProjectData,
  DFDUpdateResult,
  DFDElement,
  DFDAsset,
  DFDConnection,
  DFDStats,
  DFDExportData,
} from "../models/dfd-types";
import type { ValidationResult } from "../services/dfd-validator";

// Atomic hooks
import { useDFDData } from "./use-dfd-data";
import { useDrawioBridge } from "./use-drawio-bridge";
import { useDFDValidation } from "./use-dfd-validation";
import { useDFDPersistence } from "./use-dfd-persistence";
import { useDFDThumbnail } from "./use-dfd-thumbnail";
import { useDFDAutoNumbering } from "./use-dfd-auto-numbering";
import { useDFDExportImport } from "./use-dfd-export-import";
import { useDFDCompletion } from "./use-dfd-completion";

// ==================== TYPES ====================

export interface UseDFDEditorOptions {
  onDirtyChange?: (isDirty: boolean) => void;
  onUpdate?: (updates: DFDUpdateResult) => void;
  onPhaseComplete?: () => void;
  darkMode?: boolean;
  autoValidateInterval?: number;
  autoNumberOnSave?: boolean;
  generateThumbnailOnSave?: boolean;
}

export interface UseDFDEditorReturn {
  // State
  isLoading: boolean;
  isDirty: boolean;
  validation: ValidationResult | null;
  stats: DFDStats | undefined;
  previewImage: string | null;

  // Refs
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  iframeKey: number;

  // Lifecycle
  initialize: () => void;

  // Save operations
  save: () => Promise<DFDUpdateResult | null>;

  // Validation
  validate: () => ValidationResult;

  // Image operations
  exportImage: () => void;
  generateThumbnail: () => Promise<string | null>;

  // Editor operations
  sendAction: (action: string) => void;
  getCurrentXML: () => Promise<string | null>;
  autoNumberLabels: () => Promise<void>;

  // Description editing (triggers debounced save)
  updateElementDescription: (
    elementId: string,
    updates: Partial<DFDElement>,
  ) => void;
  updateAssetDescription: (assetId: string, updates: Partial<DFDAsset>) => void;
  updateConnectionDescription: (
    connectionId: string,
    updates: Partial<DFDConnection>,
  ) => void;

  // Export/Import
  exportDFD: () => DFDExportData | null;
  importDFD: (data: DFDExportData) => Promise<void>;

  // Utility
  flushDebouncedSave: () => void;

  // Completion
  canProceed: boolean;
}

// ==================== HOOK ====================

export function useDFDEditor(
  project: DFDProjectData,
  options: UseDFDEditorOptions = {},
): UseDFDEditorReturn {
  const {
    onDirtyChange,
    onUpdate,
    onPhaseComplete,
    darkMode = false,
    autoValidateInterval = 500,
    autoNumberOnSave = false,
    generateThumbnailOnSave = true,
  } = options;

  // ==================== ATOMIC HOOKS ====================

  // Data consistency layer
  const data = useDFDData(project);

  // iframe communication layer
  const bridge = useDrawioBridge(project, {
    darkMode,
    onDiagramChange: () => {
      persistence.markDirty();
      validation.scheduleValidation(autoValidateInterval);
    },
  });

  // Validation layer
  const validation = useDFDValidation(project, {
    autoValidateDelay: autoValidateInterval,
  });

  // Persistence layer
  const persistence = useDFDPersistence(project, {
    onUpdate,
    onDirtyChange,
  });

  // Thumbnail layer
  const thumbnail = useDFDThumbnail(bridge, project, {
    restoreFromProject: true,
  });

  // Auto-numbering layer
  const autoNumbering = useDFDAutoNumbering(bridge, validation, persistence, {
    startNumber: 30,
    validateAfter: true,
    validationDelay: 500,
  });

  // Export/Import layer
  const exportImport = useDFDExportImport(project, bridge, persistence);

  // Completion business rules
  const completion = useDFDCompletion(validation, persistence, data.stats, {
    onPhaseComplete,
  });

  // ==================== COORDINATED OPERATIONS ====================

  /**
   * Save with optional auto-numbering and thumbnail generation
   */
  const save = useCallback(async (): Promise<DFDUpdateResult | null> => {
    console.log("[useDFDEditor] Save operation started");

    try {
      // Step 1: Auto-number if enabled
      if (autoNumberOnSave) {
        console.log("[useDFDEditor] Auto-numbering before save...");
        await autoNumbering.autoNumber();

        // Wait for draw.io to update
        await new Promise((resolve) => setTimeout(resolve, 800));
      }

      // Step 2: Generate thumbnail if enabled
      let thumbnailData: string | undefined;
      if (generateThumbnailOnSave) {
        console.log("[useDFDEditor] Generating thumbnail...");
        const generated = await thumbnail.generate();
        thumbnailData = generated || undefined;
      }

      // Step 3: Execute save
      const result = await persistence.save(thumbnailData);

      if (result) {
        console.log("[useDFDEditor] Save completed successfully");

        // Update validation state
        validation.validate();
      }

      return result;
    } catch (error) {
      console.error("[useDFDEditor] Save failed:", error);
      return null;
    }
  }, [
    autoNumberOnSave,
    generateThumbnailOnSave,
    autoNumbering,
    thumbnail,
    persistence,
    validation,
  ]);

  /**
   * Update element and schedule debounced save
   */
  const updateElementDescription = useCallback(
    (elementId: string, updates: Partial<DFDElement>) => {
      // Update data (rebuilds graph)
      const updatedDFD = data.updateElement(elementId, updates);

      // Schedule debounced save
      const result: DFDUpdateResult = {
        dfd: updatedDFD,
        phaseStatus: project.phaseStatus,
        lastModified: updatedDFD.lastModified!,
      };

      persistence.scheduleSave(result);
    },
    [data, project.phaseStatus, persistence],
  );

  /**
   * Update asset and schedule debounced save
   */
  const updateAssetDescription = useCallback(
    (assetId: string, updates: Partial<DFDAsset>) => {
      // Update data (rebuilds graph, re-syncs linkedElements)
      const updatedDFD = data.updateAsset(assetId, updates);

      // Schedule debounced save
      const result: DFDUpdateResult = {
        dfd: updatedDFD,
        phaseStatus: project.phaseStatus,
        lastModified: updatedDFD.lastModified!,
      };

      persistence.scheduleSave(result);
    },
    [data, project.phaseStatus, persistence],
  );

  /**
   * Update connection and schedule debounced save
   */
  const updateConnectionDescription = useCallback(
    (connectionId: string, updates: Partial<DFDConnection>) => {
      // Update data (rebuilds graph)
      const updatedDFD = data.updateConnection(connectionId, updates);

      // Schedule debounced save
      const result: DFDUpdateResult = {
        dfd: updatedDFD,
        phaseStatus: project.phaseStatus,
        lastModified: updatedDFD.lastModified!,
      };

      persistence.scheduleSave(result);
    },
    [data, project.phaseStatus, persistence],
  );

  /**
   * Export image and update preview
   */
  const exportImage = useCallback(() => {
    thumbnail.generate();
  }, [thumbnail]);

  // ==================== INITIAL VALIDATION ====================

  // Run initial validation after bridge initializes
  useEffect(() => {
    if (!bridge.isLoading) {
      // Small delay to ensure draw.io is ready
      const timer = setTimeout(() => {
        validation.validate();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [bridge.isLoading, validation]);

  // ==================== RETURN UNIFIED API ====================

  return {
    // State
    isLoading: bridge.isLoading,
    isDirty: persistence.isDirty,
    validation: validation.current,
    stats: data.stats,
    previewImage: thumbnail.preview,

    // Refs
    iframeRef: bridge.iframeRef,
    iframeKey: bridge.iframeKey,

    // Lifecycle
    initialize: bridge.initialize,

    // Save operations
    save,

    // Validation
    validate: validation.validate,

    // Image operations
    exportImage,
    generateThumbnail: thumbnail.generate,

    // Editor operations
    sendAction: bridge.sendAction,
    getCurrentXML: async () => bridge.getCurrentXML(), 
    autoNumberLabels: autoNumbering.autoNumber,

    // Description editing
    updateElementDescription,
    updateAssetDescription,
    updateConnectionDescription,

    // Export/Import
    exportDFD: exportImport.exportDFD,
    importDFD: exportImport.importDFD,

    // Utility
    flushDebouncedSave: persistence.flush,

    // Completion
    canProceed: completion.canProceed,
  };
}

export default useDFDEditor;
