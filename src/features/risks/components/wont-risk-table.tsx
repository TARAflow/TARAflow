// ==================== WONT RISK TABLE ====================
// Displays risks with MoSCoW priority "Won't".
// Uses MUI Table (no DataGrid) for consistent performance.

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Chip,
  Typography,
  Tooltip,
  Paper,
  Stack,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@mui/material";
import { Edit as EditIcon } from "@mui/icons-material";
import { DoNotDisturb as WontIcon } from "@mui/icons-material";
import { Risk, RiskConfiguration, ThreatReference } from "../models/risk-types";
import { getRiskColor } from "../services/risk-calculation-service";
import type { StrideCategory } from "shared";

const STRIDE_COLORS: Record<StrideCategory, string> = {
  S: "#ef4444",
  T: "#f97316",
  R: "#eab308",
  I: "#22c55e",
  D: "#3b82f6",
  E: "#a855f7",
};

const cellSx = {
  py: 0.75,
  px: 1,
  fontSize: "0.8rem",
  borderBottom: "1px solid",
  borderColor: "divider",
};

const headerCellSx = {
  ...cellSx,
  bgcolor: "grey.50",
  fontWeight: 600,
  fontSize: "0.75rem",
  color: "text.secondary",
  py: 0.5,
};

interface WontRiskTableProps {
  risks: Risk[];
  threats: ThreatReference[];
  configuration: RiskConfiguration;
  onEdit: (risk: Risk) => void;
}

export const WontRiskTable = React.memo<WontRiskTableProps>(
  ({ risks, configuration, onEdit }) => {
    const { t } = useTranslation();

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
        </Box>

        {/* Table */}
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ tableLayout: "fixed", minWidth: 600 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ ...headerCellSx, width: 130 }}>
                  {t("tabs.risks.columns.threatId", { defaultValue: "T-ID" })}
                </TableCell>
                <TableCell
                  sx={{ ...headerCellSx, width: 70, textAlign: "center" }}
                >
                  {t("tabs.risks.columns.stride", { defaultValue: "STRIDE" })}
                </TableCell>
                <TableCell sx={headerCellSx}>
                  {t("tabs.risks.columns.threat", { defaultValue: "Threat" })}
                </TableCell>
                <TableCell
                  sx={{ ...headerCellSx, width: 100, textAlign: "center" }}
                >
                  {t("tabs.risks.columns.originalRisk", {
                    defaultValue: "Original Risk",
                  })}
                </TableCell>
                <TableCell sx={{ ...headerCellSx, minWidth: 200 }}>
                  {t("tabs.risks.columns.justification", {
                    defaultValue: "Justification",
                  })}
                </TableCell>
                <TableCell sx={{ ...headerCellSx, width: 48 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {[...risks]
                .sort(
                  (a, b) =>
                    b.calculatedRiskBeforeMitigation -
                    a.calculatedRiskBeforeMitigation,
                )
                .map((risk) => {
                  const hasJustification = !!risk.wontJustification?.trim();
                  return (
                    <TableRow
                      key={risk.id}
                      sx={{
                        bgcolor: "grey.50",
                        "&:last-child td": { borderBottom: 0 },
                      }}
                    >
                      <TableCell sx={cellSx}>
                        <Chip
                          label={risk.threatId}
                          size="small"
                          sx={{
                            bgcolor:
                              STRIDE_COLORS[risk.strideCategory] ?? "#9ca3af",
                            color: "white",
                            fontWeight: "bold",
                            fontSize: "0.7rem",
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ ...cellSx, textAlign: "center" }}>
                        <Chip
                          label={risk.strideCategory}
                          size="small"
                          sx={{
                            bgcolor: STRIDE_COLORS[risk.strideCategory],
                            color: "white",
                            fontWeight: "bold",
                            minWidth: 32,
                          }}
                        />
                      </TableCell>
                      <TableCell sx={cellSx}>
                        <Tooltip title={risk.threatDescription ?? ""}>
                          <Typography
                            variant="body2"
                            sx={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              fontSize: "0.8rem",
                            }}
                          >
                            {risk.threatDescription || "–"}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell sx={{ ...cellSx, textAlign: "center" }}>
                        <Chip
                          label={
                            risk.calculatedRiskBeforeMitigation > 0
                              ? risk.calculatedRiskBeforeMitigation.toFixed(1)
                              : "–"
                          }
                          size="small"
                          sx={{
                            bgcolor: getRiskColor(
                              risk.calculatedRiskBeforeMitigation,
                              configuration.scale,
                              configuration.roundingMethod,
                            ),
                            color: "white",
                            fontWeight: "bold",
                          }}
                        />
                      </TableCell>
                      <TableCell sx={cellSx}>
                        <Tooltip title={risk.wontJustification ?? ""}>
                          <Typography
                            variant="body2"
                            sx={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              fontSize: "0.8rem",
                              color: hasJustification
                                ? "text.primary"
                                : "error.main",
                              fontStyle: hasJustification ? "normal" : "italic",
                            }}
                          >
                            {hasJustification
                              ? risk.wontJustification
                              : t("tabs.risks.noJustification", {
                                  defaultValue: "Missing justification!",
                                })}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell sx={{ ...cellSx, textAlign: "center" }}>
                        <Tooltip
                          title={t("common.edit", { defaultValue: "Edit" })}
                        >
                          <EditIcon
                            fontSize="small"
                            sx={{
                              cursor: "pointer",
                              color: "text.secondary",
                              "&:hover": { color: "primary.main" },
                            }}
                            onClick={() => onEdit(risk)}
                          />
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </Box>

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

export default WontRiskTable;