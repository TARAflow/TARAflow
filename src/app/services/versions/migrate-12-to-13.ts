import { foldLegacyStatements } from "../compliance-statements-legacy";

/**
 * Migrate schema version 12 → 13 (0.18.0-beta).
 *
 * Version fence for the 0.18 data (model-coverage-implementation-plan.md §6):
 * an older release would drop or misread it. Each step is one pure function
 * here, one call line in migrate_12_to_13.
 *
 *   S13-b  project.compliance is reshaped into one block per standard family
 *          (K-2): schema 12 held the IEC 62443-4-2 fields `target`,
 *          `deviceCategories` and `statements` at the top level; they move
 *          1:1 into compliance.families["iec-62443-4-2"]. `componentId`
 *          stays at the top level as the default component of every family
 *          (K-5). Statements still in the per-edition form of the 0.17
 *          development are folded per requirement first (D-31).
 *   S13-a  (CM-5 … CM-7) new optional element fields — additive, no step.
 *   MS-1   (release plan 0.18) `malwareProtection` (Process, Multiprocess) and
 *          `physicalPathProtection` (data flows) become multi-select: a stored
 *          value "x" becomes ["x"], an empty one is removed — 1:1, the
 *          measures keep their meaning (as P-1 did for defaultDenyPolicy in
 *          schema 12), so no analysis value changes.
 *   S13-c  (FX-6, when the release plan schedules it) path keys.
 *
 * Analysis preservation is reported PER FILE (K-9), not declared for the
 * version: a step returns whether it changed an analysis value of this file.
 * The reshape alone changes none (same values, other place — the TARA
 * verification is re-sealed on load); folding legacy statements does when
 * two editions held different statements on one requirement and the older
 * one is dropped.
 *
 * Runs once per file through the version gate in migration-service.
 */
export function migrate_12_to_13(data: any): { data: any; analysisChanged: boolean } {
  const compliance = reshapeCompliance(data?.compliance);
  const dfd = reshapeMultiSelect(data?.dfd);
  return {
    data: {
      ...data,
      ...(compliance.value ? { compliance: compliance.value } : {}),
      ...(dfd ? { dfd } : {}),
      schemaVersion: 13,
    },
    analysisChanged: compliance.analysisChanged,
  };
}

/** MS-1: single values of the combinable controls become selections (1:1). */
function reshapeMultiSelect(dfd: any): any {
  if (!dfd || typeof dfd !== "object") return dfd;
  const elements = Array.isArray(dfd.elements)
    ? dfd.elements.map((e: any) =>
        e?.type === "Process" || e?.type === "Multiprocess" ? toSelection(e, "malwareProtection") : e,
      )
    : dfd.elements;
  const connections = Array.isArray(dfd.connections)
    ? dfd.connections.map((c: any) => toSelection(c, "physicalPathProtection"))
    : dfd.connections;
  return { ...dfd, elements, connections };
}

function toSelection(item: any, key: string): any {
  const value = item?.properties?.[key];
  if (value === undefined || Array.isArray(value)) return item;
  const { [key]: _single, ...rest } = item.properties;
  return { ...item, properties: value ? { ...rest, [key]: [value] } : rest };
}

/** The family the schema-12 fields belong to. */
const IEC_62443_4_2 = "iec-62443-4-2";

function reshapeCompliance(compliance: any): { value: any; analysisChanged: boolean } {
  if (!compliance || typeof compliance !== "object" || compliance.families) return { value: compliance, analysisChanged: false };
  const { target, deviceCategories, statements: stored, ...rest } = compliance;
  const { statements, dropped } = foldLegacyStatements(stored);
  const family = {
    ...(target !== undefined ? { target } : {}),
    ...(deviceCategories !== undefined ? { deviceCategories } : {}),
    ...(statements !== undefined ? { statements } : {}),
  };
  return {
    value: Object.keys(family).length > 0 ? { ...rest, families: { [IEC_62443_4_2]: family } } : rest,
    analysisChanged: dropped > 0,
  };
}
