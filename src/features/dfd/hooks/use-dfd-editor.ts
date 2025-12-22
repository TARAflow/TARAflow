// ==================== USE DFD EDITOR HOOK ====================
// Refactored following SOLID principles:
// - S: Orchestrates sub-hooks, doesn't implement details
// - O: Extensible via dependency injection
// - L: Uses interfaces, implementations are swappable
// - I: Small, focused interfaces
// - D: Depends on abstractions, not concretions

import { useReducer, useEffect, useCallback, useRef, useMemo } from "react";
import { DFDProjectData, DFDStats, DFDUpdateResult } from "../models/dfd-types";
import { ValidationResult } from "../services/dfd-validator";
import {
  dfdEditorReducer,
  createInitialEditorState,
  IDrawioBridge,
  IXmlSourceManager,
  IAutoNumbering,
  IDFDService,
  IDFDStorageAdapter,
} from "../interfaces/dfd-editor-interfaces";

// Default implementations
import dfdService from "../services/dfd-service";
import { createDFDStorageAdapter } from "../services/dfd-storage-adapter";
import { DFDAutoNumbering } from "../services/dfd-auto-numbering";
import { DrawioBridge } from "../services/drawio-bridge";
import { createXmlSourceManager } from "../services/xml-source-manager";

// ==================== TYPES ====================

export interface UseDFDEditorOptions {
  onDirtyChange?: (isDirty: boolean) => void;
  onSave?: (updates: DFDUpdateResult) => void;
  autoValidateInterval?: number;
  autoNumberOnSave?: boolean;
  generateThumbnailOnSave?: boolean; // NEW: Generate thumbnail when saving
}

export interface UseDFDEditorDependencies {
  dfdService?: IDFDService;
  createStorageAdapter?: (projectId: string) => IDFDStorageAdapter;
  createAutoNumbering?: () => IAutoNumbering;
  createBridge?: (
    iframe: HTMLIFrameElement,
    projectId: string,
    projectName: string
  ) => IDrawioBridge;
  createXmlSourceManager?: (
    projectId: string,
    getControllerXml?: () => string | null
  ) => IXmlSourceManager;
}

export interface UseDFDEditorReturn {
  // State
  isLoading: boolean;
  isDirty: boolean;
  validation: ValidationResult | null;
  stats: DFDStats | null;
  previewImage: string | null;

  // Refs
  iframeRef: React.RefObject<HTMLIFrameElement | null>;

  // Actions
  initialize: () => void;
  save: () => Promise<DFDUpdateResult | null>;
  validate: () => ValidationResult;
  exportImage: () => void;
  generateThumbnail: () => Promise<string | null>; // NEW: Generate thumbnail on demand
  sendAction: (action: string) => void;
  autoNumberLabels: () => Promise<void>;
}

// ==================== DEFAULT DEPENDENCIES ====================

const defaultDependencies: Required<UseDFDEditorDependencies> = {
  dfdService: dfdService,
  createStorageAdapter: createDFDStorageAdapter,
  createAutoNumbering: () => new DFDAutoNumbering(30),
  createBridge: (iframe, projectId, projectName) =>
    new DrawioBridge(iframe, projectId, projectName),
  createXmlSourceManager: createXmlSourceManager,
};

// ==================== HOOK ====================

/**
 * useDFDEditor - Orchestrates DFD editor functionality
 *
 * This hook follows the Facade pattern - it provides a simple interface
 * to complex subsystems (bridge, xml sources, validation, etc.)
 *
 * Dependencies can be injected for testing or customization.
 */
