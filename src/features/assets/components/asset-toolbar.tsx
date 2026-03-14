// ==================== ASSETS TOOLBAR ====================
// Toolbar for the Assets tab
// Extracted from assets-tab.tsx for consistency with other tab toolbars

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Button,
  IconButton,
  Tooltip,
  Divider,
  Chip,
  Typography
} from "@mui/material";
import {
  Add as AddIcon,
  Settings as SettingsIcon,
  Sync as SyncIcon,
  SkipNext as NextIcon,
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
  onProceed: () => void;
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
    onProceed,
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

    const translateValidationMessage = (msg: string): string => {
      // Format: "tabs.assets.validation.key:assetId" or
      //         "tabs.assets.validation.key:assetId:type"
      const parts = msg.split(":");
      const key = parts[0];
      const id = parts[1] ?? "";
      const type = parts[2] ?? "";
      return t(key, { id, type, defaultValue: msg });
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
          title={t("tabs.assets.syncFromDFD", { defaultValue: "Sync from DFD" })}
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

        {/* Validation status */}
        <Tooltip
          arrow
          placement="top"
          componentsProps={{ tooltip: { sx: { maxWidth: 320 } } }}
          title={
            validation && (validation.errors.length > 0 || validation.warnings.length > 0) ? (
              <Box sx={{ p: 0.5 }}>
                {validation.errors.map((err, i) => (
                  <Typography key={i} variant="caption" display="block" color="rgba(255,180,180,1)">
                    • {translateValidationMessage(err)}
                  </Typography>
                ))}
                {validation.warnings.map((warn, i) => (
                  <Typography key={i} variant="caption" display="block" color="rgba(255,220,100,1)">
                    • {translateValidationMessage(warn)}
                  </Typography>
                ))}
              </Box>
            ) : (
              t("validation.noMessages", { defaultValue: "No validation messages" })
            )
          }
        >
          <Box component="span" sx={{ display: "inline-block" }}>
            <Chip label={getStatusText()} size="small" color={getStatusColor()} />
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
  },
);

AssetsToolbar.displayName = "AssetsToolbar";

export default AssetsToolbar;