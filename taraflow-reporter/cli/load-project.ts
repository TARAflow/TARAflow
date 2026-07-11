// cli/load-project.ts
//
// Phase 4 (TARAflow CLI Report Plan) — load .tara.json + schema migrations.
//
// Uses migration-service.ts DIRECTLY — no duplication of the
// orchestration logic (applyLegacyMigrations, applyMigrations,
// repairProject). That's possible because migration-service.ts, after
// fixing its two barrel imports (shared, features/risks → deep paths), is
// completely pure — all six migration-related files were verified
// individually (schema-version.ts, versions/index.ts + the three
// migrate_X_to_Y.ts files, risk-assessment-types.ts, asset-migration.ts,
// risk-factor-types.ts).
//
// migration-service.ts is NOT on the plan's list of explicitly protected
// UI-only files (that's main.tsx/app.tsx/use-document-generation.ts/
// pdf-helpers.ts/pdf-generator-renderer.ts/doc-generator.ts) — it's a
// plain loading helper under src/app/services that both sides (UI via
// ProjectRepository, CLI via this file) can share unmodified, once its two
// barrel imports are fixed.

import fs from "fs/promises";
import {
  parseAndRepairWithMetadata,
  type MigrationResult,
} from "../../src/app/services/migration-service";

/**
 * Load a .tara.json file from disk and apply all legacy + schema migrations.
 *
 * @param filePath - Path to the .tara.json file
 * @throws if the file cannot be read/parsed as JSON
 * @throws if the project is fundamentally unrecoverable (no id / info.name —
 *         see repairProject() in migration-service.ts for the exact check)
 */
export async function loadProject(filePath: string): Promise<MigrationResult> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf-8");
  } catch (error: any) {
    throw new Error(
      `Could not read project file at ${filePath}: ${error.message}`,
    );
  }

  let data: any;
  try {
    data = JSON.parse(raw);
  } catch (error: any) {
    throw new Error(`Could not parse ${filePath} as JSON: ${error.message}`);
  }

  const result = parseAndRepairWithMetadata(data);
  if (!result) {
    throw new Error(
      `Could not load project from ${filePath}: missing required fields ` +
        `(id, info.name) — file may be corrupted or not a TARAflow project.`,
    );
  }

  return result;
}