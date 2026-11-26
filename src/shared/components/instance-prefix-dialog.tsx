// shared/components/instance-prefix-dialog.tsx
//
// "Change prefix…" of an imported component instance (0.20 manual test E3,
// 2026-11-26) — from the DFD tab (tab "Component" of the multiprocess) and
// from Overview → Components. The app layer checks the prefix (format, free
// in the machine, not one the component uses inside) and inserts the
// instance again; this dialog only asks.

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField } from "@mui/material";

export interface InstancePrefixDialogProps {
  open: boolean;
  /** The prefix now. */
  current: string;
  /** Why a prefix cannot be taken, in the UI language; undefined = fine. */
  check: (prefix: string) => string | undefined;
  onConfirm: (prefix: string) => void;
  onClose: () => void;
}

export const InstancePrefixDialog: React.FC<InstancePrefixDialogProps> = ({ open, current, check, onConfirm, onClose }) => {
  const { t } = useTranslation();
  const [prefix, setPrefix] = useState(current);
  const unchanged = prefix === current;
  const problem = unchanged ? undefined : check(prefix);
  return (
    <Dialog open={open} onClose={onClose} data-testid="instance-prefix-dialog">
      <DialogTitle>{t("components.prefix.title", { ns: "components", defaultValue: "Change the instance prefix" })}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          {t("components.prefix.text", {
            ns: "components",
            current,
            defaultValue:
              "The instance is inserted again with the new prefix: every id of it changes ({{current}}:P-1 → <new>:P-1). The decisions of this TARA on it stay.",
          })}
        </DialogContentText>
        <TextField
          autoFocus
          fullWidth
          size="small"
          label={t("components.import.prefix", { ns: "components", defaultValue: "Prefix" })}
          value={prefix}
          onChange={(e) => setPrefix(e.target.value.trim())}
          error={!!problem}
          helperText={problem ?? " "}
          inputProps={{ "data-testid": "instance-prefix-input" }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel", { defaultValue: "Cancel" })}</Button>
        <Button variant="contained" disabled={unchanged || !!problem} onClick={() => onConfirm(prefix)} data-testid="instance-prefix-confirm">
          {t("components.prefix.confirm", { ns: "components", defaultValue: "Change prefix" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
