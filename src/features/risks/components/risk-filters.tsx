// ==================== RISK FILTERS ====================
// Filter bar for risks - matches threat-filters.tsx structure
// One-line collapse with Priority + Risk Level + Search + Count

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
import { DfdScopeFilterControls } from "shared";
import type { DfdScopeFilter, DfdScopeIndex } from "shared";
import { MOSCOW_PRIORITIES, RISK_SCALES } from "../models/risk-scale-types";
import { isoRiskValueColor } from "../models/iso-risk-display";
import type { MoSCoWPriority, RiskScaleType } from "../models/risk-scale-types";

// ==================== TYPES ====================

export interface RiskFiltersProps {
  // Filter state
  searchText: string;
  priorityFilter: MoSCoWPriority | "";
  /** Selected risk level (RiskScaleLevel.value, 1..N) or "" for all. */
  riskLevelFilter: number | "";
  /** Active risk scale — drives which level options are shown. */
  scale: RiskScaleType;
  /** ISO/SAE 21434: the options are the risk values 5 … 1 (plan 3a-2). */
  isoValues?: boolean;

  // Callbacks
  onSearchTextChange: (text: string) => void;
  onPriorityFilterChange: (priority: MoSCoWPriority | "") => void;
  onRiskLevelFilterChange: (level: number | "") => void;
  onClear: () => void;

  // UI state
  show: boolean;

  // Stats
  filteredCount: number;
  totalCount: number;

  /** Leveled DFD: page and analysis-state filter; absent for a classic DFD. */
  scopeIndex?: DfdScopeIndex;
  scope?: DfdScopeFilter;
  onScopeChange?: (scope: DfdScopeFilter) => void;
}

// ==================== COMPONENT ====================

export const RiskFilters = React.memo<RiskFiltersProps>(
  ({
    searchText,
    priorityFilter,
    riskLevelFilter,
    scale,
    isoValues = false,
    onSearchTextChange,
    onPriorityFilterChange,
    onRiskLevelFilterChange,
    onClear,
    show,
    filteredCount,
    totalCount,
    scopeIndex,
    scope,
    onScopeChange,
  }) => {
    const { t } = useTranslation();
    const hasFilters =
      searchText.trim() !== "" ||
      priorityFilter !== "" ||
      riskLevelFilter !== "";

    // Level options come from the active scale so 3-/4-/5-level all work
    // (4-level -> Low / Medium / High / Critical). Highest severity first.
    const levelOptions = isoValues
      ? [5, 4, 3, 2, 1].map((v) => ({
          value: v,
          label: t("tabs.risks.iso.valueOption", { value: v, defaultValue: `Risk value ${v}` }),
          color: isoRiskValueColor(v),
          iso: true,
        }))
      : [...RISK_SCALES[scale].levels].reverse().map((l) => ({ ...l, iso: false }));

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

          {/* Risk Level Filter */}
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>
              {t("tabs.risks.riskLevel", { defaultValue: "Risk Level" })}
            </InputLabel>
            <Select
              value={riskLevelFilter}
              label={t("tabs.risks.riskLevel", { defaultValue: "Risk Level" })}
              onChange={(e) =>
                onRiskLevelFilterChange(
                  e.target.value === "" ? "" : Number(e.target.value),
                )
              }
              startAdornment={<FilterIcon fontSize="small" sx={{ mr: 1 }} />}
            >
              <MenuItem value="">
                <em>
                  {t("tabs.risks.allRiskLevels", {
                    defaultValue: "All Risk Levels",
                  })}
                </em>
              </MenuItem>
              {levelOptions.map((lvl) => (
                <MenuItem key={lvl.value} value={lvl.value}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box
                      component="span"
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: "2px",
                        bgcolor: lvl.color,
                        flexShrink: 0,
                      }}
                    />
                    <span>
                      {lvl.iso
                        ? lvl.label
                        : t(
                            `risks.scales.impact.${lvl.label
                              .toLowerCase()
                              .replace(/\s+/g, "_")}`,
                            { defaultValue: lvl.label },
                          )}
                    </span>
                  </Stack>
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

          {scope && onScopeChange && (
            <DfdScopeFilterControls index={scopeIndex} filter={scope} onChange={onScopeChange} />
          )}

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