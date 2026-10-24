// ==================== ASSETS TAB ====================
// Phase 2: Asset identification and security goals
// Features:
// - Vertical split view with DFD preview (top) and asset table (bottom)
// - Configurable impact criteria
// - CIANAAA security goals with templates
// - DFD synchronization
// - Export/Import functionality

import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
import { ConfirmAssetDeleteDialog, type AssetUsageLookup } from "shared";
import { useTranslation } from "react-i18next";
import { Box, Alert, Collapse, Typography } from "@mui/material";
import { Warning as WarningIcon } from "@mui/icons-material";

import {
  Asset,
  AssetData,
  AssetConfiguration,
  AssetProjectData,
  AssetValidation,
  AssetExportData,
  AssetExportOptions,
  AssetImportOptions,
  AssetUpdateResult,
} from "../models/asset-types";
import { migrateAssetConfiguration } from "../services/asset-migration";
import { calculateOverallImpact } from "../services/asset-impact-calculator";
import { createDefaultAssetData } from "../services/asset-factory";
import { assetService } from "../services/asset-service";
import { AssetsToolbar } from "./asset-toolbar";
import { AssetTable, AssetTableToolbar, type AssetTableView } from "./asset-table";
import { AssetGroupSections } from "./asset-group-sections";
import { AssetDialog } from "./asset-dialog";
import { AssetNotificationPanel } from "./asset-notification-panel";
import {
  assetIdsNeedingReview,
  collectAssetFindings,
  hasImpactRatings,
  type AssetFinding,
} from "../services/asset-validator";
import type { SecurityGoalType } from "../models/asset-security-goals-types";
import { AssetConfigDialog } from "./asset-config-dialog";
import { DFDPreviewPanel } from "shared";
import {
  AssetExportImportDialog,
  ExportImportMode,
} from "./asset-export-import-dialog";
import { useAssetDFDSync } from "../hooks/use-asset-dfd-sync";

// ==================== CONSTANTS ====================

const MIN_PANEL_HEIGHT = 100;
const DEFAULT_DFD_HEIGHT = 250; // Fixed pixel height instead of ratio

// ==================== ASSET TAB PROPS ====================

import type { AssetHazardSummary } from "shared/models/asset-hazard-reference-types"; // or barrel: "shared"
import type { A2AOp, ThreatGoalLink } from "shared";
import { buildAssetLinks } from "../utils/asset-links";
import { a2aOpsFromAssetExport } from "../utils/asset-links-transfer";
import { applyAssetImport, planAssetImport, remapImportedRelations } from "../utils/asset-import";

export interface AssetTabProps {
  project: AssetProjectData;
  onUpdate: (updates: AssetUpdateResult) => void;
  onDFDAssetUpdate?: (
    assetId: string,
    updates: { name?: string; description?: string },
  ) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  onPhaseComplete?: () => void;
  /** Per-asset hazard links, projected by the app layer (workspace-layout). */
  hazardLinks?: Record<string, AssetHazardSummary>;
  /**
   * Project-wide asset deletion (app layer): asset store, DFD, hazards, risks,
   * threats. Without it the tab offers no delete action.
   */
  onDeleteAsset?: (assetId: string) => void;
  /** "Show in graph" from the table (FR-V13): the app opens the DFD tab. */
  onShowInGraph?: (assetId: string) => void;
  /** "Show in table" from the asset graph (FR-V13): mark this row. */
  tableHighlightRequest?: { readonly assetId: string } | null;
  /** Impact lookup for the delete confirm dialog (app layer). */
  assetUsage?: AssetUsageLookup;
  /**
   * Threats of the enabled generators with their linked assets, projected by
   * the app layer. Given → threat ↔ goal cross-checks in the findings panel.
   */
  threatLinks?: ThreatGoalLink[];
}

// ==================== COMPONENT ====================

