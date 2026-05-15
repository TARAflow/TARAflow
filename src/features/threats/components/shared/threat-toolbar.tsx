// ==================== THREAT TOOLBAR ====================
// Complete toolbar for threat management with all features
// Based on original ThreatsTab toolbar

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  IconButton,
  Tooltip,
  ToggleButtonGroup,
  ToggleButton,
  CircularProgress,
  Divider,
  Chip,
} from "@mui/material";
import {
  Settings as SettingsIcon,
  AutoAwesome as GenerateIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Warning as WarningIcon,
  Download as ExportIcon,
  Upload as ImportIcon,
  DeleteSweep as DeleteAllIcon,
  GridView as PerElementIcon,
  AccountTree as PerInteractionIcon,
  Sync as SyncIcon,
  Search as SearchIcon,
} from "@mui/icons-material";
import type { StrideMethod, ThreatSyncStatus } from "../../models/threat-types";

// ==================== TYPES ====================

export interface ThreatValidation {
  stats: {
    total: number;
    reviewed: number;
  };
}

export interface ThreatToolbarProps {
  isGenerating: boolean;
  isSyncing: boolean;
  validation: ThreatValidation | null;
  activeMethod: StrideMethod;
  hasThreats: boolean;
  hasDFD: boolean;
  syncStatus: ThreatSyncStatus | null;
  showDFDPreview: boolean;
  showFilters: boolean;
  showStrategyIndicator: boolean;
  forceClassicMode: boolean;
  onToggleDFDPreview: () => void;
  onToggleFilters: () => void;
  onToggleStrategyIndicator: () => void;
  onMethodChange: (
    event: React.MouseEvent<HTMLElement>,
    method: StrideMethod | null,
  ) => void;
  onGenerate: () => void;
  onSync: () => void;
  onDeleteAll: () => void;
  onOpenConfig: () => void;
  onExport: () => void;
  onImport: () => void;
}

// ==================== COMPONENT ====================

