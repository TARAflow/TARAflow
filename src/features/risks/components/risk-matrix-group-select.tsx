// ==================== RISK MATRIX GROUP SELECT ====================
// Leveled DFD (leveled-dfd-multi-diagram-design.md §10, Phase 6f): which
// part of the DFD the risk matrix shows — all risks, the top level, or one
// top-level decomposed multiprocess (the groups of the risk tables, D20).
// Renders nothing without groups (classic DFD, no decomposed multiprocess).

import React from "react";
import { useTranslation } from "react-i18next";
import { MenuItem, Select } from "@mui/material";
import { TOP_LEVEL_GROUP, type DfdTableGroups } from "shared";

export interface RiskMatrixGroupSelectProps {
  groups?: DfdTableGroups;
  /** "" = all risks, else a group key. */
  value: string;
  onChange: (value: string) => void;
}

export const RiskMatrixGroupSelect: React.FC<RiskMatrixGroupSelectProps> = ({
  groups,
  value,
  onChange,
}) => {
  const { t } = useTranslation();
  if (!groups) return null;
  return (
    <Select
      size="small"
      value={value}
      onChange={(e) => onChange(String(e.target.value))}
      // Same height as the Before / After buttons next to it (4 px padding,
      // 1 px border, 0.75rem at line height 1.75); the outline of a Select
      // lies outside its box, so 1 px more padding.
      sx={{
        minWidth: 160,
        fontSize: "0.75rem",
        "& .MuiSelect-select": { py: "5px", lineHeight: 1.75, minHeight: 0 },
      }}
      inputProps={{
        "data-testid": "risk-matrix-group",
        "aria-label": t("tabs.risks.matrix.group", { defaultValue: "Part of the DFD" }),
      }}
    >
      <MenuItem value="">{t("common.all", { defaultValue: "All" })}</MenuItem>
      {groups.groups.map((g) => (
        <MenuItem key={g.key} value={g.key}>
          {g.key === TOP_LEVEL_GROUP
            ? t("tabs.risks.groups.topLevel", { defaultValue: "Top level" })
            : g.label}
        </MenuItem>
      ))}
    </Select>
  );
};

export default RiskMatrixGroupSelect;
