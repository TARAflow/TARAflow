// ==================== USE DRAWIO BRIDGE HOOK ====================
// Single Responsibility: Manage iframe communication with draw.io
// NO business logic, pure messaging layer

import { useRef, useState, useCallback, useEffect } from "react";
import type { DFDProjectData } from "../models/dfd-types";
import { DrawioBridge } from "../services/drawio-bridge";
import { createDFDStorageAdapter } from "../services/dfd-storage-adapter";
import dfdService from "../services/dfd-service";

// ==================== TYPES ====================

export interface UseDrawioBridgeOptions {
  darkMode?: boolean;
  onDiagramChange?: () => void;
  onSelectionChanged?: (cells: any[]) => void; // ✅ NEU
}

export interface UseDrawioBridgeReturn {
  // State
  isLoading: boolean;
  iframeKey: number;
  selectedCells: any[]; // ✅ NEU

  // Refs
  iframeRef: React.RefObject<HTMLIFrameElement | null>;

  // Lifecycle
  initialize: () => void;
  toggleTheme: () => void;

  // Operations
  loadXML: (xml: string) => Promise<void>;
  getCurrentXML: () => string | null;
  exportImage: () => Promise<string | null>;
  sendAction: (action: string) => void;

  // Event handlers
  onImageReady: (handler: (imageData: string) => void) => void;
}

// ==================== HOOK ====================

