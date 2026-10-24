// ==================== ISO/SAE 21434 RISK MATRIX ====================
// Conformance plan 3a-2 (decision 20 E3/E4): under iso-21434 the register's
// heat map is the 4 × 4 matrix of Annex H.8 — impact level × attack
// feasibility, each cell carrying its risk value 1–5 — instead of the
// `I × L` grid. Risks sit in the cell of their isoRisk (before) or of their
// residual (after mitigation).

import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Chip,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import type { FeasibilityBandLevel } from "shared";
import type { Risk } from "../models/risk-assessment-types";
import {
  ISO_FEASIBILITY_LEVELS,
  ISO_IMPACT_LEVELS,
  isoRiskValue,
  type IsoImpactLevel,
} from "../models/iso-risk-matrix";
import {
  ISO_FEASIBILITY_FALLBACK,
  ISO_IMPACT_FALLBACK,
  isoFeasibilityI18nKey,
  isoImpactI18nKey,
  isoRiskValueColor,
  isoRiskValueFallback,
  isoRiskValueI18nKey,
} from "../models/iso-risk-display";

type ViewMode = "before" | "after";

interface IsoRiskMatrixProps {
  risks: Risk[];
  onRiskClick?: (risk: Risk) => void;
  headerControls?: React.ReactNode;
}

const MAX_CHIPS = 4;

/** Cell of a risk in the chosen view; undefined = not rated in that view. */
export function isoCellOf(
  risk: Risk,
  view: ViewMode,
): { impact: IsoImpactLevel; feasibility: FeasibilityBandLevel; value: number } | undefined {
  const r = risk.isoRisk;
  if (!r) return undefined;
  if (view === "before") return { impact: r.impact, feasibility: r.feasibility, value: r.value };
  return r.residual
    ? { impact: r.impact, feasibility: r.residual.feasibility, value: r.residual.value }
    : undefined;
}

export const IsoRiskMatrix = React.memo<IsoRiskMatrixProps>(
  ({ risks, onRiskClick, headerControls }) => {
    const { t } = useTranslation();
    const [view, setView] = useState<ViewMode>("before");

    const { byCell, unrated } = useMemo(() => {
      const map = new Map<string, Risk[]>();
      const none: Risk[] = [];
      for (const risk of risks) {
        const cell = isoCellOf(risk, view);
        if (!cell) {
          none.push(risk);
          continue;
        }
        const key = `${cell.impact}|${cell.feasibility}`;
        map.set(key, [...(map.get(key) ?? []), risk]);
      }
      for (const list of map.values()) {
        list.sort((a, b) => a.threatDisplayId.localeCompare(b.threatDisplayId, undefined, { numeric: true }));
      }
      return { byCell: map, unrated: none };
    }, [risks, view]);

    const impactLabel = (l: IsoImpactLevel) =>
      t(isoImpactI18nKey(l), { defaultValue: ISO_IMPACT_FALLBACK[l] });
    const feasLabel = (l: FeasibilityBandLevel) =>
      t(isoFeasibilityI18nKey(l), { defaultValue: ISO_FEASIBILITY_FALLBACK[l] });

    return (
      <Box sx={{ p: 2, height: "100%", display: "flex", flexDirection: "column" }} data-testid="iso-risk-matrix">
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="subtitle2">
            {t("tabs.risks.iso.matrixTitle", {
              defaultValue: "Risk matrix (ISO/SAE 21434, Annex H.8)",
            })}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            {headerControls}
            <ToggleButtonGroup
              value={view}
              exclusive
              size="small"
              onChange={(_, v: ViewMode | null) => v && setView(v)}
            >
              <ToggleButton value="before" sx={{ px: 1.5, py: 0.5, fontSize: "0.75rem" }}>
                {t("tabs.risks.matrix.before", { defaultValue: "Before" })}
              </ToggleButton>
              <ToggleButton value="after" sx={{ px: 1.5, py: 0.5, fontSize: "0.75rem" }}>
                {t("tabs.risks.matrix.after", { defaultValue: "After" })}
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        </Stack>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: `90px repeat(${ISO_FEASIBILITY_LEVELS.length}, 1fr)`,
            gap: 0.5,
            flexGrow: 1,
          }}
        >
          {[...ISO_IMPACT_LEVELS].reverse().map((impact) => (
            <React.Fragment key={impact}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", pr: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {impactLabel(impact)}
                </Typography>
              </Box>
              {ISO_FEASIBILITY_LEVELS.map((feasibility) => {
                const value = isoRiskValue(impact, feasibility);
                const cellRisks = byCell.get(`${impact}|${feasibility}`) ?? [];
                return (
                  <Box
                    key={feasibility}
                    data-testid={`iso-cell-${impact}-${feasibility}`}
                    sx={{
                      border: `2px solid ${isoRiskValueColor(value)}`,
                      bgcolor: `${isoRiskValueColor(value)}22`,
                      borderRadius: 1,
                      p: 0.5,
                      minHeight: 56,
                      display: "flex",
                      flexDirection: "column",
                      gap: 0.5,
                    }}
                  >
                    <Typography variant="caption" fontWeight="bold" sx={{ color: isoRiskValueColor(value) }}>
                      {value} {t(isoRiskValueI18nKey(value), { defaultValue: isoRiskValueFallback(value) })}
                    </Typography>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                      {cellRisks.slice(0, MAX_CHIPS).map((risk) => (
                        <Tooltip key={risk.id} title={risk.threatDescription} arrow>
                          <Chip
                            label={risk.threatDisplayId}
                            size="small"
                            onClick={onRiskClick ? () => onRiskClick(risk) : undefined}
                            sx={{
                              height: 20,
                              fontSize: "0.65rem",
                              opacity: risk.moscowPriority === "wont" ? 0.5 : 1,
                            }}
                          />
                        </Tooltip>
                      ))}
                      {cellRisks.length > MAX_CHIPS && (
                        <Tooltip
                          title={cellRisks.slice(MAX_CHIPS).map((r) => r.threatDisplayId).join(", ")}
                          arrow
                        >
                          <Chip label={`+${cellRisks.length - MAX_CHIPS}`} size="small" sx={{ height: 20, fontSize: "0.65rem" }} />
                        </Tooltip>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </React.Fragment>
          ))}
          <Box />
          {ISO_FEASIBILITY_LEVELS.map((f) => (
            <Typography key={f} variant="caption" color="text.secondary" align="center">
              {feasLabel(f)}
            </Typography>
          ))}
        </Box>
        <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            {t("tabs.risks.iso.axes", {
              defaultValue: "Rows: impact (15.5) · columns: attack feasibility (15.7)",
            })}
          </Typography>
          {unrated.length > 0 && (
            <Tooltip title={unrated.map((r) => r.threatDisplayId).join(", ")} arrow>
              <Typography variant="caption" color="text.secondary" data-testid="iso-unrated">
                {t("tabs.risks.iso.unrated", {
                  count: unrated.length,
                  defaultValue: `${unrated.length} without risk value`,
                })}
              </Typography>
            </Tooltip>
          )}
        </Stack>
      </Box>
    );
  },
);
