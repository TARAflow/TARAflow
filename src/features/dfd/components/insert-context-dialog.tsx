// ==================== INSERT CONTEXT DIALOG ====================
// Leveled-DFD Phase 5h (leveled-dfd-multi-diagram-design.md §5.2 lifecycle
// "Insert as context…", §12): pick an existing element or flow and place
// a context copy of it on the current page. The copy keeps the position it
// has on its own page and is marked as inserted by hand (never removed
// automatically from a pure context page).

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from "@mui/material";
import type { InsertCandidate } from "../services/leveled";

export interface InsertContextDialogProps {
  open: boolean;
  /** Name of the page the copy goes to. */
  pageName: string;
  candidates: InsertCandidate[];
  /** pageId → page name, for "defined on". */
  pageNames: Record<string, string>;
  /** Resolves to an error text, or null on success (then the dialog closes). */
  onInsert: (candidate: InsertCandidate) => Promise<string | null>;
  onClose: () => void;
}

export const InsertContextDialog: React.FC<InsertContextDialogProps> = ({
  open,
  pageName,
  candidates,
  pageNames,
  onInsert,
  onClose,
}) => {
  const { t } = useTranslation();
  const [choice, setChoice] = React.useState<InsertCandidate | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (open) {
      setChoice(null);
      setError(null);
    }
  }, [open]);

  const insert = async () => {
    if (!choice) return;
    setBusy(true);
    const result = await onInsert(choice);
    setBusy(false);
    if (result) setError(result);
    else onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth data-testid="insert-context-dialog">
      <DialogTitle>
        {t("tabs.dfd.insertContext.title", {
          defaultValue: 'Insert as context on "{{page}}"',
          page: pageName,
        })}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2 }}>
          {t("tabs.dfd.insertContext.intro", {
            defaultValue:
              "A context copy shows an element or flow that is defined on another page — one element, one set of threats. It is placed where the element is on its own page; move it afterwards.",
          })}
        </Typography>
        {candidates.length === 0 ? (
          <Alert severity="info">
            {t("tabs.dfd.insertContext.none", {
              defaultValue: "Every element and flow of the DFD is already shown on this page.",
            })}
          </Alert>
        ) : (
          <Autocomplete
            options={candidates}
            value={choice}
            onChange={(_, value) => setChoice(value)}
            groupBy={(c) => c.type}
            getOptionLabel={(c) => c.label}
            isOptionEqualToValue={(a, b) => a.kind === b.kind && a.tfId === b.tfId}
            renderOption={(props, c) => (
              <li {...props} key={`${c.kind}:${c.tfId}`}>
                <Box>
                  <Typography variant="body2">{c.label}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t("tabs.dfd.insertContext.definedOn", {
                      defaultValue: "defined on {{page}}",
                      page: pageNames[c.definitionPageId] ?? c.definitionPageId,
                    })}
                  </Typography>
                </Box>
              </li>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                autoFocus
                label={t("tabs.dfd.insertContext.choose", { defaultValue: "Element or flow" })}
              />
            )}
            data-testid="insert-context-choice"
          />
        )}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }} data-testid="insert-context-error">
            {t("tabs.dfd.insertContext.error", {
              defaultValue: "Not inserted ({{error}}).",
              error,
            })}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          {t("tabs.dfd.identityReview.cancel", { defaultValue: "Cancel" })}
        </Button>
        <Button
          variant="contained"
          disabled={!choice || busy}
          onClick={() => void insert()}
          data-testid="insert-context-apply"
        >
          {t("tabs.dfd.insertContext.insert", { defaultValue: "Insert" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default InsertContextDialog;
