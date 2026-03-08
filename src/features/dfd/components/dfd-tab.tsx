// ==================== DFD TAB (REFACTORED) ====================
// Single Responsibility: View/UI only - delegates all logic to hooks
// NO business logic, NO data transformation, just rendering and event delegation

import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  RefObject,
} from "react";
import { useTranslation } from "react-i18next";
import { Box, Typography, CircularProgress } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { IconButton } from "@mui/material";

import type {
  AssetGroup,
  DFDTabProps,
  DFDViewMode,
  AssetRelation,
} from "../models/dfd-types";

import type { DFDAsset } from "../models/asset-types";

import type { DFDGraph } from "../models/dfd-graph-types";
import type { ValidationResult } from "../services/dfd-validator";

// Hooks
import { useDFDEditor } from "../hooks/use-dfd-editor";
import { useDFDUIState } from "../hooks/use-dfd-ui-state";
import { useDFDExportImport } from "../hooks/use-dfd-export-import";
import { useAssetAssignment } from "../hooks/use-asset-assignment";
import { useDFDData } from "../hooks/use-dfd-data";
import { useDFDPersistence } from "../hooks/use-dfd-persistence";

// Components
import DFDPreviewDialog from "./dfd-preview-dialog";
import DFDValidationPanel from "./dfd-validation-panel";
import DFDDescriptionView from "./dfd-description-view";
import { DFDToolbar } from "./dfd-toolbar";
import { AssetAssignmentDialog } from "./asset-assignment-dialog";
import { DFDDetailsPanel } from "./dfd-details-panel";
import type { AvailableAsset } from "./forms/asset-relation-selector";
import type { AssetVisibility } from "./dfd-asset-panel";

// ==================== CONSTANTS ====================
// "https://embed.diagrams.net/?embed=1&spin=1&proto=json&configure=1&noExitBtn=1&saveAndExit=0&noSaveBtn=1&libraries=1";
const DRAWIO_BASE_URL = "https://embed.diagrams.net/?embed=1&spin=1&proto=json&plugins=1&configure=1&modified=1&noExitBtn=1&saveAndExit=0&noSaveBtn=1";

// ==================== COMPONENT ====================

