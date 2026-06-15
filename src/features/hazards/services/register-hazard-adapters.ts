// shared/services/register-hazard-adapters.ts
//
// Single registration point — call once at app bootstrap (before any import UI
// is used). Adding a format is exactly one line here (Open/Closed Principle).

import { hazardImporterRegistry } from "./safety-hazard-importer";
import { TARAflowJsonAdapter } from "./importer/taraflow-json-importer";
import { CsvGenericAdapter } from "./importer/csv-importer";
import { XlsxAdapter, OdsAdapter } from "./importer/xlsx-ods-importer";

let registered = false;

export function registerHazardImportAdapters(): void {
  if (registered) return; // idempotent — safe under HMR / repeated calls
  registered = true;

  // Order matters only for detect(): more specific content checks first.
  hazardImporterRegistry.register(new TARAflowJsonAdapter());
  hazardImporterRegistry.register(new CsvGenericAdapter());
  hazardImporterRegistry.register(new XlsxAdapter());
  hazardImporterRegistry.register(new OdsAdapter());
  // New format? Add one line here.
}