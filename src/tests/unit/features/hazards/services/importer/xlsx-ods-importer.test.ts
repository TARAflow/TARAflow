// src/tests/unit/features/hazards/services/importer/xlsx-ods-importer.test.ts
//
// Smoke test for the SheetJS layer of the hazard importer. xlsx is a vendored
// tarball (vendor/sheetjs/) that npm-outdated/Dependabot don't see, so this is
// the tripwire that a SheetJS swap/upgrade still reads .xlsx AND .ods the way
// the import dialog expects: every sheet exposed, row indices preserved (blank
// rows kept), empty cells as null, values as display strings (raw:false).
//
// Fixtures are generated in-memory with SheetJS itself (no binary files in the
// repo). A round-trip can't catch a writer/reader bug that cancels out, but it
// does catch a broken or mis-resolved dependency and any change in the grid
// semantics readWorkbook relies on.

import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  XlsxAdapter,
  OdsAdapter,
} from "features/hazards/services/importer/xlsx-ods-importer";

// Real safety templates keep the data on a later sheet with a gap row.
const COVER: (string | number | null)[][] = [["Hazard list — Rotomat"]];
const HAZARDS: (string | number | null)[][] = [
  ["ID", "Gefährdung", "Severity"],
  ["H-01", "Überdruck im Behälter", 3],
  [], // blank row — must survive so picked row numbers stay correct
  ["H-02", null, 1], // empty middle cell
];

function workbookFile(name: string, bookType: XLSX.BookType): File {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(COVER), "Cover");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(HAZARDS), "Hazards");
  const bytes = XLSX.write(wb, { bookType, type: "array" }) as ArrayBuffer;
  // Only name + arrayBuffer are used by the adapter; avoids depending on the
  // test DOM's Blob.arrayBuffer support.
  return { name, arrayBuffer: async () => bytes } as unknown as File;
}

const cases = [
  { label: "xlsx", adapter: new XlsxAdapter(), file: () => workbookFile("hazards.xlsx", "xlsx") },
  { label: "ods", adapter: new OdsAdapter(), file: () => workbookFile("hazards.ods", "ods") },
] as const;

describe.each(cases)("SpreadsheetAdapter ($label)", ({ adapter, file }) => {
  it("accepts its own extension", async () => {
    expect(await adapter.canHandle(file())).toBe(true);
  });

  it("exposes every sheet by name, in order", async () => {
    const wb = await adapter.readWorkbook(file());
    expect(wb.format).toBe("spreadsheet");
    expect(wb.sheets.map((s) => s.name)).toEqual(["Cover", "Hazards"]);
  });

  it("reads the grid with preserved rows, null gaps and display strings", async () => {
    const wb = await adapter.readWorkbook(file());
    const rows = wb.sheets[1].rows;

    expect(rows[0]).toEqual(["ID", "Gefährdung", "Severity"]);
    expect(rows[1]).toEqual(["H-01", "Überdruck im Behälter", "3"]);
    expect(rows[3][0]).toBe("H-02");
    expect(rows[3][1]).toBeNull();
    expect(rows[3][2]).toBe("1");
    // Blank row kept, not collapsed: H-02 is still at index 3.
    expect(rows).toHaveLength(4);
    expect((rows[2] ?? []).every((c) => c === null)).toBe(true);
  });
});

describe("adapter routing", () => {
  it("keeps .ods and .xlsx on their own adapters", async () => {
    const ods = workbookFile("x.ods", "ods");
    const xlsx = workbookFile("x.xlsx", "xlsx");
    expect(await new XlsxAdapter().canHandle(ods)).toBe(false);
    expect(await new OdsAdapter().canHandle(xlsx)).toBe(false);
  });
});
