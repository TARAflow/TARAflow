// ==================== ATTACK TREE TAB ====================
// Main tab component for Attack Tree feature (Phase 5)
// Supports both Standard and Critical TARA workflows
//
// Layout:
// ┌─────────────────────────────────────────────────────────┐
// │  Toolbar                                                │
// ├─────────────────────────────────────────────────────────┤
// │  DFD Preview (collapsible)                              │
// ├──────────────────────────┬──────────────────────────────┤
// │  DSL Editor (40%)        │  Preview (60%)               │
// │  (collapsible)           │  Tree / Table View           │
// └──────────────────────────┴──────────────────────────────┘

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Tooltip,
  Button,
  Menu,
  MenuItem,
  Divider,
  Select,
  FormControl,
  InputLabel,
  Chip,
  Alert,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  SelectChangeEvent,
} from "@mui/material";
import {
  Settings as SettingsIcon,
  Add as AddIcon,
  Save as SaveIcon,
  Undo as UndoIcon,
  Help as HelpIcon,
  KeyboardArrowDown as CollapseIcon,
  KeyboardArrowUp as ExpandIcon,
  ContentCopy as DuplicateIcon,
  Delete as DeleteIcon,
  Download as ExportIcon,
  Upload as ImportIcon,
  Description as TemplateIcon,
  Security as SecurityIcon,
  Warning as ThreatIcon,
  Assessment as RiskIcon,
  Search as StandaloneIcon,
} from "@mui/icons-material";

import {
  AttackTree,
  AttackTreeData,
  AttackTreeConfiguration,
  AttackTreeAnchor,
  AttackTreeAnchorType,
  AttackTreeTabProps,
  AttackTreeProjectData,
  AttackTreeUpdateResult,
  ValidationError,
  SecurityGoalType,
  createEmptyAttackTree,
  createDefaultAttackTreeData,
  getAnchorDisplayName,
  getAnchorTypeIcon,
  ATTACK_TREE_TEMPLATES,
  DEFAULT_ATTACKTREE_CONFIGURATION,
} from "../models/attacktree-types";
import { attackTreeParser } from "../services/attacktree-parser";
import { attackTreeCalculator } from "../services/attacktree-calculator";
import { attackTreeValidator } from "../services/attacktree-validator";
import { attackTreeService } from "../services/attacktree-service";
import { AttackTreeEditor } from "./attacktree-editor";
import { AttackTreePreview } from "./attacktree-preview";
import { AttackTreeConfigDialog } from "./attacktree-config-dialog";
import { AttackTreeCreateDialog } from "./attacktree-create-dialog";

// ==================== COMPONENT ====================

