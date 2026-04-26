// ==================== WONT RISK TABLE ====================
// Displays risks with MoSCoW priority "Won't".
// Uses RiskTable + useRiskColumns for consistency with main risk tables.
// Columns: STRIDE, Threat-ID, Threat, Risk-Score, Priority (chip),
//          Status (chip), Justification, Actions

import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Box, Chip, Typography, Paper } from "@mui/material";
import { DoNotDisturb as WontIcon } from "@mui/icons-material";
import type {
  Risk,
  RiskConfiguration,
  ThreatReference,
} from "../models/risk-types";
import { RiskTable } from "./shared/risk-table";
import { useRiskColumns } from "./shared/risk-columns";

// ==================== PROPS ====================

interface WontRiskTableProps {
  risks: Risk[];
  threats: ThreatReference[];
  configuration: RiskConfiguration;
  onEdit: (risk: Risk) => void;
}

// ==================== COMPONENT ====================

export const WontRiskTable = React.memo<WontRiskTableProps>(
  ({ risks, configuration, onEdit }) => {
    const { t } = useTranslation();

    // No-op callbacks — read-only table, no inline editing
    const noop = useCallback(() => {}, []);

    const handleEdit = useCallback((risk: Risk) => onEdit(risk), [onEdit]);

    const columns = useRiskColumns({
      configuration,
      onEdit: handleEdit,
      groupRisks: risks,
      onPriorityChange: noop,
      onTreatmentChange: noop,
      readOnly: true,
      showJustification: true,
    });

    if (risks.length === 0) return null;

    const missingJustification = risks.some(
      (r) => !r.wontJustification?.trim(),
    );

    return (
      <Paper
        variant="outlined"
        sx={{
          overflow: "hidden",
          borderColor: "grey.400",
          borderStyle: "dashed",
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: 2,
            py: 1,
            bgcolor: "grey.100",
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          <WontIcon color="action" />
          <Typography variant="subtitle1" fontWeight="medium">
            {t("tabs.risks.wontTableTitle", {
              defaultValue: "Accepted Risks (Won't Address)",
            })}
          </Typography>
          <Chip
            label={risks.length}
            size="small"
            color="default"
            sx={{ ml: 1 }}
          />
          {missingJustification && (
            <Chip
              label={t("tabs.risks.wontMissingJustification", {
                defaultValue: "Missing justification",
              })}
              size="small"
              color="error"
              variant="outlined"
              sx={{ ml: "auto" }}
            />
          )}
        </Box>

        {/* Table — sorted by risk score desc */}
        <RiskTable
          risks={[...risks].sort(
            (a, b) =>
              b.calculatedRiskBeforeMitigation -
              a.calculatedRiskBeforeMitigation,
          )}
          columns={columns}
          configuration={configuration}
          onEdit={handleEdit}
          groupRisks={risks}
        />

        {/* Missing justification warning */}
        {missingJustification && (
          <Box
            sx={{
              px: 2,
              py: 1,
              bgcolor: "error.light",
              color: "error.contrastText",
            }}
          >
            <Typography variant="caption">
              {t("tabs.risks.wontWarning", {
                defaultValue:
                  "⚠️ Some accepted risks are missing justification. Please provide reasoning for compliance documentation.",
              })}
            </Typography>
          </Box>
        )}
      </Paper>
    );
  },
);

WontRiskTable.displayName = "WontRiskTable";
export default WontRiskTable;
