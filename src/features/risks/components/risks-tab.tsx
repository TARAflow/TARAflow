// ==================== RISKS TAB (PHASE 4) ====================
// Main component for risk assessment.
//
// Phase 3 additions:
// - Safety factor removal dialog (when safety data disappears from DFD/Asset Tab)
// - Sync calls pass dfd + assetDataRef for asset criteria prefill
// - pendingSafetySourceRemoval checked on mount and project change

import { GoalsClaimsDialog } from "./goals-claims-dialog";
import { ConceptFindingsProvider } from "./concept-findings-context";
import { conceptFindings, conceptWarningsByRisk } from "../services/concept-findings";
import type { CybersecurityConcept } from "shared";
import { collectConfiguredImpactCriteria } from "../services/risk-sync-service";
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
  type Risk,
  type RiskData,
  type RiskProjectData,
  type RiskUpdateResult,
  getActiveRisksByStrideMethod,
  getWontRisksByStrideMethod,
} from "../models/risk-assessment-types";

import { RiskConfiguration, RiskValidation } from "../models/risk-config-types";
import type { StrideMethod } from "shared";
import { riskService } from "../services/risk-service";
import {
  getEligibleThreats,
  collectAllThreats,
  collectAllThreatsUnfiltered,
  applySafetyRemovalDecision,
} from "../services/risk-sync-service";
import { useRiskFilters } from "../hooks/shared/use-risk-filters";
import { riskGroupSections } from "../utils/risk-groups";
import { RiskMatrixGroupSelect } from "./risk-matrix-group-select";
import { RiskSyncBanner } from "./risk-sync-banner";
import { IsoReviewBanner } from "./iso-review-banner";
import { isoReviewItems } from "../models/iso-scenarios";
import { isIsoRiskMode } from "../models/iso-risk-display";
import { RiskTableView } from "./risk-table-view";
import { RiskDialog } from "./risk-dialog";
import { RiskMitigationStatusDialog } from "./risk-mitigation-status-dialog";
import { applyTicketStatesToRisks, linkedTicketKeys } from "../services/ticket-sync";
import type { TicketPort } from "shared/models/ticket-types";

import { RiskConfigDialog } from "./risk-config-dialog";
import { RiskMatrix } from "./risk-matrix";
import { WontRiskTable } from "./wont-risk-table";
import { DFDPreviewPanel } from "shared";
import { ConfirmDialog } from "shared";
import { RisksToolbar } from "./risk-toolbar";
import { useRiskSync } from "../hooks/use-risk-sync";
import { useSplitViewResize } from "shared";
import {
  withRecommendedImpactAggregation,
  withAssetImpactWeights,
  ensureValidRiskData,
  MIN_PANEL_HEIGHT,
  DEFAULT_TOP_HEIGHT,
  MainView,
} from "../utils/risks-tab-helpers";
import { calculateProgress } from "../utils/risk-progress";

// ==================== COMPONENT ====================


export interface RiskTabProps {
  project: RiskProjectData;
  onUpdate: (updates: RiskUpdateResult) => void;
  /** Goals and claims changed (risk dialog, decision 25) — stored by the app layer. */
  onConceptChange?: (concept: CybersecurityConcept) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  /** The issue tracker's adapter (adapters design §4.3); absent = none connected. */
  ticketPort?: TicketPort | null;
}

