import { useEffect, useRef } from 'react';
import { Project } from "../models/project-types";

// ==================== AUTO-SAVE HOOK ====================

export interface UseAutoSaveOptions {
  enabled: boolean;
  interval: number; // in seconds
  /**
   * The project was written; `revision` is the in-memory revision of the
   * written state — the caller clears the unsaved flag only when nothing
   * changed since (manual test 2026-11-17: the interval wrote the file but
   * the flag, and the sidebar's yellow dots, stayed).
   */
  onSuccess?: (projectId: string, revision: number | undefined) => void;
  onError?: (projectId: string, error: string) => void;
}

export const useAutoSave = (
  activeProject: Project | null,
  options: UseAutoSaveOptions,
  persistence: any
) => {
  const { enabled, interval, onSuccess, onError } = options;
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveRef = useRef<string>(""); // JSON string of last saved state

  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Don't auto-save if disabled or no active project
    if (!enabled || !activeProject || interval <= 0) {
      return;
    }

    // Setup auto-save interval
    intervalRef.current = setInterval(async () => {
      // Check if project has unsaved changes
      if (!activeProject.hasUnsavedChanges) {
        return;
      }

      // Check if project state actually changed (avoid unnecessary writes)
      const currentState = JSON.stringify(activeProject);
      if (currentState === lastSaveRef.current) {
        return;
      }

      try {
        // Write full project to linked .tara.json via persistence adapter.
        // storageService.saveProject() is intentionally NOT called here —
        // it would write to localStorage which is not the source of truth
        // in Electron mode. Metadata sync happens in syncProjectToStorage.
        const result = await persistence.saveExistingProject(activeProject);

        if (result.success) {
          lastSaveRef.current = currentState;
          onSuccess?.(activeProject.id, activeProject.revision);
        } else {
          onError?.(activeProject.id, result.error || "Save failed");
        }
      } catch (error: any) {
        onError?.(activeProject.id, error.message || "Save failed");
      }
    }, interval * 1000);

    // Cleanup on unmount or when dependencies change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [activeProject, enabled, interval, onSuccess, onError]);

  // Manual save — same persistence adapter as auto-save interval.
  const saveNow = async (): Promise<boolean> => {
    if (!activeProject) return false;

    try {
      const result = await persistence.saveExistingProject(activeProject);

      if (result.success) {
        lastSaveRef.current = JSON.stringify(activeProject);
        onSuccess?.(activeProject.id, activeProject.revision);
        return true;
      } else {
        onError?.(activeProject.id, result.error || "Save failed");
        return false;
      }
    } catch (error: any) {
      onError?.(activeProject.id, error.message || "Save failed");
      return false;
    }
  };

  return { saveNow };
};