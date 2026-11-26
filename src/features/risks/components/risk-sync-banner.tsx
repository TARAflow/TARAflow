import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Alert, AlertTitle, Box, Button, CircularProgress } from "@mui/material";
import { Sync as SyncIcon } from "@mui/icons-material";

import type { RiskSyncStatus } from "../services/risk-sync-service";

type Props = {
  /** Results of the last sync or import — information, dismissible. */
  syncWarnings: string[];
  /** Dismisses the results. */
  onDismissNotices?: () => void;
  /** True when risks are out of sync with threats and a sync is offered. */
  needsSync: boolean;
  isSyncing: boolean;
  syncStatus: RiskSyncStatus;
  onSync: () => void;
};

/**
 * Banners of the Risks tab, like those of the Threats and Assets tabs
 * (manual test 2026-11-15): a warning only where something is to do —
 * risks out of sync with the threats (with the sync action right there),
 * risks on uncertain threats (confirm them in the Threats tab). The results
 * of the last sync or import are a dismissible information, not a warning,
 * and do not keep a banner open. Renders nothing when there is nothing to
 * show.
 */
export const RiskSyncBanner: React.FC<Props> = ({
  syncWarnings,
  onDismissNotices,
  needsSync,
  isSyncing,
  syncStatus,
  onSync,
}) => {
  const { t } = useTranslation();

  const uncertainCount = syncStatus.uncertainRisks ?? 0;

  // Human-readable summary of what changed, for the out-of-sync bullet.
  // Mirrors the individual counts the old chips rendered, minus "uncertain"
  // which is surfaced as its own separate notification.
  const syncChangeSummary = useMemo(() => {
    const k = "tabs.risks.syncSummary";
    const parts: string[] = [];
    const add = (count: number | undefined, key: string, defaultValue: string) => {
      if ((count ?? 0) > 0) parts.push(t(`${k}.${key}`, { count, defaultValue }));
    };
    add(syncStatus.newThreats, "newThreats", "{{count}} new");
    add(syncStatus.orphanedRisks, "orphaned", "{{count}} orphaned");
    add(syncStatus.changedDescriptions, "changed", "{{count}} changed");
    add(syncStatus.changedMitigations, "mitigations", "{{count}} mitigations changed");
    add(syncStatus.changedExposureLevels, "exposureLevels", "{{count}} exposure level(s) changed");
    add(syncStatus.changedLinkedAssets, "assetLinks", "{{count}} asset link(s) changed");
    add(syncStatus.changedDisplayIds, "renumbered", "{{count}} threat ID(s) renumbered");
    add(syncStatus.changedRelevance, "relevance", "{{count}} threat relevance(s) changed");
    return parts.join(", ");
  }, [syncStatus, t]);

  if (!needsSync && uncertainCount === 0 && syncWarnings.length === 0) return null;

  return (
    <Box sx={{ flexShrink: 0, mx: 2, mt: 1, display: "flex", flexDirection: "column", gap: 1 }} data-testid="risk-banners">
      {needsSync && (
        <Alert
          severity="warning"
          data-testid="risk-sync-banner"
          action={
            <Button
              color="inherit"
              size="small"
              startIcon={isSyncing ? <CircularProgress size={16} /> : <SyncIcon />}
              onClick={onSync}
              disabled={isSyncing}
            >
              {t("tabs.risks.syncNow", { defaultValue: "Sync Now" })}
            </Button>
          }
        >
          <AlertTitle>{t("tabs.risks.outOfSyncDetails", { defaultValue: "Risks are out of sync with Threats:" })}</AlertTitle>
          {syncChangeSummary}
        </Alert>
      )}
      {uncertainCount > 0 && (
        <Alert severity="warning" data-testid="risk-uncertain-banner">
          {t("tabs.risks.uncertainWarning", {
            count: uncertainCount,
            defaultValue: `${uncertainCount} risk(s) are based on uncertain threats — please confirm their relevance in the Threat Eval tab.`,
          })}
        </Alert>
      )}
      {syncWarnings.length > 0 && (
        <Alert severity="info" onClose={onDismissNotices} data-testid="risk-sync-notices">
          {syncWarnings.map((w, i) => (
            <div key={i}>{w}</div>
          ))}
        </Alert>
      )}
    </Box>
  );
};
