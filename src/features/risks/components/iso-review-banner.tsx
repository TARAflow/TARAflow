// ISO/SAE 21434 decisions to review (conformance plan 3a-3, decision 20 E5):
// Retain at a risk value ≥ 4 (warning) and Reduce at a risk value of 1
// (info). A hint, never a change: the treatment stays the analyst's. The
// toggle limits register and won't list to these risks.

import { useTranslation } from "react-i18next";
import { Alert, Box, Chip, FormControlLabel, Switch, Typography } from "@mui/material";
import type { Risk } from "../models/risk-assessment-types";
import type { IsoReviewItem } from "../models/iso-scenarios";
import { isoRiskValueFallback, isoRiskValueI18nKey } from "../models/iso-risk-display";

interface IsoReviewBannerProps {
  items: IsoReviewItem[];
  reviewOnly: boolean;
  onReviewOnlyChange: (value: boolean) => void;
  onOpen: (risk: Risk) => void;
}

export const IsoReviewBanner = ({ items, reviewOnly, onReviewOnlyChange, onOpen }: IsoReviewBannerProps) => {
  const { t } = useTranslation();
  if (items.length === 0 && !reviewOnly) return null;
  const retain = items.filter((i) => i.kind === "retain-high");
  const reduce = items.filter((i) => i.kind === "reduce-minimal");
  const row = (list: IsoReviewItem[], text: string) =>
    list.length > 0 && (
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.5 }}>
        <Typography variant="body2" sx={{ mr: 0.5 }}>
          {text}
        </Typography>
        {list.map((i) => (
          <Chip
            key={i.risk.id}
            size="small"
            label={`${i.risk.threatDisplayId} · ${i.risk.isoRisk?.value} ${t(
              isoRiskValueI18nKey(i.risk.isoRisk?.value ?? 1),
              { defaultValue: isoRiskValueFallback(i.risk.isoRisk?.value ?? 1) },
            )}`}
            onClick={() => onOpen(i.risk)}
            sx={{ height: 20, fontSize: "0.7rem" }}
          />
        ))}
      </Box>
    );
  return (
    <Alert
      severity={retain.length > 0 ? "warning" : "info"}
      sx={{ mx: 1, my: 0.5, "& .MuiAlert-message": { width: "100%" } }}
      data-testid="iso-review-banner"
      action={
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={reviewOnly}
              onChange={(e) => onReviewOnlyChange(e.target.checked)}
            />
          }
          label={t("tabs.risks.iso.reviewOnly", { defaultValue: "Only these" })}
        />
      }
    >
      <Typography variant="subtitle2">
        {t("tabs.risks.iso.reviewTitle", {
          count: items.length,
          defaultValue: `Decisions to review (ISO/SAE 21434): ${items.length}`,
        })}
      </Typography>
      {row(
        retain,
        t("tabs.risks.iso.reviewRetain", {
          defaultValue: "Retained at risk value 4 or 5 — is the claim justified?",
        }),
      )}
      {row(
        reduce,
        t("tabs.risks.iso.reviewReduce", {
          defaultValue: "Reduced at risk value 1 — is the effort needed?",
        }),
      )}
    </Alert>
  );
};
