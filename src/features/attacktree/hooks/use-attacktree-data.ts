// ==================== USE ATTACK TREE DATA HOOK ====================
// Manages attack tree data state and CRUD operations
// Handles sync with project data and auto-save

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  AttackTree,
  AttackTreeData,
  AttackTreeProjectData,
  AttackTreeUpdateResult,
  AttackTreeAnchor,
  AttackTreeProjectConfiguration,
  SecurityGoalType,
  createDefaultAttackTreeData,
  DEFAULT_ATTACKTREE_PROJECT_CONFIGURATION,
} from "../models/attacktree-types";
import { attackTreeOperations } from "../services/attacktree-operations";

// ==================== TYPES ====================

export interface AttackTreeDataState {
  attackTreeData: AttackTreeData;
  selectedTreeId: string | null;
  selectedTree: AttackTree | null;
  isDirty: boolean;
  hasTrees: boolean;
  validTreeCount: number;
}

export interface AttackTreeDataActions {
  // Selection
  setSelectedTreeId: (id: string | null) => void;
  selectTree: (treeId: string, switchToEditor?: boolean) => void;

  // CRUD Operations
  createTree: (anchor: AttackTreeAnchor) => void;
  updateTree: (tree: AttackTree) => void;
  deleteTree: (treeId: string) => void;

  // Batch Operations
  syncFromAssets: () => AttackTree[];
  updateConfiguration: (config: AttackTreeProjectConfiguration) => void;

  // Import
  importTree: (jsonData: string) => boolean;

  // Internal state management
  setAttackTreeData: React.Dispatch<React.SetStateAction<AttackTreeData>>;
  setIsDirty: (dirty: boolean) => void;
}

export type AttackTreeDataHook = AttackTreeDataState & AttackTreeDataActions;

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

// ==================== HOOK ====================

