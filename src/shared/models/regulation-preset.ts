// ==================== REGULATION PRESET ====================
// The project-wide, single-select choice of which regulatory regime drives the
// risk method. Pure data — no risks/overview imports, so both the overview
// selector and the risks apply-logic can depend on it without a feature cycle.
//
// Phase 1 scope: a preset declares which LIKELIHOOD factors it activates
// (`likelihoodFactorIds`). Applying a preset toggles those on and the other
// regimes' likelihood factors off, non-destructively (see
// regulation-preset-service.applyRegulationPreset).
//
// `likelihoodFactorIds` is OPTIONAL: a preset that does not manage the
// likelihood factors (e.g. EN 50742 Approach B, which is compliance-driven and
// handled by the Compliance feature) omits it, and applying it never touches
// activeFactors.

export type RegulationPresetId =
  | "owasp"
  | "iso-21434"
  | "en-50742-a"
  | "en-50742-b";

/** The default preset when a project has none set. */
export const DEFAULT_REGULATION_PRESET: RegulationPresetId = "owasp";

export interface RegulationPreset {
  id: RegulationPresetId;
  /** i18n key for the display name: regulationPresets.<id>.name */
  nameKey: string;
  /** i18n key for the description: regulationPresets.<id>.description */
  descriptionKey: string;
  /**
   * Likelihood factor IDs this regime activates. Omitted → the preset does not
   * manage likelihood factors (applying it is a no-op on activeFactors).
   * IDs reference risk-factor-types factor definitions.
   */
  likelihoodFactorIds?: string[];
}

export const REGULATION_PRESETS: Record<RegulationPresetId, RegulationPreset> = {
  owasp: {
    id: "owasp",
    nameKey: "regulationPresets.owasp.name",
    descriptionKey: "regulationPresets.owasp.description",
    // The app's default likelihood set (matches DEFAULT_CONFIGURATION).
    likelihoodFactorIds: ["skill_level", "motive", "opportunity", "ease_of_exploit"],
  },
  "iso-21434": {
    id: "iso-21434",
    nameKey: "regulationPresets.iso-21434.name",
    descriptionKey: "regulationPresets.iso-21434.description",
    // ISO/SAE 21434 uses an ISO 18045-style attack-potential set. Provisional —
    // refine when the ISO 21434 strand (Modus_21434) is built; the ETSI/TVRA
    // factors are the closest existing catalogue entries.
    likelihoodFactorIds: ["knowledge", "expertise", "time", "equipment"],
  },
  "en-50742-a": {
    id: "en-50742-a",
    nameKey: "regulationPresets.en-50742-a.name",
    descriptionKey: "regulationPresets.en-50742-a.description",
    // Annex B attack potential: AP = (EL × WoO) + AC.
    likelihoodFactorIds: [
      "window_of_opportunity",
      "attacker_capability",
      "exposure_level",
    ],
  },
  "en-50742-b": {
    id: "en-50742-b",
    nameKey: "regulationPresets.en-50742-b.name",
    descriptionKey: "regulationPresets.en-50742-b.description",
    // Approach B is compliance-driven (IEC 62443-3-3/-4-2 fixed subset),
    // delivered by the Compliance feature — it does not manage likelihood
    // factors, so likelihoodFactorIds is intentionally omitted.
  },
};

export function getRegulationPreset(
  id: RegulationPresetId | undefined,
): RegulationPreset {
  return REGULATION_PRESETS[id ?? DEFAULT_REGULATION_PRESET];
}

/** All preset ids, for building selectors. */
export const REGULATION_PRESET_IDS = Object.keys(
  REGULATION_PRESETS,
) as RegulationPresetId[];
