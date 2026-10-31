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

// A list holding both entries keeps one — nothing may get lost on the way
// (review 2026-10-30): the kept entry takes over what only the dropped one
// has (a ticket, evidence, a rejection reason), free-text notes are joined.
// Fields that would contradict each other are a conflict; the merge is then
// refused (mergeProjectMitigationConflicts) instead of picking a side.

/** Fields that must agree when both entries carry them. */
const CONFLICT_FIELDS = ["status", "ticketId", "evidenceRef", "rejectionReason", "scopeOverride"] as const;
/** Fields that travel with the ticket. */
const TICKET_FIELDS = ["ticketId", "ticketUrl", "ticketStatus", "ticketSyncedAt", "rejectedByTicket"] as const;
/** Free text: both kept. */
const JOINED_FIELDS = ["notes", "evidenceNote"] as const;

type Entry = Record<string, unknown>;
const present = (v: unknown) => v !== undefined && v !== null && v !== "";
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function entriesConflict(into: Entry, from: Entry): boolean {
  return CONFLICT_FIELDS.some((k) => {
    // status always counts (it defaults to "open"); the others only when both have them
    if (k === "status") return present(into.status) && present(from.status) && into.status !== from.status;
    return present(into[k]) && present(from[k]) && !same(into[k], from[k]);
  });
}

function mergeEntries<T extends { id?: string }>(into: T, from: T): T {
  const a = into as unknown as Entry;
  const b = from as unknown as Entry;
  const out: Entry = { ...b, ...Object.fromEntries(Object.entries(a).filter(([, v]) => present(v))), id: a.id };
  if (!present(a.ticketId) && present(b.ticketId)) for (const k of TICKET_FIELDS) out[k] = b[k];
  for (const k of JOINED_FIELDS) {
    if (present(a[k]) && present(b[k]) && a[k] !== b[k]) out[k] = `${a[k]}\n${b[k]}`;
  }
  if (typeof a.statusChangedAt === "string" && typeof b.statusChangedAt === "string") {
    out.statusChangedAt = a.statusChangedAt > b.statusChangedAt ? a.statusChangedAt : b.statusChangedAt;
  }
  if (typeof a.alreadyImplemented === "boolean" || typeof b.alreadyImplemented === "boolean") {
    out.alreadyImplemented = a.alreadyImplemented === true || b.alreadyImplemented === true;
  }
  return out as unknown as T;
}

const swapIds = <T extends { id?: string }>(list: T[] | undefined, from: string, into: string): T[] | undefined => {
  if (!list || !list.some((x) => x.id === from)) return list;
  const dropped = list.find((x) => x.id === from)!;
  const hasInto = list.some((x) => x.id === into);
  return hasInto
    ? list.filter((x) => x.id !== from).map((x) => (x.id === into ? mergeEntries(x, dropped) : x))
    : list.map((x) => (x.id === from ? { ...x, id: into } : x));
};

/**
 * Risks (display ids) where merging `fromId` into `intoId` would have to drop
 * contradicting data — different status, two tickets, two evidence refs, two
 * rejection reasons or scope overrides. Empty = the merge loses nothing.
 */
export function mergeProjectMitigationConflicts(
  project: Pick<Project, "risks">,
  fromId: string,
  intoId: string,
): string[] {
  return (project.risks?.risks ?? [])
    .filter((r) => {
      const lists = [r.selectedMitigations, r.proposedMitigations] as (Entry[] | undefined)[];
      return lists.some((list) => {
        const into = list?.find((x) => x.id === intoId);
        const from = list?.find((x) => x.id === fromId);
        return !!into && !!from && entriesConflict(into, from);
      });
    })
    .map((r) => r.threatDisplayId ?? r.id);
}

const swapStrings = (list: string[] | undefined, from: string, into: string) =>
  list && list.includes(from) ? [...new Set(list.map((x) => (x === from ? into : x)))] : list;

/**
 * Merge project mitigation `fromId` into `intoId` (design §3: merge rewrites
 * the ids in threats and risks — and attack trees, which reference them too).
 * A list holding both keeps `intoId` once, merged with the dropped entry
 * (see above; callers refuse a merge with conflicts first). The entry
 * `fromId` leaves the project catalog. Pure; returns the three changed parts.
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