export const AssetsTab: React.FC<AssetTabProps> = ({
  project,
  onUpdate,
  onDFDAssetUpdate,
  onDirtyChange,
  hazardLinks,
  onDeleteAsset,
  onShowInGraph,
  tableHighlightRequest,
  assetUsage,
  threatLinks,
}) => {
  const { t } = useTranslation();

  // ==================== STATE ====================

  // Asset data (local working copy)
  const [assetData, setAssetData] = useState<AssetData>(() => {
    const data = project.assets ?? createDefaultAssetData();
    // Migrate configuration if needed (for older projects)
    return {
      ...data,
      configuration: migrateAssetConfiguration(data.configuration),
    };
  });

  // UI state
  const [isDirty, setIsDirty] = useState(false);
  const [showDFDPreview, setShowDFDPreview] = useState(true);
  const [dfdPanelHeight, setDfdPanelHeight] = useState(DEFAULT_DFD_HEIGHT);
  const [isResizing, setIsResizing] = useState(false);

  // Asset Links (A2A, read-only) for the dialog; the table builds its own.
  const assetLinksById = useMemo(
    () => buildAssetLinks(assetData.assets, assetData.relations ?? []),
    [assetData.assets, assetData.relations],
  );

  // Dialog state
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [showAssetDialog, setShowAssetDialog] = useState(false);
  /** Where the dialog opens when started from a finding. */
  const [dialogFocus, setDialogFocus] = useState<{
    tab: 0 | 1;
    goal?: SecurityGoalType;
  } | null>(null);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [tempConfig, setTempConfig] = useState<AssetConfiguration | null>(null);
  const [showExportImportDialog, setShowExportImportDialog] = useState(false);
  const [exportImportMode, setExportImportMode] =
    useState<ExportImportMode>("export");

  // Hazard projection for the validation: pure protection targets (endangered,
  // never a cause) need neither a security goal nor a DFD link. Read through a
  // ref so the many validate() call sites below always see the current links.
  const hazardLinksRef = useRef(hazardLinks);
  hazardLinksRef.current = hazardLinks;

  // Validation
  const [validation, setValidation] = useState<AssetValidation | null>(() =>
    project.assets ? assetService.validate(project.assets, hazardLinks) : null,
  );

  const hasSafetyAnnotations = useMemo(
    () =>
      project.dfdAssets?.some((a) =>
        a.linkedElements?.some(
          (l) => l.safety && l.safety.relevance !== "none",
        ),
      ) ?? false,
    [project.dfdAssets],
  );

  // Sync warnings
  const [syncWarnings, setSyncWarnings] = useState<string[]>([]);
  // Result of the last asset import (B14), until dismissed.
  const [importNotice, setImportNotice] = useState<string | null>(null);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number>(0);
  const startHeightRef = useRef<number>(0);
  const syncInProgressRef = useRef<boolean>(false);

  // ==================== EFFECTS ====================

  // Update dirty state
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // Sync from project when it changes — but never while a local edit is
  // still pending write-back (isDirty). Without this guard, ANY external
  // change to project.assets during the 1s auto-save debounce below (e.g.
  // useBidirectionalAssetSync firing for an unrelated asset, or simply a
  // parent re-render passing a new project.assets reference) silently
  // discards whatever was just typed in the Asset Dialog, before the
  // debounced onUpdate() ever had a chance to persist it upward.
  //
  // NOTE ON PROJECT SWITCHING: this effect ONLY handles external updates to
  // the *same* project. A switch to a different project is handled by the
  // parent rendering this component with key={project.id}, which unmounts
  // this instance entirely and mounts a fresh one — so this effect never has
  // to reconcile a project-identity change, and the isDirty guard can never
  // leak one project's edits into another (that was the cross-project
  // overwrite bug). The flush-on-unmount effect below saves any in-flight
  // edit against the OLD project before that teardown happens.
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  // Asset-link operations from an asset import. They ride on the next write
  // of this tab (auto-save or flush on unmount) and are applied by the app
  // layer through the relations service — never written into the store here.
  const pendingA2AOpsRef = useRef<A2AOp[]>([]);
  const takePendingA2AOps = (): { a2aOps?: A2AOp[] } => {
    const ops = pendingA2AOpsRef.current;
    if (ops.length === 0) return {};
    pendingA2AOpsRef.current = [];
    return { a2aOps: ops };
  };

  useEffect(() => {
    if (isDirtyRef.current) return; // a local edit is in flight — don't clobber it
    if (project.assets) {
      const data = {
        ...project.assets,
        configuration: migrateAssetConfiguration(project.assets.configuration),
      };
      setAssetData(data);
      setValidation(assetService.validate(data, hazardLinksRef.current)); // ← immer neu berechnen
    }
  }, [project.assets]);

  // Auto-save when dirty (debounced)
  useEffect(() => {
    if (!isDirty) return;

    const timeoutId = setTimeout(() => {
      const result = assetService.saveAssets(project, assetData, hazardLinksRef.current);

      if (result.success) {
        setAssetData(result.assets);
        setValidation(assetService.validate(result.assets, hazardLinksRef.current));
        setIsDirty(false);

        onUpdate({
          assets: result.assets,
          phaseStatus: result.phaseStatus,
          lastModified: result.lastModified,
          ...takePendingA2AOps(),
        });
      }
    }, 1000); // 1 second debounce

    return () => clearTimeout(timeoutId);
  }, [isDirty, assetData, project, onUpdate]);

  // ── Flush-on-unmount ───────────────────────────────────────────────────
  // With key={project.id} on this component (set by the parent), a project
  // switch unmounts this instance entirely — that is now the ONLY way project
  // identity changes here. If a debounced auto-save was still pending (isDirty)
  // at that moment, React clears the pending setTimeout on unmount and the edit
  // would be silently lost. This flushes it synchronously before teardown.
  //
  // Refs are required (not the state values directly): the empty-dependency
  // cleanup below captures its closure once, at mount, so without refs it would
  // only ever see the assetData / project / onUpdate from that first render,
  // not the latest ones. Each ref is kept current by its own effect.
  const projectRef = useRef(project);
  const assetDataRef = useRef(assetData);
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  useEffect(() => {
    assetDataRef.current = assetData;
  }, [assetData]);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    return () => {
      if (!isDirtyRef.current) return;

      const result = assetService.saveAssets(
        projectRef.current,
        assetDataRef.current,
        hazardLinksRef.current,
      );

      if (result.success) {
        onUpdateRef.current({
          assets: result.assets,
          phaseStatus: result.phaseStatus,
          lastModified: result.lastModified,
          ...takePendingA2AOps(),
        });
      }
      // Best-effort: if saveAssets fails here there is no UI left to surface
      // an error in (the component is already tearing down). Losing an edit
      // made in the final second before a project switch is an acceptable
      // trade-off versus writing it into the wrong project.
    };
  }, []); // empty deps — a true unmount cleanup, not a per-render one

  // Recalculate overall impact when calculation or rounding method changes
  useEffect(() => {
    const { calculationMethod, roundingMethod } = assetData.configuration;

    const updatedAssets = assetData.assets.map((asset) => {
      const overallImpact = calculateOverallImpact(
        asset.impactRatings,
        calculationMethod,
        roundingMethod,
      );

      if (overallImpact === asset.overallImpact) {
        return asset;
      }

      return {
        ...asset,
        overallImpact,
        lastModified: new Date().toISOString(),
      };
    });

    // Only update if something actually changed
    const changed = updatedAssets.some(
      (a, i) => a.overallImpact !== assetData.assets[i].overallImpact,
    );

    if (changed) {
      setAssetData((prev) => ({
        ...prev,
        assets: updatedAssets,
      }));
      setValidation(
        assetService.validate({ ...assetData, assets: updatedAssets }, hazardLinksRef.current),
      );
      markDirty();
    }
  }, [
    assetData.configuration.calculationMethod,
    assetData.configuration.roundingMethod,
  ]);

  // ==================== DIRTY TRACKING ====================

  const markDirty = useCallback(() => {
    if (!isDirty) {
      setIsDirty(true);
    }
  }, [isDirty]);

  // ==================== ASSET HANDLERS ====================

  const handleAddAsset = useCallback(() => {
    const newAsset = assetService.createAsset(assetData);
    setSelectedAsset(newAsset);
    setShowAssetDialog(true);
  }, [assetData]);

  const handleEditAsset = useCallback((asset: Asset) => {
    setDialogFocus(null);
    setSelectedAsset(asset);
    setShowAssetDialog(true);
  }, []);

  const handleSaveAsset = useCallback(
    (asset: Asset) => {
      // Detect name/description change vs DFD source
      const original = assetData.assets.find((a) => a.id === asset.id);
      if (original && asset.source === "dfd" && onDFDAssetUpdate) {
        const updates: { name?: string; description?: string } = {};
        if (original.name !== asset.name) updates.name = asset.name;
        if (original.properties?.description !== asset.properties?.description)
          updates.description = asset.properties?.description;
        if (Object.keys(updates).length > 0)
          onDFDAssetUpdate(asset.id, updates);
      }

      // Rest bleibt gleich
      let updatedData: AssetData;
      if (assetData.assets.find((a) => a.id === asset.id)) {
        updatedData = assetService.updateAsset(assetData, asset);
      } else {
        updatedData = assetService.addAsset(assetData, asset);
      }
      setAssetData(updatedData);
      setValidation(assetService.validate(updatedData, hazardLinksRef.current));
      setShowAssetDialog(false);
      setSelectedAsset(null);
      markDirty();
    },
    [assetData, markDirty, onDFDAssetUpdate],
  );

  // Delete = request → confirm dialog → project-wide deletion in the app
  // layer. The local working copy drops the asset too, so a pending debounced
  // auto-save (isDirty) cannot write it back into the store afterwards.
  const [confirmDeleteAsset, setConfirmDeleteAsset] = useState<Asset | null>(
    null,
  );

  const handleRequestDeleteAsset = useCallback((asset: Asset) => {
    setConfirmDeleteAsset(asset);
  }, []);

  const handleConfirmDeleteAsset = useCallback(() => {
    const asset = confirmDeleteAsset;
    setConfirmDeleteAsset(null);
    if (!asset || !onDeleteAsset) return;
    setAssetData((prev) => {
      const next = assetService.deleteAsset(prev, asset.id);
      setValidation(assetService.validate(next, hazardLinksRef.current));
      return next;
    });
    if (selectedAsset?.id === asset.id) {
      setShowAssetDialog(false);
      setSelectedAsset(null);
    }
    onDeleteAsset(asset.id);
  }, [confirmDeleteAsset, onDeleteAsset, selectedAsset]);

  const handleCloseAssetDialog = useCallback(() => {
    setShowAssetDialog(false);
    setSelectedAsset(null);
  }, []);

  // ==================== CONFIG HANDLERS ====================

  const handleOpenConfig = useCallback(() => {
    setTempConfig({ ...assetData.configuration });
    setShowConfigDialog(true);
  }, [assetData.configuration]);

  const handleConfigChange = useCallback((config: AssetConfiguration) => {
    setTempConfig(config);
  }, []);

  const handleSaveConfig = useCallback(() => {
    if (!tempConfig) return;

    const updatedData = assetService.updateConfiguration(assetData, tempConfig);

    // Update assets to match new configuration
    updatedData.assets = updatedData.assets.map((asset) => {
      // Ensure all criteria from new config are present
      const updatedRatings = tempConfig.impactCriteria.map(
        ({ id: criterionId }) => {
          const existingRating = asset.impactRatings.find(
            (r) => r.criterionId === criterionId,
          );
          return existingRating || { criterionId, value: 0 };
        },
      );

      // Recalculate overall impact with new method
      const overallImpact = calculateOverallImpact(
        updatedRatings,
        tempConfig.calculationMethod,
        tempConfig.roundingMethod,
      );

      return {
        ...asset,
        impactRatings: updatedRatings,
        overallImpact,
        lastModified: new Date().toISOString(),
      };
    });

    setAssetData(updatedData);
    setValidation(assetService.validate(updatedData, hazardLinksRef.current));
    setShowConfigDialog(false);
    setTempConfig(null);
    markDirty();
  }, [tempConfig, assetData, markDirty]);

  const handleCloseConfig = useCallback(() => {
    // Verwerfe Änderungen
    setTempConfig(null);
    setShowConfigDialog(false);
  }, []);

  // ==================== EXPORT/IMPORT HANDLERS ====================

  const handleExport = useCallback(() => {
    setExportImportMode("export");
    setShowExportImportDialog(true);
  }, []);

  const handleImport = useCallback(() => {
    setExportImportMode("import");
    setShowExportImportDialog(true);
  }, []);

  const handleExportComplete = useCallback((options: AssetExportOptions) => {
    // Export is handled in the dialog, just log completion
    console.log("Export completed with options:", options);
  }, []);

  const handleImportComplete = useCallback(
    (data: AssetExportData, options: AssetImportOptions) => {
      let updatedData = { ...assetData };

      // Import configuration if selected
      if (options.importConfiguration && data.configuration) {
        const migratedConfig = migrateAssetConfiguration(data.configuration);
        updatedData = assetService.updateConfiguration(
          updatedData,
          migratedConfig,
        );

        // WICHTIG: Auch die Assets müssen aktualisiert werden, wenn sich die Config ändert
        // Besonders wenn sich impactCriteria geändert haben
        updatedData.assets = updatedData.assets.map((asset) => {
          // Stelle sicher, dass alle Kriterien aus der neuen Config vorhanden sind
          const updatedRatings = migratedConfig.impactCriteria.map(
            ({ id: criterionId }) => {
              const existingRating = asset.impactRatings.find(
                (r) => r.criterionId === criterionId,
              );
              return existingRating || { criterionId, value: 0 };
            },
          );

          // Berechne Overall Impact neu mit neuer Methode
          const overallImpact = calculateOverallImpact(
            updatedRatings,
            migratedConfig.calculationMethod,
            migratedConfig.roundingMethod,
          );

          return {
            ...asset,
            impactRatings: updatedRatings,
            overallImpact,
            lastModified: new Date().toISOString(),
          };
        });

        console.log("Configuration imported:", migratedConfig);
      }

      // Import assets if selected (B14): imported assets are added; one
      // that is already in the project is kept or replaced as decided in the
      // dialog. Nothing is deleted.
      if (options.importAssets && data.assets && data.assets.length > 0) {
        const plan = planAssetImport(updatedData.assets, data.assets);
        const result = applyAssetImport(updatedData, plan, options.decisions ?? {});
        updatedData = { ...updatedData, assets: result.assets, lastModified: new Date().toISOString() };
        // Recalculate impact, HVA and aggregated impact like any edit.
        for (const id of result.touchedIds) {
          const asset = updatedData.assets.find((a) => a.id === id);
          if (asset) updatedData = assetService.updateAsset(updatedData, asset);
        }

        // Asset links between the imported assets (B13), re-pointed to the
        // project's ids: add operations for the relations service, skipping
        // links that already exist. Links of kept assets are not imported.
        pendingA2AOpsRef.current = [
          ...pendingA2AOpsRef.current,
          ...a2aOpsFromAssetExport(remapImportedRelations(data.relations, result.idMap), assetData.relations),
        ];
        setImportNotice(
          t("tabs.assets.exportImport.importResult", {
            ...result.counts,
            defaultValue: `Import: ${result.counts.added} added · ${result.counts.replaced} replaced · ${result.counts.kept} kept`,
          }),
        );
      }

      // Update State
      setAssetData(updatedData);
      setValidation(assetService.validate(updatedData, hazardLinksRef.current));
      markDirty();

      console.log("Import completed. Updated data:", updatedData);
    },
    [assetData, markDirty, t],
  );

  const handleCloseExportImportDialog = useCallback(() => {
    setShowExportImportDialog(false);
  }, []);

  // ==================== DFD SYNC ====================

  const {
    sync: triggerSync,
    isSyncing,
    resetHash,
  } = useAssetDFDSync({
    assetData,
    dfdAssets: project.dfdAssets,
    dfdElements: project.dfdElements,
    dfdConnections: project.dfdConnections,
    onSync: (result) => {
      setSyncWarnings(result.warnings);

      // Only update state if something actually changed
      if (result.hasChanges) {
        setAssetData(result.assetData);
        setValidation(assetService.validate(result.assetData, hazardLinksRef.current));
        markDirty();
      }
    },
    onWarning: (warnings) => {
      // Just set warnings, no toast needed
      setSyncWarnings(warnings);
    },
    autoSync: true, // Auto-sync when DFD changes
    initialSync: true, // Sync on mount if no assets
  });

  // Manual sync handler (for toolbar button)
  const handleSyncFromDFD = useCallback(() => {
    if (isSyncing) return;
    if (!project.dfdAssets || project.dfdAssets.length === 0) {
      setSyncWarnings(["No DFD assets available for synchronization"]);
      return;
    }
    setSyncWarnings([]); // ← clear warnings before sync
    resetHash();
    triggerSync();
  }, [isSyncing, project.dfdAssets, triggerSync]);

  // ==================== SPLIT VIEW RESIZE ====================

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      startYRef.current = e.clientY;
      startHeightRef.current = dfdPanelHeight;
      setIsResizing(true);
    },
    [dfdPanelHeight],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing || !splitContainerRef.current) return;

      e.preventDefault();

      const deltaY = e.clientY - startYRef.current;
      const containerHeight = splitContainerRef.current.clientHeight;
      const maxHeight = containerHeight - MIN_PANEL_HEIGHT - 8; // 8px for handle

      const newHeight = Math.max(
        MIN_PANEL_HEIGHT,
        Math.min(maxHeight, startHeightRef.current + deltaY),
      );

      setDfdPanelHeight(newHeight);
    },
    [isResizing],
  );

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      // Add listeners to document for better tracking
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // ==================== COMPUTED ====================

  const missingInDFD = useMemo(() => {
    if (!project.dfdAssets) return [];
    return assetService.getAssetsMissingInDFD(assetData, project.dfdAssets);
  }, [assetData, project.dfdAssets]);

  const hasWarnings = syncWarnings.length > 0;

  // ==================== RENDER ====================

  // Validation findings, structured — for the panel below the table.
  const findings = useMemo(
    () =>
      collectAssetFindings(
        assetData,
        threatLinks,
        hazardLinks,
        project.requiredImpactScale,
      ),
    [assetData, threatLinks, hazardLinks, project.requiredImpactScale],
  );
  const needsReview = useMemo(() => assetIdsNeedingReview(findings), [findings]);

  // Leveled DFD (6c): one toolbar above all group tables.
  const grouped = !!project.dfdTableGroups;
  const [tableView, setTableView] = useState<AssetTableView>({
    factorsVisible: false,
    reviewOnly: false,
  });
  const reviewFilterActive = grouped && tableView.reviewOnly;
  const groupedAssets = useMemo(
    () =>
      reviewFilterActive
        ? assetData.assets.filter((a) => needsReview.has(a.id))
        : assetData.assets,
    [reviewFilterActive, assetData.assets, needsReview],
  );
  // "Show in table" for an asset the review filter hides lifts the filter —
  // once per request; a later change of the findings does not lift it again.
  const handledHighlight = useRef<AssetTabProps["tableHighlightRequest"]>(null);
  useEffect(() => {
    if (!grouped || !tableHighlightRequest || handledHighlight.current === tableHighlightRequest) return;
    handledHighlight.current = tableHighlightRequest;
    if (!needsReview.has(tableHighlightRequest.assetId)) {
      setTableView((v) => (v.reviewOnly ? { ...v, reviewOnly: false } : v));
    }
  }, [grouped, tableHighlightRequest, needsReview]);

  const handleOpenFinding = useCallback(
    (finding: AssetFinding) => {
      const asset = assetData.assets.find((a) => a.id === finding.assetId);
      if (!asset) return;
      setDialogFocus({ tab: finding.dialogTab, goal: finding.goal });
      setSelectedAsset(asset);
      setShowAssetDialog(true);
    },
    [assetData.assets],
  );

  return (
    <Box
      ref={containerRef}
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Toolbar */}
      <AssetsToolbar
        isDirty={isDirty}
        validation={validation}
        assetCount={assetData.assets.length}
        showDFDPreview={showDFDPreview}
        onToggleDFDPreview={() => setShowDFDPreview(!showDFDPreview)}
        onOpenConfig={handleOpenConfig}
        onExport={handleExport}
        onImport={handleImport}
        onSyncFromDFD={handleSyncFromDFD}
      />
      {importNotice && (
        <Alert
          severity="success"
          sx={{ mx: 2, mt: 1, flexShrink: 0 }}
          onClose={() => setImportNotice(null)}
          data-testid="asset-import-result"
        >
          {importNotice}
        </Alert>
      )}
      {/* Warnings — must not shrink: in this fixed-height column a shrunk
          banner overflowed its box and the DFD preview below was drawn over
          it. The split view shrinks instead (minHeight: 0). */}
      <Collapse in={hasWarnings || missingInDFD.length > 0} sx={{ flexShrink: 0 }}>
        <Box sx={{ px: 2, py: 1, maxHeight: 150, overflow: "auto" }}>
          {syncWarnings.map((warning, i) => (
            <Alert key={i} severity="warning" sx={{ mb: 1 }}>
              {warning}
            </Alert>
          ))}
          {missingInDFD.length > 0 && (
            <Alert severity="info" icon={<WarningIcon />}>
              {t("tabs.assets.missingInDFD", {
                count: missingInDFD.length,
                defaultValue: `${missingInDFD.length} asset(s) not placed in DFD`,
              })}
              : {missingInDFD.map((a) => a.displayId ?? a.name).join(", ")}
            </Alert>
          )}
        </Box>
      </Collapse>

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
              <DFDPreviewPanel
                imageSrc={project.dfdPreviewImage}
                pages={project.dfdPreviewPages}
                //assets={assetData.assets}
              />
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
                // Visual feedback
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

        {/* Leveled DFD (6c): one toolbar for all group tables, outside the
            scroll area so it stays in place. */}
        {grouped && assetData.assets.length > 0 && (
          <Box
            sx={{
              flexShrink: 0,
              mx: 2,
              mt: 1,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
              overflow: "hidden",
            }}
          >
            <AssetTableToolbar
              view={tableView}
              onChange={setTableView}
              needsReview={needsReview}
              reviewCount={assetData.assets.filter((a) => needsReview.has(a.id)).length}
            />
          </Box>
        )}

        {/* Asset Table (Bottom) */}
        <Box
          sx={{
            flexGrow: 1,
            overflow: "auto",
            p: 2,
            minHeight: MIN_PANEL_HEIGHT,
          }}
        >
          {reviewFilterActive && groupedAssets.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }} data-testid="asset-review-empty">
              {t("tabs.assets.reviewFilter.none", { defaultValue: "No asset needs review." })}
            </Typography>
          )}
          <AssetGroupSections
            groups={project.dfdTableGroups}
            assets={grouped ? groupedAssets : assetData.assets}
            highlightRequest={tableHighlightRequest}
            renderTable={(groupAssets, groupKey) => (
              <AssetTable
                assets={groupAssets}
                configuration={assetData.configuration}
                hazardLinks={hazardLinks}
                assetLinkRelations={assetData.relations}
                needsReview={needsReview}
                onEdit={handleEditAsset}
                onDelete={onDeleteAsset ? handleRequestDeleteAsset : undefined}
                onShowInGraph={onShowInGraph ? (a) => onShowInGraph(a.id) : undefined}
                highlightRequest={tableHighlightRequest}
                autoHeight={groupKey !== ""}
                view={groupKey !== "" ? tableView : undefined}
              />
            )}
          />
        </Box>

        {/* Findings — below the table, like the DFD tab */}
        <AssetNotificationPanel findings={findings} onOpen={handleOpenFinding} />
      </Box>
      {/* Asset delete confirm — project-wide, blocked by attack-tree anchors */}
      {confirmDeleteAsset && (
        <ConfirmAssetDeleteDialog
          open
          assetLabel={`${confirmDeleteAsset.displayId ?? ""} · ${confirmDeleteAsset.name}`}
          usage={assetUsage?.(confirmDeleteAsset.id) ?? null}
          onCancel={() => setConfirmDeleteAsset(null)}
          onConfirm={handleConfirmDeleteAsset}
        />
      )}
      {/* Asset Edit Dialog */}
      {selectedAsset && (
        <AssetDialog
          open={showAssetDialog}
          asset={selectedAsset}
          configuration={assetData.configuration}
          onSave={handleSaveAsset}
          onClose={handleCloseAssetDialog}
          damageScenarioMode={project.damageScenarioMode ?? false}
          initialTab={dialogFocus?.tab ?? 0}
          focusGoal={dialogFocus?.goal}
          threatLinks={threatLinks}
          assetLinks={assetLinksById.get(selectedAsset.id)}
        />
      )}
      {/* Configuration Dialog */}
      <AssetConfigDialog
        open={showConfigDialog}
        configuration={tempConfig || assetData.configuration}
        hasSafetyAnnotations={hasSafetyAnnotations}
        mandatoryCriteriaIds={project.mandatoryImpactCriteriaIds ?? []}
        requiredImpactScale={project.requiredImpactScale}
        savedImpactScale={assetData.configuration.impactScale}
        hasImpactRatings={hasImpactRatings(assetData)}
        onChange={handleConfigChange}
        onSave={handleSaveConfig}
        onClose={handleCloseConfig}
      />
      {/* Export/Import Dialog */}
      <AssetExportImportDialog
        open={showExportImportDialog}
        mode={exportImportMode}
        assetData={assetData}
        projectName={project.name}
        onExport={handleExportComplete}
        onImport={handleImportComplete}
        onClose={handleCloseExportImportDialog}
      />
    </Box>
  );
};

export default AssetsTab;