// features/threats/services/per-element/apply-dfd-change-sync.ts
import type {
  ThreatBundle,
  ThreatProjectData,
} from "../../models/threat-types";
import type { DFDGraphReference, DFDAnalysisContext } from "shared";
import { elementThreatSync } from "./element-sync";

/**
 * Re-sync per-element threats against a freshly built DFD graph.
 *
 * Called on every DFD change so renumbering, new elements and removed
 * elements are reflected in the Threat tab without a manual sync.
 *
 * removeOrphaned is intentionally false: a DFD edit must never silently
 * delete threats (manual ones included). Orphans still surface via the
 * Threat tab's sync status for explicit removal.
 *
 * Only the per-element tables from the sync result are authoritative here —
 * synchronizeThreats returns a hardcoded configuration and echoes
 * perInteractionTables, so we keep everything else the caller owns.
 */
export function syncPerElementThreatsForGraph(
  threats: ThreatBundle,
  graph: DFDGraphReference,
  dfdContext: DFDAnalysisContext,
  assetDataRef?: ThreatProjectData["assetDataRef"],
): ThreatBundle {
  if (!graph) return threats;

  const perElementTables = threats.perElementTables ?? [];

  // Minimal ThreatProjectData the per-element service reads from.
  const syncProject = {
    dfdGraph: graph,
    threats,
    assetDataRef,
  } as ThreatProjectData;

  const syncStatus = elementThreatSync.checkSyncStatus(
    syncProject,
    perElementTables,
  );
  if (syncStatus.inSync) return threats;

  const result = elementThreatSync.synchronizeThreats(
    syncProject,
    dfdContext,
    perElementTables,
    syncStatus,
    { updateReferences: true, removeOrphaned: false },
  );
  if (!result.success || !result.threatData) return threats;

  // Merge: swap in only the updated per-element tables; preserve config,
  // perInteractionTables and any other caller-owned fields.
  return {
    ...threats,
    perElementTables: result.threatData.perElementTables,
    lastModified: new Date().toISOString(),
  };
}