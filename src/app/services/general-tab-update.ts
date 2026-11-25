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
//   patch = { id, info, settings, phaseStatus, sourceBindings,
//             ...itemDefinition?, ...risks? }
// The conflict toast is a side effect and stays in the component.

import type { Project } from "app/models/project-types";
import type { GeneralTabData } from "features/overview";
import { applyRegulationFromTags } from "app/services/regulation-preset-orchestrator";
import { EMPTY_PROJECT_TAGS, dfdBadgesShown, en50742ApproachFromTags } from "shared";

/**
 * What the stored DFD images show besides the diagram (0.20): the EL badges
 * (the setting, else the EN 50742 tag) and the safety-zone frame (EN 50742).
 */
function dfdMarks(project: Project): string {
  const en50742 = en50742ApproachFromTags(project.info?.tags ?? EMPTY_PROJECT_TAGS) !== undefined;
  return `${dfdBadgesShown(project.settings?.dfdBadges, en50742)}/${en50742}`;
}

/**
 * The DFD without its stored images, when the marks they show changed — the
 * badges are display only, so no diagram save follows a change of the
 * setting or the tag and the report kept the old image (manual test en-50742
 * 7.2, 2026-11-25). The DFD tab renders the missing images again.
 */
function dfdWithStaleImagesDropped(current: Project, next: Project): Pick<Project, "dfd"> | Record<string, never> {
  const dfd = current.dfd;
  if (!dfd || dfdMarks(current) === dfdMarks(next)) return {};
  const hasImage = !!dfd.thumbnail || (dfd.pages ?? []).some((p) => !!p.thumbnail);
  if (!hasImage) return {};
  const { thumbnail: _dropped, ...rest } = dfd;
  return {
    dfd: {
      ...rest,
      ...(dfd.pages ? { pages: dfd.pages.map(({ thumbnail: _t, ...page }) => page) } : {}),
    },
  };
}

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
    ...(data.itemDefinition ? { itemDefinition: data.itemDefinition } : {}),
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
    // Item Definition (Phase 1 stage A): only when the tab carries it, so a
    // caller without it never clears the stored one.
    ...(data.itemDefinition ? { itemDefinition: data.itemDefinition } : {}),
    ...(project.risks ? { risks: project.risks } : {}),
    ...dfdWithStaleImagesDropped(current, project),
  };
}
