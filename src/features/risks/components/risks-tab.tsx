// ==================== RISKS TAB (PHASE 4) ====================
// Main component for risk assessment
// Features:
// - Vertical split view with DFD/Risk Matrix (top) and risk table (bottom)
// - Toggle between DFD preview and Risk Matrix visualization
// - Configurable assessment methods (Simple/Complex)
// - MoSCoW prioritization with Won't-Risk filtering
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
  Badge,
} from "@mui/material";
import {
  Settings as SettingsIcon,
  Sync as SyncIcon,
  SkipNext as NextIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Warning as WarningIcon,
  Download as ExportIcon,
  Upload as ImportIcon,
  Image as DFDIcon,
  GridOn as MatrixIcon,
  GridView as PerElementIcon,
  AccountTree as PerInteractionIcon,
  DoNotDisturb as WontIcon,
} from "@mui/icons-material";

import {
  Risk,
  RiskData,
  RiskConfiguration,
  RiskTabProps,
  RiskValidation,
  RiskMethodType,
  ThreatReference,
  createDefaultRiskData,
  getActiveRisks,
  getWontRisks,
  getActiveRisksByStrideMethod,
  getWontRisksByStrideMethod,
  getRisksByStrideMethod,
} from "../models/risk-types";
import type { StrideMethod } from "shared";
import { riskService } from "../services/risk-service";
import { RiskTable } from "./risk-table";
import { RiskDialog } from "./risk-dialog";
import { RiskConfigDialog } from "./risk-config-dialog";
import { RiskMatrix } from "./risk-matrix";
import { WontRiskTable } from "./wont-risk-table";
import { DFDPreviewPanel } from "features/assets/components/dfd-preview-panel";
import { ConfirmDialog } from "shared";

// ==================== CONSTANTS ====================

const MIN_PANEL_HEIGHT = 100;
const DEFAULT_TOP_HEIGHT = 250;

type TopPanelView = "dfd" | "matrix";

// ==================== HELPER FUNCTIONS ====================

