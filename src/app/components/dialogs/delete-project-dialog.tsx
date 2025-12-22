import React from "react";
import { AlertTriangle, X } from "lucide-react";
import { useTranslation } from "react-i18next";

// ==================== DELETE DIALOG ====================

interface DeleteDialogProps {
  itemName: string;
  itemType?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteProjectDialog: React.FC<DeleteDialogProps> = ({
  itemName,
  itemType = "project",
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />

      {/* Dialog */}
      <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">
              {t("dialogs.deleteProject.title")}
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <p className="text-gray-600">
            {t("dialogs.deleteProject.message", { name: itemName })}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            {t("dialogs.deleteProject.warning")}
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
          >
            {t("common.delete")}
          </button>
        </div>
      </div>
    </div>
  );
};

