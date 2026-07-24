// ==================== ATTACK TREE TOOLBAR COMPONENT ====================
// Extracted toolbar component for better maintainability
// Features:
// - DFD Preview toggle
// - Main view toggle (Overview/Editor)
// - Action buttons (Create, Sync, Config, Export, Import)
// - Status chips (Sync, Validation, Coverage, Dirty state)
//
// The tree selector moved to the detail header (attacktree-detail-view.tsx):
// it has to be reachable in the table view too, and a toolbar control that
// only applies to one of two views belongs to that view, not to the tab.

import React, { useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  IconButton,
  Tooltip,
  Typography,
  Divider,
  Chip,
  ToggleButtonGroup,
  ToggleButton,
  CircularProgress,
} from "@mui/material";
import {
  Settings as SettingsIcon,
  Sync as SyncIcon,
  Warning as WarningIcon,
  Download as ExportIcon,
  Upload as ImportIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Add as AddIcon,
  ViewList as OverviewIcon,
  AccountTree as TreeIcon,
} from "@mui/icons-material";

// ==================== TYPES ====================

export type MainView = "overview" | "editor";

export interface AttackTreeToolbarProps {
  // View state
  mainView: MainView;
  onMainViewChange: (view: MainView) => void;
  showDfdPreview: boolean;
  onToggleDfdPreview: () => void;

  /** Only gates the Editor toggle — the selector itself lives in the detail view. */
  hasTrees: boolean;

  // Actions
  onCreateTree: () => void;
  onSyncFromAssets?: () => void;
  onOpenConfig: () => void;
  onExport: () => void;
  onImport: () => void;

  // Status
  isCriticalWorkflow: boolean;
  isSyncing: boolean;
  needsSync: boolean;
  validTreeCount: number;
  totalTreeCount: number;
  completeAssets?: number;
  totalAssets?: number;
  isDirty: boolean;

  // File input ref (for import)
  fileInputRef?: React.RefObject<HTMLInputElement>;
}

// ==================== COMPONENT ====================

export const AttackTreeToolbar: React.FC<AttackTreeToolbarProps> = ({
  mainView,
  onMainViewChange,
  showDfdPreview,
  onToggleDfdPreview,
  hasTrees,
  onCreateTree,
  onSyncFromAssets,
  onOpenConfig,
  onExport,
  onImport,
  isCriticalWorkflow,
  isSyncing,
  needsSync,
  validTreeCount,
  totalTreeCount,
  completeAssets,
  totalAssets,
  isDirty,
  fileInputRef,
}) => {
  const { t } = useTranslation();

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
          <Tooltip title={t("attacktree:tabs.attacktree.toolbar.overview")}>
            <OverviewIcon fontSize="small" />
          </Tooltip>
        </ToggleButton>
        <ToggleButton value="editor" disabled={!hasTrees}>
          <Tooltip title="Editor">
            <TreeIcon fontSize="small" />
          </Tooltip>
        </ToggleButton>
      </ToggleButtonGroup>

      <Divider orientation="vertical" flexItem />

      {/* Add New Tree */}
      <Tooltip title={t("attacktree:tabs.attacktree.toolbar.newAttackTree")}>
        <IconButton onClick={onCreateTree} size="small">
          <AddIcon />
        </IconButton>
      </Tooltip>

      {/* Sync from Assets (Critical Workflow only) */}
      {isCriticalWorkflow && onSyncFromAssets && (
        <Tooltip title={t("attacktree:tabs.attacktree.toolbar.syncFromAssets")}>
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
      <Tooltip title={t("attacktree:tabs.attacktree.toolbar.configuration")}>
        <IconButton onClick={onOpenConfig} size="small">
          <SettingsIcon />
        </IconButton>
      </Tooltip>

      {/* Export */}
      <Tooltip title={t("attacktree:tabs.attacktree.toolbar.export")}>
        <span>
          <IconButton onClick={onExport} size="small" disabled={!hasTrees}>
            <ExportIcon />
          </IconButton>
        </span>
      </Tooltip>

      {/* Import */}
      <Tooltip title={t("attacktree:tabs.attacktree.toolbar.import")}>
        <IconButton onClick={onImport} size="small">
          <ImportIcon />
        </IconButton>
      </Tooltip>

      <Box sx={{ flexGrow: 1 }} />

      {/* Sync Status */}
      {needsSync && (
        <Chip
          icon={<WarningIcon />}
          label={t("attacktree:tabs.attacktree.toolbar.syncRequired")}
          size="small"
          color="warning"
          variant="outlined"
        />
      )}

      {/* Validation Stats */}
      <Chip
        label={`${validTreeCount}/${totalTreeCount} ${t(
          "attacktree:tabs.attacktree.toolbar.valid",
        )}`}
        size="small"
        variant="outlined"
      />

      {/* Critical Workflow Coverage */}
      {isCriticalWorkflow &&
        completeAssets !== undefined &&
        totalAssets !== undefined && (
          <Chip
            label={`${completeAssets}/${totalAssets} Assets`}
            size="small"
            color={completeAssets === totalAssets ? "success" : "warning"}
          />
        )}

      {/* Dirty State */}
      {isDirty && (
        <Chip
          label={t("attacktree:tabs.attacktree.toolbar.unsaved")}
          size="small"
          color="warning"
          variant="outlined"
        />
      )}
    </Box>
  );
};

export default AttackTreeToolbar;