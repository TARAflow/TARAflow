// ==================== RISK MATRIX ====================
// Visual risk matrix showing Impact vs Likelihood
// Clickable cells to filter/highlight risks
// Color-coded based on risk levels

import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Typography,
  Tooltip,
  Paper,
  Badge,
  Stack,
  Chip,
} from "@mui/material";

import {
  Risk,
  RiskConfiguration,
  RiskScaleType,
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

interface CellRisks {
  cell: RiskMatrixCell;
  risks: Risk[];
}

// ==================== COMPONENT ====================

export const RiskMatrix: React.FC<RiskMatrixProps> = ({
  risks,
  configuration,
  onRiskClick,
}) => {
  const { t, i18n } = useTranslation();
  const isGerman = i18n.language === "de";

  const [selectedCell, setSelectedCell] = useState<{
    impact: number;
    likelihood: number;
  } | null>(null);

  const scale = RISK_SCALES[configuration.scale];
  const matrixSize = scale.levels.length;

  // ==================== GENERATE MATRIX ====================

  const matrix = useMemo(
    () => generateRiskMatrix(configuration.scale),
    [configuration.scale]
  );

  // ==================== MAP RISKS TO CELLS ====================

  const risksByCell = useMemo(() => {
    const map = new Map<string, Risk[]>();

    for (const risk of risks) {
      // Round to nearest integer for cell placement
      const impact = Math.round(
        configuration.method === "simple"
          ? risk.calculatedRiskBeforeMitigation
          : risk.calculatedImpact
      );
      const likelihood = Math.round(
        configuration.method === "simple"
          ? risk.calculatedRiskBeforeMitigation
          : risk.calculatedLikelihood
      );

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
  }, [risks, configuration.method, matrixSize]);

  // ==================== HANDLERS ====================

  const handleCellClick = (impact: number, likelihood: number) => {
    const key = `${impact}-${likelihood}`;
    const cellRisks = risksByCell.get(key) || [];

    if (cellRisks.length === 1 && onRiskClick) {
      onRiskClick(cellRisks[0]);
    } else if (cellRisks.length > 0) {
      setSelectedCell(
        selectedCell?.impact === impact && selectedCell?.likelihood === likelihood
          ? null
          : { impact, likelihood }
      );
    }
  };

  // ==================== RENDER CELL ====================

  const renderCell = (cell: RiskMatrixCell) => {
    const key = `${cell.impact}-${cell.likelihood}`;
    const cellRisks = risksByCell.get(key) || [];
    const count = cellRisks.length;
    const isSelected =
      selectedCell?.impact === cell.impact &&
      selectedCell?.likelihood === cell.likelihood;

    // Get T-IDs for display
    const threatIds = cellRisks.map((r) => r.threatId);
    const displayIds = threatIds.slice(0, 3); // Show max 3 T-IDs
    const hasMore = threatIds.length > 3;

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
              {t("tabs.risks.matrix.likelihood", { defaultValue: "Likelihood" })}:{" "}
              {cell.likelihood}
            </Typography>
            {count > 0 && (
              <>
                <br />
                <Typography variant="caption" fontWeight="bold">
                  {count} {t("tabs.risks.risks", { defaultValue: "risk(s)" })}
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  {cellRisks.map((r) => (
                    <Typography key={r.id} variant="caption" display="block">
                      • {r.threatId}: {r.strideCategory} - {r.threatDescription?.substring(0, 50)}...
                    </Typography>
                  ))}
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
            "&:hover": count > 0 ? { opacity: 0.9, transform: "scale(1.02)" } : {},
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
              {displayIds.map((tid) => (
                <Typography
                  key={tid}
                  variant="caption"
                  sx={{
                    backgroundColor: "rgba(255,255,255,0.9)",
                    color: cell.color,
                    px: 0.5,
                    borderRadius: 0.5,
                    fontWeight: "bold",
                    fontSize: "0.65rem",
                    lineHeight: 1.2,
                  }}
                >
                  {tid}
                </Typography>
              ))}
              {hasMore && (
                <Typography
                  variant="caption"
                  sx={{
                    backgroundColor: "rgba(255,255,255,0.9)",
                    color: cell.color,
                    px: 0.5,
                    borderRadius: 0.5,
                    fontWeight: "bold",
                    fontSize: "0.6rem",
                  }}
                >
                  +{threatIds.length - 3}
                </Typography>
              )}
            </Box>
          )}
        </Box>
      </Tooltip>
    );
  };

  // ==================== SELECTED CELL RISKS ====================

  const selectedCellRisks = selectedCell
    ? risksByCell.get(`${selectedCell.impact}-${selectedCell.likelihood}`) || []
    : [];

  // ==================== RENDER ====================

  return (
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
              {configuration.method === "simple"
                ? t("tabs.risks.matrix.risk", { defaultValue: "Risk Level" })
                : t("tabs.risks.matrix.impact", { defaultValue: "Impact" })}
              {" →"}
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
          {configuration.method === "simple"
            ? t("tabs.risks.matrix.risk", { defaultValue: "Risk Level" })
            : t("tabs.risks.matrix.likelihood", { defaultValue: "Likelihood" })}
          {" →"}
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
          <Typography variant="caption" color="text.secondary" gutterBottom>
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
          <Typography variant="caption" color="text.secondary" gutterBottom>
            {t("tabs.risks.matrix.statistics", { defaultValue: "Statistics" })}
          </Typography>
          <Typography variant="body2">
            {t("tabs.risks.matrix.totalRisks", {
              count: risks.length,
              defaultValue: `Total: ${risks.length} risks`,
            })}
          </Typography>
          <Typography variant="body2">
            {t("tabs.risks.matrix.unrated", {
              count: risks.filter((r) => r.calculatedRiskBeforeMitigation === 0)
                .length,
              defaultValue: `Unrated: ${
                risks.filter((r) => r.calculatedRiskBeforeMitigation === 0).length
              }`,
            })}
          </Typography>
        </Box>

        {/* Selected Cell Risks */}
        {selectedCellRisks.length > 0 && (
          <Box sx={{ flexGrow: 1, overflow: "auto" }}>
            <Typography variant="caption" color="text.secondary" gutterBottom>
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
                  sx={{ cursor: "pointer" }}
                />
              ))}
            </Stack>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default RiskMatrix;