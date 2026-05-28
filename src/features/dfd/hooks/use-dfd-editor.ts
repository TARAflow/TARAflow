// ==================== USE DFD EDITOR HOOK (REFACTORED) ====================
// Single Responsibility: Orchestrate atomic hooks into unified API
// Follows Facade Pattern - simple interface, complex implementation

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  DFDProjectData,
  DFDUpdateResult,
  DFDElement,
  DFDConnection,
  DFDStats,
  DFDExportData,
} from "../models/dfd-types";
import type { DFDAsset } from "../models/dfd-asset-types";
import type { ValidationResult } from "../services/dfd-validator";
import type {
  DrawioViewport,
  DrawioExportResult,
} from "../models/drawio-types";

// Atomic hooks
import { useDFDData } from "./use-dfd-data";
import {
  useDrawioBridge,
  type UseDrawioBridgeReturn,
} from "./use-drawio-bridge";
import { useDFDValidation } from "./use-dfd-validation";
import { useDFDPersistence } from "./use-dfd-persistence";
import { useDFDThumbnail } from "./use-dfd-thumbnail";
import { useDFDAutoNumbering } from "./use-dfd-auto-numbering";
import { useDFDExportImport } from "./use-dfd-export-import";
import { useDFDCompletion } from "./use-dfd-completion";

import { DFDGraph } from "../models/dfd-graph-types";
import { DFDGraphAnalysisContext } from "../adapters/dfd-graph-analysis-context";

// ==================== TYPES ====================

export interface UseDFDEditorOptions {
  onDirtyChange?: (isDirty: boolean) => void;
  onUpdate?: (updates: DFDUpdateResult) => void;
  onPhaseComplete?: () => void;
  onSelectionChanged?: (cells: any[]) => void;
  darkMode?: boolean;
  autoValidateInterval?: number;
  autoNumberOnSave?: boolean;
  generateThumbnailOnSave?: boolean;
  graphContext?: DFDGraphAnalysisContext | null;
  /** Auto-numbering sort strategy, tolerance and diagonal weights */
  autoNumberingConfig?: {
    tolerance?: number;
    sortStrategy?: "top-down" | "left-right" | "diagonal";
    weightX?: number;
    weightY?: number;
  };
}

export interface UseDFDEditorReturn {
  // State
  isLoading: boolean;
  isDirty: boolean;
  validation: ValidationResult | null;
  stats: DFDStats | undefined;
  previewImage: string | null;
  selectedCells: any[];
  elements: DFDElement[];
  connections: DFDConnection[];

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
  selectCell: (cellId: string) => Promise<void>;
  exportXML: () => Promise<DrawioExportResult>;
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
  graphContext: DFDGraph | null;

  /** Send XML to draw.io without persisting — for transient overlay only. */
  loadXMLTransient: (xml: string, viewport?: DrawioViewport) => void;

