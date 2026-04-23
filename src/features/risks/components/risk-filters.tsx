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
import { MOSCOW_PRIORITIES, RISK_STATUSES } from "../models/risk-types";
import type { MoSCoWPriority, RiskStatus } from "../models/risk-types";

// ==================== TYPES ====================

export interface RiskFiltersProps {
  // Filter state
  searchText: string;
  priorityFilter: MoSCoWPriority | "";
  statusFilter: RiskStatus | "";

  // Callbacks
  onSearchTextChange: (text: string) => void;
  onPriorityFilterChange: (priority: MoSCoWPriority | "") => void;
  onStatusFilterChange: (status: RiskStatus | "") => void;
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
    statusFilter,
    onSearchTextChange,
    onPriorityFilterChange,
    onStatusFilterChange,
    onClear,
    show,
    filteredCount,
    totalCount,
  }) => {
    const { t } = useTranslation();
    const hasFilters =
      searchText.trim() !== "" || priorityFilter !== "" || statusFilter !== "";

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

          {/* Status Filter */}
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>
              {t("tabs.risks.columns.status", { defaultValue: "Status" })}
            </InputLabel>
            <Select
              value={statusFilter}
              label={t("tabs.risks.columns.status", { defaultValue: "Status" })}
              onChange={(e) =>
                onStatusFilterChange(e.target.value as RiskStatus | "")
              }
            >
              <MenuItem value="">
                <em>
                  {t("tabs.risks.allStatuses", {
                    defaultValue: "All Statuses",
                  })}
                </em>
              </MenuItem>
              {RISK_STATUSES.filter((s) => s.value !== "wont-do").map((s) => (
                <MenuItem key={s.value} value={s.value}>
                  {t(`risks.status.${s.value.replace("-", "_")}.label`, {
                    defaultValue: s.label,
                  })}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

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
  }
);

RiskFilters.displayName = "RiskFilters";