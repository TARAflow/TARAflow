// ==================== ATTACK TREE TOOLBAR COMPONENT ====================
// Extracted toolbar component for better maintainability
// Features:
// - DFD Preview toggle
// - Main view toggle (Overview/Editor)
// - Tree selector dropdown
// - Action buttons (Create, Sync, Config, Export, Import)
// - Status chips (Sync, Validation, Coverage, Dirty state)
// - Proceed button

import React, { useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  IconButton,
  Tooltip,
  Typography,
  Button,
  Divider,
  Chip,
  ToggleButtonGroup,
  ToggleButton,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
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
  ViewList as OverviewIcon,
  AccountTree as TreeIcon,
  CheckCircle as ValidIcon,
  Error as InvalidIcon,
} from "@mui/icons-material";

import {
  AttackTree,
  getAnchorTypeIcon,
} from "../models/attacktree-types";

// ==================== TYPES ====================

export type MainView = "overview" | "editor";

export interface AttackTreeToolbarProps {
  // View state
  mainView: MainView;
  onMainViewChange: (view: MainView) => void;
  showDfdPreview: boolean;
  onToggleDfdPreview: () => void;

  // Tree selection
  selectedTreeId: string | null;
  onTreeSelect: (treeId: string) => void;
  trees: AttackTree[];
  hasTrees: boolean;

  // Actions
  onCreateTree: () => void;
  onSyncFromAssets?: () => void;
  onOpenConfig: () => void;
  onExport: () => void;
  onImport: () => void;
  onProceed: () => void;

  // Status
  isCriticalWorkflow: boolean;
  isSyncing: boolean;
  needsSync: boolean;
  validTreeCount: number;
  totalTreeCount: number;
  completeAssets?: number;
  totalAssets?: number;
  isDirty: boolean;
  canProceed: boolean;

  // File input ref (for import)
  fileInputRef?: React.RefObject<HTMLInputElement>;
}

// ==================== COMPONENT ====================

export const AttackTreeToolbar: React.FC<AttackTreeToolbarProps> = ({
  mainView,
  onMainViewChange,
  showDfdPreview,
  onToggleDfdPreview,
  selectedTreeId,
  onTreeSelect,
  trees,
  hasTrees,
  onCreateTree,
  onSyncFromAssets,
  onOpenConfig,
  onExport,
  onImport,
  onProceed,
  isCriticalWorkflow,
  isSyncing,
  needsSync,
  validTreeCount,
  totalTreeCount,
  completeAssets,
  totalAssets,
  isDirty,
  canProceed,
  fileInputRef,
}) => {
  const { t, i18n } = useTranslation();
  const isGerman = i18n.language === "de";

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 2,
        py: 1,
        borderBottom: "1px solid",
        borderColor: "divider",
        backgroundColor: "background.paper",
        flexWrap: "wrap",
      }}
    >
      {/* DFD Preview Toggle */}
      <Tooltip title={showDfdPreview ? "Hide DFD Preview" : "Show DFD Preview"}>
        <IconButton
          onClick={onToggleDfdPreview}
          size="small"
          color={showDfdPreview ? "primary" : "default"}
        >
          {showDfdPreview ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Tooltip>

      <Divider orientation="vertical" flexItem />

      {/* Main View Toggle (Overview / Editor) */}
      <ToggleButtonGroup
        value={mainView}
        exclusive
        onChange={(_, v) => v && onMainViewChange(v)}
        size="small"
      >
        <ToggleButton value="overview">
          <Tooltip title={isGerman ? "Übersicht" : "Overview"}>
            <OverviewIcon fontSize="small" />
          </Tooltip>
        </ToggleButton>
        <ToggleButton value="editor" disabled={!hasTrees}>
          <Tooltip title="Editor">
            <TreeIcon fontSize="small" />
          </Tooltip>
        </ToggleButton>
      </ToggleButtonGroup>

      {/* Tree Selector (only in Editor view) */}
      {mainView === "editor" && hasTrees && (
        <>
          <Divider orientation="vertical" flexItem />
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <Select
              value={selectedTreeId || ""}
              onChange={(e) => onTreeSelect(e.target.value)}
              displayEmpty
            >
              {trees.map((tree) => (
                <MenuItem key={tree.id} value={tree.id}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <span>{getAnchorTypeIcon(tree.anchor.type)}</span>
                    <span>{tree.name}</span>
                    {tree.validation?.isValid ? (
                      <ValidIcon fontSize="small" color="success" />
                    ) : (
                      <InvalidIcon fontSize="small" color="error" />
                    )}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </>
      )}

      <Divider orientation="vertical" flexItem />

      {/* Add New Tree */}
      <Tooltip title={isGerman ? "Neuer Attack Tree" : "New Attack Tree"}>
        <IconButton onClick={onCreateTree} size="small">
          <AddIcon />
        </IconButton>
      </Tooltip>

      {/* Sync from Assets (Critical Workflow only) */}
      {isCriticalWorkflow && onSyncFromAssets && (
        <Tooltip
          title={isGerman ? "Von Assets synchronisieren" : "Sync from Assets"}
        >
          <span>
            <IconButton
              onClick={onSyncFromAssets}
              size="small"
              color={needsSync ? "warning" : "default"}
              disabled={isSyncing}
            >
              {isSyncing ? <CircularProgress size={20} /> : <SyncIcon />}
            </IconButton>
          </span>
        </Tooltip>
      )}

      {/* Configuration */}
      <Tooltip title={isGerman ? "Konfiguration" : "Configuration"}>
        <IconButton onClick={onOpenConfig} size="small">
          <SettingsIcon />
        </IconButton>
      </Tooltip>

      {/* Export */}
      <Tooltip title={isGerman ? "Exportieren" : "Export"}>
        <span>
          <IconButton onClick={onExport} size="small" disabled={!hasTrees}>
            <ExportIcon />
          </IconButton>
        </span>
      </Tooltip>

      {/* Import */}
      <Tooltip title={isGerman ? "Importieren" : "Import"}>
        <IconButton onClick={onImport} size="small">
          <ImportIcon />
        </IconButton>
      </Tooltip>

      <Box sx={{ flexGrow: 1 }} />

      {/* Sync Status */}
      {needsSync && (
        <Chip
          icon={<WarningIcon />}
          label={isGerman ? "Sync erforderlich" : "Sync required"}
          size="small"
          color="warning"
          variant="outlined"
        />
      )}

      {/* Validation Stats */}
      <Chip
        label={`${validTreeCount}/${totalTreeCount} ${
          isGerman ? "valide" : "valid"
        }`}
        size="small"
        variant="outlined"
      />

      {/* Critical Workflow Coverage */}
      {isCriticalWorkflow && completeAssets !== undefined && totalAssets !== undefined && (
        <Chip
          label={`${completeAssets}/${totalAssets} Assets`}
          size="small"
          color={completeAssets === totalAssets ? "success" : "warning"}
        />
      )}

      {/* Dirty State */}
      {isDirty && (
        <Chip
          label={isGerman ? "Ungespeichert" : "Unsaved"}
          size="small"
          color="warning"
          variant="outlined"
        />
      )}

      <Divider orientation="vertical" flexItem />

      {/* Proceed Button */}
      <Button
        endIcon={<NextIcon />}
        onClick={onProceed}
        disabled={!canProceed}
        size="small"
        variant="outlined"
        color="success"
      >
        {isGerman ? "Weiter" : "Continue"}
      </Button>
    </Box>
  );
};

export default AttackTreeToolbar;