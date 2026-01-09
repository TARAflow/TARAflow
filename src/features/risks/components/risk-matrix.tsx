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
import {
  Box,
  Typography,
  Tooltip,
  Paper,
  Stack,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";

import {
  Risk,
  RiskConfiguration,
  RISK_SCALES,
  generateRiskMatrix,
  RiskMatrixCell,
} from "../models/risk-types";

// ==================== TYPES ====================

interface RiskMatrixProps {
  risks: Risk[];
  configuration: RiskConfiguration;
  onRiskClick?: (risk: Risk) => void;
}

type ViewMode = "before" | "after";

// ==================== COMPONENT ====================

export const RiskMatrix = React.memo<RiskMatrixProps>(
  ({ risks, configuration, onRiskClick }) => {
    const { t, i18n } = useTranslation();
    const isGerman = i18n.language === "de";
    const isSimple = configuration.method === "simple";

    const [selectedCell, setSelectedCell] = useState<{
      impact: number;
      likelihood: number;
    } | null>(null);

    const [selectedLevel, setSelectedLevel] = useState<number | null>(null);

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
      [configuration.scale]
    );

    // ==================== MAP RISKS TO CELLS (for complex) ====================

    const risksByCell = useMemo(() => {
      const map = new Map<string, Risk[]>();

      for (const risk of risks) {
        const impact = Math.round(risk.calculatedImpact);
        const likelihood = Math.round(risk.calculatedLikelihood);

        // Clamp to valid range
        const clampedImpact = Math.max(1, Math.min(matrixSize, impact));
        const clampedLikelihood = Math.max(1, Math.min(matrixSize, likelihood));

        const key = `${clampedImpact}-${clampedLikelihood}`;
        if (!map.has(key)) {
          map.set(key, []);
        }
        map.get(key)!.push(risk);
      }

      return map;
    }, [risks, matrixSize]);

    // ==================== MAP RISKS TO LEVELS (for simple) ====================

    const risksByLevel = useMemo(() => {
      const map = new Map<number, Risk[]>();

      // Initialize all levels
      for (const level of scale.levels) {
        map.set(level.value, []);
      }

      for (const risk of risks) {
        // Get the risk value to display based on view mode
        // - "before": Always show calculatedRiskBeforeMitigation
        // - "after": Show After if > 0, otherwise show Before
        let riskValue: number;
        if (viewMode === "before") {
          riskValue = risk.calculatedRiskBeforeMitigation;
        } else {
          riskValue =
            risk.calculatedRiskAfterMitigation > 0
              ? risk.calculatedRiskAfterMitigation
              : risk.calculatedRiskBeforeMitigation;
        }

        // Skip unrated (0)
        if (riskValue <= 0) continue;

        // Use configured rounding method to match getRiskColor/getRiskLabel logic
        const roundingMethod = configuration.roundingMethod || "round";
        let levelValue: number;
        if (roundingMethod === "ceil") {
          // Conservative: 2.01-3.0 = High
          levelValue = Math.min(Math.max(Math.ceil(riskValue), 1), matrixSize);
        } else {
          // Standard: 2.5-3.49 = High
          levelValue = Math.min(Math.max(Math.round(riskValue), 1), matrixSize);
        }

        if (!map.has(levelValue)) {
          map.set(levelValue, []);
        }
        map.get(levelValue)!.push(risk);
      }

      return map;
    }, [
      risks,
      matrixSize,
      scale.levels,
      viewMode,
      configuration.roundingMethod,
    ]);

    // Unrated risks for simple view
    const unratedRisks = useMemo(() => {
      return risks.filter((r) => {
        if (viewMode === "before") {
          return r.calculatedRiskBeforeMitigation === 0;
        }
        // "after" mode: unrated if both Before and After are 0
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
            : { impact, likelihood }
        );
      }
    };

    const handleLevelClick = (level: number) => {
      const levelRisks = risksByLevel.get(level) || [];

      if (levelRisks.length === 1 && onRiskClick) {
        onRiskClick(levelRisks[0]);
      } else if (levelRisks.length > 0) {
        setSelectedLevel(selectedLevel === level ? null : level);
      }
    };

    const handleViewModeChange = (
      _event: React.MouseEvent<HTMLElement>,
      newMode: ViewMode | null
    ) => {
      if (newMode !== null) {
        setViewMode(newMode);
        setSelectedLevel(null); // Reset selection on mode change
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
        return a.threatId.localeCompare(b.threatId, undefined, {
          numeric: true,
        });
      });
    };

    // ==================== RENDER CELL (for complex matrix) ====================

    const renderCell = (cell: RiskMatrixCell) => {
      const key = `${cell.impact}-${cell.likelihood}`;
      const cellRisks = risksByCell.get(key) || [];
      const count = cellRisks.length;
      const isSelected =
        selectedCell?.impact === cell.impact &&
        selectedCell?.likelihood === cell.likelihood;

      // Sort by priority and get top 3
      const sortedRisks = sortRisksByPriority(cellRisks);
      const displayRisks = sortedRisks.slice(0, 3);
      const hasMore = count > 3;

      return (
        <Tooltip
          key={key}
          title={
            <Box>
              <Typography variant="body2" fontWeight="bold">
                {isGerman ? cell.labelDE : cell.label}
              </Typography>
              <Typography variant="caption">
                {t("tabs.risks.matrix.impact", { defaultValue: "Impact" })}:{" "}
                {cell.impact}
              </Typography>
              <br />
              <Typography variant="caption">
                {t("tabs.risks.matrix.likelihood", {
                  defaultValue: "Likelihood",
                })}
                : {cell.likelihood}
              </Typography>
              {count > 0 && (
                <>
                  <br />
                  <Typography variant="caption" fontWeight="bold">
                    {count} {t("tabs.risks.risks", { defaultValue: "risk(s)" })}
                  </Typography>
                  <Box sx={{ mt: 0.5 }}>
                    {sortedRisks.slice(0, 5).map((r) => (
                      <Typography key={r.id} variant="caption" display="block">
                        • {r.threatId}: {r.strideCategory} (
                        {r.calculatedRiskBeforeMitigation.toFixed(1)})
                      </Typography>
                    ))}
                    {count > 5 && (
                      <Typography variant="caption" display="block">
                        ... +{count - 5}{" "}
                        {t("tabs.risks.matrix.more", { defaultValue: "more" })}
                      </Typography>
                    )}
                  </Box>
                </>
              )}
            </Box>
          }
          placement="top"
          arrow
        >
          <Box
            onClick={() => handleCellClick(cell.impact, cell.likelihood)}
            sx={{
              width: "100%",
              height: "100%",
              minHeight: 50,
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
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 0.25,
                }}
              >
                {displayRisks.map((risk) => (
                  <Typography
                    key={risk.id}
                    variant="caption"
                    sx={{
                      backgroundColor: "rgba(255,255,255,0.9)",
                      color: cell.color,
                      px: 0.5,
                      borderRadius: 0.5,
                      fontWeight: "bold",
                      fontSize: "0.65rem",
                      lineHeight: 1.2,
                      ...(risk.moscowPriority === "wont" && {
                        opacity: 0.6,
                        textDecoration: "line-through",
                        border: "1px dashed rgba(0,0,0,0.3)",
                      }),
                    }}
                  >
                    {risk.threatId}
                  </Typography>
                ))}
                {hasMore && (
                  <Typography
                    variant="caption"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedCell({
                        impact: cell.impact,
                        likelihood: cell.likelihood,
                      });
                    }}
                    sx={{
                      backgroundColor: "rgba(255,255,255,0.9)",
                      color: cell.color,
                      px: 0.5,
                      borderRadius: 0.5,
                      fontWeight: "bold",
                      fontSize: "0.6rem",
                      cursor: "pointer",
                      "&:hover": {
                        backgroundColor: "white",
                        textDecoration: "underline",
                      },
                    }}
                  >
                    +{count - 3}
                  </Typography>
                )}
              </Box>
            )}
          </Box>
        </Tooltip>
      );
    };

    // ==================== RENDER LEVEL ROW (for simple view) ====================

    const renderLevelRow = (levelValue: number) => {
      const level = scale.levels.find((l) => l.value === levelValue);
      if (!level) return null;

      const levelRisks = risksByLevel.get(levelValue) || [];
      const count = levelRisks.length;
      const isSelected = selectedLevel === levelValue;

      // Sort by priority (highest risk value first, then alphabetically)
      const sortedRisks = sortRisksByPriority(levelRisks);
      const displayRisks = sortedRisks.slice(0, 8);
      const hasMore = count > 8;

      return (
        <Tooltip
          key={levelValue}
          title={
            count > 0 ? (
              <Box>
                <Typography variant="body2" fontWeight="bold">
                  {isGerman ? level.labelDE : level.label}
                </Typography>
                <Typography variant="caption" fontWeight="bold">
                  {count} {t("tabs.risks.risks", { defaultValue: "risk(s)" })}
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  {sortedRisks.slice(0, 5).map((r) => (
                    <Typography key={r.id} variant="caption" display="block">
                      • {r.threatId}: {r.strideCategory} (
                      {r.calculatedRiskBeforeMitigation.toFixed(1)} →{" "}
                      {r.calculatedRiskAfterMitigation > 0
                        ? r.calculatedRiskAfterMitigation.toFixed(1)
                        : "-"}
                      )
                    </Typography>
                  ))}
                  {count > 5 && (
                    <Typography variant="caption" display="block">
                      ... +{count - 5}{" "}
                      {t("tabs.risks.matrix.more", { defaultValue: "more" })}
                    </Typography>
                  )}
                </Box>
              </Box>
            ) : (
              <Typography variant="body2">
                {isGerman ? level.labelDE : level.label} -{" "}
                {t("tabs.risks.matrix.noRisks", { defaultValue: "No risks" })}
              </Typography>
            )
          }
          placement="right"
          arrow
        >
          <Box
            onClick={() => handleLevelClick(levelValue)}
            sx={{
              display: "flex",
              alignItems: "stretch",
              minHeight: 60,
              cursor: count > 0 ? "pointer" : "default",
              border: isSelected ? "3px solid" : "1px solid",
              borderColor: isSelected ? "primary.main" : "divider",
              borderRadius: 1,
              overflow: "hidden",
              transition: "all 0.2s",
              "&:hover":
                count > 0 ? { transform: "scale(1.01)", boxShadow: 2 } : {},
            }}
          >
            {/* Level Label */}
            <Box
              sx={{
                width: 100,
                backgroundColor: level.color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                p: 1,
              }}
            >
              <Typography
                variant="body2"
                fontWeight="bold"
                sx={{ color: "white", textAlign: "center" }}
              >
                {isGerman ? level.labelDE : level.label}
              </Typography>
            </Box>

            {/* Risks Container */}
            <Box
              sx={{
                flexGrow: 1,
                backgroundColor: count > 0 ? `${level.color}15` : "grey.50",
                display: "flex",
                alignItems: "center",
                p: 1,
                gap: 0.5,
                flexWrap: "wrap",
                opacity: count > 0 ? 1 : 0.5,
              }}
            >
              {count === 0 ? (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontStyle: "italic" }}
                >
                  {t("tabs.risks.matrix.noRisksAtLevel", {
                    defaultValue: "No risks at this level",
                  })}
                </Typography>
              ) : (
                <>
                  {displayRisks.map((risk) => (
                    <Chip
                      key={risk.id}
                      label={risk.threatId}
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRiskClick?.(risk);
                      }}
                      sx={{
                        backgroundColor: level.color,
                        color: "white",
                        fontWeight: "bold",
                        fontSize: "0.7rem",
                        height: 24,
                        cursor: "pointer",
                        "&:hover": {
                          backgroundColor: level.color,
                          opacity: 0.8,
                        },
                        ...getWontStyles(risk),
                      }}
                    />
                  ))}
                  {hasMore && (
                    <Chip
                      label={`+${count - 8}`}
                      size="small"
                      variant="outlined"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedLevel(levelValue);
                      }}
                      sx={{
                        borderColor: level.color,
                        color: level.color,
                        fontWeight: "bold",
                        fontSize: "0.7rem",
                        height: 24,
                        cursor: "pointer",
                        "&:hover": {
                          backgroundColor: `${level.color}20`,
                        },
                      }}
                    />
                  )}
                </>
              )}
            </Box>

            {/* Count Badge */}
            <Box
              sx={{
                width: 50,
                backgroundColor: count > 0 ? level.color : "grey.300",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Typography
                variant="h6"
                fontWeight="bold"
                sx={{ color: "white" }}
              >
                {count}
              </Typography>
            </Box>
          </Box>
        </Tooltip>
      );
    };

    // ==================== SELECTED RISKS ====================

    const selectedCellRisks = selectedCell
      ? sortRisksByPriority(
          risksByCell.get(
            `${selectedCell.impact}-${selectedCell.likelihood}`
          ) || []
        )
      : [];

    const selectedLevelRisks =
      selectedLevel !== null
        ? sortRisksByPriority(risksByLevel.get(selectedLevel) || [])
        : [];

    // ==================== RENDER SIMPLE VIEW ====================

    const renderSimpleView = () => (
      <Box
        sx={{
          display: "flex",
          height: "100%",
          p: 2,
          gap: 2,
        }}
      >
        {/* Vertical Level Bars */}
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            flexGrow: 1,
            gap: 1,
          }}
        >
          {/* Header with Title and Toggle */}
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mb: 1 }}
          >
            <Box>
              <Typography variant="subtitle2">
                {t("tabs.risks.matrix.riskLevels", {
                  defaultValue: "Risk Levels",
                })}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {viewMode === "before"
                  ? t("tabs.risks.matrix.showingBefore", {
                      defaultValue: "Before Mitigation",
                    })
                  : t("tabs.risks.matrix.showingAfter", {
                      defaultValue: "After Mitigation (where rated)",
                    })}
              </Typography>
            </Box>
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

          {/* Render levels from highest to lowest */}
          <Stack spacing={1} sx={{ flexGrow: 1 }}>
            {scale.levels
              .slice()
              .reverse()
              .map((level) => renderLevelRow(level.value))}
          </Stack>

          {/* Unrated Section */}
          {unratedRisks.length > 0 && (
            <Box
              sx={{
                mt: 2,
                pt: 2,
                borderTop: "1px dashed",
                borderColor: "divider",
              }}
            >
              <Typography variant="caption" color="text.secondary" gutterBottom>
                {t("tabs.risks.matrix.unratedRisks", {
                  defaultValue: "Unrated Risks",
                })}
              </Typography>
              <Box
                sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 0.5 }}
              >
                {unratedRisks.slice(0, 10).map((risk) => (
                  <Chip
                    key={risk.id}
                    label={risk.threatId}
                    size="small"
                    variant="outlined"
                    onClick={() => onRiskClick?.(risk)}
                    sx={{ cursor: "pointer", ...getWontStyles(risk) }}
                  />
                ))}
                {unratedRisks.length > 10 && (
                  <Chip
                    label={`+${unratedRisks.length - 10}`}
                    size="small"
                    variant="outlined"
                    color="default"
                  />
                )}
              </Box>
            </Box>
          )}
        </Box>

        {/* Legend & Statistics */}
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
            <Stack spacing={0.5}>
              {scale.levels
                .slice()
                .reverse()
                .map((level) => {
                  const count = risksByLevel.get(level.value)?.length || 0;
                  return (
                    <Stack
                      key={level.value}
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      justifyContent="space-between"
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box
                          sx={{
                            width: 12,
                            height: 12,
                            backgroundColor: level.color,
                            borderRadius: 0.5,
                          }}
                        />
                        <Typography variant="caption">
                          {isGerman ? level.labelDE : level.label}
                        </Typography>
                      </Stack>
                      <Typography variant="caption" fontWeight="bold">
                        {count}
                      </Typography>
                    </Stack>
                  );
                })}
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ pt: 1, borderTop: "1px solid", borderColor: "divider" }}
              >
                <Typography variant="caption" fontWeight="bold">
                  {t("tabs.risks.matrix.total", { defaultValue: "Total" })}
                </Typography>
                <Typography variant="caption" fontWeight="bold">
                  {risks.length}
                </Typography>
              </Stack>
              {unratedRisks.length > 0 && (
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <Typography variant="caption" color="text.secondary">
                    {t("tabs.risks.matrix.unrated", {
                      defaultValue: "Unrated",
                    })}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {unratedRisks.length}
                  </Typography>
                </Stack>
              )}
            </Stack>
          </Box>

          {/* Mitigation Progress */}
          <Box>
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
              sx={{ mb: 0.5 }}
            >
              {t("tabs.risks.matrix.mitigationProgress", {
                defaultValue: "Mitigation Progress",
              })}
            </Typography>
            <Typography variant="body2">
              {risksWithAfterRated} / {risks.length}{" "}
              {t("tabs.risks.matrix.rated", { defaultValue: "rated" })}
            </Typography>
          </Box>

          {/* Selected Level Risks */}
          {selectedLevelRisks.length > 0 && (
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
                {selectedLevelRisks.map((risk) => (
                  <Chip
                    key={risk.id}
                    label={`${risk.threatId} (${risk.strideCategory})`}
                    size="small"
                    onClick={() => onRiskClick?.(risk)}
                    sx={{ cursor: "pointer", ...getWontStyles(risk) }}
                  />
                ))}
              </Stack>
            </Box>
          )}
        </Paper>
      </Box>
    );

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
          }}
        >
          <Typography variant="subtitle2" align="center" gutterBottom>
            {t("tabs.risks.matrix.title", { defaultValue: "Risk Matrix" })}
          </Typography>

          <Box
            sx={{
              display: "flex",
              flexGrow: 1,
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

            {/* Y-Axis Values */}
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-around",
                pr: 0.5,
              }}
            >
              {scale.levels
                .slice()
                .reverse()
                .map((level) => (
                  <Typography
                    key={level.value}
                    variant="caption"
                    sx={{
                      height: `${100 / matrixSize}%`,
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    {level.value}
                  </Typography>
                ))}
            </Box>

            {/* Matrix Grid */}
            <Box
              sx={{
                display: "grid",
                gridTemplateRows: `repeat(${matrixSize}, 1fr)`,
                gridTemplateColumns: `repeat(${matrixSize}, 1fr)`,
                gap: 0.5,
                flexGrow: 1,
                aspectRatio: "1",
                maxHeight: 300,
              }}
            >
              {matrix.flat().map((cell) => renderCell(cell))}
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
                  <Typography variant="caption">
                    {isGerman ? level.labelDE : level.label}
                  </Typography>
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
                  <Chip
                    key={risk.id}
                    label={`${risk.threatId} (${risk.strideCategory})`}
                    size="small"
                    onClick={() => onRiskClick?.(risk)}
                    sx={{ cursor: "pointer", ...getWontStyles(risk) }}
                  />
                ))}
              </Stack>
            </Box>
          )}
        </Paper>
      </Box>
    );

    // ==================== RENDER ====================

    return isSimple ? renderSimpleView() : renderComplexView();
  }
);

RiskMatrix.displayName = "RiskMatrix";

export default RiskMatrix;