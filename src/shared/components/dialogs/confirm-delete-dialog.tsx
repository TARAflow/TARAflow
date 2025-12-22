import React from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "./confirm-dialog";

// ==================== CONFIRM DELETE DIALOG ====================
// Specialized delete confirmation dialog
// Wraps ConfirmDialog with delete-specific defaults

export interface ConfirmDeleteDialogProps {
  /** Name of the item to delete */
  itemName: string;
  /** Type of item (for display: "project", "asset", etc.) */
  itemType?: string;
  /** Callback when delete is confirmed */
  onConfirm: () => void;
  /** Callback when cancelled */
  onCancel: () => void;
}

export const ConfirmDeleteDialog: React.FC<ConfirmDeleteDialogProps> = ({
  itemName,
  itemType = "item",
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();

  return (
    <ConfirmDialog
      variant="danger"
      title={t("dialogs.confirmDelete.title", { type: itemType })}
      message={t("dialogs.confirmDelete.message", { name: itemName, type: itemType })}
      confirmLabel={t("common.delete")}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
};
