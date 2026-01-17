import { useState, useCallback } from 'react';

/**
 * Hook for File System Access API (Chrome, Edge)
 * Provides direct file read/write without downloads
 */

interface FileSystemAccessResult {
  success: boolean;
  data?: any;
  error?: string;
}

export const useFileSystemAccess = () => {
  const [fileHandle, setFileHandle] = useState<FileSystemFileHandle | null>(null);

  // Check if File System Access API is supported
  const isSupported = typeof window !== 'undefined' && 'showOpenFilePicker' in window;

  /**
   * Pick a file to open
   */
  const pickFile = useCallback(async (): Promise<FileSystemAccessResult> => {
    if (!isSupported) {
      return { success: false, error: 'File System Access API not supported' };
    }

    try {
      const [handle] = await (window as any).showOpenFilePicker({
        types: [{
          description: 'TARA Project Files',
          accept: { 'application/json': ['.tara.json', '.json'] }
        }],
        multiple: false
      });

      setFileHandle(handle);

      const file = await handle.getFile();
      const content = await file.text();
      const project = JSON.parse(content);

      return { success: true, data: { project, handle } };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return { success: false, error: 'User canceled' };
      }
      console.error('File picker error:', error);
      return { success: false, error: error.message };
    }
  }, [isSupported]);

  /**
   * Pick a location to save a new file
   */
  const pickSaveLocation = useCallback(async (suggestedName: string): Promise<FileSystemAccessResult> => {
    if (!isSupported) {
      return { success: false, error: 'File System Access API not supported' };
    }

    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: `${suggestedName}.tara.json`,
        types: [{
          description: 'TARA Project Files',
          accept: { 'application/json': ['.tara.json'] }
        }]
      });

      setFileHandle(handle);
      return { success: true, data: handle };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return { success: false, error: 'User canceled' };
      }
      console.error('Save picker error:', error);
      return { success: false, error: error.message };
    }
  }, [isSupported]);

  /**
   * Write to file (requires handle from pickFile or pickSaveLocation)
   */
  const writeFile = useCallback(async (
    handle: FileSystemFileHandle,
    content: string
  ): Promise<FileSystemAccessResult> => {
    if (!isSupported) {
      return { success: false, error: 'File System Access API not supported' };
    }

    try {
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();

      return { success: true };
    } catch (error: any) {
      console.error('Write file error:', error);
      return { success: false, error: error.message };
    }
  }, [isSupported]);

  /**
   * Write to current file handle
   */
  const saveToCurrentFile = useCallback(async (content: string): Promise<FileSystemAccessResult> => {
    if (!fileHandle) {
      return { success: false, error: 'No file handle available' };
    }

    return writeFile(fileHandle, content);
  }, [fileHandle, writeFile]);

  /**
   * Clear current file handle
   */
  const clearFileHandle = useCallback(() => {
    setFileHandle(null);
  }, []);

  return {
    isSupported,
    fileHandle,
    pickFile,
    pickSaveLocation,
    writeFile,
    saveToCurrentFile,
    clearFileHandle
  };
};