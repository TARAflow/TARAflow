// features/hazards/services/severity-scale-service.ts
//
// resolveSeverityScale(targetKind) — pure mapping from an endangers target kind
// to the ordered severity vocabulary the endangers-edge editor should offer.
// Backed by SEVERITY_SCALE_BY_TARGET (shared/models/hazard-impact.ts), so the
// scales have a single source of truth and the editor never hardcodes them.

import { SEVERITY_SCALE_BY_TARGET } from "shared";
import type { HazardTargetKind } from "shared";

/**
 * Ordered severity options for a given endangers target kind:
 *   human          -> safety scale (reversible/irreversible/fatality)
 *   environment    -> low/medium/high/critical
 *   infrastructure -> low/medium/high/critical (destruction)
 *
 * Returned as readonly string[] because the consumer is a dropdown; the exact
 * per-kind union types stay enforced at the HazardImpact level.
 */
export function resolveSeverityScale(
  targetKind: HazardTargetKind,
): readonly string[] {
  return SEVERITY_SCALE_BY_TARGET[targetKind];
}
