// ==================== THREAT FINDINGS ====================
// The Threats tab's findings panel (manual test 2026-11-18): the phase's
// tooltip said "Not rated yet (18): FP-DF4-S-IN-1, …", but the tab itself
// showed nothing to click — the DFD, Assets and Risks tabs have a panel at
// the bottom whose rows open the object where a finding is fixed.
//
// One row per threat of the method shown, so a click opens exactly the
// threat whose information is missing or to check:
//   unrated    not rated yet — the Threats phase is in progress (warning)
//   uncertain  relevance uncertain — the risk tab asks to confirm (warning)
//   review     flagged after a change of the DFD or a component (6e)
//   noDescription  no threat description — mostly an analyst's manual threat
//   orphaned   its element or flow is no longer in the DFD (the sync's
//              orphaned threats) — keep it as manual or delete it
//   en50742Unjustified  dismissed ("not relevant") without a justification
//              although it sits on an EN 50742 relevant interface or flow —
//              the safety side needs the reason (0.20 patch 28; a warning,
//              the analyst's decision stays)
// In the dialog's order (by flow / element, STRIDE, id). A threat can have
// several reasons — a manual threat without a description and not rated —
// and then has a row for each, next to each other.

import type { Threat, ThreatTable } from "../../models/threat-types";
import { compareThreatsByLabel } from "./threat-table-utils";

export type ThreatFindingKind = "unrated" | "uncertain" | "review" | "noDescription" | "orphaned" | "en50742Unjustified";

/** The interface / flow a threat sits on (its EN 50742 anchor), if any. */
export function threatAnchorId(threat: Pick<Threat, "linkedElement" | "dataFlow">): string | undefined {
  return threat.linkedElement?.elementId ?? threat.dataFlow?.connectionId ?? undefined;
}

/** EN 50742 (patch 28): dismissing this threat needs a justification. */
export function dismissalNeedsJustification(
  threat: Pick<Threat, "linkedElement" | "dataFlow">,
  relevantAnchorIds: ReadonlySet<string> | undefined,
): boolean {
  const anchor = threatAnchorId(threat);
  return !!anchor && !!relevantAnchorIds?.has(anchor);
}

export interface ThreatFinding {
  id: string;
  kind: ThreatFindingKind;
  severity: "warning";
  /** The threat's display id, e.g. "FP-DF4-S-IN-1". */
  displayId: string;
  /** Its description, shortened. */
  description: string;
  /** Where a click opens the dialog. */
  tableIndex: number;
  threatId: string;
}

const KINDS: {
  kind: ThreatFindingKind;
  matches: (t: Threat, orphaned: ReadonlySet<string>, relevantAnchors: ReadonlySet<string> | undefined) => boolean;
}[] = [
  { kind: "orphaned", matches: (t, orphaned) => orphaned.has(t.id) },
  { kind: "noDescription", matches: (t) => !(t.threatDescription ?? "").trim() },
  { kind: "unrated", matches: (t) => !t.relevance || t.relevance === "unrated" },
  { kind: "uncertain", matches: (t) => t.relevance === "uncertain" },
  { kind: "review", matches: (t) => !!t.review },
  {
    kind: "en50742Unjustified",
    matches: (t, _o, relevantAnchors) =>
      t.relevance === "not_relevant" && !(t.evalNote ?? "").trim() && dismissalNeedsJustification(t, relevantAnchors),
  },
];

const MAX_DESCRIPTION = 80;
const shorten = (text: string) => (text.length > MAX_DESCRIPTION ? `${text.slice(0, MAX_DESCRIPTION - 1).trimEnd()}…` : text);

export function threatFindings(
  tables: readonly ThreatTable[],
  /** Threat ids whose element or flow is gone (ThreatSyncStatus.orphanedThreats.threatIds). */
  orphanedIds: readonly string[] = [],
  /** EN 50742 relevant interfaces and flows (app layer); absent = no EN 50742 project. */
  en50742RelevantAnchorIds?: ReadonlySet<string>,
): ThreatFinding[] {
  const orphaned = new Set(orphanedIds);
  const all = tables
    .flatMap((table, tableIndex) => table.threats.map((threat) => ({ threat, tableIndex })))
    .sort((a, b) => compareThreatsByLabel(a.threat, b.threat));
  const out: ThreatFinding[] = [];
  // threat by threat: the rows of one threat stand together
  for (const { threat, tableIndex } of all) {
    for (const { kind, matches } of KINDS) {
      if (!matches(threat, orphaned, en50742RelevantAnchorIds)) continue;
      out.push({
        id: `threat-${kind}-${threat.id}`,
        kind,
        severity: "warning",
        displayId: threat.displayId ?? threat.id,
        description: shorten((threat.threatDescription ?? "").trim()),
        tableIndex,
        threatId: threat.id,
      });
    }
  }
  return out;
}
