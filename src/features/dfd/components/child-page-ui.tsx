// ==================== CHILD PAGE UI ====================
// Leveled-DFD Phase 5e (leveled-dfd-multi-diagram-design.md §5.2 "Delete a
// page", §12): the question after a multiprocess with a child page was
// deleted, and the child-page section of a multiprocess in the details
// panel ("Create child page" = Decompose for a multiprocess without one).

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import type { OrphanPage } from "../services/leveled";
import type { LeveledActionError } from "../models/leveled-errors";
import { leveledErrorText } from "./leveled-error-text";

// ==================== ORPHAN PAGE QUESTION ====================

export interface OrphanPageDialogProps {
  /** Pages still to decide; the first one is asked. */
  orphans: OrphanPage[];
  /** Resolves to an error text when draw.io did not delete the page. */
  onResolve: (pageId: string, removePage: boolean) => Promise<LeveledActionError | null> | void;
}

export const OrphanPageDialog: React.FC<OrphanPageDialogProps> = ({ orphans, onResolve }) => {
  const { t } = useTranslation();
  const [error, setError] = React.useState<LeveledActionError | null>(null);
  const [busy, setBusy] = React.useState(false);
  const orphan = orphans[0];
  React.useEffect(() => setError(null), [orphan?.pageId]);
  if (!orphan) return null;
  const resolve = async (removePage: boolean) => {
    setBusy(true);
    const result = await onResolve(orphan.pageId, removePage);
    setBusy(false);
    setError(result ?? null);
  };
  return (
    <Dialog open maxWidth="xs" fullWidth data-testid="orphan-page-dialog">
      <DialogTitle>
        {t("tabs.dfd.childPages.orphan.title", { defaultValue: "Delete the child page too?" })}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2">
          {t("tabs.dfd.childPages.orphan.text", {
            defaultValue:
              'The multiprocess detailed on page "{{page}}" was deleted. Delete the page as well? Its contents are deleted with it (undo in draw.io).',
            page: orphan.name,
          })}
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mt: 2 }} data-testid="orphan-error">
            {t("tabs.dfd.childPages.orphan.error", {
              defaultValue:
                "draw.io did not delete the page ({{error}}). Delete it in draw.io (right-click on the tab) or keep it.",
              error: leveledErrorText(error, t),
            })}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={() => void resolve(false)} data-testid="orphan-keep">
          {t("tabs.dfd.childPages.orphan.keep", { defaultValue: "Keep page" })}
        </Button>
        <Button
          color="error"
          variant="contained"
          disabled={busy}
          onClick={() => void resolve(true)}
          data-testid="orphan-delete"
        >
          {t("tabs.dfd.childPages.orphan.delete", { defaultValue: "Delete page" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ==================== DETAILS PANEL SECTION ====================

export interface ChildPageInfo {
  /** Name of the child page; absent = the multiprocess has none. */
  pageName?: string;
  /** "Open page" in draw.io; absent = not possible here (no draw.io plugin). */
  onOpen?: () => void;
  /** "Create child page"; absent = not possible here (no draw.io plugin). */
  onCreate?: () => void;
  /**
   * "Sync context" (5f): copy what is missing on the child page; resolves
   * to the number of copied cells or an error text. Absent = not possible.
   */
  onSyncContext?: () => Promise<number | LeveledActionError>;
}

export const ChildPageSection: React.FC<{ info: ChildPageInfo }> = ({ info }) => {
  const { t } = useTranslation();
  const [syncResult, setSyncResult] = React.useState<number | LeveledActionError | null>(null);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => setSyncResult(null), [info.pageName]);
  const sync = async () => {
    if (!info.onSyncContext) return;
    setBusy(true);
    setSyncResult(await info.onSyncContext());
    setBusy(false);
  };
  return (
    <Box sx={{ px: 2, pt: 1.5 }} data-testid="child-page-section">
      {info.pageName ? (
        <Alert
          severity="info"
          variant="outlined"
          sx={{ py: 0 }}
          action={
            <Stack direction="row" spacing={0.5}>
              {info.onOpen && (
                <Button size="small" onClick={info.onOpen} data-testid="child-page-open">
                  {t("tabs.dfd.childPages.open", { defaultValue: "Open page" })}
                </Button>
              )}
              {info.onSyncContext && (
                <Button size="small" disabled={busy} onClick={() => void sync()} data-testid="child-page-sync">
                  {t("tabs.dfd.childPages.sync", { defaultValue: "Sync context" })}
                </Button>
              )}
            </Stack>
          }
        >
          {t("tabs.dfd.childPages.detailedOn", {
            defaultValue: 'Detailed on page "{{page}}".',
            page: info.pageName,
          })}
          {syncResult !== null && (
            <Typography variant="caption" display="block" data-testid="child-page-sync-result">
              {typeof syncResult === "string"
                ? t("tabs.dfd.childPages.syncFailed", {
                    defaultValue: "Context not synced ({{error}}).",
                    error: leveledErrorText(syncResult, t),
                  })
                : syncResult === 0
                  ? t("tabs.dfd.childPages.syncNothing", {
                      defaultValue: "The child page already shows the whole context.",
                    })
                  : t("tabs.dfd.childPages.syncDone", {
                      defaultValue: "{{count}} context copies added.",
                      count: syncResult,
                    })}
            </Typography>
          )}
        </Alert>
      ) : (
        <Alert
          severity="info"
          variant="outlined"
          sx={{ py: 0 }}
          action={
            info.onCreate && (
              <Button size="small" onClick={info.onCreate} data-testid="child-page-create">
                {t("tabs.dfd.childPages.create", { defaultValue: "Create child page" })}
              </Button>
            )
          }
        >
          {t("tabs.dfd.childPages.none", {
            defaultValue: "No child page — the multiprocess is analysed as a whole.",
          })}
        </Alert>
      )}
    </Box>
  );
};
