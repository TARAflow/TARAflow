import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Button,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  Sync as SyncIcon,
  Warning as WarningIcon,
  ExpandMore as ExpandMoreIcon,
} from "@mui/icons-material";

import type { RiskSyncStatus } from "../services/risk-sync-service";

type Props = {
  /** Transient info messages (e.g. import results). */
  syncWarnings: string[];
  /** True when risks are out of sync with threats and a sync is offered. */
  needsSync: boolean;
  isSyncing: boolean;
  syncStatus: RiskSyncStatus;
  onSync: () => void;
};

/**
 * Notifications accordion for the Risks tab. Bundles every notification
 * (sync info messages, uncertain-threat warnings, out-of-sync notice) into a
 * single orange, collapsible container. Collapsed it shows only the count;
 * expanded it lists each notification as a plain bullet. This component owns
 * its own visibility — it renders nothing when there is nothing to show — so
 * the parent tab just drops it into the layout without any wrapping Collapse.
 */
export const RiskSyncBanner: React.FC<Props> = ({
  syncWarnings,
  needsSync,
  isSyncing,
  syncStatus,
  onSync,
}) => {
  const { t } = useTranslation();

  const uncertainCount = syncStatus.uncertainRisks ?? 0;

  // Total notification count shown in the accordion header.
  const bannerCount =
    syncWarnings.length + (uncertainCount > 0 ? 1 : 0) + (needsSync ? 1 : 0);

  // Human-readable summary of what changed, for the out-of-sync bullet.
  // Mirrors the individual counts the old chips rendered, minus "uncertain"
  // which is surfaced as its own separate notification.
  const syncChangeSummary = useMemo(() => {
    const parts: string[] = [];
    if (syncStatus.newThreats > 0) parts.push(`${syncStatus.newThreats} new`);
    if (syncStatus.orphanedRisks > 0)
      parts.push(`${syncStatus.orphanedRisks} orphaned`);
    if (syncStatus.changedDescriptions > 0)
      parts.push(`${syncStatus.changedDescriptions} changed`);
    if (syncStatus.changedMitigations > 0)
      parts.push(`${syncStatus.changedMitigations} mitigations changed`);
    if (syncStatus.changedExposureLevels > 0)
      parts.push(
        `${syncStatus.changedExposureLevels} exposure level${
          syncStatus.changedExposureLevels === 1 ? "" : "s"
        } changed`,
      );
    if (syncStatus.changedLinkedAssets > 0)
      parts.push(
        `${syncStatus.changedLinkedAssets} asset link${
          syncStatus.changedLinkedAssets === 1 ? "" : "s"
        } changed`,
      );
    return parts.join(", ");
  }, [syncStatus]);

  if (bannerCount === 0) return null;

  return (
    <Accordion
      disableGutters
      elevation={0}
      sx={{
        flexShrink: 0,
        mx: 2,
        mt: 1,
        borderRadius: 1,
        color: "warning.dark",
        bgcolor: (theme) => alpha(theme.palette.warning.main, 0.12),
        // Remove the default top divider line MUI draws above accordions.
        "&:before": { display: "none" },
        "& .MuiAccordionSummary-root:hover": {
          bgcolor: (theme) => alpha(theme.palette.warning.main, 0.08),
        },
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon sx={{ color: "warning.dark" }} />}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <WarningIcon fontSize="small" color="warning" />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {t("tabs.risks.bannerSummary", {
              count: bannerCount,
              defaultValue: `${bannerCount} notification${
                bannerCount === 1 ? "" : "s"
              } need your attention`,
            })}
          </Typography>
        </Box>
      </AccordionSummary>

      <AccordionDetails sx={{ pt: 0 }}>
        <Box component="ul" sx={{ m: 0, pl: 3, "& li": { mb: 0.5 } }}>
          {/* Sync info messages (e.g. import results) */}
          {syncWarnings.map((warning, i) => (
            <li key={i}>
              <Typography variant="body2">{warning}</Typography>
            </li>
          ))}

          {/* Uncertain threats */}
          {uncertainCount > 0 && (
            <li>
              <Typography variant="body2">
                {t("tabs.risks.uncertainWarning", {
                  count: uncertainCount,
                  defaultValue: `${uncertainCount} risk(s) are based on uncertain threats — please confirm their relevance in the Threat Eval tab.`,
                })}
              </Typography>
            </li>
          )}

          {/* Out-of-sync with threats */}
          {needsSync && (
            <li>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  flexWrap: "wrap",
                }}
              >
                <Typography variant="body2">
                  {t("tabs.risks.outOfSync", {
                    defaultValue: "Risks are out of sync with Threats",
                  })}
                  {syncChangeSummary ? `: ${syncChangeSummary}` : ""}
                </Typography>
                <Button
                  color="warning"
                  size="small"
                  variant="outlined"
                  startIcon={<SyncIcon />}
                  onClick={onSync}
                  disabled={isSyncing}
                >
                  {t("tabs.risks.syncNow", { defaultValue: "Sync Now" })}
                </Button>
              </Box>
            </li>
          )}
        </Box>
      </AccordionDetails>
    </Accordion>
  );
};