export function useDFDEditor(
  project: DFDProjectData,
  options: UseDFDEditorOptions = {},
  dependencies: UseDFDEditorDependencies = {}
): UseDFDEditorReturn {
  // Memoize dependencies to prevent unnecessary re-renders
  const deps = useMemo(
    () => ({ ...defaultDependencies, ...dependencies }),
    [dependencies]
  );

  const {
    onDirtyChange,
    onSave,
    autoValidateInterval = 500,
    autoNumberOnSave = false,
    generateThumbnailOnSave = true, // NEW: Default to true
  } = options;

  // ==================== STATE ====================

  const [state, dispatch] = useReducer(
    dfdEditorReducer,
    createInitialEditorState()
  );

  // ==================== REFS ====================

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const bridgeRef = useRef<IDrawioBridge | null>(null);
  const storageAdapterRef = useRef<IDFDStorageAdapter | null>(null);
  const xmlSourceManagerRef = useRef<IXmlSourceManager | null>(null);
  const autoNumberingRef = useRef<IAutoNumbering | null>(null);
  const validateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initRetryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // NEW: Promise resolver for thumbnail generation
  const thumbnailResolverRef = useRef<((src: string | null) => void) | null>(
    null
  );

  // ==================== VALIDATION ====================

  const runValidation = useCallback((): ValidationResult => {
    try {
      const result = deps.dfdService.validateCurrentState(project.id);
      const stats = deps.dfdService.getCurrentStats(project.id);

      dispatch({
        type: "VALIDATION_COMPLETE",
        payload: { validation: result, stats },
      });

      return result;
    } catch (error) {
      console.error("[useDFDEditor] Validation failed:", error);
      const emptyResult: ValidationResult = {
        isValid: false,
        isComplete: false,
        errors: [],
        warnings: [],
        scenario: null,
      };
      dispatch({ type: "SET_VALIDATION", payload: emptyResult });
      return emptyResult;
    }
  }, [project.id, deps.dfdService]);

  // ==================== CHANGE HANDLING ====================

  const handleDiagramChange = useCallback(() => {
    dispatch({ type: "SET_DIRTY", payload: true });
    onDirtyChange?.(true);

    // Sync from legacy storage
    storageAdapterRef.current?.syncFromLegacy();

    // Debounced validation
    if (autoValidateInterval > 0) {
      if (validateTimeoutRef.current) {
        clearTimeout(validateTimeoutRef.current);
      }
      validateTimeoutRef.current = setTimeout(() => {
        runValidation();
      }, autoValidateInterval);
    }
  }, [onDirtyChange, autoValidateInterval, runValidation]);

  // ==================== IMAGE READY HANDLER ====================

  const handleImageReady = useCallback((imageSrc: string) => {
    dispatch({ type: "SET_PREVIEW_IMAGE", payload: imageSrc });

    // Resolve pending thumbnail promise if any
    if (thumbnailResolverRef.current) {
      thumbnailResolverRef.current(imageSrc);
      thumbnailResolverRef.current = null;
    }
  }, []);

  // ==================== INITIALIZATION ====================

  const doInitialize = useCallback(
    (iframe: HTMLIFrameElement) => {
      console.log(`[useDFDEditor] Initializing for project: ${project.id}`);

      // Cleanup previous bridge
      bridgeRef.current?.dispose();

      // Create storage adapter
      storageAdapterRef.current = deps.createStorageAdapter(project.id);

      // Load DFD data into localStorage
      deps.dfdService.loadDFDForEditing(project);

      // Create bridge
      const bridge = deps.createBridge(iframe, project.id, project.name);
      bridgeRef.current = bridge;

      // Set up callbacks
      bridge.onDiagramChange(handleDiagramChange);
      bridge.onImageReady(handleImageReady);

      // Create XML source manager
      xmlSourceManagerRef.current = deps.createXmlSourceManager(
        project.id,
        () => bridge.getCurrentXml()
      );

      // Create auto-numbering service
      autoNumberingRef.current = deps.createAutoNumbering();

      // Mark as initialized
      dispatch({
        type: "SET_INITIALIZED",
        payload: { isInitialized: true, projectId: project.id },
      });

      // Initial validation
      setTimeout(() => runValidation(), 1000);
    },
    [project, deps, handleDiagramChange, handleImageReady, runValidation]
  );

  const initialize = useCallback(() => {
    // Clear pending retry
    if (initRetryTimeoutRef.current) {
      clearTimeout(initRetryTimeoutRef.current);
      initRetryTimeoutRef.current = null;
    }

    const iframe = iframeRef.current;

    // Guard: Need iframe
    if (!iframe) {
      console.log("[useDFDEditor] No iframe ref, retrying...");
      initRetryTimeoutRef.current = setTimeout(initialize, 100);
      return;
    }

    // Guard: iframe must be loaded
    if (!iframe.contentWindow) {
      console.log("[useDFDEditor] Iframe not ready, retrying...");
      initRetryTimeoutRef.current = setTimeout(initialize, 100);
      return;
    }

    // Guard: Already initialized for this project
    if (state.currentProjectId === project.id && state.isInitialized) {
      console.log(`[useDFDEditor] Already initialized for: ${project.id}`);
      dispatch({ type: "SET_LOADING", payload: false });
      return;
    }

    doInitialize(iframe);
  }, [project.id, state.currentProjectId, state.isInitialized, doInitialize]);

  // ==================== CLEANUP ====================

  useEffect(() => {
    return () => {
      if (validateTimeoutRef.current) clearTimeout(validateTimeoutRef.current);
      if (initRetryTimeoutRef.current)
        clearTimeout(initRetryTimeoutRef.current);
      bridgeRef.current?.dispose();
    };
  }, []);

  // ==================== PROJECT CHANGE ====================

  useEffect(() => {
    if (
      state.currentProjectId !== null &&
      state.currentProjectId !== project.id
    ) {
      console.log(
        `[useDFDEditor] Project changed: ${state.currentProjectId} -> ${project.id}`
      );

      if (initRetryTimeoutRef.current) {
        clearTimeout(initRetryTimeoutRef.current);
        initRetryTimeoutRef.current = null;
      }

      bridgeRef.current?.dispose();
      dispatch({ type: "RESET_FOR_PROJECT_CHANGE" });
    }
  }, [project.id, state.currentProjectId]);

  // ==================== AUTO NUMBERING ====================

  const autoNumberLabels = useCallback(async (): Promise<void> => {
    console.log("[useDFDEditor] Auto-numbering labels...");

    // Sync storage first
    storageAdapterRef.current?.syncFromLegacy();

    // Get XML via source manager
    const currentXml = xmlSourceManagerRef.current?.getXml();
    if (!currentXml) {
      console.warn("[useDFDEditor] No XML found for auto-numbering");
      return;
    }

    // Apply auto-numbering
    const numberedXml = autoNumberingRef.current?.autoNumber(currentXml);
    if (!numberedXml || numberedXml === currentXml) {
      console.log("[useDFDEditor] No changes after auto-numbering");
      return;
    }

    // Load into Draw.io
    await bridgeRef.current?.loadXml(numberedXml);

    dispatch({ type: "SET_DIRTY", payload: true });
    onDirtyChange?.(true);

    // Revalidate after short delay
    setTimeout(() => runValidation(), 500);

    console.log("[useDFDEditor] Auto-numbering complete");
  }, [onDirtyChange, runValidation]);

  // ==================== THUMBNAIL GENERATION ====================

  /**
   * Generate thumbnail and return as Promise
   * Triggers export and waits for image ready callback
   */
  const generateThumbnail = useCallback(async (): Promise<string | null> => {
    return new Promise((resolve) => {
      // Set up resolver
      thumbnailResolverRef.current = resolve;

      // Trigger export
      bridgeRef.current?.exportImage();

      // Timeout fallback (5 seconds)
      setTimeout(() => {
        if (thumbnailResolverRef.current) {
          console.warn("[useDFDEditor] Thumbnail generation timed out");
          thumbnailResolverRef.current(state.previewImage);
          thumbnailResolverRef.current = null;
        }
      }, 5000);
    });
  }, [state.previewImage]);

  // ==================== PUBLIC ACTIONS ====================

  const validate = useCallback((): ValidationResult => {
    return runValidation();
  }, [runValidation]);

  const save = useCallback(async (): Promise<DFDUpdateResult | null> => {
    storageAdapterRef.current?.syncFromLegacy();

    if (autoNumberOnSave) {
      await autoNumberLabels();
      await new Promise((resolve) => setTimeout(resolve, 800));
      storageAdapterRef.current?.syncFromLegacy();
    }

    // NEW: Generate thumbnail before saving
    let thumbnail: string | undefined;
    if (generateThumbnailOnSave) {
      console.log("[useDFDEditor] Generating thumbnail...");
      const generatedThumbnail = await generateThumbnail();
      thumbnail = generatedThumbnail || undefined;
    }

    const result = deps.dfdService.saveDFD(project);

    if (result.success) {
      // NEW: Add thumbnail to DFD data
      if (thumbnail) {
        result.dfd.thumbnail = thumbnail;
      }

      dispatch({
        type: "SAVE_SUCCESS",
        payload: { validation: result.validation },
      });
      onDirtyChange?.(false);

      const updateResult: DFDUpdateResult = {
        dfd: result.dfd,
        phaseStatus: result.phaseStatus,
        lastModified: result.lastModified,
      };

      onSave?.(updateResult);
      return updateResult;
    }

    console.error("[useDFDEditor] Save failed:", result.error);
    return null;
  }, [
    project,
    deps.dfdService,
    autoNumberOnSave,
    autoNumberLabels,
    generateThumbnailOnSave,
    generateThumbnail,
    onDirtyChange,
    onSave,
  ]);

  const exportImage = useCallback(() => {
    bridgeRef.current?.exportImage();
  }, []);

  const sendAction = useCallback((action: string) => {
    bridgeRef.current?.sendAction(action);
  }, []);

  // ==================== RETURN ====================

  return {
    isLoading: state.isLoading,
    isDirty: state.isDirty,
    validation: state.validation,
    stats: state.stats,
    previewImage: state.previewImage,
    iframeRef,
    initialize,
    save,
    validate,
    exportImage,
    generateThumbnail,
    sendAction,
    autoNumberLabels,
  };
}

export default useDFDEditor;