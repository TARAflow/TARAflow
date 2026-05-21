// ==================== RISK FILTERS ====================
// Filter bar for risks - matches threat-filters.tsx structure
// Simple one-line collapse with Priority + Status + Search + Count

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
  InputAdornment,
} from "@mui/material";
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
} from "@mui/icons-material";
import { MOSCOW_PRIORITIES } from "../models/risk-scale-types";
import type { MoSCoWPriority } from "../models/risk-scale-types";

// ==================== TYPES ====================

export interface RiskFiltersProps {
  // Filter state
  searchText: string;
  priorityFilter: MoSCoWPriority | "";

  // Callbacks
  onSearchTextChange: (text: string) => void;
  onPriorityFilterChange: (priority: MoSCoWPriority | "") => void;
  onClear: () => void;

  // UI state
  show: boolean;

  // Stats
  filteredCount: number;
  totalCount: number;
}

// ==================== COMPONENT ====================

export const RiskFilters = React.memo<RiskFiltersProps>(
  ({
    searchText,
    priorityFilter,
    onSearchTextChange,
    onPriorityFilterChange,
    onClear,
    show,
    filteredCount,
    totalCount,
  }) => {
    const { t } = useTranslation();
    const hasFilters = searchText.trim() !== "" || priorityFilter !== "";

    return (
      <Collapse in={show} timeout={300}>
        <Box
          sx={{
            display: "flex",
            gap: 2,
            alignItems: "center",
            px: 1,
            py: 1,
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          {/* Priority Filter */}
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>
              {t("tabs.risks.priority", { defaultValue: "Priority" })}
            </InputLabel>
            <Select
              value={priorityFilter}
              label={t("tabs.risks.priority", { defaultValue: "Priority" })}
              onChange={(e) =>
                onPriorityFilterChange(e.target.value as MoSCoWPriority | "")
              }
              startAdornment={<FilterIcon fontSize="small" sx={{ mr: 1 }} />}
            >
              <MenuItem value="">
                <em>
                  {t("tabs.risks.allPriorities", {
                    defaultValue: "All Priorities",
                  })}
                </em>
              </MenuItem>
              {MOSCOW_PRIORITIES.filter((p) => p.value !== "wont").map((p) => (
                <MenuItem key={p.value} value={p.value}>
                  {t(`risks.moscow.${p.value}.label`, {
                    defaultValue: p.label,
                  })}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Search Field */}
          <TextField
            size="small"
            placeholder={t("tabs.risks.searchPlaceholder", {
              defaultValue: "Search risks...",
            })}
            value={searchText}
            onChange={(e) => onSearchTextChange(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: 200 }}
          />

          {/* Spacer */}
          <Box sx={{ flexGrow: 1 }} />

          {/* Count - right aligned */}
          <Typography variant="body2" color="text.secondary">
            {t("tabs.risks.showingCount", {
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

RiskFilters.displayName = "RiskFilters";