export const DFDTab: React.FC<DFDTabProps> = ({
  project,
  onUpdate,
  onDirtyChange,
  onPhaseComplete,
}) => {
  // ==================== LOCAL UI STATE ====================

  const [showPreview, setShowPreview] = useState(false);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(
    null,
  );
  const [detailsPanelOpen, setDetailsPanelOpen] = useState(false);

  // ==================== UI STATE HOOK ====================

  const {
    viewMode,
    setViewMode,
    darkMode,
    toggleDarkMode,
    expandedGroups,
    toggleGroup,
    expandedElements,
    toggleElement,
  } = useDFDUIState({
    projectId: project.id,
  });

  const handleSelectionChanged = useCallback(
    (cells: any[]) => {
      const selectedCell = cells[0];
      const cellId = selectedCell?.xmlId || selectedCell?.id;

      if (!cellId) {
        setSelectedElementId(null);
        setDetailsPanelOpen(false);
        return;
      }

      const element = project.dfd?.elements.find((e) => e.id === cellId);
      const connection = project.dfd?.connections.find((c) => c.id === cellId);

      if (element || connection) {
        setSelectedElementId(cellId);
        setDetailsPanelOpen(true);
      } else {
        console.warn("[DFDTab] ⚠️ Nothing found for ID:", cellId);
      }
    },
    [project],
  );

  // ==================== BUSINESS LOGIC HOOK ====================

  const editor = useDFDEditor(project, {
    onUpdate,
    onDirtyChange,
    onPhaseComplete,
    darkMode,
    autoValidateInterval: 500,
    autoNumberOnSave: false,
    generateThumbnailOnSave: true,
    onSelectionChanged: handleSelectionChanged,
  });

  // ==================== ASSET HOOKS ====================

  const assetAssignment = useAssetAssignment({
    iframeRef: editor.iframeRef,
  });

  const { updateElement, createAsset, dfd } = useDFDData(project);
  const { scheduleSave } = useDFDPersistence(project, { onUpdate });

  // AvailableAssets aus dfd.assets ableiten
  const availableAssets: AvailableAsset[] = useMemo(
    () =>
      (dfd?.assets ?? []).map((a) => ({
        id: a.id,
        displayId: a.displayId,
        name: a.name,
        assetGroup: a.assetGroup,
        protectionNeed: a.protectionNeed,
      })),
    [dfd?.assets],
  );

  // onCreateAsset-Callback — atomar: Asset + DFD updaten
  const handleCreateAsset = useCallback(
    (name: string, assetGroup: AssetGroup): AvailableAsset => {
      const { newDfd, asset } = createAsset(name, assetGroup);

      // DFD persistieren (debounced)
      scheduleSave({
        dfd: newDfd,
        phaseStatus: project.phaseStatus,
        lastModified: newDfd.lastModified!,
      });

      // Zurück an Selector → wird sofort als assetId der neuen Relation verwendet
      return {
        id: asset.id,
        displayId: asset.displayId,
        name: asset.name,
        assetGroup: asset.assetGroup,
        protectionNeed: asset.protectionNeed,
      };
    },
    [createAsset, scheduleSave, project.phaseStatus],
  );

  // Visibility state: per AssetGroup, which assetId is shown in the DFD (null = none)
  const [assetVisibility, setAssetVisibility] = useState<AssetVisibility>({});

  const handleAssetVisibilityChange = useCallback(
    (group: AssetGroup, assetId: string | null) => {
      setAssetVisibility((prev) => ({ ...prev, [group]: assetId }));
      // TODO: trigger draw.io label show/hide via editor.sendAction / iframeRef
    },
    [],
  );

  const handleAssetChange = useCallback(
    (assetId: string, changes: Partial<DFDAsset>) => {
      // Same pattern as updateElement, but for assets
      const updatedAssets = (dfd?.assets ?? []).map((a) =>
        a.id === assetId ? { ...a, ...changes } : a,
      );
      scheduleSave({
        dfd: { ...dfd!, assets: updatedAssets },
        phaseStatus: project.phaseStatus,
        lastModified: new Date().toISOString(),
      });
    },
    [dfd, scheduleSave, project.phaseStatus],
  );

  // ==================== EXPORT/IMPORT HOOK ====================

  const exportImport = useDFDExportImport(
    project,
    {
      iframeRef: editor.iframeRef,
      isLoading: editor.isLoading,
      iframeKey: editor.iframeKey,
      initialize: editor.initialize,
      toggleTheme: () => {}, // Not used here
      loadXML: async () => {}, // Not used here
      getCurrentXML: () => null, // Not used here
      exportImage: async () => null,
      sendAction: () => {},
      onImageReady: () => {},
      selectedCells: editor.selectedCells || [],
    },
    {
      isDirty: editor.isDirty,
      save: editor.save,
      scheduleSave: () => {},
      flush: editor.flushDebouncedSave,
      markDirty: () => {},
      markClean: () => {},
    },
  );

  // ==================== EFFECTS ====================

  // Listen for postMessage from draw.io plugin
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        // Plugin Status (new!)
        if (event.data?.type === "TARAFLOW_PLUGIN_STATUS") {
          console.log("📊 [DFDTab] Plugin status:", event.data.payload);
        }

        // Plugin Loaded
        if (event.data?.type === "TARAFLOW_PLUGIN_LOADED") {
          const { plugin, version } = event.data.payload;
          console.log(`✅ [DFDTab] Plugin loaded: ${plugin} v${version}`);
        }

        // Plugin Error
        if (event.data?.type === "TARAFLOW_PLUGIN_ERROR") {
          const { plugin, error } = event.data.payload;
          console.error(`❌ [DFDTab] Plugin error: ${plugin} - ${error}`);
        }

        // Selection Changed
        if (event.data?.type === "TARAFLOW_SELECTION_CHANGED") {
          const { count, elements } = event.data.payload;
          console.log(`🎯 [DFDTab] Selection: ${count} elements`, elements);
          //setSelectedElements(elements);
        }

        // Asset Dialog (existing)
        if (event.data?.type === "TARAFLOW_OPEN_ASSET_DIALOG") {
          const { elementId, elementLabel } = event.data.payload;
          assetAssignment.openDialog(elementId, elementLabel);
        }
      } catch (error) {
        console.error("[DFDTab] Error handling message:", error);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [assetAssignment]);

  // Auto-save when switching view modes (flush debounced changes immediately)
  useEffect(() => {
    return () => {
      editor.flushDebouncedSave();
    };
  }, [viewMode, editor.flushDebouncedSave]);

  // Reinitialize iframe when switching back to draw mode
  useEffect(() => {
    if (viewMode === "draw" && !editor.isLoading) {
      const timer = setTimeout(() => {
        editor.initialize();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [viewMode, editor.initialize, editor.isLoading]);

  // ==================== HANDLERS (Simple Delegation) ====================

  const handleSave = async () => {
    await editor.save();
  };

  const handleExportImage = () => {
    editor.exportImage();
    setShowPreview(true);
  };

  const handleToggleDarkMode = useCallback(() => {
    toggleDarkMode();
    // Force iframe reload by incrementing key (handled in bridge hook)
    // This is safe to do - the hook manages the lifecycle
  }, [toggleDarkMode]);

  const handleViewModeChange = (
    _event: React.MouseEvent<HTMLElement>,
    newMode: DFDViewMode | null,
  ) => {
    if (newMode !== null) {
      setViewMode(newMode);
    }
  };

  const handleProceed = () => {
    if (!editor.canProceed) {
      return;
    }
    onPhaseComplete?.();
  };

  // Build draw.io URL with dark mode parameter
  const drawioUrl = darkMode
    ? `${DRAWIO_BASE_URL}&ui=dark`
    : `${DRAWIO_BASE_URL}&ui=atlas`;

  /**
   * Handle asset assignment save
   */
  const handleAssetSave = useCallback(
    (relations: AssetRelation[]) => {
      const elementId = assetAssignment.dialogState.elementId;
      if (!elementId) {
        console.error("[DFDTab] No element ID for asset save");
        return;
      }

      console.log("[DFDTab] Saving assets for element:", elementId, relations);

      // Update element with new asset assignments
      editor.updateElementDescription(elementId, {
        assetRelations: relations,
      });
    },
    [assetAssignment.dialogState.elementId, editor],
  );

  // Get current element's assets for dialog
  const currentElement = project.dfd?.elements.find(
    (e) => e.id === assetAssignment.dialogState.elementId,
  );
  const currentRelations = currentElement?.assetRelations || [];

  // Get Selected Item (simplified)
  const selectedElement = selectedElementId
    ? project.dfd?.graph?.elementsById.get(selectedElementId)
    : undefined;

  const selectedConnection = selectedElementId
    ? project.dfd?.graph?.connectionsById.get(selectedElementId)
    : undefined;

  // Check if connection crosses trust boundary (use pre-computed analysis!)
  const crossesTrustBoundary = selectedConnection
    ? (project.dfd?.graph?.dataFlowAnalysis.get(selectedConnection.id)
        ?.crossesTrustBoundary ?? false)
    : false;

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
        isDirty={editor.isDirty}
        validation={editor.validation}
        stats={editor.stats ?? null}
        darkMode={darkMode}
        onToggleDarkMode={handleToggleDarkMode}
        onExportImage={handleExportImage}
        onRefresh={editor.validate}
        onAutoNumber={editor.autoNumberLabels}
        onExport={exportImport.downloadExport}
        onImport={exportImport.promptImport}
        onSave={handleSave}
        onProceed={handleProceed}
        canProceed={editor.canProceed}
      />

      {/* Main Content Container with Drawer */}
      <Box
        sx={{
          flexGrow: 1,
          display: "flex",
          overflow: "hidden",
        }}
      >
        {/* Left: DFD Canvas (Draw/Describe Views) */}
        <Box
          sx={{
            flexGrow: 1,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Draw Mode */}
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              bgcolor: darkMode ? "#1a1a1a" : "grey.100",
              visibility: viewMode === "draw" ? "visible" : "hidden",
              pointerEvents: viewMode === "draw" ? "auto" : "none",
            }}
          >
            {editor.isLoading && <LoadingOverlay darkMode={darkMode} />}

            <iframe
              key={`${project.id}-${editor.iframeKey}`}
              ref={editor.iframeRef as React.RefObject<HTMLIFrameElement>}
              src={drawioUrl}
              style={{
                width: "100%",
                height: "100%",
                border: "none",
                pointerEvents: editor.isLoading ? "none" : "auto",
              }}
              title="DFD Editor"
              onLoad={editor.initialize}
            />
          </Box>

          {/* Description View */}
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              visibility: viewMode === "describe" ? "visible" : "hidden",
              pointerEvents: viewMode === "describe" ? "auto" : "none",
              overflow: "auto",
            }}
          >
            <DFDDescriptionView
              assets={project.dfd?.assets || []}
              elements={project.dfd?.elements || []}
              connections={project.dfd?.connections || []}
              onElementUpdate={editor.updateElementDescription}
              onAssetUpdate={editor.updateAssetDescription}
              onConnectionUpdate={editor.updateConnectionDescription}
              expandedGroups={expandedGroups}
              onToggleGroup={toggleGroup}
              expandedElements={expandedElements}
              onToggleElement={toggleElement}
              onCreateAsset={handleCreateAsset}
            />
          </Box>

          {/* Right: Details Drawer */}
          <DFDDetailsPanel
            open={detailsPanelOpen}
            onToggle={() => setDetailsPanelOpen((prev) => !prev)}
            onClose={() => setDetailsPanelOpen(false)}
            element={selectedElement}
            connection={selectedConnection}
            onChange={(updates) => {
              if (selectedElement) {
                editor.updateElementDescription(selectedElement.id, updates);
              } else if (selectedConnection) {
                editor.updateConnectionDescription(
                  selectedConnection.id,
                  updates,
                );
              }
            }}
            availableAssets={project.dfd?.assets || []}
            crossesTrustBoundary={crossesTrustBoundary}
            onCreateAsset={handleCreateAsset}
            assets={dfd?.assets ?? []}
            elements={dfd?.elements ?? []}
            connections={dfd?.connections ?? []}
            assetVisibility={assetVisibility}
            onAssetVisibilityChange={handleAssetVisibilityChange}
            onAssetChange={handleAssetChange}
          />
        </Box>
      </Box>

      {/* Validation Panel */}
      {editor.validation &&
        (editor.validation.errors.length > 0 ||
          editor.validation.warnings.length > 0) && (
          <DFDValidationPanel validation={editor.validation} />
        )}

      {/* Preview Dialog */}
      <DFDPreviewDialog
        open={showPreview}
        onClose={() => setShowPreview(false)}
        previewImage={editor.previewImage}
        projectName={project.name}
      />

      {/* Asset Assignment Dialog */}
      <AssetAssignmentDialog
        open={assetAssignment.dialogState.open}
        onClose={assetAssignment.closeDialog}
        elementId={assetAssignment.dialogState.elementId}
        elementLabel={assetAssignment.dialogState.elementLabel}
        elementType={currentElement?.type}
        availableAssets={project.dfd?.assets || []}
        currentAssignments={currentRelations}
        onSave={handleAssetSave}
      />
    </Box>
  );
};;;;;

// ==================== SUB-COMPONENTS ====================

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
