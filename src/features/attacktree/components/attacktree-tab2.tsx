// ==================== ATTACK TREE TAB (PHASE 5) - REFACTORED ====================
// Main component for attack tree modeling
// Refactored to use custom hooks for better maintainability
//
// Architecture:
// - useAttackTreeData: Data management and CRUD
// - useAttackTreeEditor: DSL editing with debouncing
// - useAttackTreeUI: UI state and dialogs
// - attackTreeOperations: Pure helper functions

import React, { useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Typography,
  Stack,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  IconButton,
  Tooltip,
  Badge,
  Alert,
  AlertTitle,
  CircularProgress,
  Button,
} from "@mui/material";
import {
  ExpandMore as ExpandMoreIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as ValidIcon,
  Error as InvalidIcon,
  Sync as SyncIcon,
} from "@mui/icons-material";

import {
  AttackTree,
  AttackTreeProjectData,
  MitigationReference,
  AttackTreeUpdateResult,
  AttackTreeTabProps,
  SecurityGoalType,
  AssetReference,
  ThreatReference,
  checkAssetAttackTreeCoverage,
  getAnchorDisplayName,
  getRiskScoreEmoji,
} from "../models/attacktree-types";

// Custom Hooks
import { useAttackTreeData } from "../hooks/use-attacktree-data";
import { useAttackTreeEditor } from "../hooks/use-attacktree-editor";
import { useAttackTreeUI, MainView } from "../hooks/use-attacktree-ui";

// Components
import { AttackTreeToolbar } from "./attacktree-toolbar";
import { AttackTreeEditor } from "./attacktree-editor";
import { AttackTreePreview } from "./attacktree-preview";
import { AttackTreeCreateDialog } from "./attacktree-create-dialog";
import { AttackTreeConfigDialog } from "./attacktree-config-dialog";
import { AttackTreeTableView } from "./attacktree-tableview";
import { DFDPreviewPanel, ConfirmDialog } from "shared";
import { useSplitViewResize, MIN_PANEL_HEIGHT } from "shared";

// ==================== CONSTANTS ====================

const MIN_PANEL_WIDTH = 300;

// ==================== HELPER FUNCTIONS ====================

interface TreeGroup {
  id: string;
  type: "asset" | "threat" | "standalone";
  name: string;
  icon: string;
  trees: AttackTree[];
  isComplete?: boolean;
  missingGoals?: SecurityGoalType[];
}

function groupTrees(
  trees: AttackTree[],
  assets: AssetReference[],
  threats: ThreatReference[],
): TreeGroup[] {
  const groups: TreeGroup[] = [];
  const assetGroups: { [key: string]: AttackTree[] } = {};
  const threatGroups: { [key: string]: AttackTree[] } = {};
  const standaloneTree: AttackTree[] = [];

  // Group trees by anchor type
  trees.forEach((tree) => {
    switch (tree.anchor.type) {
      case "asset":
        const assetId = tree.anchor.assetId || "unknown";
        if (!assetGroups[assetId]) assetGroups[assetId] = [];
        assetGroups[assetId].push(tree);
        break;
      case "threat":
      case "risk":
        const threatId =
          tree.anchor.threatId || tree.anchor.riskId || "unknown";
        if (!threatGroups[threatId]) threatGroups[threatId] = [];
        threatGroups[threatId].push(tree);
        break;
      case "standalone":
      default:
        standaloneTree.push(tree);
        break;
    }
  });

  // Create asset groups
  Object.keys(assetGroups).forEach((assetId) => {
    const asset = assets.find((a) => a.id === assetId);
    const assetTrees = assetGroups[assetId];

    const enabledGoals =
      asset?.securityGoals.filter((sg) => sg.enabled).map((sg) => sg.type) ||
      [];
    const coveredGoals = assetTrees
      .filter((t) => t.anchor.securityGoal)
      .map((t) => t.anchor.securityGoal as SecurityGoalType);
    const missingGoals = enabledGoals.filter((g) => !coveredGoals.includes(g));

    groups.push({
      id: assetId,
      type: "asset",
      name: asset ? `${asset.id}: ${asset.name}` : assetId,
      icon: "📦",
      trees: assetTrees,
      isComplete: missingGoals.length === 0,
      missingGoals: missingGoals,
    });
  });

  // Create threat groups
  Object.keys(threatGroups).forEach((threatId) => {
    const threat = threats.find((t) => t.id === threatId);
    groups.push({
      id: threatId,
      type: "threat",
      name: threat
        ? `${threat.id}: ${
            threat.threatDescription?.substring(0, 40) || "Threat"
          }`
        : threatId,
      icon: "⚠️",
      trees: threatGroups[threatId],
    });
  });

  // Create standalone group
  if (standaloneTree.length > 0) {
    groups.push({
      id: "standalone",
      type: "standalone",
      name: "Standalone Trees",
      icon: "🔍",
      trees: standaloneTree,
    });
  }

  return groups;
}

