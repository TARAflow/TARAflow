import React, { useState } from "react";
import { X, AlertCircle, AlertTriangle, Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tooltip } from "@mui/material";

// ==================== NEW PROJECT DIALOG ====================
// Creates a new project with the same layout as project-info
// Layout:
//   Project Name (1/1)
//   Version (1/2) | Responsible (1/2)
//   Workflow + Slide Switch (1/1)
//   Description (1/1)
//   Selected Tags (1/1)
//   Available Tags (1/1)
//   Custom Tag Input (1/1)

interface NewProjectDialogProps {
  onClose: () => void;
  onCreate: (projectData: NewProjectData) => void;
}

export interface NewProjectData {
  name: string;
  description: string;
  version: string;
  responsible: string;
  tags: string[];
  isHighImpact?: boolean;
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

// Get category for a tag
const getTagCategory = (
  tag: string,
  customTagCategories: Record<string, TagCategoryKey>
): TagCategory | null => {
  const predefinedCategory = DEFAULT_TAG_CATEGORIES.find((cat) =>
    cat.tags.includes(tag)
  );
  if (predefinedCategory) return predefinedCategory;

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
    tags: [],
    isHighImpact: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tagInput, setTagInput] = useState("");
  const [tagCategory, setTagCategory] = useState<TagCategoryKey>("domain");
  const [customTagCategories, setCustomTagCategories] = useState<
    Record<string, TagCategoryKey>
  >({});

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

  // Tag handlers
  const addTag = (tag: string, category?: TagCategoryKey) => {
    const trimmedTag = tag.trim();
    if (trimmedTag && !formData.tags.includes(trimmedTag)) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, trimmedTag],
      }));

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
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove),
    }));

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

  // Get tags grouped by category
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

  // Get available predefined tags for a category
  const getAvailablePredefinedTags = (category: TagCategory): string[] => {
    return category.tags.filter((tag) => !formData.tags.includes(tag));
  };

  // Form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onCreate(formData);
      onClose();
    }
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

            {/* Workflow + Slide Switch (1/1) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
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
                        formData.isHighImpact ? "text-red-600" : "text-gray-700"
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

            {/* Tags Section */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t("project.tags")}
              </label>

              {/* Selected Tags */}
              {formData.tags.length > 0 && (
                <div className="p-3 bg-gray-50 rounded-lg mb-3">
                  <label className="block text-xs font-medium text-gray-500 mb-2">
                    {t("projectInfo.selectedTags", {
                      defaultValue: "Selected Tags",
                    })}
                  </label>
                  <div className="space-y-2">
                    {getTagsByCategory(formData.tags).map(
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
              <div className="space-y-3 mb-3">
                {DEFAULT_TAG_CATEGORIES.map((category) => {
                  const availableTags = getAvailablePredefinedTags(category);
                  if (availableTags.length === 0) return null;

                  return (
                    <div key={category.key}>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">
                        {t(category.labelKey, { defaultValue: category.key })}
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {availableTags.map((tag) => (
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

              {/* Custom Tag Input */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  {t("projectInfo.customTag", { defaultValue: "Custom Tag" })}
                </label>
                <div className="flex gap-2">
                  <input
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