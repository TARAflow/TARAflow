// shared/components/dialogs/confirm-asset-delete-dialog.tsx
//
// Confirm dialog for deleting an asset, used by the DFD tab and the Asset tab.
// Deletion is project-wide, so the dialog states what goes with the asset and
// blocks while attack trees are anchored on it (they must be re-anchored or
// deleted deliberately — analyst work never disappears as a side effect).

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";
import type { AssetUsage } from "../../models/asset-usage-types";

export interface ConfirmAssetDeleteDialogProps {
  open: boolean;
  /** Readable label, e.g. "SY-003 · Controller" — never the UUID. */
  assetLabel: string;
  /** Impact of the deletion; null = unknown (dialog still works). */
  usage: AssetUsage | null;
  onConfirm: () => void;
  onCancel: () => void;
}

const P = "dialogs.confirmAssetDelete";

export const ConfirmAssetDeleteDialog: React.FC<
  ConfirmAssetDeleteDialogProps
> = ({ open, assetLabel, usage, onConfirm, onCancel }) => {
  const { t } = useTranslation();
  const blockers = usage?.blockingAttackTrees ?? [];
  const blocked = blockers.length > 0;

  const effects = usage
    ? [
        usage.dfdRelations > 0 &&
          t(`${P}.dfdRelations`, {
            count: usage.dfdRelations,
            defaultValue: "{{count}} relation(s) to DFD elements/data flows",
          }),
        usage.assetToAssetRelations > 0 &&
          t(`${P}.assetToAssetRelations`, {
            count: usage.assetToAssetRelations,
            defaultValue: "{{count}} relation(s) from other assets",
          }),
        usage.hazardRelations > 0 &&
          t(`${P}.hazardRelations`, {
            count: usage.hazardRelations,
            defaultValue: "{{count}} link(s) in the hazard analysis",
          }),
      ].filter((x): x is string => typeof x === "string")
    : [];

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: "1rem" }}>
        {t(`${P}.title`, {
          asset: assetLabel,
          defaultValue: "Delete asset {{asset}}?",
        })}
      </DialogTitle>
      <DialogContent>
        {blocked ? (
          <Alert severity="error" sx={{ mb: 1 }}>
            {t(`${P}.blocked`, {
              count: blockers.length,
              defaultValue:
                "This asset anchors {{count}} attack tree(s). Re-anchor or delete them first:",
            })}
            <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
              {blockers.map((b) => (
                <li key={b.id}>{b.name}</li>
              ))}
            </ul>
          </Alert>
        ) : (
          <>
            <Typography variant="body2" sx={{ mb: effects.length ? 1 : 0 }}>
              {t(`${P}.message`, {
                defaultValue:
                  "The asset is removed from the whole project (DFD, assets, hazards, threats, risks). This cannot be undone.",
              })}
            </Typography>
            {effects.length > 0 && (
              <>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {t(`${P}.alsoRemoved`, {
                    defaultValue: "Also removed:",
                  })}
                </Typography>
                <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                  {effects.map((e) => (
                    <li key={e}>
                      <Typography variant="body2">{e}</Typography>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} size="small">
          {t("common.cancel", { defaultValue: "Cancel" })}
        </Button>
        <Button
          color="error"
          variant="contained"
          size="small"
          disabled={blocked}
          onClick={onConfirm}
        >
          {t("common.delete", { defaultValue: "Delete" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
