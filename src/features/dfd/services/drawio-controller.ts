// ==================== DRAWIO CONTROLLER ====================
// Single Responsibility: Control communication with embedded draw.io iframe

import cssVariables from "./variables";
import dfd1 from "../shapes/DFD_1.json";
import dfd2 from "../shapes/DFD_2.json";
import CORSCommunicator from "./cors-communicator";
import LocalStorageModel from "./local-storage-model";

export default class DrawioController {
  private drawio: CORSCommunicator;
  private storage: LocalStorageModel;
  private readonly projectName: string;
  private readonly diagramImage: HTMLImageElement;
  private imageReadyCallback: ((image: HTMLImageElement) => void) | null = null;

  private loadedFromLocalStorage: boolean = false;
  private changedAfterImported: boolean = false;
  private isDarkMode: boolean = false;

  private selectionCallback: ((cells: any[]) => void) | null = null;

  constructor(
    drawio: CORSCommunicator,
    storage: LocalStorageModel,
    projectName: string,
  ) {
    this.drawio = drawio;
    this.storage = storage;
    this.projectName = projectName;
    this.diagramImage = new Image();
    // ==================== REGISTER PLUGINS ====================

    this.drawio.receive(this.handleIncomingEvents.bind(this));
  }


  private isJsonString = (str: unknown): boolean => {
    if (typeof str !== "string") return false;
    try {
      JSON.parse(str);
    } catch (e) {
      return false;
    }
    return true;
  };

  private handleIncomingEvents(message: MessageEvent) {
    console.log("[DrawioController] Parsed Message Event:", message);
    if (!message.origin.includes("diagrams.net")) return;
    if (
      !message.data ||
      (typeof message.data === "string" && message.data.length <= 0)
    ) {
      return;
    }
    if (!this.isJsonString(message.data)) {
      return;
    }
    const msg = JSON.parse(message.data);

    switch (msg.event) {
      case "configure":
        console.log("[DrawioController] 1️⃣ Configure event received");
        this.configureDrawio();
        break;

      case "init":
        console.log("[DrawioController] 2️⃣ Init event received - loading data");
        this.loadDrawio();
        break;

      case "load":
        console.log("[DrawioController] LOAD confirmed");
        break;

      case "autosave":
        this.autoSaveDiagram(msg);
        break;
      case "export":
        this.storeDiagram(msg);
        break;
      case "selection":
        console.log("[DrawioController] 🎯 Selection received:", msg.selection);
        this.handleSelectionChange(msg.selection);
        break;

      default:
        console.error("Unknown event: ", msg.event);
    }
  }

  public onSelectionChanged(callback: (cells: any[]) => void): void {
    this.selectionCallback = callback;
  }

  private handleSelectionChange(selection: any[]): void {
    if (this.selectionCallback) {
      // Convert to expected format (array of objects with xmlId)
      const cells = selection.map((item) => {
        // If it's already in correct format {id, value, type}
        if (typeof item === "object" && item.id) {
          return { xmlId: item.id };
        }
        // If it's just a string ID
        if (typeof item === "string") {
          return { xmlId: item };
        }
        return item;
      });

      this.selectionCallback(cells);
    }
  }

