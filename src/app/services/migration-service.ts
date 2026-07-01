// ==================== MIGRATION SERVICE ====================
// Single Responsibility: schema repair and data migration.
// No I/O, no storage — pure data transformation.
// Imported by ProjectRepository; never by UI components directly.

import { migrateProjectTags, EMPTY_PROJECT_TAGS } from "shared";
import type { PhaseStatus, PhaseStatusMap } from "shared";
import type { ProjectSettingsData } from "features/overview";
import type { Project } from "../models/project-types";
import { migrateRiskData } from "features/risks";


// ==================== SCHEMA VERSION ====================

/**
 * Current schema version. Increment for every breaking or additive
 * change to the persisted Project structure.
 *
 * Version history:
 *   0 = pre-release (no schemaVersion field present)
 *   1 = Release 1 — first official version
 */
export const CURRENT_SCHEMA_VERSION = 2;

// ==================== DEFAULTS ====================
// Single source of truth — previously duplicated across StorageService,
// ProjectService, and repairProject.

export const DEFAULT_PHASE_STATUS: PhaseStatusMap = {
  0: "not-started",
  1: "not-started",
  2: "not-started",
  3: "not-started",
  4: "not-started",
  5: "not-started",
  6: "not-started",
  7: "not-started",
  8: "not-started",
  9: "not-started",
};

export const DEFAULT_SETTINGS: ProjectSettingsData = {
  strictMode: false,
  autoSave: true,
  autoSaveInterval: 2,
};

// ==================== VALIDATION ====================

/**
 * Minimal structural check — is this object a recognisable Project?
 * Returns true even for incomplete projects so repair() can fill gaps.
 * Only returns false for truly unrecoverable objects (no id, no info).
 */
export function isRecognisableProject(raw: any): boolean {
  return (
    raw != null &&
    typeof raw.id === "string" &&
    raw.id.length > 0 &&
    raw.info != null &&
    typeof raw.info.name === "string"
  );
}

/**
 * Full validity check — all required fields present and correct type.
 * Used to decide whether repair() is needed.
 */
export function isValidProject(raw: any): raw is Project {
  return (
    isRecognisableProject(raw) &&
    raw.phaseStatus != null &&
    typeof raw.phaseStatus[0] !== "undefined"
  );
}

// ==================== REPAIR ====================

/**
 * Fill in missing fields with safe defaults.
 * Returns null only if the object is fundamentally unrecoverable
 * (no id or no info.name).
 *
 * Keep this function pure — no I/O, no side effects.
 */
export function repairProject(raw: any): Project | null {
  if (!isRecognisableProject(raw)) {
    console.warn(
      "[MigrationService] Cannot repair project — missing id or info.name:",
      raw,
    );
    return null;
  }

  const now = new Date().toISOString();

  const repaired: Project = {
    schemaVersion: raw.schemaVersion ?? 0,
    id: raw.id,
    info: {
      ...raw.info,
      tags: migrateProjectTags(raw.info.tags ?? []),
      team: raw.info.team ?? [],
      lastModified: raw.info.lastModified ?? now,
    },
    lastOpened: raw.lastOpened ?? now,
    currentPhase: raw.currentPhase ?? 0,
    strideMethod: raw.strideMethod ?? null,
    methodSelected: raw.methodSelected ?? false,
    phaseStatus: {
      0: raw.phaseStatus?.[0] ?? "not-started",
      1: raw.phaseStatus?.[1] ?? "not-started",
      2: raw.phaseStatus?.[2] ?? "not-started",
      3: raw.phaseStatus?.[3] ?? "not-started",
      4: raw.phaseStatus?.[4] ?? "not-started",
      5: raw.phaseStatus?.[5] ?? "not-started",
      6: raw.phaseStatus?.[6] ?? "not-started",
      7: raw.phaseStatus?.[7] ?? "not-started",
      8: raw.phaseStatus?.[8] ?? "not-started",
      9: raw.phaseStatus?.[9] ?? "not-started",
    },
    settings: {
      strictMode: raw.settings?.strictMode ?? DEFAULT_SETTINGS.strictMode,
      autoSave: raw.settings?.autoSave ?? DEFAULT_SETTINGS.autoSave,
      autoSaveInterval:
        raw.settings?.autoSaveInterval ?? DEFAULT_SETTINGS.autoSaveInterval,
    },
    status: raw.status ?? "draft",
    hazards: raw.hazards ?? null,
    dfd: raw.dfd ?? null,
    assets: raw.assets ?? null,
    threats: raw.threats ?? null,
    risks: raw.risks ?? null,
    attackTrees: raw.attackTrees ?? null,
    documentation: raw.documentation ?? null,
    audit: raw.audit ?? null,
    integration: raw.integration ?? null,
    isOpen: raw.isOpen ?? false,
    hasUnsavedChanges: false,
    filePath: raw.filePath,
  };

  return repaired;
}

