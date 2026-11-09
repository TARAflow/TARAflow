// features/risks/components/credited-residual-context.tsx
//
// The credited residual (multi-project TARA I7 (4), phase 3d-2a) for every
// reader in the Risk tab that evaluates or shows a residual risk — the
// matrices, the table columns, the ISO scenario roll-up, the dialog sidebar
// and the After tab's banner. Provided by the Risk tab from the app layer's
// set (RiskTabProps.uncreditedResiduals); without a provider every residual
// counts. Readers call creditedOf(risk) instead of reading the stored
// after-values — and hand the stored risk (never a credited copy) to
// editors.

import React, { createContext, useCallback, useContext } from "react";
import { Alert, AlertTitle, Box, Tooltip } from "@mui/material";
import { WarningAmber as WarningAmberIcon } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import {
  acceptanceToReview,
  blockerLines,
  creditedResidual,
  type CreditedResidual,
  type ResidualCause,
  type UncreditedResiduals,
} from "shared";
import type { Risk } from "../models/risk-assessment-types";
import type { FactorRating } from "../models/risk-factor-types";
import type { FeasibilityBandLevel } from "shared";

const UncreditedContext = createContext<UncreditedResiduals | null>(null);

export const UncreditedResidualsProvider: React.FC<{
  value: UncreditedResiduals | null | undefined;
  children: React.ReactNode;
}> = ({ value, children }) => <UncreditedContext.Provider value={value ?? null}>{children}</UncreditedContext.Provider>;

export type RiskCredited = CreditedResidual<FactorRating, FeasibilityBandLevel>;

/** The set as provided (null without a provider). */
export function useUncreditedResiduals(): UncreditedResiduals | null {
  return useContext(UncreditedContext);
}

/** risk → its credited residual (stable while the set is). */
export function useCreditedOf(): (risk: Risk) => RiskCredited {
  const uncredited = useContext(UncreditedContext);
  return useCallback((risk: Risk) => creditedResidual<FactorRating, FeasibilityBandLevel>(risk, uncredited), [uncredited]);
}

const CAUSE_FALLBACK: Record<string, string> = {
  pending: "not implemented yet",
  aou_open: "{{ref}} open",
  aou_not_fulfilled: "{{ref}} not fulfilled",
  aou_invalid_in_component: "{{ref}} invalid in the component",
  overridden_here: "marked not effective here: {{ref}}",
};

/** "M-C-012 (SD2 · Smoke Detector): ASM-03 open" per blocker, in the UI language. */
export function useBlockerLines(): (c: RiskCredited) => string[] {
  const { t } = useTranslation();
  return useCallback(
    (c: RiskCredited) =>
      blockerLines(c.blockers, (cause: ResidualCause) =>
        t(`tabs.risks.residual.cause.${cause.kind}`, {
          ref: cause.ref ?? "",
          defaultValue: CAUSE_FALLBACK[cause.kind] ?? cause.kind,
        }),
      ),
    [t],
  );
}

/** A warning marker next to a residual that is not credited; the tooltip says why. Renders nothing when it counts. */
export const UncreditedMark: React.FC<{ credited: RiskCredited }> = ({ credited }) => {
  const { t } = useTranslation();
  const lines = useBlockerLines();
  if (credited.credited) return null;
  return (
    <Tooltip
      title={
        <Box>
          <Box sx={{ fontWeight: 600 }}>
            {t("tabs.risks.residual.notCreditedTitle", {
              defaultValue: "Residual risk not credited — the values before treatment count",
            })}
          </Box>
          {lines(credited).map((l) => (
            <Box key={l}>{l}</Box>
          ))}
        </Box>
      }
    >
      <WarningAmberIcon data-testid="residual-not-credited" sx={{ fontSize: 16, color: "warning.main", verticalAlign: "middle", ml: 0.5 }} />
    </Tooltip>
  );
};

const STATE_FALLBACK: Record<string, string> = { not_effective: "not effective", unclear: "unclear" };

/**
 * The After tab's banner (review 2026-11-08): "Not credited: M-C-012 of the
 * component in SD2 · Smoke Detector not effective (ASM-03 not fulfilled)".
 * The after-ratings below stay editable — they are kept and count again once
 * the cause is gone. Renders nothing when the residual counts.
 */
export const UncreditedBanner: React.FC<{ risk: Risk }> = ({ risk }) => {
  const { t } = useTranslation();
  const uncredited = useContext(UncreditedContext);
  const creditedOf = useCreditedOf();
  const credited = creditedOf(risk);
  if (credited.credited) return null;
  const cause = (c: ResidualCause) =>
    t(`tabs.risks.residual.cause.${c.kind}`, { ref: c.ref ?? "", defaultValue: CAUSE_FALLBACK[c.kind] ?? c.kind });
  return (
    <Alert severity="warning" data-testid="residual-not-credited-banner">
      <AlertTitle>
        {t("tabs.risks.residual.notCreditedTitle", {
          defaultValue: "Residual risk not credited — the values before treatment count",
        })}
      </AlertTitle>
      {credited.blockers.map((b) => {
        const causes = b.causes.map(cause).join(", ");
        return (
          <Box key={`${b.measure}|${b.context}`}>
            {t("tabs.risks.residual.blocker", {
              measure: b.measure,
              context: b.context,
              state: t(`tabs.risks.residual.state.${b.state}`, { defaultValue: STATE_FALLBACK[b.state] }),
              causes,
              defaultValue: "Not credited: {{measure}} of the component in {{context}} {{state}} ({{causes}})",
            })}
          </Box>
        );
      })}
      <Box sx={{ mt: 0.5, color: "text.secondary" }}>
        {t("tabs.risks.residual.keptHint", {
          defaultValue: "The ratings after treatment below are kept and count again once the cause is resolved.",
        })}
      </Box>
      {acceptanceToReview(risk, uncredited) && (
        <Box sx={{ mt: 0.5, fontWeight: 600 }} data-testid="acceptance-to-review">
          {t("tabs.risks.residual.acceptanceToReview", {
            defaultValue: "Acceptance to review: it was based on a residual risk that does not count at the moment.",
          })}
        </Box>
      )}
    </Alert>
  );
};
