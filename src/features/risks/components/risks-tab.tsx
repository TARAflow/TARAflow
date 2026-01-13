// ==================== RISKS TAB (PHASE 4) - REFACTORED ====================
// Main component for risk assessment
// Features:
// - Toggle between Risk Table and Risk Matrix views
// - Optional DFD Preview in split view (top panel)
// - Toggleable filters in Risk Table (search, priority, status)
// - Configurable assessment methods (Simple/Complex)
// - MoSCoW prioritization with Won't-Risk filtering
// - Status-based completion tracking (open → complete)
// - UI state persisted to localStorage (DFD preview, view mode, etc.)
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
  Alert,
  Collapse,
  Button,
  Typography,
  Chip,
  Stack,
} from "@mui/material";
import { Sync as SyncIcon, Warning as WarningIcon } from "@mui/icons-material";

import {
  Risk,
  RiskData,
  RiskConfiguration,
  RiskTabProps,
  RiskValidation,
  getActiveRisksByStrideMethod,
  getWontRisksByStrideMethod,
} from "../models/risk-types";
import type { StrideMethod } from "shared";
import { riskService } from "../services/risk-service";
import { useRiskFilters } from "../hooks/shared/use-risk-filters";
import { RiskTable } from "./risk-table";
import { RiskFilters } from "./risk-filters";
import { RiskDialog } from "./risk-dialog";
import { RiskConfigDialog } from "./risk-config-dialog";
import { RiskMatrix } from "./risk-matrix";
import { WontRiskTable } from "./wont-risk-table";
import { DFDPreviewPanel } from "features/assets/components/dfd-preview-panel";
import { ConfirmDialog } from "shared";
import { RisksToolbar } from "./risk-toolbar";
import { useRiskSync } from "../hooks/use-risk-sync";
import { useSplitViewResize } from "../hooks/use-split-view-resize";
import {
  ensureValidRiskData,
  MIN_PANEL_HEIGHT,
  DEFAULT_TOP_HEIGHT,
  MainView,
} from "../utils/risks-tab-helpers";

// ==================== COMPONENT ====================

