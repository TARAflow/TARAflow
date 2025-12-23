// ==================== THREATS TAB (PHASE 3) ====================
// Main component for threat identification and management
// Features:
// - Vertical split view with DFD preview (top) and threat tables (bottom)
// - Toggle between STRIDE per-element and per-interaction
// - Both method data stored separately to allow switching
// - Follows Clean Architecture - only depends on shared types

import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  IconButton,
  Tooltip,
  Typography,
  Button,
  Divider,
  Chip,
  Alert,
  Collapse,
  ToggleButtonGroup,
  ToggleButton,
  CircularProgress,
} from "@mui/material";
import {
  Add as AddIcon,
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
} from "@mui/icons-material";

import {
  Threat,
  ThreatData,
  ThreatTable as ThreatTableType,
  ThreatConfiguration,
  ThreatTabProps,
  ThreatValidation,
  StrideMethod,
  LinkedDFDElement,
  DataFlowReference,
  STRIDE_DEFINITIONS,
  createDefaultThreatData,
  getActiveThreatTables,
  createEmptyThreat,
  DEFAULT_THREAT_CONFIGURATION,
} from "../models/threat-types";
import { threatService } from "../services/threat-service";
import { ThreatTable, AddThreatInfo } from "./threat-table";
import { ThreatDialog } from "./threat-dialog";
import { ThreatConfigDialog } from "./threat-config-dialog";
import { ConfirmDialog } from "shared";
import { DFDPreviewPanel } from "features/assets/components/dfd-preview-panel";
import type { StrideCategory } from "shared";

// ==================== CONSTANTS ====================

const MIN_PANEL_HEIGHT = 100;
const DEFAULT_DFD_HEIGHT = 250;

// ==================== HELPER FUNCTIONS ====================

/**
 * Ensures ThreatData has all required fields with proper defaults
 */
function ensureValidThreatData(
  data: ThreatData | null | undefined
): ThreatData {
  const defaultData = createDefaultThreatData();

  if (!data) {
    return defaultData;
  }

  return {
    configuration: data.configuration ?? defaultData.configuration,
    perElementTables: data.perElementTables ?? [],
    perInteractionTables: data.perInteractionTables ?? [],
    validation: data.validation,
    lastModified: data.lastModified ?? defaultData.lastModified,
  };
}

// ==================== COMPONENT ====================

