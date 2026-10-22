// app/services/phase-status-commit.ts
//
// Phase statuses derived from the project data in the commit chain. Each
// feature sets its own status when its tab saves; two phases had no rule at
// all (General, Attack Tree) and the others went stale in a project that was
// written elsewhere (an example file: risks complete, status "not started").
//
//   every commit  General (required info), Attack Tree (trees and the
//                 attack-path risks) — both change with edits in other tabs
//   on load       additionally Assets (validated) and Risk (the validation
//                 the risk tab stores with its data)
//
// Reference-guarded: the same Project when no status changes.

import type { PhaseStatus, PhaseStatusMap } from "shared";
import { PHASE_STATUS_KEY } from "shared/models/common-types";
import type { Project } from "../models/project-types";
// Deep imports: the rules only — the barrels would load the tabs.
import { generalPhaseStatus } from "features/overview/services/general-completeness";
import { attackTreePhaseStatus } from "features/attacktree/services/attacktree-phase-status";
import {
  derivePhaseStatus as deriveAssetPhaseStatus,
  validateAssetData,
} from "features/assets/services/asset-validator";
import { buildAssetHazardLinks } from "../utils/build-asset-hazard-links";

function withStatuses(p: Project, statuses: Partial<Record<keyof PhaseStatusMap, PhaseStatus>>): Project {
  const current = p.phaseStatus;
  const changed = (Object.keys(statuses) as unknown as (keyof PhaseStatusMap)[]).some(
    (k) => current?.[k] !== statuses[k],
  );
  return changed ? { ...p, phaseStatus: { ...current, ...statuses } } : p;
}

/** General and Attack Tree — on every commit. */
export function commitPhaseStatus(p: Project): Project {
  return withStatuses(p, {
    [PHASE_STATUS_KEY.general]: generalPhaseStatus(p.info ?? {}),
    [PHASE_STATUS_KEY.attackTree]: attackTreePhaseStatus(p.attackTrees?.trees, p.risks?.risks),
  });
}

/** On load: also Assets and Risk from their validation (when they have data). */
export function commitLoadedPhaseStatus(p: Project): Project {
  const statuses: Partial<Record<keyof PhaseStatusMap, PhaseStatus>> = {};
  if (p.assets?.assets?.length) {
    const validation = validateAssetData(p.assets, buildAssetHazardLinks(p.hazards));
    statuses[PHASE_STATUS_KEY.assets] = deriveAssetPhaseStatus(validation);
  }
  const validation = p.risks?.validation;
  if (p.risks?.risks?.length && validation) {
    statuses[PHASE_STATUS_KEY.risk] = validation.isComplete
      ? "complete"
      : validation.errors.length > 0
        ? "incomplete"
        : "in-progress";
  }
  return commitPhaseStatus(withStatuses(p, statuses));
}
