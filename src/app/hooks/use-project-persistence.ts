import { useState, useCallback } from 'react';
import { useFileSystemAccess } from './use-file-system-access';
import type { Project } from '../models/project-types';

/**
 * Unified Project Persistence Hook
 * Handles 3 modes:
 * 1. Electron - Native file system via IPC
 * 2. Browser with File System Access API - Direct file I/O
 * 3. Browser fallback - localStorage + download
 *
 * Electron mode: currentFilePath is persisted in localStorage so it
 * survives app restarts — auto-save works immediately after reopening.
 */

type PersistenceMode = 'electron' | 'file-system-access' | 'localStorage';

interface PersistenceResult {
  success: boolean;
  data?: any;
  error?: string;
}

const STORAGE_KEY = "taraflow:currentFilePath";

export const useProjectPersistence = () => {
  const fileSystemAccess = useFileSystemAccess();

  const [currentFileHandle, setCurrentFileHandle] =
    useState<FileSystemFileHandle | null>(null);

  // Initialize from localStorage so file path survives app restarts
  const [currentFilePath, setCurrentFilePathState] = useState<string | null>(
    () => {
      try {
        return localStorage.getItem(STORAGE_KEY) ?? null;
      } catch {
        return null;
      }
    },
  );

  // Always keep localStorage in sync
  const setCurrentFilePath = useCallback((path: string | null) => {
    setCurrentFilePathState(path);
    try {
      if (path) {
        localStorage.setItem(STORAGE_KEY, path);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  // Detect mode
  const isElectron =
    typeof window !== "undefined" &&
    typeof (window as any).electron?.file !== "undefined";

  const mode: PersistenceMode = isElectron
    ? "electron"
    : fileSystemAccess.isSupported
      ? "file-system-access"
      : "localStorage";

  /**
   * Save new project (show save dialog)
   */
  const saveNewProject = useCallback(
    async (project: Project): Promise<PersistenceResult> => {
      const fileName = project.info.name.replace(/\s+/g, "_");

      // Mode 1: Electron
      if (mode === "electron") {
        try {
          const result = await (window as any).electron.file.saveDialog(
            fileName,
          );
          if (!result.success) {
            return { success: false, error: result.error };
          }

          const filePath = result.data;
          const writeResult = await (window as any).electron.file.writeProject(
            filePath,
            JSON.stringify(project, null, 2),
          );

          if (writeResult.success) {
            setCurrentFilePath(filePath);
            return { success: true, data: { filePath } };
          }
          return { success: false, error: writeResult.error };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }

      // Mode 2: File System Access API
      if (mode === "file-system-access") {
        const pickResult = await fileSystemAccess.pickSaveLocation(fileName);
        if (!pickResult.success) {
          return pickResult;
        }

        const handle = pickResult.data;
        const writeResult = await fileSystemAccess.writeFile(
          handle,
          JSON.stringify(project, null, 2),
        );

        if (writeResult.success) {
          setCurrentFileHandle(handle);
          return { success: true, data: { handle } };
        }
        return writeResult;
      }

      // Mode 3: localStorage + Download
      return downloadProject(project);
    },
    [mode, fileSystemAccess, setCurrentFilePath],
  );

  /**
   * Save to existing file (no dialog).
   * In Electron mode, silently succeeds when no file path is set —
   * the project is already in localStorage from loadProjects().
   */
  const saveExistingProject = useCallback(
    async (project: Project): Promise<PersistenceResult> => {
      // Mode 1: Electron
      if (mode === "electron") {
        // Prefer filePath on the project object — it is set when the project
        // was opened from disk or saved for the first time. Fall back to the
        // hook-local currentFilePath (set by saveNewProject).
        const targetPath = project.filePath ?? currentFilePath;

        if (!targetPath) {
          // No file linked yet — silent success. The project has not been
          // saved to disk via the save dialog yet; that is not an error.
          return { success: true };
        }

        // Strip the computed DFD graph before writing — it is derived data
        // and would inflate the file size unnecessarily.
        const projectToWrite = {
          ...project,
          dfd: project.dfd ? { ...project.dfd, graph: undefined } : null,
        };

        try {
          const result = await (window as any).electron.file.writeProject(
            targetPath,
            JSON.stringify(projectToWrite, null, 2),
          );
          return result;
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      }

      // Mode 2: File System Access API
      if (mode === "file-system-access") {
        if (!currentFileHandle) {
          return { success: true }; // Same: no file linked, silent success
        }

        const result = await fileSystemAccess.writeFile(
          currentFileHandle,
          JSON.stringify(project, null, 2),
        );
        return result;
      }

      // Mode 3: localStorage (no download for auto-save)
      return { success: true };
    },
    [mode, currentFilePath, currentFileHandle, fileSystemAccess],
  );

  /**
   * Open project from file picker
   */
  const openProject = useCallback(async (): Promise<PersistenceResult> => {
    // Mode 1: Electron
    if (mode === "electron") {
      try {
        const result = await (window as any).electron.file.openDialog();
        if (!result.success) {
          return { success: false, error: result.error };
        }

        const filePath = result.data;
        const readResult = await (window as any).electron.file.readProject(
          filePath,
        );

        if (readResult.success) {
          const project = JSON.parse(readResult.data);
          setCurrentFilePath(filePath);
          return { success: true, data: { project, filePath } };
        }
        return { success: false, error: readResult.error };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }

    // Mode 2: File System Access API
    if (mode === "file-system-access") {
      const result = await fileSystemAccess.pickFile();
      if (result.success) {
        setCurrentFileHandle(result.data.handle);
        return { success: true, data: { project: result.data.project } };
      }
      return result;
    }

    // Mode 3: localStorage - use file input (handled by dialog)
    return { success: false, error: "Use file input in dialog" };
  }, [mode, fileSystemAccess, setCurrentFilePath]);

  /**
   * Download project (fallback mode)
   */
  const downloadProject = useCallback(
    (project: Project, filename?: string): PersistenceResult => {
      const defaultFilename = `${project.info.name.replace(/\s+/g, "_")}.tara.json`;
      const blob = new Blob([JSON.stringify(project, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || defaultFilename;
      a.click();
      URL.revokeObjectURL(url);
      return { success: true };
    },
    [],
  );

  /**
   * Clear current file reference (e.g., when closing project)
   */
  const clearCurrentFile = useCallback(() => {
    setCurrentFileHandle(null);
    setCurrentFilePath(null);
  }, [setCurrentFilePath]);

  return {
    mode,
    saveNewProject,
    saveExistingProject,
    openProject,
    downloadProject,
    clearCurrentFile,
    hasFileReference: !!(currentFileHandle || currentFilePath),
  };
};;