import React, { useState } from "react";
import { X, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EMPTY_PROJECT_TAGS } from "shared";
import {
  ProjectInfoFields,
  type ProjectInfoFieldsValue,
  type ProjectInfoRequiredField,
} from "features/overview";

// ==================== NEW PROJECT DIALOG ====================
// Creates a new project. The fields are ProjectInfoFields — the same component
// the Overview tab uses — so the two can't drift apart. This dialog only adds
// the chrome, validation and the "what happens next" box.
//
// Deliberately no Criticality ("Critical System") switch: isHighImpact is no
// longer editable anywhere (removed from ProjectInfo too) and will be replaced
// by the tag-preset system. New projects are created with isHighImpact=false.

interface NewProjectDialogProps {
  onClose: () => void;
  onCreate: (projectData: NewProjectData) => void;
}

export interface NewProjectData extends ProjectInfoFieldsValue {
  filePath?: string; // Electron mode only
}

const REQUIRED: readonly ProjectInfoRequiredField[] = [
  "name",
  "responsible",
  "description",
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
    tags: { ...EMPTY_PROJECT_TAGS },
    safetyRelevant: false,
  });

  const [errors, setErrors] = useState<
    Partial<Record<ProjectInfoRequiredField, string>>
  >({});

  // Validation
  const validate = (): boolean => {
    const newErrors: Partial<Record<ProjectInfoRequiredField, string>> = {};

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
            <ProjectInfoFields
              value={formData}
              editing
              onChange={(patch) => setFormData((d) => ({ ...d, ...patch }))}
              required={REQUIRED}
              errors={errors}
              autoFocusName
            />

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
