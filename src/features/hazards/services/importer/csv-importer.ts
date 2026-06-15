// features/hazards/services/importer/csv-importer.ts
//
// CSV as a profile-driven tabular source. readWorkbook returns the raw grid
// (no header assumption); the mapping dialog decides header/data rows and
// columns. parse() is the no-dialog fallback (auto-suggested profile).

import Papa from "papaparse";
import type { HazardImportResult } from "../safety-hazard-importer";
import type { ProfileImportAdapter } from "../safety-hazard-importer";
import type {
  CellValue,
  WorkbookPreview,
} from "../../models/import-profile-types";
import { applyImportProfile, suggestProfile } from "../apply-import-profile";

export class CsvGenericAdapter implements ProfileImportAdapter {
  readonly id = "csv_generic";
  readonly kind = "tabular" as const;
  readonly label = "CSV (Generic)";
  readonly acceptedExtensions = [".csv"];
  readonly acceptedMimeTypes = ["text/csv"];

  async canHandle(file: File): Promise<boolean> {
    return file.name.toLowerCase().endsWith(".csv");
  }

  async readWorkbook(file: File): Promise<WorkbookPreview> {
    const text = await file.text();
    const parsed = Papa.parse<CellValue[]>(text, {
      header: false,
      skipEmptyLines: false,
      delimitersToGuess: [",", ";", "\t", "|"],
    });
    return {
      format: "csv",
      sheets: [{ name: "CSV", rows: (parsed.data as CellValue[][]) ?? [] }],
    };
  }

  async parse(file: File): Promise<HazardImportResult> {
    const wb = await this.readWorkbook(file);
    return applyImportProfile(wb.sheets, suggestProfile(wb), file.name);
  }
}
