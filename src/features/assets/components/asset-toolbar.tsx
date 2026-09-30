// ==================== ASSETS TOOLBAR ====================
// Toolbar for the Assets tab
// Extracted from assets-tab.tsx for consistency with other tab toolbars

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  IconButton,
  Tooltip,
  Divider,
  Chip,
} from "@mui/material";
import {
  Add as AddIcon,
  Settings as SettingsIcon,
  Sync as SyncIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Download as ExportIcon,
  Upload as ImportIcon,
} from "@mui/icons-material";

import type { AssetValidation } from "../models/asset-types";

// ==================== TYPES ====================

export interface AssetsToolbarProps {
  isDirty: boolean;
  validation: AssetValidation | null;
  assetCount: number;
  showDFDPreview: boolean;
  onToggleDFDPreview: () => void;
  onOpenConfig: () => void;
  onExport: () => void;
  onImport: () => void;
  onSyncFromDFD: () => void;
}

// ==================== COMPONENT ====================

export const AssetsToolbar = React.memo<AssetsToolbarProps>(
  ({
    isDirty,
    validation,
    assetCount,
    showDFDPreview,
    onToggleDFDPreview,
    onOpenConfig,
    onExport,
    onImport,
    onSyncFromDFD,
  }) => {
    const { t } = useTranslation();

    const getStatusColor = (): "default" | "success" | "error" | "warning" => {
      if (!validation) return "default";
      if (validation.isComplete) return "success";
      if (validation.errors.length > 0) return "error";
      return "warning";
    };

    const getStatusText = (): string => {
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

        {/* Sync from DFD */}
        <Tooltip
          title={t("tabs.assets.syncFromDFD", {
            defaultValue: "Sync from DFD",
          })}
        >
          <IconButton onClick={onSyncFromDFD} size="small">
            <SyncIcon />
          </IconButton>
        </Tooltip>

        {/* Configuration */}
        <Tooltip
          title={t("tabs.assets.configuration", {
            defaultValue: "Impact Configuration",
          })}
        >
          <IconButton onClick={onOpenConfig} size="small">
            <SettingsIcon />
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem />

        {/* Export */}
        <Tooltip
          title={t("tabs.assets.exportAssets", {
            defaultValue: "Export Assets",
          })}
        >
          <IconButton onClick={onExport} size="small">
            <ExportIcon />
          </IconButton>
        </Tooltip>

        {/* Import */}
        <Tooltip
          title={t("tabs.assets.importAssets", {
            defaultValue: "Import Assets",
          })}
        >
          <IconButton onClick={onImport} size="small">
            <ImportIcon />
          </IconButton>
        </Tooltip>

        <Box sx={{ flexGrow: 1 }} />

        {/* Asset count */}
        <Chip
          label={`${assetCount} ${t("tabs.assets.assets", {
            defaultValue: "Assets",
          })}`}
          size="small"
          variant="outlined"
        />

        {/* Validation status — details are in the findings panel below the table */}
        <Tooltip
          arrow
          placement="top"
          title={
            validation
              ? t("tabs.assets.notifications.summary", {
                  errors: validation.errors.length,
                  warnings: validation.warnings.length,
                  infos: validation.infos?.length ?? 0,
                  defaultValue:
                    "{{errors}} errors · {{warnings}} warnings · {{infos}} infos — details below the table",
                })
              : t("validation.noMessages", {
                  defaultValue: "No validation messages",
                })
          }
        >
          <Box component="span" sx={{ display: "inline-block" }}>
            <Chip
              label={getStatusText()}
              size="small"
              color={getStatusColor()}
            />
          </Box>
        </Tooltip>

        {/* Unsaved indicator */}
        {isDirty && (
          <Chip
            label={t("common.unsaved", { defaultValue: "Unsaved" })}
            size="small"
            color="warning"
            variant="outlined"
          />
        )}
      </Box>
    );
  },
);

AssetsToolbar.displayName = "AssetsToolbar";

export default AssetsToolbar;