// ==================== THREAT TOOLBAR ====================
// Complete toolbar for threat management with all features
// Based on original ThreatsTab toolbar

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Button,
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
  SkipNext as NextIcon,
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
  isComplete: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    total: number;
    completed: number;
    incomplete: number;
  };
}

export interface ThreatToolbarProps {
  isDirty: boolean;
  isGenerating: boolean;
  isSyncing: boolean;
  validation: ThreatValidation | null;
  activeMethod: StrideMethod;
  threatCount: number;
  hasThreats: boolean;
  hasDFD: boolean;
  syncStatus: ThreatSyncStatus | null;
  showDFDPreview: boolean;
  showFilters: boolean;
  onToggleDFDPreview: () => void;
  onToggleFilters: () => void;
  onMethodChange: (
    event: React.MouseEvent<HTMLElement>,
    method: StrideMethod | null
  ) => void;
  onGenerate: () => void;
  onSync: () => void;
  onDeleteAll: () => void;
  onOpenConfig: () => void;
  onExport: () => void;
  onImport: () => void;
  onProceed: () => void;
}

// ==================== COMPONENT ====================

export const ThreatToolbar = React.memo<ThreatToolbarProps>(
  ({
    isDirty,
    isGenerating,
    isSyncing,
    validation,
    activeMethod,
    threatCount,
    hasThreats,
    hasDFD,
    syncStatus,
    showDFDPreview,
    showFilters,
    onToggleDFDPreview,
    onToggleFilters,
    onMethodChange,
    onGenerate,
    onSync,
    onDeleteAll,
    onOpenConfig,
    onExport,
    onImport,
    onProceed,
  }) => {
    const { t } = useTranslation();

    const getStatusColor = () => {
      if (!validation) return "default";
      if (validation.isComplete) return "success";
      if (validation.errors.length > 0) return "error";
      return "warning";
    };

    const getStatusText = () => {
      if (!validation)
        return t("status.inProgress", { defaultValue: "In Progress" });
      if (validation.isComplete)
        return t("status.complete", { defaultValue: "Complete" });
      if (validation.errors.length > 0)
        return `${validation.errors.length} ${t("common.errors", {
          defaultValue: "Errors",
        })}`;
      return t("status.inProgress", { defaultValue: "In Progress" });
    };

    const needsSync = syncStatus && !syncStatus.inSync;

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
          aria-label="STRIDE method"
        >
          <ToggleButton value="per-element" aria-label="per element">
            <Tooltip
              title={t("tabs.threats.perElement", {
                defaultValue: "STRIDE per Element",
              })}
            >
              <PerElementIcon fontSize="small" />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="per-interaction" aria-label="per interaction">
            <Tooltip
              title={t("tabs.threats.perInteraction", {
                defaultValue: "STRIDE per Interaction",
              })}
            >
              <PerInteractionIcon fontSize="small" />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>

        <Chip
          label={
            activeMethod === "per-element" ? "Per-Element" : "Per-Interaction"
          }
          size="small"
          variant="outlined"
        />

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

        {/* Status */}
        <Chip
          label={`${threatCount} ${t("tabs.threats.threats", {
            defaultValue: "Threats",
          })}`}
          size="small"
          variant="outlined"
        />

        <Chip label={getStatusText()} size="small" color={getStatusColor()} />

        {isDirty && (
          <Chip
            label={t("common.unsaved", { defaultValue: "Unsaved" })}
            size="small"
            color="warning"
            variant="outlined"
          />
        )}

        <Divider orientation="vertical" flexItem />

        {/* Proceed */}
        <Button
          endIcon={<NextIcon />}
          onClick={onProceed}
          disabled={!validation?.isComplete}
          size="small"
          variant="outlined"
          color="success"
        >
          {t("common.continue", { defaultValue: "Continue" })}
        </Button>
      </Box>
    );
  }
);

ThreatToolbar.displayName = "ThreatToolbar";