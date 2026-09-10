// src/app/services/general-tab-update.ts
// ==================== GENERAL TAB UPDATE ====================
// Pure construction of the patch handed to updateProject when the
// General/Overview tab changes. Extracted from WorkspaceLayout's inline
// handleGeneralTabUpdate so the wiring is unit-testable WITHOUT rendering the
// whole workspace — in particular so "does a project-level SourceBinding
// actually survive the trip from the tab into the project patch" is pinned by
// a test. That exact seam silently dropped sourceBindings before (read side
// omitted it, write side omitted it, no compiler error, all leaf tests green),
// which is precisely the class of gap a pure, tested builder closes.
//
// Behaviour must stay identical to the previous inline handler:
//   edited = { ...current, info, settings, phaseStatus, sourceBindings }
//   run applyRegulationFromTags(edited, info.windowOfOpportunity)
//   patch = { id, info, settings, phaseStatus, sourceBindings, ...risks? }
// The conflict toast is a side effect and stays in the component.

import type { Project } from "app/models/project-types";
import type { GeneralTabData } from "features/overview";
import { applyRegulationFromTags } from "app/services/regulation-preset-orchestrator";

/** The shape updateProject expects: a partial project keyed by id. */
export type GeneralTabPatch = Partial<Project> & { id: string };

export function buildGeneralTabPatch(
  current: Project,
  data: GeneralTabData,
): GeneralTabPatch {
  const edited: Project = {
    ...current,
    info: data.info,
    settings: data.settings,
    phaseStatus: data.phaseStatus,
    sourceBindings: data.sourceBindings,
  };

  const { project } = applyRegulationFromTags(
    edited,
    edited.info.windowOfOpportunity,
  );

  return {
    id: current.id,
    info: project.info,
    settings: project.settings,
    phaseStatus: project.phaseStatus,
    // sourceBindings is not touched by applyRegulationFromTags, so take it
    // straight from the incoming tab data rather than relying on the
    // regulation pass to spread it through.
    sourceBindings: data.sourceBindings,
    ...(project.risks ? { risks: project.risks } : {}),
  };
}
