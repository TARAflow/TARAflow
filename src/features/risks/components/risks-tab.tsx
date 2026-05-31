// ==================== RISKS TAB (PHASE 4) ====================
// Main component for risk assessment.
//
// Phase 3 additions:
// - Safety factor removal dialog (when safety data disappears from DFD/Asset Tab)
// - Sync calls pass dfd + assetDataRef for asset criteria prefill
// - pendingSafetySourceRemoval checked on mount and project change

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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from "@mui/material";
import {
  Sync as SyncIcon,
  Warning as WarningIcon,
  Security as SecurityIcon,
} from "@mui/icons-material";

import {
  Risk,
  RiskData,
  RiskTabProps,
  getActiveRisksByStrideMethod,
  getWontRisksByStrideMethod,
} from "../models/risk-assessment-types";

import { RiskConfiguration, RiskValidation } from "../models/risk-config-types";
import type { StrideMethod } from "shared";
import { riskService } from "../services/risk-service";
import {
  getEligibleThreats,
  applySafetyRemovalDecision,
} from "../services/risk-sync-service";
import { useRiskFilters } from "../hooks/shared/use-risk-filters";
import { RiskSyncBanner } from "./risk-sync-banner";
import { RiskTableView } from "./risk-table-view";
import { RiskDialog } from "./risk-dialog";
import { RiskMitigationStatusDialog } from "./risk-mitigation-status-dialog";
import { syncAllMitigationTickets } from "../services/jira-mitigation-service";
import type {
  JiraCredentials,
  JiraProject,
} from "../../integration/models/integration-types";

