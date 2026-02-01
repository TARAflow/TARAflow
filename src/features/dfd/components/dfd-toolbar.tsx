import React, { useState, useCallback } from "react";
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  IconButton,
  Tooltip,
  Typography,
  Chip,
  Stack,
  CircularProgress,
  Divider,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import {
  Save as SaveIcon,
  Image as ImageIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon,
  SkipNext as NextIcon,
  FormatListNumbered as AutoNumberIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  Download as ExportIcon,
  Upload as ImportIcon,
  Draw as DrawIcon,
  Description as DescriptionIcon,
} from "@mui/icons-material";

import {
  DFDStats,
  DFDViewMode,
} from "../models/dfd-types";

import { ValidationResult } from "../services/dfd-validator";

interface DFDToolbarProps {
  viewMode: DFDViewMode;
  onViewModeChange: (
    event: React.MouseEvent<HTMLElement>,
    mode: DFDViewMode | null
  ) => void;
  isDirty: boolean;
  validation: ValidationResult | null;
  stats: DFDStats | null;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onExportImage: () => void;
  onRefresh: () => void;
  onAutoNumber: () => void;
  onExport: () => void;
  onImport: () => void;
  onSave: () => void;
  onProceed: () => void;
  canProceed: boolean;
}

export const DFDToolbar: React.FC<DFDToolbarProps> = ({
  viewMode,
  onViewModeChange,
  isDirty,
  validation,
  stats,
  darkMode,
  onToggleDarkMode,
  onExportImage,
  onRefresh,
  onAutoNumber,
  onExport,
  onImport,
  onSave,
  onProceed,
  canProceed,
}) => {
  const { t } = useTranslation();

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
      {/* View Mode Toggle */}
      <ToggleButtonGroup
        value={viewMode}
        exclusive
        onChange={onViewModeChange}
        size="small"
      >
        <Tooltip
          title={t("tabs.dfd.toolbar.draw", { defaultValue: "Draw DFD" })}
          arrow
          placement="bottom"
        >
          <ToggleButton value="draw">
            <DrawIcon fontSize="small" />
          </ToggleButton>
        </Tooltip>

        <Tooltip
          title={t("tabs.dfd.toolbar.describe", {
            defaultValue: "Describe DFD",
          })}
          arrow
          placement="bottom"
        >
          <ToggleButton value="describe">
            <DescriptionIcon fontSize="small" />
          </ToggleButton>
        </Tooltip>
      </ToggleButtonGroup>

      <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

      {/* Dark Mode Toggle - only in draw mode */}
      {viewMode === "draw" && (
        <>
          <Tooltip
            title={
              darkMode
                ? t("tabs.dfd.toolbar.lightMode", {
                    defaultValue: "Switch to Light Mode",
                  })
                : t("tabs.dfd.toolbar.darkMode", {
                    defaultValue: "Switch to Dark Mode",
                  })
            }
          >
            <IconButton size="small" onClick={onToggleDarkMode}>
              {darkMode ? (
                <LightModeIcon fontSize="small" />
              ) : (
                <DarkModeIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>

          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
        </>
      )}

      {/* Export Image, Refresh & Auto-Number - only in draw mode */}
      {viewMode === "draw" && (
        <>
          <Tooltip
            title={t("tabs.dfd.toolbar.exportImage", {
              defaultValue: "Export as Image",
            })}
          >
            <IconButton size="small" onClick={onExportImage}>
              <ImageIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip
            title={t("tabs.dfd.toolbar.refresh", {
              defaultValue: "Refresh Validation",
            })}
          >
            <IconButton size="small" onClick={onRefresh}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip
            title={t("tabs.dfd.toolbar.autoNumber", {
              defaultValue: "Auto-Number Labels",
            })}
          >
            <IconButton size="small" onClick={onAutoNumber}>
              <AutoNumberIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
        </>
      )}

      {/* Export & Import */}
      <Tooltip
        title={t("tabs.dfd.toolbar.exportDFD", { defaultValue: "Export DFD" })}
      >
        <IconButton onClick={onExport} size="small">
          <ExportIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Tooltip
        title={t("tabs.dfd.toolbar.importDFD", { defaultValue: "Import DFD" })}
      >
        <IconButton onClick={onImport} size="small">
          <ImportIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      {/* Spacer */}
      <Box sx={{ flexGrow: 1 }} />

      {/* Stats */}
      {stats && <DFDStatsDisplay stats={stats} />}

      {/* Validation Status */}
      {validation && <ValidationChips validation={validation} />}

      {/* Action Buttons */}
      <Button
        variant="outlined"
        size="small"
        startIcon={<SaveIcon />}
        onClick={onSave}
        disabled={!isDirty}
        sx={{ mr: 1 }}
      >
        {t("common.save", { defaultValue: "Save" })}
        {isDirty && " *"}
      </Button>

      <Button
        variant="contained"
        size="small"
        endIcon={<NextIcon />}
        onClick={onProceed}
        disabled={!canProceed}
      >
        {t("tabs.dfd.proceed", { defaultValue: "Continue" })}
      </Button>
    </Box>
  );
};

interface DFDStatsDisplayProps {
  stats: DFDStats;
}

const DFDStatsDisplay: React.FC<DFDStatsDisplayProps> = ({ stats }) => {
  const { t } = useTranslation();

  const totalCountable = stats.totalElements - stats.dataFlows;
  const allDescribed =
    stats.describedElements === totalCountable &&
    stats.describedConnections === stats.dataFlows;

  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mr: 2 }}>
      <Typography variant="caption" color="text.secondary">
        {stats.totalElements}{" "}
        {t("tabs.dfd.stats.elements", { defaultValue: "Elements" })}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        •
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {stats.dataFlows} {t("tabs.dfd.stats.flows", { defaultValue: "Flows" })}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        •
      </Typography>
      <Typography
        variant="caption"
        color={allDescribed ? "success.main" : "warning.main"}
      >
        {stats.describedElements + stats.describedConnections} /{" "}
        {totalCountable + stats.dataFlows}{" "}
        {t("tabs.dfd.stats.described", { defaultValue: "Described" })}
      </Typography>
    </Stack>
  );
};