function ensureValidRiskData(data: RiskData | null | undefined): RiskData {
  const defaultData = createDefaultRiskData();
  if (!data) return defaultData;

  return {
    configuration: data.configuration ?? defaultData.configuration,
    risks: data.risks ?? [],
    validation: data.validation,
    lastModified: data.lastModified ?? defaultData.lastModified,
  };
}

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

  // UI state
  const [isDirty, setIsDirty] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showTopPanel, setShowTopPanel] = useState(true);
  const [topPanelView, setTopPanelView] = useState<TopPanelView>("dfd");
  const [topPanelHeight, setTopPanelHeight] = useState(DEFAULT_TOP_HEIGHT);
  const [isResizing, setIsResizing] = useState(false);
  const [showWontTable, setShowWontTable] = useState(false);

  // Dialog state
  const [selectedRisk, setSelectedRisk] = useState<Risk | null>(null);
  const [showRiskDialog, setShowRiskDialog] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);

  // Validation
  const [validation, setValidation] = useState<RiskValidation | null>(
    project.risks?.validation ?? null
  );

  // Sync warnings
  const [syncWarnings, setSyncWarnings] = useState<string[]>([]);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number>(0);
  const startHeightRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const hasAnyThreats =
    project.perElementThreats.length > 0 ||
    project.perInteractionThreats.length > 0;

  // Count threats per method for badges
  const perElementCount = project.perElementThreats.length;
  const perInteractionCount = project.perInteractionThreats.length;

  // Statistics
  const stats = useMemo(() => {
    return riskService.getStatistics(riskData);
  }, [riskData]);

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

  // ==================== SYNC FROM THREATS ====================

  const handleSyncFromThreats = useCallback(async () => {
    // Combine both threat arrays
    const allThreats = [
      ...project.perElementThreats,
      ...project.perInteractionThreats,
    ];

    if (allThreats.length === 0) {
      setSyncWarnings(["No threats available for synchronization"]);
      return;
    }

    setIsSyncing(true);
    try {
      const result = riskService.syncFromThreats(riskData, allThreats);
      setRiskData(result.riskData);
      setSyncWarnings(result.warnings);
      markDirty();
      setValidation(riskService.validate(result.riskData));
    } finally {
      setIsSyncing(false);
      setShowSyncConfirm(false);
    }
  }, [
    project.perElementThreats,
    project.perInteractionThreats,
    riskData,
    markDirty,
  ]);

  const handleSyncClick = useCallback(() => {
    if (hasRisks) {
      setShowSyncConfirm(true);
    } else {
      handleSyncFromThreats();
    }
  }, [hasRisks, handleSyncFromThreats]);

  // ==================== STRIDE METHOD SWITCHING ====================

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

  // ==================== RISK HANDLERS ====================

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

  // ==================== CONFIG HANDLERS ====================

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

  // ==================== EXPORT / IMPORT ====================

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
    [markDirty]
  );

  // ==================== PROCEED ====================

  const handleProceed = useCallback(() => {
    onPhaseComplete?.();
  }, [onPhaseComplete]);

  // ==================== SPLIT VIEW RESIZE ====================

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      startYRef.current = e.clientY;
      startHeightRef.current = topPanelHeight;
      setIsResizing(true);
    },
    [topPanelHeight]
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

      setTopPanelHeight(newHeight);
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

  // ==================== COMPUTED ====================

  const hasWarnings = syncWarnings.length > 0;

  // Check if sync is needed
  const allThreats = useMemo(
    () => [...project.perElementThreats, ...project.perInteractionThreats],
    [project.perElementThreats, project.perInteractionThreats]
  );

  const totalThreats = allThreats.length;

  // Detailed sync status
  const syncStatus = useMemo(() => {
    const threatIds = new Set(allThreats.map((t) => t.id));
    const riskThreatIds = new Set(riskData.risks.map((r) => r.threatId));

    // New threats without risks
    const newThreats = allThreats.filter((t) => !riskThreatIds.has(t.id));

    // Orphaned risks (threat deleted)
    const orphanedRisks = riskData.risks.filter(
      (r) => !threatIds.has(r.threatId)
    );

    // Changed threat descriptions
    const changedDescriptions = riskData.risks.filter((risk) => {
      const threat = allThreats.find((t) => t.id === risk.threatId);
      return threat && threat.threatDescription !== risk.threatDescription;
    });

    // Changed mitigations (originalMitigation differs)
    const changedMitigations = riskData.risks.filter((risk) => {
      const threat = allThreats.find((t) => t.id === risk.threatId);
      return threat && threat.mitigation !== risk.originalMitigation;
    });

    return {
      newThreats: newThreats.length,
      orphanedRisks: orphanedRisks.length,
      changedDescriptions: changedDescriptions.length,
      changedMitigations: changedMitigations.length,
      needsSync:
        newThreats.length > 0 ||
        orphanedRisks.length > 0 ||
        changedDescriptions.length > 0,
    };
  }, [allThreats, riskData.risks]);

  const needsSync = hasAnyThreats && syncStatus.needsSync;

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
        validation={validation}
        riskMethod={riskMethod}
        activeStrideMethod={activeStrideMethod}
        riskCount={activeRisks.length}
        wontCount={wontRisks.length}
        perElementCount={perElementCount}
        perInteractionCount={perInteractionCount}
        hasRisks={hasRisks}
        hasThreatsForMethod={hasThreatsForMethod}
        hasAnyThreats={hasAnyThreats}
        needsSync={needsSync}
        showTopPanel={showTopPanel}
        topPanelView={topPanelView}
        showWontTable={showWontTable}
        onToggleTopPanel={() => setShowTopPanel(!showTopPanel)}
        onTopPanelViewChange={(view) => setTopPanelView(view)}
        onStrideMethodChange={handleStrideMethodChange}
        onSync={handleSyncClick}
        onOpenConfig={handleOpenConfig}
        onExport={handleExport}
        onImport={handleImport}
        onToggleWontTable={() => setShowWontTable(!showWontTable)}
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
                setSyncWarnings((prev) => prev.filter((_, idx) => idx !== i))
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
        {/* Top Panel (DFD or Risk Matrix) */}
        {showTopPanel && (
          <>
            <Box
              sx={{
                height: topPanelHeight,
                minHeight: MIN_PANEL_HEIGHT,
                flexShrink: 0,
                borderBottom: "1px solid",
                borderColor: "divider",
                overflow: "hidden",
              }}
            >
              {topPanelView === "dfd" ? (
                <DFDPreviewPanel imageSrc={project.dfdPreviewImage} />
              ) : (
                <RiskMatrix
                  risks={activeRisks}
                  configuration={riskData.configuration}
                  onRiskClick={handleEditRisk}
                />
              )}
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

        {/* Risk Table(s) */}
        <Box
          sx={{
            flexGrow: 1,
            overflow: "auto",
            p: 2,
            minHeight: MIN_PANEL_HEIGHT,
          }}
        >
          {!hasAnyThreats ? (
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
            <Stack spacing={2}>
              {/* Active Risks Table */}
              <RiskTable
                risks={activeRisks}
                threats={currentThreats}
                configuration={riskData.configuration}
                strideMethod={activeStrideMethod}
                onEdit={handleEditRisk}
                onPriorityChange={handlePriorityChange}
                onStatusChange={handleStatusChange}
              />

              {/* Won't Risks Table (collapsible) */}
              {wontRisks.length > 0 && showWontTable && (
                <WontRiskTable
                  risks={wontRisks}
                  threats={currentThreats}
                  configuration={riskData.configuration}
                  onEdit={handleEditRisk}
                />
              )}
            </Stack>
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

// ==================== TOOLBAR COMPONENT ====================

interface RisksToolbarProps {
  isDirty: boolean;
  isSyncing: boolean;
  validation: RiskValidation | null;
  riskMethod: RiskMethodType;
  activeStrideMethod: StrideMethod;
  riskCount: number;
  wontCount: number;
  perElementCount: number;
  perInteractionCount: number;
  hasRisks: boolean;
  hasThreatsForMethod: boolean;
  hasAnyThreats: boolean;
  needsSync: boolean;
  showTopPanel: boolean;
  topPanelView: TopPanelView;
  showWontTable: boolean;
  onToggleTopPanel: () => void;
  onTopPanelViewChange: (view: TopPanelView) => void;
  onStrideMethodChange: (
    event: React.MouseEvent<HTMLElement>,
    method: StrideMethod | null
  ) => void;
  onSync: () => void;
  onOpenConfig: () => void;
  onExport: () => void;
  onImport: () => void;
  onToggleWontTable: () => void;
  onProceed: () => void;
}

const RisksToolbar: React.FC<RisksToolbarProps> = ({
  isDirty,
  isSyncing,
  validation,
  riskMethod,
  activeStrideMethod,
  riskCount,
  wontCount,
  perElementCount,
  perInteractionCount,
  hasRisks,
  hasThreatsForMethod,
  hasAnyThreats,
  needsSync,
  showTopPanel,
  topPanelView,
  showWontTable,
  onToggleTopPanel,
  onTopPanelViewChange,
  onStrideMethodChange,
  onSync,
  onOpenConfig,
  onExport,
  onImport,
  onToggleWontTable,
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
      {/* Toggle Top Panel */}
      <Tooltip
        title={
          showTopPanel
            ? t("common.hideDFD", { defaultValue: "Hide Preview" })
            : t("common.showDFD", { defaultValue: "Show Preview" })
        }
      >
        <IconButton onClick={onToggleTopPanel} size="small">
          {showTopPanel ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Tooltip>

      {/* Top Panel View Toggle */}
      {showTopPanel && (
        <ToggleButtonGroup
          value={topPanelView}
          exclusive
          onChange={(_, v) => v && onTopPanelViewChange(v)}
          size="small"
        >
          <ToggleButton value="dfd">
            <Tooltip
              title={t("tabs.risks.showDFD", { defaultValue: "DFD Preview" })}
            >
              <DFDIcon fontSize="small" />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="matrix">
            <Tooltip
              title={t("tabs.risks.showMatrix", {
                defaultValue: "Risk Matrix",
              })}
            >
              <MatrixIcon fontSize="small" />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>
      )}

      <Divider orientation="vertical" flexItem />

      {/* STRIDE Method Toggle */}
      <ToggleButtonGroup
        value={activeStrideMethod}
        exclusive
        onChange={onStrideMethodChange}
        size="small"
      >
        <ToggleButton value="per-element" disabled={perElementCount === 0}>
          <Tooltip
            title={`${t("tabs.risks.perElement", {
              defaultValue: "Per-Element",
            })} (${perElementCount})`}
          >
            <Badge badgeContent={perElementCount} color="primary" max={999}>
              <PerElementIcon fontSize="small" />
            </Badge>
          </Tooltip>
        </ToggleButton>
        <ToggleButton
          value="per-interaction"
          disabled={perInteractionCount === 0}
        >
          <Tooltip
            title={`${t("tabs.risks.perInteraction", {
              defaultValue: "Per-Interaction",
            })} (${perInteractionCount})`}
          >
            <Badge badgeContent={perInteractionCount} color="primary" max={999}>
              <PerInteractionIcon fontSize="small" />
            </Badge>
          </Tooltip>
        </ToggleButton>
      </ToggleButtonGroup>

      <Chip
        label={
          activeStrideMethod === "per-element"
            ? "Per-Element"
            : "Per-Interaction"
        }
        size="small"
        variant="outlined"
      />

      <Divider orientation="vertical" flexItem />

      {/* Sync */}
      <Tooltip
        title={t("tabs.risks.syncFromThreats", {
          defaultValue: "Sync from Threats",
        })}
      >
        <span>
          <IconButton
            onClick={onSync}
            size="small"
            color={needsSync ? "warning" : "default"}
            disabled={!hasAnyThreats || isSyncing}
          >
            {isSyncing ? <CircularProgress size={20} /> : <SyncIcon />}
          </IconButton>
        </span>
      </Tooltip>

      {/* Configuration */}
      <Tooltip
        title={t("tabs.risks.configuration", { defaultValue: "Configuration" })}
      >
        <IconButton onClick={onOpenConfig} size="small">
          <SettingsIcon />
        </IconButton>
      </Tooltip>

      {/* Export */}
      <Tooltip title={t("common.export", { defaultValue: "Export" })}>
        <span>
          <IconButton onClick={onExport} size="small" disabled={!hasRisks}>
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

      {/* Won't Table Toggle */}
      {wontCount > 0 && (
        <Tooltip
          title={
            showWontTable
              ? t("tabs.risks.hideWont", { defaultValue: "Hide Won't Risks" })
              : t("tabs.risks.showWont", { defaultValue: "Show Won't Risks" })
          }
        >
          <IconButton
            onClick={onToggleWontTable}
            size="small"
            color={showWontTable ? "primary" : "default"}
          >
            <Badge badgeContent={wontCount} color="default">
              <WontIcon />
            </Badge>
          </IconButton>
        </Tooltip>
      )}

      <Box sx={{ flexGrow: 1 }} />

      {/* Sync Status */}
      {needsSync && (
        <Chip
          icon={<WarningIcon />}
          label={t("tabs.risks.outOfSync", { defaultValue: "Out of sync" })}
          size="small"
          color="warning"
          variant="outlined"
        />
      )}

      {/* Stats */}
      <Chip
        label={`${riskCount} ${t("tabs.risks.risks", {
          defaultValue: "Risks",
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

export default RisksTab;