// ==================== USE DFD EXPORT IMPORT HOOK ====================
// Single Responsibility: Manage DFD export and import operations

import { useCallback } from "react";
import type { DFDProjectData, DFDExportData } from "../models/dfd-types";
import type { UseDrawioBridgeReturn } from "./use-drawio-bridge";
import type { UseDFDPersistenceReturn } from "./use-dfd-persistence";

// ==================== TYPES ====================

export interface UseDFDExportImportReturn {
  // Export operations
  exportDFD: () => DFDExportData | null;
  downloadExport: () => void;

  // Import operations
  importDFD: (data: DFDExportData) => Promise<void>;
  promptImport: () => Promise<void>;
}

// ==================== HOOK ====================

export function useDFDExportImport(
  project: DFDProjectData,
  bridge: UseDrawioBridgeReturn,
  persistence: UseDFDPersistenceReturn,
): UseDFDExportImportReturn {
  // ==================== EXPORT ====================

  /**
   * Create export data from current project
   */
  const exportDFD = useCallback((): DFDExportData | null => {
    if (!project.dfd) {
      console.warn("[useDFDExportImport] No DFD data to export");
      return null;
    }

    console.log("[useDFDExportImport] Creating export data...");

    const exportData: DFDExportData = {
      version: "1.0",
      projectName: project.name,
      exportDate: new Date().toISOString(),
      xml: project.dfd.xml || "",
      elements: project.dfd.elements,
      assets: project.dfd.assets,
      connections: project.dfd.connections,
    };

    return exportData;
  }, [project]);

  /**
   * Download export as JSON file
   */
  const downloadExport = useCallback(() => {
    const data = exportDFD();
    if (!data) return;

    console.log("[useDFDExportImport] Downloading export...");

    try {
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${project.name}_DFD.json`;
      link.click();
      URL.revokeObjectURL(url);

      console.log("[useDFDExportImport] Export downloaded successfully");
    } catch (error) {
      console.error("[useDFDExportImport] Download failed:", error);
    }
  }, [exportDFD, project.name]);

  // ==================== IMPORT ====================

  /**
   * Import DFD data from export file
   */
  const importDFD = useCallback(
    async (data: DFDExportData) => {
      console.log("[useDFDExportImport] Importing DFD...");

      try {
        // Validate format
        if (!data.xml || !data.elements) {
          throw new Error("Invalid DFD export format: missing required fields");
        }

        if (data.version !== "1.0") {
          console.warn(
            `[useDFDExportImport] Unknown export version: ${data.version}`,
          );
        }

        // Pre-populate project.dfd with imported properties BEFORE save().
        // persistence.save() uses projectRef.current and calls
        // dfdService.saveDFD(project), which merges parsed elements with
        // project.dfd.elements. Without this step, existingElements is []
        // and all imported properties are silently discarded.
        project.dfd = {
          ...(project.dfd ?? {}),
          xml: data.xml,
          elements: data.elements,
          connections: data.connections,
          assets: data.assets ?? [],
        };

        // Wait for the browser to restore focus to the iframe after the
        // file-picker dialog closes. On some browsers/Electron the iframe
        // loses contentWindow temporarily, causing "bridge not ready".
        // Two rAF cycles are enough for the browser to re-attach the frame.
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });

        // Load XML into draw.io and persist to localStorage
        console.log("[useDFDExportImport] Loading XML into editor...");
        await bridge.loadXML(data.xml);

        // Wait for draw.io to process and write to localStorage
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Save: reads XML from localStorage, merges with pre-populated project.dfd
        console.log("[useDFDExportImport] Saving imported data...");
        await persistence.save();

        console.log("[useDFDExportImport] Import successful");
      } catch (error) {
        console.error("[useDFDExportImport] Import failed:", error);
        throw error;
      }
    },
    [bridge, persistence, project],
  );

  /**
   * Prompt user to select and import a file
   */
  const promptImport = useCallback(async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      console.log("[useDFDExportImport] Prompting for file...");

      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json";

      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) {
          resolve();
          return;
        }

        try {
          const text = await file.text();
          const data: DFDExportData = JSON.parse(text);
          await importDFD(data);
          resolve();
        } catch (error) {
          console.error("[useDFDExportImport] File import failed:", error);
          alert(
            "Failed to import DFD. Please check the file format.\n\n" +
              (error as Error).message,
          );
          reject(error);
        }
      };

      input.click();
    });
  }, [importDFD]);

  // ==================== RETURN ====================

  return {
    exportDFD,
    downloadExport,
    importDFD,
    promptImport,
  };
}

export default useDFDExportImport;