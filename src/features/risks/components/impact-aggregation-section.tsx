// ==================== IMPACT AGGREGATION SECTION ====================
//
// Part of the risk configuration dialog (risk-impact-aggregation design §5,
// §6): how the impact factor values of a risk become one impact. Shows the
// three variants with the worked example, the regulation preset's
// recommendation, the impact weight source (asset criteria, §5.3) and — when
// a pending choice changes what the risks are calculated with — every risk
// that changes (before → after, risk level changes first and marked). Saving
// the dialog applies it.

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Box,
  Button,
  FormControl,
  FormControlLabel,
  FormLabel,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import type { ImpactAggregation } from "shared";
import type { ImpactChangeRow } from "../services/impact-aggregation-preview";

const K = "tabs.risks.config.impactAggregation";
const VARIANTS: ImpactAggregation[] = ["harm-floor", "max", "weighted-mean"];

const DEFAULTS: Record<ImpactAggregation, { name: string; desc: string }> = {
  "harm-floor": {
    name: "Harm floor",
    desc: "Highest of safety, physical damage and environment — never diluted — or the weighted mean of the other impact factors, whichever is higher.",
  },
  max: {
    name: "Maximum",
    desc: "The highest rated impact factor; no weights. ISO/SAE 21434 rates the impact categories equally.",
  },
  "weighted-mean": {
    name: "Weighted mean",
    desc: "Weighted mean of all rated impact factors (behaviour of earlier versions). Mild factors dilute a severe one.",
  },
};

/** Preview rows shown before the list is cut off. */
const MAX_ROWS = 50;

export interface ImpactAggregationSectionProps {
  value: ImpactAggregation;
  onChange: (value: ImpactAggregation) => void;
  /** What the risks are calculated with now (absent setting = weighted mean). */
  current: ImpactAggregation;
  /** Recommendation of the active regulation preset, if known. */
  recommended?: ImpactAggregation;
  /** Something pending that changes risk values (aggregation or weight source). */
  pending: boolean;
  /** Risks whose values the pending change alters. */
  changes: ImpactChangeRow[];
  /** Control for the impact weight source, shown under the variants. */
  weightSource?: React.ReactNode;
}

export const ImpactAggregationSection: React.FC<ImpactAggregationSectionProps> = ({
  value,
  onChange,
  current,
  recommended,
  pending,
  changes,
  weightSource,
}) => {
  const { t } = useTranslation();
  const name = (v: ImpactAggregation) => t(`${K}.${v}.name`, { defaultValue: DEFAULTS[v].name });
  const levelChanges = changes.filter((c) => c.levelChanged).length;

  return (
    <FormControl component="fieldset" data-testid="impact-aggregation-section">
      <FormLabel sx={{ mb: 1 }}>{t(`${K}.title`, { defaultValue: "Impact aggregation" })}</FormLabel>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {t(`${K}.intro`, {
          defaultValue:
            "How the impact factors of a risk become one impact. Example S4 F1 O1 P1: weighted mean 1.75 · harm floor 4 · maximum 4. Example S1 F4 O1 P1: 1.75 · 2 · 4.",
        })}
      </Typography>

      {recommended && recommended !== value && (
        <Alert
          severity="info"
          sx={{ mb: 1 }}
          action={
            <Button size="small" onClick={() => onChange(recommended)} data-testid="impact-aggregation-use-recommended">
              {t(`${K}.useRecommended`, { defaultValue: "Use" })}
            </Button>
          }
        >
          {t(`${K}.recommended`, {
            name: name(recommended),
            defaultValue: "The regulation preset recommends: {{name}}",
          })}
        </Alert>
      )}

      <RadioGroup value={value} onChange={(e) => onChange(e.target.value as ImpactAggregation)}>
        {VARIANTS.map((v) => (
          <FormControlLabel
            key={v}
            value={v}
            control={<Radio size="small" />}
            label={
              <Box>
                <Typography variant="body2" fontWeight="medium">
                  {name(v)}
                  {v === current && (
                    <Typography component="span" variant="caption" color="text.secondary">
                      {" "}
                      ({t(`${K}.current`, { defaultValue: "current" })})
                    </Typography>
                  )}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t(`${K}.${v}.description`, { defaultValue: DEFAULTS[v].desc })}
                </Typography>
              </Box>
            }
            sx={{ alignItems: "flex-start", mb: 0.5, "& .MuiRadio-root": { pt: 0.25 } }}
          />
        ))}
      </RadioGroup>

      {weightSource && <Box sx={{ mt: 0.5 }}>{weightSource}</Box>}

      {pending && (
        <Paper variant="outlined" sx={{ p: 1.5, mt: 1 }} data-testid="impact-aggregation-preview">
          <Typography variant="body2" fontWeight="medium" gutterBottom>
            {changes.length === 0
              ? t(`${K}.previewNone`, { defaultValue: "No risk changes." })
              : t(`${K}.previewSummary`, {
                  count: changes.length,
                  levels: levelChanges,
                  defaultValue:
                    "{{count}} risk(s) change, {{levels}} of them their risk level. Saving applies the change.",
                })}
          </Typography>
          {changes.length > 0 && (
            <Box sx={{ maxHeight: 260, overflow: "auto" }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>{t(`${K}.colRisk`, { defaultValue: "Risk" })}</TableCell>
                    <TableCell align="right">{t(`${K}.colImpact`, { defaultValue: "Impact" })}</TableCell>
                    <TableCell align="right">{t(`${K}.colValue`, { defaultValue: "Risk value" })}</TableCell>
                    <TableCell>{t(`${K}.colLevel`, { defaultValue: "Risk level" })}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {changes.slice(0, MAX_ROWS).map((c) => (
                    <TableRow
                      key={c.riskId}
                      data-testid={`impact-change-${c.riskId}`}
                      sx={c.levelChanged ? { bgcolor: "warning.50", "& td": { fontWeight: 600 } } : undefined}
                    >
                      <TableCell>R-{c.threatDisplayId}</TableCell>
                      <TableCell align="right">
                        {c.impactBefore} → {c.impactAfter}
                      </TableCell>
                      <TableCell align="right">
                        {c.riskBefore} → {c.riskAfter}
                      </TableCell>
                      <TableCell>
                        {c.levelChanged ? `${c.levelBefore} → ${c.levelAfter}` : c.levelAfter}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {changes.length > MAX_ROWS && (
                <Stack sx={{ mt: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    {t(`${K}.previewMore`, {
                      count: changes.length - MAX_ROWS,
                      defaultValue: "… and {{count}} more",
                    })}
                  </Typography>
                </Stack>
              )}
            </Box>
          )}
        </Paper>
      )}
    </FormControl>
  );
};
