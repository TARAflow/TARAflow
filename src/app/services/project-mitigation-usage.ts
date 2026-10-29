// ==================== WHERE A PROJECT MITIGATION IS USED ====================
// Custom mitigation catalog design CM-2/§3: a project mitigation (M-C-nnn) may
// be deleted only while nothing uses it. It can be referenced by id in three
// features, so the check lives in the app layer:
//   threats       proposedMitigations[].id (both methods)
//   risks         selectedMitigations[].id, proposedMitigations[].id
//   attack trees  path assessments mitigationIds[], DSL refs "[M-C-001]"

import type { Project } from "../models/project-types";

export interface ProjectMitigationUsage {
  /** Threat display ids */
  threats: string[];
  /** Risk display ids (threatDisplayId) */
  risks: string[];
  /** Attack tree titles */
  attackTrees: string[];
}

type WithIds = { id?: string }[] | undefined;
const has = (list: WithIds, id: string) => (list ?? []).some((x) => x.id === id);

export function projectMitigationUsage(
  project: Pick<Project, "threats" | "risks" | "attackTrees">,
  id: string,
): ProjectMitigationUsage {
  const tables = [
    ...(project.threats?.perElementTables ?? []),
    ...(project.threats?.perInteractionTables ?? []),
  ];
  const threats = tables
    .flatMap((t) => t.threats)
    .filter((t) => has(t.proposedMitigations, id))
    .map((t) => t.displayId);
  const risks = (project.risks?.risks ?? [])
    .filter((r) => has(r.selectedMitigations, id) || has(r.proposedMitigations, id))
    .map((r) => r.threatDisplayId ?? r.id);
  const attackTrees = (project.attackTrees?.trees ?? [])
    .filter(
      (tree) =>
        (tree.pathAssessments ?? []).some((a) => (a.mitigationIds ?? []).includes(id)) ||
        (tree.dsl ?? "").includes(`[${id}]`),
    )
    .map((tree) => tree.customTitle ?? tree.name ?? tree.id);
  return { threats: [...new Set(threats)], risks, attackTrees };
}

export const isProjectMitigationUsed = (u: ProjectMitigationUsage) =>
  u.threats.length + u.risks.length + u.attackTrees.length > 0;
