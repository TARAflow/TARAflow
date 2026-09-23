// ==================== THREAT TABLE NORMALIZATION ====================
// Single Responsibility: bring persisted threat tables back to the shape the
// Threats tab renders — one table per trust-boundary grouping, each with a
// title — and keep manual threats consistent with the table they sit in.
//
// Why this exists
// ---------------
// Older builds could persist ELEMENT-keyed tables
// ({ elementId, elementDisplayId, elementName, threats }) holding manual
// threats. The current ThreatTable has no such fields, so these tables render
// as accordions without a title and share the React key "none-undefined".
// A regeneration never fixed them: reattachManualThreats matched them by
// (trustBoundaryId, displayIdentifier) = ("∅", undefined), found no fresh
// table and carried them over unchanged.
//
// Rules (pure, idempotent — safe on every load):
//   1. A table without a string displayIdentifier is dissolved. Each threat is
//      moved into the table of its own trust boundary (threat.trustBoundaryId);
//      if there is none, into a titled "carried over" table for that boundary
//      so nothing is lost silently.
//   2. A manual threat inside a trust-boundary table takes that table's
//      boundary fields — the table is what the analyst sees and what the
//      generated rows of the same element carry.
//   3. Manual label collisions are resolved (resolveManualSequenceCollisions).
//
// Returns the SAME array when nothing changes.

import type { Threat, ThreatTable } from "../models/threat-types";
import { resolveManualSequenceCollisions } from "./threat-sequence";

const UNASSIGNED_NAME = "Unassigned (carried over)";

function isGroupedTable(table: any): table is ThreatTable {
  return (
    !!table &&
    typeof table.displayIdentifier === "string" &&
    table.displayIdentifier.length > 0 &&
    Array.isArray(table.threats)
  );
}

function stripBrackets(displayIdentifier: string): string {
  return displayIdentifier.replace(/^\[|\]$/g, "");
}

/** Boundary fields a manual threat should carry inside `table`. */
function alignToTable(threat: Threat, table: ThreatTable): Threat {
  if (threat.source !== "manual" || !table.trustBoundaryId) return threat;
  const trustBoundaryDisplayId = stripBrackets(table.displayIdentifier);
  if (
    threat.trustBoundaryId === table.trustBoundaryId &&
    threat.trustBoundaryName === table.trustBoundaryName &&
    threat.trustBoundaryDisplayId === trustBoundaryDisplayId
  ) {
    return threat;
  }
  return {
    ...threat,
    trustBoundaryId: table.trustBoundaryId,
    trustBoundaryName: table.trustBoundaryName,
    trustBoundaryDisplayId,
  };
}

function carriedOverTable(threat: Threat): ThreatTable {
  const tbDisplay = threat.trustBoundaryDisplayId?.trim();
  return {
    trustBoundaryId: threat.trustBoundaryId ?? null,
    trustBoundaryName: threat.trustBoundaryName || UNASSIGNED_NAME,
    displayIdentifier: tbDisplay ? `[${tbDisplay}]` : "[Unassigned]",
    threats: [],
  };
}

export function normalizeThreatTables(
  tables: ThreatTable[] | undefined | null,
): ThreatTable[] {
  if (!Array.isArray(tables)) return [];

  const grouped = tables.filter(isGroupedTable);
  const legacy = tables.filter((t) => !isGroupedTable(t));

  // ── 1. Dissolve legacy / untitled tables ─────────────────────────────────
  let result: ThreatTable[] = grouped;
  if (legacy.length > 0) {
    result = grouped.map((t) => ({ ...t, threats: [...t.threats] }));
    const byBoundary = new Map<string, ThreatTable>();
    for (const t of result) {
      if (t.trustBoundaryId && !byBoundary.has(t.trustBoundaryId)) {
        byBoundary.set(t.trustBoundaryId, t);
      }
    }
    for (const table of legacy) {
      for (const threat of (table as any)?.threats ?? []) {
        const key = threat.trustBoundaryId ?? "";
        let target = key ? byBoundary.get(key) : undefined;
        if (!target) {
          const displayIdentifier = carriedOverTable(threat).displayIdentifier;
          target = result.find(
            (t) =>
              t.trustBoundaryId === (threat.trustBoundaryId ?? null) &&
              t.displayIdentifier === displayIdentifier,
          );
        }
        if (!target) {
          target = carriedOverTable(threat);
          result.push(target);
          if (key) byBoundary.set(key, target);
        }
        target.threats.push(threat);
      }
    }
  }

  // ── 2. Align manual threats with their table's boundary ──────────────────
  let aligned = false;
  const alignedTables = result.map((table) => {
    const threats = table.threats.map((t) => alignToTable(t, table));
    if (threats.every((t, i) => t === table.threats[i])) return table;
    aligned = true;
    return { ...table, threats };
  });
  if (aligned) result = alignedTables;

  // ── 3. Unique labels ─────────────────────────────────────────────────────
  result = resolveManualSequenceCollisions(result);

  return legacy.length === 0 && !aligned && result === grouped &&
    grouped.length === tables.length
    ? tables
    : result;
}
