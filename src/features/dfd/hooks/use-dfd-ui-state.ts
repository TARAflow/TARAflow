// ==================== DFD UI STATE HOOK ====================
// Single Responsibility: Persist and restore DFD UI state (view mode, accordion states)
// Uses localStorage for persistence, sessionStorage for "first visit" detection

import { useState, useEffect, useCallback, useMemo } from "react";
import type { DFDViewMode } from "../models/dfd-types";

// ==================== TYPES ====================

interface DFDUIState {
  viewMode: DFDViewMode;
  expandedGroups: string[]; // Element type keys + "connections"
  darkMode: boolean;
}

interface UseDFDUIStateOptions {
  projectId: string;
}

interface UseDFDUIStateReturn {
  // View Mode
  viewMode: DFDViewMode;
  setViewMode: (mode: DFDViewMode) => void;

  // Dark Mode
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
  toggleDarkMode: () => void;

  // Accordion Groups (type groups only, not individual elements)
  expandedGroups: string[];
  toggleGroup: (groupKey: string) => void;
  setExpandedGroups: (groups: string[]) => void;
  isGroupExpanded: (groupKey: string) => boolean;

  // Individual element accordions (not persisted, managed locally)
  expandedElements: string[];
  toggleElement: (elementId: string) => void;
  isElementExpanded: (elementId: string) => boolean;
}

// ==================== CONSTANTS ====================

const STORAGE_KEY_PREFIX = "coretm-dfd-ui-state";

// ==================== HELPER FUNCTIONS ====================

const getStorageKey = (projectId: string): string =>
  `${STORAGE_KEY_PREFIX}-${projectId}`;

const loadState = (projectId: string): DFDUIState | null => {
  try {
    const key = getStorageKey(projectId);
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored) as DFDUIState;
    }
  } catch (error) {
    console.warn("[useDFDUIState] Failed to load state:", error);
  }
  return null;
};

const saveState = (projectId: string, state: DFDUIState): void => {
  try {
    const key = getStorageKey(projectId);
    localStorage.setItem(key, JSON.stringify(state));
  } catch (error) {
    console.warn("[useDFDUIState] Failed to save state:", error);
  }
};

// ==================== HOOK ====================

export const useDFDUIState = ({
  projectId,
}: UseDFDUIStateOptions): UseDFDUIStateReturn => {
  // Determine initial state based on stored state
  const initialState = useMemo(() => {
    const stored = loadState(projectId);

    // Restore from storage if available, otherwise use defaults
    return {
      viewMode: stored?.viewMode ?? ("draw" as DFDViewMode),
      expandedGroups: stored?.expandedGroups ?? [], // Start closed, remember after
      darkMode: stored?.darkMode ?? false,
    };
  }, [projectId]);

  // ==================== STATE ====================

  const [viewMode, setViewModeInternal] = useState<DFDViewMode>(
    initialState.viewMode
  );
  const [expandedGroups, setExpandedGroupsInternal] = useState<string[]>(
    initialState.expandedGroups
  );
  const [darkMode, setDarkModeInternal] = useState<boolean>(
    initialState.darkMode
  );
  const [expandedElements, setExpandedElements] = useState<string[]>([]);

  // ==================== PERSISTENCE ====================

  // Save state to localStorage whenever it changes
  useEffect(() => {
    saveState(projectId, { viewMode, expandedGroups, darkMode });
  }, [projectId, viewMode, expandedGroups, darkMode]);

  // Reset element accordions when switching projects
  useEffect(() => {
    setExpandedElements([]);
  }, [projectId]);

  // ==================== VIEW MODE ====================

  const setViewMode = useCallback((mode: DFDViewMode) => {
    setViewModeInternal(mode);
  }, []);

  // ==================== DARK MODE ====================

  const setDarkMode = useCallback((dark: boolean) => {
    setDarkModeInternal(dark);
  }, []);

  const toggleDarkMode = useCallback(() => {
    setDarkModeInternal((prev) => !prev);
  }, []);

  // ==================== GROUP ACCORDIONS ====================

  const toggleGroup = useCallback((groupKey: string) => {
    setExpandedGroupsInternal((prev) =>
      prev.includes(groupKey)
        ? prev.filter((g) => g !== groupKey)
        : [...prev, groupKey]
    );
  }, []);

  const setExpandedGroups = useCallback((groups: string[]) => {
    setExpandedGroupsInternal(groups);
  }, []);

  const isGroupExpanded = useCallback(
    (groupKey: string): boolean => {
      return expandedGroups.includes(groupKey);
    },
    [expandedGroups]
  );

  // ==================== ELEMENT ACCORDIONS (not persisted) ====================

  const toggleElement = useCallback((elementId: string) => {
    setExpandedElements((prev) =>
      prev.includes(elementId)
        ? prev.filter((e) => e !== elementId)
        : [...prev, elementId]
    );
  }, []);

  const isElementExpanded = useCallback(
    (elementId: string): boolean => {
      return expandedElements.includes(elementId);
    },
    [expandedElements]
  );

  // ==================== RETURN ====================

  return {
    viewMode,
    setViewMode,
    darkMode,
    setDarkMode,
    toggleDarkMode,
    expandedGroups,
    toggleGroup,
    setExpandedGroups,
    isGroupExpanded,
    expandedElements,
    toggleElement,
    isElementExpanded,
  };
};

export default useDFDUIState;