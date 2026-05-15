// ==================== STRATEGY INDICATOR ====================
// Shows which UnifiedStrategy modules were active for the last generation run.
// Toggleable from the Threat Toolbar.

import React from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Box, Chip, Stack, Tooltip, Typography } from "@mui/material";
import type {
  ThreatProjectData,
  ThreatConfiguration,
} from "../../models/threat-types";

interface StrategyIndicatorProps {
  project: ThreatProjectData;
}

function buildStatus(
  config: ThreatConfiguration | null | undefined,
  t: TFunction,
): {
  label: string;
  color: string;
  bg: string;
  reason: string;
} {
  if (config?.forceClassicMode) {
    return {
      label: t("tabs.threats.strategy.classicMode", {
        defaultValue: "Classic Mode",
      }),
      color: "#92400e",
      bg: "#fef3c7",
      reason: t("tabs.threats.strategy.reasonClassicForced", {
        defaultValue: "Forced — all STRIDE modulation disabled",
      }),
    };
  }

  const hasAssets = !!config;
  // Determine which modules could be active based on project data
  // (exact per-threat breakdown is in ThreatSource on each threat)
  return {
    label: t("tabs.threats.strategy.unified", {
      defaultValue: "UnifiedStrategy",
    }),
    color: "#1d4ed8",
    bg: "#dbeafe",
    reason: t("tabs.threats.strategy.reasonUnified", {
      defaultValue:
        "Additive pipeline — element properties + asset CIANAAA goals",
    }),
  };
}

export const StrategyIndicator: React.FC<StrategyIndicatorProps> = ({
  project,
}) => {
  const { t } = useTranslation();
  const config = project.threats?.configuration;
  const status = buildStatus(config, t);

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 2,
        py: 0.75,
        borderBottom: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      <Tooltip
        title={t("tabs.threats.strategy.tooltip", {
          defaultValue: "Active threat generation strategy",
        })}
        placement="top"
      >
        <Chip
          label={status.label}
          size="small"
          sx={{
            height: 22,
            fontSize: "0.7rem",
            fontWeight: 600,
            color: status.color,
            bgcolor: status.bg,
            border: "1px solid",
            borderColor: status.color + "40",
          }}
        />
      </Tooltip>
      <Typography
        variant="caption"
        sx={{ color: "text.secondary", fontSize: "0.7rem" }}
      >
        {status.reason}
      </Typography>
      <Typography
        variant="caption"
        sx={{ color: "text.secondary", fontSize: "0.7rem", ml: "auto" }}
      >
        {t("tabs.threats.strategy.sourceHint", {
          defaultValue: "Per-threat source visible in ID column badge",
        })}
      </Typography>
    </Box>
  );
};