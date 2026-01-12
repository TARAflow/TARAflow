// ==================== USE DFD EDITOR HOOK ====================
// Refactored following SOLID principles:
// - S: Orchestrates sub-hooks, doesn't implement details
// - O: Extensible via dependency injection
// - L: Uses interfaces, implementations are swappable
// - I: Small, focused interfaces
// - D: Depends on abstractions, not concretions

import { useReducer, useEffect, useCallback, useRef, useMemo } from "react";
import {
  DFDProjectData,
  DFDStats,
  DFDUpdateResult,
  DFDElement,
  DFDConnection,
  DFDExportData,
} from "../models/dfd-types";
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
  generateThumbnailOnSave?: boolean;
  darkMode?: boolean;
  iframeKey?: number;
}

export interface UseDFDEditorDependencies {
  dfdService?: IDFDService;
  createStorageAdapter?: (projectId: string) => IDFDStorageAdapter;
  createAutoNumbering?: () => IAutoNumbering;
  createBridge?: (
    iframe: HTMLIFrameElement,
    projectId: string,
    projectName: string,
    darkMode?: boolean
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
  generateThumbnail: () => Promise<string | null>;
  sendAction: (action: string) => void;
  autoNumberLabels: () => Promise<void>;

  // NEW: Description editing
  updateElementDescription: (
    elementId: string,
    updates: Partial<DFDElement>
  ) => void;
  updateConnectionDescription: (
    connectionId: string,
    updates: Partial<DFDConnection>
  ) => void;

  // NEW: Export/Import
  exportDFD: () => DFDExportData | null;
  importDFD: (data: DFDExportData) => Promise<void>;
}

// ==================== DEFAULT DEPENDENCIES ====================

const defaultDependencies: Required<UseDFDEditorDependencies> = {
  dfdService: dfdService,
  createStorageAdapter: createDFDStorageAdapter,
  createAutoNumbering: () => new DFDAutoNumbering(30),
  createBridge: (iframe, projectId, projectName, _darkMode) =>
    new DrawioBridge(iframe, projectId, projectName),
  createXmlSourceManager: createXmlSourceManager,
};

// ==================== HOOK ====================

export function useDFDEditor(
  project: DFDProjectData,
  options: UseDFDEditorOptions = {},
  dependencies: UseDFDEditorDependencies = {}
): UseDFDEditorReturn {
  const deps = useMemo(
    () => ({ ...defaultDependencies, ...dependencies }),
    [dependencies]
  );

  const {
    onDirtyChange,
    onSave,
    autoValidateInterval = 500,
    autoNumberOnSave = false,
    generateThumbnailOnSave = true,
    darkMode = false,
    iframeKey = 0,
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

  const thumbnailResolverRef = useRef<((src: string | null) => void) | null>(
    null
  );
  const lastInitializedIframeKeyRef = useRef<number>(-1);

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

    storageAdapterRef.current?.syncFromLegacy();

    if (autoValidateInterval > 0) {
      if (validateTimeoutRef.current) {
        clearTimeout(validateTimeoutRef.current);
      }
      validateTimeoutRef.current = setTimeout(() => {
        runValidation();
      }, autoValidateInterval);
    }
  }, [onDirtyChange, autoValidateInterval, runValidation]);

  // ==================== DESCRIPTION UPDATES ====================

  /**
   * Update element description and trigger dirty state
   */
  const updateElementDescription = useCallback(
    (elementId: string, updates: Partial<DFDElement>) => {
      if (!project.dfd) return;

      const updatedElements = project.dfd.elements.map((el) =>
        el.id === elementId ? { ...el, ...updates } : el
      );

      const updatedDFD = {
        ...project.dfd,
        elements: updatedElements,
        lastModified: new Date().toISOString(),
      };

      // Update stats
      const describedElements = updatedElements.filter(
        (el) => el.description && el.description.trim().length > 0
      ).length;

      updatedDFD.stats = {
        ...updatedDFD.stats!,
        describedElements,
      };

      // Update project
      const result: DFDUpdateResult = {
        dfd: updatedDFD,
        phaseStatus: project.phaseStatus,
        lastModified: new Date().toISOString(),
      };

      onSave?.(result);
      dispatch({ type: "SET_DIRTY", payload: true });
      onDirtyChange?.(true);
    },
    [project, onSave, onDirtyChange]
  );

