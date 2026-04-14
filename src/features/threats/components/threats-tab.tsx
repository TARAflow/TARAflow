// ==================== THREATS TAB ====================
// Main orchestrator for threat management
// FIXED: Split view, toolbar connections, export/import, dialog management

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { useTranslation } from "react-i18next";
import { Box, Collapse } from "@mui/material";
import type {
  Threat,
  ThreatData,
  ThreatConfiguration,
  ThreatProjectData,
  ThreatUpdateResult,
  StrideMethod,
} from "../models/threat-types";
import type { PhaseStatusMap } from "shared";
import { createDefaultThreatData } from "../models/threat-types";
import { ThreatToolbar } from "./shared/threat-toolbar";
import { ThreatEvalDialog } from "./shared/threat-dialog";
import { ThreatConfigDialog } from "./shared/threat-config-dialog";
import { ThreatSyncBanner } from "./shared/threat-sync-banner";
import { ElementThreatsView } from "./per-element/element-threats-view";
import { InteractionThreatsView } from "./per-interaction/interaction-threats-view";
import { DFDPreviewPanel } from "shared";
import { useThreatValidation } from "../hooks/shared/use-threat-validation";
import { useThreatsExportImport } from "../hooks/shared/use-threat-export-import";
import { useElementThreats } from "../hooks/per-element/use-element-threats";
import { useInteractionThreats } from "../hooks/per-interaction/use-interaction-threats";
import { ConfirmDialog } from "shared";
import type { DFDAnalysisContext } from "shared";

// ==================== HELPER ====================

function ensureValidThreatData(
  data: ThreatData | null | undefined
): ThreatData {
  const defaultData = createDefaultThreatData();
  if (!data) return defaultData;

  return {
    configuration: data.configuration ?? defaultData.configuration,
    perElementTables: data.perElementTables ?? [],
    perInteractionTables: data.perInteractionTables ?? [],
    lastModified: data.lastModified ?? new Date().toISOString(),
  };
}

// ==================== CONSTANTS ====================

const MIN_PANEL_HEIGHT = 100;
const DEFAULT_DFD_HEIGHT = 250;

// ==================== TAB PROPS ====================

export interface ThreatTabProps {
  project: ThreatProjectData;
  dfdContext: DFDAnalysisContext;
  onUpdate: (updates: ThreatUpdateResult) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  onPhaseComplete?: () => void;
}

// ==================== COMPONENT ====================

