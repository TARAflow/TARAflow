import { useTranslation } from "react-i18next";
import { Box, Paper, Stack, Typography } from "@mui/material";
import {
  getRiskColor,
  getRiskLabel,
  getFactorLabel,
} from "../../services/risk-calculation-service";
import { RiskConfiguration } from "../../models/risk-config-types";
import { getLikelihoodLabel } from "../../models/risk-scale-types";

interface RiskScorePanelProps {
  impact: number;
  likelihood: number;
  risk: number;
  configuration: RiskConfiguration;
  highlightRisk?: boolean;
}

export const RiskScorePanel = ({
  impact,
  likelihood,
  risk,
  configuration,
  highlightRisk = true,
}: RiskScorePanelProps) => {
  const { t } = useTranslation();
  const scaleLabel = (axis: "likelihood" | "impact", raw: string) =>
    t(`risks.scales.${axis}.${raw.toLowerCase().replace(/ /g, "_")}`, {
      defaultValue: raw,
    });

  const riskColor = getRiskColor(
    risk,
    configuration.scale,
    configuration.roundingMethod,
  );

  const renderBox = (
    title: string,
    value: number,
    label: string,
    flexValue: number,
    highlight?: boolean,
  ) => (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        textAlign: "center",
        flex: flexValue,
        bgcolor: highlight ? riskColor : "background.paper",
        color: highlight ? "white" : "text.primary",
        borderColor: highlight ? riskColor : "divider",
      }}
    >
      <Typography
        variant="caption"
        color={highlight ? "inherit" : "text.secondary"}
      >
        {title}
      </Typography>

      <Typography variant="h6" fontWeight="bold" sx={{ mt: 0.5 }}>
        {value > 0 ? value.toFixed(1) : "–"}
      </Typography>

      <Typography variant="caption" sx={{ opacity: 0.85 }}>
        {label}
      </Typography>
    </Paper>
  );

  return (
    <Box sx={{ width: "100%" }}>
      <Stack direction="row" spacing={1.5}>
        {renderBox(
          "Likelihood",
          likelihood,
          scaleLabel(
            "likelihood",
            getLikelihoodLabel(likelihood, configuration.scale),
          ),
          3,
        )}

        {renderBox(
          "Impact",
          impact,
          scaleLabel("impact", getFactorLabel(impact, configuration.scale)),
          3,
        )}

        {renderBox(
          "Risk Score",
          risk,
          scaleLabel("impact", getRiskLabel(risk, configuration.scale)),
          4,
          highlightRisk,
        )}
      </Stack>
    </Box>
  );
};
