import React, { useMemo } from "react";
import { Project } from "../../models/project-types";
import { PHASES, PhaseStatus, PhaseDefinition } from "shared";
import { PhaseTab } from "./phase-tab";
import { LanguageSwitcher } from "i18n";
import { PhaseId } from "../../models/phase-types";
import type { PhaseIndicators } from "../../utils/phase-indicators";

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
  8: "not-started",
  9: "not-started",
};

// ==================== PHASE TABS CONTAINER ====================

interface PhaseTabsProps {
  project: Project;
  activePhase: number;
  onPhaseChange: (phaseId: number) => void;
  /**
   * Stored threats that differ from what the current generation rules /
   * security goals would produce. Shown as a warning on the Threats tab so the
   * analyst notices it right after changing goals, without opening the tab.
   */
  threatDrift?: { obsolete: number; added: number };
  /**
   * Status and error / warning count per phase (app/utils/phase-indicators.ts;
   * the DFD's from its current validation). Without it: the stored status.
   */
  indicators?: PhaseIndicators;
}

export const PhaseTabs: React.FC<PhaseTabsProps> = ({
  project,
  activePhase,
  onPhaseChange,
  threatDrift,
  indicators,
}) => {
  const phaseStatus = indicators?.status ?? project?.phaseStatus ?? DEFAULT_PHASE_STATUS;
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

  // Badges on the tabs: the DFD's current validation and the threat
  // generation drift; the tooltip of every tab says what is behind its status
  // (phase indicators — the same lines the Overview's phase cards show).
  const getPhaseValidationCounts = (phaseId: number) => {
    const hints = indicators?.details[phaseId];
    if (phaseId === PhaseId.DFD || phaseId === PhaseId.Threats) {
      const fallback =
        phaseId === PhaseId.Threats
          ? { errors: 0, warnings: (threatDrift?.obsolete ?? 0) + (threatDrift?.added ?? 0) }
          : { errors: 0, warnings: 0 };
      return { ...(indicators?.counts[phaseId] ?? fallback), hints };
    }
    return { errors: 0, warnings: 0, hints };
  };

  return (
    <div className="bg-white border-b border-gray-200 px-6 pt-4">
      <div className="flex items-center justify-between">
        {/* Phase Tabs */}
        <div className="flex gap-1">
          {sortedPhases.map((phase) => {
            const status =
              phaseStatus[phase.id as keyof typeof phaseStatus] ??
              "not-started";
            const counts = getPhaseValidationCounts(phase.id);
            const { errors, warnings } = counts;
            const hints = counts.hints;

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
                warningHints={hints}
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