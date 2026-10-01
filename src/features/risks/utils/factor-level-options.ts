// ==================== FACTOR LEVEL OPTIONS ====================
//
// The options of a factor's level select in the risk dialog. Pure (t is
// injected) so the labelling rules are testable without the dialog:
//
//   EN 50742-A EL / AC   → the norm levels (EL0…EL4 / AC bands)
//   ETSI TVRA factors    → the norm's level names with the value, "≤ 1 week (2)"
//                          (only under the etsi-tvra likelihood method)
//   likelihood factors   → "4 – No technical skills": the situation the level
//     with own labels      stands for (risk-impact-aggregation design §7.4)
//   everything else      → the generic scale ("3 – Medium")
//
// directionHint: for likelihood factors without own labels (custom factors),
// "1 = attack unlikely … N = attack likely".

import type { RiskConfiguration } from "../models/risk-config-types";
import { LIKELIHOOD_SCALES, RISK_SCALES } from "../models/risk-scale-types";
import { EN50742_FACTOR_LEVELS, en50742LevelLabel } from "../models/en50742-approach-a-core";
import {
  TVRA_LEVEL_TEXT,
  likelihoodFactorLevelText,
  likelihoodFactorLevels,
  tvraFactorLevels,
} from "../models/likelihood-factor-levels";

type T = (key: string, options?: Record<string, unknown>) => string;

export interface FactorLevelOption {
  value: number;
  label: string;
  /** Colour of the generic level — the factor's contribution at a glance. */
  color?: string;
}

export interface FactorLevelOptions {
  options: FactorLevelOption[];
  directionHint: string | null;
}

export function factorLevelOptions(
  factorId: string,
  category: "impact" | "likelihood",
  configuration: Pick<RiskConfiguration, "scale" | "likelihoodMethod">,
  isEN50742: boolean,
  t: T,
): FactorLevelOptions {
  const en50742Levels =
    isEN50742 && EN50742_FACTOR_LEVELS[factorId] ? EN50742_FACTOR_LEVELS[factorId] : undefined;
  if (en50742Levels) {
    return {
      options: en50742Levels.map((key, i) => ({
        value: i + 1,
        // i18n label (en/de) with the norm English string from the core as the
        // fallback — keeps CLI/report and any unlocalised build correct.
        label: t(`risks.en50742Levels.${factorId}.${key}`, {
          defaultValue: en50742LevelLabel(factorId, key),
        }),
      })),
      directionHint: null,
    };
  }

  const tvraLevels =
    configuration.likelihoodMethod === "etsi-tvra" ? tvraFactorLevels(factorId) : undefined;
  if (tvraLevels) {
    return {
      options: tvraLevels.map((key, i) => ({
        value: i + 1,
        label: `${t(`risks.tvraLevels.${key}`, { defaultValue: TVRA_LEVEL_TEXT[key] ?? key })} (${i + 1})`,
      })),
      directionHint: null,
    };
  }

  const likelihood = category === "likelihood";
  const situation = likelihood ? likelihoodFactorLevels(factorId, configuration.scale) : undefined;
  const scale = (likelihood ? LIKELIHOOD_SCALES : RISK_SCALES)[configuration.scale];
  return {
    options: scale.levels.map((level, i) => ({
      value: level.value,
      color: level.color,
      label: `${level.value} – ${
        situation?.[i]
          ? t(`risks.factorLevels.${factorId}.${situation[i]}`, {
              defaultValue: likelihoodFactorLevelText(factorId, situation[i]),
            })
          : t(
              `risks.scales.${likelihood ? "likelihood" : "impact"}.${level.label
                .toLowerCase()
                .replace(/ /g, "_")}`,
              { defaultValue: level.label },
            )
      }`,
    })),
    directionHint:
      likelihood && !situation
        ? t("tabs.risks.dialog.likelihoodDirectionHint", {
            max: LIKELIHOOD_SCALES[configuration.scale].levels.length,
            defaultValue: "1 = attack unlikely … {{max}} = attack likely",
          })
        : null,
  };
}
