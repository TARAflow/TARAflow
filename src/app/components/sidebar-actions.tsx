import React from 'react';
import { Plus, Upload, FolderOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// ==================== SIDEBAR ACTIONS ====================

interface SidebarActionsProps {
  onNewProject: () => void;
  onImportProject: () => void;
  onOpenProject: () => void;
}

export const SidebarActions: React.FC<SidebarActionsProps> = ({
  onNewProject,
  onImportProject,
  onOpenProject
}) => {
  const { t } = useTranslation();

  return (
    <div className="p-4 border-b border-gray-200 space-y-2">
      <button
        onClick={onNewProject}
        className="w-full flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        <Plus className="w-4 h-4" />
        {t('project.newProject')}
      </button>
      <button
        onClick={onImportProject}
        className="w-full flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
      >
        <Upload className="w-4 h-4" />
        {t('common.import')}
      </button>
      <button
        onClick={onOpenProject}
        className="w-full flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
      >
        <FolderOpen className="w-4 h-4" />
        {t('common.open')}
      </button>
    </div>
  );
};