// ==================== SCHEMA MIGRATIONS ====================

/**
 * Result of the migration pipeline.
 * `migrated` is true when the schema version was bumped — the caller
 * should save the file immediately and optionally show a UI notice.
 */
export interface MigrationResult {
  project: Project;
  migrated: boolean;
  fromVersion: number;
}

/**
 * Migrate schema version 0 → 1.
 *
 * Version 0 = all projects saved before Release 1 (no schemaVersion field).
 * Changes introduced in v1:
 *   - riskMitigationMappings: new field, default []
 *   - platformContext per DFD element: default { runtime: 'unknown', deployment: 'unknown' }
 *   - rejectionRecord on rejected mitigations: scaffolded with migration notice
 *   - schemaVersion field itself added
 */
function migrate_0_to_1(data: any): any {
  // riskMitigationMappings — new in v1
  if (!data.riskMitigationMappings) {
    data = { ...data, riskMitigationMappings: [] };
  }

  // platformContext per DFD element — new in v1
  if (data.dfd?.elements?.length) {
    data = {
      ...data,
      dfd: {
        ...data.dfd,
        elements: data.dfd.elements.map((el: any) =>
          el.platformContext
            ? el
            : {
                ...el,
                platformContext: {
                  runtime: "unknown",
                  deployment: "unknown",
                },
              },
        ),
      },
    };
  }

  // rejectionRecord on rejected mitigations — new in v1
  // Scaffolded with a migration notice so the analyst can complete it later.
  const migrateRejection = (m: any) => {
    if (m.status === "rejected" && !m.rejectionRecord) {
      return {
        ...m,
        rejectionRecord: {
          mitigationId: m.id,
          rejectedAt: null,
          rejectedBy: "unknown",
          reason:
            "(migrated from pre-release project — reason unknown, please complete)",
          decisionType: "risk_accepted",
        },
      };
    }
    return m;
  };

  if (data.threats?.perElementTables) {
    data = {
      ...data,
      threats: {
        ...data.threats,
        perElementTables: data.threats.perElementTables.map((t: any) => ({
          ...t,
          threats: t.threats?.map((th: any) => ({
            ...th,
            mitigations: th.mitigations?.map(migrateRejection) ?? [],
          })),
        })),
      },
    };
  }

  data = { ...data, schemaVersion: 1 };
  return data;
}

/**
 * Migrate schema version 1 -> 2.
 * Inserts the Hazard phase at position 1: every existing phase id >= 1 shifts up
 * by one (DFD 1->2 ... Integration 8->9), a new Hazard phase (id 1) is added as
 * "not-started", and the Project.hazards slot is introduced (default null).
 */
function migrate_1_to_2(data: any): any {
  const oldStatus = data.phaseStatus ?? {};
  const newStatus: Record<number, PhaseStatus> = {
    0: oldStatus[0] ?? "not-started", // General (unchanged)
    1: "not-started", //                Hazard (new)
  };
  for (let oldId = 1; oldId <= 8; oldId++) {
    newStatus[oldId + 1] = oldStatus[oldId] ?? "not-started";
  }

  const oldCurrent = data.currentPhase ?? 0;
  const newCurrent = oldCurrent >= 1 ? oldCurrent + 1 : 0; // General stays 0

  return {
    ...data,
    currentPhase: newCurrent,
    phaseStatus: newStatus,
    hazards: data.hazards ?? null,
    schemaVersion: 2,
  };
}