interface ValidationChipsProps {
  validation: ValidationResult;
}

const ValidationChips: React.FC<ValidationChipsProps> = ({ validation }) => {
  const { t } = useTranslation();

  return (
    <Stack direction="row" spacing={0.5} sx={{ mr: 2 }}>
      {validation.isValid ? (
        <Chip
          icon={<CheckCircleIcon />}
          label={t("tabs.dfd.validation.valid", { defaultValue: "Valid" })}
          color="success"
          size="small"
          variant="outlined"
        />
      ) : (
        validation.errors.length > 0 && (
          <Chip
            icon={<WarningIcon />}
            label={`${validation.errors.length} ${t(
              "tabs.dfd.validation.errors",
              { defaultValue: "Errors" }
            )}`}
            color="error"
            size="small"
            variant="outlined"
          />
        )
      )}
      {validation.warnings.length > 0 && (
        <Chip
          icon={<InfoIcon />}
          label={`${validation.warnings.length}`}
          color="warning"
          size="small"
          variant="outlined"
        />
      )}
    </Stack>
  );
};

interface LoadingOverlayProps {
  darkMode?: boolean;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ darkMode }) => {
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: darkMode ? "#1a1a1a" : "background.default",
        zIndex: 10,
      }}
    >
      <CircularProgress
        size={40}
        sx={{ color: darkMode ? "#fff" : undefined }}
      />
      <Typography sx={{ mt: 2, color: darkMode ? "#fff" : "text.secondary" }}>
        {t("tabs.dfd.loading", { defaultValue: "Loading DFD Editor..." })}
      </Typography>
    </Box>
  );
};