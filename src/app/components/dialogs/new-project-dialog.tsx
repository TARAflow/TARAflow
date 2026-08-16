import React, { useState } from "react";
import { X, AlertCircle, AlertTriangle, Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tooltip } from "@mui/material";
import { ProjectTags, EMPTY_PROJECT_TAGS } from "shared";
import { SafetyAnalysisToggle, ProjectTagsEditor } from "shared";

// ==================== NEW PROJECT DIALOG ====================
// Creates a new project with the same layout as project-info
// Layout:
//   Project Name (1/1)
//   Version (1/2) | Responsible (1/2)
//   Criticality + Slide Switch (1/1)     (isHighImpact — dialog-specific)
//   Safety + Slide Switch (1/1)          -> SafetyAnalysisToggle (shared)
//   Description (1/1)
//   Tags Section (1/1)                   -> ProjectTagsEditor (shared)

interface NewProjectDialogProps {
  onClose: () => void;
  onCreate: (projectData: NewProjectData) => void;
}

export interface NewProjectData {
  name: string;
  description: string;
  version: string;
  responsible: string;
  tags: ProjectTags;
  isHighImpact?: boolean;
  safetyRelevant?: boolean;
  filePath?: string; // Electron mode only
}

export const NewProjectDialog: React.FC<NewProjectDialogProps> = ({
  onClose,
  onCreate,
}) => {
  const { t } = useTranslation();

  const [formData, setFormData] = useState<NewProjectData>({
    name: "",
    description: "",
    version: "1.0",
    responsible: "",
    tags: { ...EMPTY_PROJECT_TAGS },
    isHighImpact: false,
    safetyRelevant: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Validation
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = t("validation.nameRequired");
    } else if (formData.name.length < 3) {
      newErrors.name = t("validation.nameMinLength");
    }

    if (!formData.description.trim()) {
      newErrors.description = t("validation.descriptionRequired");
    }

    if (!formData.responsible.trim()) {
      newErrors.responsible = t("validation.responsibleRequired");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Form submit — the dialog only validates and passes data to the parent.
  // main-layout owns the native save dialog (Electron) or download (Browser).
  // Opening the save dialog here would cause a double-dialog because
  // main-layout calls persistence.saveNewProject() which opens it again.
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onCreate(formData);
    // Do NOT call onClose() here — main-layout closes the dialog after the
    // save dialog completes (or immediately in browser mode).
  };

  // Keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {t("dialogs.newProject.title")}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            aria-label={t("common.close")}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form Content */}
        <form
          onSubmit={handleSubmit}
          className="overflow-y-auto max-h-[calc(90vh-140px)]"
        >
          <div className="px-6 py-4 space-y-4">
            {/* Project Name (1/1) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("project.name")} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.name ? "border-red-500" : "border-gray-300"
                }`}
                placeholder={t("dialogs.newProject.namePlaceholder")}
                autoFocus
              />
              {errors.name && (
                <div className="mt-1 flex items-center gap-1 text-sm text-red-600">
                  <AlertCircle className="w-4 h-4" />
                  {errors.name}
                </div>
              )}
            </div>

            {/* Version (1/2) | Responsible (1/2) */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("project.version")}
                </label>
                <input
                  type="text"
                  value={formData.version}
                  onChange={(e) =>
                    setFormData({ ...formData, version: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="1.0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("project.responsible")}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.responsible}
                  onChange={(e) =>
                    setFormData({ ...formData, responsible: e.target.value })
                  }
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.responsible ? "border-red-500" : "border-gray-300"
                  }`}
                  placeholder={t("dialogs.newProject.responsiblePlaceholder")}
                />
                {errors.responsible && (
                  <div className="mt-1 flex items-center gap-1 text-sm text-red-600">
                    <AlertCircle className="w-4 h-4" />
                    {errors.responsible}
                  </div>
                )}
              </div>
            </div>

            {/* Criticality + Slide Switch (1/1) — dialog-specific (isHighImpact) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("settings.criticality", { defaultValue: "Criticality" })}
              </label>
              <label className="flex items-center justify-between border border-gray-300 rounded-lg px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  {/* Slide Switch */}
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={formData.isHighImpact ?? false}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          isHighImpact: e.target.checked,
                        })
                      }
                      className="sr-only peer"
                    />
                    <div
                      className={`w-11 h-6 rounded-full transition-colors ${
                        formData.isHighImpact ? "bg-red-500" : "bg-gray-200"
                      }`}
                    />
                    <div
                      className={`absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-200 ease-in-out ${
                        formData.isHighImpact ? "translate-x-5" : ""
                      }`}
                    />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-medium transition-colors ${
                          formData.isHighImpact
                            ? "text-red-600"
                            : "text-gray-700"
                        }`}
                      >
                        {formData.isHighImpact
                          ? t("settings.criticalSystem", {
                              defaultValue: "Critical System",
                            })
                          : t("settings.standardSystem", {
                              defaultValue: "Standard System",
                            })}
                      </span>

                      {formData.isHighImpact && (
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                      )}

                      <Tooltip
                        title={
                          <div className="p-1">
                            <p className="mb-2">
                              {t("settings.criticalSystemTooltip", {
                                defaultValue:
                                  "For safety-critical or high-impact systems, Attack Trees are analyzed before STRIDE threats.",
                              })}
                            </p>
                            <p className="text-xs opacity-80 mb-1">
                              <strong>Standard:</strong> DFD → Assets → Threats
                              → Risks → Attack Trees
                            </p>
                            <p className="text-xs opacity-80">
                              <strong>Critical:</strong> DFD → Assets → Attack
                              Trees → Threats → Risks
                            </p>
                          </div>
                        }
                        arrow
                        placement="right"
                      >
                        <Info className="w-4 h-4 text-gray-400 cursor-help" />
                      </Tooltip>
                    </div>

                    <p className="text-xs text-gray-500 mt-0.5">
                      {formData.isHighImpact
                        ? t("settings.criticalSystemDescription", {
                            defaultValue:
                              "Attack Trees are analyzed before STRIDE threats",
                          })
                        : t("settings.standardSystemDescription", {
                            defaultValue:
                              "Standard STRIDE-first threat analysis workflow",
                          })}
                    </p>
                  </div>
                </div>
              </label>
            </div>

            {/* Safety + Slide Switch (1/1) — shared, incl. EN 50742 coupling */}
            <SafetyAnalysisToggle
              tags={formData.tags}
              safetyRelevant={formData.safetyRelevant ?? false}
              editing
              onChange={(v) =>
                setFormData((d) => ({ ...d, safetyRelevant: v }))
              }
            />

            {/* Description (1/1) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("project.description")}{" "}
                <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={4}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${
                  errors.description ? "border-red-500" : "border-gray-300"
                }`}
                placeholder={t("dialogs.newProject.descriptionPlaceholder")}
              />
              {errors.description && (
                <div className="mt-1 flex items-center gap-1 text-sm text-red-600">
                  <AlertCircle className="w-4 h-4" />
                  {errors.description}
                </div>
              )}
            </div>

            {/* Tags Section — shared, incl. conflict warnings */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t("project.tags")}
              </label>
              <ProjectTagsEditor
                tags={formData.tags}
                editing
                onChange={(tags) => setFormData((d) => ({ ...d, tags }))}
              />
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">
                    {t("dialogs.newProject.infoTitle")}
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-blue-700">
                    <li>{t("dialogs.newProject.infoItem1")}</li>
                    <li>{t("dialogs.newProject.infoItem2")}</li>
                    <li>{t("dialogs.newProject.infoItem3")}</li>
                    <li>{t("dialogs.newProject.infoItem4")}</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3 justify-end bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700 font-medium"
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            {t("dialogs.newProject.createButton")}
          </button>
        </div>
      </div>
    </div>
  );
};