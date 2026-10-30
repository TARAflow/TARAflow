// ==================== WHERE A PROJECT MITIGATION IS USED ====================
// Custom mitigation catalog design CM-2/§3: a project mitigation (M-C-nnn) may
// be deleted only while nothing uses it. It can be referenced by id in three
// features, so the check lives in the app layer:
//   threats       proposedMitigations[].id (both methods)
//   risks         selectedMitigations[].id, proposedMitigations[].id
//   attack trees  path assessments mitigationIds[], DSL lists "[M-001,M-C-001]" (read by the attacktree parser)

import type { Project } from "../models/project-types";
import { dslMitigationIds, replaceDslMitigation } from "features/attacktree";

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
        dslMitigationIds(tree.dsl ?? "").includes(id),
    )
    .map((tree) => tree.customTitle ?? tree.name ?? tree.id);
  return { threats: [...new Set(threats)], risks, attackTrees };
}

export const isProjectMitigationUsed = (u: ProjectMitigationUsage) =>
  u.threats.length + u.risks.length + u.attackTrees.length > 0;

// ==================== MERGE ====================

const swapIds = <T extends { id?: string }>(list: T[] | undefined, from: string, into: string): T[] | undefined => {
  if (!list || !list.some((x) => x.id === from)) return list;
  const hasInto = list.some((x) => x.id === into);
  return hasInto
    ? list.filter((x) => x.id !== from)
    : list.map((x) => (x.id === from ? { ...x, id: into } : x));
};

const swapStrings = (list: string[] | undefined, from: string, into: string) =>
  list && list.includes(from) ? [...new Set(list.map((x) => (x === from ? into : x)))] : list;

/**
 * Merge project mitigation `fromId` into `intoId` (design §3: merge rewrites
 * the ids in threats and risks — and attack trees, which reference them too).
 * A list holding both keeps `intoId` once. The entry `fromId` leaves the
 * project catalog. Pure; returns the three changed parts.
 */
export function mergeProjectMitigationRefs(
  project: Pick<Project, "threats" | "risks" | "attackTrees">,
  fromId: string,
  intoId: string,
): Pick<Project, "threats" | "risks" | "attackTrees"> {
  const threats = project.threats
    ? {
        ...project.threats,
        configuration: {
          ...project.threats.configuration,
          customMitigations: (project.threats.configuration.customMitigations ?? []).filter((m) => m.id !== fromId),
        },
        perElementTables: project.threats.perElementTables.map((t) => ({
          ...t,
          threats: t.threats.map((x) => ({ ...x, proposedMitigations: swapIds(x.proposedMitigations, fromId, intoId) ?? [] })),
        })),
        perInteractionTables: project.threats.perInteractionTables.map((t) => ({
          ...t,
          threats: t.threats.map((x) => ({ ...x, proposedMitigations: swapIds(x.proposedMitigations, fromId, intoId) ?? [] })),
        })),
      }
    : project.threats;
  const risks = project.risks
    ? {
        ...project.risks,
        risks: project.risks.risks.map((r) => ({
          ...r,
          selectedMitigations: swapIds(r.selectedMitigations, fromId, intoId) ?? [],
          ...(r.proposedMitigations ? { proposedMitigations: swapIds(r.proposedMitigations, fromId, intoId) } : {}),
        })),
      }
    : project.risks;
  const attackTrees = project.attackTrees
    ? {
        ...project.attackTrees,
        trees: project.attackTrees.trees.map((tree) => ({
          ...tree,
          dsl: replaceDslMitigation(tree.dsl ?? "", fromId, intoId),
          ...(tree.pathAssessments
            ? {
                pathAssessments: tree.pathAssessments.map((a) => ({
                  ...a,
                  ...(a.mitigationIds ? { mitigationIds: swapStrings(a.mitigationIds, fromId, intoId) } : {}),
                })),
              }
            : {}),
        })),
      }
    : project.attackTrees;
  return { threats, risks, attackTrees };
}