// ==================== MEMOIZED EDITOR VIEW ====================

interface AttackTreeEditorViewProps {
  selectedTree: AttackTree;
  localDsl: string;
  editorCollapsed: boolean;
  editorWidthPercent: number;
  handleDslChange: (dsl: string) => void;
  toggleEditorCollapsed: () => void;
  mitigationLookup: Map<string, MitigationReference>;
}

const AttackTreeEditorView = React.memo<AttackTreeEditorViewProps>(
  ({
    selectedTree,
    localDsl,
    editorCollapsed,
    editorWidthPercent,
    handleDslChange,
    toggleEditorCollapsed,
    mitigationLookup,
  }) => {
    // Memoize validation errors to prevent new array on every render
    const validationErrors = React.useMemo(
      () => selectedTree.validation?.errors || [],
      [selectedTree.validation?.errors],
    );

    return (
      <Box sx={{ display: "flex", height: "100%", overflow: "hidden" }}>
        {/* Editor Pane */}
        <Box
          sx={{
            width: editorCollapsed ? "40px" : `${editorWidthPercent}%`,
            minWidth: editorCollapsed ? "40px" : MIN_PANEL_WIDTH,
            height: "100%",
            transition: "width 0.2s",
            borderRight: "1px solid",
            borderColor: "divider",
          }}
        >
          <AttackTreeEditor
            dsl={localDsl}
            configuration={selectedTree.configuration}
            validation={validationErrors}
            collapsed={editorCollapsed}
            onDslChange={handleDslChange}
            onToggleCollapse={toggleEditorCollapsed}
          />
        </Box>

        {/* Preview Pane */}
        <Box sx={{ flexGrow: 1, height: "100%", overflow: "hidden" }}>
          <AttackTreePreview
            ast={selectedTree.ast}
            pathAnalysis={selectedTree.pathAnalysis}
            evaluationMethod={selectedTree.configuration.evaluationMethod}
            highlightCriticalPath={
              selectedTree.configuration.highlightCriticalPath
            }
            mitigationLookup={mitigationLookup}
            onNodeSelect={() => {}}
          />
        </Box>
      </Box>
    );
  },
  // Custom comparison: only re-render if critical props change
  (prevProps, nextProps) => {
    // Re-render if tree ID changes (different tree selected)
    if (prevProps.selectedTree.id !== nextProps.selectedTree.id) {
      return false;
    }

    // Re-render if DSL changes
    if (prevProps.localDsl !== nextProps.localDsl) {
      return false;
    }

    // Re-render if collapsed state changes
    if (prevProps.editorCollapsed !== nextProps.editorCollapsed) {
      return false;
    }

    // Re-render if width changes
    if (prevProps.editorWidthPercent !== nextProps.editorWidthPercent) {
      return false;
    }

    const prevValidation = prevProps.selectedTree.validation?.errors || [];
    const nextValidation = nextProps.selectedTree.validation?.errors || [];
    if (JSON.stringify(prevValidation) !== JSON.stringify(nextValidation)) {
      return false;
    }

    // Re-render if the mirrored mitigation lookup changed (memoized upstream,
    // so a new reference means the underlying risk data changed).
    if (prevProps.mitigationLookup !== nextProps.mitigationLookup) {
      return false;
    }

    // Re-render if path analysis identity changed (e.g. after re-parse), so
    // the table picks up new/removed mitigation ids.
    if (
      prevProps.selectedTree.pathAnalysis !==
      nextProps.selectedTree.pathAnalysis
    ) {
      return false;
    }

    return true;
  },
);

