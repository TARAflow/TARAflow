import { useState, useCallback } from 'react';
import { useFileSystemAccess } from './use-file-system-access';
import type { Project } from '../models/project-types';

/**
 * Unified Project Persistence Hook
 * Handles 3 modes:
 * 1. Electron - Native file system via IPC
 * 2. Browser with File System Access API - Direct file I/O
 * 3. Browser fallback - localStorage + download
 */

type PersistenceMode = 'electron' | 'file-system-access' | 'localStorage';

interface PersistenceResult {
  success: boolean;
  data?: any;
  error?: string;
}

export const useProjectPersistence = () => {
  const fileSystemAccess = useFileSystemAccess();
  const [currentFileHandle, setCurrentFileHandle] = useState<FileSystemFileHandle | null>(null);
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);

  // Detect mode
  const isElectron = typeof window !== 'undefined' && 
                     typeof (window as any).electron?.file !== 'undefined';
  
  const mode: PersistenceMode = isElectron 
    ? 'electron' 
    : fileSystemAccess.isSupported 
      ? 'file-system-access' 
      : 'localStorage';

  /**
   * Save new project (show save dialog)
   */
  const saveNewProject = useCallback(async (project: Project): Promise<PersistenceResult> => {
    const fileName = project.info.name.replace(/\s+/g, '_');

    // Mode 1: Electron
    if (mode === 'electron') {
      try {
        const result = await (window as any).electron.file.saveDialog(fileName);
        if (!result.success) {
          return { success: false, error: result.error };
        }

        const filePath = result.data;
        const writeResult = await (window as any).electron.file.writeProject(
          filePath,
          JSON.stringify(project, null, 2)
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
    if (mode === 'file-system-access') {
      const pickResult = await fileSystemAccess.pickSaveLocation(fileName);
      if (!pickResult.success) {
        return pickResult;
      }

      const handle = pickResult.data;
      const writeResult = await fileSystemAccess.writeFile(
        handle,
        JSON.stringify(project, null, 2)
      );

      if (writeResult.success) {
        setCurrentFileHandle(handle);
        return { success: true, data: { handle } };
      }
      return writeResult;
    }

    // Mode 3: localStorage + Download
    return downloadProject(project);
  }, [mode, fileSystemAccess]);

  /**
   * Save to existing file (no dialog)
   */
  const saveExistingProject = useCallback(async (project: Project): Promise<PersistenceResult> => {
    // Mode 1: Electron
    if (mode === 'electron') {
      if (!currentFilePath) {
        return { success: false, error: 'No file path set' };
      }

      try {
        const result = await (window as any).electron.file.writeProject(
          currentFilePath,
          JSON.stringify(project, null, 2)
        );
        return result;
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }

    // Mode 2: File System Access API
    if (mode === 'file-system-access') {
      if (!currentFileHandle) {
        return { success: false, error: 'No file handle available' };
      }

      const result = await fileSystemAccess.writeFile(
        currentFileHandle,
        JSON.stringify(project, null, 2)
      );
      return result;
    }

    // Mode 3: localStorage (no download for auto-save)
    return { success: true };
  }, [mode, currentFilePath, currentFileHandle, fileSystemAccess]);

  /**
   * Open project from file picker
   */
  const openProject = useCallback(async (): Promise<PersistenceResult> => {
    // Mode 1: Electron
    if (mode === 'electron') {
      try {
        const result = await (window as any).electron.file.openDialog();
        if (!result.success) {
          return { success: false, error: result.error };
        }

        const filePath = result.data;
        const readResult = await (window as any).electron.file.readProject(filePath);

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
    if (mode === 'file-system-access') {
      const result = await fileSystemAccess.pickFile();
      if (result.success) {
        setCurrentFileHandle(result.data.handle);
        return { success: true, data: { project: result.data.project } };
      }
      return result;
    }

    // Mode 3: localStorage - use file input (handled by dialog)
    return { success: false, error: 'Use file input in dialog' };
  }, [mode, fileSystemAccess]);

  /**
   * Download project (fallback mode)
   */
  const downloadProject = useCallback((project: Project, filename?: string): PersistenceResult => {
    const defaultFilename = `${project.info.name.replace(/\s+/g, '_')}.tara.json`;
    const blob = new Blob(
      [JSON.stringify(project, null, 2)], 
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || defaultFilename;
    a.click();
    URL.revokeObjectURL(url);

    console.log(`Downloaded: ${filename || defaultFilename}`);
    return { success: true };
  }, []);

  /**
   * Clear current file reference (e.g., when closing project)
   */
  const clearCurrentFile = useCallback(() => {
    setCurrentFileHandle(null);
    setCurrentFilePath(null);
  }, []);

  return {
    mode,
    saveNewProject,
    saveExistingProject,
    openProject,
    downloadProject,
    clearCurrentFile,
    hasFileReference: !!(currentFileHandle || currentFilePath)
  };
};