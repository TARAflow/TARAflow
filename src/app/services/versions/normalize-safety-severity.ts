/**
 * Part of the schema 9 step (migrate_8_to_9).
 * Person-harm severity moves to the canonical 5-level scale
 * (shared/models/safety-types.ts):
 *
 *   reversible_minor < reversible_major < irreversible_minor
 *     < irreversible_major < fatal
 *
 * Old values are mapped conservatively (an undifferentiated level goes to the
 * upper sub-level, see normalizeLegacySafetyImpact):
 *
 *   reversible_injury / reversible_moderate → reversible_major
 *   irreversible_injury                     → irreversible_major
 *   fatality                                → fatal
 *
 * Rewritten wherever the vocabulary is persisted:
 *   - SafetyAnnotation.impact     (any `safety` object carrying `relevance`)
 *   - properties.safetyAnnotation.severity (legacy process annotation)
 *   - endangers edges             (impact.severity where impact.target === "human")
 *   - physicalImpact / safetyImpact properties
 *   - "safety" ImpactRating.value: the fixed 4-level factor. Old 3 meant
 *     "irreversible injury"; conservatively it becomes 4 (irreversible_major).
 *
 * Risk factor ratings are not touched: derived ones are re-derived from the
 * migrated physicalImpact, manual ones stay the analyst's decision.
 *
 * Canonical values pass through unchanged and a rating already at 4 stays 4.
 * The rating step (3 → 4) is NOT idempotent; the version gate in
 * migration-service runs it once, for files below v9.
 */

import { normalizeLegacySafetyImpact } from "shared/models/safety-types";

const SAFETY_CRITERION_ID = "safety";

function migrateSeverity(value: unknown): unknown {
  return normalizeLegacySafetyImpact(value) ?? value;
}

function isObject(v: unknown): v is Record<string, any> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function migrateNode(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(migrateNode);
  if (!isObject(node)) return node;

  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(node)) {
    out[key] = migrateNode(value);
  }

  // SafetyAnnotation
  if (isObject(out.safety) && "relevance" in out.safety && "impact" in out.safety) {
    out.safety = { ...out.safety, impact: migrateSeverity(out.safety.impact) };
  }

  // Legacy process-level annotation (element properties.safetyAnnotation)
  if (isObject(out.safetyAnnotation) && "severity" in out.safetyAnnotation) {
    out.safetyAnnotation = {
      ...out.safetyAnnotation,
      severity: migrateSeverity(out.safetyAnnotation.severity),
    };
  }

  // HazardItem endangers edge with a person as target
  if (
    out.type === "endangers" &&
    isObject(out.impact) &&
    out.impact.target === "human"
  ) {
    out.impact = { ...out.impact, severity: migrateSeverity(out.impact.severity) };
  }

  // Asset / element properties
  for (const key of ["physicalImpact", "safetyImpact"]) {
    if (key in out) out[key] = migrateSeverity(out[key]);
  }

  // Safety ImpactRating: old Se3 ("irreversible injury") → Se4 (irreversible_major)
  if (out.criterionId === SAFETY_CRITERION_ID && out.value === 3) {
    out.value = 4;
  }

  return out;
}

/** Rewrites all persisted person-harm severities; does not touch schemaVersion. */
export function normalizeSafetySeverities(data: any): any {
  return migrateNode(data);
}
