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
// Only regime LIKELIHOOD factors (source standard / ETSI / EN50742) are touched.
// Impact factors, safety, deployment_scope, attack_tree_likelihood and custom
// factors are never affected by a preset.

import {
  type ActiveFactor,
  type RiskFactorDefinition,
  ALL_PREDEFINED_FACTORS,
} from "../models/risk-factor-types";
import { REGULATION_PRESETS, type RegulationPresetId } from "shared";

// BUGFIX (reported: en-50742-a locked off ALL standard likelihood factors,
// not just the norm-competing ones): "standard" (OWASP-style skill_level,
// motive, opportunity, ease_of_exploit, ...) is the baseline factor set
// available to every method — it is never mutually exclusive with a
// regulatory regime and must stay analyst-configurable under "method" mode
// (en-50742-a). Only the actual competing NORM regimes (ISO21434 / ETSI /
// EN50742 themselves) lock each other out. "exclusive" mode (iso-21434 /
// etsi-tvra) is unaffected by this set — it locks off everything non-target
// via a separate branch in factorLockState(), never consulting this pool.
// Methods whose regime is exclusive — ONLY the norm's own factors are ever
// active; standard (OWASP-style) likelihood factors ARE regime-managed and
// get disabled just like any other foreign-regime factor. Declared here
// (not just near presetFactorLock below) because applyRegulationPreset also
// needs it, to select the right pool.
const EXCLUSIVE_METHODS: ReadonlySet<string> = new Set(["iso-21434", "etsi-tvra"]);

// Pool for "method"-style presets (en-50742-a today): mutual exclusivity is
// only between actual COMPETING NORM regimes. "standard" (OWASP-style
// skill_level, motive, opportunity, ...) is the baseline factor set
// available to every method — it is never mutually exclusive with a
// regulatory regime and must stay analyst-configurable (bugfix: this used to
// include "standard", so applying en-50742-a locked off ALL standard
// likelihood factors, not just norm-competing ones).
const METHOD_REGIME_SOURCES: ReadonlySet<string> = new Set([
  "ETSI",
  "EN50742",
  "ISO21434",
]);

// Pool for "exclusive"-style presets (iso-21434 / etsi-tvra): these presets
// replace the likelihood factor set ENTIRELY — only the preset's own targets
// stay active, "standard" included. Keeping "standard" out of this pool
// (as METHOD_REGIME_SOURCES does) would leave OWASP-style factors silently
// enabled after switching to e.g. iso-21434, contradicting "ONLY the norm
// factors are active" and letting stale weighted-mean factors leak into a
// project that's supposed to be a pure score-table method.
const EXCLUSIVE_REGIME_SOURCES: ReadonlySet<string> = new Set([
  "standard",
  "ETSI",
  "EN50742",
  "ISO21434",
]);

/**
 * The pool of likelihood factors a preset is allowed to manage — mode-aware
 * (see the two source sets above). Derived from the factor definitions so it
 * stays correct as factors are added.
 */
