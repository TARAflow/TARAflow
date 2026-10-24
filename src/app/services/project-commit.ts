// app/services/project-commit.ts
//
// The pure core of the project write channel. useProjectManager.updateProject
// and the open/load paths call these; integration tests drive them directly,
// so tests and the app run the same merge and the same commit chain.

import type { Project } from "../models/project-types";
import { buildDfdGraph } from "features/dfd";
import { commitAssetSync } from "../utils/commit-asset-sync";
import { buildAssetHazardLinks } from "../utils/build-asset-hazard-links";
import { commitHazardSafety } from "../utils/commit-hazard-safety";
import { commitCalcStamps } from "../utils/commit-calc-stamps";
import { commitLoadedPhaseStatus, commitPhaseStatus } from "./phase-status-commit";

// HazardItem safety chokepoint — runs right after commitAssetSync. Re-rates
// CAUSE assets (physicalImpact / aggregatedImpact) from the bowtie via the
// Safety Override. Reference-guarded: returns the same Project when no cause
// asset changes, so it is a cheap no-op on DFD-only edits.
export function commitProjectSafety(project: Project): Project {
  const summaries = buildAssetHazardLinks(project.hazards);
  const assets = commitHazardSafety(project.assets, summaries) ?? null;
  return assets === project.assets ? project : { ...project, assets };
}

/** Builds the DFD graph for a project that has elements but no graph yet. */
export function ensureProjectGraph(p: Project): Project {
  if (p.dfd?.graph || !p.dfd?.elements?.length) return p;
  try {
    const graph = buildDfdGraph(p.dfd);
    return { ...p, dfd: { ...p.dfd, graph } };
  } catch {
    return p;
  }
}

/**
 * Merges a partial patch onto the freshest project state and runs the commit
 * chain (asset sync, safety, then ISO calculation stamps + attack-tree date
 * churn fix against `p`). Every top-level field not in the patch is taken
 * from `p`.
 */
export function mergeProjectPatch(
  p: Project,
  patch: Partial<Project> & { id: string },
  now: string,
): Project {
  const merged: Project = {
    ...p,
    ...patch,
    info: { ...p.info, ...patch.info, lastModified: now },
    hasUnsavedChanges: true,
  };
  return commitPhaseStatus(
    commitCalcStamps(p, commitProjectSafety(commitAssetSync(p, merged))),
  );
}

/** Load-side commit: graph, asset mirror re-derived, safety, phase statuses. */
export function commitLoadedProject(p: Project): Project {
  return commitLoadedPhaseStatus(
    commitProjectSafety(commitAssetSync(undefined, ensureProjectGraph(p))),
  );
}