  /**
   * Get CSS for light mode
   */
  private getLightModeCSS(): string {
    return `
      .geMenubarContainer, .mxWindow {
        background-color: hsl(246, 56%, 90%) !important;
      }
      tr.mxPopupMenuItemHover {
        background-color: hsl(246, 56%, 90%) !important;
      }
      .geSidebarContainer .geTitle:hover {
        background: hsl(246, 56%, 95%) !important;
      }
      .geSidebarTooltip {
        box-shadow: 0 2px 6px 2px rgba(218, 215, 244, 0.6) !important;
      }
      .geSidebar .geItem:hover {
        background-color: hsl(246, 56%, 95%) !important;
      }
      /* ================== Remove More Shapes Button ================ */
      .geSidebarFooter > .geBtn {
        display: none !important;
      }
      .geTitle, .mxWindowTitle, .geFormatSection {
        color: ${cssVariables["--coretm-darkgrey"]} !important;
      }
      .geFormatSection:nth-of-type(3), .geFormatSection:nth-of-type(4) {
        display: none;
      }
      
      /* ==================== TOOLBAR HIDING ==================== */
      /* Hide language button */
      .geButton[title="Language"] { display: none !important; }
      
      /* Hide insert template button */
      .geButton[title="Insert Template..."],
      .geButton[title="Vorlage einfügen..."] { display: none !important; }
      
      /* Hide insert image button */  
      .geButton[title="Insert Image..."],
      .geButton[title="Bild einfügen..."] { display: none !important; }

      /* Hide Insert button */
      .geButton[title="Insert (Doubleclick to insert text)"],
      .geButton[title="Einfügen (Doppelklick zum Einfügen von Text)"] {
        display: none !important;
      }

      /* Hide Table button */
      .geButton[title="Table"],
      .geButton[title="Tabelle"] {
        display: none !important;
      }
      
      /* Hide freehand drawing */
      .geButton[title="Freehand"],
      .geButton[title="Freehand (X)"],
      .geButton[title="Freihand"],
      .geButton[title="Freihand (X)"] { display: none !important; }
      
      /* Hide insert link button */
      .geButton[title="Insert Link"],
      .geButton[title="Link einfügen"] { display: none !important; }
      
      /* Hide tags button */
      .geButton[title="Tags"] { display: none !important; }
      
      /* Hide find/replace */
      .geButton[title="Find/Replace..."],
      .geButton[title="Suchen/Ersetzen..."] { display: none !important; }
      
      /* Hide Connection button */
      .geButton[title="Connection"],
      .geButton[title="Verbindung"] { display: none !important; }
      
      /* Hide Waypoints button */
      .geButton[title="Waypoints"],
      .geButton[title="Wegpunkte"] { display: none !important; }
      
      /* ==================== SCROLLBAR STYLING ==================== */
      .geDiagramContainer ::-webkit-scrollbar {
        width: 12px !important;
        height: 12px !important;
      }
      .geDiagramContainer ::-webkit-scrollbar-track {
        background: #f1f1f1 !important;
        border-radius: 6px !important;
      }
      .geDiagramContainer ::-webkit-scrollbar-thumb {
        background: #888 !important;
        border-radius: 6px !important;
        border: 2px solid #f1f1f1 !important;
      }
      .geDiagramContainer ::-webkit-scrollbar-thumb:hover {
        background: #555 !important;
      }
    `;
  }

  /**
   * Get CSS for dark mode with visible scrollbars
   */
  private getDarkModeCSS(): string {
    return `
      .geSidebarFooter > .geBtn {
        display: none !important;
      }
      .geFormatSection:nth-of-type(3), .geFormatSection:nth-of-type(4) {
        display: none;
      }
      
      /* ==================== TOOLBAR HIDING ==================== */
      /* Hide language button */
      .geButton[title="Language"] { display: none !important; }
      
      /* Hide insert template button */
      .geButton[title="Insert Template..."],
      .geButton[title="Vorlage einfügen..."] { display: none !important; }
      
      /* Hide insert image button */  
      .geButton[title="Insert Image..."],
      .geButton[title="Bild einfügen..."] { display: none !important; }
      
      /* Hide freehand drawing */
      .geButton[title="Freehand"],
      .geButton[title="Freehand (X)"],
      .geButton[title="Freihand"],
      .geButton[title="Freihand (X)"] { display: none !important; }
      
      /* Hide insert link button */
      .geButton[title="Insert Link"],
      .geButton[title="Link einfügen"] { display: none !important; }
      
      /* Hide tags button */
      .geButton[title="Tags"] { display: none !important; }
      
      /* Hide find/replace */
      .geButton[title="Find/Replace..."],
      .geButton[title="Suchen/Ersetzen..."] { display: none !important; }
      
      /* Hide Connection button */
      .geButton[title="Connection"],
      .geButton[title="Verbindung"] { display: none !important; }
      
      /* Hide Waypoints button */
      .geButton[title="Waypoints"],
      .geButton[title="Wegpunkte"] { display: none !important; }
      
      /* ==================== SCROLLBAR STYLING - DARK MODE ==================== */
      .geDiagramContainer ::-webkit-scrollbar {
        width: 14px !important;
        height: 14px !important;
      }
      .geDiagramContainer ::-webkit-scrollbar-track {
        background: #1a1a1a !important;
        border-radius: 7px !important;
      }
      .geDiagramContainer ::-webkit-scrollbar-thumb {
        background: linear-gradient(180deg, #666 0%, #888 100%) !important;
        border-radius: 7px !important;
        border: 3px solid #1a1a1a !important;
      }
      .geDiagramContainer ::-webkit-scrollbar-thumb:hover {
        background: linear-gradient(180deg, #888 0%, #aaa 100%) !important;
      }
      .geDiagramContainer ::-webkit-scrollbar-corner {
        background: #1a1a1a !important;
      }
      
      /* Firefox scrollbar */
      .geDiagramContainer {
        scrollbar-width: auto !important;
        scrollbar-color: #666 #1a1a1a !important;
      }
    `;
  }

