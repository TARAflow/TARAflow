// ==================== REGULATION PRESET SERVICE ====================
// Applies a regulation preset to a project's activeFactors: enables the
// regime's likelihood factors and disables the OTHER regimes' likelihood
// factors — non-destructively, using the autoEnabled ownership convention
// (compare updateImpactFactorsAutoEnable in risk-sync-service):
//
//   autoEnabled === false  → analyst explicitly chose it; protected — never
//                            auto-disabled, only flagged as a conflict.
//   autoEnabled === true    → system auto-enabled; safe to withdraw.
//   autoEnabled undefined   → ship-default / prior-preset selection, not a
//                            deliberate analyst choice; safe to withdraw.
//
// A managed factor the analyst enabled by hand (autoEnabled === false) is left
// ON and reported in `conflicts` so the UI can explain why it stayed active,
// rather than silently dropping the analyst's choice.
//
// Only regime LIKELIHOOD factors (source OWASP / ETSI / EN50742) are touched.
// Impact factors, safety, deployment_scope, attack_tree_likelihood and custom
// factors are never affected by a preset.

import {
  type ActiveFactor,
  type RiskFactorDefinition,
  ALL_PREDEFINED_FACTORS,
} from "../models/risk-factor-types";
import {
  REGULATION_PRESETS,
  type RegulationPresetId,
} from "shared";

const REGIME_LIKELIHOOD_SOURCES: ReadonlySet<string> = new Set([
  "OWASP",
  "ETSI",
  "EN50742",
]);

/**
 * The pool of likelihood factors a preset is allowed to manage: every
 * likelihood-category factor from a regulatory regime source. Derived from the
 * factor definitions so it stays correct as factors are added.
 */
function regimeLikelihoodPool(defs: RiskFactorDefinition[]): Set<string> {
  return new Set(
    defs
      .filter(
        (d) => d.category === "likelihood" && REGIME_LIKELIHOOD_SOURCES.has(d.source),
      )
      .map((d) => d.id),
  );
}

export interface RegulationPresetApplyResult {
  activeFactors: ActiveFactor[];
  /** Factor ids the preset turned on. */
  enabled: string[];
  /** Factor ids the preset turned off (only ones the system had auto-enabled). */
  disabled: string[];
  /**
   * Managed factors left ON because the analyst had enabled them by hand.
   * The UI should surface these (e.g. a banner) rather than treat them as a
   * silent side effect.
   */
  conflicts: string[];
  /** True if any factor was enabled or disabled. */
  changed: boolean;
}

/**
 * Apply `presetId` to `activeFactors`. Pure — returns a new array, never
 * mutates the input. A preset without `likelihoodFactorIds` (e.g. Approach B)
 * is a no-op on the factors.
 */
export function applyRegulationPreset(
  activeFactors: ActiveFactor[],
  presetId: RegulationPresetId,
  factorDefs: RiskFactorDefinition[] = ALL_PREDEFINED_FACTORS,
): RegulationPresetApplyResult {
  const preset = REGULATION_PRESETS[presetId];

  // Presets that don't manage likelihood factors leave activeFactors untouched.
  if (!preset.likelihoodFactorIds) {
    return {
      activeFactors,
      enabled: [],
      disabled: [],
      conflicts: [],
      changed: false,
    };
  }

  const target = new Set(preset.likelihoodFactorIds);
  const pool = regimeLikelihoodPool(factorDefs);

  const enabled: string[] = [];
  const disabled: string[] = [];
  const conflicts: string[] = [];
  const seen = new Set<string>();

  const next: ActiveFactor[] = activeFactors.map((factor) => {
    seen.add(factor.factorId);

    // (1) Target factor of the selected regime → ensure enabled.
    if (target.has(factor.factorId)) {
      if (!factor.enabled) {
        enabled.push(factor.factorId);
        return { ...factor, enabled: true, autoEnabled: true };
      }
      // Already on — keep the analyst's weight and ownership untouched.
      return factor;
    }

    // (2) Another regime's likelihood factor → switch it off, unless the
    //     analyst explicitly chose it.
    if (pool.has(factor.factorId)) {
      if (factor.enabled && factor.autoEnabled === false) {
        // Analyst explicitly enabled this factor by hand → keep it, but flag
        // it so the UI can explain why it stayed active.
        conflicts.push(factor.factorId);
        return factor;
      }
      if (factor.enabled) {
        // Ship-default (autoEnabled undefined) or system-auto (true) → withdraw.
        disabled.push(factor.factorId);
        return { ...factor, enabled: false, autoEnabled: false };
      }
      return factor; // already off
    }

    // (3) Not a regime likelihood factor (impact, safety, custom) → untouched.
    return factor;
  });

  // (4) Target factors missing from the list entirely → add them enabled.
  for (const id of target) {
    if (seen.has(id)) continue;
    const def = factorDefs.find((d) => d.id === id);
    next.push({
      factorId: id,
      enabled: true,
      weight: def?.defaultWeight ?? 1.0,
      autoEnabled: true,
    });
    enabled.push(id);
  }

  return {
    activeFactors: next,
    enabled,
    disabled,
    conflicts,
    changed: enabled.length > 0 || disabled.length > 0,
  };
}
