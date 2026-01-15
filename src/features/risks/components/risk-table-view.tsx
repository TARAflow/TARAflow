// ==================== RISK TABLE VIEW ====================
// Main router component that switches between element and interaction views
// based on the STRIDE method (per-element vs per-interaction)

import React from "react";
import {
  Risk,
  RiskConfiguration,
  ThreatReference,
  MoSCoWPriority,
  RiskStatus,
} from "../models/risk-types";
import type { StrideMethod } from "shared";
import { ElementRiskView } from "./element-risk-view";
import { InteractionRiskView } from "./interaction-risk-view";

interface RiskTableViewProps {
  risks: Risk[];
  threats: ThreatReference[];
  configuration: RiskConfiguration;
  strideMethod: StrideMethod;

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

export const RiskTableView = React.memo<RiskTableViewProps>(
  ({
    risks,
    threats,
    configuration,
    strideMethod,
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
    const isPerElement = strideMethod === "per-element";

    // Route to appropriate view based on STRIDE method
    if (isPerElement) {
      return (
        <ElementRiskView
          risks={risks}
          threats={threats}
          configuration={configuration}
          showFilters={showFilters}
          filters={filters}
          onSearchTextChange={onSearchTextChange}
          onPriorityFilterChange={onPriorityFilterChange}
          onStatusFilterChange={onStatusFilterChange}
          onClearFilters={onClearFilters}
          filteredCount={filteredCount}
          onEdit={onEdit}
          onPriorityChange={onPriorityChange}
          onStatusChange={onStatusChange}
        />
      );
    }

    return (
      <InteractionRiskView
        risks={risks}
        threats={threats}
        configuration={configuration}
        showFilters={showFilters}
        filters={filters}
        onSearchTextChange={onSearchTextChange}
        onPriorityFilterChange={onPriorityFilterChange}
        onStatusFilterChange={onStatusFilterChange}
        onClearFilters={onClearFilters}
        filteredCount={filteredCount}
        onEdit={onEdit}
        onPriorityChange={onPriorityChange}
        onStatusChange={onStatusChange}
      />
    );
  }
);

RiskTableView.displayName = "RiskTableView";
export default RiskTableView;