import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Edit3, Save, X, Plus, AlertTriangle, Info } from "lucide-react";
import { Tooltip } from "@mui/material";
import type { ProjectInfoData } from "../models/overview-types";
import {
  addTagToProject,
  removeTagFromProject,
  flattenProjectTags,
  ProjectTags,
} from "shared";
import {
  TAG_CATEGORIES,
  TagCategoryKey,
  TagCategory,
  isPredefinedTag,
  getTagCategory,
  getTagStyles,
  getTagDefinition,
  getAvailablePredefinedTags,
} from "shared";
import { getTagWarnings } from "../services/tag-validator";

// ==================== PROJECT INFO ====================
// Displays and allows editing of project metadata
// Layout:
//   Project Name (1/1)
//   Version (1/2) | Responsible (1/2)
//   Workflow + Slide Switch (1/1)
//   Description (1/1)
//   Created (1/2) | Last Modified (1/2) - read-only
//   Tags Section (1/1)

interface ProjectInfoProps {
  info: ProjectInfoData;
  onUpdate: (info: ProjectInfoData) => void;
}

export const ProjectInfo: React.FC<ProjectInfoProps> = ({ info, onUpdate }) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<ProjectInfoData>(info);
  const [tagInput, setTagInput] = useState("");
  const [tagCategory, setTagCategory] = useState<TagCategoryKey>("domain");

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
    setTagInput("");
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

  // ==================== TAG HANDLERS ====================

  const addTag = (tag: string, categoryOverride?: TagCategoryKey) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    setEditData((prev) => ({
      ...prev,
      tags: addTagToProject(prev.tags, trimmed, categoryOverride),
    }));
    setTagInput("");
  };

  const removeTag = (tagToRemove: string) => {
    setEditData((prev) => ({
      ...prev,
      tags: removeTagFromProject(prev.tags, tagToRemove),
    }));
  };

  const handleTagKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag(tagInput, tagCategory);
    }
  };

  // Get tags grouped by category (including custom tags in their assigned category)
  const getTagsByCategory = (tags: ProjectTags) => {
    return TAG_CATEGORIES.map((cat) => ({
      category: cat,
      tags: tags[cat.key as keyof ProjectTags] as string[],
    })).filter(({ tags }) => tags.length > 0);
  };

  // ==================== TAG RENDERING HELPERS ====================

  /**
   * Render a single tag badge with optional tooltip (for regulations)
   */
  const renderTagBadge = (
    tag: string,
    showRemoveButton: boolean = false,
    onClick?: () => void
  ) => {
    const styles = getTagStyles(tag, {});
    const tagDef = getTagDefinition(tag);
    const hasTooltip = tagDef?.tooltipKey;

    const badge = (
      <span
        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm ${
          styles.bg
        } ${styles.text} ${onClick ? "cursor-pointer" : ""}`}
        onClick={onClick}
      >
        {tag}
        {showRemoveButton && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeTag(tag);
            }}
            className="hover:opacity-70"
            aria-label={t("common.remove")}
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </span>
    );

    // Wrap with tooltip if regulation tag
    if (hasTooltip) {
      return (
        <Tooltip
          key={tag}
          title={t(tagDef.tooltipKey!, { defaultValue: tag })}
          arrow
          placement="top"
        >
          {badge}
        </Tooltip>
      );
    }

    return <React.Fragment key={tag}>{badge}</React.Fragment>;
  };

  /**
   * Render available tag button with optional tooltip
   */
  const renderAvailableTagButton = (tagName: string, category: TagCategory) => {
    const tagDef = getTagDefinition(tagName);
    const hasTooltip = tagDef?.tooltipKey;

    const button = (
      <button
        type="button"
        onClick={() => addTag(tagName)}
        className={`px-2.5 py-1 text-xs border rounded-full transition-colors ${category.bgColor} ${category.textColor} border-transparent hover:opacity-80`}
      >
        + {tagName}
      </button>
    );

    // Wrap with tooltip if regulation tag
    if (hasTooltip) {
      return (
        <Tooltip
          key={tagName}
          title={t(tagDef.tooltipKey!, { defaultValue: tagName })}
          arrow
          placement="top"
        >
          {button}
        </Tooltip>
      );
    }

    return <React.Fragment key={tagName}>{button}</React.Fragment>;
  };

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

        {/* Workflow + Slide Switch (1/1) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("settings.criticality", { defaultValue: "Criticality" })}
          </label>
          {isEditing ? (
            <label className="flex items-center justify-between border border-gray-300 rounded-lg px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                {/* Slide Switch */}
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={editData.isHighImpact ?? false}
                    onChange={(e) =>
                      setEditData({
                        ...editData,
                        isHighImpact: e.target.checked,
                      })
                    }
                    className="sr-only peer"
                  />
                  <div
                    className={`w-11 h-6 rounded-full transition-colors ${
                      editData.isHighImpact ? "bg-red-500" : "bg-gray-200"
                    }`}
                  />
                  <div
                    className={`absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-200 ease-in-out ${
                      editData.isHighImpact ? "translate-x-5" : ""
                    }`}
                  />
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-medium transition-colors ${
                        editData.isHighImpact ? "text-red-600" : "text-gray-700"
                      }`}
                    >
                      {editData.isHighImpact
                        ? t("settings.criticalSystem", {
                            defaultValue: "Critical System",
                          })
                        : t("settings.standardSystem", {
                            defaultValue: "Standard System",
                          })}
                    </span>

                    {editData.isHighImpact && (
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
                            <strong>Standard:</strong> DFD → Assets → Threats →
                            Risks → Attack Trees
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
                    {editData.isHighImpact
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
          ) : (
            <div className="flex items-center gap-2 py-2">
              {info.isHighImpact ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                  <AlertTriangle className="w-4 h-4" />
                  {t("settings.criticalSystem", {
                    defaultValue: "Critical System",
                  })}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
                  {t("projectInfo.standardSystem", {
                    defaultValue: "Standard System",
                  })}
                </span>
              )}
              <Tooltip
                title={
                  info.isHighImpact
                    ? "DFD → Assets → Attack Trees → Threats → Risks"
                    : "DFD → Assets → Threats → Risks → Attack Trees"
                }
                arrow
                placement="right"
              >
                <Info className="w-4 h-4 text-gray-400 cursor-help" />
              </Tooltip>
            </div>
          )}
        </div>

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

          {isEditing ? (
            <div className="space-y-4">
              {/* Selected Tags */}
              {flattenProjectTags(editData.tags).length > 0 && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <label className="block text-xs font-medium text-gray-500 mb-2">
                    {t("projectInfo.selectedTags", {
                      defaultValue: "Selected Tags",
                    })}
                  </label>
                  <div className="space-y-2">
                    {getTagsByCategory(editData.tags).map(
                      ({ category, tags }) => (
                        <div
                          key={category.key}
                          className="flex flex-wrap gap-2"
                        >
                          <span className="text-xs text-gray-400 self-center mr-1 min-w-[70px]">
                            {t(category.labelKey, {
                              defaultValue: category.key,
                            })}
                            :
                          </span>
                          {tags.map((tag) => renderTagBadge(tag, true))}
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}

              {/* Available Tags by Category */}
              <div className="space-y-3">
                {TAG_CATEGORIES.map((category) => {
                  const availableTags = getAvailablePredefinedTags(
                    category,
                    flattenProjectTags(editData.tags),
                  );
                  if (availableTags.length === 0) return null;

                  return (
                    <div key={category.key}>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">
                        {t(category.labelKey, { defaultValue: category.key })}
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {availableTags.map((tagDef) =>
                          renderAvailableTagButton(tagDef.name, category),
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Custom Tag Input */}
              <div>
                <label
                  htmlFor="custom-tag-input"
                  className="block text-xs font-medium text-gray-500 mb-1.5"
                >
                  {t("projectInfo.customTag", { defaultValue: "Custom Tag" })}
                </label>
                <div className="flex gap-2">
                  <input
                    id="custom-tag-input"
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={handleTagKeyPress}
                    placeholder={t("projectInfo.customTagPlaceholder", {
                      defaultValue: "Enter custom tag...",
                    })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />

                  <select
                    value={tagCategory}
                    onChange={(e) =>
                      setTagCategory(e.target.value as TagCategoryKey)
                    }
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    aria-label={t("projectInfo.selectCategory", {
                      defaultValue: "Select category",
                    })}
                  >
                    {TAG_CATEGORIES.map((cat) => (
                      <option key={cat.key} value={cat.key}>
                        {t(cat.labelKey, { defaultValue: cat.key })}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => addTag(tagInput, tagCategory)}
                    disabled={!tagInput.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t("common.add")}
                  </button>
                </div>
              </div>
              {/* Tag Warnings — shown immediately during editing */}
              {(() => {
                const warnings = getTagWarnings(editData.tags);
                console.log("Tag warnings:", warnings, editData.tags);
                if (warnings.length === 0) return null;
                return (
                  <div className="space-y-1">
                    {warnings.map((w) => (
                      <p
                        key={w.regulation}
                        className="text-xs text-amber-600 flex items-center gap-1"
                      >
                        <AlertTriangle className="w-3 h-3" />
                        {w.message}
                      </p>
                    ))}
                  </div>
                );
              })()}
            </div>
          ) : (
            // Display mode
            <div className="py-2">
              {flattenProjectTags(info.tags).length > 0 ? (
                <div className="space-y-2">
                  {getTagsByCategory(info.tags).map(({ category, tags }) => (
                    <div key={category.key} className="flex flex-wrap gap-2">
                      <span className="text-xs text-gray-400 self-center mr-1 min-w-[70px]">
                        {t(category.labelKey, { defaultValue: category.key })}:
                      </span>
                      {tags.map((tag) => renderTagBadge(tag, false))}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-sm italic">
                  {t("projectInfo.noTags", { defaultValue: "No tags" })}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};