// ==================== ORPHAN DETECTION ====================
//
// Reference-integrity scan across the project: after a DFD rework or a threat
// re-generation, threat tables can still point at boundaries that no longer
// exist, and attack trees can still anchor to an asset/threat that is gone.
// These "orphans" cannot be reached in the UI, so they cannot be cleaned up by
// hand — hence a dedicated scan + a "Clean up orphaned" action on top of it.
//
// Pure and structural on purpose: it takes only the id sets and the minimal
// shapes it needs, so it is trivially testable and the app layer adapts the
// full Project into these inputs when wiring the UI.
//
// Scope (v1): orphaned threat TABLES (boundary gone) and orphaned attack TREES
// (anchor asset/threat gone). Orphaned RISKS are intentionally out of scope
// here: a risk may legitimately reference an attack-tree-emitted threat id
// (buildThreatId, e.g. "AT-…") that is NOT in any table, so a correct risk-orphan
// rule must also consider tree-emitted ids — a separate, more careful step.

export interface OrphanedThreatTable {
  displayIdentifier: string;
  trustBoundaryId: string;
  threatCount: number;
}

export interface OrphanedAttackTree {
  id: string;
  name: string;
  reason: "missing-asset" | "missing-threat";
}

export interface OrphanReport {
  threatTables: OrphanedThreatTable[];
  attackTrees: OrphanedAttackTree[];
}

export interface OrphanScanInput {
  threatTables: ReadonlyArray<{
    displayIdentifier: string;
    /** null/undefined → the table is not scoped to a boundary (e.g. DataFlow /
     * ExternalEntity tables) and is therefore never orphaned by the boundary
     * rule. */
    trustBoundaryId?: string | null;
    threats: ReadonlyArray<{ id: string }>;
  }>;
  attackTrees: ReadonlyArray<{
    id: string;
    name: string;
    anchor?: {
      type?: string;
      assetId?: string;
      threatId?: string;
    } | null;
  }>;
  /** Every id AND displayId currently present in the DFD (elements + boundaries). */
  dfdElementIds: ReadonlySet<string>;
  /** Ids of the assets currently present in the Asset tab. */
  assetIds: ReadonlySet<string>;
}

export function findOrphans(input: OrphanScanInput): OrphanReport {
  const tableThreatIds = new Set<string>();
  for (const table of input.threatTables) {
    for (const threat of table.threats) tableThreatIds.add(threat.id);
  }

  const threatTables: OrphanedThreatTable[] = [];
  for (const table of input.threatTables) {
    const bid = table.trustBoundaryId;
    // Orphaned only when the table IS scoped to a boundary that no longer
    // exists. A null/empty boundary means "not boundary-scoped" → never orphan.
    if (bid != null && bid !== "" && !input.dfdElementIds.has(bid)) {
      threatTables.push({
        displayIdentifier: table.displayIdentifier,
        trustBoundaryId: bid,
        threatCount: table.threats.length,
      });
    }
  }

  const attackTrees: OrphanedAttackTree[] = [];
  for (const tree of input.attackTrees) {
    const anchor = tree.anchor;
    if (!anchor) continue;
    if (anchor.type === "asset") {
      if (!anchor.assetId || !input.assetIds.has(anchor.assetId)) {
        attackTrees.push({ id: tree.id, name: tree.name, reason: "missing-asset" });
      }
    } else if (anchor.type === "threat") {
      if (!anchor.threatId || !tableThreatIds.has(anchor.threatId)) {
        attackTrees.push({ id: tree.id, name: tree.name, reason: "missing-threat" });
      }
    }
  }

  return { threatTables, attackTrees };
}

/** Total threats that would be removed if every orphaned table is deleted. */
export function totalOrphanedThreats(report: OrphanReport): number {
  return report.threatTables.reduce((sum, t) => sum + t.threatCount, 0);
}

export function hasOrphans(report: OrphanReport): boolean {
  return report.threatTables.length > 0 || report.attackTrees.length > 0;
}
