// ==================== RISK TABLE ====================
// Thin wrapper over the shared DataTable.
//
// Everything generic — the column contract, colgroup layout, cell styling,
// row click and the group convention — now lives in
// src/shared/components/data-table.tsx, so the Attack Tree tab can use the same
// table without importing from features/risks.
//
// What remains here is the only risk-specific part: the row background derived
// from the calculated risk score. Call sites are unchanged.

import React from "react";
import type { Risk } from "../../models/risk-assessment-types";
import type { RiskConfiguration } from "../../models/risk-config-types";
import type {
  RiskScaleType,
  RiskRoundingMethod,
} from "../../models/risk-scale-types";
import type { RiskColumn } from "./risk-columns";
import { RISK_SCALES } from "../../models/risk-scale-types";
import { DataTable } from "shared";

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
}) => (
  <DataTable<Risk>
    rows={risks}
    columns={columns}
    getRowId={(risk) => risk.id}
    group={groupRisks}
    onRowClick={onEdit}
    rowBackground={(risk) =>
      getRiskRowBg(
        risk.calculatedRiskBeforeMitigation,
        configuration.scale,
        configuration.roundingMethod,
      )
    }
  />
);

export default RiskTable;