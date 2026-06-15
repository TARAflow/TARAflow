// features/hazards/services/importer/xlsx-ods-importer.ts
//
// Spreadsheet sources via SheetJS. readWorkbook exposes EVERY sheet as a raw
// grid (header:1) so the dialog can pick sheet/rows/columns freely — required
// for real safety templates where the data sits on an arbitrary sheet with a
// multi-row header and "x"-matrix severity/probability columns.
//
// SheetJS reads .xlsx AND .ods (and legacy .xls) with one parser, so ODS is
// just another subclass. INSTALL (current tarball, not frozen npm 0.18.5):
//   npm i --save https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz

import * as XLSX from "xlsx";
import type { HazardImportResult } from "../safety-hazard-importer";
import type { ProfileImportAdapter } from "../safety-hazard-importer";
import type {
  CellValue,
  SheetGrid,
  WorkbookPreview,
} from "../../models/import-profile-types";
import { applyImportProfile, suggestProfile } from "../apply-import-profile";

abstract class SpreadsheetAdapter implements ProfileImportAdapter {
  abstract readonly id: string;
  readonly kind = "tabular" as const;
  abstract readonly label: string;
  abstract readonly acceptedExtensions: string[];
  abstract readonly acceptedMimeTypes: string[];

  async canHandle(file: File): Promise<boolean> {
    const name = file.name.toLowerCase();
    return this.acceptedExtensions.some((ext) => name.endsWith(ext));
  }

  async readWorkbook(file: File): Promise<WorkbookPreview> {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });
    const sheets: SheetGrid[] = wb.SheetNames.map((name) => ({
      name,
      // header:1 -> array of arrays; defval:null keeps empty cells; blankrows
      // preserves row indices so the picked row numbers stay correct.
      rows: XLSX.utils.sheet_to_json<CellValue[]>(wb.Sheets[name], {
        header: 1,
        defval: null,
        raw: false,
        blankrows: true,
      }),
    }));
    return { format: "spreadsheet", sheets };
  }

  async parse(file: File): Promise<HazardImportResult> {
    const wb = await this.readWorkbook(file);
    return applyImportProfile(wb.sheets, suggestProfile(wb), file.name);
  }
}

export class XlsxAdapter extends SpreadsheetAdapter {
  readonly id = "fmea_excel";
  readonly label = "Excel (.xlsx)";
  readonly acceptedExtensions = [".xlsx", ".xlsm", ".xls"];
  readonly acceptedMimeTypes = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
  ];
}

export class OdsAdapter extends SpreadsheetAdapter {
  readonly id = "ods_generic";
  readonly label = "OpenDocument (.ods)";
  readonly acceptedExtensions = [".ods"];
  readonly acceptedMimeTypes = [
    "application/vnd.oasis.opendocument.spreadsheet",
  ];
}
