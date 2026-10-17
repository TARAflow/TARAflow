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
  Typography,
} from "@mui/material";
import type { OrphanPage } from "../services/leveled";

// ==================== ORPHAN PAGE QUESTION ====================

export interface OrphanPageDialogProps {
  /** Pages still to decide; the first one is asked. */
  orphans: OrphanPage[];
  onResolve: (pageId: string, removePage: boolean) => void;
}

export const OrphanPageDialog: React.FC<OrphanPageDialogProps> = ({ orphans, onResolve }) => {
  const { t } = useTranslation();
  const orphan = orphans[0];
  if (!orphan) return null;
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
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onResolve(orphan.pageId, false)} data-testid="orphan-keep">
          {t("tabs.dfd.childPages.orphan.keep", { defaultValue: "Keep page" })}
        </Button>
        <Button
          color="error"
          variant="contained"
          onClick={() => onResolve(orphan.pageId, true)}
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
  /** "Create child page"; absent = not possible here (no draw.io plugin). */
  onCreate?: () => void;
}

export const ChildPageSection: React.FC<{ info: ChildPageInfo }> = ({ info }) => {
  const { t } = useTranslation();
  return (
    <Box sx={{ px: 2, pt: 1.5 }} data-testid="child-page-section">
      {info.pageName ? (
        <Alert severity="info" variant="outlined" sx={{ py: 0 }}>
          {t("tabs.dfd.childPages.detailedOn", {
            defaultValue: 'Detailed on page "{{page}}" — double-click the multiprocess to open it.',
            page: info.pageName,
          })}
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