  /** Load XML into draw.io and persist to localStorage. Used by import. */
  loadXML: (xml: string) => Promise<void>;
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
    onSelectionChanged,
    darkMode = false,
    autoValidateInterval = 500,
    autoNumberOnSave = false,
    generateThumbnailOnSave = true,
    graphContext,
    autoNumberingConfig,
  } = options;

  // Data consistency layer
  const data = useDFDData(project);

  // ==================== SELECTION RESOLUTION ====================

  const [pendingCells, setPendingCells] = useState<any[] | null>(null);

  /**
   * Wrapper um onSelectionChanged.
   * Wenn das selektierte Element noch nicht in data.dfd ist (neues Element,
   * Sync ausstehend), wird die Selection gepuffert und automatisch
   * neu emittiert sobald data.dfd.elements updated.
   */
  const handleSelectionChanged = useCallback(
    (cells: any[]) => {
      if (!cells.length) {
        setPendingCells(null);
        onSelectionChanged?.(cells);
        return;
      }

      const cell = cells[0];
      const id = cell?.xmlId || cell?.id;
      if (!id) {
        onSelectionChanged?.(cells);
        return;
      }

      const existsInData =
        data.dfd?.elements.some((e) => e.id === id) ||
        data.dfd?.connections.some((c) => c.id === id);

      if (existsInData) {
        // Element bereits im State → sofort forwarden
        setPendingCells(null);
        onSelectionChanged?.(cells);
      } else {
        // Noch nicht synchronisiert → puffern, retry via useEffect
        setPendingCells(cells);
      }
    },
    [data.dfd?.elements, data.dfd?.connections, onSelectionChanged],
  );

  /**
   * Retry: sobald data.dfd.elements updated (nach Debounce-Save),
   * prüfen ob das gepufferte Element jetzt vorhanden ist.
   */
  useEffect(() => {
    if (!pendingCells?.length) return;

    const cell = pendingCells[0];
    const id = cell?.xmlId || cell?.id;
    if (!id) return;

    const existsInData =
      data.dfd?.elements.some((e) => e.id === id) ||
      data.dfd?.connections.some((c) => c.id === id);

    if (existsInData) {
      onSelectionChanged?.(pendingCells);
      setPendingCells(null);
    }
    // Bewusst nur auf elements/connections reagieren, nicht auf pendingCells
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.dfd?.elements, data.dfd?.connections]);

  // ==================== ATOMIC HOOKS ====================

  // Validation layer
  const validation = useDFDValidation(project, {
    autoValidateDelay: autoValidateInterval,
  });

  // Ref to persistence.save — used inside onAfterDrawioSave to avoid a
  // circular reference (persistence is not yet declared when the options
  // object is constructed, so we access it via ref at call time).
  const persistenceSaveRef = useRef<
    ((thumbnail?: string) => Promise<any>) | null
  >(null);

  // Persistence layer
  const persistence = useDFDPersistence(project, {
    onUpdate,
    onDirtyChange,
    // Called after every DrawIO autosave (1.5s debounce after diagram change).
    // At this point the XML is already persisted — generate a fresh thumbnail
    // so the preview stays in sync without requiring a manual save.
    onAfterDrawioSave: generateThumbnailOnSave
      ? async () => {
          try {
            const imageData = (await bridgeRef.current?.exportImage()) ?? null;
            if (!imageData) return;

            // Write thumbnail via the persistence ref — avoids referencing
            // the persistence object before it is declared.
            await persistenceSaveRef.current?.(imageData);
          } catch (err) {
            console.warn(
              "[useDFDEditor] Thumbnail update after autosave failed:",
              err,
            );
          }
        }
      : undefined,
  });

  // Keep the ref current after persistence is constructed.
  persistenceSaveRef.current = persistence.save;

  // iframe communication layer
  const handleDiagramChange = useCallback(() => {
    persistence.markDirty();
    validation.scheduleValidation(autoValidateInterval);
    persistence.scheduleDrawioSave();
  }, [persistence, validation, autoValidateInterval]);

  // Called once after the draw.io plugin is fully injected (~3 s after mount).
  // This is the first moment exportImage() can reliably return data.
  // We generate an initial thumbnail here so new projects get a preview
  // even before the user manually saves.
  const handlePluginReady = useCallback(async () => {
    if (!generateThumbnailOnSave) return;

    console.log("[useDFDEditor] Plugin ready — generating initial thumbnail");
    // Small extra delay: give draw.io time to finish rendering after inject.
    await new Promise((resolve) => setTimeout(resolve, 500));

    try {
      const imageData = (await bridgeRef.current?.exportImage?.()) ?? null;
      if (imageData) {
        // Push thumbnail into the project via a lightweight save so it
        // persists immediately without requiring a full manual save.
        const result = await persistence.save(imageData);
        if (result) {
          console.log("[useDFDEditor] Initial thumbnail saved");
        }
      }
    } catch (err) {
      console.warn("[useDFDEditor] Initial thumbnail generation failed:", err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generateThumbnailOnSave]);

  // Ref so handlePluginReady can call bridge.exportImage without closing
  // over a stale bridge instance from a previous render.
  const bridgeRef = useRef<UseDrawioBridgeReturn | null>(null);

  const bridge = useDrawioBridge(project, {
    darkMode,
    onDiagramChange: handleDiagramChange,
    onSelectionChanged: handleSelectionChanged,
    onPluginReady: handlePluginReady,
  });

  // Keep bridgeRef in sync so handlePluginReady can call bridge.exportImage
  // without closing over a stale bridge instance.
  bridgeRef.current = bridge;

  // Thumbnail layer
  const thumbnail = useDFDThumbnail(bridge, project, {
    restoreFromProject: true,
  });

  // Auto-numbering layer
  const autoNumbering = useDFDAutoNumbering(bridge, validation, persistence, {
    tolerance: autoNumberingConfig?.tolerance ?? 50,
    sortStrategy: autoNumberingConfig?.sortStrategy ?? "diagonal",
    weightX: autoNumberingConfig?.weightX ?? 0.8,
    weightY: autoNumberingConfig?.weightY ?? 1.0,
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
    try {
      // Step 1: Auto-number if enabled
      if (autoNumberOnSave) {
        await autoNumbering.autoNumber();

        // Wait for draw.io to update
        await new Promise((resolve) => setTimeout(resolve, 800));
      }

      // Step 2: Generate thumbnail if enabled
      let thumbnailData: string | undefined;
      if (generateThumbnailOnSave) {
        const generated = await thumbnail.generate();
        thumbnailData = generated || undefined;
      }

      // Step 3: Execute save
      const result = await persistence.save(thumbnailData);

      if (result) {
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
      validation.scheduleValidation(autoValidateInterval);
    },
    [data, project.phaseStatus, persistence, validation, autoValidateInterval],
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
      validation.scheduleValidation(autoValidateInterval);
    },
    [data, project.phaseStatus, persistence, validation, autoValidateInterval],
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
      const timer = setTimeout(() => {
        validation.validate();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [bridge.isLoading]);

  // ==================== RETURN UNIFIED API ====================

  return {
    // State
    isLoading: bridge.isLoading,
    isDirty: persistence.isDirty,
    validation: validation.current,
    stats: data.stats,
    previewImage: thumbnail.preview,
    selectedCells: bridge.selectedCells,

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
    selectCell: bridge.selectCell,
    getCurrentXML: async () => bridge.getCurrentXML(),
    exportXML: bridge.exportXML,
    loadXMLTransient: bridge.loadXMLTransient,
    loadXML: bridge.loadXML,
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
    elements: data.dfd?.elements ?? [],
    connections: data.dfd?.connections ?? [],

    graphContext: project.dfd?.graph ?? null,
  };
}

export default useDFDEditor;