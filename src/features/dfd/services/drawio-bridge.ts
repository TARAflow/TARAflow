// ==================== DRAWIO BRIDGE ====================
// Single Responsibility: Handles all Draw.io iframe communication
// Abstracts postMessage API and controller interactions

import { IDrawioBridge, IDrawioBridgeFactory } from "../interfaces/dfd-editor-interfaces";
import type {
  DrawioViewport,
  DrawioExportResult,
} from "../models/drawio-types";
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

    const storageKey = `project:${projectId}:DrawioMsg`;

    this.localStorageModel = new LocalStorageModel(storageKey);
    this.corsComm = new CORSCommunicator(iframe);
    this.controller = new DrawioController(
      this.corsComm,
      this.localStorageModel,
      projectName,
    );

    this.setupCallbacks();
  }

  private setupCallbacks(): void {
    this.localStorageModel.observe(() => {
      if (!this.disposed && this.diagramChangeCallback) {
        this.diagramChangeCallback();
      }
    });

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

  onSelectionChanged(callback: (cells: any[]) => void): void {
    this.selectionCallback = callback;
  }

  isReady(): boolean {
    return !this.disposed && Boolean(this.iframe.contentWindow);
  }

  sendAction(action: string): void {
    if (!this.isReady()) {
      console.warn(`[DrawioBridge] Cannot send action "${action}" - not ready`);
      return;
    }
    const msg = JSON.stringify({ action });
    this.iframe.contentWindow!.postMessage(msg, "*");
  }

  /**
   * Load XML into Draw.io AND persist to localStorage.
   * Used for permanent diagram changes (auto-numbering, import, etc.)
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

        // Persist to localStorage so changes survive tab switches
        const storageData = JSON.stringify({ xml: xml });
        this.localStorageModel.write(storageData);
        localStorage.setItem("DrawioMsg", storageData);

        setTimeout(resolve, 500);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Request current diagram XML + viewport state from draw.io via postMessage.
   * Returns xml, translate and scale from the export event.
   */
  exportXml(): Promise<DrawioExportResult> {
    return new Promise((resolve, reject) => {
      if (!this.iframe.contentWindow) {
        reject(new Error("[DrawioBridge] exportXml: no contentWindow"));
        return;
      }

      // Start scroll fetch immediately — runs in parallel with the export postMessage
      const scrollPromise =
        window.electronAPI?.getDrawioScroll?.() ??
        Promise.resolve({ scrollLeft: 0, scrollTop: 0 });

      const handler = async (e: MessageEvent) => {
        if (!e.origin.includes("diagrams.net")) return;
        try {
          const msg = JSON.parse(e.data);
          if (msg.event === "export" && typeof msg.xml === "string") {
            window.removeEventListener("message", handler);
            // scroll fetch is already in-flight — just await it
            const scroll = await scrollPromise;
            resolve({
              xml: msg.xml,
              translate: msg.translate ?? { x: 0, y: 0 },
              scale: msg.scale ?? 1,
              scrollLeft: scroll.scrollLeft,
              scrollTop: scroll.scrollTop,
            });
          }
        } catch {
          // ignore non-JSON messages
        }
      };

      window.addEventListener("message", handler);
      this.iframe.contentWindow.postMessage(
        JSON.stringify({ action: "export", format: "xml" }),
        "*",
      );

      setTimeout(() => {
        window.removeEventListener("message", handler);
        reject(new Error("[DrawioBridge] exportXml timed out after 5s"));
      }, 5000);
    });
  }

  /**
   * Send XML to draw.io WITHOUT persisting to localStorage.
   * Used exclusively for transient overlay display (asset inspection mode).
   *
   * If a viewport is provided, the plugin will restore it after draw.io
   * finishes loading (which resets the viewport internally).
   */
  loadXmlTransient(xml: string, viewport?: DrawioViewport): void {
    if (!this.iframe.contentWindow) {
      console.warn("[DrawioBridge] loadXmlTransient: no contentWindow");
      return;
    }
    // No autosave: 1 — transient load must never dirty the diagram state
    this.iframe.contentWindow.postMessage(
      JSON.stringify({ action: "load", xml }),
      "*",
    );
    if (viewport) {
      // Delay allows draw.io to finish its internal load + viewport reset
      // before we restore via IPC (which sets graph.view directly)
      setTimeout(() => void this.setViewport(viewport), 300);
    }
  }

  /**
   * Restore viewport via Electron IPC → executeJavaScript in draw.io frame.
   * Uses Draw._taraflowUi.editor.graph.view directly — the only reliable
   * approach since postMessage cannot cross Electron's isolated JS contexts.
   */
  async setViewport(viewport: DrawioViewport): Promise<void> {
    if (window.electronAPI?.setDrawioViewport) {
      await window.electronAPI.setDrawioViewport({
        translate: viewport.translate,
        scale: viewport.scale,
        scrollLeft: viewport.scrollLeft,
        scrollTop: viewport.scrollTop,
      });
    }
  }

  exportImage(): void {
    if (this.controller) {
      this.controller.exportDiagram();
    } else {
      console.warn("[DrawioBridge] Controller not available for export");
    }
  }

  onImageReady(callback: (imageSrc: string) => void): void {
    this.imageReadyCallback = callback;
  }

  onDiagramChange(callback: () => void): void {
    this.diagramChangeCallback = callback;
  }

  getCurrentXml(): string | null {
    if (this.controller) {
      return this.controller.getCurrentXml();
    }
    return null;
  }

  getLocalStorageModel(): LocalStorageModel {
    return this.localStorageModel;
  }

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

export class DrawioBridgeFactory implements IDrawioBridgeFactory {
  create(
    iframe: HTMLIFrameElement,
    projectId: string,
    projectName: string,
  ): IDrawioBridge {
    return new DrawioBridge(iframe, projectId, projectName);
  }
}

export const drawioBridgeFactory = new DrawioBridgeFactory();
export default DrawioBridge;