function regimeLikelihoodPool(
  defs: RiskFactorDefinition[],
  exclusive: boolean,
): Set<string> {
  const sources = exclusive ? EXCLUSIVE_REGIME_SOURCES : METHOD_REGIME_SOURCES;
  return new Set(
    defs
      .filter((d) => d.category === "likelihood" && sources.has(d.source))
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
  const pool = regimeLikelihoodPool(
    factorDefs,
    EXCLUSIVE_METHODS.has(preset.likelihoodMethod),
  );

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

/**
 * Locking modes for the config dialog (design §3.11, enforcement A2):
 *
 *   "none"      weighted-mean presets (standard, en-50742-b) AND en-50742-a —
 *               nothing locked. EN 50742-a's own factors (EL/WoO/AC) are no
 *               longer part of this dialog's managed set at all (see
 *               presetFactorLock below) — they're shown/rated exclusively in
 *               RiskDialog's SRSL section, auto-enabled via
 *               applyRegulationPreset() when the tag is set.
 *   "method"    currently UNREACHABLE — no LikelihoodMethod maps to it
 *               anymore (en-50742-a was the only "method" preset; it moved
 *               to "none" above). Kept only so PresetLockMode/factorLockState
 *               don't need a wider revert if a future preset needs this
 *               "norm targets locked-on, other regimes locked-off, impact
 *               stays editable" shape again.
 *   "exclusive" iso-21434 / etsi-tvra — ONLY the norm factors are active;
 *               EVERYTHING else is locked off, impact factors included. Impact
 *               must therefore come from asset-impact (useAssetImpact), not from
 *               impact-factor ratings.
 */
export type PresetLockMode = "none" | "method" | "exclusive";
 
export interface PresetFactorLock {
  mode: PresetLockMode;
  /** Norm factors — checked, cannot be disabled. */
  targets: string[];
  /** Other regimes' likelihood factors — cannot be enabled (both locking modes). */
  lockedLikelihood: string[];
}
 
export function presetFactorLock(
  presetId: RegulationPresetId,
  factorDefs: RiskFactorDefinition[] = ALL_PREDEFINED_FACTORS,
): PresetFactorLock {
  const preset = REGULATION_PRESETS[presetId];
  // en-50742-a's own factors (WoO/AC/EL) are no longer part of the
  // config-dialog's managed set at all (risk-config-dialog.tsx excludes
  // EN50742_FACTORS from factorGroups.likelihood entirely) — they're shown
  // and rated exclusively in RiskDialog's SRSL section, activated via
  // applyRegulationPreset() when the tag is set, never toggled here. There
  // is therefore nothing left for this dialog's lock system to manage for
  // en-50742-a; treat it like weighted-mean (mode "none").
  if (
    preset.likelihoodMethod === "weighted-mean" ||
    preset.likelihoodMethod === "en-50742-a" ||
    !preset.likelihoodFactorIds
  ) {
    return { mode: "none", targets: [], lockedLikelihood: [] };
  }
  const target = new Set(preset.likelihoodFactorIds);
  const exclusive = EXCLUSIVE_METHODS.has(preset.likelihoodMethod);
  const pool = regimeLikelihoodPool(factorDefs, exclusive);
  const lockedLikelihood = [...pool].filter((id) => !target.has(id)).sort();
  const mode: PresetLockMode = exclusive ? "exclusive" : "method";
  return { mode, targets: [...target].sort(), lockedLikelihood };
}
 
export type FactorLockState = "locked-on" | "locked-off" | "editable";
 
   /**
    * Per-factor lock state for the dialog. In "method" mode only norm targets
    * (locked-on) and other regime likelihood factors (locked-off) are locked;
    * impact/custom stay editable. In "exclusive" mode everything but the norm
    * targets is locked-off.
    */
export function factorLockState(
  factorId: string,
  lock: PresetFactorLock,
): FactorLockState {
  if (lock.mode === "none") return "editable";
  if (lock.targets.includes(factorId)) return "locked-on";
  if (lock.mode === "exclusive") return "locked-off"; // only norm factors active
  // "method": other regime likelihood locked off; impact / custom stay editable.
  return lock.lockedLikelihood.includes(factorId) ? "locked-off" : "editable";
}
 
export interface PresetFactorDrift {
  drifted: boolean;
  disabledTargets: string[];
  foreignEnabled: string[];
}
 
/**
 * Backstop predicate (design §3.11) for handleRisksUpdate / import. In "method"
 * mode only foreign regime LIKELIHOOD factors count as drift (impact is free);
 * in "exclusive" mode ANY enabled non-norm factor is drift.
 */
export function detectPresetFactorDrift(
  activeFactors: ActiveFactor[],
  presetId: RegulationPresetId,
  factorDefs: RiskFactorDefinition[] = ALL_PREDEFINED_FACTORS,
): PresetFactorDrift {
  const lock = presetFactorLock(presetId, factorDefs);
  if (lock.mode === "none") {
    return { drifted: false, disabledTargets: [], foreignEnabled: [] };
  }
  const targetSet = new Set(lock.targets);
  const enabled = activeFactors.filter((f) => f.enabled).map((f) => f.factorId);
  const disabledTargets = lock.targets.filter((id) => !enabled.includes(id));
  const foreignEnabled = (
    lock.mode === "exclusive"
      ? enabled.filter((id) => !targetSet.has(id))
      : enabled.filter((id) => lock.lockedLikelihood.includes(id))
  ).sort();
  return {
    drifted: disabledTargets.length > 0 || foreignEnabled.length > 0,
    disabledTargets,
    foreignEnabled,
  };
}