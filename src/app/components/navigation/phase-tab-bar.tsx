import React, { useMemo } from "react";
import { Project } from "../../models/project-types";
import { PHASES, PhaseStatus, PhaseDefinition } from "shared";
import { PhaseTab } from "./phase-tab";
import { LanguageSwitcher } from "i18n";
import { getWorkflowMode, sortPhasesByWorkflow } from "features/overview";

// ==================== DEFAULT PHASE STATUS ====================

const DEFAULT_PHASE_STATUS: Record<number, PhaseStatus> = {
  0: "not-started",
  1: "not-started",
  2: "not-started",
  3: "not-started",
  4: "not-started",
  5: "not-started",
  6: "not-started",
};

// ==================== PHASE TABS CONTAINER ====================

interface PhaseTabsProps {
  project: Project;
  activePhase: number;
  onPhaseChange: (phaseId: number) => void;
}

export const PhaseTabs: React.FC<PhaseTabsProps> = ({
  project,
  activePhase,
  onPhaseChange,
}) => {
  const phaseStatus = project?.phaseStatus ?? DEFAULT_PHASE_STATUS;

  // Determine workflow mode based on isHighImpact
  const workflowMode = project?.info
    ? getWorkflowMode(project.info)
    : "standard";

  // Sort phases based on workflow mode and create display labels
  const sortedPhases = useMemo(() => {
    const sorted = sortPhasesByWorkflow(PHASES, workflowMode);

    return sorted.map(
      (phase, index): PhaseDefinition & { displayLabel: string } => {
        // Phase 0 (General) keeps its original label
        if (phase.id === 0) {
          return {
            ...phase,
            displayLabel: phase.label,
          };
        }

        // Other phases get numbered labels based on their position in the workflow
        return {
          ...phase,
          displayLabel: `${index} - ${phase.shortLabel}`,
        };
      }
    );
  }, [workflowMode]);

  // Extract validation counts for each phase
  const getPhaseValidationCounts = useMemo(() => {
    return (phaseId: number) => {
      switch (phaseId) {
        case 1: {
          // DFD Phase
          const validation = project?.dfd?.validation;
          return {
            errors: validation?.errors?.length ?? 0,
            warnings: validation?.warnings?.length ?? 0,
          };
        }
        case 2:
          // Assets Phase
          return { errors: 0, warnings: 0 };
        case 3:
          // Threats Phase
          return { errors: 0, warnings: 0 };
        case 4:
          // Risk Phase
          return { errors: 0, warnings: 0 };
        case 5:
          // Attack Tree Phase
          return { errors: 0, warnings: 0 };
        case 6:
          // Documentation Phase
          return { errors: 0, warnings: 0 };
        default:
          return { errors: 0, warnings: 0 };
      }
    };
  }, [project?.dfd?.validation]);

  return (
    <div className="bg-white border-b border-gray-200 px-6 pt-4">
      <div className="flex items-center justify-between">
        {/* Phase Tabs */}
        <div className="flex gap-1">
          {sortedPhases.map((phase) => {
            const status =
              phaseStatus[phase.id as keyof typeof phaseStatus] ??
              "not-started";
            const { errors, warnings } = getPhaseValidationCounts(phase.id);

            return (
              <PhaseTab
                key={phase.id}
                phaseId={phase.id}
                label={phase.displayLabel}
                status={status}
                isActive={activePhase === phase.id}
                onClick={() => onPhaseChange(phase.id)}
                errorCount={errors}
                warningCount={warnings}
              />
            );
          })}
        </div>

        {/* Right Side: Integration + Language Switcher */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onPhaseChange(7)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              activePhase === 7
                ? "bg-blue-50 text-blue-600 border border-blue-200"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            🔗 Integration
          </button>

          <LanguageSwitcher variant="dropdown" />
        </div>
      </div>
    </div>
  );
};