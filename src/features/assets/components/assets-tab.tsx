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
import { useTranslation } from "react-i18next";
import { Box, Alert, Collapse } from "@mui/material";
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
  createDefaultAssetData,
  renumberAssets,
} from "../models/asset-types";
import { migrateAssetConfiguration } from "../services/asset-migration";
import { calculateOverallImpact } from "../services/asset-impact-calculator";

import { assetService } from "../services/asset-service";
import { AssetsToolbar } from "./asset-toolbar";
import { AssetTable } from "./asset-table";
import { AssetDialog } from "./asset-dialog";
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

export interface AssetTabProps {
  project: AssetProjectData;
  onUpdate: (updates: AssetUpdateResult) => void;
  onDFDAssetUpdate?: (
    assetId: string,
    updates: { name?: string; description?: string },
  ) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  onPhaseComplete?: () => void;
}

// ==================== COMPONENT ====================

export const AssetsTab: React.FC<AssetTabProps> = ({
  project,
  onUpdate,
  onDFDAssetUpdate,
  onDirtyChange,
  onPhaseComplete,
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

  // Dialog state
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [showAssetDialog, setShowAssetDialog] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [tempConfig, setTempConfig] = useState<AssetConfiguration | null>(null);
  const [showExportImportDialog, setShowExportImportDialog] = useState(false);
  const [exportImportMode, setExportImportMode] =
    useState<ExportImportMode>("export");

  // Validation
  const [validation, setValidation] = useState<AssetValidation | null>(() =>
    project.assets ? assetService.validate(project.assets) : null,
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

  // Sync from project when it changes
  useEffect(() => {
    if (project.assets) {
      const data = {
        ...project.assets,
        configuration: migrateAssetConfiguration(project.assets.configuration),
      };
      setAssetData(data);
      setValidation(assetService.validate(data)); // ← immer neu berechnen
    }
  }, [project.assets]);

  // Auto-save when dirty (debounced)
  useEffect(() => {
    if (!isDirty) return;

    const timeoutId = setTimeout(() => {
      const result = assetService.saveAssets(project, assetData);

      if (result.success) {
        setAssetData(result.assets);
        setValidation(assetService.validate(result.assets));
        setIsDirty(false);

        onUpdate({
          assets: result.assets,
          phaseStatus: result.phaseStatus,
          lastModified: result.lastModified,
        });
      }
    }, 1000); // 1 second debounce

    return () => clearTimeout(timeoutId);
  }, [isDirty, assetData, project, onUpdate]);

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
        assetService.validate({ ...assetData, assets: updatedAssets }),
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
      setValidation(assetService.validate(updatedData));
      setShowAssetDialog(false);
      setSelectedAsset(null);
      markDirty();
    },
    [assetData, markDirty, onDFDAssetUpdate],
  );

  const handleDeleteAsset = useCallback(
    (assetId: string) => {
      const updatedData = assetService.deleteAsset(assetData, assetId);
      setAssetData(updatedData);
      setValidation(assetService.validate(updatedData));
      markDirty();
    },
    [assetData, markDirty],
  );

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
    setValidation(assetService.validate(updatedData));
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

      // Import assets if selected
      if (options.importAssets && data.assets && data.assets.length > 0) {
        if (options.mergeAssets) {
          // Merge: update existing by ID, add new ones
          const existingIds = new Set(updatedData.assets.map((a) => a.id));

          data.assets.forEach((importedAsset) => {
            if (existingIds.has(importedAsset.id)) {
              // Update existing
              updatedData = assetService.updateAsset(
                updatedData,
                importedAsset,
              );
            } else {
              // Add new
              updatedData = assetService.addAsset(updatedData, importedAsset);
            }
          });

          // Renumber to ensure consistency
          updatedData = {
            ...updatedData,
            // assets: renumberAssets(updatedData.assets),
          };
        } else {
          // Replace: clear existing and add imported
          updatedData = {
            ...updatedData,
            // assets: renumberAssets(data.assets),
            lastModified: new Date().toISOString(),
          };
        }
      }

      // Update State
      setAssetData(updatedData);
      setValidation(assetService.validate(updatedData));
      markDirty();

      console.log("Import completed. Updated data:", updatedData);
    },
    [assetData, markDirty],
  );

  const handleCloseExportImportDialog = useCallback(() => {
    setShowExportImportDialog(false);
  }, []);

  // ==================== PROCEED ====================

  const handleProceed = useCallback(() => {
    // Auto-save handles saving, just proceed to next phase
    onPhaseComplete?.();
  }, [onPhaseComplete]);

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
      console.log("[ASSETS-TAB] Sync completed:", result);

      setAssetData(result.assetData);
      setSyncWarnings(result.warnings);

      // Revalidate after sync
      setValidation(assetService.validate(result.assetData));
      markDirty();
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
        onProceed={handleProceed}
      />
      {/* Warnings */}
      <Collapse in={hasWarnings || missingInDFD.length > 0}>
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
              : {missingInDFD.map((a) => a.id).join(", ")}
            </Alert>
          )}
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
              <DFDPreviewPanel
                imageSrc={project.dfdPreviewImage}
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

        {/* Asset Table (Bottom) */}
        <Box
          sx={{
            flexGrow: 1,
            overflow: "auto",
            p: 2,
            minHeight: MIN_PANEL_HEIGHT,
          }}
        >
          <AssetTable
            assets={assetData.assets}
            configuration={assetData.configuration}
            onEdit={handleEditAsset}
          />
        </Box>
      </Box>
      {/* Asset Edit Dialog */}
      {selectedAsset && (
        <AssetDialog
          open={showAssetDialog}
          asset={selectedAsset}
          configuration={assetData.configuration}
          onSave={handleSaveAsset}
          onClose={handleCloseAssetDialog}
        />
      )}
      {/* Configuration Dialog */}
      <AssetConfigDialog
        open={showConfigDialog}
        configuration={tempConfig || assetData.configuration}
        hasSafetyAnnotations={hasSafetyAnnotations}
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