export const ThreatsTab: React.FC<ThreatTabProps> = ({
  project,
  dfdContext,
  onUpdate,
  onDirtyChange,
  onPhaseComplete,
}) => {
  const { t } = useTranslation();
  // ==================== STATE ====================

  const [activeMethod, setActiveMethod] = useState<StrideMethod>(
    () => project.threats?.configuration?.activeMethod ?? "per-element",
  );

  const threatData = useMemo(
    () => ensureValidThreatData(project.threats),
    [project.threats],
  );

  const configuration: ThreatConfiguration = useMemo(
    () => ({
      ...threatData.configuration,
      activeMethod,
    }),
    [threatData.configuration, activeMethod],
  );

  const [isDirty, setIsDirty] = useState(false);
  const [showDFDPreview, setShowDFDPreview] = useState(true);
  const [showFilters, setShowFilters] = useState(true);
  const [showSyncWarning, setShowSyncWarning] = useState(true);
  const [dfdPanelHeight, setDfdPanelHeight] = useState(DEFAULT_DFD_HEIGHT);
  const [isResizing, setIsResizing] = useState(false);
  const isResizingRef = useRef(false);

  // Refs
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number>(0);
  const startHeightRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dialog state
  const [selectedThreat, setSelectedThreat] = useState<{
    tableIndex: number;
    threats: Threat[];
    initialIndex: number;
  } | null>(null);
  const [showThreatDialog, setShowThreatDialog] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [pendingImportData, setPendingImportData] = useState<{
    perElementTables: any[];
    perInteractionTables: any[];
  } | null>(null);

  // ==================== HOOKS ====================

  const handleUpdate = useCallback(
    (updatedData: ThreatData) => {
      onUpdate({
        threats: updatedData,
        phaseStatus: [] as unknown as PhaseStatusMap,
        lastModified: new Date().toISOString(),
      });
      onDirtyChange?.(true);
      setIsDirty(true);
    },
    [activeMethod, onUpdate, onDirtyChange],
  );

  // Element threats hook
  const elementHook = useElementThreats({
    project,
    dfdContext,
    configuration,
    onUpdate: handleUpdate,
  });

  // Interaction threats hook

  const interactionHook = useInteractionThreats({
    project,
    dfdContext,
    configuration,
    onUpdate: handleUpdate,
  });

  // Active hook based on method
  const activeHook =
    activeMethod === "per-element" ? elementHook : interactionHook;

  // Validation
  const validation = useThreatValidation(activeHook.tables);

  // Export/Import
  const { exportThreats, validateImportData } = useThreatsExportImport({
    projectId: project.id,
    projectName: project.name,
    activeMethod,
    threatData,
  });

  useEffect(() => {
    const method = project.threats?.configuration?.activeMethod;
    if (method && method !== activeMethod) {
      setActiveMethod(method);
    }
  }, [project.threats?.configuration?.activeMethod]);

  // ==================== HANDLERS ====================

  const handleMethodChange = useCallback(
    (method: StrideMethod) => {
      setActiveMethod(method);
      handleUpdate({
        ...threatData,
        configuration: {
          ...threatData.configuration, // nicht "configuration" aus useMemo verwenden
          activeMethod: method,
        },
      });
    },
    [threatData, handleUpdate],
  );

  const handleMethodChangeFromToolbar = useCallback(
    (_event: React.MouseEvent<HTMLElement>, method: StrideMethod | null) => {
      if (!method) return;
      handleMethodChange(method);
    },
    [handleMethodChange],
  );
  const handleGenerateConfirm = useCallback(async () => {
    setShowGenerateConfirm(false);

    let success = false;

    if (activeMethod === "per-element") {
      success = await elementHook.generateThreats();
    } else {
      success = await interactionHook.generateThreats();
    }

    if (success) {
      setShowSyncWarning(false);
    }
  }, [activeMethod, elementHook, interactionHook]);

  const handleDeleteAllConfirm = useCallback(() => {
    activeHook.deleteAllThreats();
    setShowDeleteAllConfirm(false);
  }, [activeHook]);

  const handleOpenEditDialog = useCallback(
    (tableIndex: number, threat: Threat) => {
      const table = activeHook.tables[tableIndex];
      const initialIndex = Math.max(
        0,
        table.threats.findIndex((t) => t.id === threat.id),
      );
      setSelectedThreat({ tableIndex, threats: table.threats, initialIndex });
      setShowThreatDialog(true);
    },
    [],
  );

  const handleSaveThreat = useCallback(
    (threatId: string, updates: Partial<Threat>) => {
      if (!selectedThreat) return;
      const source = activeHook.tables[selectedThreat.tableIndex]?.threats.find(
        (t) => t.id === threatId,
      );
      if (!source) return;
      activeHook.updateThreat(selectedThreat.tableIndex, {
        ...source,
        ...updates,
      });
    },
    [selectedThreat, activeHook],
  );

  const handleCloseThreatDialog = useCallback(() => {
    setShowThreatDialog(false);
    setSelectedThreat(null);
  }, []);

  const handleSaveConfig = useCallback(
    (newConfig: ThreatConfiguration) => {
      handleUpdate({
        ...threatData,
        configuration: newConfig,
      });
      setShowConfigDialog(false);
    },
    [threatData, handleUpdate],
  );

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
        const result = validateImportData(content);

        if (result.success && result.data) {
          const hasExisting =
            threatData.perElementTables.some((t) => t.threats.length > 0) ||
            threatData.perInteractionTables.some((t) => t.threats.length > 0);

          if (hasExisting) {
            setPendingImportData(result.data);
            setShowImportConfirm(true);
          } else {
            applyImport(result.data);
          }
        } else {
          console.error("Import failed:", result.message);
        }
      };
      reader.readAsText(file);
      event.target.value = "";
    },
    [threatData, validateImportData],
  );

  const applyImport = useCallback(
    (importData: { perElementTables: any[]; perInteractionTables: any[] }) => {
      handleUpdate({
        ...threatData,
        perElementTables: importData.perElementTables,
        perInteractionTables: importData.perInteractionTables,
      });
      setShowImportConfirm(false);
      setPendingImportData(null);
    },
    [threatData, handleUpdate],
  );

  const handleConfirmImport = useCallback(() => {
    if (pendingImportData) {
      applyImport(pendingImportData);
    }
  }, [pendingImportData, applyImport]);

  // ==================== SPLIT VIEW RESIZE ====================

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      startYRef.current = e.clientY;
      startHeightRef.current = dfdPanelHeight;
      isResizingRef.current = true;
      setIsResizing(true);

      // Attach listeners directly — avoids useEffect re-register on every
      // setDfdPanelHeight call which drops events during slow re-renders.
      const onMove = (ev: MouseEvent) => {
        if (!splitContainerRef.current) {
          return;
        }
        const deltaY = ev.clientY - startYRef.current;
        const containerHeight = splitContainerRef.current.clientHeight;
        const maxHeight = containerHeight - MIN_PANEL_HEIGHT - 8;
        const newHeight = Math.max(
          MIN_PANEL_HEIGHT,
          Math.min(maxHeight, startHeightRef.current + deltaY),
        );
        setDfdPanelHeight(newHeight);
      };

      const onUp = () => {
        isResizingRef.current = false;
        setIsResizing(false);
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      document.body.style.userSelect = "none";
      document.body.style.cursor = "row-resize";
    },
    [dfdPanelHeight],
  );

  // ==================== COMPUTED VALUES ====================

  const hasThreats = useMemo(() => {
    return activeHook.tables.some((t) => t.threats.length > 0);
  }, [activeHook.tables]);

  const hasDFD = !!project.dfdElements && project.dfdElements.length > 0;

  // ==================== RENDER ====================

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Hidden file input */}
      <Box
        component="input"
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileSelect}
        sx={{ display: "none" }}
      />

      {/* Toolbar */}
      <ThreatToolbar
        isDirty={isDirty}
        isGenerating={activeHook.isGenerating}
        isSyncing={activeHook.isSyncing}
        validation={validation}
        activeMethod={activeMethod}
        threatCount={activeHook.stats.totalThreats}
        hasThreats={hasThreats}
        hasDFD={hasDFD}
        syncStatus={activeHook.syncStatus}
        showDFDPreview={showDFDPreview}
        showFilters={showFilters}
        onToggleDFDPreview={() => setShowDFDPreview((v) => !v)}
        onToggleFilters={() => setShowFilters((v) => !v)}
        onMethodChange={handleMethodChangeFromToolbar}
        onGenerate={() => setShowGenerateConfirm(true)}
        onSync={() =>
          activeHook.synchronizeThreats({
            updateReferences: true,
            removeOrphaned: true,
          })
        }
        onDeleteAll={() => setShowDeleteAllConfirm(true)}
        onOpenConfig={() => setShowConfigDialog(true)}
        onExport={exportThreats}
        onImport={handleImportClick}
        onProceed={() => onPhaseComplete?.()}
      />

      {/* Sync Warning Banner */}
      <Collapse
        in={
          hasDFD &&
          hasThreats &&
          activeHook.syncStatus !== null &&
          !activeHook.syncStatus.inSync &&
          showSyncWarning
        }
      >
        <Box sx={{ px: 2, py: 1 }}>
          <ThreatSyncBanner
            syncStatus={activeHook.syncStatus}
            onSync={() =>
              activeHook.synchronizeThreats({
                updateReferences: true,
                removeOrphaned: true,
              })
            }
            onDismiss={() => setShowSyncWarning(false)}
            isSyncing={activeHook.isSyncing}
          />
        </Box>
      </Collapse>

      {/* Main Content - Split View */}
      <Box
        ref={splitContainerRef}
        sx={{
          flexGrow: 1,
          flexShrink: 1,
          height: 0, // forces container to exactly its flex-allocated space
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* DFD Preview Panel */}
        {showDFDPreview && (
          <>
            <Box
              sx={{
                height: dfdPanelHeight,
                minHeight: MIN_PANEL_HEIGHT,
                borderBottom: 1,
                borderColor: "divider",
                bgcolor: "background.default",
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
                position: "relative",
                zIndex: 20,
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

        {/* Threats View */}

        <Box
          sx={{
            flexGrow: 1,
            flexShrink: 1,
            height: 0,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            px: 2,
            pt: 2,
          }}
        >
          {activeMethod === "per-element" ? (
            <ElementThreatsView
              tables={elementHook.tables}
              isGenerating={elementHook.isGenerating}
              hasDFD={hasDFD}
              configuration={configuration}
              assetDataRef={project.assetDataRef}
              showThreatActor={configuration.showThreatActor ?? false}
              onGenerate={() => {
                setShowSyncWarning(false);
                void elementHook.generateThreats();
              }}
              onOpenEditDialog={handleOpenEditDialog}
              onDelete={elementHook.deleteThreat}
              showFilters={showFilters}
            />
          ) : (
            <InteractionThreatsView
              tables={interactionHook.tables}
              isGenerating={interactionHook.isGenerating}
              hasDFD={hasDFD}
              configuration={configuration}
              assetDataRef={project.assetDataRef}
              showThreatActor={configuration.showThreatActor ?? false}
              onGenerate={() => {
                setShowSyncWarning(false);
                void interactionHook.generateThreats();
              }}
              onOpenEditDialog={handleOpenEditDialog}
              onDelete={interactionHook.deleteThreat}
              showFilters={showFilters}
            />
          )}
        </Box>
      </Box>

      {/* Threat Dialog */}
      {showThreatDialog && selectedThreat && (
        <ThreatEvalDialog
          open={showThreatDialog}
          threats={activeHook.tables[selectedThreat.tableIndex]?.threats ?? []}
          initialIndex={selectedThreat.initialIndex}
          configuration={configuration}
          assetDataRef={project.assetDataRef}
          onSave={handleSaveThreat}
          onClose={handleCloseThreatDialog}
        />
      )}

      {/* Config Dialog */}
      {showConfigDialog && (
        <ThreatConfigDialog
          open={showConfigDialog}
          configuration={configuration}
          hasExistingThreats={hasThreats}
          onSave={handleSaveConfig}
          onClose={() => setShowConfigDialog(false)}
        />
      )}

      {/* Generate Confirmation */}
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
          onConfirm={handleGenerateConfirm}
          onCancel={() => setShowGenerateConfirm(false)}
        />
      )}

      {/* Import Confirmation */}
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
          onCancel={() => setShowImportConfirm(false)}
        />
      )}

      {/* Delete All Confirmation */}
      {showDeleteAllConfirm && (
        <ConfirmDialog
          title={t("tabs.threats.deleteAllConfirmTitle", {
            defaultValue: "Delete All Threats?",
          })}
          message={t("tabs.threats.deleteAllConfirmMessage", {
            method: activeMethod,
            defaultValue:
              "This will delete all threats for the current method. This action cannot be undone.",
          })}
          variant="danger"
          confirmLabel={t("common.deleteAll", { defaultValue: "Delete All" })}
          cancelLabel={t("common.cancel", { defaultValue: "Cancel" })}
          onConfirm={handleDeleteAllConfirm}
          onCancel={() => setShowDeleteAllConfirm(false)}
        />
      )}
    </Box>
  );
};;

export default ThreatsTab;