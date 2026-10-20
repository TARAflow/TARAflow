// ==================== THREAT RECONCILIATION SUMMARY ====================
// Leveled DFD Phase 6e (leveled-dfd-multi-diagram-design.md §10): shown in
// the "Regenerate" dialog before the regeneration is applied — how many
// threats are new, unchanged, changed (kept, flagged for review) and
// obsolete, with the changed and new ones listed.

import React from "react";
import { useTranslation } from "react-i18next";
import { Box, Chip, Stack, Typography } from "@mui/material";
import type { Threat, ThreatReviewReason } from "../../models/threat-types";
import type { ThreatReconciliation } from "../../services/threat-reconciliation";
import { threatElementName } from "../../services/threat-generation-drift";

const LIST_LIMIT = 8;

export function reviewReasonLabel(
  reason: ThreatReviewReason,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const defaults: Record<ThreatReviewReason, string> = {
    endpoint: "flow endpoint",
    boundary: "trust boundary",
    template: "template",
  };
  return t(`tabs.threats.reconciliation.reason.${reason}`, { defaultValue: defaults[reason] });
}

const label = (threat: Threat) => `${threat.displayId ?? threat.id} ${threatElementName(threat)}`.trim();

export const ThreatReconciliationSummary: React.FC<{ reconciliation: ThreatReconciliation }> = ({
  reconciliation,
}) => {
  const { t } = useTranslation();
  const tt = (key: string, options?: Record<string, unknown>) => String(t(key, options));
  const { added, unchanged, changed, obsolete } = reconciliation;

  const row = (testId: string, text: string, count: number, color?: string) => (
    <Stack direction="row" justifyContent="space-between" data-testid={testId}>
      <Typography variant="body2" sx={{ color }}>
        {text}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, color }}>
        {count}
      </Typography>
    </Stack>
  );
  const more = (n: number) =>
    n > LIST_LIMIT && (
      <Typography variant="caption" color="text.secondary">
        {tt("tabs.threats.reconciliation.more", { defaultValue: "… and {{count}} more", count: n - LIST_LIMIT })}
      </Typography>
    );

  return (
    <Box sx={{ mb: 2 }} data-testid="threat-reconciliation">
      <Stack spacing={0.25} sx={{ mb: 1 }}>
        {row(
          "reconciliation-new",
          tt("tabs.threats.reconciliation.new", { defaultValue: "New — unrated" }),
          added.length,
        )}
        {row(
          "reconciliation-unchanged",
          tt("tabs.threats.reconciliation.unchanged", { defaultValue: "Unchanged — rating kept" }),
          unchanged.length,
        )}
        {row(
          "reconciliation-changed",
          tt("tabs.threats.reconciliation.changed", {
            defaultValue: "References changed — rating kept, flagged for review",
          }),
          changed.length,
          changed.length > 0 ? "#b45309" : undefined,
        )}
        {row(
          "reconciliation-obsolete",
          tt("tabs.threats.reconciliation.obsolete", {
            defaultValue: "Obsolete — removed, their risks become orphans",
          }),
          obsolete.length,
          obsolete.length > 0 ? "#b91c1c" : undefined,
        )}
      </Stack>

      {changed.length > 0 && (
        <Box sx={{ mb: 1 }} data-testid="reconciliation-changed-list">
          <Typography variant="caption" color="text.secondary">
            {tt("tabs.threats.reconciliation.changedList", { defaultValue: "Flagged for review:" })}
          </Typography>
          {changed.slice(0, LIST_LIMIT).map(({ threat, reasons }) => (
            <Stack key={threat.id} direction="row" spacing={0.5} alignItems="center">
              <Typography variant="body2" sx={{ flexGrow: 1 }}>
                {label(threat)}
              </Typography>
              {(reasons ?? []).map((r) => (
                <Chip key={r} size="small" variant="outlined" color="warning" label={reviewReasonLabel(r, tt)} />
              ))}
            </Stack>
          ))}
          {more(changed.length)}
        </Box>
      )}

      {added.length > 0 && (
        <Box data-testid="reconciliation-new-list">
          <Typography variant="caption" color="text.secondary">
            {tt("tabs.threats.reconciliation.newList", { defaultValue: "New:" })}
          </Typography>
          {added.slice(0, LIST_LIMIT).map(({ threat }) => (
            <Typography key={threat.id} variant="body2">
              {label(threat)}
            </Typography>
          ))}
          {more(added.length)}
        </Box>
      )}
    </Box>
  );
};

export default ThreatReconciliationSummary;
