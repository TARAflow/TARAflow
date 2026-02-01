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

import type {
  DFDTabProps,
  DFDViewMode,
  DFDStats,
  AssetRelation,
} from "../models/dfd-types";
import type { ValidationResult } from "../services/dfd-validator";

// Hooks
import { useDFDEditor } from "../hooks/use-dfd-editor";
import { useDFDUIState } from "../hooks/use-dfd-ui-state";
import { useDFDExportImport } from "../hooks/use-dfd-export-import";
import { useIdLabelVisibility } from "../hooks/use-id-label-visibility";
import { useAssetAssignment } from "../hooks/use-asset-assignment";

// Components
import DFDPreviewDialog from "./dfd-preview-dialog";
import DFDValidationPanel from "./dfd-validation-panel";
import DFDDescriptionView from "./dfd-description-view";
import { DFDToolbar } from "./dfd-toolbar";
import { AssetAssignmentDialog } from "./asset-assignment-dialog";

// ==================== CONSTANTS ====================

const DRAWIO_BASE_URL =
  "https://embed.diagrams.net/?embed=1&spin=1&proto=json&configure=1&noExitBtn=1&saveAndExit=0&noSaveBtn=1&libraries=1";

// ==================== COMPONENT ====================

export const DFDTab: React.FC<DFDTabProps> = ({
  project,
  onUpdate,
  onDirtyChange,
  onPhaseComplete,
}) => {
  // ==================== LOCAL UI STATE ====================

  const [showPreview, setShowPreview] = useState(false);

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

  // ==================== BUSINESS LOGIC HOOK ====================

  const editor = useDFDEditor(project, {
    onUpdate,
    onDirtyChange,
    onPhaseComplete,
    darkMode,
    autoValidateInterval: 500,
    autoNumberOnSave: false,
    generateThumbnailOnSave: true,
  });

  // ==================== ASSET ASSIGNMENT HOOK ====================

  const assetAssignment = useAssetAssignment({
    iframeRef: editor.iframeRef,
  });

  // ==================== ID LABEL VISIBILITY HOOK ====================

  const saveWrapper = useCallback(async (): Promise<void> => {
    await editor.save();
    // Return Type wird ignoriert
  }, [editor.save]);

  const idLabelVisibility = useIdLabelVisibility({
    iframeRef: editor.iframeRef as RefObject<HTMLIFrameElement>,
    getCurrentXML: editor.getCurrentXML,
    sendAction: editor.sendAction,
    save: saveWrapper,
  });

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
        // Check if it's from our plugin
        if (event.data?.type === "TARAFLOW_OPEN_ASSET_DIALOG") {
          const { elementId, elementLabel } = event.data.payload;
          console.log("[DFDTab] Opening asset dialog for:", elementId);
          assetAssignment.openDialog(elementId, elementLabel);
        }
      } catch (error) {
        // Ignore parsing errors from other postMessages
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

      {/* Main Content Container - holds both views */}
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
};

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
