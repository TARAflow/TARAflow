import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// ==================== NEW PROJECT DIALOG ====================
// Erstellt ein neues Projekt mit allen erforderlichen Feldern

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
}

// ==================== TAG CATEGORIES ====================

interface TagCategory {
  key: string;
  labelKey: string;
  tags: string[];
}

const TAG_CATEGORIES: TagCategory[] = [
  {
    key: 'domain',
    labelKey: 'dialogs.newProject.tagCategories.domain',
    tags: [
      'Medical',
      'Railway', 
      'Aerospace',
      'Automotive',
      'Industrial',
      'Military',
      'Finance',
      'Energy',
    ],
  },
  {
    key: 'platform',
    labelKey: 'dialogs.newProject.tagCategories.platform',
    tags: [
      'Web',
      'Mobile',
      'Desktop',
      'Cloud',
      'Embedded',
      'IoT',
    ],
  },
  {
    key: 'priority',
    labelKey: 'dialogs.newProject.tagCategories.priority',
    tags: [
      'critical',
      'high-priority',
      'low-priority',
    ],
  },
];

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
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tagInput, setTagInput] = useState("");

  // Validierung
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

  // Tag hinzufügen
  const addTag = (tag: string) => {
    const trimmedTag = tag.trim();
    if (trimmedTag && !formData.tags.includes(trimmedTag)) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, trimmedTag],
      }));
      setTagInput("");
    }
  };

  // Tag entfernen
  const removeTag = (tagToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove),
    }));
  };

  // Formular absenden
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (validate()) {
      onCreate(formData);
      onClose();
    }
  };

  // Keyboard Shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  // Get all predefined tags that are not yet selected
  const getAvailableTagsForCategory = (category: TagCategory): string[] => {
    return category.tags.filter((tag) => !formData.tags.includes(tag));
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

        {/* Form Content - Scrollbar */}
        <form
          onSubmit={handleSubmit}
          className="overflow-y-auto max-h-[calc(90vh-140px)]"
        >
          <div className="px-6 py-4 space-y-6">
            {/* Projektname */}
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

            {/* Beschreibung */}
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

            {/* Version und Verantwortlicher - Nebeneinander */}
            <div className="grid grid-cols-2 gap-4">
              {/* Version */}
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

              {/* Verantwortlicher */}
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

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t("project.tags")}
              </label>

              {/* Aktuelle Tags */}
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {formData.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="hover:text-blue-900"
                        aria-label={t("common.remove")}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Tag Categories */}
              <div className="space-y-3 mb-3">
                {TAG_CATEGORIES.map((category) => {
                  const availableTags = getAvailableTagsForCategory(category);
                  if (availableTags.length === 0) return null;

                  return (
                    <div key={category.key}>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        {t(category.labelKey, { defaultValue: category.key })}
                      </label>
                      <div className="flex flex-wrap gap-1">
                        {availableTags.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => addTag(tag)}
                            className="px-2 py-1 text-xs border border-gray-300 rounded-full hover:bg-gray-100 transition-colors"
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
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag(tagInput);
                    }
                  }}
                  placeholder={t("dialogs.newProject.customTagPlaceholder")}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => addTag(tagInput)}
                  disabled={!tagInput.trim()}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t("common.add")}
                </button>
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

        {/* Footer - Buttons */}
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