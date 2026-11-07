// ==================== METHODOLOGY FINGERPRINT ====================
// Multi-project TARA (design §7.2): decides whether the likelihood factor
// values of an imported component risk can be taken over as prefill. Pure
// and feature-agnostic — the factor scales come from the risks feature
// (factorScaleDefinitions), joined in the app layer.
//
//   same fingerprint      → every intrinsic factor is prefilled
//   different fingerprint → only factors whose id AND scaleHash exist on
//                           both sides are prefilled; the rest is re-rated
//
// scaleHash is per factor and method-independent on purpose; the calc
// stamps' mappingVersion is not used (it covers the impact scale too, is
// project-wide and exists only under ISO/SAE 21434).

import type {
  FactorScaleDefinition,
  FingerprintFactor,
  MethodologyFingerprint,
} from "../models/component-import-types";
import { canonicalStringify } from "./tcs-canonical";
import { fnv1aHex12 } from "./fnv1a";

/** 12-hex FNV-1a over the canonical JSON of one factor's scale definition. */
export function scaleHash(scale: FactorScaleDefinition): string {
  return fnv1aHex12(canonicalStringify(scale));
}

/** The fingerprint of a likelihood method and its active intrinsic factors. */
export function buildMethodologyFingerprint(
  likelihoodMethod: string,
  factors: readonly { factorId: string; scale: FactorScaleDefinition }[],
): MethodologyFingerprint {
  const entries: FingerprintFactor[] = factors
    .map((f) => ({ factorId: f.factorId, scaleHash: scaleHash(f.scale) }))
    .sort((a, b) => (a.factorId < b.factorId ? -1 : a.factorId > b.factorId ? 1 : 0));
  return {
    likelihoodMethod,
    factors: entries,
    hash: fnv1aHex12(canonicalStringify({ likelihoodMethod, factors: entries })),
  };
}

export interface FingerprintComparison {
  /** Same method and the same scale for every intrinsic factor. */
  identical: boolean;
  /** Component factors whose value may be prefilled in the machine, sorted. */
  prefillFactorIds: string[];
}

/**
 * Which of the component's intrinsic factors can be taken over in the
 * machine. Identity is decided by factor id + scaleHash, never by a label.
 */
export function compareFingerprints(
  component: MethodologyFingerprint,
  machine: MethodologyFingerprint,
): FingerprintComparison {
  const machineScales = new Map(machine.factors.map((f) => [f.factorId, f.scaleHash]));
  const prefillFactorIds = component.factors
    .filter((f) => machineScales.get(f.factorId) === f.scaleHash)
    .map((f) => f.factorId);
  return { identical: component.hash === machine.hash, prefillFactorIds };
}
