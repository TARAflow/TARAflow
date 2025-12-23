import React from "react";
import { AlertCircle, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../button";

// ==================== SAVE DISCARD DIALOG ====================
// Generic dialog for "Save / Discard / Cancel" scenarios
// Used for: unsaved changes, close with changes, etc.

export interface SaveDiscardDialogProps {
  /** Name of the item (for display in message) */
  itemName: string;
  /** Title of the dialog */
  title: string;
  /** Message/description */
  message: string;
  /** Label for save button (default: "Save") */
  saveLabel?: string;
  /** Label for discard button (default: "Discard") */
  discardLabel?: string;
  /** Label for cancel button (default: "Cancel") */
  cancelLabel?: string;
  /** Callback when save is clicked */
  onSave: () => void;
  /** Callback when discard is clicked */
  onDiscard: () => void;
  /** Callback when cancel is clicked */
  onCancel: () => void;
}

export const SaveDiscardDialog: React.FC<SaveDiscardDialogProps> = ({
  itemName,
  title,
  message,
  saveLabel,
  discardLabel,
  cancelLabel,
  onSave,
  onDiscard,
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
            <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          </div>
          <button
            aria-label={t("common.cancel")}
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <p className="text-gray-600">{message}</p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200">
          <Button variant="secondary" onClick={onCancel}>
            {cancelLabel || t("common.cancel")}
          </Button>
          <Button variant="secondary" onClick={onDiscard}>
            {discardLabel || t("common.discard")}
          </Button>
          <Button variant="primary" onClick={onSave}>
            {saveLabel || t("common.save")}
          </Button>
        </div>
      </div>
    </div>
  );
};
