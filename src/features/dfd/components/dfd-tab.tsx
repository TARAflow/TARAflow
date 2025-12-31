// ==================== DFD TAB ====================
// Single Responsibility: View/UI only - delegates logic to useDFDEditor hook
// NO dependency on app - uses DFDProjectData from dfd-types
//
// ZOOM: Native draw.io zoom is used (Ctrl+Wheel zooms to cursor position)
// Zoom/Undo/Redo buttons are in draw.io's own toolbar, not duplicated here

import React, { useState, useCallback } from "react";
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  Paper,
  Toolbar,
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
  DFDTabProps,
  DFDViewMode,
  DFDExportData,
} from "../models/dfd-types";
import { ValidationResult } from "../services/dfd-validator";
import { useDFDEditor } from "../hooks/use-dfd-editor";
import DFDPreviewDialog from "./dfd-preview-dialog";
import DFDValidationPanel from "./dfd-validation-panel";
import DFDDescriptionView from "./dfd-description-view";

// ==================== CONSTANTS ====================

// Base URL - dark mode is controlled via configure message, not URL
const DRAWIO_BASE_URL =
  "https://embed.diagrams.net/?embed=1&spin=1&proto=json&configure=1&noExitBtn=1&saveAndExit=0&noSaveBtn=1&libraries=1";

// ==================== COMPONENT ====================

export const DFDTab: React.FC<DFDTabProps> = ({
  project,
  onUpdate,
  onDirtyChange,
  onPhaseComplete,
}) => {
  const [showPreview, setShowPreview] = React.useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [viewMode, setViewMode] = useState<DFDViewMode>("draw");

  // Build URL with dark mode parameter
  const drawioUrl = darkMode
    ? `${DRAWIO_BASE_URL}&ui=dark`
    : `${DRAWIO_BASE_URL}&ui=atlas`;

  // Use custom hook for all DFD logic
  const {
    isLoading,
    isDirty,
    validation,
    stats,
    previewImage,
    iframeRef,
    initialize,
    save,
    validate,
    exportImage,
    autoNumberLabels,
    updateElementDescription,
    updateConnectionDescription,
    exportDFD,
    importDFD,
  } = useDFDEditor(project, {
    onDirtyChange,
    onSave: onUpdate,
    darkMode,
    iframeKey,
  });

  // ==================== HANDLERS ====================

  const handleIframeLoad = () => {
    console.log("[DFDTab] iframe loaded, calling initialize()");
    initialize();
  };

  const handleSave = async () => {
    await save();
  };

  const handleExportImage = () => {
    exportImage();
    setShowPreview(true);
  };

  const handleAutoNumber = async () => {
    await autoNumberLabels();
  };

  const handleExport = async () => {
    const exportData = exportDFD();
    if (!exportData) return;

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${project.name}_DFD.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data: DFDExportData = JSON.parse(text);
        await importDFD(data);
      } catch (error) {
        console.error("Failed to import DFD:", error);
        alert("Failed to import DFD. Please check the file format.");
      }
    };

    input.click();
  };

  const handleProceed = () => {
    if (isDirty) {
      return;
    }
    if (!validation?.isValid) {
      return;
    }

    // Check if all descriptions are filled
    const allDescribed =
      stats &&
      stats.describedElements === stats.totalElements - stats.dataFlows &&
      stats.describedConnections === stats.dataFlows;

    if (!allDescribed) {
      return;
    }

    onPhaseComplete?.();
  };

  const handleToggleDarkMode = useCallback(() => {
    setDarkMode((prev) => !prev);
    setIframeKey((prev) => prev + 1);
  }, []);

  const handleViewModeChange = (
    _event: React.MouseEvent<HTMLElement>,
    newMode: DFDViewMode | null
  ) => {
    if (newMode !== null) {
      setViewMode(newMode);
    }
  };

  // Check if can proceed
  const canProceed =
    !isDirty &&
    (validation?.isValid ?? false) &&
    stats !== null &&
    stats.describedElements === stats.totalElements - stats.dataFlows &&
    stats.describedConnections === stats.dataFlows;

  // ==================== RENDER ====================

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Toolbar */}
      <DFDToolbar
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        isDirty={isDirty}
        validation={validation}
        stats={stats}
        darkMode={darkMode}
        onToggleDarkMode={handleToggleDarkMode}
        onExportImage={handleExportImage}
        onRefresh={validate}
        onAutoNumber={handleAutoNumber}
        onExport={handleExport}
        onImport={handleImport}
        onSave={handleSave}
        onProceed={handleProceed}
        canProceed={canProceed}
      />

      {/* Main Content */}
      {viewMode === "draw" ? (
        <Box
          sx={{
            flexGrow: 1,
            position: "relative",
            bgcolor: darkMode ? "#1a1a1a" : "grey.100",
          }}
        >
          {isLoading && <LoadingOverlay darkMode={darkMode} />}

          <iframe
            key={`${project.id}-${iframeKey}`}
            ref={iframeRef as React.RefObject<HTMLIFrameElement>}
            src={drawioUrl}
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              pointerEvents: isLoading ? "none" : "auto",
            }}
            title="DFD Editor"
            onLoad={handleIframeLoad}
          />
        </Box>
      ) : (
        <DFDDescriptionView
          elements={project.dfd?.elements || []}
          connections={project.dfd?.connections || []}
          onElementUpdate={updateElementDescription}
          onConnectionUpdate={updateConnectionDescription}
        />
      )}

      {/* Validation Panel */}
      {validation &&
        (validation.errors.length > 0 || validation.warnings.length > 0) && (
          <DFDValidationPanel validation={validation} />
        )}

      {/* Preview Dialog */}
      <DFDPreviewDialog
        open={showPreview}
        onClose={() => setShowPreview(false)}
        previewImage={previewImage}
        projectName={project.name}
      />
    </Box>
  );
};

// ==================== SUB-COMPONENTS ====================

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

const DFDToolbar: React.FC<DFDToolbarProps> = ({
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
        <ToggleButton value="draw">
          <DrawIcon fontSize="small" sx={{ mr: 0.5 }} />
          {t("tabs.dfd.toolbar.draw", { defaultValue: "Draw DFD" })}
        </ToggleButton>
        <ToggleButton value="describe">
          <DescriptionIcon fontSize="small" sx={{ mr: 0.5 }} />
          {t("tabs.dfd.toolbar.describe", { defaultValue: "Describe DFD" })}
        </ToggleButton>
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

export default DFDTab;