// ==================== RISK DIALOG — FACTOR ROWS ====================
// Split out of risk-dialog.tsx (MT-2): the factor rows of the Before / After tabs — a rated factor,
// an ISO attack-potential factor, the attack-tree likelihood. Render functions,
// not components: the rendered tree stays exactly as before.

import React from "react";
import type { RiskDialogModel } from "./use-risk-dialog-model";
import { ISO_AP_POINTS_BY_FACTOR } from "./local-risk-state";
import { Box, Typography, Chip, Stack, Tooltip, IconButton, Paper, Select, MenuItem, TextField } from "@mui/material";
import { Refresh as ResetIcon } from "@mui/icons-material";
import { ATTACK_TREE_LIKELIHOOD_FACTOR_ID } from "../../models/risk-factor-types";
import { ISO21434_FACTOR_LEVELS } from "../../models/iso21434-core";
import { factorLevelOptions, isoFactorLevelColor } from "../../utils/factor-level-options";
import { getFactorDefinition } from "../../models/risk-assessment-types";
import { LIKELIHOOD_SCALES } from "../../models/risk-scale-types";
import { feasibilityLevelToRiskScale } from "shared";

/** A factor row's factor: its active configuration entry with the definition. */
export interface FactorRowFactor {
  factorId: string;
  weight: number;
  definition?: ReturnType<typeof getFactorDefinition>;
}

  // ── Factor row renderer ───────────────────────────────────────────────────
