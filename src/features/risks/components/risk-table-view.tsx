// ==================== RISK TABLE VIEW ====================
// Main router component that switches between element and interaction views
// based on the STRIDE method (per-element vs per-interaction)

import React from "react";
import { MoSCoWPriority, RiskTreatment } from "../models/risk-scale-types";
import { Risk } from "../models/risk-assessment-types";
import { RiskConfiguration } from "../models/risk-config-types";
import type { StrideMethod, ThreatReference } from "shared";
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
    treatmentFilter: RiskTreatment | "";
  };
  onSearchTextChange: (text: string) => void;
  onPriorityFilterChange: (priority: MoSCoWPriority | "") => void;
  onClearFilters: () => void;
  filteredCount: number;

  onEdit: (risk: Risk) => void;
  onPriorityChange: (
    riskId: string,
    priority: string,
    justification?: string,
  ) => void;
  onTreatmentChange: (riskId: string, treatment: string) => void;
  onImplementationClick?: (risk: Risk) => void;
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
    onClearFilters,
    filteredCount,
    onEdit,
    onPriorityChange,
    onTreatmentChange,
    onImplementationClick,
  }) => {
    const isPerElement = strideMethod === "per-element";

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
          onClearFilters={onClearFilters}
          filteredCount={filteredCount}
          onEdit={onEdit}
          onPriorityChange={onPriorityChange}
          onTreatmentChange={onTreatmentChange}
          onImplementationClick={onImplementationClick}
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
        onClearFilters={onClearFilters}
        filteredCount={filteredCount}
        onEdit={onEdit}
        onPriorityChange={onPriorityChange}
        onTreatmentChange={onTreatmentChange}
        onImplementationClick={onImplementationClick}
      />
    );
  },
);

RiskTableView.displayName = "RiskTableView";
export default RiskTableView;