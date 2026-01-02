import React, { useState, useRef, useEffect } from "react";
import { Clock, Folder, MoreVertical, Download, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Project } from "../models/project-types";

// ==================== CONTEXT MENU ====================

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onOpen: () => void;
  onExport?: () => void;
  onDelete?: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  onClose,
  onOpen,
  onExport,
  onDelete,
}) => {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const adjustedX = Math.min(x, window.innerWidth - 160);
  const adjustedY = Math.min(y, window.innerHeight - 160);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[140px]"
      style={{ left: adjustedX, top: adjustedY }}
    >
      <button
        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
        onClick={() => {
          onOpen();
          onClose();
        }}
      >
        <Folder className="w-4 h-4" />
        {t('common.open')}
      </button>

      {onExport && (
        <button
          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
          onClick={() => {
            onExport();
            onClose();
          }}
        >
          <Download className="w-4 h-4" />
          {t('common.export')}
        </button>
      )}

      {onDelete && (
        <>
          <div className="border-t border-gray-100 my-1" />
          <button
            className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
            onClick={() => {
              onDelete();
              onClose();
            }}
          >
            <Trash2 className="w-4 h-4" />
            {t('common.delete')}
          </button>
        </>
      )}
    </div>
  );
};

// ==================== RECENT PROJECT ITEM ====================

interface RecentProjectItemProps {
  project: Project;
  onOpen: () => void;
  onExport?: () => void;
  onDelete?: () => void;
}

const RecentProjectItem: React.FC<RecentProjectItemProps> = ({
  project,
  onOpen,
  onExport,
  onDelete,
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return t("time.justNow");
    if (diffMinutes < 60) return t("time.minutesAgo", { count: diffMinutes });
    if (diffHours < 24) return t("time.hoursAgo", { count: diffHours });
    if (diffDays === 1) return t("time.yesterday");
    if (diffDays < 7) return t("time.daysAgo", { count: diffDays });
    return date.toLocaleDateString();
  };

  return (
    <>
      <div
        className="group flex items-center gap-2 px-2 py-2 cursor-pointer rounded-lg hover:bg-gray-100 transition-colors"
        onClick={onOpen}
        onContextMenu={handleContextMenu}
      >
        <Folder className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm truncate font-medium text-gray-700">
            {project.info.name}
          </div>
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDate(project.lastOpened || project.info.lastModified)}
          </div>
        </div>
        <button
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded transition-opacity"
          onClick={handleMoreClick}
          title={t("sidebar.moreOptions")}
        >
          <MoreVertical className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onOpen={onOpen}
          onExport={onExport}
          onDelete={onDelete}
        />
      )}
    </>
  );
};

// ==================== RECENT PROJECTS ====================

interface RecentProjectsProps {
  projects: Project[];
  onProjectOpen: (projectId: string) => void;
  onProjectDelete?: (projectId: string) => void;
  onProjectExport?: (projectId: string) => void;
  maxItems?: number;
}

export const RecentProjects: React.FC<RecentProjectsProps> = ({
  projects,
  onProjectOpen,
  onProjectDelete,
  onProjectExport,
  maxItems = 5,
}) => {
  const { t } = useTranslation();

  const recentProjects = projects
    .filter((p) => !p.isOpen)
    .sort(
      (a, b) =>
        new Date(b.lastOpened || b.info.lastModified).getTime() -
        new Date(a.lastOpened || a.info.lastModified).getTime()
    )
    .slice(0, maxItems);

  if (recentProjects.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
        {t("project.recentProjects")}
      </div>
      <div className="space-y-1">
        {recentProjects.map((project) => (
          <RecentProjectItem
            key={project.id}
            project={project}
            onOpen={() => onProjectOpen(project.id)}
            onExport={
              onProjectExport ? () => onProjectExport(project.id) : undefined
            }
            onDelete={
              onProjectDelete ? () => onProjectDelete(project.id) : undefined
            }
          />
        ))}
      </div>
    </div>
  );
};
