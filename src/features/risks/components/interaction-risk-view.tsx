import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Box, Typography } from "@mui/material";
import {
  Security as TrustBoundaryIcon,
  SwapHoriz as DataFlowIcon,
  SettingsInputComponent as InterfaceIcon,
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
import { formatElementId } from "../utils/risk-formatting";

interface InteractionRiskViewProps {
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

export const InteractionRiskView: React.FC<InteractionRiskViewProps> = ({
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

    const keys = [...tableKeys];
    if (interfaceRisks && interfaceRisks.length > 0) {
      keys.push("interfaces");
    }

    ensureTableKeys([...tableKeys, "interfaces"]);
  }, [risks.length, threats.length, ensureTableKeys]);

  const { groupedByTrustBoundary, interfaceRisks } = useRiskGrouping(
    risks,
    threats,
    false
  );

  const columns = useRiskColumns({
    configuration,
    onEdit,
    onPriorityChange,
    onStatusChange,
  });

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
      {groupedByTrustBoundary.map((group) => (
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
              {/* DataFlow Groups */}
              {group.dataFlows && group.dataFlows.length > 0 ? (
                group.dataFlows.map((dataFlow) => {
                  const flowKey = `${group.id}-${dataFlow.dataFlowId}`;

                  return (
                    <GenericAccordion
                      key={flowKey}
                      id={flowKey}
                      expanded={expandedElements[flowKey] ?? false}
                      onToggle={toggleElement}
                      level="inner"
                      title={
                        <InnerHeader
                          icon={<DataFlowIcon fontSize="small" color="action" />}
                          code={dataFlow.dataFlowId}
                          title={dataFlow.dataFlowName}
                          rightSlot={<ProgressChip risks={dataFlow.risks} />}
                        />
                      }
                    >
                      <RiskTable risks={dataFlow.risks} columns={columns} />
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

      {/* Interface Risks */}
      {interfaceRisks && interfaceRisks.length > 0 && (
        <GenericAccordion
          key="interfaces"
          id="interfaces"
          expanded={expandedTables["interfaces"] ?? true}
          onToggle={toggleTable}
          level="outer"
          headerBackgroundColor="warning.50"
          headerHoverColor="warning.100"
          sx={{
            mt: 0,
            mb: 1,
          }}
          title={
            <OuterHeader
              icon={<InterfaceIcon color="warning" />}
              code="IF"
              title={t("tabs.risks.physicalInterfaces", {
                defaultValue: "Physical Interfaces",
              })}
              rightSlot={
                <ProgressChip risks={interfaceRisks.flatMap((g) => g.risks)} />
              }

            />
          }
        >
          {expandedTables["interfaces"] && (
      <>
          {interfaceRisks.map((interfaceGroup) => {
            const groupKey = `interfaces-${interfaceGroup.id}`;

            return (
              <GenericAccordion
                key={groupKey}
                id={groupKey}
                expanded={expandedElements[groupKey] ?? false}
                onToggle={toggleElement}
                level="inner"
                title={
                  <InnerHeader
                    icon={<InterfaceIcon fontSize="small" color="action" />}
                    code={formatElementId(interfaceGroup.id)}
                    title={interfaceGroup.name}
                    rightSlot={<ProgressChip risks={interfaceGroup.risks} />}
                  />
                }
              >
                <RiskTable risks={interfaceGroup.risks} columns={columns} />
              </GenericAccordion>
            );
          })}
          </>
          )}
        </GenericAccordion>
      )}
    </>
  );
};

export default InteractionRiskView;