import { RiskConfigDialog } from "./risk-config-dialog";
import { RiskMatrix } from "./risk-matrix";
import { WontRiskTable } from "./wont-risk-table";
import { DFDPreviewPanel } from "shared";
import { ConfirmDialog } from "shared";
import { RisksToolbar } from "./risk-toolbar";
import { useRiskSync } from "../hooks/use-risk-sync";
import { useSplitViewResize } from "shared";
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

  const [riskData, setRiskData] = useState<RiskData>(() =>
    ensureValidRiskData(project.risks),
  );
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

  // Persist UI state
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
  const [selectedRiskInfo, setSelectedRiskInfo] = useState<{
    risks: Risk[];
    index: number;
  } | null>(null);
  const [showRiskDialog, setShowRiskDialog] = useState(false);
  const [selectedImplementationRisk, setSelectedImplementationRisk] =
    useState<Risk | null>(null);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);

  // ── Safety removal dialog ─────────────────────────────────────────────────
  // Shown when safety data disappears from DFD/Asset Tab but the Safety factor
  // was auto-enabled. The user decides whether to keep or remove the factor.
  const [showSafetyRemovalDialog, setShowSafetyRemovalDialog] = useState(false);

  const [validation, setValidation] = useState<RiskValidation | null>(
    project.risks?.validation ?? null,
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ==================== HOOKS ====================

  const {
    topPanelHeight: resizedHeight,
    isResizing,
    handleMouseDown,
    splitContainerRef,
  } = useSplitViewResize({
    defaultHeight: topPanelHeight,
    minHeight: MIN_PANEL_HEIGHT,
  });

  useEffect(() => {
    setTopPanelHeight(resizedHeight);
  }, [resizedHeight]);

  const allThreats = useMemo(
    () =>
      getEligibleThreats([
        ...project.perElementThreats,
        ...project.perInteractionThreats,
      ]),
    [project.perElementThreats, project.perInteractionThreats],
  );

  const allThreatsUnfiltered = useMemo(
    () => [...project.perElementThreats, ...project.perInteractionThreats],
    [project.perElementThreats, project.perInteractionThreats],
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
    // Pass DFD + asset data so sync service can apply safety auto-enable + prefill
    dfd: project.dfd ?? null,
    assetDataRef: project.assetDataRef,
    onUpdate: (updatedData) => {
      setRiskData(updatedData);
      setValidation(riskService.validate(updatedData));
      markDirty();
    },
  });

  // ==================== DERIVED STATE ====================

  const riskMethod = riskData.configuration?.method ?? "complex";

  const perElementEligible = useMemo(
    () => getEligibleThreats(project.perElementThreats).length,
    [project.perElementThreats],
  );
  const perInteractionEligible = useMemo(
    () => getEligibleThreats(project.perInteractionThreats).length,
    [project.perInteractionThreats],
  );

  const activeStrideMethod = useMemo((): StrideMethod => {
    const saved = riskData.configuration?.activeStrideMethod;
    if (perElementEligible === 0 && perInteractionEligible > 0)
      return "per-interaction";
    if (perInteractionEligible === 0 && perElementEligible > 0)
      return "per-element";
    return saved ?? "per-element";
  }, [
    riskData.configuration?.activeStrideMethod,
    perElementEligible,
    perInteractionEligible,
  ]);

  const canSwitchStrideMethod =
    project.perElementThreats.length > 0 &&
    project.perInteractionThreats.length > 0;

  const activeRisks = useMemo(
    () => getActiveRisksByStrideMethod(riskData.risks, activeStrideMethod),
    [riskData.risks, activeStrideMethod],
  );
  const wontRisks = useMemo(
    () => getWontRisksByStrideMethod(riskData.risks, activeStrideMethod),
    [riskData.risks, activeStrideMethod],
  );

  const hasRisks = riskData.risks.length > 0;
  const hasRisksForMethod = activeRisks.length > 0 || wontRisks.length > 0;

  const assessedRiskCount = useMemo(
    () =>
      activeRisks.filter((r) => r.calculatedRiskBeforeMitigation > 0).length,
    [activeRisks],
  );
  const completedRiskCount = useMemo(
    () =>
      activeRisks.filter((r) =>
        r.selectedMitigations.some(
          (m) => m.status === "implemented" || m.status === "verified",
        ),
      ).length,
    [activeRisks],
  );

  const currentThreats = useMemo(
    () =>
      activeStrideMethod === "per-element"
        ? project.perElementThreats
        : project.perInteractionThreats,
    [
      activeStrideMethod,
      project.perElementThreats,
      project.perInteractionThreats,
    ],
  );

  const hasThreatsForMethod = currentThreats.length > 0;
  const hasAnyThreats = allThreats.length > 0;
  const perElementCount = project.perElementThreats.length;
  const perInteractionCount = project.perInteractionThreats.length;
  const needsSync = hasAnyThreats && syncStatus.needsSync;
  const hasWarnings = syncWarnings.length > 0;
  const uncertainCount = syncStatus.uncertainRisks ?? 0;

  const {
    filters,
    setSearchText,
    setPriorityFilter,
    clearFilters,
    filterRisks,
    hasActiveFilters,
  } = useRiskFilters();
  const filteredActiveRisks = useMemo(
    () => filterRisks(activeRisks),
    [activeRisks, filterRisks],
  );

  // ==================== EFFECTS ====================

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    setRiskData(ensureValidRiskData(project.risks));
    setValidation(project.risks?.validation ?? null);
  }, [project.risks]);

  // Auto-sync when risks are empty and asset data is available.
  // Intentionally waits for assetDataRef to be defined so that
  // impact factor auto-enable + criteria prefill run with full asset data.
  // The guard (riskData.risks.length === 0) prevents re-triggering after
  // the first sync populates the risks array.
  useEffect(() => {
    if (riskData.risks.length === 0 && hasAnyThreats && project.assetDataRef) {
      handleSyncFromThreats();
    }
  }, [
    riskData.risks.length,
    hasAnyThreats,
    project.assetDataRef,
    handleSyncFromThreats,
  ]);

  // ── Safety removal dialog: check on mount and when project/riskData changes ──
  // pendingSafetySourceRemoval is set by risk-sync-service when safety data
  // disappears and the Safety factor was autoEnabled.
  useEffect(() => {
    if (riskData.configuration.pendingSafetySourceRemoval) {
      setShowSafetyRemovalDialog(true);
    }
  }, [riskData.configuration.pendingSafetySourceRemoval]);

  // ── Jira project for dialog (resolved from integration connection) ─────────
  const jiraProjectForDialog = useMemo((): JiraProject | null => {
    const conn = project.integration?.connection;
    if (!conn || conn.tool !== "jira" || conn.status !== "connected")
      return null;

    // Use issueTypes from stored connection credentials if available
    // (populated when user tests connection in Integration Tab)
    const storedIssueTypes = (conn.credentials as any)?.issueTypes as
      | Array<{ id: string; name: string; iconUrl?: string }>
      | undefined;

    const issueTypes = storedIssueTypes?.length
      ? storedIssueTypes.filter(
          (it) => !it.name.toLowerCase().includes("subtask"),
        )
      : [
          // Fallback with Jira Cloud standard issue type icons
          { id: "task", name: "Task", iconUrl: undefined },
          { id: "story", name: "Story", iconUrl: undefined },
          { id: "bug", name: "Bug", iconUrl: undefined },
          { id: "feature", name: "Feature", iconUrl: undefined },
          { id: "epic", name: "Epic", iconUrl: undefined },
        ];

    return {
      id: conn.projectName ?? "",
      key: conn.projectName ?? "",
      name: conn.projectName ?? "",
      projectTypeKey: "software",
      issueTypes,
    };
  }, [project.integration?.connection]);

  // ── Auto-sync Jira ticket statuses every 10 seconds ──────────────────────
  // Only runs when Jira is connected and there are mitigations with linked tickets.
  useEffect(() => {
    const conn = project.integration?.connection;
    if (!conn || conn.tool !== "jira" || conn.status !== "connected") return;

    const hasMitigationTickets = riskData.risks.some((r) =>
      r.selectedMitigations.some((m) => !!m.ticketId),
    );
    if (!hasMitigationTickets) return;

    const credentials = conn.credentials as JiraCredentials;

    const interval = setInterval(async () => {
      const updatedRisks = await Promise.all(
        riskData.risks.map(async (risk) => {
          const updatedMitigations = await syncAllMitigationTickets(
            credentials,
            risk.selectedMitigations,
          );
          const mitigationsChanged =
            JSON.stringify(updatedMitigations) !==
            JSON.stringify(risk.selectedMitigations);
          return mitigationsChanged
            ? { ...risk, selectedMitigations: updatedMitigations }
            : risk;
        }),
      );

      const anyChanged = updatedRisks.some((r, i) => r !== riskData.risks[i]);
      if (anyChanged) {
        // Only update local state — do not call onUpdate to avoid
        // triggering main-layout re-render and persistence log every 5s.
        // Changes will be persisted on next manual save.
        setRiskData((prev) => ({ ...prev, risks: updatedRisks }));
      }
    }, 5_000);

    return () => clearInterval(interval);
    // Intentionally exclude riskData.risks from deps to avoid resetting interval
    // on every risk change — stale closure is acceptable for background sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.integration?.connection]);

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
    if (!isDirty) setIsDirty(true);
  }, [isDirty]);

  // ==================== HANDLERS ====================

  const handleSyncClick = useCallback(() => {
    if (hasRisks) setShowSyncConfirm(true);
    else handleSyncFromThreats();
  }, [hasRisks, handleSyncFromThreats]);

  const handleStrideMethodChange = useCallback(
    (_: React.MouseEvent<HTMLElement>, newMethod: StrideMethod | null) => {
      if (!newMethod || newMethod === activeStrideMethod) return;
      const updatedData: RiskData = {
        ...riskData,
        configuration: {
          ...riskData.configuration,
          activeStrideMethod: newMethod,
        },
        lastModified: new Date().toISOString(),
      };
      setRiskData(updatedData);
      markDirty();
    },
    [activeStrideMethod, riskData, markDirty],
  );

  const handleEditRisk = useCallback(
    (risk: Risk, _groupRisks?: Risk[]) => {
      const threat = allThreats.find((t) => t.id === risk.threatId);
      const tbId = threat?.trustBoundaryId ?? null;
      const isWontRisk = risk.moscowPriority === "wont";
      const pool = isWontRisk ? wontRisks : activeRisks;
      const group = pool.filter((r) => {
        const th = allThreats.find((t) => t.id === r.threatId);
        return th?.trustBoundaryId === tbId;
      });
      const effectiveGroup = group.length > 0 ? group : [risk];
      const index = effectiveGroup.findIndex((r) => r.id === risk.id);
      setSelectedRiskInfo({ risks: effectiveGroup, index: Math.max(0, index) });
      setShowRiskDialog(true);
    },
    [activeRisks, wontRisks, allThreats],
  );

  const handleSaveRisk = useCallback(
    (riskId: string, updates: Partial<Risk>) => {
      const existing = riskData.risks.find((r) => r.id === riskId);
      if (!existing) return;
      const updatedData = riskService.updateRisk(riskData, {
        ...existing,
        ...updates,
      });
      setRiskData(updatedData);
      setValidation(riskService.validate(updatedData));
      markDirty();
      if ((updates as any).moscowPriority === "wont") setShowWontTable(true);
    },
    [riskData, markDirty],
  );

  const handleCloseRiskDialog = useCallback(() => {
    setShowRiskDialog(false);
    setSelectedRiskInfo(null);
  }, []);

  const handleImplementationClick = useCallback((risk: Risk) => {
    setSelectedImplementationRisk(risk);
  }, []);

  const handleCloseImplementationDialog = useCallback(() => {
    setSelectedImplementationRisk(null);
  }, []);

  const handleSaveImplementation = useCallback(
    (riskId: string, updates: Partial<Risk>) => {
      const base = riskData.risks.find((r) => r.id === riskId);
      if (!base) return;
      const updatedData = riskService.updateRisk(riskData, {
        ...base,
        ...updates,
      });
      setRiskData(updatedData);
      setValidation(riskService.validate(updatedData));
      markDirty();
      const updated = updatedData.risks.find((r) => r.id === riskId);
      if (updated) setSelectedImplementationRisk(updated);
    },
    [riskData, markDirty],
  );

  const handlePriorityChange = useCallback(
    (riskId: string, priority: string, justification?: string) => {
      const updatedData = riskService.updatePriority(
        riskData,
        riskId,
        priority as any,
        justification,
      );
      setRiskData(updatedData);
      setValidation(riskService.validate(updatedData));
      markDirty();
      if (priority === "wont") setShowWontTable(true);
    },
    [riskData, markDirty],
  );

  const handleTreatmentChange = useCallback(
    (riskId: string, treatment: string) => {
      const updatedData = riskService.updateTreatment(
        riskData,
        riskId,
        treatment as any,
      );
      setRiskData(updatedData);
      setValidation(riskService.validate(updatedData));
      markDirty();
    },
    [riskData, markDirty],
  );

  const handleOpenConfig = useCallback(() => setShowConfigDialog(true), []);

  const handleSaveConfig = useCallback(
    (config: RiskConfiguration) => {
      const updatedData = riskService.updateConfiguration(riskData, config);
      setRiskData(updatedData);
      setValidation(riskService.validate(updatedData));
      setShowConfigDialog(false);
      markDirty();
    },
    [riskData, markDirty],
  );

  const handleExport = useCallback(() => {
    const json = riskService.exportToJSON(riskData);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `risks-${project.name}-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [riskData, project.name]);

  const handleImport = useCallback(() => fileInputRef.current?.click(), []);

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
    [markDirty, setSyncWarnings],
  );

  const handleProceed = useCallback(
    () => onPhaseComplete?.(),
    [onPhaseComplete],
  );

  // ── Safety removal dialog handlers ────────────────────────────────────────

  const handleSafetyRemovalKeep = useCallback(() => {
    const updatedData = applySafetyRemovalDecision(riskData, true);
    setRiskData(updatedData);
    setShowSafetyRemovalDialog(false);
    markDirty();
  }, [riskData, markDirty]);

  const handleSafetyRemovalRemove = useCallback(() => {
    const updatedData = applySafetyRemovalDecision(riskData, false);
    setRiskData(updatedData);
    setShowSafetyRemovalDialog(false);
    markDirty();
  }, [riskData, markDirty]);

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
        canSwitchStrideMethod={canSwitchStrideMethod}
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

      {/* Uncertain Threats Warning */}
      {uncertainCount > 0 && (
        <Alert
          severity="warning"
          icon={<WarningIcon />}
          sx={{ mx: 2, mt: 1, flexShrink: 0 }}
        >
          {t("tabs.risks.uncertainWarning", {
            count: uncertainCount,
            defaultValue: `${uncertainCount} risk(s) are based on uncertain threats — please confirm their relevance in the Threat Eval tab.`,
          })}
        </Alert>
      )}

      {/* Out-of-Sync Alert */}
      <RiskSyncBanner
        needsSync={needsSync}
        isSyncing={isSyncing}
        syncStatus={syncStatus}
        onSync={handleSyncClick}
      />

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

        {/* Main Content Area */}
        <Box sx={{ flexGrow: 1, minHeight: 0, overflow: "auto", px: 2, pt: 1 }}>
          {mainView === "matrix" ? (
            <RiskMatrix
              risks={[...activeRisks, ...wontRisks]}
              configuration={riskData.configuration}
              onRiskClick={handleEditRisk}
            />
          ) : !hasAnyThreats ? (
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
              <RiskTableView
                risks={activeRisks}
                threats={currentThreats}
                configuration={riskData.configuration}
                strideMethod={activeStrideMethod}
                showFilters={showFilters}
                filters={filters}
                onSearchTextChange={setSearchText}
                onPriorityFilterChange={setPriorityFilter}
                onClearFilters={clearFilters}
                filteredCount={activeRisks.length}
                onEdit={handleEditRisk}
                onPriorityChange={handlePriorityChange}
                onTreatmentChange={handleTreatmentChange}
                onImplementationClick={handleImplementationClick}
              />
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
      {selectedRiskInfo && showRiskDialog && (
        <RiskDialog
          open={showRiskDialog}
          risks={selectedRiskInfo.risks}
          initialIndex={selectedRiskInfo.index}
          configuration={riskData.configuration}
          threats={allThreatsUnfiltered}
          assetDataRef={project.assetDataRef}
          dfdData={project.dfd ?? null}
          onSave={handleSaveRisk}
          onClose={handleCloseRiskDialog}
        />
      )}

      {selectedImplementationRisk && (
        <RiskMitigationStatusDialog
          open={!!selectedImplementationRisk}
          risk={selectedImplementationRisk}
          integrationConnection={project.integration?.connection ?? null}
          jiraProject={jiraProjectForDialog}
          onSave={handleSaveImplementation}
          onClose={handleCloseImplementationDialog}
        />
      )}

      <RiskConfigDialog
        open={showConfigDialog}
        configuration={riskData.configuration}
        onSave={handleSaveConfig}
        onClose={() => setShowConfigDialog(false)}
      />

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
          onConfirm={() => {
            handleSyncFromThreats();
            setShowSyncConfirm(false);
          }}
          onCancel={() => setShowSyncConfirm(false)}
        />
      )}

      {/* ── Safety Factor Removal Dialog ─────────────────────────────────── */}
      <Dialog
        open={showSafetyRemovalDialog}
        onClose={() => {
          // Closing without choosing = keep (conservative default)
          handleSafetyRemovalKeep();
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <SecurityIcon color="warning" />
          {t("tabs.risks.safetyRemovalDialog.title", {
            defaultValue: "Safety Factor Source Removed",
          })}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t("tabs.risks.safetyRemovalDialog.message", {
              defaultValue:
                "The safety annotations that automatically enabled the Safety Impact factor have been removed from the DFD and Asset Tab. " +
                "Do you want to keep the Safety Impact factor active?\n\n" +
                "Keeping it preserves existing safety ratings. Removing it will clear all safety factor values from your risk assessments.",
            })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleSafetyRemovalRemove}
            color="error"
            variant="outlined"
          >
            {t("tabs.risks.safetyRemovalDialog.remove", {
              defaultValue: "Remove Safety Factor",
            })}
          </Button>
          <Button
            onClick={handleSafetyRemovalKeep}
            color="primary"
            variant="contained"
            autoFocus
          >
            {t("tabs.risks.safetyRemovalDialog.keep", {
              defaultValue: "Keep Safety Factor",
            })}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default RisksTab;