export function useAttackTreeData(
  project: AttackTreeProjectData,
  onUpdate: (updates: AttackTreeUpdateResult) => void,
  onDirtyChange?: (isDirty: boolean) => void
): AttackTreeDataHook {
  // ==================== STATE ====================

  // Main attack tree data (local working copy)
  const [attackTreeData, setAttackTreeData] = useState<AttackTreeData>(() =>
    ensureValidAttackTreeData(project.attackTrees)
  );

  // Selected tree ID
  const [selectedTreeId, setSelectedTreeId] = useState<string | null>(() => {
    const data = ensureValidAttackTreeData(project.attackTrees);
    return data.trees.length > 0 ? data.trees[0].id : null;
  });

  // Dirty flag
  const [isDirty, setIsDirty] = useState(false);

  // ==================== DERIVED STATE ====================

  // Selected tree object
  const selectedTree = useMemo(() => {
    if (!selectedTreeId) return null;
    return attackTreeData.trees.find((t) => t.id === selectedTreeId) || null;
  }, [attackTreeData.trees, selectedTreeId]);

  // Has trees flag
  const hasTrees = attackTreeData.trees.length > 0;

  // Valid tree count
  const validTreeCount = useMemo(() => {
    return attackTreeOperations.countValidTrees(attackTreeData.trees);
  }, [attackTreeData.trees]);

  // ==================== EFFECTS ====================

  // Sync from project when it changes externally
  useEffect(() => {
    setAttackTreeData(ensureValidAttackTreeData(project.attackTrees));
  }, [project.attackTrees]);

  // Parse trees that don't have AST yet (on mount or after import)
  useEffect(() => {
    const treesNeedingParse = attackTreeData.trees.filter(
      attackTreeOperations.needsParsing
    );

    if (treesNeedingParse.length > 0) {
      const updatedTrees = attackTreeOperations.parseIfNeeded(
        attackTreeData.trees,
        project
      );

      setAttackTreeData((prev) => ({
        ...prev,
        trees: updatedTrees,
      }));
    }
  }, [attackTreeData.trees, project]);

  // Notify parent of dirty state changes
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

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

  // ==================== ACTIONS ====================

  /**
   * Select tree and optionally switch to editor view
   */
  const selectTree = useCallback(
    (treeId: string, switchToEditor?: boolean) => {
      setSelectedTreeId(treeId);
      // Note: switchToEditor would require access to UI hook
      // We'll handle this in the main component
    },
    []
  );

  /**
   * Create new attack tree
   */
  const createTree = useCallback(
    (anchor: AttackTreeAnchor) => {
      const defaultEvalMethod =
        attackTreeData.configuration?.defaultEvaluationMethod || "simple";

      // Create and parse tree
      const newTree = attackTreeOperations.createParsedTree(
        anchor,
        { evaluationMethod: defaultEvalMethod },
        project
      );

      // Add to collection
      setAttackTreeData((prev) => ({
        ...prev,
        trees: attackTreeOperations.addTreeToCollection(prev.trees, newTree),
        lastModified: new Date().toISOString(),
      }));

      // Select new tree
      setSelectedTreeId(newTree.id);
      setIsDirty(true);
    },
    [attackTreeData.configuration, project]
  );

  /**
   * Update existing tree
   */
  const updateTree = useCallback((updatedTree: AttackTree) => {
    setAttackTreeData((prev) => ({
      ...prev,
      trees: attackTreeOperations.updateTreeInCollection(
        prev.trees,
        updatedTree
      ),
      lastModified: new Date().toISOString(),
    }));
    setIsDirty(true);
  }, []);

  /**
   * Delete attack tree
   */
  const deleteTree = useCallback(
    (treeId: string) => {
      setAttackTreeData((prev) => {
        const newTrees = attackTreeOperations.removeTreeFromCollection(
          prev.trees,
          treeId
        );

        return {
          ...prev,
          trees: newTrees,
          lastModified: new Date().toISOString(),
        };
      });

      // Select another tree if current was deleted
      if (selectedTreeId === treeId) {
        setAttackTreeData((current) => {
          setSelectedTreeId(
            current.trees.length > 0 ? current.trees[0].id : null
          );
          return current;
        });
      }

      setIsDirty(true);
    },
    [selectedTreeId]
  );

  /**
   * Sync missing trees from assets (Critical Workflow)
   */
  const syncFromAssets = useCallback((): AttackTree[] => {
    const newTrees = attackTreeOperations.syncAllMissingTrees(
      attackTreeData.trees,
      project
    );

    if (newTrees.length > 0) {
      setAttackTreeData((prev) => ({
        ...prev,
        trees: [...prev.trees, ...newTrees],
        lastModified: new Date().toISOString(),
      }));
      setIsDirty(true);
    }

    return newTrees;
  }, [attackTreeData.trees, project]);

  /**
   * Update project configuration
   */
  const updateConfiguration = useCallback(
    (config: AttackTreeProjectConfiguration) => {
      setAttackTreeData((prev) => ({
        ...prev,
        configuration: config,
        lastModified: new Date().toISOString(),
      }));
      setIsDirty(true);
    },
    []
  );

  /**
   * Import tree from JSON
   */
  const importTree = useCallback(
    (jsonData: string): boolean => {
      const result = attackTreeOperations.importAndParseTree(jsonData, project);

      if (result.success && result.tree) {
        setAttackTreeData((prev) => ({
          ...prev,
          trees: attackTreeOperations.addTreeToCollection(
            prev.trees,
            result.tree!
          ),
          lastModified: new Date().toISOString(),
        }));
        setSelectedTreeId(result.tree.id);
        setIsDirty(true);
        return true;
      }

      return false;
    },
    [project]
  );

  // ==================== RETURN ====================

  return {
    // State
    attackTreeData,
    selectedTreeId,
    selectedTree,
    isDirty,
    hasTrees,
    validTreeCount,

    // Actions
    setSelectedTreeId,
    selectTree,
    createTree,
    updateTree,
    deleteTree,
    syncFromAssets,
    updateConfiguration,
    importTree,
    setAttackTreeData,
    setIsDirty,
  };
}

export default useAttackTreeData;