export function renderFactorRowOf(m: RiskDialogModel, factor: FactorRowFactor, mitigated: boolean) {
  const { t, configuration, local, isEN50742, updateFactor, handleResetFactor, setFactorRationale } = m;
  const def = factor.definition;
  if (!def) return null;

  const ratings = mitigated
    ? local.mitigatedFactorRatings
    : local.factorRatings;
  const rating = ratings.find((r) => r.factorId === factor.factorId);
  const value = rating?.value ?? 0;

  const isOverridden =
    rating?.source === "manual" &&
    rating.derivedValue !== undefined &&
    value !== rating.derivedValue;

  const isDerived = rating?.source === "derived";

  // §11.2: exposure_level is derived from the DFD (deriveExposureLevels →
  // applyExposureLevelToFactorRatings), not from the Asset Tab — everything
  // else that reaches "derived" status still comes from asset-criteria
  // prefill. The badge/tooltip text must say which, or it actively
  // misleads the analyst about where to go fix a wrong value.
  const isDfdDerived = factor.factorId === "exposure_level";
  // Multi-project TARA (§7.2, patch 16): an intrinsic factor taken over
  // from an imported component.
  const isComponentDerived = rating?.derivedFrom === "component";
  const derivedLabel = isComponentDerived
    ? t("tabs.risks.dialog.factorDerivedComponent", { defaultValue: "Component" })
    : isDfdDerived
      ? t("tabs.risks.dialog.factorDerivedDfd", { defaultValue: "DFD" })
      : t("tabs.risks.dialog.factorDerived", { defaultValue: "Assets" });
  const derivedTooltip = isComponentDerived
    ? t("tabs.risks.dialog.factorDerivedComponentTooltip", {
        defaultValue: "Taken over from the imported component's rating (intrinsic factor)",
      })
    : isDfdDerived
      ? t("tabs.risks.dialog.factorDerivedDfdTooltip", {
          defaultValue:
            "Derived from the linked DFD element/DataFlow's Exposure Level",
        })
      : t("tabs.risks.dialog.factorDerivedTooltip", {
          defaultValue: "Pre-filled from Asset Tab data",
        });
  const overriddenTooltip = isComponentDerived
    ? t("tabs.risks.dialog.factorOverriddenTooltipComponent", {
        value: rating?.derivedValue,
        defaultValue: `Component's value: ${rating?.derivedValue}. Click ↺ to reset.`,
      })
    : isDfdDerived
    ? t("tabs.risks.dialog.factorOverriddenTooltipDfd", {
        value: rating?.derivedValue,
        defaultValue: `DFD-derived value: ${rating?.derivedValue}. Click ↺ to reset.`,
      })
    : t("tabs.risks.dialog.factorOverriddenTooltip", {
        value: rating?.derivedValue,
        defaultValue: `Asset-derived value: ${rating?.derivedValue}. Click ↺ to reset.`,
      });

  // Level labels per factor (EN 50742 norm levels, TVRA norm levels,
  // situation labels of the likelihood factors, generic scale) — one place,
  // see factor-level-options.ts. EN 50742 EL3 is stored as value 4
  // (index+1, so EL0=1 can be told apart from "unrated"=0); the option value
  // stays the 1-based rating index, only the LABEL is the level.
  const { options: factorOptions, directionHint } = factorLevelOptions(
    factor.factorId,
    def.category === "likelihood" ? "likelihood" : "impact",
    configuration,
    isEN50742,
    t as unknown as (key: string, options?: Record<string, unknown>) => string,
  );

  return (
    <Paper key={factor.factorId} variant="outlined" sx={{ p: 1.5 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="body2" fontWeight="medium" sx={{ flexGrow: 1 }}>
          {t(`risks.factors.${def.id}.shortName`, {
            defaultValue: t(`risks.factors.${def.id}.name`, {
              defaultValue: def.name,
            }),
          })}
        </Typography>

        {/* "From Assets"/"From DFD" badge — subtle, shown when value is derived and not overridden */}
        {isDerived && !isOverridden && (
          <Tooltip title={derivedTooltip}>
            <Chip
              label={derivedLabel}
              size="small"
              sx={{
                height: 18,
                fontSize: 10,
                bgcolor: "primary.50",
                color: "primary.main",
                border: "1px solid",
                borderColor: "primary.200",
              }}
            />
          </Tooltip>
        )}

        {/* Overridden chip — analyst changed a derived value */}
        {isOverridden && (
          <Tooltip title={overriddenTooltip}>
            <Chip
              label={t("tabs.risks.dialog.factorOverridden", {
                defaultValue: "Overridden",
              })}
              size="small"
              color="warning"
              sx={{ height: 18, fontSize: 10 }}
            />
          </Tooltip>
        )}

        {/* Reset button — only when overridden */}
        {isOverridden && (
          <Tooltip
            title={t("tabs.risks.dialog.factorReset", {
              defaultValue: "Reset to derived value",
            })}
          >
            <IconButton
              size="small"
              onClick={() => handleResetFactor(factor.factorId, mitigated)}
              sx={{ p: 0.25, color: "warning.main" }}
            >
              <ResetIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        )}

        {/* Description tooltip */}
        <Tooltip
          title={t(`risks.factors.${def.id}.description`, {
            defaultValue: def.description,
          })}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ cursor: "help" }}
          >
            ⓘ
          </Typography>
        </Tooltip>
      </Stack>

      <Select
        value={value}
        onChange={(e) =>
          updateFactor(factor.factorId, e.target.value as number, mitigated)
        }
        size="small"
        fullWidth
        sx={
          isOverridden
            ? {
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: "warning.main",
                },
              }
            : undefined
        }
      >
        <MenuItem value={0}>
          <em>
            {t("tabs.risks.dialog.notRated", { defaultValue: "Not rated" })}
          </em>
        </MenuItem>
        {factorOptions.map((opt) => {
          const isAssetValue =
            (isDerived || isOverridden) && opt.value === rating?.derivedValue;
          return (
            <MenuItem key={opt.value} value={opt.value}>
              <Tooltip
                title={isAssetValue ? derivedTooltip : ""}
                placement="right"
                disableHoverListener={!isAssetValue}
              >
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  width="100%"
                  sx={{ fontWeight: isAssetValue ? "bold" : "normal" }}
                >
                  {opt.color && (
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        bgcolor: opt.color,
                      }}
                    />
                  )}
                  <span>
                    {opt.label}
                    {isAssetValue && " *"}
                  </span>
                </Stack>
              </Tooltip>
            </MenuItem>
          );
        })}
      </Select>
      {isOverridden && isComponentDerived && (
        <TextField
          size="small"
          fullWidth
          multiline
          sx={{ mt: 1 }}
          label={t("tabs.risks.dialog.factorOverrideRationale", {
            defaultValue: "Why this differs from the component's rating (required)",
          })}
          value={rating?.overrideRationale ?? ""}
          error={!(rating?.overrideRationale ?? "").trim()}
          onChange={(e) => setFactorRationale(factor.factorId, e.target.value, mitigated)}
          inputProps={{ "data-testid": `factor-override-rationale-${factor.factorId}` }}
        />
      )}
      {directionHint && (
        <Typography
          variant="caption"
          color="text.secondary"
          data-testid={`factor-direction-hint-${factor.factorId}`}
          sx={{ display: "block", mt: 0.5 }}
        >
          {directionHint}
        </Typography>
      )}
    </Paper>
  );
}

  // One ISO attack-potential factor: read-only chip (before) or a labelled
  // "<level> (<points>)" dropdown (after).
