// src/app/update/update-notifier.tsx
// ==================== UPDATE NOTIFIER ====================
// Mounted once at the app root. Fires the silent startup check, listens for
// the Help-menu manual check (with a visible "checking…" state), and renders
// the outcome: a snackbar (info for an available update, success/warning
// otherwise) plus a details dialog with the release notes (Markdown), an
// "open release page" action, and the include-pre-releases toggle. Release-
// note links open externally, never in the app window. All result gating
// lives in useUpdateCheck; this file is presentation only.

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Alert,
  type AlertColor,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Snackbar,
  Typography,
} from "@mui/material";
import { storageService } from "app/services/storage-service";
import { useUpdateCheck } from "./use-update-check";
import {
  DEFAULT_UPDATE_PREFERENCES,
  loadUpdatePreferences,
  saveUpdatePreferences,
} from "./update-preferences";
import { openExternalHref } from "./external-link";

// Release-note links open in the external browser, never in the app window.
// Only real http(s) URLs are forwarded (see external-link.ts).
function MarkdownLink({
  href,
  children,
}: {
  href?: string;
  children?: ReactNode;
}) {
  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        openExternalHref(href);
      }}
    >
      {children}
    </a>
  );
}

export function UpdateNotifier() {
  const { t, i18n } = useTranslation();
  const { result, check, dismiss } = useUpdateCheck();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [manualPending, setManualPending] = useState(false);
  const [includePrereleases, setIncludePrereleases] = useState(
    DEFAULT_UPDATE_PREFERENCES.includePrereleases,
  );

  // Seed the checkbox from the persisted preference.
  useEffect(() => {
    let active = true;
    void loadUpdatePreferences(storageService).then((prefs) => {
      if (active) setIncludePrereleases(prefs.includePrereleases);
    });
    return () => {
      active = false;
    };
  }, []);

  // Silent startup check, once.
  useEffect(() => {
    void check("startup");
  }, [check]);

  // Manual check with a visible "checking…" state (used by the Help menu and
  // by toggling the prerelease preference).
  const runManual = useCallback(async () => {
    setManualPending(true);
    try {
      await check("manual");
    } finally {
      setManualPending(false);
    }
  }, [check]);

  // Manual check from the Help menu.
  useEffect(() => {
    return window.updates?.onMenuCheck?.(() => void runManual());
  }, [runManual]);

  const handleClose = useCallback(
    (_event: unknown, reason?: string) => {
      if (reason === "clickaway") return;
      dismiss();
    },
    [dismiss],
  );

  const openReleasePage = useCallback(() => {
    if (result?.status === "update-available") {
      openExternalHref(result.releaseUrl);
    }
  }, [result]);

  const handleTogglePrereleases = useCallback(
    async (next: boolean) => {
      setIncludePrereleases(next);
      await saveUpdatePreferences({ includePrereleases: next }, storageService);
      void runManual();
    },
    [runManual],
  );

  const showResult = result !== null && !manualPending;
  const isUpdate = result?.status === "update-available";
  const severity: AlertColor =
    result?.status === "update-available"
      ? "info"
      : result?.status === "up-to-date"
        ? "success"
        : "warning";
  const message =
    result?.status === "update-available"
      ? t("update.available", { version: result.latestVersion })
      : result?.status === "up-to-date"
        ? t("update.upToDate")
        : t("update.checkFailed");
  const published =
    result?.status === "update-available" && result.publishedAt
      ? new Date(result.publishedAt).toLocaleDateString(i18n.language)
      : null;

  return (
    <>
      <Snackbar
        open={manualPending}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert severity="info" icon={<CircularProgress size={16} />}>
          {t("update.checking")}
        </Alert>
      </Snackbar>

      {showResult && (
        <Snackbar
          open
          autoHideDuration={isUpdate ? null : 6000}
          onClose={handleClose}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        >
          <Alert
            severity={severity}
            onClose={handleClose}
            action={
              isUpdate ? (
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => setDetailsOpen(true)}
                >
                  {t("update.details")}
                </Button>
              ) : undefined
            }
          >
            {message}
          </Alert>
        </Snackbar>
      )}

      {result?.status === "update-available" && (
        <Dialog
          open={detailsOpen}
          onClose={() => setDetailsOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            {result.releaseName || t("update.updateDialogTitle")}
          </DialogTitle>
          <DialogContent dividers>
            {published && (
              <Typography variant="caption" color="text.secondary">
                {t("update.publishedOn", { date: published })}
              </Typography>
            )}
            <Box sx={{ mt: 1 }}>
              <Markdown
                remarkPlugins={[remarkGfm]}
                components={{ a: MarkdownLink }}
              >
                {result.releaseNotes}
              </Markdown>
            </Box>
            <FormControlLabel
              sx={{ mt: 2 }}
              control={
                <Checkbox
                  checked={includePrereleases}
                  onChange={(e) =>
                    void handleTogglePrereleases(e.target.checked)
                  }
                />
              }
              label={t("update.includePrereleases")}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDetailsOpen(false)}>
              {t("common.close")}
            </Button>
            <Button variant="contained" onClick={openReleasePage}>
              {t("update.openReleasePage")}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
}
