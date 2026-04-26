// ==================== MITIGATION COVERAGE BADGE ====================
// Reusable badge shown under mitigation entries in Risk Dialog and Threat Dialog.
// Indicates whether the mitigation is already implemented in the DFD model.
//
// Location: src/features/threats/components/mitigation-coverage-badge.tsx

import React from "react";
import { useTranslation } from "react-i18next";
import { Box, Chip, Tooltip, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import HalfCircleIcon from "@mui/icons-material/Contrast";
import type { MitigationCoverage } from "../utils/mitigation-coverage";

// ==================== PROPS ====================

interface MitigationCoverageBadgeProps {
  coverage: MitigationCoverage | null | undefined;
}

// ==================== COMPONENT ====================

export const MitigationCoverageBadge: React.FC<MitigationCoverageBadgeProps> = ({
  coverage,
}) => {
  const { t } = useTranslation();

  // No coverage data = no DFD properties to check (physical/system-level mitigation)
  if (!coverage) return null;

  const coveredDetails = coverage.details.filter((d) => d.isCovered);
  const uncoveredDetails = coverage.details.filter((d) => !d.isCovered);

  if (coverage.fullyImplemented) {
    return (
      <Tooltip
        placement="top"
        title={
          <Box>
            <Typography variant="caption" fontWeight="bold">
              {t("mitigation.coverage.fullyImplemented", {
                defaultValue: "All properties already set in DFD model",
              })}
            </Typography>
            {coveredDetails.map((d) => (
              <Typography key={d.property} variant="caption" display="block">
                ✓ {d.property} = {String(d.currentValue)}
              </Typography>
            ))}
          </Box>
        }
      >
        <Chip
          icon={<CheckCircleIcon sx={{ fontSize: "0.75rem !important" }} />}
          label={t("mitigation.coverage.implemented", {
            defaultValue: "Already implemented",
          })}
          size="small"
          sx={{
            height: 18,
            fontSize: "0.6rem",
            bgcolor: "#dcfce7",
            color: "#16a34a",
            border: "1px solid #86efac",
            cursor: "help",
            "& .MuiChip-icon": { color: "#16a34a" },
          }}
        />
      </Tooltip>
    );
  }

  if (coverage.partiallyImplemented) {
    return (
      <Tooltip
        placement="top"
        title={
          <Box>
            <Typography variant="caption" fontWeight="bold">
              {t("mitigation.coverage.partiallyImplemented", {
                defaultValue: "Partially implemented in DFD model",
              })}
            </Typography>
            {coveredDetails.map((d) => (
              <Typography key={d.property} variant="caption" display="block">
                ✓ {d.property} = {String(d.currentValue)}
              </Typography>
            ))}
            {uncoveredDetails.map((d) => (
              <Typography key={d.property} variant="caption" display="block">
                ✗ {d.property} → expected {String(d.expectedValue)}
              </Typography>
            ))}
          </Box>
        }
      >
        <Chip
          icon={<HalfCircleIcon sx={{ fontSize: "0.75rem !important" }} />}
          label={t("mitigation.coverage.partial", {
            defaultValue: "Partially implemented",
          })}
          size="small"
          sx={{
            height: 18,
            fontSize: "0.6rem",
            bgcolor: "#fef9c3",
            color: "#a16207",
            border: "1px solid #fde047",
            cursor: "help",
            "& .MuiChip-icon": { color: "#a16207" },
          }}
        />
      </Tooltip>
    );
  }

  // Not implemented — show nothing (the mitigation checkbox already implies "not done")
  return null;
};

export default MitigationCoverageBadge;