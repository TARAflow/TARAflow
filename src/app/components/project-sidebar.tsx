import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Project } from "../models/project-types";
import { SidebarActions } from "./sidebar-actions";
import { ProjectList } from "./project-list";
import { RecentProjects } from "./recent-projects";

// ==================== PROJECT SIDEBAR ====================

interface ProjectSidebarProps {
  projects: Project[];
  activeProjectId: string | null;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onProjectSelect: (projectId: string) => void;
  onProjectClose: (projectId: string) => void;
  onProjectOpen: (projectId: string) => void;
  onProjectDelete?: (projectId: string) => void;
  onProjectExport?: (projectId: string) => void;
  onProjectSave?: (projectId: string) => void;
  onNewProject: () => void;
  onImportProject: () => void;
  onOpenDialog: () => void;
}

export const ProjectSidebar: React.FC<ProjectSidebarProps> = ({
  projects,
  activeProjectId,
  isCollapsed,
  onToggleCollapse,
  onProjectSelect,
  onProjectClose,
  onProjectOpen,
  onProjectDelete,
  onProjectExport,
  onProjectSave,
  onNewProject,
  onImportProject,
  onOpenDialog,
}) => {
  return (
    <>
      {/* Sidebar */}
      <div
        className={`bg-gray-50 border-r border-gray-200 flex flex-col transition-all duration-300 ${
          isCollapsed ? "w-0" : "w-56"
        }`} // w-52 = 208px
      >
        {!isCollapsed && (
          <>
            <SidebarActions
              onNewProject={onNewProject}
              onImportProject={onImportProject}
              onOpenProject={onOpenDialog}
            />

            <ProjectList
              projects={projects}
              activeProjectId={activeProjectId}
              onProjectSelect={onProjectSelect}
              onProjectClose={onProjectClose}
              onProjectDelete={onProjectDelete}
              onProjectExport={onProjectExport}
              onProjectSave={onProjectSave}
            />

            <div className="p-4">
              <RecentProjects
                projects={projects}
                onProjectOpen={onProjectOpen}
                onProjectDelete={onProjectDelete}
                onProjectExport={onProjectExport}
              />
            </div>
          </>
        )}
      </div>

      {/* Collapse Button */}
      <button
        onClick={onToggleCollapse}
        className="
    absolute left-0 top-1/2 -translate-y-1/2 z-10
    bg-white
    border border-gray-200 border-l-0
    rounded-r-md
    px-0.5 py-4
    hover:bg-gray-50
    transition-all
  "
        style={{ marginLeft: isCollapsed ? "0" : "224px" }}
      >
        {isCollapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
      </button>
    </>
  );
};