export const ThreatsTab: React.FC<ThreatTabProps> = ({
  project,
  onUpdate,
  onDirtyChange,
  onPhaseComplete,
}) => {
  const { t } = useTranslation();

  // ==================== STATE ====================

  // Threat data (local working copy)
  const [threatData, setThreatData] = useState<ThreatData>(() =>
    ensureValidThreatData(project.threats)
  );

  // UI state
  const [isDirty, setIsDirty] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showDFDPreview, setShowDFDPreview] = useState(true);
  const [dfdPanelHeight, setDfdPanelHeight] = useState(DEFAULT_DFD_HEIGHT);
  const [isResizing, setIsResizing] = useState(false);

  // Dialog state
  const [selectedThreat, setSelectedThreat] = useState<{
    tableIndex: number;
    threat: Threat;
  } | null>(null);
  const [showThreatDialog, setShowThreatDialog] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [isNewThreat, setIsNewThreat] = useState(false);

  // Validation
  const [validation, setValidation] = useState<ThreatValidation | null>(
    project.threats?.validation ?? null
  );

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number>(0);
  const startHeightRef = useRef<number>(0);

  // ==================== DERIVED STATE ====================

  const activeMethod = threatData.configuration?.activeMethod ?? "per-element";
  const activeTables = getActiveThreatTables(threatData);
  const hasThreats =
    activeTables.length > 0 && activeTables.some((t) => t.threats.length > 0);
  const hasDFD = Boolean(project.dfdElements && project.dfdElements.length > 0);

  // Statistics
  const stats = useMemo(() => {
    return threatService.getStatistics(threatData, activeMethod);
  }, [threatData, activeMethod]);

  // ==================== EFFECTS ====================

  // Update dirty state
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // Sync from project when it changes
  useEffect(() => {
    setThreatData(ensureValidThreatData(project.threats));
    setValidation(project.threats?.validation ?? null);
  }, [project.threats]);

  // Auto-save when dirty (debounced)
  useEffect(() => {
    if (!isDirty) return;

    const timeoutId = setTimeout(() => {
      const result = threatService.saveThreatData(project, threatData);

      if (result.success) {
        setThreatData(result.threats);
        setValidation(result.threats.validation ?? null);
        setIsDirty(false);

        onUpdate({
          threats: result.threats,
          phaseStatus: result.phaseStatus,
          lastModified: result.lastModified,
        });
      }
    }, 1000); // 1 second debounce

    return () => clearTimeout(timeoutId);
  }, [isDirty, threatData, project, onUpdate]);

  // ==================== DIRTY TRACKING ====================

  const markDirty = useCallback(() => {
    if (!isDirty) {
      setIsDirty(true);
    }
  }, [isDirty]);

  // ==================== METHOD SWITCHING ====================

  const handleMethodChange = useCallback(
    (_: React.MouseEvent<HTMLElement>, newMethod: StrideMethod | null) => {
      if (!newMethod || newMethod === activeMethod) return;

      const updatedData: ThreatData = {
        ...threatData,
        configuration: {
          ...threatData.configuration,
          activeMethod: newMethod,
        },
        lastModified: new Date().toISOString(),
      };

      setThreatData(updatedData);
      markDirty();
    },
    [activeMethod, threatData, markDirty]
  );

  // ==================== THREAT GENERATION ====================

  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);

  const handleGenerateClick = useCallback(() => {
    if (!hasDFD) return;

    // If there are existing threats for active method, show confirmation
    const activeHasThreats =
      activeMethod === "per-element"
        ? threatData.perElementTables?.some((t) => t.threats.length > 0) ??
          false
        : threatData.perInteractionTables?.some((t) => t.threats.length > 0) ??
          false;

    if (activeHasThreats) {
      setShowGenerateConfirm(true);
    } else {
      // No existing threats for this method, generate directly
      handleGenerateThreats();
    }
  }, [hasDFD, activeMethod, threatData]);

  const handleGenerateThreats = useCallback(async () => {
    if (!hasDFD) return;

    setShowGenerateConfirm(false);
    setIsGenerating(true);

    try {
      // Generate only for ACTIVE method
      const result = threatService.generateThreatsForMethod(
        project,
        threatData.configuration,
        activeMethod
      );

      if (result.success) {
        const updatedData: ThreatData = {
          ...threatData,
          ...(activeMethod === "per-element"
            ? { perElementTables: result.tables }
            : { perInteractionTables: result.tables }),
          lastModified: new Date().toISOString(),
        };

        setThreatData(updatedData);
        setValidation(
          threatService.validateThreatData(updatedData, activeMethod)
        );
        markDirty();
      }
    } finally {
      setIsGenerating(false);
    }
  }, [hasDFD, project, threatData, activeMethod, markDirty]);

  // ==================== DELETE ALL ====================

  const handleDeleteAllClick = useCallback(() => {
    if (hasThreats) {
      setShowDeleteAllConfirm(true);
    }
  }, [hasThreats]);

  const handleDeleteAllThreats = useCallback(() => {
    // Only delete threats for the ACTIVE method
    const updatedData: ThreatData = {
      ...threatData,
      ...(activeMethod === "per-element"
        ? { perElementTables: [] }
        : { perInteractionTables: [] }),
      lastModified: new Date().toISOString(),
    };

    setThreatData(updatedData);
    setValidation(threatService.validateThreatData(updatedData, activeMethod));
    setShowDeleteAllConfirm(false);
    markDirty();
  }, [threatData, activeMethod, markDirty]);

  // ==================== THREAT HANDLERS ====================

  const handleEditThreat = useCallback((tableIndex: number, threat: Threat) => {
    setSelectedThreat({ tableIndex, threat });
    setIsNewThreat(false);
    setShowThreatDialog(true);
  }, []);

  const handleAddThreat = useCallback(
    (info: AddThreatInfo) => {
      // Create a new threat with default values
      const newThreat = threatService.createNewThreat(
        threatData,
        activeMethod,
        info.tableIndex,
        info.linkedElement,
        info.dataFlow
      );

      setSelectedThreat({
        tableIndex: info.tableIndex,
        threat: newThreat,
      });
      setIsNewThreat(true);
      setShowThreatDialog(true);
    },
    [threatData, activeMethod]
  );

  const handleSaveThreat = useCallback(
    (updates: Partial<Threat>) => {
      if (!selectedThreat) return;

      let updatedData: ThreatData;

      if (isNewThreat) {
        // Add new threat
        const newThreat: Threat = {
          ...selectedThreat.threat,
          ...updates,
          lastModified: new Date().toISOString(),
        };
        updatedData = threatService.addThreat(
          threatData,
          activeMethod,
          selectedThreat.tableIndex,
          newThreat
        );
      } else {
        // Update existing threat
        updatedData = threatService.updateThreat(
          threatData,
          activeMethod,
          selectedThreat.tableIndex,
          selectedThreat.threat.id,
          updates
        );
      }

      setThreatData(updatedData);
      setValidation(
        threatService.validateThreatData(updatedData, activeMethod)
      );
      setShowThreatDialog(false);
      setSelectedThreat(null);
      setIsNewThreat(false);
      markDirty();
    },
    [selectedThreat, isNewThreat, threatData, activeMethod, markDirty]
  );

  const handleDeleteThreat = useCallback(
    (tableIndex: number, threatId: string) => {
      const updatedData = threatService.deleteThreat(
        threatData,
        activeMethod,
        tableIndex,
        threatId
      );

      setThreatData(updatedData);
      setValidation(
        threatService.validateThreatData(updatedData, activeMethod)
      );
      markDirty();
    },
    [threatData, activeMethod, markDirty]
  );

  const handleCloseThreatDialog = useCallback(() => {
    setShowThreatDialog(false);
    setSelectedThreat(null);
    setIsNewThreat(false);
  }, []);

  // ==================== CONFIG HANDLERS ====================

  const handleOpenConfig = useCallback(() => {
    setShowConfigDialog(true);
  }, []);

  const handleSaveConfig = useCallback(
    (config: ThreatConfiguration) => {
      const updatedData: ThreatData = {
        ...threatData,
        configuration: config,
        lastModified: new Date().toISOString(),
      };

      setThreatData(updatedData);
      setShowConfigDialog(false);
      markDirty();
    },
    [threatData, markDirty]
  );

  // ==================== PROCEED ====================

  const handleProceed = useCallback(() => {
    onPhaseComplete?.();
  }, [onPhaseComplete]);

  // ==================== EXPORT ====================

  const handleExport = useCallback(() => {
    const exportData = {
      projectName: project.name,
      exportDate: new Date().toISOString(),
      activeMethod,
      perElementTables: threatData.perElementTables,
      perInteractionTables: threatData.perInteractionTables,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name}_Threats_${
      new Date().toISOString().split("T")[0]
    }.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [project.name, threatData, activeMethod]);

  // ==================== IMPORT ====================

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [pendingImportData, setPendingImportData] = useState<{
    perElementTables: ThreatTableType[];
    perInteractionTables: ThreatTableType[];
  } | null>(null);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;

        // Validate using service
        const validationResult = threatService.validateImportData(content);

        if (!validationResult.success) {
          alert(
            t(`tabs.threats.import.${validationResult.error}`, {
              defaultValue: validationResult.message,
            })
          );
          return;
        }

        const importData = validationResult.data!;

        // If there are existing threats, show confirmation
        if (hasThreats) {
          setPendingImportData(importData);
          setShowImportConfirm(true);
        } else {
          // No existing threats, import directly
          applyImport(importData);
        }
      };
      reader.readAsText(file);

      // Reset file input so the same file can be selected again
      e.target.value = "";
    },
    [hasThreats, t]
  );

  const applyImport = useCallback(
    (importData: {
      perElementTables: ThreatTableType[];
      perInteractionTables: ThreatTableType[];
    }) => {
      const updatedData: ThreatData = {
        ...threatData,
        perElementTables: importData.perElementTables,
        perInteractionTables: importData.perInteractionTables,
        lastModified: new Date().toISOString(),
      };

      setThreatData(updatedData);
      setValidation(
        threatService.validateThreatData(updatedData, activeMethod)
      );
      markDirty();
      setShowImportConfirm(false);
      setPendingImportData(null);
    },
    [threatData, activeMethod, markDirty]
  );

  const handleConfirmImport = useCallback(() => {
    if (pendingImportData) {
      applyImport(pendingImportData);
    }
  }, [pendingImportData, applyImport]);

  const handleCancelImport = useCallback(() => {
    setShowImportConfirm(false);
    setPendingImportData(null);
  }, []);

  // ==================== SPLIT VIEW RESIZE ====================

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      startYRef.current = e.clientY;
      startHeightRef.current = dfdPanelHeight;
      setIsResizing(true);
    },
    [dfdPanelHeight]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing || !splitContainerRef.current) return;

      e.preventDefault();

      const deltaY = e.clientY - startYRef.current;
      const containerHeight = splitContainerRef.current.clientHeight;
      const maxHeight = containerHeight - MIN_PANEL_HEIGHT - 8;

      const newHeight = Math.max(
        MIN_PANEL_HEIGHT,
        Math.min(maxHeight, startHeightRef.current + deltaY)
      );

      setDfdPanelHeight(newHeight);
    },
    [isResizing]
  );

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "none";
      document.body.style.cursor = "row-resize";

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // ==================== RENDER ====================

  return (
    <Box
      ref={containerRef}
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Hidden file input for import */}
      <Box
        component="input"
        ref={fileInputRef}
        type="file"
        accept=".json"
        aria-label={t("common.import", { defaultValue: "Import" })}
        sx={{ display: "none" }}
        onChange={handleFileSelect}
      />

      {/* Toolbar */}
      <ThreatsToolbar
        isDirty={isDirty}
        isGenerating={isGenerating}
        validation={validation}
        activeMethod={activeMethod}
        threatCount={stats.totalThreats}
        hasThreats={hasThreats}
        hasDFD={hasDFD}
        showDFDPreview={showDFDPreview}
        onToggleDFDPreview={() => setShowDFDPreview(!showDFDPreview)}
        onMethodChange={handleMethodChange}
        onGenerate={handleGenerateClick}
        onDeleteAll={handleDeleteAllClick}
        onOpenConfig={handleOpenConfig}
        onExport={handleExport}
        onImport={handleImportClick}
        onProceed={handleProceed}
      />

      {/* Warnings */}
      <Collapse in={!hasDFD}>
        <Box sx={{ px: 2, py: 1 }}>
          <Alert severity="warning" icon={<WarningIcon />}>
            {t("tabs.threats.noDFD", {
              defaultValue:
                "Please create a DFD in Phase 1 before generating threats.",
            })}
          </Alert>
        </Box>
      </Collapse>

      {/* Main Content - Split View */}
      <Box
        ref={splitContainerRef}
        sx={{
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* DFD Preview Panel (Top) */}
        {showDFDPreview && (
          <>
            <Box
              sx={{
                height: dfdPanelHeight,
                minHeight: MIN_PANEL_HEIGHT,
                flexShrink: 0,
                borderBottom: "1px solid",
                borderColor: "divider",
                overflow: "hidden",
              }}
            >
              <DFDPreviewPanel imageSrc={project.dfdPreviewImage} />
            </Box>

            {/* Resize Handle */}
            <Box
              onMouseDown={handleMouseDown}
              sx={{
                height: 8,
                flexShrink: 0,
                cursor: "row-resize",
                backgroundColor: isResizing ? "primary.light" : "grey.200",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: isResizing ? "none" : "background-color 0.2s",
                "&:hover": {
                  backgroundColor: "primary.light",
                },
                "&:active": {
                  backgroundColor: "primary.main",
                },
              }}
            >
              <Box
                sx={{
                  width: 40,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: isResizing
                    ? "primary.contrastText"
                    : "grey.400",
                }}
              />
            </Box>
          </>
        )}

        {/* Threat Tables (Bottom) */}
        <Box
          sx={{
            flexGrow: 1,
            overflow: "auto",
            p: 2,
            minHeight: MIN_PANEL_HEIGHT,
          }}
        >
          {!hasThreats ? (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                gap: 2,
              }}
            >
              <Typography variant="h6" color="text.secondary">
                {t("tabs.threats.noThreats", {
                  defaultValue: "No threats defined yet",
                })}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t("tabs.threats.noThreatsHint", {
                  defaultValue:
                    "Click 'Generate Threats' to automatically create threats based on your DFD.",
                })}
              </Typography>
              {hasDFD && (
                <Button
                  variant="contained"
                  startIcon={
                    isGenerating ? (
                      <CircularProgress size={16} />
                    ) : (
                      <GenerateIcon />
                    )
                  }
                  onClick={handleGenerateThreats}
                  disabled={isGenerating}
                >
                  {t("tabs.threats.generate", {
                    defaultValue: "Generate Threats",
                  })}
                </Button>
              )}
            </Box>
          ) : (
            <ThreatTable
              threatTables={activeTables}
              configuration={threatData.configuration}
              onEdit={handleEditThreat}
              onDelete={handleDeleteThreat}
              onAdd={handleAddThreat}
            />
          )}
        </Box>
      </Box>

      {/* Threat Edit Dialog */}
      {selectedThreat && (
        <ThreatDialog
          open={showThreatDialog}
          threat={selectedThreat.threat}
          configuration={threatData.configuration}
          onSave={handleSaveThreat}
          onClose={handleCloseThreatDialog}
        />
      )}

      {/* Configuration Dialog */}
      <ThreatConfigDialog
        open={showConfigDialog}
        configuration={threatData.configuration}
        hasExistingThreats={hasThreats}
        onSave={handleSaveConfig}
        onClose={() => setShowConfigDialog(false)}
      />

      {/* Generate Confirmation Dialog */}
      {showGenerateConfirm && (
        <ConfirmDialog
          title={t("tabs.threats.generateConfirmTitle", {
            defaultValue: "Regenerate Threats?",
          })}
          message={t("tabs.threats.generateConfirmMessage", {
            defaultValue:
              "This will overwrite all existing threats, including any manual changes you have made. This action cannot be undone.",
          })}
          variant="warning"
          confirmLabel={t("tabs.threats.generate", {
            defaultValue: "Generate Threats",
          })}
          cancelLabel={t("common.cancel", { defaultValue: "Cancel" })}
          onConfirm={handleGenerateThreats}
          onCancel={() => setShowGenerateConfirm(false)}
        />
      )}

      {/* Import Confirmation Dialog */}
      {showImportConfirm && (
        <ConfirmDialog
          title={t("tabs.threats.importConfirmTitle", {
            defaultValue: "Import Threats?",
          })}
          message={t("tabs.threats.importConfirmMessage", {
            defaultValue:
              "This will overwrite all existing threats with the imported data. This action cannot be undone.",
          })}
          variant="warning"
          confirmLabel={t("common.import", { defaultValue: "Import" })}
          cancelLabel={t("common.cancel", { defaultValue: "Cancel" })}
          onConfirm={handleConfirmImport}
          onCancel={handleCancelImport}
        />
      )}

      {/* Delete All Confirmation Dialog */}
      {showDeleteAllConfirm && (
        <ConfirmDialog
          title={t("tabs.threats.deleteAllConfirmTitle", {
            defaultValue: "Delete All Threats?",
          })}
          message={t("tabs.threats.deleteAllConfirmMessage", {
            defaultValue:
              "This will permanently delete all threats for the current method ({{method}}). This action cannot be undone.",
            method:
              activeMethod === "per-element"
                ? "STRIDE per Element"
                : "STRIDE per Interaction",
          })}
          variant="danger"
          confirmLabel={t("common.deleteAll", { defaultValue: "Delete All" })}
          cancelLabel={t("common.cancel", { defaultValue: "Cancel" })}
          onConfirm={handleDeleteAllThreats}
          onCancel={() => setShowDeleteAllConfirm(false)}
        />
      )}
    </Box>
  );
};

