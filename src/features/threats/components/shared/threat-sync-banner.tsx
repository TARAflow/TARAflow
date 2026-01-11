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
    const { t, i18n } = useTranslation();
    const isGerman = i18n.language === "de";

    if (!syncStatus || syncStatus.inSync) {
      return null;
    }

    // Build message from sync status summary
    const parts: string[] = [];

    if (syncStatus.summary.missingElementCount > 0) {
      parts.push(
        isGerman
          ? `${syncStatus.summary.missingElementCount} Element(e) ohne Bedrohungen`
          : `${syncStatus.summary.missingElementCount} element(s) without threats`
      );
    }

    if (syncStatus.summary.missingDataFlowCount > 0) {
      parts.push(
        isGerman
          ? `${syncStatus.summary.missingDataFlowCount} Datenfluss/-flüsse ohne Bedrohungen`
          : `${syncStatus.summary.missingDataFlowCount} data flow(s) without threats`
      );
    }

    if (syncStatus.summary.orphanedThreatCount > 0) {
      parts.push(
        isGerman
          ? `${syncStatus.summary.orphanedThreatCount} verwaiste Bedrohung(en)`
          : `${syncStatus.summary.orphanedThreatCount} orphaned threat(s)`
      );
    }

    if (syncStatus.summary.changedReferenceCount > 0) {
      parts.push(
        isGerman
          ? `${syncStatus.summary.changedReferenceCount} geänderte Referenz(en)`
          : `${syncStatus.summary.changedReferenceCount} changed reference(s)`
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
              {isGerman ? "Synchronisieren" : "Sync"}
            </Button>
            <Button
              size="small"
              color="inherit"
              onClick={onDismiss}
            >
              {isGerman ? "Ignorieren" : "Dismiss"}
            </Button>
          </Stack>
        }
      >
        <AlertTitle>
          {isGerman
            ? "DFD und Bedrohungen nicht synchron"
            : "DFD and threats out of sync"}
        </AlertTitle>
        {message}
      </Alert>
    );
  }
);

ThreatSyncBanner.displayName = "ThreatSyncBanner";