  /**
   * Update connection description and trigger dirty state
   */
  const updateConnectionDescription = useCallback(
    (connectionId: string, updates: Partial<DFDConnection>) => {
      if (!project.dfd) return;

      const updatedConnections = project.dfd.connections.map((conn) =>
        conn.id === connectionId ? { ...conn, ...updates } : conn
      );

      const updatedDFD = {
        ...project.dfd,
        connections: updatedConnections,
        lastModified: new Date().toISOString(),
      };

      // Update stats
      const describedConnections = updatedConnections.filter(
        (conn) =>
          conn.properties?.description &&
          conn.properties?.description.trim().length > 0
      ).length;

      updatedDFD.stats = {
        ...updatedDFD.stats!,
        describedConnections,
      };

      // Update project
      const result: DFDUpdateResult = {
        dfd: updatedDFD,
        phaseStatus: project.phaseStatus,
        lastModified: new Date().toISOString(),
      };

      onSave?.(result);
      dispatch({ type: "SET_DIRTY", payload: true });
      onDirtyChange?.(true);
    },
    [project, onSave, onDirtyChange]
  );

  // ==================== EXPORT/IMPORT ====================

  /**
   * Export DFD as JSON with XML and descriptions
   */
  const exportDFD = useCallback((): DFDExportData | null => {
    if (!project.dfd || !project.dfd.xml) {
      console.warn("No DFD data to export");
      return null;
    }

    const exportData: DFDExportData = {
      version: "1.0",
      projectName: project.name,
      exportDate: new Date().toISOString(),
      xml: project.dfd.xml,
      elements: project.dfd.elements,
      connections: project.dfd.connections,
    };

    return exportData;
  }, [project]);

  /**
   * Import DFD from JSON file
   */
  const importDFD = useCallback(
    async (data: DFDExportData) => {
      // Validate import data
      if (!data.xml || !data.elements || !data.connections) {
        throw new Error("Invalid DFD import data");
      }

      // Load XML into draw.io via bridge
      if (bridgeRef.current) {
        await bridgeRef.current.loadXml(data.xml);
      }

      // Calculate stats
      const stats: DFDStats = {
        totalElements: data.elements.length,
        externalEntities: data.elements.filter(
          (e) => e.type === "ExternalEntity"
        ).length,
        processes: data.elements.filter((e) => e.type === "Process").length,
        multiprocesses: data.elements.filter((e) => e.type === "Multiprocess")
          .length,
        dataStores: data.elements.filter((e) => e.type === "DataStore").length,
        dataFlows: data.connections.length,
        trustBoundaries: data.elements.filter((e) => e.type === "TrustBoundary")
          .length,
        physicalInterfaces: data.elements.filter(
          (e) => e.type === "PhysicalInterface"
        ).length,
        assets: data.elements.filter((e) => e.type === "Asset").length,
        interfaces: data.elements.filter((e) => e.type === "Interface").length,
        describedElements: data.elements.filter(
          (e) => e.description && e.description.trim().length > 0
        ).length,
        describedConnections: data.connections.filter(
          (c) =>
            c.properties?.description &&
            c.properties?.description.trim().length > 0
        ).length,
      };

      // Update project with imported data
      const updatedDFD = {
        xml: data.xml,
        elements: data.elements,
        connections: data.connections,
        stats,
        lastModified: new Date().toISOString(),
      };

      const result: DFDUpdateResult = {
        dfd: updatedDFD,
        phaseStatus: project.phaseStatus,
        lastModified: new Date().toISOString(),
      };

      onSave?.(result);
      dispatch({ type: "SET_DIRTY", payload: false });
      onDirtyChange?.(false);

      // Re-validate
      setTimeout(() => runValidation(), 1000);
    },
    [project, onSave, onDirtyChange, runValidation]
  );

  // ==================== IMAGE READY HANDLER ====================

  const handleImageReady = useCallback((imageSrc: string) => {
    dispatch({ type: "SET_PREVIEW_IMAGE", payload: imageSrc });

    if (thumbnailResolverRef.current) {
      thumbnailResolverRef.current(imageSrc);
      thumbnailResolverRef.current = null;
    }
  }, []);

  // ==================== INITIALIZATION ====================

