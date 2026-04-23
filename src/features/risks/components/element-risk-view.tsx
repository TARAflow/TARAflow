import React, { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Box, Typography, Stack, Chip, Tooltip } from "@mui/material";
import {
  Security as TrustBoundaryIcon,
} from "@mui/icons-material";
import {
  Risk,
  RiskConfiguration,
  ThreatReference,
  MoSCoWPriority,
  RiskStatus,
} from "../models/risk-types";
import { RiskFilters } from "./risk-filters";
import { useAccordionState } from "../hooks/shared/use-accordion-state";
import { useRiskGrouping } from "../hooks/use-risk-grouping";
import { useRiskColumns } from "./shared/risk-columns";
import { GenericAccordion } from "shared";
import { OuterHeader } from "shared";
import { InnerHeader } from "shared";
import { RiskTable } from "./shared/risk-table";
import { ProgressChip } from "./shared/progress-chip";
import {
  RISK_SCALES,
  RiskScaleType,
  RiskRoundingMethod,
} from "../models/risk-types";
import { getRiskColor } from "../services/risk-calculation-service";
import {
  formatElementId,
  getElementIconComponent,
} from "../utils/risk-formatting";

interface ElementRiskViewProps {
  risks: Risk[];
  threats: ThreatReference[];
  configuration: RiskConfiguration;

  showFilters?: boolean;
  filters: {
    searchText: string;
    priorityFilter: MoSCoWPriority | "";
    statusFilter: RiskStatus | "";
  };
  onSearchTextChange: (text: string) => void;
  onPriorityFilterChange: (priority: MoSCoWPriority | "") => void;
  onStatusFilterChange: (status: RiskStatus | "") => void;
  onClearFilters: () => void;
  filteredCount: number;

  onEdit: (risk: Risk) => void;
  onPriorityChange: (
    riskId: string,
    priority: string,
    justification?: string,
  ) => void;
  onStatusChange: (riskId: string, status: string) => void;
  onTreatmentChange: (riskId: string, treatment: string) => void;
}

