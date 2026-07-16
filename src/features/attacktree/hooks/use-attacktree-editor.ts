// ==================== USE ATTACK TREE EDITOR HOOK ====================
// Manages DSL editing with debounced parsing
// Provides local state to prevent editor remounting and focus loss
// This is the KEY hook that solves the Monaco/CodeMirror focus problem

import { useState, useCallback, useEffect, useRef } from "react";
import {
  AttackTree,
  AttackTreeProjectData,
} from "../models/attacktree-types";
import { attackTreeOperations } from "../services/attacktree-operations";
import { reconcileAttackPathThreats } from "../services/attacktree-threat-sync";
import type { PathDiff } from "../services/attacktree-path-identity";

// ==================== TYPES ====================

export interface AttackTreeEditorState {
  /** Local DSL for immediate updates (prevents editor remounting) */
  localDsl: string;
  /** Is parsing currently in progress */
  isParsing: boolean;
  /**
   * Result of the last Class A/B path diff after a re-parse. requiresBanner
   * true → an assessed path vanished/changed identity; the tab shows a banner.
   * null before the first parse.
   */
  pathDiff: PathDiff | null;
}

export interface AttackTreeEditorActions {
  /** Handle DSL change (immediate local update + debounced parse) */
  handleDslChange: (newDsl: string) => void;
  /** Force immediate parse (for save button, etc.) */
  parseImmediately: () => void;
}

export type AttackTreeEditorHook = AttackTreeEditorState &
  AttackTreeEditorActions;

// ==================== CONFIGURATION ====================

/**
 * Debounce delay in milliseconds
 * - 200ms: Very responsive, but parsing happens often
 * - 500ms: Good balance (recommended)
 * - 1000ms: Less CPU usage, but feels sluggish
 */
const DEBOUNCE_DELAY = 500;

// ==================== HOOK ====================

/**
 * Hook for managing Attack Tree DSL editing
 * 
 * Key features:
 * - Local DSL state for immediate updates (no editor remounting)
 * - Debounced parsing (500ms after last keystroke)
 * - Automatic cleanup on unmount
 * 
 * @param selectedTree - Currently selected tree (or null)
 * @param project - Project data for validation
 * @param onTreeUpdate - Callback when tree is updated after parsing
 */
export function useAttackTreeEditor(
  selectedTree: AttackTree | null,
  project: AttackTreeProjectData,
  onTreeUpdate: (tree: AttackTree) => void
): AttackTreeEditorHook {
  // ==================== STATE ====================

  /**
   * Local DSL state - updates immediately on keystroke
   * This prevents the editor from remounting and losing focus
   */
  const [localDsl, setLocalDsl] = useState("");

  /**
   * Parsing in progress flag
   * Could be used to show a loading indicator
   */
  const [isParsing, setIsParsing] = useState(false);

  const [pathDiff, setPathDiff] = useState<PathDiff | null>(null);

  /**
   * Timeout reference for debouncing
   */
  const parseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  /**
   * Ref to onTreeUpdate to keep callback stable
   */
  const onTreeUpdateRef = useRef(onTreeUpdate);
  useEffect(() => {
    onTreeUpdateRef.current = onTreeUpdate;
  }, [onTreeUpdate]);

  // ==================== EFFECTS ====================

  /**
   * Sync localDsl when selected tree changes
   * Important: Only sync on tree ID change, not on every tree update
   * This prevents overwriting user's typing with parsed results
   */
  useEffect(() => {
    if (selectedTree) {
      setLocalDsl(selectedTree.dsl);
    } else {
      setLocalDsl("");
    }
  }, [selectedTree?.id]); // Only depend on ID, not entire tree object

  /**
   * Cleanup timeout on unmount
   */
  useEffect(() => {
    return () => {
      if (parseTimeoutRef.current) {
        clearTimeout(parseTimeoutRef.current);
      }
    };
  }, []);

  // ==================== ACTIONS ====================

  /**
   * Parse the current DSL immediately (without debouncing)
   * Useful for "Save" buttons or manual triggers
   */
  const parseImmediately = useCallback(() => {
    const currentTree = selectedTree;
    if (!currentTree) return;

    // Clear any pending timeout
    if (parseTimeoutRef.current) {
      clearTimeout(parseTimeoutRef.current);
      parseTimeoutRef.current = null;
    }

    // Parse immediately
    setIsParsing(true);
    const previousAnalysis = currentTree.pathAnalysis;
    const updatedTree = attackTreeOperations.parseAndValidateTree(
      currentTree,
      localDsl,
      project,
    );
    // Class A/B diff on the fresh analysis vs. the one before this edit.
    // pathAssessments survive parseAndValidateTree's {...tree} spread, so the
    // reconcile sees the analyst's decisions.
    const { diff } = reconcileAttackPathThreats(updatedTree, previousAnalysis);
    setPathDiff(diff);
    onTreeUpdateRef.current(updatedTree);
    setIsParsing(false);
  }, [selectedTree?.id, localDsl, project]);
   

  /**
   * Handle DSL change with debounced parsing
   * 
   * Flow:
   * 1. Update localDsl immediately → Editor re-renders with new value (NO REMOUNTING!)
   * 2. Clear previous timeout
   * 3. Start new timeout for parsing
   * 4. If user keeps typing, timeout gets reset
   * 5. After 500ms of no typing, parse and validate
   */
  const handleDslChange = useCallback(
  (newDsl: string) => {
    const currentTree = selectedTree;
    if (!currentTree) return;

    // Step 1: Update local DSL immediately
    setLocalDsl(newDsl);

    // Step 2: Clear previous timeout
    if (parseTimeoutRef.current) {
      clearTimeout(parseTimeoutRef.current);
    }

    // Step 3: Debounced parsing
    parseTimeoutRef.current = setTimeout(() => {
      setIsParsing(true);
      const previousAnalysis = currentTree.pathAnalysis;

      // Parse and validate
      const updatedTree = attackTreeOperations.parseAndValidateTree(
        currentTree,
        newDsl,
        project
      );
      const { diff } = reconcileAttackPathThreats(
        updatedTree,
        previousAnalysis,
      );
      setPathDiff(diff);

      // Notify parent
      onTreeUpdateRef.current(updatedTree);

      setIsParsing(false);
    }, DEBOUNCE_DELAY);
  },
  [selectedTree?.id, project]
);

  // ==================== RETURN ====================

  return {
    // State
    localDsl,
    isParsing,
    pathDiff,
    // Actions
    handleDslChange,
    parseImmediately,
  };
}

export default useAttackTreeEditor;

// ==================== USAGE EXAMPLE ====================
/*
// In your component:
const { localDsl, handleDslChange, isParsing } = useAttackTreeEditor(
  selectedTree,
  project,
  updateTree
);

// In your render:
<AttackTreeEditor
  dsl={localDsl}  // ← Use localDsl, NOT selectedTree.dsl!
  onDslChange={handleDslChange}
  // ... other props
/>

// Optional: Show parsing indicator
{isParsing && <CircularProgress size={20} />}
*/