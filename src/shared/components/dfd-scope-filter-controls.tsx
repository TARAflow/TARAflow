// ==================== DFD SCOPE FILTER CONTROLS ====================
// Leveled DFD (leveled-dfd-multi-diagram-design.md §10, Phase 6f): page
// filter (with or without its sub-pages) and "analysed on parent level
// only" for the filter bars of the threat and risk tables. Renders nothing
// for a classic DFD (no scope index).

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";
import type { DfdScopeFilter, DfdScopeIndex } from "../models/dfd-scope";

export interface DfdScopeFilterControlsProps {
  index?: DfdScopeIndex;
  filter: DfdScopeFilter;
  onChange: (filter: DfdScopeFilter) => void;
}

export const DfdScopeFilterControls: React.FC<DfdScopeFilterControlsProps> = ({
  index,
  filter,
  onChange,
}) => {
  const { t } = useTranslation();
  if (!index) return null;
  const hasSubPages = !!filter.pageId && (index.childPages[filter.pageId]?.length ?? 0) > 0;
  const parentLevelCount = index.parentLevelFlows.length;
  return (
    <>
      <FormControl size="small" sx={{ minWidth: 170 }}>
        <InputLabel>{t("common.dfdScope.page", { defaultValue: "Page" })}</InputLabel>
        <Select
          value={filter.pageId}
          label={t("common.dfdScope.page", { defaultValue: "Page" })}
          onChange={(e) => onChange({ ...filter, pageId: String(e.target.value) })}
          inputProps={{ "data-testid": "dfd-scope-page" }}
        >
          <MenuItem value="">
            <em>{t("common.dfdScope.allPages", { defaultValue: "All pages" })}</em>
          </MenuItem>
          {index.pages.map((p) => (
            <MenuItem key={p.pageId} value={p.pageId} sx={{ pl: 2 + p.depth * 2 }}>
              {p.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {hasSubPages && (
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={filter.withSubPages}
              onChange={(e) => onChange({ ...filter, withSubPages: e.target.checked })}
              inputProps={{ "aria-label": "with-sub-pages" }}
            />
          }
          label={
            <Typography variant="body2">
              {t("common.dfdScope.withSubPages", { defaultValue: "with sub-pages" })}
            </Typography>
          }
        />
      )}
      {(parentLevelCount > 0 || filter.parentLevelOnly) && (
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={filter.parentLevelOnly}
              onChange={(e) => onChange({ ...filter, parentLevelOnly: e.target.checked })}
              inputProps={{ "aria-label": "parent-level-only" }}
            />
          }
          label={
            <Typography variant="body2">
              {t("common.dfdScope.parentLevelOnly", {
                defaultValue: "Only flows analysed on parent level ({{count}})",
                count: parentLevelCount,
              })}
            </Typography>
          }
        />
      )}
    </>
  );
};

export default DfdScopeFilterControls;