  private configureDrawio() {
    // Debug: Log library data
    console.log("[DrawioController] Configuring draw.io...");

    const configurationAction = {
      action: "configure",
      config: {
        modified: true,
        status: true,
        selectionEnabled: true,
        updateSelection: true,
        ready: "selection",
        // ==================== ZOOM SETTINGS ====================
        zoomWheel: false,
        zoomFactor: 1.2,
        // ==================== CSS STYLING ====================
        css: this.isDarkMode ? this.getDarkModeCSS() : this.getLightModeCSS(),
        // ==================== FONTS & UI ====================
        defaultFonts: ["Humor Sans", "Helvetica", "Times New Roman"],
        ui: this.isDarkMode ? "dark" : "atlas",
        darkMode: this.isDarkMode,
        enableCssDarkMode: this.isDarkMode,
        // ==================== LIBRARIES ====================
        enableCustomLibraries: true,
        expandLibraries: true,
        enabledLibraries: ["general", "dfd1", "dfd2"],
        libraries: [
          {
            title: { main: "DFD Shapes", de: "DFD Formen" },
            entries: [
              {
                id: "dfd1",
                title: { main: "DFD Shapes (v1)", de: "DFD Formen (v1)" },
                desc: {
                  main: "DFD shapes for threat modeling",
                  de: "DFD-Formen für Threat Modeling",
                },
                libs: [
                  {
                    title: { main: "DFD Shapes v1", de: "DFD Formen v1" },
                    data: dfd1,
                  },
                  {
                    title: { main: "DFD Shapes v2", de: "DFD Formen v2" },
                    data: dfd2,
                  },
                ],
              },
            ],
          },
        ],
      },
    };

    this.drawio.send(configurationAction);
  }

  private loadDrawio(): void {
    // Lese vom projekt-spezifischen Storage Key
    const draft: string | null = this.storage.read();

    // Fallback: Auch legacy Key prüfen (für Migration)
    const legacyDraft: string | null = localStorage.getItem("DrawioMsg");

    const dataToLoad = draft || legacyDraft;

    if (dataToLoad) {
      this.loadedFromLocalStorage = true;
      try {
        const parsedDraft = JSON.parse(dataToLoad);
        const loadAction = {
          action: "load",
          autosave: 1,
          xml: parsedDraft.xml,
          title: this.projectName,
          page: {
            format: "A3",
            orientation: "landscape",
          },
        };
        const statusAction = {
          action: "status",
          modified: true,
        };
        this.drawio.send(loadAction);
        this.drawio.send(statusAction);

        // Wenn von legacy geladen, in neuen Key migrieren
        if (!draft && legacyDraft) {
          this.storage.write(legacyDraft);
        }
      } catch (e) {
        console.error("Failed to parse draft:", e);
        this.loadEmptyDiagram();
      }
    } else {
      this.loadEmptyDiagram();
    }
  }

  private loadEmptyDiagram(): void {
    const loadAction = {
      action: "load",
      autosave: 1,
      title: this.projectName,
      page: {
        format: "A3",
        orientation: "landscape",
      },
    };

    this.drawio.send(loadAction);
  }

  exportDiagram() {
    const exportAction = {
      action: "export",
      format: "svg",
    };
    this.drawio.send(exportAction);
  }

  private storeDiagram(msg: { data: string }): void {
    this.diagramImage.src = msg.data;
    if (this.imageReadyCallback) {
      this.imageReadyCallback(this.diagramImage);
    }
  }

  private autoSaveDiagram(msg: object) {
    const data = JSON.stringify(msg);

    // Speichere in projekt-spezifischen Key
    this.storage.write(data);

    // Auch in legacy Key für Kompatibilität mit anderen Komponenten
    localStorage.setItem("DrawioMsg", data);

    if (this.loadedFromLocalStorage) {
      this.changedAfterImported = true;
    }
  }

  getChangedAfterImported(): boolean {
    return this.changedAfterImported;
  }

  setImageReadyCallback(callback: (image: HTMLImageElement) => void) {
    this.imageReadyCallback = callback;
  }

  /**
   * Get the current storage key being used
   */
  getStorageKey(): string {
    return this.storage.getStorageKey();
  }

  /**
   * Toggle dark mode - requires iframe reload to take effect
   */
  setDarkMode(enabled: boolean): void {
    this.isDarkMode = enabled;
  }

  /**
   * Get current dark mode state
   */
  getDarkMode(): boolean {
    return this.isDarkMode;
  }

  /**
   * Load XML data directly (useful for project switching)
   */
  loadXml(xml: string): void {
    const loadAction = {
      action: "load",
      autosave: 1,
      xml: xml,
      title: this.projectName,
    };
    this.drawio.send(loadAction);
  }

  /**
   * Get current XML from storage
   */
  getCurrentXml(): string | null {
    const data = this.storage.read();
    if (!data) return null;

    try {
      const parsed = JSON.parse(data);
      return parsed.xml || null;
    } catch {
      return null;
    }
  }
}