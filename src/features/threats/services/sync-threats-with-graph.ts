// features/threats/services/sync-threats-with-graph.ts
import type { ThreatProjectData } from "../models/threat-types";
import type { DFDGraphReference } from "shared";
import { elementThreatSync } from "./per-element/element-sync";
// NOTE: align path with the per-element import above (per-interaction/ sibling).
import { interactionThreatSync } from "./per-interaction/interaction-sync";

type ThreatBundle = NonNullable<ThreatProjectData["threats"]>;

/**
 * Single entry point for reconciling threats with a DFD graph.
 *
 * Pure: graph + current threats in, consistent threats out. No project
 * state, no refs, no hooks — the caller is responsible for passing a fresh
 * graph and threats (freshness is a caller concern, not ours).
 *
 * The graph is the single source of truth; the DFD tab owns it. This
 * function is the only place that knows how each STRIDE method reacts to a
 * graph change.
 */
export function syncThreatsWithGraph(
  threats: ThreatBundle | null,
  graph: DFDGraphReference,
  assetDataRef?: ThreatProjectData["assetDataRef"],
): ThreatBundle | null {
  if (!threats || !graph) return threats;

  let working = threats;

  // ── Per-interaction: silently absorb reference drift (Class A) ───────────
  if ((working.perInteractionTables?.length ?? 0) > 0) {
    working = syncPerInteractionThreats(working, graph, assetDataRef);
  }

  // ── Per-element: structural re-sync (renumber / new / removed) ───────────
  if ((working.perElementTables?.length ?? 0) > 0) {
    working = syncPerElementThreats(working, graph, assetDataRef);
  }

  return working;
}

function syncPerElementThreats(
  threats: ThreatBundle,
  graph: DFDGraphReference,
  assetDataRef?: ThreatProjectData["assetDataRef"],
): ThreatBundle {
  const perElementTables = threats.perElementTables ?? [];

  const syncProject = {
    dfdGraph: graph,
    threats,
    assetDataRef,
  } as ThreatProjectData;

  const syncStatus = elementThreatSync.checkSyncStatus(
    syncProject,
    perElementTables,
  );

  // Class A only — silently absorb reference drift (rename / renumber / retype).
  // These have exactly one correct outcome and need no user decision, so we
  // apply them on every DFD save without a banner. Class B (missing / orphaned
  // threats: a change in the SET of threats) is intentionally NOT applied here
  // — it surfaces via the Threat tab's sync banner for an explicit decision,
  // since generating or removing threats is the user's call.
  if (syncStatus.changedReferences.elements.length === 0) return threats;

  const { tables, updated } = elementThreatSync.applyChangedReferences(
    perElementTables,
    syncStatus.changedReferences.elements,
  );
  if (updated === 0) return threats;

  return {
    ...threats,
    perElementTables: tables,
    lastModified: new Date().toISOString(),
  };
}

function syncPerInteractionThreats(
  threats: ThreatBundle,
  graph: DFDGraphReference,
  assetDataRef?: ThreatProjectData["assetDataRef"],
): ThreatBundle {
  const perInteractionTables = threats.perInteractionTables ?? [];

  const syncProject = {
    dfdGraph: graph,
    threats,
    assetDataRef,
  } as ThreatProjectData;

  const syncStatus = interactionThreatSync.checkSyncStatus(
    syncProject,
    perInteractionTables,
  );

  // Class A only — silently absorb reference drift: TB / interface / data-flow
  // rename, renumber, retype, plus endpoint (source/target) name changes. The
  // helper regenerates threat.id via generateThreatIdPerInteraction and
  // refreshes every mirror, but never adds or removes a threat. Missing /
  // orphaned interactions (Class B — the SET of threats changed) are NOT
  // applied here; they surface via the Threat tab's sync banner so the user
  // decides whether to generate or remove.
  const { tables, updated } = interactionThreatSync.applyChangedReferences(
    perInteractionTables,
    syncStatus,
    graph,
  );
  if (updated === 0) return threats;

  return {
    ...threats,
    perInteractionTables: tables,
    lastModified: new Date().toISOString(),
  };
}