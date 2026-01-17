import { useCallback } from 'react';
import type { Project } from '../models/project-types';

/**
 * Hook for downloading project files as .tara.json
 * Works in both Browser and Electron (though Electron uses native dialogs)
 */
export const useProjectFileDownload = () => {
  const isElectron = typeof window !== "undefined" && 
                     typeof (window as any).electron?.file !== "undefined";

  const downloadProject = useCallback((project: Project, filename?: string) => {
    // Electron mode: Files are saved via native dialog, no download needed
    if (isElectron) {
      return;
    }

    // Browser mode: Trigger download
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
  }, [isElectron]);

  return { downloadProject, isElectron };
};