// features/threats/services/sync-threats-with-graph.ts
import type { ThreatBundle, ThreatProjectData } from "../models/threat-types";
import type { DFDGraphReference } from "shared";
import { elementThreatSync } from "./per-element/element-sync";

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

  // ── Per-interaction: refresh the linkedElement display mirror ────────────
  if ((working.perInteractionTables?.length ?? 0) > 0) {
    working = {
      ...working,
      perInteractionTables: working.perInteractionTables?.map((table) => ({
        ...table,
        threats: table.threats.map((threat) => {
          if (!threat.linkedElement) return threat;
          const elem = graph.elementsById.get(threat.linkedElement.elementId);
          if (!elem) return threat;
          if (
            elem.displayId === threat.linkedElement.displayId &&
            elem.name === threat.linkedElement.elementName
          ) {
            return threat;
          }
          return {
            ...threat,
            linkedElement: {
              ...threat.linkedElement,
              displayId: elem.displayId,
              elementName: elem.name,
            },
          };
        }),
      })),
    };
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