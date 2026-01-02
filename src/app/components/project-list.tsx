import React, { useState, useRef, useEffect } from "react";
import { X, MoreVertical, Download, Trash2, Save } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Project } from "../models/project-types";

// ==================== CONTEXT MENU ====================

interface ContextMenuProps {
  x: number;
  y: number;
  project: Project;
  onClose: () => void;
  onExport?: () => void;
  onDelete?: () => void;
  onSave?: () => void;
  onCloseProject: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  project,
  onClose,
  onExport,
  onDelete,
  onSave,
  onCloseProject,
}) => {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Adjust position to stay within viewport
  const adjustedX = Math.min(x, window.innerWidth - 180);
  const adjustedY = Math.min(y, window.innerHeight - 220);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[160px]"
      style={{ left: adjustedX, top: adjustedY }}
    >
      {/* Save Option - only show if unsaved changes */}
      {project.hasUnsavedChanges && onSave && (
        <button
          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
          onClick={() => {
            onSave();
            onClose();
          }}
        >
          <Save className="w-4 h-4" />
          {t('project.saveProject')}
        </button>
      )}

      {/* Export Option */}
      {onExport && (
        <button
          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
          onClick={() => {
            onExport();
            onClose();
          }}
        >
          <Download className="w-4 h-4" />
          {t('project.exportProject')}
        </button>
      )}

      {/* Close Project */}
      <button
        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
        onClick={() => {
          onCloseProject();
          onClose();
        }}
      >
        <X className="w-4 h-4" />
        {t('project.closeProject')}
      </button>

      {/* Divider */}
      <div className="border-t border-gray-100 my-1" />

      {/* Delete Option */}
      {onDelete && (
        <button
          className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
          onClick={() => {
            onDelete();
            onClose();
          }}
        >
          <Trash2 className="w-4 h-4" />
          {t('project.deleteProject')}
        </button>
      )}
    </div>
  );
};

// ==================== PROJECT LIST ITEM ====================

interface ProjectListItemProps {
  project: Project;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
  onDelete?: () => void;
  onExport?: () => void;
  onSave?: () => void;
}

const ProjectListItem: React.FC<ProjectListItemProps> = ({
  project,
  isActive,
  onSelect,
  onClose,
  onDelete,
  onExport,
  onSave,
}) => {
  const { t } = useTranslation();
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleMoreClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setContextMenu({ x: rect.right, y: rect.top });
  };

  const getStatusColor = () => {
    if (project.hasUnsavedChanges) return "bg-yellow-400";
    switch (project.status) {
      case "complete":
        return "bg-green-400";
      case "in-progress":
        return "bg-blue-400";
      case "review":
        return "bg-purple-400";
      default:
        return "bg-gray-400";
    }
  };

  return (
    <>
      <div
        className={`group flex items-center gap-2 px-3 py-2 cursor-pointer rounded-lg mx-2 mb-1 transition-colors ${
          isActive ? "bg-blue-100 text-blue-900" : "hover:bg-gray-100"
        }`}
        onClick={onSelect}
        onContextMenu={handleContextMenu}
      >
        {/* Status Indicator */}
        <div
          className={`w-2 h-2 rounded-full flex-shrink-0 ${getStatusColor()}`}
        />

        {/* Project Name */}
        <span className="flex-1 truncate text-sm font-medium">
          {project.info.name}
        </span>

        {/* Unsaved Indicator */}
        {project.hasUnsavedChanges && (
          <span
            className="text-yellow-500 text-xs"
            title={t("sidebar.unsavedChanges")}
          >
            ●
          </span>
        )}

        {/* More Button */}
        <button
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded transition-opacity"
          onClick={handleMoreClick}
          title={t("sidebar.moreOptions")}
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {/* Close Button */}
        <button
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          title={t("project.closeProject")}
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          project={project}
          onClose={() => setContextMenu(null)}
          onExport={onExport}
          onDelete={onDelete}
          onSave={onSave}
          onCloseProject={onClose}
        />
      )}
    </>
  );
};

// ==================== PROJECT LIST ====================

interface ProjectListProps {
  projects: Project[];
  activeProjectId: string | null;
  onProjectSelect: (projectId: string) => void;
  onProjectClose: (projectId: string) => void;
  onProjectDelete?: (projectId: string) => void;
  onProjectExport?: (projectId: string) => void;
  onProjectSave?: (projectId: string) => void;
}

export const ProjectList: React.FC<ProjectListProps> = ({
  projects,
  activeProjectId,
  onProjectSelect,
  onProjectClose,
  onProjectDelete,
  onProjectExport,
  onProjectSave,
}) => {
  const { t } = useTranslation();
  const openProjects = projects.filter((p) => p.isOpen);

  if (openProjects.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 text-sm">
        {t('project.noOpenProjects')}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto py-2">
      <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
        {t('project.openProjects')} ({openProjects.length})
      </div>
      {openProjects.map((project) => (
        <ProjectListItem
          key={project.id}
          project={project}
          isActive={project.id === activeProjectId}
          onSelect={() => onProjectSelect(project.id)}
          onClose={() => onProjectClose(project.id)}
          onDelete={
            onProjectDelete ? () => onProjectDelete(project.id) : undefined
          }
          onExport={
            onProjectExport ? () => onProjectExport(project.id) : undefined
          }
          onSave={onProjectSave ? () => onProjectSave(project.id) : undefined}
        />
      ))}
    </div>
  );
};
