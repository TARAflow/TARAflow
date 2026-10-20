// ==================== THREAT RECONCILIATION ====================
// Leveled DFD Phase 6e (leveled-dfd-multi-diagram-design.md §10): what a
// regeneration would do, shown before it is applied.
//
//   new        no stored threat with the same generator key → unrated
//   unchanged  same key, same references → kept
//   changed    same key, but the resolved endpoint of its flow, its trust
//              boundary or its catalog template changed → kept, flagged for
//              review (Threat.review), never silently confirmed
//   obsolete   stored threat without a generated counterpart → removed by
//              the regeneration; its risk becomes an orphan
//
// Generator key = the natural key of the merge (element or flow, STRIDE,
// direction for flow threats). Deliberately without the template id: a new
// template must not discard the analyst's rating — it is "changed
// (template)". Manual threats are the analyst's and take no part.
//
// Pure: runs the generator on a copy, nothing is written.

import type { DFDAnalysisContext } from "shared";
import type {
  StrideMethod,
  Threat,
  ThreatConfiguration,
  ThreatProjectData,
  ThreatReviewReason,
} from "../models/threat-types";
import { referenceChanges } from "./threat-identity";
import { generateFresh, keyFnFor, storedTables } from "./threat-generation-drift";

export interface ReconciledThreat {
  /** The stored threat (unchanged, changed, obsolete) or the fresh one (new). */
  threat: Threat;
  /** Changed only: what changed. */
  reasons?: ThreatReviewReason[];
}

export interface ThreatReconciliation {
  added: ReconciledThreat[];
  unchanged: ReconciledThreat[];
  changed: ReconciledThreat[];
  obsolete: ReconciledThreat[];
}

/** Compare stored generated threats with a fresh generation by generator key. */
export function reconcileThreats(
  stored: Threat[],
  fresh: Threat[],
  keyFn: (threat: Threat) => string | null,
): ThreatReconciliation {
  const out: ThreatReconciliation = { added: [], unchanged: [], changed: [], obsolete: [] };
  const storedByKey = new Map<string, Threat>();
  for (const threat of stored) {
    if (threat.source === "manual") continue;
    const key = keyFn(threat);
    if (key !== null) storedByKey.set(key, threat);
  }
  const freshKeys = new Set<string>();
  for (const threat of fresh) {
    const key = keyFn(threat);
    if (key === null) continue;
    freshKeys.add(key);
    const previous = storedByKey.get(key);
    if (!previous) {
      out.added.push({ threat });
      continue;
    }
    const reasons = referenceChanges(previous, threat);
    if (reasons.length > 0) out.changed.push({ threat: previous, reasons });
    else out.unchanged.push({ threat: previous });
  }
  for (const [key, threat] of storedByKey) {
    if (!freshKeys.has(key)) out.obsolete.push({ threat });
  }
  return out;
}

/** What regenerating the threats of `method` would do to the stored set. */
export function reconcileForProject(
  project: ThreatProjectData,
  dfdContext: DFDAnalysisContext,
  configuration: ThreatConfiguration,
  method: StrideMethod,
): ThreatReconciliation {
  const stored = storedTables(project, method).flatMap((t) => t.threats);
  const fresh = project.dfdGraph
    ? generateFresh(project, dfdContext, configuration, method).flatMap((t) => t.threats)
    : [];
  return reconcileThreats(stored, fresh, keyFnFor(method));
}