export function renderIsoFactorRowOf(m: RiskDialogModel, factorId: string, mitigated: boolean) {
  const { t, configuration, local, updateFactor } = m;
  const levels =
    ISO21434_FACTOR_LEVELS[factorId as keyof typeof ISO21434_FACTOR_LEVELS];
  if (!levels) return null;
  const def = getFactorDefinition(factorId, configuration.customFactors);
  const name = t(`risks.factors.${factorId}.shortName`, {
    defaultValue: t(`risks.factors.${factorId}.name`, {
      defaultValue: def?.name ?? factorId,
    }),
  });
  const ratings = mitigated
    ? local.mitigatedFactorRatings
    : local.factorRatings;
  const value = ratings.find((r) => r.factorId === factorId)?.value ?? 0;
  const optionLabel = (idx1: number) => {
    const lvl = levels[idx1 - 1];
    return t(`risks.isoLevels.${lvl}`, { defaultValue: lvl });
  };
  // The likelihood dot of the other factors (green = attack unlikely … red =
  // likely), on the option and on the read-only chip.
  const levelDot = (idx1: number) => {
    const color = isoFactorLevelColor(levels.length, idx1);
    return color ? (
      <Box
        data-testid={`iso-level-dot-${factorId}-${idx1}`}
        sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: color, flexShrink: 0 }}
      />
    ) : null;
  };
  // Per-level tooltip: surfaces the ISO 18045 attack-potential points that
  // used to clutter the option label (removed), plus the direction cue.
  const optionTooltip = (idx1: number) => {
    const lvl = levels[idx1 - 1];
    const pts = ISO_AP_POINTS_BY_FACTOR[factorId]?.[lvl] ?? 0;
    return t("tabs.risks.dialog.isoPointsPerLevel", {
      points: pts,
      defaultValue:
        `${pts} ISO 18045 attack-potential points ` +
        `(higher = more attacker effort → lower feasibility)`,
    });
  };
  return (
    <Paper
      key={`${factorId}-${mitigated}`}
      variant="outlined"
      sx={{ p: 1.25 }}
    >
      <Typography
        variant="caption"
        fontWeight="medium"
        display="block"
        sx={{ mb: 0.5 }}
      >
        {name}
      </Typography>
      {mitigated ? (
        <Select
          size="small"
          fullWidth
          value={value}
          onChange={(e) =>
            updateFactor(factorId, e.target.value as number, true)
          }
        >
          <MenuItem value={0}>
            <em>
              {t("tabs.risks.dialog.notRated", { defaultValue: "Not rated" })}
            </em>
          </MenuItem>
          {/* Least likely attack first (most attacker effort), as every
              other likelihood factor reads 1 = unlikely … N = likely
              (user 2026-10-31); the stored value stays the level index. */}
          {levels
            .map((_, i) => i + 1)
            .reverse()
            .map((idx1) => (
              <MenuItem key={idx1} value={idx1}>
                <Tooltip title={optionTooltip(idx1)} placement="right">
                  <Stack direction="row" spacing={1} alignItems="center" width="100%">
                    {levelDot(idx1)}
                    <span>{optionLabel(idx1)}</span>
                  </Stack>
                </Tooltip>
              </MenuItem>
            ))}
        </Select>
      ) : (
        <Tooltip
          title={value >= 1 ? optionTooltip(value) : ""}
          placement="right"
        >
          <Chip
            size="small"
            variant="outlined"
            sx={{ width: "100%", justifyContent: "flex-start", "& .MuiChip-icon": { ml: 0.75 } }}
            icon={value >= 1 ? (levelDot(value) ?? undefined) : undefined}
            label={
              value >= 1
                ? optionLabel(value)
                : t("tabs.risks.dialog.notRated", {
                    defaultValue: "Not rated",
                  })
            }
          />
        </Tooltip>
      )}
    </Paper>
  );
}

  // ── Attack-tree likelihood contribution (Phase 6) ─────────────────────────
  // attack_tree_likelihood is deliberately NOT in configuration.activeFactors
  // (design doc 5b: data-driven, not analyst-configured), so it never shows up
  // via the normal likelihoodFactors iteration above. It has to be rendered
  // separately, driven by whether a rating/provenance is actually present —
  // not by a discriminator. Before-mitigation only; the tree never feeds the
  // residual, so this never renders in the "after" pass.