export const RisksTab: React.FC<RiskTabProps> = ({
  project,
  onUpdate,
  onDirtyChange,
  onPhaseComplete,
}) => {
  const { t, i18n } = useTranslation();
  const isGerman = i18n.language === "de";

  // ==================== STATE ====================

  // Risk data (local working copy)
  const [riskData, setRiskData] = useState<RiskData>(() =>
    ensureValidRiskData(project.risks)
  );

  // Dirty tracking
  const [isDirty, setIsDirty] = useState(false);

  // UI state with localStorage persistence
  const [showDfdPreview, setShowDfdPreview] = useState(() => {
    const saved = localStorage.getItem("risks-tab-showDfdPreview");
    return saved === "true";
  });
  const [mainView, setMainView] = useState<MainView>(() => {
    const saved = localStorage.getItem("risks-tab-mainView");
    return saved === "table" || saved === "matrix" ? saved : "table";
  });
  const [topPanelHeight, setTopPanelHeight] = useState(() => {
    const saved = localStorage.getItem("risks-tab-topPanelHeight");
    return saved ? parseInt(saved, 10) : DEFAULT_TOP_HEIGHT;
  });
  const [showWontTable, setShowWontTable] = useState(() => {
    const saved = localStorage.getItem("risks-tab-showWontTable");
    return saved === "true";
  });
  const [showFilters, setShowFilters] = useState(() => {
    const saved = localStorage.getItem("risks-tab-showFilters");
    return saved === "true";
  });

  // Persist UI state to localStorage
  useEffect(() => {
    localStorage.setItem("risks-tab-showDfdPreview", String(showDfdPreview));
  }, [showDfdPreview]);

  useEffect(() => {
    localStorage.setItem("risks-tab-mainView", mainView);
  }, [mainView]);

  useEffect(() => {
    localStorage.setItem("risks-tab-topPanelHeight", String(topPanelHeight));
  }, [topPanelHeight]);

  useEffect(() => {
    localStorage.setItem("risks-tab-showWontTable", String(showWontTable));
  }, [showWontTable]);

  useEffect(() => {
    localStorage.setItem("risks-tab-showFilters", String(showFilters));
  }, [showFilters]);

  // Dialog state
  const [selectedRisk, setSelectedRisk] = useState<Risk | null>(null);
  const [showRiskDialog, setShowRiskDialog] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);

  // Validation
  const [validation, setValidation] = useState<RiskValidation | null>(
    project.risks?.validation ?? null
  );

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ==================== HOOKS ====================

  // Split view resize
  const {
    topPanelHeight: resizedHeight,
    isResizing,
    handleMouseDown,
    splitContainerRef,
  } = useSplitViewResize({
    defaultHeight: topPanelHeight,
    minHeight: MIN_PANEL_HEIGHT,
  });

  // Update topPanelHeight when resize changes (for localStorage persistence)
  useEffect(() => {
    setTopPanelHeight(resizedHeight);
  }, [resizedHeight]);

  // Risk sync
  const allThreats = useMemo(
    () => [...project.perElementThreats, ...project.perInteractionThreats],
    [project.perElementThreats, project.perInteractionThreats]
  );

  const {
    isSyncing,
    syncStatus,
    syncWarnings,
    setSyncWarnings,
    handleSyncFromThreats,
  } = useRiskSync({
    allThreats,
    riskData,
    onUpdate: (updatedData) => {
      setRiskData(updatedData);
      setValidation(riskService.validate(updatedData));
      markDirty();
    },
  });

  // ==================== DERIVED STATE ====================

  const riskMethod = riskData.configuration?.method ?? "simple";
  const activeStrideMethod =
    riskData.configuration?.activeStrideMethod ?? "per-element";

  // Filter risks by current STRIDE method
  const activeRisks = useMemo(
    () => getActiveRisksByStrideMethod(riskData.risks, activeStrideMethod),
    [riskData.risks, activeStrideMethod]
  );
  const wontRisks = useMemo(
    () => getWontRisksByStrideMethod(riskData.risks, activeStrideMethod),
    [riskData.risks, activeStrideMethod]
  );

  const hasRisks = riskData.risks.length > 0;
  const hasRisksForMethod = activeRisks.length > 0 || wontRisks.length > 0;

  // Count assessed risks (Before > 0) and completed risks (status !== "open")
  const assessedRiskCount = useMemo(
    () =>
      activeRisks.filter((r) => r.calculatedRiskBeforeMitigation > 0).length,
    [activeRisks]
  );
  const completedRiskCount = useMemo(
    () => activeRisks.filter((r) => r.status !== "open").length,
    [activeRisks]
  );

  // Get threats for current STRIDE method
  const currentThreats = useMemo(() => {
    return activeStrideMethod === "per-element"
      ? project.perElementThreats
      : project.perInteractionThreats;
  }, [
    activeStrideMethod,
    project.perElementThreats,
    project.perInteractionThreats,
  ]);

  const hasThreatsForMethod = currentThreats.length > 0;
  const hasAnyThreats = allThreats.length > 0;

  // Count threats per method for badges
  const perElementCount = project.perElementThreats.length;
  const perInteractionCount = project.perInteractionThreats.length;

  const needsSync = hasAnyThreats && syncStatus.needsSync;
  const hasWarnings = syncWarnings.length > 0;

  const {
    filters,
    setSearchText,
    setPriorityFilter,
    setStatusFilter,
    clearFilters,
    filterRisks,
    hasActiveFilters,
  } = useRiskFilters();

  // NEU: Filtered risks berechnen
  const filteredActiveRisks = useMemo(
    () => filterRisks(activeRisks),
    [activeRisks, filterRisks]
  );

  // ==================== EFFECTS ====================

  // Update dirty state
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // Sync from project when it changes
  useEffect(() => {
    setRiskData(ensureValidRiskData(project.risks));
    setValidation(project.risks?.validation ?? null);
  }, [project.risks]);

  // Auto-sync from threats on mount if no risks
  useEffect(() => {
    if (riskData.risks.length === 0 && hasAnyThreats) {
      handleSyncFromThreats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save when dirty (debounced)
  useEffect(() => {
    if (!isDirty) return;

    const timeoutId = setTimeout(() => {
      const result = riskService.saveRiskData(project, riskData);

      if (result.success) {
        setRiskData(result.risks);
        setValidation(result.risks.validation ?? null);
        setIsDirty(false);

        onUpdate({
          risks: result.risks,
          phaseStatus: result.phaseStatus,
          lastModified: result.lastModified,
        });
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [isDirty, riskData, project, onUpdate]);

  // ==================== DIRTY TRACKING ====================

  const markDirty = useCallback(() => {
    if (!isDirty) {
      setIsDirty(true);
    }
  }, [isDirty]);

  // ==================== HANDLERS ====================

  const handleSyncClick = useCallback(() => {
    if (hasRisks) {
      setShowSyncConfirm(true);
    } else {
      handleSyncFromThreats();
    }
  }, [hasRisks, handleSyncFromThreats]);

  const handleStrideMethodChange = useCallback(
    (_: React.MouseEvent<HTMLElement>, newMethod: StrideMethod | null) => {
      if (!newMethod || newMethod === activeStrideMethod) return;

      const updatedConfig: RiskConfiguration = {
        ...riskData.configuration,
        activeStrideMethod: newMethod,
      };

      const updatedData: RiskData = {
        ...riskData,
        configuration: updatedConfig,
        lastModified: new Date().toISOString(),
      };

      setRiskData(updatedData);
      markDirty();
    },
    [activeStrideMethod, riskData, markDirty]
  );

  const handleEditRisk = useCallback((risk: Risk) => {
    setSelectedRisk(risk);
    setShowRiskDialog(true);
  }, []);

  const handleSaveRisk = useCallback(
    (risk: Risk) => {
      const updatedData = riskService.updateRisk(riskData, risk);
      setRiskData(updatedData);
      setValidation(riskService.validate(updatedData));
      setShowRiskDialog(false);
      setSelectedRisk(null);
      markDirty();

      // Auto-show Won't table when a risk is set to Won't priority
      if (risk.moscowPriority === "wont") {
        setShowWontTable(true);
      }
    },
    [riskData, markDirty]
  );

  const handleCloseRiskDialog = useCallback(() => {
    setShowRiskDialog(false);
    setSelectedRisk(null);
  }, []);

  const handlePriorityChange = useCallback(
    (riskId: string, priority: string, justification?: string) => {
      const updatedData = riskService.updatePriority(
        riskData,
        riskId,
        priority as any,
        justification
      );
      setRiskData(updatedData);
      setValidation(riskService.validate(updatedData));
      markDirty();

      // Auto-show Won't table when a risk is set to Won't priority
      if (priority === "wont") {
        setShowWontTable(true);
      }
    },
    [riskData, markDirty]
  );

  const handleStatusChange = useCallback(
    (riskId: string, status: string) => {
      const updatedData = riskService.updateStatus(
        riskData,
        riskId,
        status as any
      );
      setRiskData(updatedData);
      setValidation(riskService.validate(updatedData));
      markDirty();
    },
    [riskData, markDirty]
  );

  const handleOpenConfig = useCallback(() => {
    setShowConfigDialog(true);
  }, []);

  const handleSaveConfig = useCallback(
    (config: RiskConfiguration) => {
      const updatedData = riskService.updateConfiguration(riskData, config);
      setRiskData(updatedData);
      setValidation(riskService.validate(updatedData));
      setShowConfigDialog(false);
      markDirty();
    },
    [riskData, markDirty]
  );

  const handleExport = useCallback(() => {
    const json = riskService.exportToJSON(riskData);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `risks-${project.name}-${
      new Date().toISOString().split("T")[0]
    }.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [riskData, project.name]);

  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const result = riskService.importFromJSON(text);
        if (result.success && result.data) {
          setRiskData(result.data);
          setValidation(riskService.validate(result.data));
          markDirty();
          setSyncWarnings(["Risk data imported successfully"]);
        } else {
          setSyncWarnings([result.error || "Import failed"]);
        }
      } catch {
        setSyncWarnings(["Failed to read file"]);
      }

      e.target.value = "";
    },
    [markDirty, setSyncWarnings]
  );

  const handleProceed = useCallback(() => {
    onPhaseComplete?.();
  }, [onPhaseComplete]);

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
      {/* Hidden file input for import */}
      <input
        aria-label={t("tabs.risks.importFile", {
          defaultValue: "Import risk data file",
        })}
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {/* Toolbar */}
      <RisksToolbar
        isDirty={isDirty}
        isSyncing={isSyncing}
        riskMethod={riskMethod}
        activeStrideMethod={activeStrideMethod}
        riskCount={activeRisks.length}
        assessedRiskCount={assessedRiskCount}
        completedRiskCount={completedRiskCount}
        wontCount={wontRisks.length}
        perElementCount={perElementCount}
        perInteractionCount={perInteractionCount}
        hasRisks={hasRisks}
        hasThreatsForMethod={hasThreatsForMethod}
        hasAnyThreats={hasAnyThreats}
        needsSync={needsSync}
        showDfdPreview={showDfdPreview}
        mainView={mainView}
        showWontTable={showWontTable}
        showFilters={showFilters}
        onToggleDfdPreview={() => setShowDfdPreview(!showDfdPreview)}
        onMainViewChange={(view) => setMainView(view)}
        onStrideMethodChange={handleStrideMethodChange}
        onSync={handleSyncClick}
        onOpenConfig={handleOpenConfig}
        onExport={handleExport}
        onImport={handleImport}
        onToggleWontTable={() => setShowWontTable(!showWontTable)}
        onToggleFilters={() => setShowFilters(!showFilters)}
        onProceed={handleProceed}
      />

      {/* Warnings */}
      <Collapse in={hasWarnings}>
        <Box sx={{ px: 2, py: 1 }}>
          {syncWarnings.map((warning, i) => (
            <Alert
              key={i}
              severity="info"
              onClose={() =>
                setSyncWarnings(syncWarnings.filter((_, idx) => idx !== i))
              }
              sx={{ mb: 1 }}
            >
              {warning}
            </Alert>
          ))}
        </Box>
      </Collapse>

      {/* Out-of-Sync Alert */}
      <Collapse in={needsSync}>
        <Box sx={{ px: 2, py: 1 }}>
          <Alert
            severity="warning"
            action={
              <Button
                color="warning"
                size="small"
                onClick={handleSyncClick}
                disabled={isSyncing}
              >
                {t("tabs.risks.syncNow", { defaultValue: "Sync Now" })}
              </Button>
            }
          >
            <Stack
              direction="row"
              spacing={2}
              alignItems="center"
              flexWrap="wrap"
            >
              <Typography variant="body2">
                {t("tabs.risks.outOfSyncDetails", {
                  defaultValue: "Risks are out of sync with Threats:",
                })}
              </Typography>
              {syncStatus.newThreats > 0 && (
                <Chip
                  label={`${syncStatus.newThreats} ${t(
                    "tabs.risks.newThreats",
                    { defaultValue: "new" }
                  )}`}
                  size="small"
                  color="success"
                  variant="outlined"
                />
              )}
              {syncStatus.orphanedRisks > 0 && (
                <Chip
                  label={`${syncStatus.orphanedRisks} ${t(
                    "tabs.risks.orphaned",
                    { defaultValue: "orphaned" }
                  )}`}
                  size="small"
                  color="error"
                  variant="outlined"
                />
              )}
              {syncStatus.changedDescriptions > 0 && (
                <Chip
                  label={`${syncStatus.changedDescriptions} ${t(
                    "tabs.risks.changed",
                    { defaultValue: "changed" }
                  )}`}
                  size="small"
                  color="warning"
                  variant="outlined"
                />
              )}
              {syncStatus.changedAttacks > 0 && (
                <Chip
                  label={`${syncStatus.changedAttacks} ${t(
                    "tabs.risks.changed",
                    { defaultValue: "changed" }
                  )}`}
                  size="small"
                  color="warning"
                  variant="outlined"
                />
              )}
            </Stack>
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
        {/* Top Panel (DFD Preview only) */}
        {showDfdPreview && (
          <>
            <Box
              sx={{
                height: resizedHeight,
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
                "&:hover": { backgroundColor: "primary.light" },
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

        {/* Main Content Area (Table or Matrix) */}
        <Box
          sx={{
            flexGrow: 1,
            minHeight: 0,
            overflow: "auto",
            px: 2,
            pt: 1,
          }}
        >
          {mainView === "matrix" ? (
            // Risk Matrix View - show all risks including Won't
            <RiskMatrix
              risks={[...activeRisks, ...wontRisks]}
              configuration={riskData.configuration}
              onRiskClick={handleEditRisk}
            />
          ) : !hasAnyThreats ? (
            // No threats at all
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: "text.secondary",
              }}
            >
              <WarningIcon sx={{ fontSize: 48, mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                {t("tabs.risks.noThreats", {
                  defaultValue: "No threats defined",
                })}
              </Typography>
              <Typography variant="body2">
                {t("tabs.risks.noThreatsHint", {
                  defaultValue:
                    "Please create threats in Phase 3 before assessing risks.",
                })}
              </Typography>
            </Box>
          ) : !hasThreatsForMethod ? (
            // No threats for current STRIDE method
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: "text.secondary",
              }}
            >
              <WarningIcon sx={{ fontSize: 48, mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                {activeStrideMethod === "per-element"
                  ? t("tabs.risks.noPerElementThreats", {
                      defaultValue: "No Per-Element threats defined",
                    })
                  : t("tabs.risks.noPerInteractionThreats", {
                      defaultValue: "No Per-Interaction threats defined",
                    })}
              </Typography>
              <Typography variant="body2">
                {t("tabs.risks.noThreatsForMethodHint", {
                  defaultValue:
                    "Switch to the other method or create threats in Phase 3.",
                })}
              </Typography>
            </Box>
          ) : !hasRisksForMethod ? (
            // Threats exist but no risks yet
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: "text.secondary",
              }}
            >
              <Typography variant="h6" gutterBottom>
                {t("tabs.risks.noRisks", {
                  defaultValue: "No risks assessed yet",
                })}
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                {t("tabs.risks.noRisksHint", {
                  defaultValue:
                    "Click 'Sync from Threats' to create risk assessments.",
                })}
              </Typography>
              <Button
                variant="contained"
                startIcon={<SyncIcon />}
                onClick={handleSyncFromThreats}
                disabled={isSyncing}
              >
                {t("tabs.risks.syncFromThreats", {
                  defaultValue: "Sync from Threats",
                })}
              </Button>
            </Box>
          ) : (
            <>
              {/* Active Risks Table */}
              <RiskTable
                risks={filteredActiveRisks} // ← Statt activeRisks
                threats={currentThreats}
                configuration={riskData.configuration}
                strideMethod={activeStrideMethod}
                showFilters={showFilters}
                filters={filters}
                onSearchTextChange={setSearchText}
                onPriorityFilterChange={setPriorityFilter}
                onStatusFilterChange={setStatusFilter}
                onClearFilters={clearFilters}
                filteredCount={filteredActiveRisks.length}
                onEdit={handleEditRisk}
                onPriorityChange={handlePriorityChange}
                onStatusChange={handleStatusChange}
              />

              {/* Won't Risks Table (collapsible) */}
              {wontRisks.length > 0 && showWontTable && (
                <Box sx={{ mt: 2 }}>
                  <WontRiskTable
                    risks={wontRisks}
                    threats={currentThreats}
                    configuration={riskData.configuration}
                    onEdit={handleEditRisk}
                  />
                </Box>
              )}
            </>
          )}
        </Box>
      </Box>

      {/* Risk Edit Dialog */}
      {selectedRisk && (
        <RiskDialog
          open={showRiskDialog}
          risk={selectedRisk}
          configuration={riskData.configuration}
          threatReference={
            // Find the matching threat reference
            [
              ...project.perElementThreats,
              ...project.perInteractionThreats,
            ].find((t) => t.id === selectedRisk.threatId)
          }
          onSave={handleSaveRisk}
          onClose={handleCloseRiskDialog}
        />
      )}

      {/* Configuration Dialog */}
      <RiskConfigDialog
        open={showConfigDialog}
        configuration={riskData.configuration}
        onSave={handleSaveConfig}
        onClose={() => setShowConfigDialog(false)}
      />

      {/* Sync Confirmation Dialog */}
      {showSyncConfirm && (
        <ConfirmDialog
          title={t("tabs.risks.syncConfirmTitle", {
            defaultValue: "Sync Risks from Threats",
          })}
          message={t("tabs.risks.syncConfirmMessage", {
            defaultValue:
              "This will add new risks for new threats and remove risks for deleted threats. Existing assessments will be preserved.",
          })}
          variant="warning"
          confirmLabel={t("tabs.risks.sync", { defaultValue: "Sync" })}
          cancelLabel={t("common.cancel", { defaultValue: "Cancel" })}
          onConfirm={handleSyncFromThreats}
          onCancel={() => setShowSyncConfirm(false)}
        />
      )}
    </Box>
  );
};

export default RisksTab;