  const doInitialize = useCallback(
    (iframe: HTMLIFrameElement) => {
      console.log(
        `[useDFDEditor] Initializing for project: ${project.id}, darkMode: ${darkMode}, iframeKey: ${iframeKey}`
      );

      bridgeRef.current?.dispose();
      lastInitializedIframeKeyRef.current = iframeKey;

      storageAdapterRef.current = deps.createStorageAdapter(project.id);
      deps.dfdService.loadDFDForEditing(project);

      const bridge = deps.createBridge(
        iframe,
        project.id,
        project.name,
        darkMode
      );
      bridgeRef.current = bridge;

      bridge.onDiagramChange(handleDiagramChange);
      bridge.onImageReady(handleImageReady);

      xmlSourceManagerRef.current = deps.createXmlSourceManager(
        project.id,
        () => bridge.getCurrentXml()
      );

      autoNumberingRef.current = deps.createAutoNumbering();

      dispatch({
        type: "SET_INITIALIZED",
        payload: { isInitialized: true, projectId: project.id },
      });

      setTimeout(() => runValidation(), 1000);
    },
    [
      project,
      deps,
      handleDiagramChange,
      handleImageReady,
      runValidation,
      darkMode,
      iframeKey,
    ]
  );

  const initialize = useCallback(() => {
    if (initRetryTimeoutRef.current) {
      clearTimeout(initRetryTimeoutRef.current);
      initRetryTimeoutRef.current = null;
    }

    const iframe = iframeRef.current;

    if (!iframe) {
      console.log("[useDFDEditor] No iframe ref, retrying...");
      initRetryTimeoutRef.current = setTimeout(initialize, 100);
      return;
    }

    if (!iframe.contentWindow) {
      console.log("[useDFDEditor] Iframe not ready, retrying...");
      initRetryTimeoutRef.current = setTimeout(initialize, 100);
      return;
    }

    const sameProject = state.currentProjectId === project.id;
    const sameIframeKey = lastInitializedIframeKeyRef.current === iframeKey;

    if (sameProject && sameIframeKey && state.isInitialized) {
      console.log(
        `[useDFDEditor] Already initialized for: ${project.id}, iframeKey: ${iframeKey}`
      );
      dispatch({ type: "SET_LOADING", payload: false });
      return;
    }

    if (sameProject && !sameIframeKey) {
      console.log(
        `[useDFDEditor] Re-initializing due to theme change (iframeKey: ${lastInitializedIframeKeyRef.current} -> ${iframeKey})`
      );
    }

    doInitialize(iframe);
  }, [
    project.id,
    state.currentProjectId,
    state.isInitialized,
    doInitialize,
    iframeKey,
  ]);

  // ==================== CLEANUP ====================

  useEffect(() => {
    return () => {
      if (validateTimeoutRef.current) clearTimeout(validateTimeoutRef.current);
      if (initRetryTimeoutRef.current)
        clearTimeout(initRetryTimeoutRef.current);
      bridgeRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    if (lastInitializedIframeKeyRef.current === -1) return;

    if (lastInitializedIframeKeyRef.current !== iframeKey) {
      console.log(`[useDFDEditor] Cleaning up bridge due to iframeKey change`);
      bridgeRef.current?.dispose();
      bridgeRef.current = null;
    }
  }, [iframeKey]);

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

    storageAdapterRef.current?.syncFromLegacy();

    const currentXml = xmlSourceManagerRef.current?.getXml();
    if (!currentXml) {
      console.warn("[useDFDEditor] No XML found for auto-numbering");
      return;
    }

    const numberedXml = autoNumberingRef.current?.autoNumber(currentXml);
    if (!numberedXml || numberedXml === currentXml) {
      console.log("[useDFDEditor] No changes after auto-numbering");
      return;
    }

    await bridgeRef.current?.loadXml(numberedXml);

    dispatch({ type: "SET_DIRTY", payload: true });
    onDirtyChange?.(true);

    setTimeout(() => runValidation(), 500);

    console.log("[useDFDEditor] Auto-numbering complete");
  }, [onDirtyChange, runValidation]);

  // ==================== THUMBNAIL GENERATION ====================

  const generateThumbnail = useCallback(async (): Promise<string | null> => {
    return new Promise((resolve) => {
      thumbnailResolverRef.current = resolve;
      bridgeRef.current?.exportImage();

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

    let thumbnail: string | undefined;
    if (generateThumbnailOnSave) {
      console.log("[useDFDEditor] Generating thumbnail...");
      const generatedThumbnail = await generateThumbnail();
      thumbnail = generatedThumbnail || undefined;
    }

    const result = deps.dfdService.saveDFD(project);

    if (result.success) {
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
    updateElementDescription,
    updateConnectionDescription,
    exportDFD,
    importDFD,
  };
}

export default useDFDEditor;