export function useDrawioBridge(
  project: DFDProjectData,
  options: UseDrawioBridgeOptions = {},
): UseDrawioBridgeReturn {
  const { darkMode = false, onDiagramChange, onSelectionChanged } = options; // ✅ NEU: onSelectionChanged

  // ==================== STATE ====================

  const [isLoading, setIsLoading] = useState(true);
  const [iframeKey, setIframeKey] = useState(0);
  const [selectedCells, setSelectedCells] = useState<any[]>([]); // ✅ NEU

  // ==================== REFS ====================

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const bridgeRef = useRef<DrawioBridge | null>(null);
  const initRetryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const imageResolverRef = useRef<((imageData: string | null) => void) | null>(
    null,
  );
  const imageHandlerRef = useRef<((imageData: string) => void) | null>(null);
  const lastInitializedProjectRef = useRef<string | null>(null);
  const lastInitializedKeyRef = useRef<number>(-1);

  // ==================== BRIDGE INITIALIZATION ====================

  const doInitialize = useCallback(
    (iframe: HTMLIFrameElement) => {
      setIsLoading(true);

      // Load DFD data to localStorage (for draw.io)
      const loadResult = dfdService.loadDFDForEditing(project);

      if (!loadResult.success) {
        console.error(
          "[useDrawioBridge] Failed to load DFD:",
          loadResult.error,
        );
        setIsLoading(false);
        return;
      }

      // Create storage adapter
      const storageAdapter = createDFDStorageAdapter(project.id);
      storageAdapter.loadToLocalStorage(project.dfd);

      // Create bridge
      const bridge = new DrawioBridge(iframe, project.id, project.name);
      bridgeRef.current = bridge;

      // Setup event handlers
      if (onDiagramChange) {
        bridge.onDiagramChange(() => {
          storageAdapter.syncFromLegacy();
          onDiagramChange();
        });
      }

      bridge.onSelectionChanged((cells) => {
        setSelectedCells(cells);

        if (onSelectionChanged) {
          onSelectionChanged(cells);
        } else {
          console.warn("[useDrawioBridge] ⚠️ No parent callback!"); // ✅ NEU
        }
      });

      bridge.onImageReady((imageData: string) => {
        // Resolve promise if waiting
        if (imageResolverRef.current) {
          imageResolverRef.current(imageData);
          imageResolverRef.current = null;
        }

        // Call handler if registered
        if (imageHandlerRef.current) {
          imageHandlerRef.current(imageData);
        }
      });

      const injectPlugin = async () => {
        // Warte bis DrawIO vollständig geladen ist
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Check if running in Electron
        if (window.electronAPI?.injectDrawioPlugin) {

          try {
            const result = await window.electronAPI.injectDrawioPlugin();

            if (!result.success) {
              console.error(
                "[useDrawioBridge] ❌ Plugin loading failed:",
                result.error,
              );
              console.error("[useDrawioBridge] Details:", result);
            }
          } catch (error) {
            console.error(
              "[useDrawioBridge] ❌ Plugin injection threw error:",
              error,
            );
          }
        } 
      };

      // Start plugin injection (non-blocking)
      injectPlugin();

      // Mark as initialized
      lastInitializedProjectRef.current = project.id;
      lastInitializedKeyRef.current = iframeKey;

      setIsLoading(false);
    },
    [project, onDiagramChange, onSelectionChanged, iframeKey],
  );

  const initialize = useCallback(() => {
    // Clear any pending retry
    if (initRetryTimeoutRef.current) {
      clearTimeout(initRetryTimeoutRef.current);
      initRetryTimeoutRef.current = null;
    }

    const iframe = iframeRef.current;

    // Wait for iframe to be ready
    if (!iframe?.contentWindow) {
      initRetryTimeoutRef.current = setTimeout(initialize, 100);
      return;
    }

    // Check if already initialized for this project and theme
    const sameProject = lastInitializedProjectRef.current === project.id;
    const sameKey = lastInitializedKeyRef.current === iframeKey;

    if (sameProject && sameKey) {
      setIsLoading(false);
      return;
    }

    if (sameProject && !sameKey) {
      console.info(
        `[useDrawioBridge] Re-initializing due to theme change (key: ${lastInitializedKeyRef.current} -> ${iframeKey})`,
      );
    }

    // Initialize bridge
    doInitialize(iframe);
  }, [project.id, iframeKey, doInitialize]);

  // ==================== OPERATIONS ====================

  const loadXML = useCallback(async (xml: string): Promise<void> => {
    if (!bridgeRef.current) {
      console.warn("[useDrawioBridge] Bridge not initialized");
      return;
    }

    await bridgeRef.current.loadXml(xml);
  }, []);

  const getCurrentXML = useCallback((): string | null => {
    if (!bridgeRef.current) {
      console.warn("[useDrawioBridge] Bridge not initialized");
      return null;
    }

    return bridgeRef.current.getCurrentXml();
  }, []);

  const exportImage = useCallback((): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!bridgeRef.current) {
        console.warn("[useDrawioBridge] Bridge not initialized");
        resolve(null);
        return;
      }

      imageResolverRef.current = resolve;
      bridgeRef.current.exportImage();

      // Timeout after 5 seconds
      setTimeout(() => {
        if (imageResolverRef.current) {
          console.warn("[useDrawioBridge] Image export timed out");
          imageResolverRef.current(null);
          imageResolverRef.current = null;
        }
      }, 5000);
    });
  }, []);

  const sendAction = useCallback((action: string): void => {
    if (!bridgeRef.current) {
      console.warn("[useDrawioBridge] Bridge not initialized");
      return;
    }

    bridgeRef.current.sendAction(action);
  }, []);

  const onImageReady = useCallback((handler: (imageData: string) => void) => {
    imageHandlerRef.current = handler;
  }, []);

  // ==================== THEME TOGGLE ====================

  const toggleTheme = useCallback(() => {
    setIframeKey((prev) => prev + 1);
  }, []);

  // ==================== CLEANUP ====================

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (initRetryTimeoutRef.current) {
        clearTimeout(initRetryTimeoutRef.current);
      }
      bridgeRef.current?.dispose();
    };
  }, []);

  // Cleanup on iframe key change (theme toggle)
  useEffect(() => {
    if (lastInitializedKeyRef.current === -1) return;

    if (lastInitializedKeyRef.current !== iframeKey) {
      bridgeRef.current?.dispose();
      bridgeRef.current = null;
    }
  }, [iframeKey]);

  // Cleanup on project change
  useEffect(() => {
    if (
      lastInitializedProjectRef.current !== null &&
      lastInitializedProjectRef.current !== project.id
    ) {

      if (initRetryTimeoutRef.current) {
        clearTimeout(initRetryTimeoutRef.current);
        initRetryTimeoutRef.current = null;
      }

      bridgeRef.current?.dispose();
      bridgeRef.current = null;
      lastInitializedProjectRef.current = null;
      lastInitializedKeyRef.current = -1;
    }
  }, [project.id]);

  return {
    isLoading,
    iframeKey,
    selectedCells, // ✅ NEU
    iframeRef,
    initialize,
    toggleTheme,
    loadXML,
    getCurrentXML,
    exportImage,
    sendAction,
    onImageReady,
  };
}

export default useDrawioBridge;
