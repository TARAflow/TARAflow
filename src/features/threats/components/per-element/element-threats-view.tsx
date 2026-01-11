// ==================== ELEMENT THREATS VIEW ====================
// Main view for STRIDE per-element threats
// FIXED: Correct handler props - onOpenEditDialog instead of onEdit

import React, { useCallback, useEffect } from "react";
import { Box, Button, Typography } from "@mui/material";
import { AutoAwesome as GenerateIcon } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import type {
  Threat,
  ThreatProjectData,
  ThreatConfiguration,
  ThreatData,
} from "../../models/threat-types";
import { useElementThreats } from "../../hooks/per-element/use-element-threats";
import { useThreatFilters } from "../../hooks/shared/use-threat-filters";
import { ThreatFilters } from "../shared/threat-filters";
import { ElementThreatTable } from "./element-threat-table";

// ==================== TYPES ====================

export interface ElementThreatsViewProps {
  project: ThreatProjectData;
  configuration: ThreatConfiguration;
  onUpdate: (data: ThreatData) => void;
  onOpenEditDialog: (tableIndex: number, threat: Threat) => void;
  showFilters?: boolean;
}

// ==================== COMPONENT ====================

export const ElementThreatsView = React.memo<ElementThreatsViewProps>(
  ({
    project,
    configuration,
    onUpdate,
    onOpenEditDialog,
    showFilters = true,
  }) => {
    // Use element threats hook
    const { tables, deleteThreat, isGenerating, generateThreats } =
      useElementThreats({
        project,
        configuration,
        onUpdate,
      });

    const hasDFD = !!project.dfdElements && project.dfdElements.length > 0;
    const { t } = useTranslation();

    // Use filters hook
    const {
      filters,
      setStrideFilter,
      setSearchText,
      clearFilters,
      filterThreats,
      hasActiveFilters,
    } = useThreatFilters();

    // Apply filters to all threats
    const filteredTables = React.useMemo(() => {
      if (!hasActiveFilters) return tables;

      return tables.map((table) => ({
        ...table,
        threats: filterThreats(table.threats),
      }));
    }, [tables, filterThreats, hasActiveFilters]);

    // Calculate counts
    const totalThreats = React.useMemo(
      () => tables.reduce((sum, t) => sum + t.threats.length, 0),
      [tables]
    );

    useEffect(() => {
      console.log("totalThreats changed:", totalThreats);
    }, [totalThreats]);

    const filteredThreats = React.useMemo(
      () => filteredTables.reduce((sum, t) => sum + t.threats.length, 0),
      [filteredTables]
    );

    // Handle edit - just open dialog
    const handleEdit = useCallback(
      (tableIndex: number, threat: Threat) => {
        onOpenEditDialog(tableIndex, threat);
      },
      [onOpenEditDialog]
    );

    // Handle delete - use hook directly
    const handleDelete = useCallback(
      (tableIndex: number, threatId: string) => {
        deleteThreat(tableIndex, threatId);
      },
      [deleteThreat]
    );

    return (
      <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
        {/* Filters */}
        {showFilters && (
          <ThreatFilters
            strideCategory={filters.strideCategory}
            searchText={filters.searchText}
            onStrideCategoryChange={setStrideFilter}
            onSearchTextChange={setSearchText}
            onClear={clearFilters}
            show={showFilters}
            filteredCount={filteredThreats}
            totalCount={totalThreats}
          />
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
              onClick={generateThreats}
              disabled={!hasDFD || isGenerating}
            >
              {isGenerating
                ? t("tabs.threats.generating", {
                    defaultValue: "Generating...",
                  })
                : t("tabs.threats.generate", {
                    defaultValue: "Generate Threats",
                  })}
            </Button>{" "}
          </Box>
        ) : (
          <Box sx={{ flexGrow: 1, overflow: "auto" }}>
            {filteredTables.map((table, index) => (
              <ElementThreatTable
                key={`${table.trustBoundaryId ?? "none"}-${
                  table.trustBoundaryName
                }`}
                table={table}
                tableIndex={index}
                configuration={configuration}
                onEdit={(threat) => handleEdit(index, threat)}
                onDelete={(threatId) => handleDelete(index, threatId)}
              />
            ))}
          </Box>
        )}
      </Box>
    );
  }
);

ElementThreatsView.displayName = "ElementThreatsView";