import React, { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Box, Typography } from "@mui/material";
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
    justification?: string
  ) => void;
  onStatusChange: (riskId: string, status: string) => void;
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
  });

  const getElementIcon = (elementType: string) => {
    const Icon = getElementIconComponent(elementType);
    console.log("getElementIcon: "+elementType +"  "+Icon)
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
          title={
            <OuterHeader
              icon={<TrustBoundaryIcon color="primary" />}
              code={group.displayIdentifier}
              title={group.name}
              rightSlot={<ProgressChip risks={group.risks} />}
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
                      <RiskTable risks={element.risks} columns={columns} />
                    </GenericAccordion>
                  );
                })
              ) : (
                <RiskTable risks={group.risks} columns={columns} />
              )}
            </>
          )}
        </GenericAccordion>
      ))}
    </>
  );
};

export default ElementRiskView;