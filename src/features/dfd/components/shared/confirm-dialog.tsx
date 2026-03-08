// ==================== CONFIRM DIALOG ====================
// Generic confirmation dialog for destructive or irreversible actions.
//
// Usage:
//   <ConfirmDialog
//     open={open}
//     title="Change Asset Group?"
//     message="All selected relation types will be removed."
//     confirmLabel="Change & clear"
//     confirmColor="warning"
//     onConfirm={handleConfirm}
//     onCancel={handleCancel}
//   />

import React from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  /** Label for the confirm button. Defaults to "Confirm". */
  confirmLabel?: string;
  /** MUI color for the confirm button. Defaults to "primary". */
  confirmColor?: "primary" | "error" | "warning" | "success";
  /** Label for the cancel button. Defaults to i18n "Cancel". */
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel,
  confirmColor = "primary",
  cancelLabel,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Typography variant="body2">{message}</Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel} size="small">
          {cancelLabel ?? t("common.cancel", { defaultValue: "Cancel" })}
        </Button>
        <Button
          variant="contained"
          color={confirmColor}
          size="small"
          onClick={onConfirm}
        >
          {confirmLabel ?? t("common.confirm", { defaultValue: "Confirm" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmDialog;