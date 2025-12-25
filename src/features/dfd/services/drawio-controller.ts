// ==================== DRAWIO CONTROLLER ====================
// Single Responsibility: Control communication with embedded draw.io iframe

import cssVariables from "./variables";
import coretm from "../shapes/CoReTM.json";
import dfd1 from "../shapes/DFD_1.json";
import dfd2 from "../shapes/DFD_2.json";
import CORSCommunicator from "./cors-communicator";
import LocalStorageModel from "./local-storage-model";
import DiagramAnalyser from "./diagram-analyser";
import { ICrossingElements } from "../interfaces/drawio-interfaces";

export default class DrawioController {
  private drawio: CORSCommunicator;
  private storage: LocalStorageModel;
  private diagramAnalyser: DiagramAnalyser;
  private readonly projectName: string;
  private readonly diagramImage: HTMLImageElement;
  private imageReadyCallback: ((image: HTMLImageElement) => void) | null = null;

  private loadedFromLocalStorage: boolean = false;
  private changedAfterImported: boolean = false;
  private isDarkMode: boolean = false;

  constructor(
    drawio: CORSCommunicator,
    storage: LocalStorageModel,
    projectName: string
  ) {
    this.drawio = drawio;
    this.storage = storage;
    this.diagramAnalyser = new DiagramAnalyser();
    this.projectName = projectName;
    this.diagramImage = new Image();
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
      case "autosave":
        this.autoSaveDiagram(msg);
        break;
      case "export":
        this.storeDiagram(msg);
        break;
      case "init":
        this.loadDrawio();
        break;
      case "configure":
        this.configureDrawio();
        break;
      case "load":
        console.log("Stencil loaded: ", msg);
        break;
      default:
        console.error("Unknown event: ", msg.event);
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

    // Ensure libraries are arrays (handle different import formats)
    const dfd1Data = Array.isArray(dfd1) ? dfd1 : (dfd1 as any)?.default || [];
    const dfd2Data = Array.isArray(dfd2) ? dfd2 : (dfd2 as any)?.default || [];
    const coretmData = Array.isArray(coretm)
      ? coretm
      : (coretm as any)?.default || [];

    console.log("[DrawioController] Library lengths:", {
      dfd1: dfd1Data.length,
      dfd2: dfd2Data.length,
      coretm: coretmData.length,
    });

    // Combine all shapes into one array for "DFD Shapes" library
    const allDFDShapes = [...dfd1Data, ...dfd2Data, ...coretmData];
    console.log("[DrawioController] Combined shapes:", allDFDShapes.length);

    const configurationAction = {
      action: "configure",
      config: {
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
        defaultLibraries: "dfd1,dfd2",
        defaultCustomLibraries: ["dfd1", "dfd2"],
        enabledLibraries: ["dfd1", "dfd2"],

        // Single combined library with all DFD shapes
        // Libraries with DFD1 and DFD2 shapes
        libraries: [
          {
            title: {
              main: "DFD Shapes",
              de: "DFD Formen",
            },
            entries: [
              {
                id: "dfd1",
                title: {
                  main: "DFD Shapes (v1)",
                  de: "DFD Formen (v1)",
                },
                desc: {
                  main: "DFD shapes for threat modeling",
                  de: "DFD-Formen für Threat Modeling",
                },
                libs: [
                  {
                    title: {
                      main: "DFD Shapes",
                      de: "DFD Formen",
                    },
                    data: dfd1,
                  },
                ],
              },
              {
                id: "dfd2",
                title: {
                  main: "DFD Shapes (v2)",
                  de: "DFD Formen (v2)",
                },
                desc: {
                  main: "DFD shapes for threat modeling",
                  de: "DFD-Formen für Threat Modeling",
                },
                libs: [
                  {
                    title: {
                      main: "DFD Shapes",
                      de: "DFD Formen",
                    },
                    data: dfd2,
                  },
                ],
              },
            ],
          },
        ],
      },
    };

    console.log("[DrawioController] Sending configure action");
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
      xml: "",
      title: this.projectName,
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

  parseXml(): {
    crossingElements: ICrossingElements[];
    invalidDataflows: boolean;
  } {
    // Lese vom projekt-spezifischen Key
    let xmlDataString: string | null = this.storage.read();

    // Fallback zu legacy Key
    if (!xmlDataString) {
      xmlDataString = localStorage.getItem("DrawioMsg");
    }

    if (!xmlDataString) {
      console.error("DrawioMsg is missing or empty in LocalStorage.");
      return { crossingElements: [], invalidDataflows: false };
    }

    let parsed;
    try {
      parsed = JSON.parse(xmlDataString);
    } catch (error) {
      console.error("Failed to parse DrawioMsg:", error);
      return { crossingElements: [], invalidDataflows: false };
    }

    if (!parsed?.xml) {
      console.error("Parsed DrawioMsg is missing the xml property.");
      return { crossingElements: [], invalidDataflows: false };
    }
    const xml = parsed.xml;

    let xmlDoc: XMLDocument;

    const parser: DOMParser = new DOMParser();
    try {
      xmlDoc = parser.parseFromString(xml, "text/xml");
    } catch (e) {
      console.error("Failed to parse XML:", e);
      return { crossingElements: [], invalidDataflows: false };
    }

    const { crossingElements, invalidDataflows } =
      this.diagramAnalyser.parseDifferentDfdElementsFromXml(xmlDoc);

    return {
      crossingElements: crossingElements,
      invalidDataflows: invalidDataflows,
    };
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