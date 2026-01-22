// ==================== ATTACK TREE TAB (PHASE 5) ====================
// Main component for attack tree modeling
// Features:
// - Toggle between Overview (Accordion) and Editor (Split) views
// - Overview: Grouped accordions by Asset/Threat with path tables
// - Editor: Monaco DSL editor + D3 tree visualization
// - Critical Workflow: Auto-create trees for all asset security goals
// - Standard Workflow: Manual tree creation from threats/risks
// - Sync from Assets for Critical Workflow
// - UI state persisted to localStorage

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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Paper,
} from "@mui/material";
import {
  Settings as SettingsIcon,
  Sync as SyncIcon,
  SkipNext as NextIcon,
  Warning as WarningIcon,
  Download as ExportIcon,
  Upload as ImportIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ViewList as OverviewIcon,
  AccountTree as TreeIcon,
  Security as AssetIcon,
  BugReport as ThreatIcon,
  Assessment as RiskIcon,
  Search as SearchIcon,
  CheckCircle as ValidIcon,
  Error as InvalidIcon,
} from "@mui/icons-material";

import {
  AttackTree,
  AttackTreeData,
  AttackTreeProjectData,
  AttackTreeUpdateResult,
  AttackTreeTabProps,
  AttackTreeAnchor,
  AttackTreeAnchorType,
  SecurityGoalType,
  AssetReference,
  ThreatReference,
  RiskReference,
  createEmptyAttackTree,
  createDefaultAttackTreeData,
  getTreesForAsset,
  getTreesByAnchorType,
  checkAssetAttackTreeCoverage,
  getAnchorDisplayName,
  getAnchorTypeIcon,
  getRiskScoreEmoji,
  DEFAULT_ATTACKTREE_PROJECT_CONFIGURATION,
} from "../models/attacktree-types";
import { attackTreeService } from "../services/attacktree-service";
import { attackTreeParser } from "../services/attacktree-parser";
import { attackTreeValidator } from "../services/attacktree-validator";
import { attackTreeCalculator } from "../services/attacktree-calculator";
import { AttackTreeToolbar, MainView } from "./attacktree-toolbar";
import { AttackTreeEditor } from "./attacktree-editor";
import { AttackTreePreview } from "./attacktree-preview";
import { AttackTreeCreateDialog } from "./attacktree-create-dialog";
import { AttackTreeConfigDialog } from "./attacktree-config-dialog";
import { AttackTreeTableView } from "./attacktree-tableview";
import { DFDPreviewPanel, ConfirmDialog } from "shared";
import { useSplitViewResize, MIN_PANEL_HEIGHT, DEFAULT_TOP_HEIGHT } from "shared";

// ==================== CONSTANTS ====================

const MIN_PANEL_WIDTH = 300;
const DEFAULT_EDITOR_WIDTH_PERCENT = 50;

// ==================== HELPER FUNCTIONS ====================

function ensureValidAttackTreeData(
  data: AttackTreeData | null | undefined
): AttackTreeData {
  if (!data) return createDefaultAttackTreeData();
  return {
    trees: data.trees ?? [],
    configuration:
      data.configuration ?? DEFAULT_ATTACKTREE_PROJECT_CONFIGURATION,
    lastModified: data.lastModified ?? new Date().toISOString(),
  };
}

// ==================== GROUPED TREE STRUCTURE ====================

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
  threats: ThreatReference[]
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

    // Check coverage
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

// ==================== COMPONENT ====================