export const ThreatToolbar = React.memo<ThreatToolbarProps>(
  ({
    isGenerating,
    isSyncing,
    validation,
    activeMethod,
    hasThreats,
    hasDFD,
    syncStatus,
    showDFDPreview,
    showFilters,
    showStrategyIndicator,
    forceClassicMode,
    onToggleDFDPreview,
    onToggleFilters,
    onToggleStrategyIndicator,
    onMethodChange,
    onGenerate,
    onSync,
    onDeleteAll,
    onOpenConfig,
    onExport,
    onImport,
  }) => {
    const { t } = useTranslation();
    const needsSync = syncStatus && !syncStatus.inSync;
    const reviewed = validation?.stats.reviewed ?? 0;
    const total = validation?.stats.total ?? 0;

    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 2,
          py: 1,
          borderBottom: "1px solid",
          borderColor: "divider",
          backgroundColor: "background.paper",
          flexWrap: "wrap",
        }}
      >
        {/* Toggle DFD Preview */}
        <Tooltip
          title={
            showDFDPreview
              ? t("common.hideDFD", { defaultValue: "Hide DFD Preview" })
              : t("common.showDFD", { defaultValue: "Show DFD Preview" })
          }
        >
          <IconButton onClick={onToggleDFDPreview} size="small">
            {showDFDPreview ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem />

        {/* STRIDE Method Toggle */}
        <ToggleButtonGroup
          value={activeMethod}
          exclusive
          onChange={onMethodChange}
          size="small"
        >
          <ToggleButton value="per-element">
            <Tooltip
              title={t("tabs.threats.perElement", {
                defaultValue: "STRIDE per Element",
              })}
            >
              <PerElementIcon fontSize="small" />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="per-interaction">
            <Tooltip
              title={t("tabs.threats.perInteraction", {
                defaultValue: "STRIDE per Interaction",
              })}
            >
              <PerInteractionIcon fontSize="small" />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>

        {/* Classic Mode indicator */}
        {forceClassicMode && (
          <Chip
            label={t("tabs.threats.toolbar.classicMode", {
              defaultValue: "Classic Mode",
            })}
            size="small"
            color="warning"
            variant="outlined"
          />
        )}

        <Divider orientation="vertical" flexItem />

        {/* Generate Threats */}
        <Tooltip
          title={t("tabs.threats.generate", {
            defaultValue: "Generate Threats",
          })}
        >
          <span>
            <IconButton
              onClick={onGenerate}
              size="small"
              color="primary"
              disabled={!hasDFD || isGenerating}
            >
              {isGenerating ? <CircularProgress size={20} /> : <GenerateIcon />}
            </IconButton>
          </span>
        </Tooltip>

        {/* Sync Threats */}
        <Tooltip
          title={
            needsSync
              ? t("tabs.threats.sync.action")
              : t("tabs.threats.sync.status.synced")
          }
        >
          <span>
            <IconButton
              onClick={onSync}
              size="small"
              color={needsSync ? "warning" : "default"}
              disabled={!hasDFD || !needsSync || isSyncing}
            >
              {isSyncing ? <CircularProgress size={20} /> : <SyncIcon />}
            </IconButton>
          </span>
        </Tooltip>

        {/* Configuration */}
        <Tooltip
          title={t("tabs.threats.configuration", {
            defaultValue: "Configuration",
          })}
        >
          <IconButton onClick={onOpenConfig} size="small">
            <SettingsIcon />
          </IconButton>
        </Tooltip>

        {/* Export */}
        <Tooltip title={t("common.export", { defaultValue: "Export" })}>
          <span>
            <IconButton onClick={onExport} size="small" disabled={!hasThreats}>
              <ExportIcon />
            </IconButton>
          </span>
        </Tooltip>

        {/* Import */}
        <Tooltip title={t("common.import", { defaultValue: "Import" })}>
          <IconButton onClick={onImport} size="small">
            <ImportIcon />
          </IconButton>
        </Tooltip>

        {/* Filters Toggle */}
        <Tooltip
          title={
            showFilters
              ? t("common.hideFilters", { defaultValue: "Hide Filters" })
              : t("common.showFilters", { defaultValue: "Show Filters" })
          }
        >
          <IconButton
            onClick={onToggleFilters}
            size="small"
            color={showFilters ? "primary" : "default"}
          >
            <SearchIcon />
          </IconButton>
        </Tooltip>

        {/* Strategy Indicator Toggle */}
        <Tooltip
          title={
            showStrategyIndicator
              ? t("tabs.threats.toolbar.hideStrategy", {
                  defaultValue: "Hide Strategy Indicator",
                })
              : t("tabs.threats.toolbar.showStrategy", {
                  defaultValue: "Show Strategy Indicator",
                })
          }
        >
          <IconButton
            onClick={onToggleStrategyIndicator}
            size="small"
            color={showStrategyIndicator ? "primary" : "default"}
          >
            <PerElementIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        {/* Delete All */}
        <Tooltip
          title={t("tabs.threats.deleteAll", {
            defaultValue: "Delete All Threats",
          })}
        >
          <span>
            <IconButton
              onClick={onDeleteAll}
              size="small"
              disabled={!hasThreats}
              color="error"
            >
              <DeleteAllIcon />
            </IconButton>
          </span>
        </Tooltip>

        <Box sx={{ flexGrow: 1 }} />

        {/* Active method — read-only indicator */}
        <Chip
          icon={
            activeMethod === "per-element" ? (
              <PerElementIcon sx={{ fontSize: 14 }} />
            ) : (
              <PerInteractionIcon sx={{ fontSize: 14 }} />
            )
          }
          label={
            activeMethod === "per-element"
              ? t("tabs.threats.perElement", { defaultValue: "Per-Element" })
              : t("tabs.threats.perInteraction", {
                  defaultValue: "Per-Interaction",
                })
          }
          size="small"
          variant="outlined"
          sx={{ fontSize: "0.7rem" }}
        />

        <Divider orientation="vertical" flexItem />

        {/* Sync Status Badge */}
        {needsSync && (
          <Chip
            icon={<WarningIcon />}
            label={t("tabs.threats.sync.status.outOfSync")}
            size="small"
            color="warning"
            variant="outlined"
          />
        )}

        {/* Reviewed progress */}
        {total > 0 && (
          <Chip
            label={t("tabs.threats.reviewedCount", {
              reviewed,
              total,
              defaultValue: `${reviewed} / ${total} reviewed`,
            })}
            size="small"
            color={reviewed === total ? "success" : "default"}
            variant="outlined"
          />
        )}
      </Box>
    );
  },
);

ThreatToolbar.displayName = "ThreatToolbar";