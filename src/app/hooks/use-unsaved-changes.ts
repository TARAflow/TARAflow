// ==================== useUnsavedChanges HOOK ====================
// Custom hook for managing unsaved changes detection and warnings

import { useState, useEffect, useCallback, useRef } from 'react';

// ==================== TYPES ====================

export interface UnsavedChangesState {
  hasChanges: boolean;
  lastSaved: Date | null;
}

export interface UseUnsavedChangesOptions {
  onBeforeUnload?: (hasChanges: boolean) => boolean;
  autoSaveInterval?: number; // in milliseconds
  onAutoSave?: () => Promise<void>;
}

export interface UseUnsavedChangesReturn {
  hasUnsavedChanges: boolean;
  lastSaved: Date | null;
  markAsChanged: () => void;
  markAsSaved: () => void;
  reset: () => void;
  timeSinceLastSave: string | null;
}

// ==================== HELPER FUNCTIONS ====================

const formatTimeSince = (date: Date | null): string | null => {
  if (!date) return null;

  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds} seconds ago`;
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
};

// ==================== HOOK ====================

export const useUnsavedChanges = (
  options: UseUnsavedChangesOptions = {}
): UseUnsavedChangesReturn => {
  const {
    onBeforeUnload,
    autoSaveInterval = 0,
    onAutoSave
  } = options;

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [timeSinceLastSave, setTimeSinceLastSave] = useState<string | null>(null);
  
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const updateTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ==================== UPDATE TIME SINCE LAST SAVE ====================

  useEffect(() => {
    const updateTime = () => {
      setTimeSinceLastSave(formatTimeSince(lastSaved));
    };

    // Update immediately
    updateTime();

    // Update every 10 seconds
    updateTimerRef.current = setInterval(updateTime, 10000);

    return () => {
      if (updateTimerRef.current) {
        clearInterval(updateTimerRef.current);
      }
    };
  }, [lastSaved]);

  // ==================== BROWSER BEFOREUNLOAD HANDLER ====================

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        // Custom callback
        if (onBeforeUnload) {
          const shouldPrevent = onBeforeUnload(hasUnsavedChanges);
          if (!shouldPrevent) return;
        }

        // Standard browser warning
        e.preventDefault();
        e.returnValue = ''; // Chrome requires returnValue to be set
        return ''; // Some browsers show this message
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges, onBeforeUnload]);

  // ==================== AUTO-SAVE ====================

  useEffect(() => {
    if (autoSaveInterval > 0 && hasUnsavedChanges && onAutoSave) {
      // Clear existing timer
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }

      // Set new timer
      autoSaveTimerRef.current = setTimeout(async () => {
        try {
          await onAutoSave();
          setHasUnsavedChanges(false);
          setLastSaved(new Date());
        } catch (error) {
          console.error('Auto-save failed:', error);
        }
      }, autoSaveInterval);
    }

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [hasUnsavedChanges, autoSaveInterval, onAutoSave]);

  // ==================== HANDLERS ====================

  const markAsChanged = useCallback(() => {
    setHasUnsavedChanges(true);
  }, []);

  const markAsSaved = useCallback(() => {
    setHasUnsavedChanges(false);
    setLastSaved(new Date());
  }, []);

  const reset = useCallback(() => {
    setHasUnsavedChanges(false);
    setLastSaved(null);
  }, []);

  // ==================== RETURN ====================

  return {
    hasUnsavedChanges,
    lastSaved,
    markAsChanged,
    markAsSaved,
    reset,
    timeSinceLastSave
  };
};

// ==================== DEBOUNCED UNSAVED CHANGES HOOK ====================

export interface UseDebouncedUnsavedChangesOptions extends UseUnsavedChangesOptions {
  debounceDelay?: number; // in milliseconds
}

/**
 * Debounced version of useUnsavedChanges - waits for user to stop making changes
 * before marking as changed (useful for text inputs)
 */
export const useDebouncedUnsavedChanges = (
  options: UseDebouncedUnsavedChangesOptions = {}
): UseUnsavedChangesReturn & { markAsChangedDebounced: () => void } => {
  const { debounceDelay = 500, ...otherOptions } = options;
  const unsavedChanges = useUnsavedChanges(otherOptions);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const markAsChangedDebounced = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      unsavedChanges.markAsChanged();
    }, debounceDelay);
  }, [debounceDelay, unsavedChanges]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    ...unsavedChanges,
    markAsChangedDebounced
  };
};

// ==================== FORM UNSAVED CHANGES HOOK ====================

export interface UseFormUnsavedChangesOptions<T> extends UseUnsavedChangesOptions {
  initialValues: T;
  onSave?: (values: T) => Promise<void>;
}

/**
 * Specialized hook for form unsaved changes detection
 * Automatically detects when form values differ from initial values
 */
export const useFormUnsavedChanges = <T extends Record<string, any>>(
  currentValues: T,
  options: UseFormUnsavedChangesOptions<T>
): UseUnsavedChangesReturn & { isDirty: boolean; save: () => Promise<void> } => {
  const { initialValues, onSave, ...otherOptions } = options;
  const unsavedChanges = useUnsavedChanges(otherOptions);
  const [savedValues, setSavedValues] = useState<T>(initialValues);

  // Check if values have changed
  const isDirty = JSON.stringify(currentValues) !== JSON.stringify(savedValues);

  // Update unsaved changes state when form becomes dirty
  useEffect(() => {
    if (isDirty && !unsavedChanges.hasUnsavedChanges) {
      unsavedChanges.markAsChanged();
    } else if (!isDirty && unsavedChanges.hasUnsavedChanges) {
      unsavedChanges.markAsSaved();
    }
  }, [isDirty, unsavedChanges]);

  const save = useCallback(async () => {
    if (onSave) {
      await onSave(currentValues);
      setSavedValues(currentValues);
      unsavedChanges.markAsSaved();
    }
  }, [currentValues, onSave, unsavedChanges]);

  return {
    ...unsavedChanges,
    isDirty,
    save
  };
};

export default useUnsavedChanges;