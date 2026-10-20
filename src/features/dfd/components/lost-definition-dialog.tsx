// ==================== LOST DEFINITION DIALOG ====================
// Leveled-DFD Phase 5k (leveled-dfd-multi-diagram-design.md §5.2): a
// linked definition cell was deleted or drawn again and its element is
// gone. Lists what refers to it and offers to re-attach the old identity to
// the new cell (properties, asset relations and threats are kept) or to
// accept the deletion.

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";
import type { LostDefinition } from "../services/leveled";
import type { LeveledActionError } from "../models/leveled-errors";
import { leveledErrorText } from "./leveled-error-text";

export interface LostDefinitionDialogProps {
  /** Waiting decisions; the first one is asked. */
  lost: LostDefinition[];
  /** Threats referring to a tfId (from the threats register). */
  threatCountOf?: (tfId: string) => number;
  /** Resolves to an error text, or null on success. */
  onReattach: (tfId: string, cellId: string) => Promise<LeveledActionError | null>;
  onAccept: (tfId: string) => void;
  /** Close until a new candidate cell appears. */
  onLater: (tfId: string) => void;
}

export const LostDefinitionDialog: React.FC<LostDefinitionDialogProps> = ({
  lost,
  threatCountOf,
  onReattach,
  onAccept,
  onLater,
}) => {
  const { t } = useTranslation();
  const item = lost[0];
  const [cellId, setCellId] = React.useState("");
  const [error, setError] = React.useState<LeveledActionError | null>(null);
  const [busy, setBusy] = React.useState(false);
  const firstCandidate = item?.candidates[0]?.cellId ?? "";
  React.useEffect(() => {
    setCellId(firstCandidate);
    setError(null);
  }, [item?.tfId, firstCandidate]);
  if (!item) return null;

  const threats = threatCountOf?.(item.tfId) ?? 0;
  const relations = (item.record as { assetRelations?: unknown[] }).assetRelations?.length ?? 0;
  const reattach = async () => {
    setBusy(true);
    setError(await onReattach(item.tfId, cellId));
    setBusy(false);
  };

  return (
    <Dialog open maxWidth="sm" fullWidth data-testid="lost-definition-dialog">
      <DialogTitle>
        {t("tabs.dfd.lostDefinition.title", {
          defaultValue: "Element lost its definition",
        })}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 1 }}>
          {t("tabs.dfd.lostDefinition.text", {
            defaultValue:
              '"{{element}}" on page "{{page}}" was deleted or drawn again and is no longer in the model.',
            element: item.label,
            page: item.pageName,
          })}
        </Typography>
        <Typography variant="body2" sx={{ mb: 2 }} data-testid="lost-definition-usage">
          {t("tabs.dfd.lostDefinition.usage", {
            defaultValue:
              "{{threats}} threat(s) and {{relations}} asset relation(s) refer to it. Re-attach keeps them; accepting the deletion leaves the threats as orphans.",
            threats,
            relations,
          })}
        </Typography>
        {item.candidates.length > 0 ? (
          <>
            <Typography variant="caption" color="text.secondary" display="block">
              {t("tabs.dfd.lostDefinition.reattachTo", {
                defaultValue: "Re-attach to the new cell",
              })}
            </Typography>
            <Select
              size="small"
              fullWidth
              value={cellId}
              onChange={(e) => setCellId(String(e.target.value))}
              inputProps={{ "data-testid": "lost-definition-cell" }}
            >
              {item.candidates.map((c) => (
                <MenuItem key={c.cellId} value={c.cellId}>
                  {c.label}
                </MenuItem>
              ))}
            </Select>
          </>
        ) : (
          <Alert severity="info" data-testid="lost-definition-no-candidate">
            {t("tabs.dfd.lostDefinition.noCandidate", {
              defaultValue:
                "There is no new cell of the same type on that page yet. Choose \"Later\" and draw it again — the question comes back with the new cell — or accept the deletion.",
            })}
          </Alert>
        )}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }} data-testid="lost-definition-error">
            {t("tabs.dfd.lostDefinition.error", {
              defaultValue: "Not re-attached ({{error}}).",
              error: leveledErrorText(error, t),
            })}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => onLater(item.tfId)}
          sx={{ mr: "auto" }}
          data-testid="lost-definition-later"
        >
          {t("tabs.dfd.lostDefinition.later", { defaultValue: "Later" })}
        </Button>
        <Button
          color="error"
          disabled={busy}
          onClick={() => onAccept(item.tfId)}
          data-testid="lost-definition-accept"
        >
          {t("tabs.dfd.lostDefinition.accept", { defaultValue: "Accept deletion" })}
        </Button>
        <Button
          variant="contained"
          disabled={busy || cellId === ""}
          onClick={() => void reattach()}
          data-testid="lost-definition-reattach"
        >
          {t("tabs.dfd.lostDefinition.reattach", { defaultValue: "Re-attach" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LostDefinitionDialog;
