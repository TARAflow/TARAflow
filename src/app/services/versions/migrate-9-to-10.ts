/**
 * Migrate schema version 9 → 10 (0.15.0-beta).
 *
 * 1. Version fence — no data change.
 *
 * ISO/SAE 21434 conformance plan Phase 0 (decision 15): every release that
 * stores new fields bumps the schema, so an older release refuses the file
 * instead of opening it and dropping the new fields on save. Schema 10 adds
 * the optional calculation stamps (Risk.calcStamp, PathAnalysis.calcStamp,
 * written only in iso-21434 projects, conformance plan 0c). Nothing is
 * stamped here — "no stamp" means "computed before 0c".
 *
 * 2. Attack-tree likelihood on the risk scale (decision 21,
 *    fixTreeLikelihoodScale): stored values mapped with the 5-level default
 *    are corrected for 3- and 4-level risk scales — all presets.
 *
 * Runs once per file through the version gate in migration-service.
 */
import { fixTreeLikelihoodScale } from "./fix-tree-likelihood-scale";

export function migrate_9_to_10(data: any): any {
  return { ...fixTreeLikelihoodScale(data), schemaVersion: 10 };
}
