// ==================== THREATS TAB (PHASE 3) ====================
// Main component for threat identification and management
// Features:
// - Vertical split view with DFD preview (top) and threat tables (bottom)
// - Toggle between STRIDE per-element and per-interaction
// - Both method data stored separately to allow switching
// - SYNC STATUS: Warns when DFD and threats are out of sync
// - Toggleable filters in Threat Table (search, STRIDE category)
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
  AlertTitle,
  Stack,
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
  Sync as SyncIcon,
  Error as ErrorIcon,
  Search as SearchIcon,
} from "@mui/icons-material";

import {
  Threat,
  ThreatData,
  ThreatTable as ThreatTableType,
  ThreatConfiguration,
  ThreatTabProps,
  ThreatValidation,
  ThreatSyncStatus,
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
  const { t, i18n } = useTranslation();
  const isGerman = i18n.language === "de";

  // ==================== STATE ====================

  // Threat data (local working copy)
  const [threatData, setThreatData] = useState<ThreatData>(() =>
    ensureValidThreatData(project.threats)
  );

  // UI state
  const [isDirty, setIsDirty] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showDFDPreview, setShowDFDPreview] = useState(true);
  const [dfdPanelHeight, setDfdPanelHeight] = useState(DEFAULT_DFD_HEIGHT);
  const [isResizing, setIsResizing] = useState(false);

  // Filter state with localStorage persistence
  const [showFilters, setShowFilters] = useState(() => {
    const saved = localStorage.getItem("threats-tab-showFilters");
    return saved === "true";
  });

  // Persist showFilters to localStorage
  useEffect(() => {
    localStorage.setItem("threats-tab-showFilters", String(showFilters));
  }, [showFilters]);

  // Sync status
  const [syncStatus, setSyncStatus] = useState<ThreatSyncStatus | null>(null);
  const [showSyncWarning, setShowSyncWarning] = useState(true);

  // Dialog state
  const [selectedThreat, setSelectedThreat] = useState<{
    tableIndex: number;
    threat: Threat;
  } | null>(null);
  const [showThreatDialog, setShowThreatDialog] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [isNewThreat, setIsNewThreat] = useState(false);
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);

  // Validation
  const [validation, setValidation] = useState<ThreatValidation | null>(
    project.threats?.validation ?? null
  );

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number>(0);
  const startHeightRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // ==================== SYNC STATUS CHECK ====================

  // Check sync status when DFD changes - use refs to avoid dependency loops
  const threatDataRef = useRef(threatData);
  threatDataRef.current = threatData;

  const activeMethodRef = useRef(activeMethod);
  activeMethodRef.current = activeMethod;

  // Only re-check when DFD actually changes (not on every threatData update)
  useEffect(() => {
    if (hasDFD && project.dfdElements && project.dfdConnections) {
      const status = threatService.checkSyncStatus(
        project,
        threatDataRef.current,
        activeMethodRef.current
      );
      setSyncStatus(status);
      // Show warning if not in sync
      if (!status.inSync) {
        setShowSyncWarning(true);
      }
    } else {
      setSyncStatus(null);
    }
  }, [project.dfdElements, project.dfdConnections, hasDFD, project]);

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

  // ==================== SYNC HANDLERS ====================

  const handleSyncClick = useCallback(() => {
    if (!syncStatus || syncStatus.inSync) return;

    // Show confirmation if there are orphaned threats
    if (syncStatus.orphanedThreats.threatIds.length > 0) {
      setShowSyncConfirm(true);
    } else {
      // No orphaned threats, sync directly (only add new)
      handleSyncThreats(false);
    }
  }, [syncStatus]);

  const handleSyncThreats = useCallback(
    async (removeOrphaned: boolean) => {
      if (!hasDFD) return;

      setShowSyncConfirm(false);
      setIsSyncing(true);

      try {
        const result = threatService.syncThreats(
          project,
          threatData,
          activeMethod,
          { removeOrphaned }
        );

        if (result.success && result.threatData) {
          setThreatData(result.threatData);
          setValidation(
            threatService.validateThreatData(result.threatData, activeMethod)
          );
          markDirty();

          // Re-check sync status
          const newStatus = threatService.checkSyncStatus(
            project,
            result.threatData,
            activeMethod
          );
          setSyncStatus(newStatus);
        }
      } finally {
        setIsSyncing(false);
      }
    },
    [hasDFD, project, threatData, activeMethod, markDirty]
  );

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
    (newConfig: ThreatConfiguration) => {
      const updatedData: ThreatData = {
        ...threatData,
        configuration: newConfig,
        lastModified: new Date().toISOString(),
      };

      setThreatData(updatedData);
      setShowConfigDialog(false);
      markDirty();
    },
    [threatData, markDirty]
  );

  // ==================== IMPORT / EXPORT ====================

  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [pendingImportData, setPendingImportData] = useState<{
    perElementTables: ThreatTableType[];
    perInteractionTables: ThreatTableType[];
  } | null>(null);

  const handleExport = useCallback(() => {
    const exportData = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      projectId: project.id,
      projectName: project.name,
      activeMethod: activeMethod,
      perElementTables: threatData.perElementTables,
      perInteractionTables: threatData.perInteractionTables,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, "_")}_threats.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [project, activeMethod, threatData]);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const result = threatService.validateImportData(content);

        if (result.success && result.data) {
          // Check if there are existing threats
          const hasExisting =
            (threatData.perElementTables?.some((t) => t.threats.length > 0) ??
              false) ||
            (threatData.perInteractionTables?.some(
              (t) => t.threats.length > 0
            ) ??
              false);

          if (hasExisting) {
            setPendingImportData(result.data);
            setShowImportConfirm(true);
          } else {
            applyImport(result.data);
          }
        } else {
          // Show error (you might want to add a toast or alert here)
          console.error("Import failed:", result.message);
        }
      };
      reader.readAsText(file);

      // Reset input
      event.target.value = "";
    },
    [threatData]
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

  // ==================== NAVIGATION ====================

  const handleProceed = useCallback(() => {
    onPhaseComplete?.();
  }, [onPhaseComplete]);

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

  // ==================== SYNC WARNING MESSAGE ====================

  const getSyncWarningMessage = useCallback(() => {
    if (!syncStatus || syncStatus.inSync) return null;

    const parts: string[] = [];

    if (syncStatus.summary.missingElementCount > 0) {
      parts.push(
        isGerman
          ? `${syncStatus.summary.missingElementCount} Element(e) ohne Bedrohungen`
          : `${syncStatus.summary.missingElementCount} element(s) without threats`
      );
    }

    if (syncStatus.summary.missingDataFlowCount > 0) {
      parts.push(
        isGerman
          ? `${syncStatus.summary.missingDataFlowCount} Datenfluss/-flüsse ohne Bedrohungen`
          : `${syncStatus.summary.missingDataFlowCount} data flow(s) without threats`
      );
    }

    if (syncStatus.summary.orphanedThreatCount > 0) {
      parts.push(
        isGerman
          ? `${syncStatus.summary.orphanedThreatCount} verwaiste Bedrohung(en)`
          : `${syncStatus.summary.orphanedThreatCount} orphaned threat(s)`
      );
    }

    if (syncStatus.summary.changedReferenceCount > 0) {
      parts.push(
        isGerman
          ? `${syncStatus.summary.changedReferenceCount} geänderte Referenz(en)`
          : `${syncStatus.summary.changedReferenceCount} changed reference(s)`
      );
    }

    return parts.join(", ");
  }, [syncStatus, isGerman]);

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
        isSyncing={isSyncing}
        validation={validation}
        activeMethod={activeMethod}
        threatCount={stats.totalThreats}
        hasThreats={hasThreats}
        hasDFD={hasDFD}
        syncStatus={syncStatus}
        showDFDPreview={showDFDPreview}
        showFilters={showFilters}
        onToggleDFDPreview={() => setShowDFDPreview(!showDFDPreview)}
        onToggleFilters={() => setShowFilters(!showFilters)}
        onMethodChange={handleMethodChange}
        onGenerate={handleGenerateClick}
        onSync={handleSyncClick}
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

      {/* Sync Warning */}
      <Collapse
        in={
          hasDFD && syncStatus !== null && !syncStatus.inSync && showSyncWarning
        }
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Alert
            severity="warning"
            icon={<ErrorIcon />}
            action={
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  color="inherit"
                  startIcon={
                    isSyncing ? <CircularProgress size={16} /> : <SyncIcon />
                  }
                  onClick={handleSyncClick}
                  disabled={isSyncing}
                >
                  {isGerman ? "Synchronisieren" : "Sync"}
                </Button>
                <Button
                  size="small"
                  color="inherit"
                  onClick={() => setShowSyncWarning(false)}
                >
                  {isGerman ? "Ignorieren" : "Dismiss"}
                </Button>
              </Stack>
            }
          >
            <AlertTitle>
              {isGerman
                ? "DFD und Bedrohungen nicht synchron"
                : "DFD and threats out of sync"}
            </AlertTitle>
            {getSyncWarningMessage()}
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
          minHeight: 0, // Important for flex child to respect overflow
        }}
      >
        {/* DFD Preview Panel */}
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

        {/* Threats Table Panel */}
        <Box
          sx={{
            flexGrow: 1,
            flexShrink: 1,
            minHeight: 0, // Critical: allows flex child to shrink below content size
            overflow: "auto",
            p: 2,
          }}
        >
          {hasThreats ? (
            <ThreatTable
              threatTables={activeTables}
              configuration={threatData.configuration}
              showFilters={showFilters}
              onEdit={handleEditThreat}
              onDelete={handleDeleteThreat}
              onAdd={handleAddThreat}
            />
          ) : (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                minHeight: 300,
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
                    'Click "Generate Threats" to automatically create threats based on your DFD.',
                })}
              </Typography>
              <Button
                variant="contained"
                startIcon={<GenerateIcon />}
                onClick={handleGenerateClick}
                disabled={!hasDFD || isGenerating}
              >
                {isGenerating
                  ? t("tabs.threats.generating", {
                      defaultValue: "Generating...",
                    })
                  : t("tabs.threats.generate", {
                      defaultValue: "Generate Threats",
                    })}
              </Button>
            </Box>
          )}
        </Box>
      </Box>

      {/* Dialogs */}
      {showThreatDialog && selectedThreat && (
        <ThreatDialog
          open={showThreatDialog}
          threat={selectedThreat.threat}
          configuration={threatData.configuration}
          onSave={handleSaveThreat}
          onClose={handleCloseThreatDialog}
        />
      )}

      {showConfigDialog && (
        <ThreatConfigDialog
          open={showConfigDialog}
          configuration={threatData.configuration}
          hasExistingThreats={hasThreats}
          onSave={handleSaveConfig}
          onClose={() => setShowConfigDialog(false)}
        />
      )}

      {/* Generate Confirmation Dialog */}
      {showGenerateConfirm && (
        <ConfirmDialog
          title={t("tabs.threats.generateConfirmTitle", {
            defaultValue: "Regenerate Threats?",
          })}
          message={t("tabs.threats.generateConfirmMessage", {
            defaultValue:
              "This will replace all existing threats for the current method. Consider using 'Sync' to only add new threats. Continue?",
          })}
          variant="warning"
          confirmLabel={t("tabs.threats.regenerate", {
            defaultValue: "Regenerate",
          })}
          cancelLabel={t("common.cancel", { defaultValue: "Cancel" })}
          onConfirm={handleGenerateThreats}
          onCancel={() => setShowGenerateConfirm(false)}
        />
      )}

      {/* Sync Confirmation Dialog */}
      {showSyncConfirm && syncStatus && (
        <ConfirmDialog
          title={t("tabs.threats.syncConfirmTitle", {
            defaultValue: "Sync Threats",
          })}
          message={
            isGerman
              ? `Es gibt ${syncStatus.summary.orphanedThreatCount} verwaiste Bedrohung(en) (referenzieren gelöschte DFD-Elemente). Möchten Sie diese entfernen?`
              : `There are ${syncStatus.summary.orphanedThreatCount} orphaned threat(s) (referencing deleted DFD elements). Do you want to remove them?`
          }
          variant="warning"
          confirmLabel={
            isGerman ? "Entfernen & Synchronisieren" : "Remove & Sync"
          }
          cancelLabel={isGerman ? "Nur hinzufügen" : "Only Add New"}
          onConfirm={() => handleSyncThreats(true)}
          onCancel={() => handleSyncThreats(false)}
        />
      )}

      {/* Import Confirmation Dialog */}
      {showImportConfirm && (
        <ConfirmDialog
          title={t("tabs.threats.importConfirmTitle", {
            defaultValue: "Import Threats",
          })}
          message={t("tabs.threats.importConfirmMessage", {
            defaultValue:
              "This will replace all existing threats. Are you sure?",
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
              "This will delete all threats for the current method. This action cannot be undone.",
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

const ThreatsToolbar: React.FC<ThreatsToolbarProps> = ({
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
  const { t, i18n } = useTranslation();
  const isGerman = i18n.language === "de";

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

      {/* Sync Threats */}
      <Tooltip
        title={
          needsSync
            ? isGerman
              ? "Bedrohungen synchronisieren"
              : "Sync Threats"
            : isGerman
            ? "Bedrohungen sind synchron"
            : "Threats are in sync"
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
            ? t("tabs.threats.hideFilters", { defaultValue: "Hide Filters" })
            : t("tabs.threats.showFilters", { defaultValue: "Show Filters" })
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
          label={isGerman ? "Nicht synchron" : "Out of sync"}
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
};

export default ThreatsTab;