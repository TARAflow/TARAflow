// shared/services/adapters/taraflow-json-adapter.ts
//
// Canonical native format — direct 1:1 mapping onto SafetyHazard.

import {
  type HazardImportAdapter,
  type HazardImportResult,
  type RawHazardRow,
  finalizeImport,
} from "../safety-hazard-importer";

interface TaraflowHazardFile {
  format?: string;
  version?: string;
  sourceNorm?: string;
  hazards?: Array<Record<string, unknown>>;
}

export class TARAflowJsonAdapter implements HazardImportAdapter {
  readonly id = "taraflow_json";
  readonly label = "TARAflow JSON";
  readonly acceptedExtensions = [".json"];
  readonly acceptedMimeTypes = ["application/json"];

  async canHandle(file: File): Promise<boolean> {
    if (!file.name.toLowerCase().endsWith(".json")) return false;
    try {
      const parsed = JSON.parse(await file.text()) as TaraflowHazardFile;
      return parsed?.format === "taraflow-hazard-list";
    } catch {
      return false;
    }
  }

  async parse(file: File): Promise<HazardImportResult> {
    let raw: TaraflowHazardFile;
    try {
      raw = JSON.parse(await file.text()) as TaraflowHazardFile;
    } catch {
      return {
        hazards: [],
        warnings: [{ message: "File is not valid JSON", severity: "error" }],
        adapterUsed: this.id,
        sourceFile: file.name,
      };
    }

    const items = Array.isArray(raw.hazards) ? raw.hazards : [];
    const rows: RawHazardRow[] = items.map((item, i) => ({
      row: i,
      data: {
        ...item,
        // inherit file-level sourceNorm when the item omits it
        sourceNorm:
          (item.sourceNorm as string | undefined) ?? raw.sourceNorm,
      },
    }));

    return finalizeImport(rows, this.id, file.name);
  }
}