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
  IconButton,
  Tooltip,
} from "@mui/material";
import {
  FilterList as FilterIcon,
  Clear as ClearIcon,
} from "@mui/icons-material";
import { STRIDE_DEFINITIONS } from "../../models/threat-types";
import { STRIDE_COLORS } from "shared";
import type { StrideCategory } from "shared";

// ==================== TYPES ====================

export interface ThreatFiltersProps {
  // Filter state
  strideCategory: StrideCategory | "";
  searchText: string;

  // Callbacks
  onStrideCategoryChange: (category: StrideCategory | "") => void;
  onSearchTextChange: (text: string) => void;
  onClear: () => void;

  // UI state
  show: boolean;

  // Stats
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
    onClear,
    show,
    filteredCount,
    totalCount,
  }) => {
    const { t, i18n } = useTranslation();
    const isGerman = i18n.language === "de";
    const hasFilters = strideCategory !== "" || searchText.trim() !== "";

    return (
      <Collapse in={show}>
        <Box
          sx={{ display: "flex", gap: 2, alignItems: "center", px: 1, py: 1 }}
        >
          {/* STRIDE Dropdown - wider to prevent resize */}
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
                (cat) => {
                  const def = STRIDE_DEFINITIONS.find((s) => s.type === cat);
                  return (
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
                          {isGerman ? def?.nameDE : def?.name}
                        </Typography>
                      </Stack>
                    </MenuItem>
                  );
                }
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

          {/* Spacer */}
          <Box sx={{ flexGrow: 1 }} />

          {/* Count - right aligned */}
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
  }
);

ThreatFilters.displayName = "ThreatFilters";