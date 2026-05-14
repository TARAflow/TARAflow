// ==================== STRATEGY INDICATOR ====================
// Displays the active threat generation strategy and the reason it was chosen.
// Shown in the Threat Tab so analysts understand how threats were derived.
//
// Strategy selection logic (mirrors strategy-factory.ts):
//   assetCoverage === 1.0 → RelationStrategy  (STRIDE from Asset CIANAAA)
//   assetCoverage > 0 || hasTags → HybridStrategy  (STRIDE modulated by element props)
//   else → ClassicStrategy  (generic STRIDE per element type)
//   strategyOverride set → manual override shown as secondary label

import React from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Box, Chip, Typography, Tooltip } from "@mui/material";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import GridOnOutlinedIcon from "@mui/icons-material/GridOnOutlined";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import type { ThreatProjectData } from "../../models/threat-types";
import type { StrategyType } from "../../models/strategy-types";
import {
  detectStrategy,
  computeAssetCoverage,
} from "../../services/strategies/strategy-factory";

// ==================== PROPS ====================

interface StrategyIndicatorProps {
  project: ThreatProjectData;
}

// ==================== STRATEGY CONFIG ====================

interface StrategyConfig {
  icon: React.ReactElement;
  color: string;
  bgColor: string;
  labelKey: string;
  defaultLabel: string;
}

const STRATEGY_CONFIG: Record<StrategyType, StrategyConfig> = {
  RelationStrategy: {
    icon: <AccountTreeOutlinedIcon sx={{ fontSize: 14 }} />,
    color: "#1d4ed8",
    bgColor: "#dbeafe",
    labelKey: "tabs.threats.strategy.relation",
    defaultLabel: "RelationStrategy",
  },
  HybridStrategy: {
    icon: <TuneOutlinedIcon sx={{ fontSize: 14 }} />,
    color: "#92400e",
    bgColor: "#fef3c7",
    labelKey: "tabs.threats.strategy.hybrid",
    defaultLabel: "HybridStrategy",
  },
  ClassicStrategy: {
    icon: <GridOnOutlinedIcon sx={{ fontSize: 14 }} />,
    color: "#374151",
    bgColor: "#f3f4f6",
    labelKey: "tabs.threats.strategy.classic",
    defaultLabel: "ClassicStrategy",
  },
};

// ==================== REASON BUILDER ====================

function buildReason(
  strategyType: StrategyType,
  project: ThreatProjectData,
  t: TFunction,
): string {
  const isOverride = !!project.threats?.configuration?.strategyOverride;
  const coverage = computeAssetCoverage(project);
  const coveragePct = Math.round(coverage * 100);
  const elementCount = project.dfdElements?.length ?? 0;
  const withAssets = Math.round(coverage * elementCount);
  const hasTags = !!(project.info?.tags);

  if (isOverride) {
    return t("tabs.threats.strategy.reasonOverride", {
      defaultValue: "Manual override — auto-detection bypassed",
    });
  }

  switch (strategyType) {
    case "RelationStrategy":
      return t("tabs.threats.strategy.reasonRelation", {
        defaultValue:
          "All {{count}} elements have linked assets with CIANAAA ratings → STRIDE derived from security goals",
        count: elementCount,
      });
    case "HybridStrategy": {
      const parts: string[] = [];
      if (coverage > 0) {
        parts.push(
          t("tabs.threats.strategy.reasonHybridAssets", {
            defaultValue: "{{covered}}/{{total}} elements with assets ({{pct}}%)",
            covered: withAssets,
            total: elementCount,
            pct: coveragePct,
          }),
        );
      }
      if (hasTags) {
        parts.push(
          t("tabs.threats.strategy.reasonHybridTags", {
            defaultValue: "project tags set",
          }),
        );
      }
      return parts.join(" · ");
    }
    case "ClassicStrategy":
      return t("tabs.threats.strategy.reasonClassic", {
        defaultValue:
          "No assets linked, no project tags → generic STRIDE per element type",
      });
  }
}

// ==================== COMPONENT ====================

export const StrategyIndicator: React.FC<StrategyIndicatorProps> = ({
  project,
}) => {
  const { t } = useTranslation();

  const strategyType = detectStrategy(project);
  const config = STRATEGY_CONFIG[strategyType];
  const isOverride = !!project.threats?.configuration?.strategyOverride;
  const reason = buildReason(strategyType, project, t);

  const label = t(config.labelKey, { defaultValue: config.defaultLabel });

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
      {/* Strategy chip */}
      <Tooltip
        title={t("tabs.threats.strategy.tooltip", {
          defaultValue: "Active threat generation strategy",
        })}
        placement="top"
      >
        <Chip
          icon={config.icon}
          label={label}
          size="small"
          sx={{
            height: 22,
            fontSize: "0.7rem",
            fontWeight: 600,
            color: config.color,
            bgcolor: config.bgColor,
            border: "1px solid",
            borderColor: config.color + "40",
            "& .MuiChip-icon": { color: config.color },
          }}
        />
      </Tooltip>

      {/* Override badge */}
      {isOverride && (
        <Tooltip
          title={t("tabs.threats.strategy.overrideTooltip", {
            defaultValue: "Strategy was set manually — auto-detection bypassed",
          })}
          placement="top"
        >
          <Chip
            icon={<BuildOutlinedIcon sx={{ fontSize: 12 }} />}
            label={t("tabs.threats.strategy.override", {
              defaultValue: "Override",
            })}
            size="small"
            sx={{
              height: 20,
              fontSize: "0.65rem",
              color: "#6b21a8",
              bgcolor: "#f3e8ff",
              border: "1px solid #c084fc40",
              "& .MuiChip-icon": { color: "#6b21a8" },
            }}
          />
        </Tooltip>
      )}

      {/* Reason text */}
      <Typography
        variant="caption"
        sx={{ color: "text.secondary", fontSize: "0.7rem" }}
      >
        {reason}
      </Typography>
    </Box>
  );
};