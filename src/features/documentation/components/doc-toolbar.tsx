// ==================== DOCUMENTATION TOOLBAR ====================
// Extracted from DocTab for better separation of concerns
// Handles all toolbar UI elements and actions

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  IconButton,
  Tooltip,
  Typography,
  Button,
  Divider,
  Chip,
} from "@mui/material";
import {
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Settings as SettingsIcon,
  Visibility as PreviewIcon,
  Code as CodeIcon,
  Warning as WarningIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
} from "@mui/icons-material";

import type { DocConfiguration } from "../models/doc-types";

// ==================== TYPES ====================

export interface DocToolbarProps {
  // View state
  sidebarOpen: boolean;
  viewMode: "preview" | "source";
  isDirty: boolean;
  
  // Document state
  config: DocConfiguration;
  generatedContent: string;
  
  // Validation
  warnings: string[];
  
  // Actions
  onSidebarToggle: () => void;
  onViewModeToggle: () => void;
  onRegenerate: () => void;
  onDownload: () => void;
  onOpenSettings: () => void;
  onSave: () => void;
}

// ==================== COMPONENT ====================

export const DocToolbar: React.FC<DocToolbarProps> = ({
  sidebarOpen,
  viewMode,
  isDirty,
  config,
  generatedContent,
  warnings,
  onSidebarToggle,
  onViewModeToggle,
  onRegenerate,
  onDownload,
  onOpenSettings,
  onSave,
}) => {
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        p: 1,
        borderBottom: "1px solid",
        borderColor: "divider",
        backgroundColor: "grey.50",
      }}
    >
      {/* Sidebar Toggle */}
      <Tooltip
        title={
          sidebarOpen
            ? t("tabs.doc.hideSidebar", { defaultValue: "Hide Sidebar" })
            : t("tabs.doc.showSidebar", { defaultValue: "Show Sidebar" })
        }
      >
        <IconButton size="small" onClick={onSidebarToggle}>
          {sidebarOpen ? <ChevronLeftIcon /> : <ChevronRightIcon />}
        </IconButton>
      </Tooltip>

      <Divider orientation="vertical" flexItem />

      {/* View Mode Toggle */}
      <Tooltip title={t("tabs.doc.toggleView", { defaultValue: "Toggle View" })}>
        <IconButton size="small" onClick={onViewModeToggle}>
          {viewMode === "preview" ? <CodeIcon /> : <PreviewIcon />}
        </IconButton>
      </Tooltip>

      {/* Regenerate */}
      <Tooltip title={t("tabs.doc.regenerate", { defaultValue: "Regenerate" })}>
        <IconButton size="small" onClick={onRegenerate}>
          <RefreshIcon />
        </IconButton>
      </Tooltip>

      {/* Download */}
      <Tooltip title={t("tabs.doc.download", { defaultValue: "Download" })}>
        <span>
          <IconButton
            size="small"
            onClick={onDownload}
            disabled={!generatedContent}
          >
            <DownloadIcon />
          </IconButton>
        </span>
      </Tooltip>

      {/* Settings */}
      <Tooltip
        title={t("tabs.doc.settings", { defaultValue: "Template Settings" })}
      >
        <IconButton size="small" onClick={onOpenSettings}>
          <SettingsIcon />
        </IconButton>
      </Tooltip>

      <Box sx={{ flexGrow: 1 }} />

      {/* Validation Status */}
      {warnings.length > 0 && (
        <Tooltip
          title={
            <Box>
              {warnings.map((w, i) => (
                <Typography key={i} variant="caption" display="block">
                  • {w}
                </Typography>
              ))}
            </Box>
          }
        >
          <Chip
            icon={<WarningIcon />}
            label={`${warnings.length} ${t("tabs.doc.warnings", {
              defaultValue: "warnings",
            })}`}
            size="small"
            color="warning"
            variant="outlined"
          />
        </Tooltip>
      )}

      {/* Format Chip */}
      <Chip
        label={config.format.toUpperCase()}
        size="small"
        color="primary"
        variant="outlined"
      />

      {/* Language Chip */}
      <Chip
        label={config.language.toUpperCase()}
        size="small"
        color="secondary"
        variant="outlined"
      />

      <Divider orientation="vertical" flexItem />

      {/* Save Button */}
      <Button
        variant="contained"
        size="small"
        onClick={onSave}
        disabled={!isDirty}
      >
        {t("common.save", { defaultValue: "Save" })}
        {isDirty && " *"}
      </Button>
    </Box>
  );
};

export default DocToolbar;