import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Edit3, Save, X, Plus, AlertTriangle, Info } from "lucide-react";
import { Tooltip } from "@mui/material";

// ==================== PROJECT INFO ====================
// Displays and allows editing of project metadata
// Layout:
//   Project Name (1/1)
//   Version (1/2) | Responsible (1/2)
//   Workflow + Slide Switch (1/1)
//   Description (1/1)
//   Created (1/2) | Last Modified (1/2) - read-only
//   Tags Section (1/1)

export interface ProjectInfoData {
  name: string;
  description: string;
  version: string;
  responsible: string;
  created: string;
  lastModified: string;
  tags: string[];
  team: string[];
  isHighImpact?: boolean;
}

interface ProjectInfoProps {
  info: ProjectInfoData;
  onUpdate: (info: ProjectInfoData) => void;
}

// ==================== TAG CATEGORIES ====================

type TagCategoryKey = "domain" | "platform";

interface TagCategory {
  key: TagCategoryKey;
  labelKey: string;
  bgColor: string;
  textColor: string;
  tags: string[];
}

const DEFAULT_TAG_CATEGORIES: TagCategory[] = [
  {
    key: "domain",
    labelKey: "projectInfo.tagCategories.domain",
    bgColor: "bg-purple-100",
    textColor: "text-purple-700",
    tags: [
      "Aerospace",
      "Aviation",
      "Energy",
      "Finance",
      "Industrial",
      "Medical",
      "Military",
      "Pharma",
      "Public Sector",
      "Railway",
      "Telecom",
      "Water",
    ],
  },
  {
    key: "platform",
    labelKey: "projectInfo.tagCategories.platform",
    bgColor: "bg-blue-100",
    textColor: "text-blue-700",
    tags: ["Web", "Mobile", "Desktop", "Cloud", "Embedded", "IoT", "AI"],
  },
];

// Get all predefined tags
const getAllPredefinedTags = (): string[] => {
  return DEFAULT_TAG_CATEGORIES.flatMap((cat) => cat.tags);
};

// Check if tag is predefined
const isPredefinedTag = (tag: string): boolean => {
  return getAllPredefinedTags().includes(tag);
};

// Get category for a tag (checks predefined first, then custom assignment)
const getTagCategory = (
  tag: string,
  customTagCategories: Record<string, TagCategoryKey>
): TagCategory | null => {
  // Check predefined tags
  const predefinedCategory = DEFAULT_TAG_CATEGORIES.find((cat) =>
    cat.tags.includes(tag)
  );
  if (predefinedCategory) return predefinedCategory;

  // Check custom tag assignment
  const customCategoryKey = customTagCategories[tag];
  if (customCategoryKey) {
    return (
      DEFAULT_TAG_CATEGORIES.find((cat) => cat.key === customCategoryKey) ||
      null
    );
  }

  return null;
};

// Get styling for a tag
const getTagStyles = (
  tag: string,
  customTagCategories: Record<string, TagCategoryKey>
): { bg: string; text: string } => {
  const category = getTagCategory(tag, customTagCategories);
  if (!category) {
    return { bg: "bg-gray-100", text: "text-gray-700" };
  }
  return { bg: category.bgColor, text: category.textColor };
};

