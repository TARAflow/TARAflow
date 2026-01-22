// ==================== USE ATTACK TREE UI HOOK ====================
// Manages all UI state (dialogs, panels, view modes, etc.)
// Uses localStorage for persistence where appropriate

import { useState } from "react";
import { useLocalStorage } from "./use-local-storage";

export type MainView = "overview" | "editor";

export interface AttackTreeUIState {
  // View State
  showDfdPreview: boolean;
  mainView: MainView;
  editorCollapsed: boolean;
  editorWidthPercent: number;
  topPanelHeight: number;

  // Dialog State
  showConfigDialog: boolean;
  showCreateDialog: boolean;
  showDeleteConfirm: boolean;
  showSyncConfirm: boolean;

  // Accordion State
  expandedGroups: string[];

  // Delete confirmation
  treeToDelete: string | null;
}

export interface AttackTreeUIActions {
  // View Actions
  setShowDfdPreview: (show: boolean) => void;
  setMainView: (view: MainView) => void;
  setEditorCollapsed: (collapsed: boolean) => void;
  setEditorWidthPercent: (percent: number) => void;
  setTopPanelHeight: (height: number) => void;
  toggleDfdPreview: () => void;

  // Dialog Actions
  setShowConfigDialog: (show: boolean) => void;
  setShowCreateDialog: (show: boolean) => void;
  setShowDeleteConfirm: (show: boolean) => void;
  setShowSyncConfirm: (show: boolean) => void;

  // Accordion Actions
  setExpandedGroups: (groups: string[]) => void;
  toggleGroupExpanded: (groupId: string) => void;

  // Delete Actions
  setTreeToDelete: (treeId: string | null) => void;
  startDeleteTree: (treeId: string) => void;
  cancelDelete: () => void;
}

export type AttackTreeUI = AttackTreeUIState & AttackTreeUIActions;

/**
 * Hook for managing Attack Tree UI state
 * Persists view preferences to localStorage
 */
export function useAttackTreeUI(): AttackTreeUI {
  // ==================== PERSISTED STATE (localStorage) ====================

  // DFD Preview Panel
  const [showDfdPreview, setShowDfdPreview] = useLocalStorage(
    "attacktree-tab-showDfdPreview",
    false
  );

  // Main View Mode (overview vs editor)
  const [mainView, setMainView] = useLocalStorage<MainView>(
    "attacktree-tab-mainView",
    "overview"
  );

  // Editor Width (split view)
  const [editorWidthPercent, setEditorWidthPercent] = useLocalStorage(
    "attacktree-tab-editorWidth",
    50
  );

  // Top Panel Height (DFD preview)
  const [topPanelHeight, setTopPanelHeight] = useLocalStorage(
    "attacktree-tab-topPanelHeight",
    200
  );

  // ==================== SESSION STATE (not persisted) ====================

  // Editor collapsed state
  const [editorCollapsed, setEditorCollapsed] = useState(false);

  // Dialog visibility
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);

  // Accordion expansion state
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  // Delete confirmation
  const [treeToDelete, setTreeToDelete] = useState<string | null>(null);

  // ==================== ACTIONS ====================

  /**
   * Toggle DFD preview panel
   */
  const toggleDfdPreview = () => {
    setShowDfdPreview((prev) => !prev);
  };

  /**
   * Toggle accordion group expansion
   */
  const toggleGroupExpanded = (groupId: string) => {
    setExpandedGroups((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    );
  };

  /**
   * Start delete tree flow
   */
  const startDeleteTree = (treeId: string) => {
    setTreeToDelete(treeId);
    setShowDeleteConfirm(true);
  };

  /**
   * Cancel delete
   */
  const cancelDelete = () => {
    setTreeToDelete(null);
    setShowDeleteConfirm(false);
  };

  // ==================== RETURN ====================

  return {
    // State
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

    // Actions
    setShowDfdPreview,
    setMainView,
    setEditorCollapsed,
    setEditorWidthPercent,
    setTopPanelHeight,
    toggleDfdPreview,
    setShowConfigDialog,
    setShowCreateDialog,
    setShowDeleteConfirm,
    setShowSyncConfirm,
    setExpandedGroups,
    toggleGroupExpanded,
    setTreeToDelete,
    startDeleteTree,
    cancelDelete,
  };
}

export default useAttackTreeUI;