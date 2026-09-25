// ==================== THREAT DRIFT BANNER ====================
// Shown when the stored threats no longer match what the current generation
// rules (or the current security goals) would produce. Makes the drift visible
// before a regeneration silently drops threats; resolution is always explicit.

import React from "react";
import { useTranslation } from "react-i18next";
import { Alert, AlertTitle, Button, Stack } from "@mui/material";
import type { GenerationDrift } from "../../services/threat-generation-drift";
import type { ThreatRiskAttachment } from "../../models/threat-types";

export interface ThreatDriftBannerProps {
  drift: GenerationDrift;
  riskAttachments?: Record<string, ThreatRiskAttachment>;
  onReview: () => void;
  onRegenerate: () => void;
  onDismiss: () => void;
}

export const ThreatDriftBanner = React.memo<ThreatDriftBannerProps>(
  ({ drift, riskAttachments, onReview, onRegenerate, onDismiss }) => {
    const { t } = useTranslation();
    const obsolete = drift.obsolete.length;
    const withRisk = drift.obsolete.filter(
      (o) => riskAttachments?.[o.threatId],
    ).length;

    const parts: string[] = [];
    if (obsolete > 0) {
      parts.push(
        t("tabs.threats.drift.banner.obsolete", {
          count: obsolete,
          defaultValue: "{{count}} stored threats would no longer be generated",
        }),
      );
      if (withRisk > 0) {
        parts.push(
          t("tabs.threats.drift.banner.withRisk", {
            count: withRisk,
            defaultValue: "{{count}} of them with a risk assessment",
          }),
        );
      }
    }
    if (drift.addedCount > 0) {
      parts.push(
        t("tabs.threats.drift.banner.added", {
          count: drift.addedCount,
          defaultValue: "{{count}} threats would be added",
        }),
      );
    }

    return (
      <Alert
        severity={withRisk > 0 ? "warning" : "info"}
        action={
          <Stack direction="row" spacing={1}>
            {obsolete > 0 ? (
              <Button size="small" color="inherit" onClick={onReview}>
                {t("tabs.threats.drift.banner.review", {
                  defaultValue: "Review",
                })}
              </Button>
            ) : (
              <Button size="small" color="inherit" onClick={onRegenerate}>
                {t("tabs.threats.regenerate", { defaultValue: "Regenerate" })}
              </Button>
            )}
            <Button size="small" color="inherit" onClick={onDismiss}>
              {t("tabs.threats.sync.banner.actions.dismiss")}
            </Button>
          </Stack>
        }
      >
        <AlertTitle>
          {t("tabs.threats.drift.banner.title", {
            defaultValue: "Threats differ from the current generation rules",
          })}
        </AlertTitle>
        {parts.join(" · ")}
      </Alert>
    );
  },
);

ThreatDriftBanner.displayName = "ThreatDriftBanner";
