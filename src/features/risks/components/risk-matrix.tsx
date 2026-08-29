// ==================== RISK MATRIX ====================
// Visual risk display:
// - Complex method: 2D Matrix showing Impact vs Likelihood (top 3 shown)
// - Simple method: Vertical risk levels Low → Critical (top 8 shown)
// - Sorted by: Highest risk value first, then alphabetically by T-ID
// - Click "+X" to expand and see all risks in sidebar
// - Won't risks: Displayed with reduced opacity and strikethrough
// Toggle between Before/After Mitigation view
// Clickable cells to filter/highlight risks
// Color-coded based on risk levels

import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "i18next";
import {
  Box,
  Typography,
  Tooltip,
  Paper,
  Stack,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  Divider,
} from "@mui/material";

import { Risk } from "../models/risk-assessment-types";
import {
  RISK_SCALES,
  generateRiskMatrix,
  RiskMatrixCell,
} from "../models/risk-scale-types";
import { RiskConfiguration } from "../models/risk-config-types";
import {
  calculateRiskValues,
  getRiskColor,
  getRiskLabel,
} from "../services/risk-calculation-service";

// ==================== TYPES ====================

interface RiskMatrixProps {
  risks: Risk[];
  configuration: RiskConfiguration;
  onRiskClick?: (risk: Risk) => void;
  assetDataRef?: {
    assets: Array<{
      id: string;
      aggregatedImpact?: string;
      physicalImpact?: string;
    }>;
  };
}

type ViewMode = "before" | "after";

// ==================== IMPACT LEVEL ====================
// Shared with element-threat-table — same type, same colors

type ImpactLevel = "CRITICAL" | "HIGH+" | "HIGH" | "MED+" | "MED" | "LOW";

const IMPACT_ORDER: ImpactLevel[] = ["CRITICAL", "HIGH+", "HIGH", "MED+", "MED", "LOW"];

const IMPACT_CHIP_COLORS: Record<ImpactLevel, { bg: string; border: string; color: string }> = {
  "CRITICAL": { bg: "#dc262618", border: "#dc2626", color: "#dc2626" },
  "HIGH+":    { bg: "#ea580c18", border: "#ea580c", color: "#ea580c" },
  "HIGH":     { bg: "#f9731618", border: "#f97316", color: "#f97316" },
  "MED+":     { bg: "#ca8a0418", border: "#ca8a04", color: "#ca8a04" },
  "MED":      { bg: "#eab30818", border: "#d97706", color: "#d97706" },
  "LOW":      { bg: "#16a34a18", border: "#16a34a", color: "#16a34a" },
};

/**
 * Derive worst asset impact for a single Risk.
 * Mirrors countImpacts() logic from element-threat-table.tsx.
 */
function getWorstImpactForRisk(
  risk: Risk,
  assetDataRef?: { assets: Array<{ id: string; aggregatedImpact?: string; physicalImpact?: string }> },
): ImpactLevel | undefined {
  if (!assetDataRef) return undefined;
  const linked = (risk.linkedAssetIds ?? [])
    .map((id) => assetDataRef.assets.find((a) => a.id === id))
    .filter(Boolean) as Array<{ id: string; aggregatedImpact?: string; physicalImpact?: string }>;
  if (!linked.length) return undefined;

  const hasSafety = linked.some(
    (a) => a.physicalImpact === "fatality" || a.physicalImpact === "irreversible_injury",
  );
  const worstBusiness = linked.reduce<ImpactLevel | undefined>((acc, a) => {
    const imp = a.aggregatedImpact as ImpactLevel | undefined;
    if (!imp) return acc;
    if (!acc) return imp;
    return IMPACT_ORDER.indexOf(imp) < IMPACT_ORDER.indexOf(acc) ? imp : acc;
  }, undefined);

  if (hasSafety && worstBusiness === "CRITICAL") return "CRITICAL";
  if (hasSafety) return "HIGH";
  return worstBusiness;
}

// ==================== COMPONENT ====================

