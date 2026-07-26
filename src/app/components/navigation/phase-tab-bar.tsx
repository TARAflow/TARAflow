import React, { useMemo } from "react";
import { Project } from "../../models/project-types";
import { PHASES, PhaseStatus, PhaseDefinition } from "shared";
import { PhaseTab } from "./phase-tab";
import { LanguageSwitcher } from "i18n";
import { PhaseId } from "../../models/phase-types";

// ==================== DEFAULT PHASE STATUS ====================

const DEFAULT_PHASE_STATUS: Record<number, PhaseStatus> = {
  0: "not-started",
  1: "not-started",
  2: "not-started",
  3: "not-started",
  4: "not-started",
  5: "not-started",
  6: "not-started",
  7: "not-started",
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
  // Safety gating: the Hazard phase only appears when safety relevance is on
  const safetyRelevant = project?.info?.safetyRelevant ?? false;

  // Phase labels, in PHASES' own order (already canonical — see
  // phase-types.ts PHASE_ORDER; sorting by workflow mode used to matter here
  // when Attack Tree's position depended on isHighImpact, it no longer does).
  // Audit is excluded here — it renders on the right, next to Integration,
  // unnumbered, same as Integration always has.
  const sortedPhases = useMemo(() => {
    const sorted = PHASES.filter(
      (phase) =>
        // Hide the Hazard phase unless safety analysis is enabled.
        (safetyRelevant || phase.id !== PhaseId.Hazard) &&
        phase.id !== PhaseId.Audit,
    );

    return sorted.map(
      (phase, index): PhaseDefinition & { displayLabel: string } => {
        if (phase.id === 0) {
          return { ...phase, displayLabel: phase.label };
        }
        return { ...phase, displayLabel: `${index} - ${phase.shortLabel}` };
      },
    );
  }, [safetyRelevant]);

  // Extract validation counts for each phase
  const getPhaseValidationCounts = useMemo(() => {
    return (phaseId: number) => {
      switch (phaseId) {
        case PhaseId.DFD: {
          // DFD Phase
          const validation = project?.dfd?.validation;
          return {
            errors: validation?.errors?.length ?? 0,
            warnings: validation?.warnings?.length ?? 0,
          };
        }
        case PhaseId.Assets:
          // Assets Phase
          return { errors: 0, warnings: 0 };
        case PhaseId.Threats:
          // Threats Phase
          return { errors: 0, warnings: 0 };
        case PhaseId.Risk:
          // Risk Phase
          return { errors: 0, warnings: 0 };
        case PhaseId.AttackTree:
          // Attack Tree Phase
          return { errors: 0, warnings: 0 };
        case PhaseId.Documentation:
          // Documentation Phase
          return { errors: 0, warnings: 0 };
        case PhaseId.Audit:
          // Audit Phase
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

        {/* Right Side: Audit + Integration + Language Switcher */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onPhaseChange(PhaseId.Audit)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              activePhase === PhaseId.Audit
                ? "bg-blue-50 text-blue-600 border border-blue-200"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            🔍 Audit
          </button>

          <button
            onClick={() => onPhaseChange(PhaseId.Integration)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              activePhase === PhaseId.Integration
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
}