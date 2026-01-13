// ==================== USE ACCORDION STATE HOOK ====================
// Manages expand/collapse state for accordion groups
// Supports localStorage persistence

import { useState, useCallback, useEffect } from "react";

// ==================== TYPES ====================

export interface UseAccordionStateOptions {
  /** Initial keys that should be expanded */
  initialKeys?: string[];
  /** LocalStorage key for persistence (optional) */
  storageKey?: string;
  /** Default expanded state for new keys */
  defaultExpanded?: boolean;
}

// ==================== HOOK ====================

export function useAccordionState(options: UseAccordionStateOptions = {}) {
  const {
    initialKeys = [],
    storageKey,
    defaultExpanded = true,
  } = options;

  // Initialize state from localStorage or initialKeys
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    // Try to load from localStorage first
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // Fall through to default
        }
      }
    }

    // Use initialKeys as default
    return Object.fromEntries(
      initialKeys.map((key) => [key, defaultExpanded])
    );
  });

  // Persist to localStorage when changed
  useEffect(() => {
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(expanded));
    }
  }, [expanded, storageKey]);

  // Toggle a specific key
  const toggle = useCallback((key: string) => {
    setExpanded((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  // Set a specific key to a value
  const set = useCallback((key: string, value: boolean) => {
    setExpanded((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  // Expand all
  const expandAll = useCallback((keys: string[]) => {
    setExpanded((prev) => ({
      ...prev,
      ...Object.fromEntries(keys.map((key) => [key, true])),
    }));
  }, []);

  // Collapse all
  const collapseAll = useCallback((keys: string[]) => {
    setExpanded((prev) => ({
      ...prev,
      ...Object.fromEntries(keys.map((key) => [key, false])),
    }));
  }, []);

  // Ensure new keys have default state
  const ensureKeys = useCallback(
    (keys: string[]) => {
      setExpanded((prev) => {
        const updated = { ...prev };
        let hasChanges = false;

        for (const key of keys) {
          if (!(key in updated)) {
            updated[key] = defaultExpanded;
            hasChanges = true;
          }
        }

        return hasChanges ? updated : prev;
      });
    },
    [defaultExpanded]
  );

  return {
    expanded,
    toggle,
    set,
    expandAll,
    collapseAll,
    ensureKeys,
  };
}