export const RiskMatrix = React.memo<RiskMatrixProps>(
  ({ risks, configuration, onRiskClick, assetDataRef }) => {
    const { t } = useTranslation();
    const [selectedCell, setSelectedCell] = useState<{
      impact: number;
      likelihood: number;
    } | null>(null);

    // Toggle between Before/After view (default: After if available)
    const [viewMode, setViewMode] = useState<ViewMode>("after");

    const scale = RISK_SCALES[configuration.scale];
    const matrixSize = scale.levels.length;

    // Helper: Get additional styles for Won't risks
    const getWontStyles = (risk: Risk) => {
      if (risk.moscowPriority === "wont") {
        return {
          opacity: 0.6,
          textDecoration: "line-through",
          border: "2px dashed rgba(255,255,255,0.5)",
        };
      }
      return {};
    };

    // ==================== GENERATE MATRIX (for complex) ====================

    const matrix = useMemo(
      () => generateRiskMatrix(configuration.scale),
      [configuration.scale],
    );

    // ==================== MAP RISKS TO CELLS (for complex) ====================

    const risksByCell = useMemo(() => {
      const map = new Map<string, Risk[]>();

      for (const risk of risks) {
        const ratings =
          viewMode === "before"
            ? risk.factorRatings
            : risk.mitigatedFactorRatings;

        const { impact, likelihood } = calculateRiskValues(
          ratings,
          configuration,
        );

        const clampedImpact = Math.max(
          1,
          Math.min(matrixSize, Math.round(impact)),
        );

        const clampedLikelihood = Math.max(
          1,
          Math.min(matrixSize, Math.round(likelihood)),
        );

        const key = `${clampedImpact}-${clampedLikelihood}`;

        if (!map.has(key)) {
          map.set(key, []);
        }

        map.get(key)!.push(risk);
      }

      return map;
    }, [risks, matrixSize, viewMode, configuration]);

    // ==================== HELPER: Sort risks by priority ====================
    const unratedRisks = useMemo(() => {
      return risks.filter((r) => {
        if (viewMode === "before") {
          return r.calculatedRiskBeforeMitigation === 0;
        }
        return (
          r.calculatedRiskBeforeMitigation === 0 &&
          r.calculatedRiskAfterMitigation === 0
        );
      });
    }, [risks, viewMode]);

    // Count risks with After mitigation rated
    const risksWithAfterRated = useMemo(() => {
      return risks.filter((r) => r.calculatedRiskAfterMitigation > 0).length;
    }, [risks]);

    // ==================== HANDLERS ====================

    const handleCellClick = (impact: number, likelihood: number) => {
      const key = `${impact}-${likelihood}`;
      const cellRisks = risksByCell.get(key) || [];

      if (cellRisks.length === 1 && onRiskClick) {
        onRiskClick(cellRisks[0]);
      } else if (cellRisks.length > 0) {
        setSelectedCell(
          selectedCell?.impact === impact &&
            selectedCell?.likelihood === likelihood
            ? null
            : { impact, likelihood },
        );
      }
    };

    const handleViewModeChange = (
      _event: React.MouseEvent<HTMLElement>,
      newMode: ViewMode | null,
    ) => {
      if (newMode !== null) {
        setViewMode(newMode);
        setSelectedCell(null); // Reset selection on mode change
      }
    };

    // ==================== HELPER: Sort risks by priority ====================

    /**
     * Sort risks by risk value (highest first), then alphabetically by threatId
     */
    const sortRisksByPriority = (risksToSort: Risk[]): Risk[] => {
      return [...risksToSort].sort((a, b) => {
        // Get the display risk value based on view mode
        const getDisplayValue = (risk: Risk): number => {
          if (viewMode === "before") {
            return risk.calculatedRiskBeforeMitigation;
          }
          return risk.calculatedRiskAfterMitigation > 0
            ? risk.calculatedRiskAfterMitigation
            : risk.calculatedRiskBeforeMitigation;
        };

        const valueA = getDisplayValue(a);
        const valueB = getDisplayValue(b);

        // Higher risk value first
        if (valueB !== valueA) {
          return valueB - valueA;
        }

        // If same value, sort alphabetically by threatId
        return a.threatDisplayId.localeCompare(b.threatDisplayId, undefined, {
          numeric: true,
        });
      });
    };

    // ==================== HELPER: Risk chip tooltip content ====================

    const getRiskChipTooltip = (risk: Risk) => {
      const before = risk.calculatedRiskBeforeMitigation;
      const beforeColor = getRiskColor(
        before,
        configuration.scale,
        configuration.roundingMethod,
        configuration.severityThresholds,
      );
      const after = risk.calculatedRiskAfterMitigation;
      const afterColor = getRiskColor(
        after,
        configuration.scale,
        configuration.roundingMethod,
        configuration.severityThresholds,
      );
      const beforeLabel =
        before > 0
          ? getRiskLabel(
              before,
              configuration.scale,
              configuration.roundingMethod,
            )
          : undefined;

      const afterLabel =
        after > 0
          ? getRiskLabel(
              after,
              configuration.scale,
              configuration.roundingMethod,
            )
          : undefined;

      const impact = getWorstImpactForRisk(risk, assetDataRef);
      const impactColors = impact ? IMPACT_CHIP_COLORS[impact] : null;
      const mitigations =
        risk.selectedMitigations ?? risk.proposedMitigations ?? [];
      const improved = after > 0 && before > 0 && after < before;

      return (
        <Box sx={{ maxWidth: 260 }}>
          {/* Header: threatId + impact badge */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 1,
            }}
          >
            <Typography variant="body2" fontWeight="bold">
              {risk.threatDisplayId} ({risk.strideCategory})
            </Typography>
            {impactColors && impact && (
              <Box
                sx={{
                  flexShrink: 0,
                  px: 0.75,
                  py: 0.1,
                  borderRadius: 0.5,
                  border: `1px solid ${impactColors.border}`,
                  backgroundColor: impactColors.bg,
                  color: impactColors.color,
                  fontSize: "0.65rem",
                  fontWeight: "bold",
                  whiteSpace: "nowrap",
                }}
              >
                {impact}
              </Box>
            )}
          </Box>

          {/* Threat description */}
          {risk.threatDescription && (
            <Typography
              variant="caption"
              display="block"
              sx={{ mt: 0.5, opacity: 0.9 }}
            >
              {risk.threatDescription.length > 100
                ? `${risk.threatDescription.slice(0, 100)}…`
                : risk.threatDescription}
            </Typography>
          )}

          <Divider sx={{ borderColor: "rgba(255,255,255,0.15)" }} />

          {/* Before / After */}
          <Box
            sx={{
              mt: 0.75,
              display: "flex",
              gap: 1.5,
              alignItems: "flex-end",
            }}
          >
            {/* BEFORE */}
            <Box>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                Before
              </Typography>

              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                {beforeColor && beforeLabel && (
                  <Box
                    sx={{
                      px: 0.5,
                      borderRadius: 0.5,
                      backgroundColor: beforeColor,
                      color: "#fff",
                      fontSize: "0.6rem",
                      fontWeight: "bold",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {beforeLabel}
                  </Box>
                )}

                <Typography variant="caption" fontWeight="bold">
                  {before > 0 ? before.toFixed(1) : "—"}
                </Typography>
              </Box>
            </Box>

            {/* ARROW (optional but nice) */}
            {before > 0 && after > 0 && (
              <Typography variant="caption" sx={{ opacity: 0.6 }}>
                →
              </Typography>
            )}

            {/* AFTER */}
            <Box>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                After
              </Typography>

              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                {afterColor && afterLabel && (
                  <Box
                    sx={{
                      px: 0.5,
                      borderRadius: 0.5,
                      backgroundColor: afterColor,
                      color: "#fff",
                      fontSize: "0.6rem",
                      fontWeight: "bold",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {afterLabel}
                  </Box>
                )}

                <Typography
                  variant="caption"
                  fontWeight="bold"
                  sx={{
                    color: improved ? "#16a34a" : undefined,
                  }}
                >
                  {after > 0 ? after.toFixed(1) : "—"}
                </Typography>
              </Box>
            </Box>

            {/* WON'T FIX */}
            {risk.moscowPriority === "wont" && (
              <Typography
                variant="caption"
                sx={{
                  opacity: 0.7,
                  fontStyle: "italic",
                  alignSelf: "flex-end",
                }}
              >
                Won't Fix
              </Typography>
            )}
          </Box>

          {/* Mitigations */}
          {mitigations.length > 0 && (
            <Box
              sx={{
                mt: 0.75,
                borderTop: "1px solid rgba(255,255,255,0.15)",
                pt: 0.5,
              }}
            >
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                Mitigations
              </Typography>
              {mitigations.slice(0, 4).map((m: any) => {
                const id = m.id ?? m;
                const text = id
                  ? i18n.t(`${id}.mitigation`, {
                      ns: "mitigations",
                      defaultValue: id,
                    })
                  : (m.notes ?? "");
                return (
                  <Typography
                    key={id || text}
                    variant="caption"
                    display="block"
                    sx={{ opacity: 0.85 }}
                  >
                    · {text.length > 60 ? `${text.slice(0, 60)}…` : text}
                  </Typography>
                );
              })}
              {mitigations.length > 4 && (
                <Typography variant="caption" sx={{ opacity: 0.6 }}>
                  +{mitigations.length - 4} more
                </Typography>
              )}
            </Box>
          )}
        </Box>
      );
    };

    const renderCell = (cell: RiskMatrixCell) => {
      const key = `${cell.impact}-${cell.likelihood}`;
      const cellRisks = risksByCell.get(key) || [];
      const count = cellRisks.length;
      const isSelected =
        selectedCell?.impact === cell.impact &&
        selectedCell?.likelihood === cell.likelihood;

      // Sort by priority — show all, overflow hidden clips the rest
      const sortedRisks = sortRisksByPriority(cellRisks);

      return (
        <Tooltip
          key={key}
          title={
            <Typography variant="caption">
              {cell.label} — {count}{" "}
              {t("tabs.risks.risks", { defaultValue: "risk(s)" })}
            </Typography>
          }
          placement="top"
          arrow
          disableHoverListener={count === 0}
        >
          <Box
            onClick={() => handleCellClick(cell.impact, cell.likelihood)}
            sx={{
              position: "relative",
              width: "100%",
              height: "100%",
              minHeight: 0,
              backgroundColor: cell.color,
              opacity: count > 0 ? 1 : 0.4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              cursor: count > 0 ? "pointer" : "default",
              border: isSelected ? "3px solid" : "1px solid",
              borderColor: isSelected ? "primary.main" : "rgba(0,0,0,0.1)",
              transition: "all 0.2s",
              "&:hover":
                count > 0 ? { opacity: 0.9, transform: "scale(1.02)" } : {},
              p: 0.5,
            }}
          >
            {count > 0 && (
              <>
                {/* All chips — overflow hidden clips what doesn't fit */}
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "row",
                    flexWrap: "wrap",
                    alignContent: "flex-start",
                    gap: 0.25,
                    width: "100%",
                    height: "100%",
                    overflow: "hidden",
                    p: 0.25,
                    pb: 2, // leave room for count badge
                  }}
                >
                  {sortedRisks.map((risk) => (
                    <Tooltip
                      key={risk.id}
                      title={getRiskChipTooltip(risk)}
                      placement="top"
                      arrow
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          backgroundColor: "rgba(255,255,255,0.9)",
                          color: cell.color,
                          px: 0.5,
                          borderRadius: 0.5,
                          fontWeight: "bold",
                          fontSize: "0.65rem",
                          lineHeight: 1.2,
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                          cursor: "default",
                          ...(risk.moscowPriority === "wont" && {
                            opacity: 0.6,
                            textDecoration: "line-through",
                            border: "1px dashed rgba(0,0,0,0.3)",
                          }),
                        }}
                      >
                        {risk.threatDisplayId}
                      </Typography>
                    </Tooltip>
                  ))}
                </Box>

                {/* Absolute count badge — always visible */}
                <Box
                  sx={{
                    position: "absolute",
                    bottom: 2,
                    right: 2,
                    backgroundColor: "rgba(255,255,255,0.9)",
                    color: cell.color,
                    borderRadius: 0.5,
                    px: 0.5,
                    fontSize: "0.6rem",
                    fontWeight: "bold",
                    lineHeight: 1.4,
                    pointerEvents: "none",
                  }}
                >
                  {count}
                </Box>
              </>
            )}
          </Box>
        </Tooltip>
      );
    };

    // ==================== SELECTED RISKS ====================

    const selectedCellRisks: Risk[] = selectedCell
      ? sortRisksByPriority(
          risksByCell.get(
            `${selectedCell.impact}-${selectedCell.likelihood}`,
          ) || [],
        )
      : [];

    // ==================== RENDER COMPLEX VIEW (2D Matrix) ====================

    const renderComplexView = () => (
      <Box
        sx={{
          display: "flex",
          height: "100%",
          p: 2,
          gap: 2,
        }}
      >
        {/* Matrix Grid */}
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            flexGrow: 1,
            minHeight: 0, // Allow flex child to shrink below content size
            minWidth: 0,
          }}
        >
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mb: 1 }}
          >
            <Typography variant="subtitle2" align="center">
              {t("tabs.risks.matrix.title", { defaultValue: "Risk Matrix" })}
            </Typography>
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={handleViewModeChange}
              size="small"
            >
              <ToggleButton
                value="before"
                sx={{ px: 1.5, py: 0.5, fontSize: "0.75rem" }}
              >
                {t("tabs.risks.matrix.before", { defaultValue: "Before" })}
              </ToggleButton>
              <ToggleButton
                value="after"
                sx={{ px: 1.5, py: 0.5, fontSize: "0.75rem" }}
              >
                {t("tabs.risks.matrix.after", { defaultValue: "After" })}
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>

          <Box
            sx={{
              display: "flex",
              flexGrow: 1,
              minHeight: 0,
              minWidth: 0,
            }}
          >
            {/* Y-Axis Label */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                writingMode: "vertical-rl",
                transform: "rotate(180deg)",
                pr: 1,
              }}
            >
              <Typography variant="caption" color="text.secondary">
                {t("tabs.risks.matrix.impact", { defaultValue: "Impact" })} →
              </Typography>
            </Box>

            {/* Single grid: column 1 = Y-axis labels, columns 2..N+1 = matrix cells.
                All rows share the same 1fr height — perfect alignment guaranteed. */}
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: `24px repeat(${matrixSize}, 1fr)`,
                gridTemplateRows: `repeat(${matrixSize}, 1fr)`,
                gap: 0.5,
                flexGrow: 1,
                minHeight: 0,
                minWidth: 0,
              }}
            >
              {/* Y-axis labels — column 1, one per row (highest impact first) */}
              {scale.levels
                .slice()
                .reverse()
                .map((level) => (
                  <Typography
                    key={level.value}
                    variant="caption"
                    sx={{
                      gridColumn: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      pr: 0.5,
                    }}
                  >
                    {level.value}
                  </Typography>
                ))}

              {/* Matrix cells — columns 2..N+1, rows 1..N */}
              {matrix.flat().map((cell) => (
                <Box
                  key={`${cell.impact}-${cell.likelihood}`}
                  sx={{
                    gridColumn: cell.likelihood + 1,
                    gridRow: matrixSize - cell.impact + 1,
                  }}
                >
                  {renderCell(cell)}
                </Box>
              ))}
            </Box>
          </Box>

          {/* X-Axis Values */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-around",
              pl: 5,
              pt: 0.5,
            }}
          >
            {scale.levels.map((level) => (
              <Typography key={level.value} variant="caption">
                {level.value}
              </Typography>
            ))}
          </Box>

          {/* X-Axis Label */}
          <Typography variant="caption" align="center" color="text.secondary">
            {t("tabs.risks.matrix.likelihood", { defaultValue: "Likelihood" })}{" "}
            →
          </Typography>

          {/* Unrated Section */}
          {unratedRisks.length > 0 && (
            <Box
              sx={{
                mt: 1.5,
                pt: 1.5,
                borderTop: "1px dashed",
                borderColor: "divider",
                minHeight: 60,
              }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                gutterBottom
                display="block"
              >
                {t("tabs.risks.matrix.unratedRisks", {
                  defaultValue: "Unrated Risks",
                })}
              </Typography>
              <Box
                sx={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 0.5,
                  mt: 0.5,
                }}
              >
                {unratedRisks.map((risk) => {
                  const impact = getWorstImpactForRisk(risk, assetDataRef);
                  const colors = impact ? IMPACT_CHIP_COLORS[impact] : null;
                  return (
                    <Tooltip
                      key={risk.id}
                      title={getRiskChipTooltip(risk)}
                      placement="top"
                      arrow
                    >
                      <Chip
                        label={risk.threatDisplayId}
                        size="small"
                        variant="outlined"
                        onClick={() => onRiskClick?.(risk)}
                        sx={{
                          cursor: "pointer",
                          ...(colors
                            ? {
                                backgroundColor: colors.bg,
                                borderColor: colors.border,
                                color: colors.color,
                                fontWeight: "bold",
                              }
                            : {}),
                          ...getWontStyles(risk),
                        }}
                      />
                    </Tooltip>
                  );
                })}
              </Box>
            </Box>
          )}
        </Box>

        {/* Legend & Selected Risks */}
        <Paper
          variant="outlined"
          sx={{
            width: 200,
            p: 1.5,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {/* Legend */}
          <Box>
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
              sx={{ mb: 0.5 }}
            >
              {t("tabs.risks.matrix.legend", { defaultValue: "Legend" })}
            </Typography>
            <Stack spacing={0.5}>
              {scale.levels.map((level) => (
                <Stack
                  key={level.value}
                  direction="row"
                  spacing={1}
                  alignItems="center"
                >
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      backgroundColor: level.color,
                      borderRadius: 1,
                    }}
                  />
                  <Typography variant="caption">{level.label}</Typography>
                </Stack>
              ))}
            </Stack>
          </Box>

          {/* Statistics */}
          <Box>
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
              sx={{ mb: 0.5 }}
            >
              {t("tabs.risks.matrix.statistics", {
                defaultValue: "Statistics",
              })}
            </Typography>
            <Stack spacing={0.25}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="caption">
                  {t("tabs.risks.matrix.total", { defaultValue: "Total" })}
                </Typography>
                <Typography variant="caption" fontWeight="bold">
                  {risks.length}
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="caption" color="text.secondary">
                  {t("tabs.risks.matrix.unrated", { defaultValue: "Unrated" })}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {
                    risks.filter((r) => r.calculatedRiskBeforeMitigation === 0)
                      .length
                  }
                </Typography>
              </Stack>
            </Stack>
          </Box>

          {/* Selected Cell Risks */}
          {selectedCellRisks.length > 0 && (
            <Box sx={{ flexGrow: 1, overflow: "auto" }}>
              <Typography
                variant="caption"
                color="text.secondary"
                display="block"
                sx={{ mb: 0.5 }}
              >
                {t("tabs.risks.matrix.selectedRisks", {
                  defaultValue: "Selected Risks",
                })}
              </Typography>
              <Stack spacing={0.5}>
                {selectedCellRisks.map((risk) => (
                  <Tooltip
                    key={risk.id}
                    title={getRiskChipTooltip(risk)}
                    placement="left"
                    arrow
                  >
                    <Chip
                      label={`${risk.threatDisplayId} (${risk.strideCategory})`}
                      size="small"
                      onClick={() => onRiskClick?.(risk)}
                      sx={{ cursor: "pointer", ...getWontStyles(risk) }}
                    />
                  </Tooltip>
                ))}
              </Stack>
            </Box>
          )}
        </Paper>
      </Box>
    );

    // ==================== RENDER ====================

    return renderComplexView();
  },
);

RiskMatrix.displayName = "RiskMatrix";

export default RiskMatrix;