// ==================== REGULATION PRESET ORCHESTRATOR ====================
// App-layer glue: applies a regulation preset to a whole Project. `Project`
// holds `settings` and `risks` as siblings, so this is the one place that can
// both record the chosen preset (settings, the project-level source of truth)
// AND reconcile the risk factor configuration — without threading settings
// through the risks-tab / RiskUpdateResult contract (which is risk-scoped).
//
// App layer → features is allowed, so importing applyRegulationPreset and
// riskService here is fine (unlike importing them into shared).

import type { Project } from "../models/project-types";
import type { RegulationPresetId } from "shared";
import { applyRegulationPreset } from "features/risks/services/regulation-preset-service";
import { riskService } from "features/risks/services/risk-service";

export interface RegulationPresetProjectResult {
  project: Project;
  /** Managed factors kept ON because the analyst enabled them by hand. */
  conflicts: string[];
  /** True if the risk factor configuration actually changed. */
  changed: boolean;
}

/**
 * Record `presetId` on the project settings and reconcile the risk factor
 * configuration to match. Pure — returns a new Project, never mutates the
 * input. If the project has no risk data yet, only the setting is recorded;
 * factors are reconciled when risk data is first created / next applied.
 */
export function applyRegulationPresetToProject(
  project: Project,
  presetId: RegulationPresetId,
): RegulationPresetProjectResult {
  // Project-level source of truth — always recorded.
  const settings = { ...project.settings, regulationPreset: presetId };

  if (!project.risks) {
    return { project: { ...project, settings }, conflicts: [], changed: false };
  }

  const { activeFactors, conflicts, changed } = applyRegulationPreset(
    project.risks.configuration.activeFactors,
    presetId,
  );

  if (!changed) {
    // Setting still updated (e.g. first selection that matches defaults, or a
    // preset that manages no factors); factor config untouched.
    return { project: { ...project, settings }, conflicts, changed: false };
  }

  // Migrate ratings + recalc via the existing config-update path.
  const risks = riskService.updateConfiguration(project.risks, {
    ...project.risks.configuration,
    activeFactors,
  });

  return {
    project: { ...project, settings, risks },
    conflicts,
    changed: true,
  };
}
