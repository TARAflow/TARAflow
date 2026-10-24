// ISO/SAE 21434 risk value in the risk dialog (conformance plan 3a-2,
// decision 20 E4): impact level × attack feasibility → value 1–5 (Annex H.8)
// in place of the `I × L` score panel.

import { useTranslation } from "react-i18next";
import { Paper, Stack, Typography } from "@mui/material";
import type { FeasibilityBandLevel } from "shared";
import type { IsoImpactLevel } from "../../models/iso-risk-matrix";
import {
  ISO_FEASIBILITY_FALLBACK,
  ISO_IMPACT_FALLBACK,
  isoFeasibilityI18nKey,
  isoImpactI18nKey,
  isoRiskValueColor,
} from "../../models/iso-risk-display";

interface IsoRiskPanelProps {
  impact?: IsoImpactLevel;
  feasibility?: FeasibilityBandLevel;
  value?: number;
  testId?: string;
}

export const IsoRiskPanel = ({ impact, feasibility, value, testId }: IsoRiskPanelProps) => {
  const { t } = useTranslation();
  const box = (title: string, content: string, highlight = false) => (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        textAlign: "center",
        flex: 1,
        bgcolor: highlight && value ? isoRiskValueColor(value) : "background.paper",
        color: highlight && value ? "white" : "text.primary",
        borderColor: highlight && value ? isoRiskValueColor(value) : "divider",
      }}
    >
      <Typography variant="caption" color={highlight && value ? "inherit" : "text.secondary"}>
        {title}
      </Typography>
      <Typography variant="h6" fontWeight="bold">
        {content}
      </Typography>
    </Paper>
  );
  return (
    <Stack spacing={0.5} sx={{ width: "100%" }} data-testid={testId}>
      <Stack direction="row" spacing={3} sx={{ width: "100%" }}>
        {box(
          t("tabs.risks.dialog.impact", { defaultValue: "Impact" }),
          impact ? t(isoImpactI18nKey(impact), { defaultValue: ISO_IMPACT_FALLBACK[impact] }) : "–",
        )}
        {box(
          t("tabs.risks.columns.feasibility", { defaultValue: "Feasibility" }),
          feasibility
            ? t(isoFeasibilityI18nKey(feasibility), { defaultValue: ISO_FEASIBILITY_FALLBACK[feasibility] })
            : "–",
        )}
        {box(t("tabs.risks.columns.riskValue", { defaultValue: "Risk (1–5)" }), value ? String(value) : "–", true)}
      </Stack>
      <Typography variant="caption" color="text.secondary">
        {value
          ? t("tabs.risks.iso.panelNote", {
              defaultValue:
                "ISO/SAE 21434 risk value (RQ-15-16) from the matrix of Annex H.8. Impact comes from the damage scenario (asset × property), feasibility from the attack tree.",
            })
          : t("tabs.risks.iso.panelMissing", {
              defaultValue:
                "No risk value yet: rate the impact of the damage scenario and the attack feasibility (attack tree or ISO factors).",
            })}
      </Typography>
    </Stack>
  );
};