// ── Add future migrations here following the same pattern ──────────────────
// function migrate_1_to_2(data: any): any { ... }

// ==================== MIGRATION PIPELINE ====================

/**
 * Apply all required schema migrations to bring a raw project to
 * CURRENT_SCHEMA_VERSION.
 *
 * Returns the migrated data plus a flag indicating whether any migration
 * was applied — the caller (ProjectRepository) uses this to decide whether
 * to write the file back to disk and show a UI notice.
 */
export function applyMigrations(raw: any): {
  data: any;
  migrated: boolean;
  fromVersion: number;
} {
  const fromVersion: number = raw.schemaVersion ?? 0;
  let data = raw;
  let migrated = false;

  if (fromVersion < 1) {
    data = migrate_0_to_1(data);
    migrated = true;
  }

  if ((data.schemaVersion ?? 0) < 2) {
    data = migrate_1_to_2(data);
    migrated = true;
  }

  // Add future version checks here:
  // if ((data.schemaVersion ?? 0) < 2) { data = migrate_1_to_2(data); migrated = true; }

  // Guard: after all migrations the version must match CURRENT_SCHEMA_VERSION.
  // If it does not, the file was saved by a newer version of TARAflow that
  // this build does not know how to handle.
  if (data.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported schema version: ${data.schemaVersion}. ` +
        `This version of TARAflow supports up to schema v${CURRENT_SCHEMA_VERSION}. ` +
        `Please update TARAflow to open this project.`,
    );
  }

  return { data, migrated, fromVersion };
}

// ==================== LEGACY DATA MIGRATIONS ====================
// These run regardless of schemaVersion — they fix data format issues
// that existed before schemaVersion was introduced.

/**
 * Apply all legacy data migrations (tag format, risk data schema).
 * Safe to call on already-migrated projects (idempotent).
 */
export function applyLegacyMigrations(raw: any): any {
  let data = raw;

  // Migrate legacy string[] tags → ProjectTags object
  if (Array.isArray(data.info?.tags)) {
    data = {
      ...data,
      info: { ...data.info, tags: migrateProjectTags(data.info.tags) },
    };
  }

  // Migrate risk data schema
  if (data.risks) {
    data = { ...data, risks: migrateRiskData(data.risks) };
  }

  return data;
}

// ==================== FULL PIPELINE ====================

/**
 * Complete pipeline for loading any project file:
 * 1. Apply legacy data migrations (idempotent)
 * 2. Apply schema version migrations
 * 3. Validate and repair missing fields
 *
 * Returns null only if the object is fundamentally unrecoverable.
 */
export function parseAndRepair(raw: any): Project | null {
  // Step 1: legacy format migrations
  let data = applyLegacyMigrations(raw);

  // Step 2: schema version migrations
  const { data: migrated } = applyMigrations(data);
  data = migrated;

  // Step 3: validate + repair
  if (isValidProject(data)) {
    return data as Project;
  }

  return repairProject(data);
}

/**
 * Full pipeline with migration metadata — used by ProjectRepository
 * to decide whether to write back and show a UI notice.
 */
export function parseAndRepairWithMetadata(raw: any): MigrationResult | null {
  // Step 1: legacy migrations
  let data = applyLegacyMigrations(raw);

  // Step 2: schema migrations
  const {
    data: migrated,
    migrated: wasMigrated,
    fromVersion,
  } = applyMigrations(data);
  data = migrated;

  // Step 3: validate + repair
  let project: Project | null;
  if (isValidProject(data)) {
    project = data as Project;
  } else {
    project = repairProject(data);
  }

  if (!project) return null;

  return { project, migrated: wasMigrated, fromVersion };
}