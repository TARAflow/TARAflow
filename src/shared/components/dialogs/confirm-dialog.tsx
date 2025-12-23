import React from "react";
import { AlertTriangle, Info, AlertCircle, CheckCircle, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../button";

// ==================== CONFIRM DIALOG ====================
// Generic confirmation dialog for any yes/no scenario

export type ConfirmDialogVariant = "info" | "warning" | "danger" | "success";

export interface ConfirmDialogProps {
  /** Title of the dialog */
  title: string;
  /** Message/description */
  message: string;
  /** Visual variant */
  variant?: ConfirmDialogVariant;
  /** Label for confirm button (default: "Confirm") */
  confirmLabel?: string;
  /** Label for cancel button (default: "Cancel") */
  cancelLabel?: string;
  /** Callback when confirmed */
  onConfirm: () => void;
  /** Callback when cancelled */
  onCancel: () => void;
}

const VARIANT_CONFIG = {
  info: {
    icon: Info,
    iconColor: "text-blue-600",
    bgColor: "bg-blue-100",
    buttonVariant: "primary" as const,
  },
  warning: {
    icon: AlertCircle,
    iconColor: "text-yellow-600",
    bgColor: "bg-yellow-100",
    buttonVariant: "primary" as const,
  },
  danger: {
    icon: AlertTriangle,
    iconColor: "text-red-600",
    bgColor: "bg-red-100",
    buttonVariant: "danger" as const,
  },
  success: {
    icon: CheckCircle,
    iconColor: "text-green-600",
    bgColor: "bg-green-100",
    buttonVariant: "primary" as const,
  },
};

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title,
  message,
  variant = "info",
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();
  const config = VARIANT_CONFIG[variant];
  const Icon = config.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />

      {/* Dialog */}
      <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-full ${config.bgColor} flex items-center justify-center`}
            >
              <Icon className={`w-5 h-5 ${config.iconColor}`} />
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
          <Button variant={config.buttonVariant} onClick={onConfirm}>
            {confirmLabel || t("common.confirm")}
          </Button>
        </div>
      </div>
    </div>
  );
};
