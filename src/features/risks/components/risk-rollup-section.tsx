// ==================== RISK ROLL-UP SECTION ====================
// Leveled DFD (leveled-dfd-multi-diagram-design.md §10, Phase 6f): below the
// risk matrix, one row per decomposed multiprocess — risks per level of its
// subtree (each threat once), the highest level and the number of threats.
// Collapsed by default; follows the matrix's before / after view.

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { ExpandMore as ExpandMoreIcon } from "@mui/icons-material";
import type { RiskConfiguration } from "../models/risk-config-types";
import { RISK_SCALES } from "../models/risk-scale-types";
import type { RiskRollupMode, RiskRollupRow } from "../utils/risk-rollup";

export interface RiskRollupSectionProps {
  rows: RiskRollupRow[];
  configuration: Pick<RiskConfiguration, "scale">;
  mode: RiskRollupMode;
}

export const RiskRollupSection: React.FC<RiskRollupSectionProps> = ({ rows, configuration, mode }) => {
  const { t } = useTranslation();
  if (rows.length === 0) return null;
  const levels = RISK_SCALES[configuration.scale].levels;
  const order = levels.map((_, i) => i).reverse(); // highest first
  return (
    <Accordion disableGutters variant="outlined" sx={{ mt: 2 }} data-testid="risk-rollup">
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle2">
          {t("tabs.risks.rollup.title", { defaultValue: "Roll-up per multiprocess" })}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
          {mode === "before"
            ? t("tabs.risks.rollup.before", { defaultValue: "(before mitigation)" })
            : t("tabs.risks.rollup.after", { defaultValue: "(after mitigation)" })}
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0 }}>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
          {t("tabs.risks.rollup.hint", {
            defaultValue:
              "Risks of the parts and inner flows of each decomposed multiprocess; each threat counted once with its highest risk.",
          })}
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t("tabs.risks.rollup.multiprocess", { defaultValue: "Multiprocess" })}</TableCell>
              {order.map((i) => (
                <TableCell key={i} align="center">
                  {levels[i].label}
                </TableCell>
              ))}
              <TableCell align="center">{t("tabs.risks.rollup.highest", { defaultValue: "Highest" })}</TableCell>
              <TableCell align="right">{t("tabs.risks.rollup.threats", { defaultValue: "Threats" })}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.tfId} data-testid={`risk-rollup-${row.tfId}`}>
                <TableCell sx={{ pl: 2 + row.depth * 2 }}>{row.label}</TableCell>
                {order.map((i) => (
                  <TableCell key={i} align="center">
                    {row.counts[i] > 0 ? row.counts[i] : "–"}
                  </TableCell>
                ))}
                <TableCell align="center">
                  {row.max !== undefined ? (
                    <Chip
                      size="small"
                      label={levels[row.max].label}
                      sx={{ backgroundColor: levels[row.max].color, color: "white" }}
                    />
                  ) : (
                    t("tabs.risks.rollup.unrated", { defaultValue: "not rated" })
                  )}
                </TableCell>
                <TableCell align="right">{row.threats}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AccordionDetails>
    </Accordion>
  );
};

export default RiskRollupSection;
