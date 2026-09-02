// ==================== THREAT FILTERS ====================
// Filter bar for threats - ORIGINAL STYLE
// Simple one-line collapse with STRIDE + Search + Count

import React from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Collapse,
  Stack,
  Typography,
  Chip,
} from "@mui/material";
import { STRIDE_COLORS } from "shared";
import type { StrideCategory } from "shared";
import type { ThreatRelevanceFilter } from "../../hooks/shared/use-threat-filters";

// ==================== RELEVANCE OPTIONS ====================
// Same palette as RELEVANCE_ROW_BG in element-threat-table.tsx, just a
// slightly stronger tone since these render as solid Chips, not backgrounds.

const RELEVANCE_OPTIONS: {
  value: Exclude<ThreatRelevanceFilter, "">;
  color: string;
}[] = [
  { value: "unrated", color: "#9ca3af" },
  { value: "relevant", color: "#16a34a" },
  { value: "uncertain", color: "#d97706" },
  { value: "not_relevant", color: "#dc2626" },
];

// ==================== TYPES ====================

export interface ThreatFiltersProps {
  strideCategory: StrideCategory | "";
  relevance: ThreatRelevanceFilter;
  searchText: string;
  onStrideCategoryChange: (category: StrideCategory | "") => void;
  onRelevanceChange: (relevance: ThreatRelevanceFilter) => void;
  onSearchTextChange: (text: string) => void;
  onClear: () => void;
  show: boolean;
  totalCount: number;
  reviewedCount?: number;
}

// ==================== COMPONENT ====================

export const ThreatFilters = React.memo<ThreatFiltersProps>(
  ({
    strideCategory,
    relevance,
    searchText,
    onStrideCategoryChange,
    onRelevanceChange,
    onSearchTextChange,
    show,
    totalCount,
    reviewedCount,
  }) => {
    const { t } = useTranslation();

    return (
      <Collapse in={show}>
        <Box
          sx={{ display: "flex", gap: 2, alignItems: "center", px: 1, py: 1 }}
        >
          {/* STRIDE Dropdown */}
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>STRIDE</InputLabel>
            <Select
              value={strideCategory}
              label="STRIDE"
              onChange={(e) =>
                onStrideCategoryChange(e.target.value as StrideCategory | "")
              }
            >
              <MenuItem value="">
                <em>{t("common.all", { defaultValue: "All" })}</em>
              </MenuItem>
              {(["S", "T", "R", "I", "D", "E"] as StrideCategory[]).map(
                (cat) => (
                  <MenuItem key={cat} value={cat}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip
                        label={cat}
                        size="small"
                        sx={{
                          backgroundColor: STRIDE_COLORS[cat],
                          color: "white",
                          width: 28,
                          height: 20,
                        }}
                      />
                      <Typography variant="body2">
                        {t(`stride.${cat}.name`, { defaultValue: cat })}
                      </Typography>
                    </Stack>
                  </MenuItem>
                ),
              )}
            </Select>
          </FormControl>

          {/* Relevance / Triage Status Dropdown */}
          <FormControl size="small" sx={{ minWidth: 170 }}>
            <InputLabel>
              {t("tabs.threats.eval.relevance", { defaultValue: "Relevance" })}
            </InputLabel>
            <Select
              value={relevance}
              label={t("tabs.threats.eval.relevance", {
                defaultValue: "Relevance",
              })}
              onChange={(e) =>
                onRelevanceChange(e.target.value as ThreatRelevanceFilter)
              }
            >
              <MenuItem value="">
                <em>{t("common.all", { defaultValue: "All" })}</em>
              </MenuItem>
              {RELEVANCE_OPTIONS.map(({ value, color }) => (
                <MenuItem key={value} value={value}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip
                      label=""
                      size="small"
                      sx={{ backgroundColor: color, width: 12, height: 12 }}
                    />
                    <Typography variant="body2">
                      {t(`tabs.threats.eval.${value}`, {
                        defaultValue: value,
                      })}
                    </Typography>
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Search Field */}
          <TextField
            size="small"
            placeholder={t("tabs.threats.searchPlaceholder", {
              defaultValue: "Search threats...",
            })}
            value={searchText}
            onChange={(e) => onSearchTextChange(e.target.value)}
            sx={{ width: 200 }}
          />

          <Box sx={{ flexGrow: 1 }} />

          {/* Reviewed count */}
          {reviewedCount !== undefined && totalCount > 0 && (
            <Chip
              label={t("tabs.threats.reviewedCount", {
                reviewed: reviewedCount,
                total: totalCount,
                defaultValue: `${reviewedCount} / ${totalCount} reviewed`,
              })}
              size="small"
              color={reviewedCount === totalCount ? "success" : "default"}
              variant="outlined"
              sx={{ height: 20, fontSize: "0.7rem" }}
            />
          )}
        </Box>
      </Collapse>
    );
  },
);

ThreatFilters.displayName = "ThreatFilters";