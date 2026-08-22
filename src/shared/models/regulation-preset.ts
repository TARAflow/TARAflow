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
  | "standard"
  | "iso-21434"
  | "en-50742-a"
  | "en-50742-b"
  | "etsi-tvra";

/** The default preset when a project has none set. */
export const DEFAULT_REGULATION_PRESET: RegulationPresetId = "standard";

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
  standard: {
    id: "standard",
    nameKey: "regulationPresets.standard.name",
    descriptionKey: "regulationPresets.standard.description",
    // The default TARAflow likelihood set (orig. OWASP; matches DEFAULT_CONFIGURATION).
    likelihoodFactorIds: [
      "skill_level",
      "motive",
      "opportunity",
      "ease_of_exploit",
    ],
  },
  "iso-21434": {
    id: "iso-21434",
    nameKey: "regulationPresets.iso-21434.name",
    descriptionKey: "regulationPresets.iso-21434.description",
    // ISO/SAE 21434 attack-potential factors (Annex G.2 — score-table method,
    // scored via iso21434-core.ts). Distinct set from ETSI TVRA.
    likelihoodFactorIds: [
      "iso_elapsed_time",
      "iso_expertise",
      "iso_knowledge",
      "iso_window_of_opportunity",
      "iso_equipment",
    ],
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
  "etsi-tvra": {
    id: "etsi-tvra",
    nameKey: "regulationPresets.etsi-tvra.name",
    descriptionKey: "regulationPresets.etsi-tvra.description",
    // ETSI TS 102 165-1 weighted-summation factors (score-table; etsi-tvra-core.ts).
    likelihoodFactorIds: [
      "time",
      "expertise",
      "knowledge",
      "etsi_opportunity",
      "equipment",
      "etsi_intensity",
    ],
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