export const ElementRiskView: React.FC<ElementRiskViewProps> = ({
  risks,
  threats,
  configuration,
  showFilters = false,
  filters,
  onSearchTextChange,
  onPriorityFilterChange,
  onStatusFilterChange,
  onClearFilters,
  filteredCount,
  onEdit,
  onPriorityChange,
  onStatusChange,
  onTreatmentChange,
}) => {
  const { t } = useTranslation();

  const {
    expanded: expandedTables,
    toggle: toggleTable,
    ensureKeys: ensureTableKeys,
  } = useAccordionState({
    storageKey: "risk-table-expanded-tables",
    defaultExpanded: true,
  });

  const { expanded: expandedElements, toggle: toggleElement } =
    useAccordionState({
      storageKey: "risk-table-expanded-elements",
      defaultExpanded: false,
    });

  useEffect(() => {
    const tableKeys = risks.map((risk) => {
      const threat = threats.find((t) => t.id === risk.threatId);
      return threat?.trustBoundaryId || "external";
    });
    ensureTableKeys(tableKeys);
  }, [risks.length, threats.length, ensureTableKeys]);

  const { groupedByTrustBoundary } = useRiskGrouping(risks, threats, true);

  // Reverse trust boundaries for per-element mode (like original)
  const groupsForRender = useMemo(() => {
    return [...groupedByTrustBoundary].reverse();
  }, [groupedByTrustBoundary]);

  const columns = useRiskColumns({
    configuration,
    onEdit,
    onPriorityChange,
    onStatusChange,
    onTreatmentChange,
  });

  // ── Accordion header helpers ───────────────────────────────────────────
  const scale = configuration.scale;
  const rounding = configuration.roundingMethod;

  const getTopRiskLevels = (risks: Risk[]) => {
    const scaleConfig = RISK_SCALES[scale];
    const counts = new Array(scaleConfig.levels.length).fill(0);
    for (const r of risks) {
      if (r.calculatedRiskBeforeMitigation <= 0) continue;
      const v = r.calculatedRiskBeforeMitigation;
      const idx =
        rounding === "ceil"
          ? Math.min(Math.max(Math.ceil(v) - 1, 0), counts.length - 1)
          : Math.min(Math.max(Math.round(v) - 1, 0), counts.length - 1);
      counts[idx]++;
    }
    return scaleConfig.levels
      .map((lvl, i) => ({
        label: lvl.label,
        color: lvl.color,
        count: counts[i],
      }))
      .filter((l) => l.count > 0)
      .reverse()
      .slice(0, 2);
  };

  const getBorderColor = (risks: Risk[]) => {
    const assessed = risks.filter(
      (r) => r.calculatedRiskBeforeMitigation > 0,
    ).length;
    if (!risks.length) return "#9ca3af";
    if (assessed === risks.length) return "#16a34a";
    if (assessed > 0) return "#d97706";
    return "#9ca3af";
  };

  const getProgressTooltip = (risks: Risk[]) => {
    const assessed = risks.filter(
      (r) => r.calculatedRiskBeforeMitigation > 0,
    ).length;
    const open = risks.filter((r) => r.status === "open").length;
    const done = risks.filter((r) => r.status !== "open").length;
    return `${assessed} assessed  ·  ${done} completed  ·  ${open} open`;
  };

  const getElementIcon = (elementType: string) => {
    const Icon = getElementIconComponent(elementType);
    return <Icon fontSize="small" color="action" />;
  };

  return (
    <>
      {/* Filters */}
      <RiskFilters
        searchText={filters.searchText}
        priorityFilter={filters.priorityFilter}
        statusFilter={filters.statusFilter}
        onSearchTextChange={onSearchTextChange}
        onPriorityFilterChange={onPriorityFilterChange}
        onStatusFilterChange={onStatusFilterChange}
        onClear={onClearFilters}
        show={showFilters}
        filteredCount={filteredCount}
        totalCount={risks.length}
      />

      {/* Trust Boundary Groups */}
      {groupsForRender.map((group) => (
        <GenericAccordion
          key={group.id}
          id={group.id}
          expanded={expandedTables[group.id] ?? false}
          onToggle={toggleTable}
          level="outer"
          sx={{ borderLeft: `4px solid ${getBorderColor(group.risks)}` }}
          title={
            <OuterHeader
              icon={<TrustBoundaryIcon color="primary" />}
              code={group.displayIdentifier}
              title={group.name}
              rightSlot={
                <Stack direction="row" spacing={0.5} alignItems="center">
                  {getTopRiskLevels(group.risks).map((lvl) => (
                    <Chip
                      key={lvl.label}
                      label={`${lvl.label} ×${lvl.count}`}
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: "0.65rem",
                        bgcolor: `${lvl.color}20`,
                        color: lvl.color,
                        border: `1px solid ${lvl.color}`,
                        cursor: "default",
                      }}
                    />
                  ))}
                  <Tooltip
                    title={getProgressTooltip(group.risks)}
                    placement="top"
                  >
                    <Chip
                      label={`${group.risks.filter((r) => r.calculatedRiskBeforeMitigation > 0).length}/${group.risks.length}`}
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: "0.65rem",
                        cursor: "default",
                        bgcolor:
                          getBorderColor(group.risks) === "#16a34a"
                            ? "#f0fdf4"
                            : "#f9fafb",
                        color:
                          getBorderColor(group.risks) === "#16a34a"
                            ? "#16a34a"
                            : "#6b7280",
                        border: `1px solid ${getBorderColor(group.risks)}`,
                      }}
                    />
                  </Tooltip>
                </Stack>
              }
            />
          }
        >
          {/* Only render content when expanded */}
          {expandedTables[group.id] && (
            <>
              {/* Element Groups */}
              {group.elements && group.elements.length > 0 ? (
                group.elements.map((element) => {
                  const elementKey = `${group.id}-${element.elementId}`;

                  return (
                    <GenericAccordion
                      key={elementKey}
                      id={elementKey}
                      expanded={expandedElements[elementKey] ?? false}
                      onToggle={toggleElement}
                      level="inner"
                      title={
                        <InnerHeader
                          icon={getElementIcon(element.elementType)}
                          code={formatElementId(element.elementId)}
                          title={element.elementName}
                          rightSlot={<ProgressChip risks={element.risks} />}
                        />
                      }
                    >
                      <RiskTable
                        risks={element.risks}
                        columns={columns}
                        configuration={configuration}
                        onEdit={onEdit}
                        groupRisks={group.risks}
                      />
                    </GenericAccordion>
                  );
                })
              ) : (
                <RiskTable
                  risks={group.risks}
                  columns={columns}
                  configuration={configuration}
                  onEdit={onEdit}
                />
              )}
            </>
          )}
        </GenericAccordion>
      ))}
    </>
  );
};

export default ElementRiskView;