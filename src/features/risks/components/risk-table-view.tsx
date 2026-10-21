// ==================== RISK TABLE VIEW ====================
// Main router component that switches between element and interaction views
// based on the STRIDE method (per-element vs per-interaction).
//
// Phase 6: also renders attack-path risks (asset-anchored attack trees, 5a)
// in their own section below, independent of strideMethod — they belong to
// neither STRIDE bucket, so they'd otherwise never surface here at all.
//
// Leveled DFD (Phase 6b): with multiprocess groups the view is rendered once
// per group (RiskGroupSections); the filters are shown once above them.

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { MoSCoWPriority, RiskTreatment } from "../models/risk-scale-types";
import { Risk } from "../models/risk-assessment-types";
import { RiskConfiguration } from "../models/risk-config-types";
import type { DfdScopeFilter, DfdTableGroups, StrideMethod, ThreatReference } from "shared";
import { GenericAccordion, OuterHeader } from "shared";
import { AccountTree as AttackTreeSectionIcon } from "@mui/icons-material";
import { ElementRiskView } from "./element-risk-view";
import { InteractionRiskView } from "./interaction-risk-view";
import { RiskTable } from "./shared/risk-table";
import { useRiskColumns } from "./shared/risk-columns";
import { ProgressChip } from "./shared/progress-chip";
import { RiskFilters } from "./risk-filters";
import { RiskGroupSections } from "./risk-group-sections";

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
    /** Selected risk level (RiskScaleLevel.value, 1..N) or "" for all. */
    riskLevelFilter: number | "";
    /** Leveled DFD: page and analysis state (6f). */
    scope?: DfdScopeFilter;
  };
  onSearchTextChange: (text: string) => void;
  onPriorityFilterChange: (priority: MoSCoWPriority | "") => void;
  onRiskLevelFilterChange: (level: number | "") => void;
  onClearFilters: () => void;
  onScopeFilterChange?: (scope: DfdScopeFilter) => void;
  filteredCount: number;

  onEdit: (risk: Risk) => void;
  onPriorityChange: (
    riskId: string,
    priority: string,
    justification?: string,
  ) => void;
  onTreatmentChange: (riskId: string, treatment: string) => void;
  onImplementationClick?: (risk: Risk) => void;

  /**
   * Attack-path risks (asset-anchored attack trees, 5a). Optional: absent on
   * projects without attack trees. Rendered in their own section below the
   * STRIDE view — element/interaction grouping doesn't apply to them (no
   * trust boundary), so they don't go through ElementRiskView/InteractionRiskView.
   */
  attackPathRisks?: Risk[];
  attackPathThreats?: ThreatReference[];
  /** Leveled DFD: groups per top-level decomposed multiprocess (D20). */
  groups?: DfdTableGroups;
}

/** Own section for attack-path risks — flat table, no trust-boundary grouping. */
const AttackPathRiskSection: React.FC<{
  risks: Risk[];
  configuration: RiskConfiguration;
  onEdit: (risk: Risk) => void;
  onPriorityChange: RiskTableViewProps["onPriorityChange"];
  onTreatmentChange: RiskTableViewProps["onTreatmentChange"];
  onImplementationClick?: RiskTableViewProps["onImplementationClick"];
}> = ({
  risks,
  configuration,
  onEdit,
  onPriorityChange,
  onTreatmentChange,
  onImplementationClick,
}) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);

  const columns = useRiskColumns({
    configuration,
    onEdit,
    onPriorityChange,
    onTreatmentChange,
    onImplementationClick,
  });

  if (risks.length === 0) return null;

  return (
    <GenericAccordion
      id="attack-path-risks"
      expanded={expanded}
      onToggle={() => setExpanded((prev) => !prev)}
      level="outer"
      headerBackgroundColor="info.50"
      headerHoverColor="info.100"
      sx={{ mt: 2 }}
      title={
        <OuterHeader
          icon={<AttackTreeSectionIcon color="info" />}
          code="AT"
          title={t("tabs.risks.attackPathRisksTitle", {
            defaultValue: "Attack Tree Risks",
          })}
          rightSlot={<ProgressChip risks={risks} />}
        />
      }
    >
      {expanded && (
        <RiskTable
          risks={risks}
          columns={columns}
          configuration={configuration}
          onEdit={onEdit}
        />
      )}
    </GenericAccordion>
  );
};

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
    onRiskLevelFilterChange,
    onClearFilters,
    onScopeFilterChange,
    filteredCount,
    onEdit,
    onPriorityChange,
    onTreatmentChange,
    onImplementationClick,
    attackPathRisks = [],
    groups,
  }) => {
    const isPerElement = strideMethod === "per-element";

    const attackPathSection = (
      <AttackPathRiskSection
        risks={attackPathRisks}
        configuration={configuration}
        onEdit={onEdit}
        onPriorityChange={onPriorityChange}
        onTreatmentChange={onTreatmentChange}
        onImplementationClick={onImplementationClick}
      />
    );

    const View = isPerElement ? ElementRiskView : InteractionRiskView;
    const renderView = (viewRisks: Risk[], withFilters: boolean) => (
      <View
        risks={viewRisks}
        threats={threats}
        configuration={configuration}
        showFilters={withFilters && showFilters}
        filters={filters}
        onSearchTextChange={onSearchTextChange}
        onPriorityFilterChange={onPriorityFilterChange}
        onRiskLevelFilterChange={onRiskLevelFilterChange}
        onClearFilters={onClearFilters}
        filteredCount={filteredCount}
        onEdit={onEdit}
        onPriorityChange={onPriorityChange}
        onTreatmentChange={onTreatmentChange}
        onImplementationClick={onImplementationClick}
      />
    );

    if (!groups) {
      return (
        <>
          {renderView(risks, true)}
          {attackPathSection}
        </>
      );
    }

    return (
      <>
        <RiskFilters
          searchText={filters.searchText}
          priorityFilter={filters.priorityFilter}
          riskLevelFilter={filters.riskLevelFilter}
          scale={configuration.scale}
          onSearchTextChange={onSearchTextChange}
          onPriorityFilterChange={onPriorityFilterChange}
          onRiskLevelFilterChange={onRiskLevelFilterChange}
          onClear={onClearFilters}
          show={showFilters}
          scopeIndex={groups?.scope}
          scope={filters.scope}
          onScopeChange={onScopeFilterChange}
          filteredCount={filteredCount}
          totalCount={risks.length}
        />
        <RiskGroupSections
          groups={groups}
          risks={risks}
          threats={threats}
          configuration={configuration}
          renderView={(groupRisks) => renderView(groupRisks, false)}
        />
        {attackPathSection}
      </>
    );
  },
);

RiskTableView.displayName = "RiskTableView";
export default RiskTableView;