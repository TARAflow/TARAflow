import React, { useState, useRef } from "react";
import { Search, FolderOpen, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ProjectMetadata } from "../../models/project-types";
import { Button } from "shared";

// ==================== OPEN PROJECT DIALOG ====================

interface OpenProjectDialogProps {
  recentProjects: ProjectMetadata[];
  onOpen: (projectId: string) => void;
  onOpenFile?: (filePath: string) => void; // Electron mode: open from file
  onImportFile?: (project: any) => void; // Browser mode: import from file
  onClose: () => void;
}

export const OpenProjectDialog: React.FC<OpenProjectDialogProps> = ({
  recentProjects,
  onOpen,
  onOpenFile,
  onImportFile,
  onClose,
}) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sortedProjects = [...recentProjects].sort((a, b) =>
    a.info.name.localeCompare(b.info.name),
  );

  const filteredProjects = sortedProjects.filter(
    (p) =>
      p.info.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.info.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.info.tags?.some((tag) =>
        tag.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
  );

  const handleOpen = () => {
    if (selectedProjectId) {
      onOpen(selectedProjectId);
      onClose();
    }
  };

  // Electron: Browse file system
  const handleBrowseFile = async () => {
    const isElectron =
      typeof window !== "undefined" &&
      typeof (window as any).electron?.file !== "undefined";

    if (!isElectron || !onOpenFile) return;

    try {
      const result = await (window as any).electron.file.openDialog();

      if (result.success && result.data) {
        onOpenFile(result.data);
        onClose();
      } else if (result.error && result.error !== "Open canceled") {
        console.error("Open dialog error:", result.error);
      }
    } catch (error) {
      console.error("Failed to open file dialog:", error);
    }
  };

  // Browser: Upload file
  const handleBrowserFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be selected again
    event.target.value = "";

    try {
      // Read file content
      const content = await file.text();
      const project = JSON.parse(content);

      // Basic validation
      if (!project.id || !project.info) {
        throw new Error("Invalid project file format");
      }

      // Call import handler
      if (onImportFile) {
        onImportFile(project);
        onClose();
      }
    } catch (error: any) {
      console.error("Failed to load file:", error);
      alert(`Failed to load project file: ${error.message}`);
    }
  };

  // Browser: Trigger file input
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const isElectron =
    typeof window !== "undefined" &&
    typeof (window as any).electron?.file !== "undefined";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              {t("project.openProject")}
            </h2>

            {/* Electron: Browse File System */}
            {isElectron && onOpenFile && (
              <Button
                variant="secondary"
                onClick={handleBrowseFile}
                className="flex items-center gap-2"
              >
                <FolderOpen className="w-4 h-4" />
                {t("dialogs.openProject.browseFile", {
                  defaultValue: "Browse File...",
                })}
              </Button>
            )}

            {/* Browser: Upload File */}
            {!isElectron && onImportFile && (
              <>
                <input
                  aria-label="Upload project file"
                  ref={fileInputRef}
                  type="file"
                  accept=".tara.json,.json"
                  onChange={handleBrowserFileUpload}
                  className="hidden"
                />
                <Button
                  variant="secondary"
                  onClick={handleUploadClick}
                  className="flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  {t("dialogs.openProject.uploadFile", {
                    defaultValue: "Upload File...",
                  })}
                </Button>
              </>
            )}
          </div>
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
                <div className="flex items-center justify-between mb-1">
                  <div className="font-medium">{project.info.name}</div>
                  <div className="flex items-center gap-2">
                    {/* Status Badge */}
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        project.status === "complete"
                          ? "bg-green-100 text-green-700"
                          : project.status === "in-progress"
                            ? "bg-blue-100 text-blue-700"
                            : project.status === "review"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {project.status}
                    </span>
                    {/* Phase Progress */}
                    {project.completedPhases !== undefined &&
                      project.totalPhases !== undefined && (
                        <span className="text-xs text-gray-500">
                          {project.completedPhases}/{project.totalPhases}
                        </span>
                      )}
                  </div>
                </div>

                <div className="text-sm text-gray-600 mb-1">
                  {project.info.description}
                </div>

                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>v{project.info.version}</span>
                  {project.info.responsible && (
                    <span>👤 {project.info.responsible}</span>
                  )}
                  <span>
                    {t("project.lastModified")}:{" "}
                    {new Date(project.info.lastModified).toLocaleDateString()}
                  </span>
                </div>

                {/* Tags */}
                {project.info.tags && project.info.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {project.info.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                    {project.info.tags.length > 3 && (
                      <span className="text-xs text-gray-400">
                        +{project.info.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </button>
            ))}
            {filteredProjects.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                {searchTerm
                  ? t("dialogs.openProject.noResults", { term: searchTerm })
                  : t("dialogs.openProject.noProjects", {
                      defaultValue: "No recent projects found",
                    })}
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
