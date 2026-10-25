// features/hazards/components/hazard-reimport-dialog.tsx
//
// Hazard import HI-10, part 2: before a re-import changes anything, the
// analyst sees what it would do — new / changed / unchanged / removed — and
// chooses: update the hazards of the earlier import, or import the rows as
// additional hazards (preselected for another file name, user decision).

import React, { useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Radio,
  RadioGroup,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import type { HazardItem } from "shared";
import type { ReimportPlan } from "../services/hazard-reimport";

export type ReimportMode = "update" | "additional";

export interface HazardReimportDialogProps {
  open: boolean;
  plan: ReimportPlan;
  fileName: string;
  profileName: string;
  defaultMode: ReimportMode;
  onConfirm: (mode: ReimportMode) => void;
  onCancel: () => void;
}

const SHOWN = 8;

export const HazardReimportDialog: React.FC<HazardReimportDialogProps> = ({
  open,
  plan,
  fileName,
  profileName,
  defaultMode,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<ReimportMode>(defaultMode);
  const tt = (k: string, o: Record<string, unknown>) => t(`tabs.hazards.reimport.${k}`, o);

  const group = (key: string, title: string, items: HazardItem[]) =>
    items.length > 0 && (
      <Box data-testid={`reimport-${key}`} sx={{ mb: 1 }}>
        <Typography variant="subtitle2">
          {title} ({items.length})
        </Typography>
        <Typography variant="body2" color="text.secondary" component="div">
          {items
            .slice(0, SHOWN)
            .map((h) => `${h.externalRef ?? h.id} ${h.label}`)
            .join(" · ")}
          {items.length > SHOWN ? " · …" : ""}
        </Typography>
      </Box>
    );

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="md" fullWidth>
      <DialogTitle>{tt("title", { defaultValue: "Re-import “{{file}}”", file: fileName })}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          {tt("intro", {
            defaultValue: "Hazards were imported earlier with the profile “{{profile}}”. Compared with them, this file has:",
            profile: profileName,
          })}
        </Typography>
        {group("added", tt("added", { defaultValue: "New" }), plan.added)}
        {group("changed", tt("changed", { defaultValue: "Changed — updated and flagged for review" }), plan.changed.map((c) => c.existing))}
        {group("removed", tt("removed", { defaultValue: "No longer in the file — kept and flagged" }), plan.removed)}
        {group("unchanged", tt("unchanged", { defaultValue: "Unchanged" }), plan.unchanged)}
        <RadioGroup value={mode} onChange={(e) => setMode(e.target.value as ReimportMode)} sx={{ mt: 1 }}>
          <FormControlLabel
            value="update"
            control={<Radio size="small" />}
            label={tt("modeUpdate", { defaultValue: "Update the hazards of the earlier import" })}
          />
          <FormControlLabel
            value="additional"
            control={<Radio size="small" />}
            label={tt("modeAdditional", {
              defaultValue: "Import all rows as additional hazards (e.g. another machine with the same template)",
            })}
          />
        </RadioGroup>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{tt("cancel", { defaultValue: "Cancel" })}</Button>
        <Button variant="contained" onClick={() => onConfirm(mode)} data-testid="reimport-confirm">
          {tt("confirm", { defaultValue: "Apply" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
