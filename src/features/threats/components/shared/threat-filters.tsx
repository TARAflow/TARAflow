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

// ==================== TYPES ====================

export interface ThreatFiltersProps {
  strideCategory: StrideCategory | "";
  searchText: string;
  onStrideCategoryChange: (category: StrideCategory | "") => void;
  onSearchTextChange: (text: string) => void;
  onClear: () => void;
  show: boolean;
  filteredCount: number;
  totalCount: number;
}

// ==================== COMPONENT ====================

export const ThreatFilters = React.memo<ThreatFiltersProps>(
  ({
    strideCategory,
    searchText,
    onStrideCategoryChange,
    onSearchTextChange,
    show,
    filteredCount,
    totalCount,
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

          {/* Count */}
          <Typography variant="body2" color="text.secondary">
            {t("tabs.threats.showingCount", {
              count: filteredCount,
              total: totalCount,
              defaultValue: `Showing ${filteredCount} of ${totalCount}`,
            })}
          </Typography>
        </Box>
      </Collapse>
    );
  },
);

ThreatFilters.displayName = "ThreatFilters";