export function renderTreeFactorRowOf(m: RiskDialogModel, mitigated: boolean) {
  const { t, configuration, local, isISO, updateFactor, treeFactorRating, treeFactorDef, treeAssessment } = m;
  if (!treeAssessment) return null;

  // After lens: the tree feeds the BEFORE likelihood, but the residual
  // (post-mitigation) feasibility is an analyst decision — a control that
  // makes the attack path harder lowers likelihood. Render an editable
  // residual band here so likelihood (not only impact) can be reduced.
  // Stored on mitigatedFactorRatings' attack_tree_likelihood.
  if (mitigated) {
    const residual = local.mitigatedFactorRatings.find(
      (r) => r.factorId === ATTACK_TREE_LIKELIHOOD_FACTOR_ID,
    );
    // ISO: no default — an unset residual level means no residual yet
    // (liveIsoRisk / computeIsoRisks), so "not set" must be visible and
    // selectable rather than showing the before level.
    const residualValue = isISO
      ? (residual?.value ?? 0)
      : (residual?.value ?? treeFactorRating?.value ?? 0);
    // Feasibility band → risk-scale value (Mapping B from the risk scale).
    const mapB = feasibilityLevelToRiskScale(configuration.scale);
    // Lowest feasibility first, as the likelihood factors read (user
    // 2026-10-31).
    // The likelihood colours of the factors (very low green … high red).
    const LIKELIHOOD_DOT = {
      "very-low": LIKELIHOOD_SCALES["4-level"].levels[0].color,
      low: LIKELIHOOD_SCALES["4-level"].levels[1].color,
      medium: LIKELIHOOD_SCALES["4-level"].levels[2].color,
      high: LIKELIHOOD_SCALES["4-level"].levels[3].color,
    };
    const residualOptions: Array<{ value: number; label: string; color?: string }> = [
      {
        value: mapB["very-low"],
        color: LIKELIHOOD_DOT["very-low"],
        label: t("tabs.risks.dialog.feasibility.veryLow", {
          defaultValue: "Very low",
        }),
      },
      {
        value: mapB.low,
        color: LIKELIHOOD_DOT.low,
        label: t("tabs.risks.dialog.feasibility.low", {
          defaultValue: "Low",
        }),
      },
      {
        value: mapB.medium,
        color: LIKELIHOOD_DOT.medium,
        label: t("tabs.risks.dialog.feasibility.medium", {
          defaultValue: "Medium",
        }),
      },
      {
        value: mapB.high,
        color: LIKELIHOOD_DOT.high,
        label: t("tabs.risks.dialog.feasibility.high", {
          defaultValue: "High",
        }),
      },
    ];
    // A 3-level scale maps very low and low onto the same value — one
    // option per value, labels joined ("Very low / Low").
    for (let i = residualOptions.length - 1; i > 0; i--) {
      const same = residualOptions.findIndex((o) => o.value === residualOptions[i].value);
      if (same < i) {
        residualOptions[same] = {
          ...residualOptions[same],
          label: `${residualOptions[same].label} / ${residualOptions[i].label}`,
        };
        residualOptions.splice(i, 1);
      }
    }
    if (isISO) {
      residualOptions.unshift({
        value: 0,
        label: t("tabs.risks.dialog.residualNotSet", {
          defaultValue: "Not set",
        }),
      });
    }
    // Keep the current value selectable even if it is outside the standard
    // bands (e.g. 0 after an "eliminate" treatment, or a custom scale).
    if (!residualOptions.some((o) => o.value === residualValue)) {
      residualOptions.unshift({
        value: residualValue,
        label: t("tabs.risks.dialog.feasibility.custom", {
          value: residualValue,
          defaultValue: `Level ${residualValue}`,
        }),
      });
    }
    return (
      <Paper
        key="attack-tree-likelihood-residual"
        variant="outlined"
        sx={{ p: 1.5, borderColor: "info.main", borderStyle: "dashed" }}
      >
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <Typography
            variant="body2"
            fontWeight="medium"
            sx={{ flexGrow: 1 }}
          >
            {t(
              `risks.factors.${ATTACK_TREE_LIKELIHOOD_FACTOR_ID}.shortName`,
              {
                defaultValue: t(
                  `risks.factors.${ATTACK_TREE_LIKELIHOOD_FACTOR_ID}.name`,
                  {
                    defaultValue:
                      treeFactorDef?.name ?? "Attack Tree Likelihood",
                  },
                ),
              },
            )}
          </Typography>
          <Tooltip
            title={t("tabs.risks.dialog.residualLikelihoodTooltip", {
              defaultValue:
                "Residual feasibility once the mitigation is in place. A control that makes the attack path harder lowers likelihood — set the level it drops to.",
            })}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ cursor: "help" }}
            >
              ⓘ
            </Typography>
          </Tooltip>
        </Stack>
        <Select
          value={residualValue}
          onChange={(e) =>
            updateFactor(
              ATTACK_TREE_LIKELIHOOD_FACTOR_ID,
              e.target.value as number,
              true,
            )
          }
          size="small"
          fullWidth
        >
          {residualOptions.map((o) => (
            <MenuItem key={o.value} value={o.value}>
              <Stack direction="row" spacing={1} alignItems="center" width="100%">
                {o.color && (
                  <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: o.color, flexShrink: 0 }} />
                )}
                <span>{isISO && o.value === 0 ? o.label : `${o.label} (${o.value})`}</span>
              </Stack>
            </MenuItem>
          ))}
        </Select>
      </Paper>
    );
  }

  const provenanceTooltip = t(
    "tabs.risks.dialog.treeFactorProvenanceTooltip",
    {
      treeId: treeAssessment.treeId,
      pathKey: treeAssessment.pathKey,
      raw: treeAssessment.likelihoodComponent,
      defaultValue:
        `From Attack Tree ${treeAssessment.treeId}, path ${treeAssessment.pathKey} ` +
        `(raw likelihood component ${treeAssessment.likelihoodComponent}). ` +
        `Edited at the source (Attack Tree tab), not here.`,
    },
  );

  // "factor" mode — an active rating exists, averages in with the OWASP
  // factors like any other likelihood factor. Read-only: no Select, no
  // reset — the value lives at the source.
  if (treeFactorRating && treeFactorDef) {
    return (
      <Paper
        key="attack-tree-likelihood"
        variant="outlined"
        sx={{ p: 1.5, borderColor: "info.main", borderStyle: "dashed" }}
      >
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <Typography
            variant="body2"
            fontWeight="medium"
            sx={{ flexGrow: 1 }}
          >
            {t(`risks.factors.${treeFactorDef.id}.shortName`, {
              defaultValue: t(`risks.factors.${treeFactorDef.id}.name`, {
                defaultValue: treeFactorDef.name,
              }),
            })}
          </Typography>
          <Tooltip title={provenanceTooltip}>
            <Chip
              label={t("tabs.risks.dialog.treeFactorBadge", {
                defaultValue: "Attack Tree",
              })}
              size="small"
              sx={{
                height: 18,
                fontSize: 10,
                bgcolor: "info.50",
                color: "info.main",
                border: "1px solid",
                borderColor: "info.200",
              }}
            />
          </Tooltip>
        </Stack>
        <Chip
          label={`${treeFactorRating.value} — ${t(
            "tabs.risks.dialog.treeFactorReadOnly",
            { defaultValue: "read-only, edit at source" },
          )}`}
          size="small"
          variant="outlined"
          sx={{ width: "100%", justifyContent: "flex-start" }}
        />
      </Paper>
    );
  }

  // "advisory" mode — no active factor was written; shown for reference
  // only, never enters calculateRiskValues.
  return (
    <Paper
      key="attack-tree-likelihood-advisory"
      variant="outlined"
      sx={{ p: 1.5, borderStyle: "dotted", borderColor: "text.disabled" }}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ flexGrow: 1 }}
        >
          {t("tabs.risks.dialog.treeAdvisoryLabel", {
            defaultValue: "Attack Tree (advisory)",
          })}
        </Typography>
        <Tooltip title={provenanceTooltip}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ cursor: "help" }}
          >
            ⓘ
          </Typography>
        </Tooltip>
      </Stack>
      <Typography variant="caption" color="text.secondary">
        {t("tabs.risks.dialog.treeAdvisoryHint", {
          defaultValue:
            "Not included in the calculation — shown for reference only.",
        })}
      </Typography>
    </Paper>
  );
}
