/**
 * Migrate schema version 9 → 10 (0.15.0-beta).
 *
 * 1. Version fence — no data change.
 *
 * ISO/SAE 21434 conformance plan Phase 0 (decision 15): every release that
 * stores new fields bumps the schema, so an older release refuses the file
 * instead of opening it and dropping the new fields on save. Schema 10 adds
 * the optional calculation stamps (Risk.calcStamp, PathAnalysis.calcStamp,
 * written only in iso-21434 projects, conformance plan 0c). "No stamp"
 * means "computed before 0c" — except for the ISO risk values of step 4,
 * which are computed here and therefore stamped (decision 20 E5).
 *
 * 2. Attack-tree likelihood on the risk scale (decision 21,
 *    fixTreeLikelihoodScale): stored values mapped with the 5-level default
 *    are corrected for 3- and 4-level risk scales — all presets.
 *
 * 3. Safety names normalised again (decision 22): only the idempotent name
 *    part (annotations, endangers edges, physicalImpact / safetyImpact) —
 *    closes the beta point "v9 files keep old names" (fatality …). The
 *    rating step "safety 3 → 4" stays in 8 → 9 only; repeating it would raise
 *    every v9 rating 3 (irreversible_minor) to 4.
 *
 * 4. ISO risk value 1–5 (conformance plan 3a, decision 20): Risk.isoRisk for
 *    every risk of an iso-21434 project, computed with the current data and
 *    stamped. No treatment, priority or justification changes.
 *
 * Runs once per file through the version gate in migration-service.
 */
import { fixTreeLikelihoodScale } from "./fix-tree-likelihood-scale";
import { normalizeSafetySeverityNames } from "./normalize-safety-severity";
import { computeIsoRisks } from "../../utils/commit-iso-risk-values";
import { riskCalcStamp } from "../../utils/commit-calc-stamps";

/** Stamp every ISO risk that now carries an isoRisk (just computed). */
function stampIsoRisks(data: any): any {
  if (!Array.isArray(data?.risks?.risks)) return data;
  if (!data.risks.risks.some((r: any) => r.isoRisk)) return data;
  const stamp = riskCalcStamp(data);
  return {
    ...data,
    risks: {
      ...data.risks,
      risks: data.risks.risks.map((r: any) => (r.isoRisk ? { ...r, calcStamp: stamp } : r)),
    },
  };
}

export function migrate_9_to_10(data: any): any {
  const named = normalizeSafetySeverityNames(data);
  const fixed = fixTreeLikelihoodScale(named);
  const withIso = stampIsoRisks(computeIsoRisks(fixed));
  return { ...withIso, schemaVersion: 10 };
}
