// ==================== IMPORTED THREATS SECTION ====================
// Multi-project TARA (design v3 §7.1, patch 14): the threats of imported
// components, read-only — text, STRIDE and relevance are the component's
// decisions; risks are rated in the Risk tab. Grouped per instance. The
// app layer derives them (features/threats knows no components).

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type { Threat } from "../../models/threat-types";
import { DescriptionCell, StrideCell, ThreatIdCell, compareThreatsByLabel } from "./threat-table-utils";

export interface ImportedThreatGroup {
  key: string;
  label: string;
  threats: Threat[];
}

const where = (t: Threat) =>
  t.dataFlow
    ? t.dataFlow.dataFlowName || `${t.dataFlow.sourceName} → ${t.dataFlow.targetName}`
    : [t.linkedElement?.displayId, t.linkedElement?.elementName].filter(Boolean).join(" ");

export const ImportedThreatsSection: React.FC<{ groups?: readonly ImportedThreatGroup[] }> = ({ groups }) => {
  const { t } = useTranslation();
  if (!groups || groups.length === 0) return null;
  const total = groups.reduce((n, g) => n + g.threats.length, 0);
  return (
    <Accordion disableGutters sx={{ mb: 1.5, flexShrink: 0 }} data-testid="imported-threats-section">
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle2">
          {t("components.threats.title", {
            ns: "components",
            count: total,
            defaultValue: "Threats from imported components ({{count}}) — read-only",
          })}
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ maxHeight: 320, overflow: "auto", pt: 0 }}>
        {groups.map((g) => (
          <Box key={g.key} sx={{ mb: 2 }} data-testid={`imported-threats-${g.key}`}>
            <Typography variant="body2" fontWeight="medium" sx={{ mb: 0.5 }}>
              {g.label}
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>STRIDE</TableCell>
                  <TableCell>{t("components.threats.where", { ns: "components", defaultValue: "Element / flow" })}</TableCell>
                  <TableCell>{t("components.threats.threat", { ns: "components", defaultValue: "Threat" })}</TableCell>
                  <TableCell>{t("components.threats.relevance", { ns: "components", defaultValue: "Relevance (component)" })}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {[...g.threats].sort(compareThreatsByLabel).map((threat) => (
                  <TableRow key={threat.id}>
                    <TableCell>
                      <ThreatIdCell id={threat.displayId} />
                    </TableCell>
                    <TableCell>
                      <StrideCell cat={threat.strideCategory} />
                    </TableCell>
                    <TableCell sx={{ fontSize: "0.8rem" }}>{where(threat)}</TableCell>
                    <TableCell sx={{ maxWidth: 360 }}>
                      <DescriptionCell
                        value={threat.threatDescription || threat.attackDescription}
                        fallback={t("components.threats.templateText", { ns: "components", defaultValue: "(catalog text)" })}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip size="small" variant="outlined" label={threat.relevance} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        ))}
      </AccordionDetails>
    </Accordion>
  );
};