export const RisksTab: React.FC<RiskTabProps> = ({
  project,
  onUpdate,
  onDirtyChange,
  onConceptChange,
  ticketPort,
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
    () => collectAllThreats(project),
    [
      project.perElementThreats,
      project.perInteractionThreats,
      project.perAttackPathThreats,
      project.isoMode,
    ],
  );

  const allThreatsUnfiltered = useMemo(
    () => collectAllThreatsUnfiltered(project),
    [
      project.perElementThreats,
      project.perInteractionThreats,
      project.perAttackPathThreats,
      project.isoMode,
    ],
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
    // 5b: attack-tree likelihood contributions, built in workspace-layout via
    // buildAttackTreeLikelihoodReferences — feeds the chained
    // syncRisksFromAttackTrees pass inside useRiskSync.
    attackTreeLikelihoods: project.attackTreeLikelihoods,
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
    const perInteractionDisabled = (
      project.disabledStrideMethods ?? []
    ).includes("per-interaction");
    const saved = riskData.configuration?.activeStrideMethod;
    // Auto-select only when a method has NO threats generated at all yet —
    // never based on how many of its threats are confirmed/eligible.
    // Gating on eligibility here would silently force the method back
    // whenever the user manually switches to a method whose threats aren't
    // confirmed yet (e.g. both methods have threats, only per-element is
    // confirmed) — the switch would appear to do nothing. Whether the user
    // can actually work with the method is instead surfaced as an empty
    // state below (see hasEligibleThreatsForMethod).
    let method: StrideMethod;
    if (
      project.perElementThreats.length === 0 &&
      project.perInteractionThreats.length > 0
    ) {
      method = "per-interaction";
    } else if (
      project.perInteractionThreats.length === 0 &&
      project.perElementThreats.length > 0
    ) {
      method = "per-element";
    } else {
      method = saved ?? "per-element";
    }
    // A method the active regulation preset disables (e.g. per-interaction
    // under ISO/SAE 21434) is never selectable — fall back to per-element.
    return perInteractionDisabled && method === "per-interaction"
      ? "per-element"
      : method;
  }, [
    riskData.configuration?.activeStrideMethod,
    project.perElementThreats.length,
    project.perInteractionThreats.length,
    project.disabledStrideMethods,
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

  // Phase 6: attack-path risks (asset-anchored attack trees, 5a) are a THIRD
  // threat source alongside the two STRIDE methods — never per-element, never
  // per-interaction, so they never matched activeStrideMethod above and were
  // silently invisible in the Risk tab regardless of which STRIDE method the
  // project uses. Pulled in unconditionally here; RiskTableView renders them
  // in their own section (design doc: "All trees feed risk, both anchors,
  // both methods").
  const attackPathActiveRisks = useMemo(
    () => getActiveRisksByStrideMethod(riskData.risks, "attack-path"),
    [riskData.risks],
  );
  const attackPathWontRisks = useMemo(
    () => getWontRisksByStrideMethod(riskData.risks, "attack-path"),
    [riskData.risks],
  );

  const hasRisks = riskData.risks.length > 0;
  // Attack-path risks are a separate source; they must show even when the active
  // STRIDE method has no confirmed threats (otherwise the "confirm your
  // per-element threats" empty-state hides them).
  const hasAttackPathRisks =
    attackPathActiveRisks.length > 0 || attackPathWontRisks.length > 0;
  const hasRisksForMethod =
    activeRisks.length > 0 ||
    wontRisks.length > 0 ||
    attackPathActiveRisks.length > 0 ||
    attackPathWontRisks.length > 0;

  // Toolbar counts over every risk the tab shows — the active STRIDE method
  // and the attack-path risks (ISO/SAE 21434 has only these; user
  // 2026-10-30: "0/0 Risks, Not Started" with 17 risks). Assessed: a risk
  // value (ISO) or a calculated score; complete: the progress chip's rule.
  const toolbarRisks = useMemo(
    () => [...activeRisks, ...attackPathActiveRisks],
    [activeRisks, attackPathActiveRisks],
  );
  const assessedRiskCount = useMemo(
    () =>
      toolbarRisks.filter((r) => (r.isoRisk?.value ?? 0) > 0 || r.calculatedRiskBeforeMitigation > 0).length,
    [toolbarRisks],
  );
  const completedRiskCount = useMemo(() => calculateProgress(toolbarRisks).done, [toolbarRisks]);

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

  const hasThreatsForMethod =
    currentThreats.length > 0 ||
    (project.perAttackPathThreats?.length ?? 0) > 0;
  // Threats exist for the active method (hasThreatsForMethod), but that's
  // not enough to assess risks — they must be confirmed/eligible first
  // (see risk-sync-service.getEligibleThreats). Distinguishing this lets us
  // show a "please confirm your threats" hint instead of the generic
  // "sync from threats" prompt, which would otherwise sync nothing and
  // look broken.
  const eligibleCountForMethod =
    activeStrideMethod === "per-element"
      ? perElementEligible
      : perInteractionEligible;
  const hasEligibleThreatsForMethod = eligibleCountForMethod > 0;
  const hasAnyThreats = allThreats.length > 0;
  const perElementCount = project.perElementThreats.length;
  const perInteractionCount = project.perInteractionThreats.length;
  // The validation of the current state, for the toolbar chip (user
  // 2026-10-30 — the stored one was never shown, and may be stale).
  const currentValidation = useMemo(() => riskService.validate(riskData), [riskData]);
  // The method buttons show risks, not threats (user 2026-10-30).
  const risksOfMethod = (method: "per-element" | "per-interaction") =>
    riskData.risks.filter((r) => r.sourceStrideMethod === method).length;
  const dismissed = (threats: readonly { relevance?: string }[]) =>
    threats.filter((th) => th.relevance === "not_relevant").length;
  const needsSync = hasAnyThreats && syncStatus.needsSync;

  const {
    filters,
    setSearchText,
    setPriorityFilter,
    setRiskLevelFilter,
    setScopeFilter,
    setIsoReviewOnly,
    clearFilters,
    filterRisks,
    hasActiveFilters,
  } = useRiskFilters(project.dfdTableGroups?.scope);
  // Leveled DFD (6f): the matrix shows all risks or those of one group
  // (top level / a top-level decomposed multiprocess, like the tables).
  const [matrixGroupChoice, setMatrixGroup] = useState("");
  const tableGroups = project.dfdTableGroups;
  const matrixGroup = tableGroups?.groups.some((g) => g.key === matrixGroupChoice)
    ? matrixGroupChoice
    : "";
  const matrixRisks = useMemo(() => {
    if (!tableGroups || !matrixGroup) {
      return [...activeRisks, ...wontRisks, ...attackPathActiveRisks, ...attackPathWontRisks];
    }
    // Attack-path risks have no DFD item: in no group.
    return (
      riskGroupSections(tableGroups, [...activeRisks, ...wontRisks], currentThreats).find(
        (s) => s.key === matrixGroup,
      )?.risks ?? []
    );
  }, [tableGroups, matrixGroup, activeRisks, wontRisks, attackPathActiveRisks, attackPathWontRisks, currentThreats]);

  const filteredActiveRisks = useMemo(
    () => filterRisks(activeRisks, riskData.configuration, currentThreats),
    [activeRisks, filterRisks, riskData.configuration, currentThreats],
  );

  // ISO/SAE 21434 (3a-3): the filters apply to the attack-path risks too
  // (minus the page filter — they have no DFD item); the decisions to review
  // (E5) cover every risk, the won't list included (Retain → Won't).
  const isoMode = isIsoRiskMode(riskData.configuration);
  const filteredAttackPathRisks = useMemo(
    () =>
      isoMode
        ? filterRisks(attackPathActiveRisks, riskData.configuration, undefined, true)
        : attackPathActiveRisks,
    [isoMode, attackPathActiveRisks, filterRisks, riskData.configuration],
  );
  const isoReview = useMemo(
    () => (isoMode ? isoReviewItems(riskData.risks) : []),
    [isoMode, riskData.risks],
  );
  const shownWontRisks = useMemo(() => {
    const all = [...wontRisks, ...attackPathWontRisks];
    if (!filters.isoReviewOnly) return all;
    const ids = new Set(isoReview.map((i) => i.risk.id));
    return all.filter((r) => ids.has(r.id));
  }, [wontRisks, attackPathWontRisks, filters.isoReviewOnly, isoReview]);

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

  // ── Ticket sync (adapters design §3.3) ──────────────────────────────────
  // One batch on opening the tab and on "Sync tickets" — no polling. Applied
  // to the current risks (a ref, not a snapshot of an interval) through the
  // same updateRisk as the status dialog, and persisted by the auto-save.
  const riskDataRef = useRef(riskData);
  riskDataRef.current = riskData;
  const [ticketSync, setTicketSync] = useState<{ running: boolean; at?: string }>({ running: false });
  const ticketsConnected = !!ticketPort && project.integration?.connection?.status === "connected";
  const hasLinkedTickets = useMemo(() => linkedTicketKeys(riskData.risks).length > 0, [riskData.risks]);

  const syncTickets = useCallback(async () => {
    if (!ticketPort) return;
    const keys = linkedTicketKeys(riskDataRef.current.risks);
    if (keys.length === 0) return;
    setTicketSync((prev) => ({ ...prev, running: true }));
    try {
      const states = await ticketPort.fetchTicketStates(keys);
      const now = new Date().toISOString();
      const current = riskDataRef.current;
      const data = applyTicketStatesToRisks(current, states, now, (d, r) => riskService.updateRisk(d, r));
      if (data !== current) {
        setRiskData(data);
        setIsDirty(true);
      }
      setTicketSync({ running: false, at: now });
    } catch {
      setTicketSync((prev) => ({ ...prev, running: false }));
    }
  }, [ticketPort]);

  useEffect(() => {
    if (ticketsConnected) void syncTickets();
  }, [ticketsConnected, syncTickets]);

  const ticketIssueTypes = project.integration?.connection?.issueTypes;

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

  // Impact aggregation: while there are no risks, the preset's recommendation
  // is taken over directly — no risk value can change. With risks it is only
  // offered in the configuration dialog (preview before applying, design §6).
  // The project's impact set (criteria configured in the Asset Tab) — what
  // "reset to default" restores in the configuration dialog.
  const configuredImpactCriteria = useMemo(
    () => [...collectConfiguredImpactCriteria(project.assetDataRef)],
    [project.assetDataRef],
  );

  // One weight source for impact (design §5.3): follow the asset criterion
  // weights when the configuration says "asset" — or, without risks, switch to
  // them directly. Existing projects with risks switch in the dialog.
  useEffect(() => {
    const next = withAssetImpactWeights(riskData, project.assetDataRef?.criterionWeights);
    if (!next) return;
    setRiskData(next);
    markDirty();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    project.assetDataRef?.criterionWeights,
    riskData.configuration.impactWeightSource,
    riskData.risks.length,
    markDirty,
  ]);

  useEffect(() => {
    const next = withRecommendedImpactAggregation(
      riskData,
      project.recommendedImpactAggregation,
    );
    if (!next) return;
    setRiskData(next);
    markDirty();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    project.recommendedImpactAggregation,
    riskData.risks.length,
    riskData.configuration.impactAggregation,
    markDirty,
  ]);

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
      const isWontRisk = risk.moscowPriority === "wont";

      // Attack-path risks have no trust boundary to group by — page through
      // the other attack-path risks instead (mirrors the dedicated section
      // RiskTableView renders them in).
      if (risk.sourceStrideMethod === "attack-path") {
        const pool = isWontRisk ? attackPathWontRisks : attackPathActiveRisks;
        const index = pool.findIndex((r) => r.id === risk.id);
        setSelectedRiskInfo({
          risks: pool.length > 0 ? pool : [risk],
          index: Math.max(0, index),
        });
        setShowRiskDialog(true);
        return;
      }

      const threat = allThreats.find((t) => t.id === risk.threatId);
      const tbId = threat?.trustBoundaryId ?? null;
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
    [
      activeRisks,
      wontRisks,
      attackPathActiveRisks,
      attackPathWontRisks,
      allThreats,
    ],
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

  // ── Goals & claims (ISO 21434 plan Phase 4, decision 25) ─────────────────
  const [showConceptDialog, setShowConceptDialog] = useState(false);
  // Goals and claims are ISO/SAE 21434 work products: only an iso-21434
  // project shows them (user 2026-10-30, amends decision 25 "every preset");
  // stored data of another preset stays in the file.
  const conceptChange = project.isoMode ? onConceptChange : undefined;
  const conceptFindingList = useMemo(
    () =>
      !project.isoMode
        ? []
        : conceptFindings({
            risks: riskData.risks,
            concept: project.cybersecurityConcept,
            assumptions: project.assumptions,
            isoMode: true,
            today: new Date().toISOString().slice(0, 10),
          }),
    [riskData.risks, project.cybersecurityConcept, project.assumptions, project.isoMode],
  );
  const conceptMarkers = useMemo(() => conceptWarningsByRisk(conceptFindingList), [conceptFindingList]);

  return (
    <ConceptFindingsProvider value={conceptMarkers}>
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
        onSyncTickets={ticketsConnected && hasLinkedTickets ? () => void syncTickets() : undefined}
        ticketSyncing={ticketSync.running}
        ticketSyncedAt={ticketSync.at}
        isDirty={isDirty}
        isSyncing={isSyncing}
        riskMethod={riskMethod}
        activeStrideMethod={activeStrideMethod}
        riskCount={toolbarRisks.length}
        assessedRiskCount={assessedRiskCount}
        completedRiskCount={completedRiskCount}
        wontCount={wontRisks.length}
        perElementCount={perElementCount}
        perInteractionCount={perInteractionCount}
        validation={currentValidation}
        perElementRiskCount={risksOfMethod("per-element")}
        perInteractionRiskCount={risksOfMethod("per-interaction")}
        perElementDismissedCount={dismissed(project.perElementThreats)}
        perInteractionDismissedCount={dismissed(project.perInteractionThreats)}
        canSwitchStrideMethod={canSwitchStrideMethod}
        isoMode={project.isoMode ?? false}
        perInteractionDisabled={(project.disabledStrideMethods ?? []).includes(
          "per-interaction",
        )}
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
        onOpenConcept={conceptChange ? () => setShowConceptDialog(true) : undefined}
        conceptWarningCount={conceptFindingList.filter((f) => f.severity === "warning").length}
      />

      {/* Notifications — self-contained accordion (renders nothing when
          there is nothing to show). */}
      <RiskSyncBanner
        syncWarnings={syncWarnings}
        needsSync={needsSync}
        isSyncing={isSyncing}
        syncStatus={syncStatus}
        onSync={handleSyncClick}
      />
      {isoMode && (
        <IsoReviewBanner
          items={isoReview}
          reviewOnly={!!filters.isoReviewOnly}
          onReviewOnlyChange={(on) => {
            setIsoReviewOnly(on);
            if (on) setShowWontTable(true);
          }}
          onOpen={(risk) => handleEditRisk(risk)}
        />
      )}

      {/* Main Content - Split View */}
      <Box
        ref={splitContainerRef}
        sx={{
          flexGrow: 1,
          minHeight: 0,
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
              <DFDPreviewPanel
              imageSrc={project.dfdPreviewImage}
              pages={project.dfdPreviewPages}
            />
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
              risks={matrixRisks}
              configuration={riskData.configuration}
              onRiskClick={handleEditRisk}
              headerControls={
                <RiskMatrixGroupSelect
                  groups={project.dfdTableGroups}
                  value={matrixGroup}
                  onChange={setMatrixGroup}
                />
              }
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
          ) : !hasThreatsForMethod && !hasAttackPathRisks ? (
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
          ) : !hasEligibleThreatsForMethod && !hasAttackPathRisks ? (
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
                {t("tabs.risks.threatsNotConfirmed", {
                  defaultValue: "Threats not yet confirmed",
                })}
              </Typography>
              <Typography variant="body2">
                {activeStrideMethod === "per-element"
                  ? t("tabs.risks.threatsNotConfirmedPerElementHint", {
                      defaultValue:
                        "Per-Element threats exist but haven't been confirmed yet. Confirm them in the Threat Eval tab before assessing risks here.",
                    })
                  : t("tabs.risks.threatsNotConfirmedPerInteractionHint", {
                      defaultValue:
                        "Per-Interaction threats exist but haven't been confirmed yet. Confirm them in the Threat Eval tab before assessing risks here.",
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
                risks={filteredActiveRisks}
                threats={currentThreats}
                configuration={riskData.configuration}
                strideMethod={activeStrideMethod}
                showFilters={showFilters}
                filters={filters}
                onSearchTextChange={setSearchText}
                onPriorityFilterChange={setPriorityFilter}
                onRiskLevelFilterChange={setRiskLevelFilter}
                onClearFilters={clearFilters}
                onScopeFilterChange={setScopeFilter}
                // "Showing n of m" over every risk the tab shows — the active
                // STRIDE method and the attack-path risks (user 2026-10-30).
                filteredCount={filteredActiveRisks.length + filteredAttackPathRisks.length}
                totalCount={toolbarRisks.length}
                onEdit={handleEditRisk}
                onPriorityChange={handlePriorityChange}
                onTreatmentChange={handleTreatmentChange}
                onImplementationClick={handleImplementationClick}
                attackPathRisks={filteredAttackPathRisks}
                attackPathThreats={project.perAttackPathThreats ?? []}
                groups={project.dfdTableGroups}
              />
              {shownWontRisks.length > 0 &&
                showWontTable && (
                  <Box sx={{ mt: 2 }}>
                    <WontRiskTable
                      risks={shownWontRisks}
                      threats={[
                        ...currentThreats,
                        ...(project.perAttackPathThreats ?? []),
                      ]}
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
          concept={project.cybersecurityConcept}
          onConceptChange={conceptChange}
          allRisks={riskData.risks}
          assumptions={project.assumptions}
          isoMode={project.isoMode}
        />
      )}

      {selectedImplementationRisk && (
        <RiskMitigationStatusDialog
          open={!!selectedImplementationRisk}
          risk={selectedImplementationRisk}
          integrationConnection={project.integration?.connection ?? null}
          ticketPort={ticketsConnected ? ticketPort : null}
          issueTypes={ticketIssueTypes}
          onSave={handleSaveImplementation}
          onClose={handleCloseImplementationDialog}
        />
      )}

      <RiskConfigDialog
        open={showConfigDialog}
        configuration={riskData.configuration}
        onSave={handleSaveConfig}
        onClose={() => setShowConfigDialog(false)}
        riskData={riskData}
        recommendedImpactAggregation={project.recommendedImpactAggregation}
        assetImpactWeights={project.assetDataRef?.criterionWeights}
        configuredImpactCriteria={configuredImpactCriteria}
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

      {conceptChange && showConceptDialog && (
        <GoalsClaimsDialog
          open
          onClose={() => setShowConceptDialog(false)}
          risks={riskData.risks}
          concept={project.cybersecurityConcept}
          onConceptChange={conceptChange}
          findings={conceptFindingList}
          assetDataRef={project.assetDataRef}
          onOpenRisk={(riskId) => {
            const risk = riskData.risks.find((r) => r.id === riskId);
            if (!risk) return;
            setShowConceptDialog(false);
            handleEditRisk(risk);
          }}
        />
      )}
    </Box>
    </ConceptFindingsProvider>
  );
};

export default RisksTab;