export const ProjectInfo: React.FC<ProjectInfoProps> = ({ info, onUpdate }) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<ProjectInfoData>(info);
  const [tagInput, setTagInput] = useState("");
  const [tagCategory, setTagCategory] = useState<TagCategoryKey>("domain");

  // Track which category each custom tag belongs to
  const [customTagCategories, setCustomTagCategories] = useState<
    Record<string, TagCategoryKey>
  >(() => {
    // Initialize from existing tags that aren't predefined
    const categories: Record<string, TagCategoryKey> = {};
    info.tags.forEach((tag) => {
      if (!isPredefinedTag(tag)) {
        categories[tag] = "domain"; // Default to domain for existing custom tags
      }
    });
    return categories;
  });

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

  const addTag = (tag: string, category?: TagCategoryKey) => {
    const trimmedTag = tag.trim();
    if (trimmedTag && !editData.tags.includes(trimmedTag)) {
      setEditData((prev) => ({
        ...prev,
        tags: [...prev.tags, trimmedTag],
      }));

      // If it's a custom tag, store its category
      if (!isPredefinedTag(trimmedTag) && category) {
        setCustomTagCategories((prev) => ({
          ...prev,
          [trimmedTag]: category,
        }));
      }

      setTagInput("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setEditData((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove),
    }));

    // Remove from custom categories if it was custom
    if (!isPredefinedTag(tagToRemove)) {
      setCustomTagCategories((prev) => {
        const newCategories = { ...prev };
        delete newCategories[tagToRemove];
        return newCategories;
      });
    }
  };

  const handleTagKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag(tagInput, tagCategory);
    }
  };

  // Get tags grouped by category (including custom tags in their assigned category)
  const getTagsByCategory = (
    tags: string[]
  ): { category: TagCategory; tags: string[] }[] => {
    const result: { category: TagCategory; tags: string[] }[] = [];

    DEFAULT_TAG_CATEGORIES.forEach((category) => {
      const categoryTags = tags.filter((tag) => {
        const tagCat = getTagCategory(tag, customTagCategories);
        return tagCat?.key === category.key;
      });
      if (categoryTags.length > 0) {
        result.push({ category, tags: categoryTags });
      }
    });

    return result;
  };

  // Get available predefined tags for a category (not yet selected)
  const getAvailablePredefinedTags = (category: TagCategory): string[] => {
    return category.tags.filter((tag) => !editData.tags.includes(tag));
  };

  // Get custom tags for a category
  const getCustomTagsForCategory = (categoryKey: TagCategoryKey): string[] => {
    return editData.tags.filter(
      (tag) => !isPredefinedTag(tag) && customTagCategories[tag] === categoryKey
    );
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
          <label className="block text-sm font-medium text-gray-700 mb-2">
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
              {editData.tags.length > 0 && (
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
                          <span className="text-xs text-gray-400 self-center mr-1 min-w-[60px]">
                            {t(category.labelKey, {
                              defaultValue: category.key,
                            })}
                            :
                          </span>
                          {tags.map((tag) => {
                            const styles = getTagStyles(
                              tag,
                              customTagCategories
                            );
                            return (
                              <span
                                key={tag}
                                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm ${styles.bg} ${styles.text}`}
                              >
                                {tag}
                                <button
                                  type="button"
                                  onClick={() => removeTag(tag)}
                                  className="hover:opacity-70"
                                  aria-label={t("common.remove")}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
              {/* Available Tags by Category */}
              <div className="space-y-3">
                {DEFAULT_TAG_CATEGORIES.map((category) => {
                  const availablePredefined =
                    getAvailablePredefinedTags(category);
                  if (availablePredefined.length === 0) return null;

                  return (
                    <div key={category.key}>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">
                        {t(category.labelKey, { defaultValue: category.key })}
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {availablePredefined.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => addTag(tag)}
                            className={`px-2.5 py-1 text-xs border rounded-full transition-colors ${category.bgColor} ${category.textColor} border-transparent hover:opacity-80`}
                          >
                            + {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              ;{/* Custom Tag Input */}
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
                    {DEFAULT_TAG_CATEGORIES.map((cat) => (
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
            </div>
          ) : (
            // Display mode
            <div className="py-2">
              {info.tags.length > 0 ? (
                <div className="space-y-2">
                  {getTagsByCategory(info.tags).map(({ category, tags }) => (
                    <div key={category.key} className="flex flex-wrap gap-2">
                      <span className="text-xs text-gray-400 self-center mr-1 min-w-[60px]">
                        {t(category.labelKey, { defaultValue: category.key })}:
                      </span>
                      {tags.map((tag) => {
                        const styles = getTagStyles(tag, customTagCategories);
                        return (
                          <span
                            key={tag}
                            className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${styles.bg} ${styles.text}`}
                          >
                            {tag}
                          </span>
                        );
                      })}
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