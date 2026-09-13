// App-layer glue for the orphan scan: adapts a Project into the structural
// OrphanScanInput, and computes the threat tables / attack trees that REMAIN
// after removing every orphan. The pure detection lives in find-orphans.ts;
// this file is where the Project type is touched.

import type { Project } from "app/models/project-types";
import type { ThreatTable } from "features/threats/models/threat-types";
import type { AttackTree } from "features/attacktree/models/attacktree-types";
import {
  findOrphans,
  type OrphanReport,
  type OrphanScanInput,
} from "app/services/find-orphans";

/** Adapt a Project into the structural input the orphan scan needs. */
export function buildOrphanScanInput(project: Project): OrphanScanInput {
  const dfdElementIds = new Set<string>();
  for (const el of project.dfd?.elements ?? []) {
    if (el.id) dfdElementIds.add(el.id);
    if (el.displayId) dfdElementIds.add(el.displayId);
  }
  for (const conn of project.dfd?.connections ?? []) {
    if (conn.id) dfdElementIds.add(conn.id);
    if (conn.displayId) dfdElementIds.add(conn.displayId);
  }

  const assetIds = new Set((project.assets?.assets ?? []).map((a) => a.id));

  const threatTables = [
    ...(project.threats?.perElementTables ?? []),
    ...(project.threats?.perInteractionTables ?? []),
  ].map((t) => ({
    displayIdentifier: t.displayIdentifier,
    trustBoundaryId: t.trustBoundaryId,
    threats: t.threats,
  }));

  const attackTrees = (project.attackTrees?.trees ?? []).map((tree) => ({
    id: tree.id,
    name: tree.name,
    anchor: tree.anchor,
  }));

  return { dfdElementIds, assetIds, threatTables, attackTrees };
}

/** Scan a whole project for orphans in one call. */
export function scanProjectForOrphans(project: Project): OrphanReport {
  return findOrphans(buildOrphanScanInput(project));
}

export interface OrphanRemovalResult {
  perElementTables: ThreatTable[];
  perInteractionTables: ThreatTable[];
  trees: AttackTree[];
}

/**
 * The threat tables and attack trees that REMAIN after removing every orphan in
 * `report`. Pure — returns new arrays; the caller writes them back into
 * project.threats / project.attackTrees. Orphaned tables are dropped by their
 * (now-missing) boundary id, orphaned trees by id. Tables not scoped to a
 * boundary are always kept.
 */
export function removeOrphans(
  project: Project,
  report: OrphanReport,
): OrphanRemovalResult {
  const orphanBoundaryIds = new Set(
    report.threatTables
      .map((t) => t.trustBoundaryId)
      .filter((id): id is string => id != null),
  );
  const orphanTreeIds = new Set(report.attackTrees.map((t) => t.id));

  const keepTable = (t: ThreatTable): boolean =>
    t.trustBoundaryId == null || !orphanBoundaryIds.has(t.trustBoundaryId);

  return {
    perElementTables: (project.threats?.perElementTables ?? []).filter(
      keepTable,
    ),
    perInteractionTables: (project.threats?.perInteractionTables ?? []).filter(
      keepTable,
    ),
    trees: (project.attackTrees?.trees ?? []).filter(
      (tree) => !orphanTreeIds.has(tree.id),
    ),
  };
}
