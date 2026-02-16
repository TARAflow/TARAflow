// ==================== DRAWIO BRIDGE ====================
// Single Responsibility: Handles all Draw.io iframe communication
// Abstracts postMessage API and controller interactions

import { IDrawioBridge, IDrawioBridgeFactory } from "../interfaces/dfd-editor-interfaces";
import CORSCommunicator from "../services/cors-communicator";
import LocalStorageModel from "../services/local-storage-model";
import DrawioController from "../services/drawio-controller";

/**
 * DrawioBridge - Manages Draw.io iframe communication
 * 
 * Wraps CORSCommunicator, LocalStorageModel, and DrawioController
 * into a single, clean interface.
 */
export class DrawioBridge implements IDrawioBridge {
  private iframe: HTMLIFrameElement;
  private controller: DrawioController | null = null;
  private localStorageModel: LocalStorageModel;
  private corsComm: CORSCommunicator;
  private imageReadyCallback: ((imageSrc: string) => void) | null = null;
  private diagramChangeCallback: (() => void) | null = null;
  private selectionCallback: ((cells: any[]) => void) | null = null;
  private disposed = false;

  constructor(
    iframe: HTMLIFrameElement,
    projectId: string,
    projectName: string,
  ) {
    this.iframe = iframe;

    // Create project-specific storage key
    const storageKey = `project:${projectId}:DrawioMsg`;

    // Initialize components
    this.localStorageModel = new LocalStorageModel(storageKey);
    this.corsComm = new CORSCommunicator(iframe);
    this.controller = new DrawioController(
      this.corsComm,
      this.localStorageModel,
      projectName,
    );

    // Set up internal callbacks
    this.setupCallbacks();
  }

  private setupCallbacks(): void {
    // Listen for localStorage changes (diagram modifications)
    this.localStorageModel.observe(() => {
      if (!this.disposed && this.diagramChangeCallback) {
        this.diagramChangeCallback();
      }
    });

    // Set up image export callback
    if (this.controller) {
      this.controller.setImageReadyCallback((image: HTMLImageElement) => {
        if (!this.disposed && this.imageReadyCallback) {
          this.imageReadyCallback(image.src);
        }
      });

      this.controller.onSelectionChanged((cells: any[]) => {
        if (!this.disposed && this.selectionCallback) {
          this.selectionCallback(cells);
        }
      });
    }
  }

  /**
   * Set callback for selection changes
   */
  onSelectionChanged(callback: (cells: any[]) => void): void {
    this.selectionCallback = callback;
  }

  /**
   * Check if the bridge is ready (iframe has contentWindow)
   */
  isReady(): boolean {
    return !this.disposed && Boolean(this.iframe.contentWindow);
  }

  /**
   * Send an action to Draw.io (zoom, undo, redo, fit, etc.)
   */
  sendAction(action: string): void {
    if (!this.isReady()) {
      console.warn(`[DrawioBridge] Cannot send action "${action}" - not ready`);
      return;
    }

    const msg = JSON.stringify({ action });
    this.iframe.contentWindow!.postMessage(msg, "*");
  }

  /**
   * Load XML into Draw.io
   *
   * IMPORTANT: This method also persists the XML to localStorage immediately.
   * Draw.io's autosave only triggers on user interactions, not on programmatic loads.
   * Without this, changes from auto-numbering would be lost on tab switch.
   */
  loadXml(xml: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.isReady()) {
        reject(new Error("Draw.io bridge not ready"));
        return;
      }

      try {
        const msg = JSON.stringify({
          action: "load",
          xml: xml,
          autosave: 1,
        });

        this.iframe.contentWindow!.postMessage(msg, "*");

        // ==================== FIX: Persist XML to localStorage ====================
        // Draw.io's autosave event only fires on user interactions.
        // When loading XML programmatically (e.g., after auto-numbering),
        // we must also write to localStorage to persist the changes.
        const storageData = JSON.stringify({ xml: xml });
        this.localStorageModel.write(storageData);

        // Also write to legacy key for compatibility with other components
        localStorage.setItem("DrawioMsg", storageData);
        // ===========================================================================

        // Give Draw.io time to process
        setTimeout(resolve, 500);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Export diagram as image
   */
  exportImage(): void {
    if (this.controller) {
      this.controller.exportDiagram();
    } else {
      console.warn("[DrawioBridge] Controller not available for export");
    }
  }

  /**
   * Set callback for when image export is ready
   */
  onImageReady(callback: (imageSrc: string) => void): void {
    this.imageReadyCallback = callback;
  }

  /**
   * Set callback for diagram changes
   */
  onDiagramChange(callback: () => void): void {
    this.diagramChangeCallback = callback;
  }

  /**
   * Get current XML from controller
   */
  getCurrentXml(): string | null {
    if (this.controller) {
      return this.controller.getCurrentXml();
    }
    return null;
  }

  /**
   * Get the LocalStorageModel (for external sync operations)
   */
  getLocalStorageModel(): LocalStorageModel {
    return this.localStorageModel;
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.disposed = true;
    this.localStorageModel.clearObservers();
    this.controller = null;
    this.imageReadyCallback = null;
    this.diagramChangeCallback = null;
    this.selectionCallback = null;
  }
}

// ==================== FACTORY ====================

/**
 * Factory for creating DrawioBridge instances
 * Enables dependency injection and testing
 */
export class DrawioBridgeFactory implements IDrawioBridgeFactory {
  create(
    iframe: HTMLIFrameElement,
    projectId: string,
    projectName: string
  ): IDrawioBridge {
    return new DrawioBridge(iframe, projectId, projectName);
  }
}

// Export singleton factory
export const drawioBridgeFactory = new DrawioBridgeFactory();
export default DrawioBridge;