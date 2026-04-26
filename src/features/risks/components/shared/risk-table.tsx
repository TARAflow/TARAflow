// ==================== RISK TABLE ====================
// MUI Table implementation — replaces DataGrid for performance.
// Row background color reflects the calculated risk score.

import React from "react";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Box,
} from "@mui/material";
import type {
  Risk,
  RiskConfiguration,
  RiskScaleType,
  RiskRoundingMethod,
} from "../../models/risk-types";
import type { RiskColumn } from "./risk-columns";
import { RISK_SCALES } from "../../models/risk-types";

// ==================== ROW BACKGROUND COLORS ====================

const RISK_ROW_BG = [
  "transparent", // 0 = unrated
  "#f0fdf4", // level 1 = low    → green
  "#fefce8", // level 2 = medium → yellow
  "#fff7ed", // level 3 = high   → orange
  "#fef2f2", // level 4 = critical → red
  "#fdf4ff", // level 5 = very critical → purple
];

function getRiskRowBg(
  score: number,
  scale: RiskScaleType,
  rounding: RiskRoundingMethod = "round",
): string {
  if (score <= 0) return "transparent";
  const levels = RISK_SCALES[scale].levels.length;
  const idx =
    rounding === "ceil"
      ? Math.min(Math.max(Math.ceil(score) - 1, 0), levels - 1)
      : Math.min(Math.max(Math.round(score) - 1, 0), levels - 1);
  // +1 because index 0 = unrated
  return RISK_ROW_BG[idx + 1] ?? "transparent";
}

// ==================== CELL STYLES ====================

const headerCellSx = {
  bgcolor: "grey.50",
  fontWeight: 600,
  fontSize: "0.72rem",
  color: "text.secondary",
  py: 0.75,
  px: 1,
  whiteSpace: "nowrap" as const,
};

const bodyCellSx = {
  py: 0.75,
  px: 1,
  fontSize: "0.8rem",
};

// ==================== COMPONENT ====================

interface RiskTableProps {
  risks: Risk[];
  columns: RiskColumn[];
  configuration: RiskConfiguration;
  /** Called with the full group when a row edit action fires */
  onEdit?: (risk: Risk, groupRisks: Risk[]) => void;
  /** The full outer accordion group — passed to dialog sidebar (defaults to risks) */
  groupRisks?: Risk[];
}

export const RiskTable: React.FC<RiskTableProps> = ({
  risks,
  columns,
  configuration,
  onEdit,
  groupRisks,
}) => {
  // effectiveGroup: use explicit groupRisks (outer TB) if provided, else fall back to risks
  const effectiveGroup = groupRisks ?? risks;

  const boundColumns = React.useMemo(() => {
    if (!onEdit) return columns;
    return columns.map((col) =>
      col.id === "actions"
        ? {
            ...col,
            renderCell: (risk: Risk) => {
              const orig = col.renderCell(risk);
              if (!React.isValidElement(orig)) return orig;
              return React.cloneElement(orig as React.ReactElement<any>, {
                onClick: () => onEdit(risk, effectiveGroup),
              });
            },
          }
        : col,
    );
  }, [columns, onEdit, effectiveGroup]);
  if (!risks.length) return null;

  // Calculate total fixed width for minWidth on table
  const totalFixed = columns.reduce((sum, col) => sum + (col.width ?? 0), 0);
  const hasFlex = columns.some((col) => col.flex);
  const tableMinWidth = totalFixed + (hasFlex ? 200 : 0);

  return (
    <Box sx={{ overflowX: "auto", width: "100%" }}>
      <Table
        size="small"
        sx={{
          tableLayout: "fixed",
          minWidth: Math.max(tableMinWidth, 700),
          width: "100%",
        }}
      >
        {/* colgroup defines column widths */}
        <colgroup>
          {columns.map((col) => (
            <col
              key={col.id}
              style={{
                width: col.flex
                  ? undefined // flex columns get remaining space
                  : `${col.width ?? col.minWidth ?? 80}px`,
              }}
            />
          ))}
        </colgroup>

        <TableHead>
          <TableRow>
            {boundColumns.map((col) => (
              <TableCell
                key={col.id}
                align={col.align ?? "left"}
                sx={headerCellSx}
              >
                {col.header}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>

        <TableBody>
          {risks.map((risk, rowIdx) => {
            const rowBg = getRiskRowBg(
              risk.calculatedRiskBeforeMitigation,
              configuration.scale,
              configuration.roundingMethod,
            );
            return (
              <TableRow
                key={`${risk.id}-${rowIdx}`}
                hover
                onClick={
                  onEdit ? () => onEdit(risk, effectiveGroup) : undefined
                }
                sx={{
                  bgcolor: rowBg,
                  cursor: onEdit ? "pointer" : "default",
                  "&:hover": {
                    bgcolor: `${rowBg} !important`,
                    filter: "brightness(0.97)",
                  },
                  "&:last-child td": { borderBottom: 0 },
                }}
              >
                {boundColumns.map((col) => (
                  <TableCell
                    key={col.id}
                    align={col.align ?? "left"}
                    onClick={
                      col.stopRowClick
                        ? (e) => {
                            e.stopPropagation();
                            col.onCellClick?.(risk);
                          }
                        : undefined
                    }
                    sx={{
                      ...bodyCellSx,
                      overflow: "hidden",
                      ...(col.flex
                        ? {
                            whiteSpace: "nowrap",
                            textOverflow: "ellipsis",
                            maxWidth: 0,
                          }
                        : {}),
                    }}
                  >
                    {col.renderCell(risk)}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );
};

export default RiskTable;