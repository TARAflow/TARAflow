// ==================== INTERACTION THREATS VIEW ====================
// Props-only view — no internal hooks.
// ThreatsTab is the single source of truth for hook state.

import React, { useCallback } from "react";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import { AutoAwesome as GenerateIcon } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import type {
  Threat,
  ThreatTable,
  ThreatConfiguration,
} from "../../models/threat-types";
import type { AssetDataReference } from "shared";
import { useThreatFilters } from "../../hooks/shared/use-threat-filters";
import { ThreatFilters } from "../shared/threat-filters";
import { InteractionThreatTable } from "./interaction-threat-table";

// ==================== TYPES ====================

export interface InteractionThreatsViewProps {
  tables: ThreatTable[];
  isGenerating: boolean;
  hasDFD: boolean;
  configuration: ThreatConfiguration;
  assetDataRef?: AssetDataReference;
  showThreatActor?: boolean;
  onGenerate: () => void;
  onOpenEditDialog: (tableIndex: number, threat: Threat) => void;
  onDelete: (tableIndex: number, threatId: string) => void;
  onAdd: (tableIndex: number, threat: Threat) => void;
  showFilters?: boolean;
  reviewedCount?: number;
}

// ==================== COMPONENT ====================

export const InteractionThreatsView = React.memo<InteractionThreatsViewProps>(
  ({
    tables,
    isGenerating,
    hasDFD,
    configuration,
    assetDataRef,
    showThreatActor = false,
    onGenerate,
    onOpenEditDialog,
    onDelete,
    onAdd,
    showFilters = true,
    reviewedCount,
  }) => {
    const { t } = useTranslation();

    const {
      filters,
      setStrideFilter,
      setRelevanceFilter,
      setSearchText,
      clearFilters,
      filterThreats,
      hasActiveFilters,
    } = useThreatFilters();

    const filteredTables = React.useMemo(() => {
      if (!hasActiveFilters) return tables;
      return tables.map((table) => ({
        ...table,
        threats: filterThreats(table.threats),
      }));
    }, [tables, filterThreats, hasActiveFilters]);

    const totalThreats = React.useMemo(
      () => tables.reduce((sum, t) => sum + t.threats.length, 0),
      [tables],
    );

    const filteredThreats = React.useMemo(
      () => filteredTables.reduce((sum, t) => sum + t.threats.length, 0),
      [filteredTables],
    );

    const handleEdit = useCallback(
      (tableIndex: number, threat: Threat) => {
        onOpenEditDialog(tableIndex, threat);
      },
      [onOpenEditDialog],
    );

    const handleDelete = useCallback(
      (tableIndex: number, threatId: string) => {
        onDelete(tableIndex, threatId);
      },
      [onDelete],
    );

    return (
      <Box
        sx={{
          flexGrow: 1,
          flexShrink: 1,
          height: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {showFilters && (
          <Box sx={{ flexShrink: 0 }}>
            <ThreatFilters
              strideCategory={filters.strideCategory}
              relevance={filters.relevance}
              searchText={filters.searchText}
              onStrideCategoryChange={setStrideFilter}
              onRelevanceChange={setRelevanceFilter}
              onSearchTextChange={setSearchText}
              onClear={clearFilters}
              show={showFilters}
              reviewedCount={reviewedCount}
              totalCount={totalThreats}
            />
          </Box>
        )}

        {/* Generating overlay */}
        {isGenerating && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              px: 2,
              py: 1.5,
              bgcolor: "background.paper",
              borderBottom: 1,
              borderColor: "divider",
            }}
          >
            <CircularProgress size={16} />
            <Typography variant="body2" color="text.secondary">
              {t("tabs.threats.generating", { defaultValue: "Generating..." })}
            </Typography>
          </Box>
        )}

        {totalThreats === 0 ? (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              minHeight: 300,
              gap: 2,
            }}
          >
            <Typography variant="h6" color="text.secondary">
              {t("tabs.threats.noThreats", {
                defaultValue: "No threats defined yet",
              })}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t("tabs.threats.noThreatsHint", {
                defaultValue:
                  'Click "Generate Threats" to automatically create threats based on your DFD.',
              })}
            </Typography>
            <Button
              variant="contained"
              startIcon={<GenerateIcon />}
              onClick={onGenerate}
              disabled={!hasDFD || isGenerating}
            >
              {isGenerating
                ? t("tabs.threats.generating", {
                    defaultValue: "Generating...",
                  })
                : t("tabs.threats.generate", {
                    defaultValue: "Generate Threats",
                  })}
            </Button>
          </Box>
        ) : (
          <Box sx={{ flexGrow: 1, overflow: "auto" }}>
            {filteredTables.map((table, index) => (
              <InteractionThreatTable
                key={`${table.trustBoundaryId ?? "none"}-${table.trustBoundaryName}`}
                table={table}
                tableIndex={index}
                configuration={configuration}
                assetDataRef={assetDataRef}
                showThreatActor={showThreatActor}
                onEdit={(threat) => handleEdit(index, threat)}
                onDelete={(threatId) => handleDelete(index, threatId)}
                onAdd={(threat) => onAdd(index, threat)}
              />
            ))}
          </Box>
        )}
      </Box>
    );
  },
);

InteractionThreatsView.displayName = "InteractionThreatsView";