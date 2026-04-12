// ==================== THREAT SYNC BANNER ====================
// Simple sync warning banner - ORIGINAL VERSION
// Displays when DFD and threats are out of sync

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  AlertTitle,
  Button,
  Stack,
  CircularProgress,
} from "@mui/material";
import {
  Error as ErrorIcon,
  Sync as SyncIcon,
} from "@mui/icons-material";
import type { ThreatSyncStatus } from "../../models/threat-types";

// ==================== TYPES ====================

export interface ThreatSyncBannerProps {
  syncStatus: ThreatSyncStatus | null;
  onSync: () => void;
  onDismiss: () => void;
  isSyncing: boolean;
}

// ==================== COMPONENT ====================

export const ThreatSyncBanner = React.memo<ThreatSyncBannerProps>(
  ({ syncStatus, onSync, onDismiss, isSyncing }) => {
    const { t } = useTranslation();

    if (!syncStatus || syncStatus.inSync) {
      return null;
    }

    // Build message from sync status summary
    const parts: string[] = [];

    if (syncStatus.summary.missingElementCount > 0) {
      parts.push(
        t("tabs.threats.sync.banner.summary.missingElements", {
          count: syncStatus.summary.missingElementCount,
        }),
      );
    }

    if (syncStatus.summary.missingDataFlowCount > 0) {
      parts.push(
        t("tabs.threats.sync.banner.summary.missingDataFlows", {
          count: syncStatus.summary.missingDataFlowCount,
        }),
      );
    }

    if (syncStatus.summary.orphanedThreatCount > 0) {
      parts.push(
        t("tabs.threats.sync.banner.summary.orphanedThreats", {
          count: syncStatus.summary.orphanedThreatCount,
        }),
      );
    }

    if (syncStatus.summary.changedReferenceCount > 0) {
      parts.push(
        t("tabs.threats.sync.banner.summary.changedReferences", {
          count: syncStatus.summary.changedReferenceCount,
        }),
      );
    }

    const message = parts.join(", ");

    return (
      <Alert
        severity="warning"
        icon={<ErrorIcon />}
        action={
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              color="inherit"
              startIcon={
                isSyncing ? <CircularProgress size={16} /> : <SyncIcon />
              }
              onClick={onSync}
              disabled={isSyncing}
            >
              {t("tabs.threats.sync.banner.actions.sync")}
            </Button>
            <Button size="small" color="inherit" onClick={onDismiss}>
              {t("tabs.threats.sync.banner.actions.dismiss")}
            </Button>
          </Stack>
        }
      >
        <AlertTitle>{t("tabs.threats.sync.banner.title")}</AlertTitle>
        {message}
      </Alert>
    );
  }
);

ThreatSyncBanner.displayName = "ThreatSyncBanner";