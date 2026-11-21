import React from "react";
import { useTranslation } from "react-i18next";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from "@mui/material";
import { AlertTriangle } from "lucide-react";
import type { RatingLoss } from "../models/overview-types";

// ==================== RATING LOSS DIALOG ====================
// Asked before a tag change is saved that switches off risk factors with
// ratings (e.g. EN 50742 A removed: EL and attacker capability; ETSI TVRA
// added: the standard factors). The ratings are deleted, not kept (user
// 2026-11-21) — a committed project can be taken back from the repository.

interface RatingLossDialogProps {
  loss: RatingLoss;
  onConfirm: () => void;
  onCancel: () => void;
}

export const RatingLossDialog: React.FC<RatingLossDialogProps> = ({ loss, onConfirm, onCancel }) => {
  const { t } = useTranslation();
  return (
    <Dialog open onClose={onCancel} maxWidth="sm" fullWidth data-testid="rating-loss-dialog">
      <DialogTitle className="flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-amber-600" aria-hidden />
        {t("projectInfo.ratingLoss.title", { defaultValue: "Risk ratings will be deleted" })}
      </DialogTitle>
      <DialogContent>
        <p className="text-sm text-gray-700 mb-3">
          {t("projectInfo.ratingLoss.intro", {
            ratings: loss.ratings,
            risks: loss.risks,
            defaultValue:
              "The new tags switch off risk factors. {{ratings}} ratings on {{risks}} risks are deleted, and with them the SRSL where EL or attacker capability goes:",
          })}
        </p>
        <ul className="list-disc ml-6 text-sm text-gray-800 mb-3">
          {loss.factors.map((f) => (
            <li key={f.id}>{t(`risks.factors.${f.id}.name`, { defaultValue: f.name })}</li>
          ))}
        </ul>
        <p className="text-sm text-gray-600">
          {t("projectInfo.ratingLoss.restore", {
            defaultValue:
              "They are not kept: adding the tag again does not bring them back. Commit the project first if you may need them — the previous state can then be restored from the repository.",
          })}
        </p>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{t("common.cancel")}</Button>
        <Button onClick={onConfirm} color="warning" variant="contained">
          {t("projectInfo.ratingLoss.confirm", { defaultValue: "Change tags and delete ratings" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
