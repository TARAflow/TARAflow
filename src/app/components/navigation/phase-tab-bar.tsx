import React, { useMemo } from "react";
import { Project } from "../../models/project-types";
import { PHASES, PhaseStatus } from "shared";
import { PhaseTab } from "./phase-tab";
import { LanguageSwitcher } from "i18n";

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
  // Fallback to default if phaseStatus is undefined
  const phaseStatus = project?.phaseStatus ?? DEFAULT_PHASE_STATUS;

  // Extract validation counts for DFD phase (phase 1)
  const dfdValidationCounts = useMemo(() => {
    const validation = project?.dfd?.validation;
    if (!validation) {
      return { errors: 0, warnings: 0 };
    }
    return {
      errors: validation.errors?.length ?? 0,
      warnings: validation.warnings?.length ?? 0,
    };
  }, [project?.dfd?.validation]);

  // Get error/warning counts for a specific phase
  const getPhaseValidationCounts = (phaseId: number) => {
    switch (phaseId) {
      case 1: // DFD Phase
        return dfdValidationCounts;
      case 2: // Assets Phase - TODO: Add asset validation
        return { errors: 0, warnings: 0 };
      case 3: // Threats Phase - TODO: Add threat validation
        return { errors: 0, warnings: 0 };
      case 4: // Risk Phase - TODO: Add risk validation
        return { errors: 0, warnings: 0 };
      case 5: // Attack Tree Phase - TODO: Add attack tree validation
        return { errors: 0, warnings: 0 };
      case 6: // Documentation Phase - TODO: Add doc validation
        return { errors: 0, warnings: 0 };
      default:
        return { errors: 0, warnings: 0 };
    }
  };

  return (
    <div className="bg-white border-b border-gray-200 px-6 pt-4">
      <div className="flex items-center justify-between">
        {/* Phase Tabs - LINKS */}
        <div className="flex gap-1">
          {PHASES.map((phase) => {
            const status =
              phaseStatus[phase.id as keyof typeof phaseStatus] ??
              "not-started";
            const { errors, warnings } = getPhaseValidationCounts(phase.id);

            return (
              <PhaseTab
                key={phase.id}
                phaseId={phase.id}
                label={phase.label}
                status={status}
                isActive={activePhase === phase.id}
                onClick={() => onPhaseChange(phase.id)}
                errorCount={errors}
                warningCount={warnings}
              />
            );
          })}
        </div>

        {/* Language Switcher - RECHTS */}
        <LanguageSwitcher variant="dropdown" />
      </div>
    </div>
  );
};