export const AttackTreeTab: React.FC<AttackTreeTabProps> = ({
  project,
  onUpdate,
  onDirtyChange,
  onPhaseComplete,
}) => {
  const { t, i18n } = useTranslation();
  const isGerman = i18n.language === "de";

  // ==================== STATE ====================

  // Attack tree data (local working copy)
  const [attackTreeData, setAttackTreeData] = useState<AttackTreeData>(() =>
    ensureValidAttackTreeData(project.attackTrees),
  );

  // UI state with localStorage persistence
  const [isDirty, setIsDirty] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showDfdPreview, setShowDfdPreview] = useState(() => {
    const saved = localStorage.getItem("attacktree-tab-showDfdPreview");
    return saved === "true";
  });
  const [mainView, setMainView] = useState<MainView>(() => {
    const saved = localStorage.getItem("attacktree-tab-mainView");
    return saved === "overview" || saved === "editor" ? saved : "overview";
  });
  const [editorWidthPercent, setEditorWidthPercent] = useState(() => {
    const saved = localStorage.getItem("attacktree-tab-editorWidth");
    return saved ? parseInt(saved, 10) : DEFAULT_EDITOR_WIDTH_PERCENT;
  });
  const [topPanelHeight, setTopPanelHeight] = useState(() => {
    const saved = localStorage.getItem("attacktree-tab-topPanelHeight");
    return saved ? parseInt(saved, 10) : 200;
  });
  const [editorCollapsed, setEditorCollapsed] = useState(false);

  // Selected tree for editor
  const [selectedTreeId, setSelectedTreeId] = useState<string | null>(() => {
    // Select first tree if available
    const data = ensureValidAttackTreeData(project.attackTrees);
    return data.trees.length > 0 ? data.trees[0].id : null;
  });

  // Persist UI state to localStorage
  useEffect(() => {
    localStorage.setItem(
      "attacktree-tab-showDfdPreview",
      String(showDfdPreview),
    );
  }, [showDfdPreview]);

  useEffect(() => {
    localStorage.setItem("attacktree-tab-mainView", mainView);
  }, [mainView]);

  useEffect(() => {
    localStorage.setItem(
      "attacktree-tab-editorWidth",
      String(editorWidthPercent),
    );
  }, [editorWidthPercent]);

  useEffect(() => {
    localStorage.setItem(
      "attacktree-tab-topPanelHeight",
      String(topPanelHeight),
    );
  }, [topPanelHeight]);

  // Dialog state
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [treeToDelete, setTreeToDelete] = useState<string | null>(null);
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);

  // Expanded accordions
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ==================== DERIVED STATE ====================

  const selectedTree = useMemo(() => {
    if (!selectedTreeId) return null;
    return attackTreeData.trees.find((t) => t.id === selectedTreeId) || null;
  }, [attackTreeData.trees, selectedTreeId]);

  const treeGroups = useMemo(() => {
    return groupTrees(attackTreeData.trees, project.assets, project.threats);
  }, [attackTreeData.trees, project.assets, project.threats]);

  const hasTrees = attackTreeData.trees.length > 0;

  // Critical workflow checks
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

  // Valid trees count
  const validTreeCount = useMemo(() => {
    return attackTreeData.trees.filter((t) => t.validation?.isValid).length;
  }, [attackTreeData.trees]);

  // Needs sync (assets changed since last sync)
  const needsSync = useMemo(() => {
    if (!isCriticalWorkflow) return false;
    return (
      criticalCoverage?.assets.some((a) => a.missingGoals.length > 0) || false
    );
  }, [isCriticalWorkflow, criticalCoverage]);

  // ==================== EFFECTS ====================

  // Split view resize
  const {
    topPanelHeight: resizedHeight,
    isResizing,
    handleMouseDown,
    splitContainerRef,
  } = useSplitViewResize({
    defaultHeight: topPanelHeight, // Use state value, not hardcoded
    minHeight: MIN_PANEL_HEIGHT,
  });

  // Update topPanelHeight when resized
  useEffect(() => {
    if (!isResizing && resizedHeight !== topPanelHeight) {
      setTopPanelHeight(resizedHeight);
    }
  }, [isResizing, resizedHeight, topPanelHeight]);

  // Sync resizedHeight to topPanelHeight for localStorage persistence
  useEffect(() => {
    if (!isResizing && resizedHeight !== topPanelHeight) {
      setTopPanelHeight(resizedHeight);
    }
  }, [isResizing, resizedHeight, topPanelHeight]);

  // Update dirty state
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // Sync from project when it changes
  useEffect(() => {
    setAttackTreeData(ensureValidAttackTreeData(project.attackTrees));
  }, [project.attackTrees]);

  // Parse trees that don't have AST yet (initial load or after import)
  useEffect(() => {
    let needsUpdate = false;
    const updatedTrees = attackTreeData.trees.map((tree) => {
      // Skip trees that already have AST
      if (tree.ast) return tree;

      needsUpdate = true;

      // Parse DSL and generate AST
      const parseResult = attackTreeParser.parse(
        tree.dsl,
        tree.configuration.evaluationMethod,
      );

      // Get anchor asset ID for validation
      const anchorAssetId =
        tree.anchor.type === "asset" ? tree.anchor.assetId : undefined;

      // Validate
      const validation = attackTreeValidator.validateAttackTree(
        parseResult.ast,
        project,
        parseResult.errors,
        anchorAssetId,
      );

      // Calculate path analysis if valid
      let pathAnalysis = undefined;
      if (parseResult.ast && validation.isValid) {
        pathAnalysis = attackTreeCalculator.analyzeAttackPaths(
          parseResult.ast,
          tree.configuration.evaluationMethod,
        );
      }

      // Return updated tree
      return {
        ...tree,
        ast: parseResult.ast,
        validation: validation,
        pathAnalysis: pathAnalysis,
      };
    });

    if (needsUpdate) {
      setAttackTreeData((prev) => ({
        ...prev,
        trees: updatedTrees,
      }));
    }
  }, [attackTreeData.trees, project]);

  // Auto-save when dirty (debounced)
  useEffect(() => {
    if (!isDirty) return;

    const timeoutId = setTimeout(() => {
      const result: AttackTreeUpdateResult = {
        attackTrees: attackTreeData,
        phaseStatus: project.phaseStatus,
        lastModified: new Date().toISOString(),
      };

      onUpdate(result);
      setIsDirty(false);
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [isDirty, attackTreeData, project.phaseStatus, onUpdate]);

  // ==================== HANDLERS ====================

  const handleToggleDfdPreview = useCallback(() => {
    setShowDfdPreview((prev) => !prev);
  }, []);

  const handleMainViewChange = useCallback((view: MainView) => {
    setMainView(view);
  }, []);

  const handleTreeSelect = useCallback((treeId: string) => {
    setSelectedTreeId(treeId);
    setMainView("editor");
  }, []);

  const handleDslChange = useCallback(
    (newDsl: string) => {
      if (!selectedTreeId) return;

      setAttackTreeData((prev) => {
        const treeIndex = prev.trees.findIndex((t) => t.id === selectedTreeId);
        if (treeIndex < 0) return prev;

        const currentTree = prev.trees[treeIndex];
        const updatedTree = {
          ...currentTree,
          dsl: newDsl,
          lastModified: new Date().toISOString(),
        };

        // Parse DSL and generate AST
        const parseResult = attackTreeParser.parse(
          newDsl,
          currentTree.configuration.evaluationMethod,
        );

        // Get anchor asset ID for validation
        const anchorAssetId =
          currentTree.anchor.type === "asset"
            ? currentTree.anchor.assetId
            : undefined;

        // Validate
        const validation = attackTreeValidator.validateAttackTree(
          parseResult.ast,
          project,
          parseResult.errors,
          anchorAssetId,
        );

        // Calculate path analysis if valid
        let pathAnalysis = undefined;
        if (parseResult.ast && validation.isValid) {
          pathAnalysis = attackTreeCalculator.analyzeAttackPaths(
            parseResult.ast,
            currentTree.configuration.evaluationMethod,
          );
        }

        // Update tree with AST and validation
        updatedTree.ast = parseResult.ast;
        updatedTree.validation = validation;
        updatedTree.pathAnalysis = pathAnalysis;

        const updatedTrees = [...prev.trees];
        updatedTrees[treeIndex] = updatedTree;

        return {
          ...prev,
          trees: updatedTrees,
          lastModified: new Date().toISOString(),
        };
      });
      setIsDirty(true);
    },
    [selectedTreeId, project],
  );

  const handleSaveTree = useCallback(() => {
    if (!selectedTree) return;

    const result = attackTreeService.saveAttackTree(project, selectedTree);
    if (result.success) {
      setAttackTreeData(result.attackTreeData);
      setIsDirty(true);
    }
  }, [project, selectedTree]);

  const handleCreateTree = useCallback(
    (anchor: AttackTreeAnchor) => {
      const defaultEvalMethod =
        attackTreeData.configuration?.defaultEvaluationMethod || "simple";

      const newTree = createEmptyAttackTree(anchor, {
        evaluationMethod: defaultEvalMethod,
      });

      // Parse initial DSL and generate AST
      const parseResult = attackTreeParser.parse(
        newTree.dsl,
        newTree.configuration.evaluationMethod,
      );

      // Get anchor asset ID for validation
      const anchorAssetId =
        newTree.anchor.type === "asset" ? newTree.anchor.assetId : undefined;

      // Validate
      const validation = attackTreeValidator.validateAttackTree(
        parseResult.ast,
        project,
        parseResult.errors,
        anchorAssetId,
      );

      // Calculate path analysis if valid
      let pathAnalysis = undefined;
      if (parseResult.ast && validation.isValid) {
        pathAnalysis = attackTreeCalculator.analyzeAttackPaths(
          parseResult.ast,
          newTree.configuration.evaluationMethod,
        );
      }

      // Update tree with AST and validation
      newTree.ast = parseResult.ast;
      newTree.validation = validation;
      newTree.pathAnalysis = pathAnalysis;

      setAttackTreeData((prev) => ({
        ...prev,
        trees: [...prev.trees, newTree],
        lastModified: new Date().toISOString(),
      }));

      setSelectedTreeId(newTree.id);
      setMainView("editor");
      setIsDirty(true);
      setShowCreateDialog(false);
    },
    [attackTreeData.configuration, project],
  );

  const handleDeleteTree = useCallback((treeId: string) => {
    setTreeToDelete(treeId);
    setShowDeleteConfirm(true);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (!treeToDelete) return;

    const updatedData = attackTreeService.deleteAttackTree(
      project,
      treeToDelete,
    );
    setAttackTreeData(updatedData);

    // Select another tree if current was deleted
    if (selectedTreeId === treeToDelete) {
      setSelectedTreeId(
        updatedData.trees.length > 0 ? updatedData.trees[0].id : null,
      );
    }

    setIsDirty(true);
    setShowDeleteConfirm(false);
    setTreeToDelete(null);
  }, [treeToDelete, project, selectedTreeId]);

  const handleSyncFromAssets = useCallback(() => {
    if (!isCriticalWorkflow || !criticalCoverage) return;

    setIsSyncing(true);

    // Generate trees for missing goals
    const newTrees: AttackTree[] = [];
    criticalCoverage.assets.forEach((assetCov) => {
      assetCov.missingGoals.forEach((goal) => {
        const tree = attackTreeService.generateFromAsset(
          project,
          assetCov.assetId,
          goal,
        );
        if (tree) {
          // Parse DSL and generate AST for the new tree
          const parseResult = attackTreeParser.parse(
            tree.dsl,
            tree.configuration.evaluationMethod,
          );

          // Get anchor asset ID for validation
          const anchorAssetId =
            tree.anchor.type === "asset" ? tree.anchor.assetId : undefined;

          // Validate
          const validation = attackTreeValidator.validateAttackTree(
            parseResult.ast,
            project,
            parseResult.errors,
            anchorAssetId,
          );

          // Calculate path analysis if valid
          let pathAnalysis = undefined;
          if (parseResult.ast && validation.isValid) {
            pathAnalysis = attackTreeCalculator.analyzeAttackPaths(
              parseResult.ast,
              tree.configuration.evaluationMethod,
            );
          }

          // Update tree with AST and validation
          tree.ast = parseResult.ast;
          tree.validation = validation;
          tree.pathAnalysis = pathAnalysis;

          newTrees.push(tree);
        }
      });
    });

    if (newTrees.length > 0) {
      setAttackTreeData((prev) => ({
        ...prev,
        trees: [...prev.trees, ...newTrees],
        lastModified: new Date().toISOString(),
      }));
      setIsDirty(true);
    }

    setIsSyncing(false);
    setShowSyncConfirm(false);
  }, [isCriticalWorkflow, criticalCoverage, project]);

  const handleOpenConfig = useCallback(() => {
    setShowConfigDialog(true);
  }, []);

  const handleSaveConfig = useCallback(
    (newConfig: AttackTreeData["configuration"]) => {
      setAttackTreeData((prev) => ({
        ...prev,
        configuration: newConfig,
        lastModified: new Date().toISOString(),
      }));
      setIsDirty(true);
      setShowConfigDialog(false);
    },
    [],
  );

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
        const result = attackTreeService.importAttackTree(content);
        if (result.success && result.data) {
          const importedTree = result.data;

          // Parse DSL and generate AST for imported tree
          const parseResult = attackTreeParser.parse(
            importedTree.dsl,
            importedTree.configuration.evaluationMethod,
          );

          // Get anchor asset ID for validation
          const anchorAssetId =
            importedTree.anchor.type === "asset"
              ? importedTree.anchor.assetId
              : undefined;

          // Validate
          const validation = attackTreeValidator.validateAttackTree(
            parseResult.ast,
            project,
            parseResult.errors,
            anchorAssetId,
          );

          // Calculate path analysis if valid
          let pathAnalysis = undefined;
          if (parseResult.ast && validation.isValid) {
            pathAnalysis = attackTreeCalculator.analyzeAttackPaths(
              parseResult.ast,
              importedTree.configuration.evaluationMethod,
            );
          }

          // Update tree with AST and validation
          importedTree.ast = parseResult.ast;
          importedTree.validation = validation;
          importedTree.pathAnalysis = pathAnalysis;

          setAttackTreeData((prev) => ({
            ...prev,
            trees: [...prev.trees, importedTree],
            lastModified: new Date().toISOString(),
          }));
          setSelectedTreeId(importedTree.id);
          setMainView("editor");
          setIsDirty(true);
        }
      };
      reader.readAsText(file);

      // Reset input
      event.target.value = "";
    },
    [project],
  );

  const handleAccordionChange = useCallback(
    (groupId: string) => (_: React.SyntheticEvent, isExpanded: boolean) => {
      setExpandedGroups((prev) =>
        isExpanded ? [...prev, groupId] : prev.filter((id) => id !== groupId),
      );
    },
    [],
  );

  const handleProceed = useCallback(() => {
    onPhaseComplete?.();
  }, [onPhaseComplete]);

  // ==================== COMPLETION CHECK ====================

  const canProceed = useMemo(() => {
    if (isCriticalWorkflow) {
      // Critical: All assets must have trees for all enabled security goals
      return criticalCoverage?.isAllComplete || false;
    } else {
      // Standard: At least 0 valid trees (optional phase)
      return true;
    }
  }, [isCriticalWorkflow, criticalCoverage]);

  // ==================== RENDER ====================

  // TopToolBar Component
  // Top Toolbar using extracted component
  const renderToolbar = () => (
    <AttackTreeToolbar
      mainView={mainView}
      onMainViewChange={handleMainViewChange}
      showDfdPreview={showDfdPreview}
      onToggleDfdPreview={handleToggleDfdPreview}
      selectedTreeId={selectedTreeId}
      onTreeSelect={setSelectedTreeId}
      trees={attackTreeData.trees}
      hasTrees={hasTrees}
      onCreateTree={() => setShowCreateDialog(true)}
      onSyncFromAssets={
        isCriticalWorkflow ? () => setShowSyncConfirm(true) : undefined
      }
      onOpenConfig={handleOpenConfig}
      onExport={handleExport}
      onImport={handleImport}
      onProceed={handleProceed}
      isCriticalWorkflow={isCriticalWorkflow}
      isSyncing={isSyncing}
      needsSync={needsSync}
      validTreeCount={validTreeCount}
      totalTreeCount={attackTreeData.trees.length}
      completeAssets={criticalCoverage?.completeAssets}
      totalAssets={criticalCoverage?.totalAssets}
      isDirty={isDirty}
      canProceed={canProceed}
      fileInputRef={fileInputRef}
    />
  );

  // Overview View with grouped accordions
  const OverviewView = () => (
    <Box sx={{ p: 2, overflow: "auto", height: "100%" }}>
      {treeGroups.length === 0 ? (
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
          <Button
            startIcon={isCriticalWorkflow ? <SyncIcon /> : <AddIcon />}
            variant="contained"
            onClick={() =>
              isCriticalWorkflow
                ? setShowSyncConfirm(true)
                : setShowCreateDialog(true)
            }
          >
            {isCriticalWorkflow
              ? isGerman
                ? "Trees generieren"
                : "Generate Trees"
              : isGerman
                ? "Tree erstellen"
                : "Create Tree"}
          </Button>
        </Box>
      ) : (
        <Stack spacing={1}>
          {treeGroups.map((group) => (
            <Accordion
              key={group.id}
              expanded={expandedGroups.includes(group.id)}
              onChange={handleAccordionChange(group.id)}
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
                  <Typography sx={{ fontSize: "1.2rem" }}>
                    {group.icon}
                  </Typography>
                  <Typography fontWeight="bold">{group.name}</Typography>
                  <Chip
                    label={`${group.trees.length} ${
                      group.trees.length === 1 ? "Tree" : "Trees"
                    }`}
                    size="small"
                    variant="outlined"
                  />
                  {group.type === "asset" && (
                    <>
                      {group.isComplete ? (
                        <Chip
                          icon={<ValidIcon />}
                          label={isGerman ? "Vollständig" : "Complete"}
                          size="small"
                          color="success"
                        />
                      ) : (
                        <Chip
                          icon={<WarningIcon />}
                          label={`${
                            isGerman ? "Fehlt" : "Missing"
                          }: ${group.missingGoals?.join(", ")}`}
                          size="small"
                          color="warning"
                        />
                      )}
                    </>
                  )}
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  {group.trees.map((tree) => (
                    <Paper key={tree.id} variant="outlined" sx={{ p: 2 }}>
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          mb: 2,
                        }}
                      >
                        <Box
                          sx={{ display: "flex", alignItems: "center", gap: 1 }}
                        >
                          <Typography variant="subtitle1" fontWeight="bold">
                            {tree.name}
                          </Typography>
                          {tree.anchor.securityGoal && (
                            <Chip
                              label={tree.anchor.securityGoal}
                              size="small"
                              color="primary"
                            />
                          )}
                          {tree.validation?.isValid ? (
                            <Chip
                              icon={<ValidIcon />}
                              label={isGerman ? "Valide" : "Valid"}
                              size="small"
                              color="success"
                            />
                          ) : (
                            <Chip
                              icon={<InvalidIcon />}
                              label={`${tree.validation?.errors?.length || 0} ${
                                isGerman ? "Fehler" : "Errors"
                              }`}
                              size="small"
                              color="error"
                            />
                          )}
                        </Box>
                        <Box>
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
                              onClick={() => handleDeleteTree(tree.id)}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Box>

                      {/* Path Analysis Table */}
                      {tree.pathAnalysis &&
                      tree.pathAnalysis.paths.length > 0 ? (
                        <AttackTreeTableView
                          pathAnalysis={tree.pathAnalysis}
                          evaluationMethod={tree.configuration.evaluationMethod}
                        />
                      ) : (
                        <Typography color="text.secondary" sx={{ py: 2 }}>
                          {isGerman
                            ? "Keine Pfadanalyse verfügbar - Tree bearbeiten um zu generieren"
                            : "No path analysis available - edit tree to generate"}
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

  // Editor View with split panes
  const EditorView = () => {
    if (!selectedTree) {
      return (
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
      );
    }

    return (
      <Box
        sx={{
          display: "flex",
          height: "100%",
          overflow: "hidden",
        }}
      >
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
            dsl={selectedTree.dsl}
            configuration={selectedTree.configuration}
            validation={selectedTree.validation?.errors || []}
            collapsed={editorCollapsed}
            onDslChange={handleDslChange}
            onToggleCollapse={() => setEditorCollapsed((prev) => !prev)}
          />
        </Box>

        {/* Preview Pane */}
        <Box
          sx={{
            flexGrow: 1,
            height: "100%",
            overflow: "hidden",
          }}
        >
          <AttackTreePreview
            ast={selectedTree.ast}
            pathAnalysis={selectedTree.pathAnalysis}
            evaluationMethod={selectedTree.configuration.evaluationMethod}
            highlightCriticalPath={
              selectedTree.configuration.highlightCriticalPath
            }
            // configuration={selectedTree.configuration}
            onNodeSelect={() => {}}
          />
        </Box>
      </Box>
    );
  };

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
      {/* Top Toolbar */}
      {renderToolbar()}

      {/* DFD Preview Panel (collapsible) */}
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

      {/* Main Content Area */}

      <Box ref={splitContainerRef} sx={{ flexGrow: 1, overflow: "hidden" }}>
        {mainView === "overview" ? <OverviewView /> : <EditorView />}
      </Box>

      {/* Hidden file input for import */}
      <input
        placeholder={t("...")}
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {/* Create Tree Dialog */}
      <AttackTreeCreateDialog
        project={project}
        isCriticalWorkflow={isCriticalWorkflow}
        onCreate={handleCreateTree}
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
      />

      {/* Config Dialog */}
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
          onSave={(config) => {
            handleSaveConfig({
              ...attackTreeData.configuration,
              defaultEvaluationMethod: config.evaluationMethod,
            });
          }}
          onClose={() => setShowConfigDialog(false)}
        />
      )}

      {/* Delete Confirmation */}
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
          onConfirm={() => {
            handleConfirmDelete();
            setShowDeleteConfirm(false); // optional, aber sauber
            setTreeToDelete(null);
          }}
          onCancel={() => {
            setShowDeleteConfirm(false);
            setTreeToDelete(null);
          }}
        />
      )}

      {/* Sync Confirmation */}
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
          onConfirm={() => {
            handleSyncFromAssets();
            setShowSyncConfirm(false); // optional, aber sauber
          }}
          onCancel={() => setShowSyncConfirm(false)}
        />
      )}
    </Box>
  );
};;

export default AttackTreeTab;