AttackTreeEditorView.displayName = "AttackTreeEditorView";

// ==================== COMPONENT ====================

export const AttackTreeTab: React.FC<AttackTreeTabProps> = ({
  project,
  onUpdate,
  onDirtyChange,
  onPhaseComplete,
}) => {
  const { t, i18n } = useTranslation();
  const isGerman = i18n.language === "de";

  // ==================== CUSTOM HOOKS ====================

  // Data Management
  const {
    attackTreeData,
    selectedTree,
    selectedTreeId,
    isDirty,
    hasTrees,
    validTreeCount,
    setSelectedTreeId,
    createTree,
    updateTree,
    deleteTree,
    syncFromAssets,
    updateConfiguration,
    importTree,
  } = useAttackTreeData(project, onUpdate, onDirtyChange);

  // Editor Logic (with debounced parsing)
  const { localDsl, handleDslChange } = useAttackTreeEditor(
    selectedTree,
    project,
    updateTree,
  );

  // UI State
  const {
    showDfdPreview,
    mainView,
    editorCollapsed,
    editorWidthPercent,
    topPanelHeight,
    showConfigDialog,
    showCreateDialog,
    showDeleteConfirm,
    showSyncConfirm,
    expandedGroups,
    treeToDelete,
    setShowDfdPreview,
    setMainView,
    setEditorCollapsed,
    setEditorWidthPercent,
    setTopPanelHeight,
    setShowConfigDialog,
    setShowCreateDialog,
    setShowDeleteConfirm,
    setShowSyncConfirm,
    toggleGroupExpanded,
    startDeleteTree,
    cancelDelete,
  } = useAttackTreeUI();

  // Toggle editor collapsed
  const toggleEditorCollapsed = useCallback(() => {
    setEditorCollapsed(!editorCollapsed);
  }, [editorCollapsed, setEditorCollapsed]);

  // ==================== REFS ====================

  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ==================== DERIVED STATE ====================

  const treeGroups = useMemo(() => {
    return groupTrees(attackTreeData.trees, project.assets, project.threats);
  }, [attackTreeData.trees, project.assets, project.threats]);

  // Case-insensitive lookup of mitigation id → reference (status/ticket/text),
  // mirrored from the Risk tab. Passed down to the table so it can show
  // verification per M-xxx. Built once here rather than per-row.
  const mitigationLookup = useMemo(() => {
    const map = new Map<string, (typeof project.mitigations)[number]>();
    project.mitigations.forEach((m) => {
      map.set(m.id.toUpperCase(), m);
    });
    return map;
  }, [project.mitigations]);

  const isCriticalWorkflow = project.isHighImpact;

  const criticalCoverage = useMemo(() => {
    if (!isCriticalWorkflow) return null;

    const assetCoverage: {
      assetId: string;
      assetName: string;
      enabledGoals: SecurityGoalType[];
      coveredGoals: SecurityGoalType[];
      missingGoals: SecurityGoalType[];
      isComplete: boolean;
    }[] = [];

    project.assets.forEach((asset) => {
      const enabledGoals = asset.securityGoals
        .filter((sg) => sg.enabled)
        .map((sg) => sg.type);

      if (enabledGoals.length === 0) return;

      const coverage = checkAssetAttackTreeCoverage(
        attackTreeData,
        asset.id,
        enabledGoals,
      );

      assetCoverage.push({
        assetId: asset.id,
        assetName: asset.name,
        enabledGoals,
        coveredGoals: coverage.covered,
        missingGoals: coverage.missing,
        isComplete: coverage.isComplete,
      });
    });

    const totalAssets = assetCoverage.length;
    const completeAssets = assetCoverage.filter((a) => a.isComplete).length;
    const isAllComplete = totalAssets > 0 && completeAssets === totalAssets;

    return {
      assets: assetCoverage,
      totalAssets,
      completeAssets,
      isAllComplete,
    };
  }, [isCriticalWorkflow, project.assets, attackTreeData]);

  const needsSync = useMemo(() => {
    if (!isCriticalWorkflow) return false;
    return (
      criticalCoverage?.assets.some((a) => a.missingGoals.length > 0) || false
    );
  }, [isCriticalWorkflow, criticalCoverage]);

  const canProceed = useMemo(() => {
    if (isCriticalWorkflow) {
      return criticalCoverage?.isAllComplete || false;
    }
    return true; // Standard workflow
  }, [isCriticalWorkflow, criticalCoverage]);

  // ==================== SPLIT VIEW RESIZE ====================

  const {
    topPanelHeight: resizedHeight,
    isResizing,
    handleMouseDown,
    splitContainerRef,
  } = useSplitViewResize({
    defaultHeight: topPanelHeight,
    minHeight: MIN_PANEL_HEIGHT,
  });

  // Sync resized height to state
  React.useEffect(() => {
    if (!isResizing && resizedHeight !== topPanelHeight) {
      setTopPanelHeight(resizedHeight);
    }
  }, [isResizing, resizedHeight, topPanelHeight, setTopPanelHeight]);

  // ==================== HANDLERS ====================

  const handleTreeSelect = useCallback(
    (treeId: string) => {
      setSelectedTreeId(treeId);
      setMainView("editor");
    },
    [setSelectedTreeId, setMainView],
  );

  const handleSyncConfirmed = useCallback(() => {
    syncFromAssets();
    setShowSyncConfirm(false);
  }, [syncFromAssets, setShowSyncConfirm]);

  const handleDeleteConfirmed = useCallback(() => {
    if (treeToDelete) {
      deleteTree(treeToDelete);
    }
    cancelDelete();
  }, [treeToDelete, deleteTree, cancelDelete]);

  const handleExport = useCallback(() => {
    const exportData = JSON.stringify(attackTreeData, null, 2);
    const blob = new Blob([exportData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attack-trees-${project.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [attackTreeData, project.id]);

  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const success = importTree(content);
        if (success) {
          setMainView("editor");
        }
      };
      reader.readAsText(file);
      event.target.value = "";
    },
    [importTree, setMainView],
  );

  const handleSaveConfig = useCallback(
    (config: { evaluationMethod: "simple" | "extended" }) => {
      updateConfiguration({
        ...attackTreeData.configuration,
        defaultEvaluationMethod: config.evaluationMethod,
      });
      setShowConfigDialog(false);
    },
    [attackTreeData.configuration, updateConfiguration, setShowConfigDialog],
  );

  // ==================== RENDER HELPERS ====================

  const renderToolbar = () => (
    <AttackTreeToolbar
      mainView={mainView}
      onMainViewChange={setMainView}
      showDfdPreview={showDfdPreview}
      onToggleDfdPreview={() => setShowDfdPreview(!showDfdPreview)}
      onOpenConfig={() => setShowConfigDialog(true)}
      onCreateTree={() => setShowCreateDialog(true)}
      onExport={handleExport}
      onImport={handleImport}
      onProceed={() => onPhaseComplete?.()}
      hasTrees={hasTrees}
      isDirty={isDirty}
      selectedTreeId={selectedTreeId}
      onTreeSelect={handleTreeSelect}
      trees={attackTreeData.trees}
      isCriticalWorkflow={isCriticalWorkflow}
      isSyncing={false}
      needsSync={needsSync}
      canProceed={canProceed}
      validTreeCount={validTreeCount}
      totalTreeCount={attackTreeData.trees.length}
    />
  );

  const OverviewView = () => (
    <Box sx={{ p: 2, overflowY: "auto", height: "100%" }}>
      {!hasTrees ? (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            gap: 2,
          }}
        >
          <Typography variant="h6" color="text.secondary">
            {isGerman ? "Keine Attack Trees vorhanden" : "No Attack Trees yet"}
          </Typography>
          <Typography color="text.secondary">
            {isCriticalWorkflow
              ? isGerman
                ? "Klicken Sie auf 'Sync', um Trees für alle Assets zu erstellen"
                : "Click 'Sync' to create trees for all assets"
              : isGerman
                ? "Klicken Sie auf '+', um einen neuen Tree zu erstellen"
                : "Click '+' to create a new tree"}
          </Typography>
          {isCriticalWorkflow && (
            <Button
              variant="contained"
              startIcon={<SyncIcon />}
              onClick={() => setShowSyncConfirm(true)}
            >
              {isGerman ? "Synchronisieren" : "Sync from Assets"}
            </Button>
          )}
        </Box>
      ) : (
        <Stack spacing={2}>
          {/* Critical Workflow Status */}
          {isCriticalWorkflow && criticalCoverage && (
            <Alert
              severity={criticalCoverage.isAllComplete ? "success" : "warning"}
              action={
                !criticalCoverage.isAllComplete && needsSync ? (
                  <Button
                    color="inherit"
                    size="small"
                    startIcon={<SyncIcon />}
                    onClick={() => setShowSyncConfirm(true)}
                  >
                    {isGerman ? "Sync" : "Sync"}
                  </Button>
                ) : undefined
              }
            >
              <AlertTitle>
                {isGerman ? "Abdeckung" : "Coverage"}:{" "}
                {criticalCoverage.completeAssets} /{" "}
                {criticalCoverage.totalAssets}
              </AlertTitle>
              {!criticalCoverage.isAllComplete && (
                <Typography variant="body2">
                  {isGerman
                    ? "Einige Assets haben fehlende Schutzziele. Klicken Sie auf Sync um Trees zu erstellen."
                    : "Some assets have missing security goals. Click Sync to create trees."}
                </Typography>
              )}
            </Alert>
          )}

          {/* Grouped Trees */}
          {treeGroups.map((group) => (
            <Accordion
              key={group.id}
              expanded={expandedGroups.includes(group.id)}
              onChange={() => toggleGroupExpanded(group.id)}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                    width: "100%",
                  }}
                >
                  <span>{group.icon}</span>
                  <Typography sx={{ flexGrow: 1 }}>{group.name}</Typography>
                  <Chip label={`${group.trees.length} Trees`} size="small" />
                  {group.isComplete !== undefined && (
                    <Chip
                      icon={group.isComplete ? <ValidIcon /> : <InvalidIcon />}
                      label={
                        group.isComplete
                          ? isGerman
                            ? "Vollständig"
                            : "Complete"
                          : isGerman
                            ? "Unvollständig"
                            : "Incomplete"
                      }
                      color={group.isComplete ? "success" : "warning"}
                      size="small"
                    />
                  )}
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  {group.trees.map((tree) => (
                    <Paper key={tree.id} sx={{ p: 2 }}>
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          mb: 2,
                        }}
                      >
                        <Box>
                          <Typography variant="subtitle1">
                            {tree.name}
                          </Typography>
                          {tree.description && (
                            <Typography variant="body2" color="text.secondary">
                              {tree.description}
                            </Typography>
                          )}
                        </Box>
                        <Box sx={{ display: "flex", gap: 1 }}>
                          {tree.validation?.isValid ? (
                            <Chip
                              icon={<ValidIcon />}
                              label="Valid"
                              color="success"
                              size="small"
                            />
                          ) : (
                            <Chip
                              icon={<InvalidIcon />}
                              label={`${tree.validation?.errors.length || 0} Errors`}
                              color="error"
                              size="small"
                            />
                          )}
                          <Tooltip title={isGerman ? "Bearbeiten" : "Edit"}>
                            <IconButton
                              size="small"
                              onClick={() => handleTreeSelect(tree.id)}
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={isGerman ? "Löschen" : "Delete"}>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => startDeleteTree(tree.id)}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Box>

                      {tree.pathAnalysis &&
                      tree.pathAnalysis.paths.length > 0 ? (
                        <AttackTreeTableView
                          pathAnalysis={tree.pathAnalysis}
                          evaluationMethod={tree.configuration.evaluationMethod}
                        />
                      ) : (
                        <Typography color="text.secondary" sx={{ py: 2 }}>
                          {isGerman
                            ? "Keine Pfadanalyse verfügbar"
                            : "No path analysis available"}
                        </Typography>
                      )}
                    </Paper>
                  ))}
                </Stack>
              </AccordionDetails>
            </Accordion>
          ))}
        </Stack>
      )}
    </Box>
  );

  // ==================== MAIN RENDER ====================

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
      {/* Toolbar */}
      {renderToolbar()}

      {/* DFD Preview Panel */}
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

      {/* Main Content */}
      <Box ref={splitContainerRef} sx={{ flexGrow: 1, overflow: "hidden" }}>
        {mainView === "overview" ? (
          <OverviewView />
        ) : !selectedTree ? (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
            }}
          >
            <Typography color="text.secondary">
              {isGerman ? "Kein Tree ausgewählt" : "No tree selected"}
            </Typography>
          </Box>
        ) : (
          <AttackTreeEditorView
            selectedTree={selectedTree}
            localDsl={localDsl}
            editorCollapsed={editorCollapsed}
            editorWidthPercent={editorWidthPercent}
            handleDslChange={handleDslChange}
            toggleEditorCollapsed={toggleEditorCollapsed}
            mitigationLookup={mitigationLookup}
          />
        )}
      </Box>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: "none" }}
        onChange={handleFileChange}
        aria-label="Import attack tree file"
      />

      {/* Dialogs */}
      <AttackTreeCreateDialog
        project={project}
        isCriticalWorkflow={isCriticalWorkflow}
        onCreate={createTree}
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
      />

      {showConfigDialog && (
        <AttackTreeConfigDialog
          open={showConfigDialog}
          configuration={{
            evaluationMethod:
              attackTreeData.configuration.defaultEvaluationMethod,
            autoSave: true,
            showLineNumbers: true,
            fontSize: 14,
            highlightCriticalPath: true,
          }}
          hasExistingTree={hasTrees}
          onSave={handleSaveConfig}
          onClose={() => setShowConfigDialog(false)}
        />
      )}

      {showDeleteConfirm && (
        <ConfirmDialog
          title={isGerman ? "Tree löschen" : "Delete Tree"}
          message={
            isGerman
              ? "Sind Sie sicher, dass Sie diesen Attack Tree löschen möchten?"
              : "Are you sure you want to delete this attack tree?"
          }
          confirmLabel={isGerman ? "Löschen" : "Delete"}
          cancelLabel={isGerman ? "Abbrechen" : "Cancel"}
          onConfirm={handleDeleteConfirmed}
          onCancel={cancelDelete}
        />
      )}

      {showSyncConfirm && (
        <ConfirmDialog
          title={isGerman ? "Von Assets synchronisieren" : "Sync from Assets"}
          message={
            isGerman
              ? `Es werden Attack Trees für ${
                  criticalCoverage?.assets.reduce(
                    (acc, a) => acc + a.missingGoals.length,
                    0,
                  ) || 0
                } fehlende Schutzziele erstellt.`
              : `Attack trees will be created for ${
                  criticalCoverage?.assets.reduce(
                    (acc, a) => acc + a.missingGoals.length,
                    0,
                  ) || 0
                } missing security goals.`
          }
          confirmLabel={isGerman ? "Synchronisieren" : "Sync"}
          cancelLabel={isGerman ? "Abbrechen" : "Cancel"}
          onConfirm={handleSyncConfirmed}
          onCancel={() => setShowSyncConfirm(false)}
        />
      )}
    </Box>
  );
};;;

export default AttackTreeTab;