// ==================== TOOLBAR COMPONENT ====================

interface ThreatsToolbarProps {
  isDirty: boolean;
  isGenerating: boolean;
  validation: ThreatValidation | null;
  activeMethod: StrideMethod;
  threatCount: number;
  hasThreats: boolean;
  hasDFD: boolean;
  showDFDPreview: boolean;
  onToggleDFDPreview: () => void;
  onMethodChange: (
    event: React.MouseEvent<HTMLElement>,
    method: StrideMethod | null
  ) => void;
  onGenerate: () => void;
  onDeleteAll: () => void;
  onOpenConfig: () => void;
  onExport: () => void;
  onImport: () => void;
  onProceed: () => void;
}

const ThreatsToolbar: React.FC<ThreatsToolbarProps> = ({
  isDirty,
  isGenerating,
  validation,
  activeMethod,
  threatCount,
  hasThreats,
  hasDFD,
  showDFDPreview,
  onToggleDFDPreview,
  onMethodChange,
  onGenerate,
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
            ? t("tabs.threats.hideDFD", { defaultValue: "Hide DFD Preview" })
            : t("tabs.threats.showDFD", { defaultValue: "Show DFD Preview" })
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
        title={t("tabs.threats.generate", { defaultValue: "Generate Threats" })}
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
};

export default ThreatsTab;