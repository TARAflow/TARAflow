import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Project } from "../../models/project-types";
import { Button } from "shared";

// ==================== OPEN PROJECT DIALOG ====================

interface OpenProjectDialogProps {
  projects: Project[];
  onOpen: (projectId: string) => void;
  onClose: () => void;
}

export const OpenProjectDialog: React.FC<OpenProjectDialogProps> = ({ 
  projects, 
  onOpen, 
  onClose 
}) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const closedProjects = projects
    .filter(p => !p.isOpen)
    .sort((a, b) => a.name.localeCompare(b.name));

  const filteredProjects = closedProjects.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpen = () => {
    if (selectedProjectId) {
      onOpen(selectedProjectId);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            {t("project.openProject")}
          </h2>
        </div>

        <div className="px-6 py-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t("dialogs.openProject.searchPlaceholder")}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="text-sm text-gray-600 mb-2">
            {t("dialogs.openProject.allProjects")} ({filteredProjects.length})
          </div>
          <div className="space-y-1">
            {filteredProjects.map((project) => (
              <button
                key={project.id}
                onClick={() => setSelectedProjectId(project.id)}
                className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                  selectedProjectId === project.id
                    ? "bg-blue-50 border-blue-300 text-blue-900"
                    : "border-gray-200 hover:bg-gray-50 text-gray-900"
                }`}
              >
                <div className="font-medium">{project.name}</div>
                <div className="text-sm text-gray-600">
                  {project.description}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {t("project.lastModified")}:{" "}
                  {new Date(project.lastModified).toLocaleDateString()}
                </div>
              </button>
            ))}
            {filteredProjects.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                {t("dialogs.openProject.noResults", { term: searchTerm })}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            onClick={handleOpen}
            disabled={!selectedProjectId}
            className="flex-1"
          >
            {t("common.open")}
          </Button>
        </div>
      </div>
    </div>
  );
};
