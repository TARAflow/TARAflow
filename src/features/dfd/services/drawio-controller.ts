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

  private configureDrawio() {
    const configurationAction = {
      action: "configure",
      config: {
        css: `
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
            box-shadow:0 2px 6px 2px rgba(218, 215, 244, 0.6) !important;
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
          .geMenubar {
          }
          .geDiagramContainer {
            overflow: hidden !important;
          }
          .geToolbarButton[title=Language] {
            display: none;
          }
        `,
        defaultFonts: ["Humor Sans", "Helvetica", "Times New Roman"],
        ui: "atlas", // kennedy, atlas (default), dark and min
        darkMode: false,
        defaultLibraries: "dfd1",
        defaultCustomLibraries: ["dfd1"],
        enabledLibraries: ["dfd1"],
        expandLibraries: true,
        enableCustomLibraries: true,
        enableCssDarkMode: false,
        libraries: [
          {
            title: {
              main: "CoReTM",
            },
            entries: [
              {
                id: "CoReTM",
                title: {
                  main: "CoReTM",
                  de: "CoReTM",
                },
                desc: {
                  main: "CoReTM",
                  de: "CoReTM",
                },
                libs: [
                  {
                    title: {
                      main: "CoReTM",
                      de: "CoReTM",
                    },
                    data: coretm,
                  },
                ],
              },
              {
                id: "dfd1",
                title: {
                  main: "dfd1",
                  de: "dfd1",
                },
                desc: {
                  main: "dfd1",
                  de: "dfd1",
                },
                libs: [
                  {
                    title: {
                      main: "dfd1",
                      de: "dfd1",
                    },
                    data: dfd1,
                  },
                ],
              },
              {
                id: "dfd2",
                title: {
                  main: "dfd2",
                  de: "dfd2",
                },
                desc: {
                  main: "dfd2",
                  de: "dfd2",
                },
                libs: [
                  {
                    title: {
                      main: "dfd2",
                      de: "dfd2",
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