export const AttackTreeTab: React.FC<AttackTreeTabProps> = ({
  project,
  onUpdate,
  onDirtyChange,
  onPhaseComplete,
}) => {
  const { t, i18n } = useTranslation();
  const isGerman = i18n.language === "de";
  const isCriticalWorkflow = project.isHighImpact;

  // ==================== STATE ====================

  // Attack tree collection (multiple trees)
  const [collection, setCollection] = useState<AttackTreeData>(() => {
    if (project.attackTrees) {
      return project.attackTrees;
    }
    return createDefaultAttackTreeData();
  });

  // Currently selected tree
  const [selectedTreeId, setSelectedTreeId] = useState<string | null>(
    collection.trees.length > 0 ? collection.trees[0].id : null
  );

  // Editor state
  const [isDirty, setIsDirty] = useState(false);
  const [editorCollapsed, setEditorCollapsed] = useState(false);
  const [dfdPreviewCollapsed, setDfdPreviewCollapsed] = useState(true);

  // Dialogs
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [templateMenuAnchor, setTemplateMenuAnchor] =
    useState<null | HTMLElement>(null);

  // Auto-save timer
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ==================== DERIVED STATE ====================

  const selectedTree = useMemo(() => {
    return collection.trees.find((t) => t.id === selectedTreeId) || null;
  }, [collection.trees, selectedTreeId]);

  const allValidationErrors = useMemo((): ValidationError[] => {
    if (!selectedTree) return [];
    return [
      ...selectedTree.validation.errors,
      ...selectedTree.validation.warnings,
      ...(selectedTree.validation.infos || []),
    ];
  }, [selectedTree]);

  // Group trees by anchor type
  const groupedTrees = useMemo(() => {
    const groups: Record<AttackTreeAnchorType, AttackTree[]> = {
      asset: [],
      threat: [],
      risk: [],
      standalone: [],
    };

    collection.trees.forEach((tree) => {
      groups[tree.anchor.type].push(tree);
    });

    return groups;
  }, [collection.trees]);

  // ==================== EFFECTS ====================

  // Update dirty state
  useEffect(() => {
    if (onDirtyChange) {
      onDirtyChange(isDirty);
    }
  }, [isDirty, onDirtyChange]);

  // Auto-save
  useEffect(() => {
    if (isDirty && selectedTree && selectedTree.configuration.autoSave) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }

      autoSaveTimerRef.current = setTimeout(() => {
        handleSave();
      }, 2000);
    }

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [isDirty, selectedTree]);

  // ==================== HANDLERS ====================

  const handleDslChange = useCallback(
    (dsl: string) => {
      if (!selectedTree) return;

      // Parse DSL
      const parseResult = attackTreeParser.parse(
        dsl,
        selectedTree.configuration.evaluationMethod
      );

      // Validate
      const anchorAssetId =
        selectedTree.anchor.type === "asset"
          ? selectedTree.anchor.assetId
          : undefined;

      const validation = attackTreeValidator.validateAttackTree(
        parseResult.ast,
        project,
        parseResult.errors,
        anchorAssetId
      );

      // Calculate path analysis if valid
      let pathAnalysis = selectedTree.pathAnalysis;
      if (parseResult.ast && parseResult.errors.length === 0) {
        pathAnalysis = attackTreeCalculator.analyzeAttackPaths(
          parseResult.ast,
          selectedTree.configuration.evaluationMethod
        );
      }

      // Update tree
      const updatedTree: AttackTree = {
        ...selectedTree,
        dsl: dsl,
        ast: parseResult.ast,
        validation: validation,
        pathAnalysis: pathAnalysis,
        lastModified: new Date().toISOString(),
      };

      // Update collection
      setCollection((prev) => ({
        ...prev,
        trees: prev.trees.map((t) =>
          t.id === selectedTreeId ? updatedTree : t
        ),
        lastModified: new Date().toISOString(),
      }));

      setIsDirty(true);
    },
    [selectedTree, selectedTreeId, project]
  );

  const handleSave = useCallback(() => {
    // Create update result
    const updateResult: AttackTreeUpdateResult = {
      attackTrees: collection,
      phaseStatus: project.phaseStatus,
      lastModified: new Date().toISOString(),
    };

    // Update project
    onUpdate(updateResult);

    setIsDirty(false);
  }, [collection, project.phaseStatus, onUpdate]);

  const handleConfigSave = useCallback(
    (config: AttackTreeConfiguration) => {
      if (!selectedTree) return;

      const updatedTree: AttackTree = {
        ...selectedTree,
        configuration: config,
        lastModified: new Date().toISOString(),
      };

      // Re-parse with new method if changed
      if (
        config.evaluationMethod !== selectedTree.configuration.evaluationMethod
      ) {
        const parseResult = attackTreeParser.parse(
          selectedTree.dsl,
          config.evaluationMethod
        );

        const anchorAssetId =
          selectedTree.anchor.type === "asset"
            ? selectedTree.anchor.assetId
            : undefined;

        updatedTree.ast = parseResult.ast;
        updatedTree.validation = attackTreeValidator.validateAttackTree(
          parseResult.ast,
          project,
          parseResult.errors,
          anchorAssetId
        );

        if (parseResult.ast) {
          updatedTree.pathAnalysis = attackTreeCalculator.analyzeAttackPaths(
            parseResult.ast,
            config.evaluationMethod
          );
        }
      }

      setCollection((prev) => ({
        ...prev,
        trees: prev.trees.map((t) =>
          t.id === selectedTreeId ? updatedTree : t
        ),
        lastModified: new Date().toISOString(),
      }));

      setIsDirty(true);
      setConfigDialogOpen(false);
    },
    [selectedTree, selectedTreeId, project]
  );

  const handleCreateTree = useCallback(
    (anchor: AttackTreeAnchor, templateId?: string) => {
      let newTree: AttackTree;

      // Hole default evaluation method aus project config
      const defaultEvalMethod =
        project.attackTrees?.configuration?.defaultEvaluationMethod || "simple";

      if (templateId) {
        const loaded = attackTreeService.loadTemplate(templateId, anchor);
        if (loaded) {
          newTree = loaded;
        } else {
          newTree = createEmptyAttackTree(anchor, {
            evaluationMethod: defaultEvalMethod,
          });
        }
      } else {
        newTree = createEmptyAttackTree(anchor, {
          evaluationMethod: defaultEvalMethod,
        });
      }

      setCollection((prev) => ({
        ...prev,
        trees: prev.trees.concat([newTree]),
        lastModified: new Date().toISOString(),
      }));

      setSelectedTreeId(newTree.id);
      setIsDirty(true);
      setCreateDialogOpen(false);
    },
    [project.id]
  );

  const handleDeleteTree = useCallback(
    (treeId: string) => {
      setCollection((prev) => ({
        ...prev,
        trees: prev.trees.filter((t) => t.id !== treeId),
        lastModified: new Date().toISOString(),
      }));

      if (selectedTreeId === treeId) {
        const remaining = collection.trees.filter((t) => t.id !== treeId);
        setSelectedTreeId(remaining.length > 0 ? remaining[0].id : null);
      }

      setIsDirty(true);
    },
    [selectedTreeId, collection.trees]
  );

  const handleDuplicateTree = useCallback(
    (treeId: string) => {
      const tree = collection.trees.find((t) => t.id === treeId);
      if (!tree) return;

      const duplicated: AttackTree = {
        ...tree,
        id: "at-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9),
        name: tree.name + " (Copy)",
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
      };

      setCollection((prev) => ({
        ...prev,
        trees: prev.trees.concat([duplicated]),
        lastModified: new Date().toISOString(),
      }));

      setSelectedTreeId(duplicated.id);
      setIsDirty(true);
    },
    [collection.trees]
  );

  const handleTreeSelectChange = useCallback(
    (event: SelectChangeEvent<string>) => {
      setSelectedTreeId(event.target.value);
    },
    []
  );

  // ==================== RENDER ====================

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Toolbar */}
      <Paper
        elevation={0}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          p: 1,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        {/* Tree Selector */}
        <FormControl size="small" sx={{ minWidth: 250 }}>
          <InputLabel>{isGerman ? "Attack Tree" : "Attack Tree"}</InputLabel>
          <Select
            value={selectedTreeId || ""}
            label={isGerman ? "Attack Tree" : "Attack Tree"}
            onChange={handleTreeSelectChange}
          >
            {collection.trees.length === 0 ? (
              <MenuItem value="" disabled>
                {isGerman ? "Keine Attack Trees" : "No Attack Trees"}
              </MenuItem>
            ) : (
              collection.trees.map((tree) => (
                <MenuItem key={tree.id} value={tree.id}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <span>{getAnchorTypeIcon(tree.anchor.type)}</span>
                    <span>{tree.name}</span>
                    {tree.validation.errors.length > 0 && (
                      <Chip
                        label={tree.validation.errors.length}
                        size="small"
                        color="error"
                        sx={{ height: 18, fontSize: "0.7rem" }}
                      />
                    )}
                  </Box>
                </MenuItem>
              ))
            )}
          </Select>
        </FormControl>

        {/* Add Tree */}
        <Tooltip title={isGerman ? "Neuer Attack Tree" : "New Attack Tree"}>
          <IconButton onClick={() => setCreateDialogOpen(true)}>
            <AddIcon />
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem />

        {/* Actions */}
        <Tooltip title={isGerman ? "Speichern" : "Save"}>
          <span>
            <IconButton
              onClick={handleSave}
              disabled={!isDirty}
              color={isDirty ? "primary" : "default"}
            >
              <SaveIcon />
            </IconButton>
          </span>
        </Tooltip>

        {selectedTree && (
          <>
            <Tooltip title={isGerman ? "Duplizieren" : "Duplicate"}>
              <IconButton onClick={() => handleDuplicateTree(selectedTree.id)}>
                <DuplicateIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title={isGerman ? "Löschen" : "Delete"}>
              <IconButton
                onClick={() => handleDeleteTree(selectedTree.id)}
                color="error"
              >
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          </>
        )}

        <Box sx={{ flexGrow: 1 }} />

        {/* DFD Preview Toggle */}
        <Button
          size="small"
          variant={dfdPreviewCollapsed ? "outlined" : "contained"}
          startIcon={dfdPreviewCollapsed ? <ExpandIcon /> : <CollapseIcon />}
          onClick={() => setDfdPreviewCollapsed(!dfdPreviewCollapsed)}
        >
          DFD
        </Button>

        <Divider orientation="vertical" flexItem />

        {/* Config & Help */}
        <Tooltip title={isGerman ? "Konfiguration" : "Configuration"}>
          <IconButton onClick={() => setConfigDialogOpen(true)}>
            <SettingsIcon />
          </IconButton>
        </Tooltip>

        <Tooltip title={isGerman ? "Hilfe" : "Help"}>
          <IconButton>
            <HelpIcon />
          </IconButton>
        </Tooltip>

        {/* Status */}
        {isDirty && (
          <Chip
            label={isGerman ? "Nicht gespeichert" : "Unsaved"}
            size="small"
            color="warning"
          />
        )}
      </Paper>

      {/* DFD Preview (collapsible) */}
      <Collapse in={!dfdPreviewCollapsed}>
        <Box
          sx={{
            height: 200,
            borderBottom: "1px solid",
            borderColor: "divider",
            backgroundColor: "grey.100",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {project.dfdPreviewImage ? (
            <img
              src={project.dfdPreviewImage}
              alt="DFD Preview"
              style={{
                maxHeight: "100%",
                maxWidth: "100%",
                objectFit: "contain",
              }}
            />
          ) : (
            <Typography color="text.secondary">
              {isGerman ? "Kein DFD verfügbar" : "No DFD available"}
            </Typography>
          )}
        </Box>
      </Collapse>

      {/* Main Content */}
      <Box
        sx={{
          flexGrow: 1,
          display: "flex",
          overflow: "hidden",
        }}
      >
        {/* Editor Panel */}
        {selectedTree && (
          <Box
            sx={{
              width: editorCollapsed ? 40 : "40%",
              minWidth: editorCollapsed ? 40 : 300,
              transition: "width 0.3s",
              borderRight: "1px solid",
              borderColor: "divider",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <AttackTreeEditor
              dsl={selectedTree.dsl}
              configuration={selectedTree.configuration}
              validation={allValidationErrors}
              collapsed={editorCollapsed}
              onDslChange={handleDslChange}
              onToggleCollapse={() => setEditorCollapsed(!editorCollapsed)}
            />
          </Box>
        )}

        {/* Preview Panel */}
        <Box
          sx={{
            flexGrow: 1,
            overflow: "hidden",
          }}
        >
          {selectedTree ? (
            <AttackTreePreview
              ast={selectedTree.ast}
              pathAnalysis={selectedTree.pathAnalysis}
              evaluationMethod={selectedTree.configuration.evaluationMethod}
              highlightCriticalPath={
                selectedTree.configuration.highlightCriticalPath
              }
            />
          ) : (
            <Box
              sx={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
              }}
            >
              <SecurityIcon sx={{ fontSize: 64, color: "text.secondary" }} />
              <Typography variant="h6" color="text.secondary">
                {isGerman
                  ? "Kein Attack Tree ausgewählt"
                  : "No Attack Tree Selected"}
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setCreateDialogOpen(true)}
              >
                {isGerman ? "Attack Tree erstellen" : "Create Attack Tree"}
              </Button>
            </Box>
          )}
        </Box>
      </Box>

      {/* Config Dialog */}
      {selectedTree && (
        <AttackTreeConfigDialog
          open={configDialogOpen}
          configuration={selectedTree.configuration}
          hasExistingTree={!!selectedTree.ast}
          onSave={handleConfigSave}
          onClose={() => setConfigDialogOpen(false)}
        />
      )}

      {/* Create Dialog */}
      <AttackTreeCreateDialog
        open={createDialogOpen}
        project={project}
        isCriticalWorkflow={isCriticalWorkflow}
        onClose={() => setCreateDialogOpen(false)}
        onCreate={handleCreateTree}
      />
    </Box>
  );
};

// ==================== CREATE DIALOG ====================
