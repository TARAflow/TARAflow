import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Edit3, Save, X } from "lucide-react";
import type { ProjectInfoData } from "../models/overview-types";
import { SafetyAnalysisToggle, ProjectTagsEditor } from "shared";

// ==================== PROJECT INFO ====================
// Displays and allows editing of project metadata
// Layout:
//   Project Name (1/1)
//   Version (1/2) | Responsible (1/2)
//   Safety + Slide Switch (1/1)          -> SafetyAnalysisToggle (shared)
//   Description (1/1)
//   Created (1/2) | Last Modified (1/2) - read-only
//   Tags Section (1/1)                   -> ProjectTagsEditor (shared)

interface ProjectInfoProps {
  info: ProjectInfoData;
  onUpdate: (info: ProjectInfoData) => void;
}

export const ProjectInfo: React.FC<ProjectInfoProps> = ({ info, onUpdate }) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<ProjectInfoData>(info);

  const handleEdit = () => {
    setEditData(info);
    setIsEditing(true);
  };

  const handleSave = () => {
    onUpdate(editData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditData(info);
    setIsEditing(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Safety switch + tag editing (incl. EN 50742 hazard coupling and tag
  // conflict warnings) are now provided by the shared components below.

  // ==================== RENDER ====================

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">
          {t("projectInfo.title")}
        </h3>
        {!isEditing ? (
          <button
            onClick={handleEdit}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <Edit3 className="w-4 h-4" />
            {t("common.edit")}
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
              {t("common.cancel")}
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <Save className="w-4 h-4" />
              {t("common.save")}
            </button>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {/* Project Name (1/1) */}
        <div>
          <label
            htmlFor="project-name"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {t("project.name")}
          </label>
          {isEditing ? (
            <input
              id="project-name"
              type="text"
              value={editData.name}
              onChange={(e) =>
                setEditData({ ...editData, name: e.target.value })
              }
              placeholder={t("projectInfo.namePlaceholder", {
                defaultValue: "Enter project name...",
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          ) : (
            <p className="text-gray-900 py-2">{info.name}</p>
          )}
        </div>

        {/* Version (1/2) | Responsible (1/2) */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="project-version"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {t("project.version")}
            </label>
            {isEditing ? (
              <input
                id="project-version"
                type="text"
                value={editData.version}
                onChange={(e) =>
                  setEditData({ ...editData, version: e.target.value })
                }
                placeholder={t("projectInfo.versionPlaceholder", {
                  defaultValue: "1.0",
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            ) : (
              <p className="text-gray-900 py-2">{info.version}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="project-responsible"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {t("project.responsible")}
            </label>
            {isEditing ? (
              <input
                id="project-responsible"
                type="text"
                value={editData.responsible}
                onChange={(e) =>
                  setEditData({ ...editData, responsible: e.target.value })
                }
                placeholder={t("projectInfo.responsiblePlaceholder", {
                  defaultValue: "Person responsible...",
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            ) : (
              <p className="text-gray-900 py-2">{info.responsible || "-"}</p>
            )}
          </div>
        </div>

        {/* Safety + Slide Switch (1/1) */}
        <SafetyAnalysisToggle
          tags={isEditing ? editData.tags : info.tags}
          safetyRelevant={
            (isEditing ? editData.safetyRelevant : info.safetyRelevant) ?? false
          }
          editing={isEditing}
          onChange={(v) => setEditData((d) => ({ ...d, safetyRelevant: v }))}
        />

        {/* Description (1/1) */}
        <div>
          <label
            htmlFor="project-description"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {t("project.description")}
          </label>
          {isEditing ? (
            <textarea
              id="project-description"
              value={editData.description}
              onChange={(e) =>
                setEditData({ ...editData, description: e.target.value })
              }
              rows={4}
              placeholder={t("projectInfo.descriptionPlaceholder", {
                defaultValue: "Describe your project...",
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          ) : (
            <p className="text-gray-900 py-2 whitespace-pre-wrap">
              {info.description || "-"}
            </p>
          )}
        </div>

        {/* Created (1/2) | Last Modified (1/2) - always read-only */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("project.created")}
            </label>
            <p className="text-gray-900 py-2">{formatDate(info.created)}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("project.lastModified")}
            </label>
            <p className="text-gray-900 py-2">
              {formatDate(info.lastModified)}
            </p>
          </div>
        </div>

        {/* Tags Section */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t("project.tags")}
          </label>
          <ProjectTagsEditor
            tags={isEditing ? editData.tags : info.tags}
            editing={isEditing}
            onChange={(tags) => setEditData((d) => ({ ...d, tags }))}
          />
        </div>
      </div>
    </div>
  );
};