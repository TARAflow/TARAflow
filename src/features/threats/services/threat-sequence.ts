// ==================== THREAT SEQUENCE NUMBERS ====================
// Single Responsibility: allocate and repair the trailing sequence number of a
// threat display label.
//
// Every threat label format ends in "-<sequenceNumber>":
//   per-element     P1-S-1
//   interface       TB1-IF-USB1-T-1
//   per-interaction TB1-DF3-T-IN-1
// The part before it (the "stem") is the collision domain: two threats with
// the same stem and the same number carry the same label. The sync passes
// rebuild labels as stem + threat.sequenceNumber, so the persisted
// sequenceNumber — not the label — is what survives a renumber.
//
// Identity is threat.id (UUID) and is never touched here; this module only
// keeps the HUMAN label unique.

import type { Threat, ThreatTable } from "../models/threat-types";

const TRAILING_SEQ = /-(\d+)$/;

/** Label without its trailing "-<n>" (the whole label if there is none). */
export function labelStem(displayId: string): string {
  return displayId.replace(TRAILING_SEQ, "");
}

/** Trailing sequence number of a label, or null if it has none. */
export function labelSeq(displayId: string): number | null {
  const match = TRAILING_SEQ.exec(displayId);
  return match ? Number(match[1]) : null;
}

function taken(threat: Threat): number {
  return Math.max(
    labelSeq(threat.displayId ?? "") ?? 0,
    Number.isFinite(threat.sequenceNumber) ? threat.sequenceNumber : 0,
  );
}

/**
 * Next free number for `stem`: max(label number, sequenceNumber) over ALL
 * threats sharing the stem, plus one. max+1 rather than count+1, so a gap left
 * by a deleted threat is never re-issued onto a live label.
 */
export function nextSequenceNumber(threats: Threat[], stem: string): number {
  let max = 0;
  for (const t of threats) {
    if (labelStem(t.displayId ?? "") === stem) max = Math.max(max, taken(t));
  }
  return max + 1;
}

/** Set sequenceNumber and rewrite the label's trailing number to match. */
export function withSequenceNumber(threat: Threat, seq: number): Threat {
  return {
    ...threat,
    sequenceNumber: seq,
    displayId: `${labelStem(threat.displayId ?? "")}-${seq}`,
  };
}

/**
 * Make every label unique again after manual threats were merged back in.
 *
 * Generated threats own their numbers (the generator and the sync passes
 * derive them) and claim first. Each manual threat then:
 *   1. has its sequenceNumber aligned to the number in its label — legacy
 *      manual threats were persisted with sequenceNumber 1 regardless of the
 *      label the analyst saw, so the next relabel collapsed "-2" onto "-1";
 *   2. if its label is already claimed, moves to the next free number of its
 *      stem.
 *
 * Returns the SAME table objects when nothing changes (no-op re-renders and
 * byte-stable saves).
 */
export function resolveManualSequenceCollisions(
  tables: ThreatTable[],
): ThreatTable[] {
  const all = tables.flatMap((t) => t.threats);
  const claimed = new Set<string>();
  for (const t of all) {
    if (t.source !== "manual" && t.displayId) claimed.add(t.displayId);
  }

  // Keyed by object identity, not id: a corrupted file may carry duplicate ids.
  const replaced = new Map<Threat, Threat>();
  const pool: Threat[] = all.filter((t) => t.source !== "manual");

  for (const threat of all) {
    if (threat.source !== "manual") continue;
    let next = threat;

    const fromLabel = labelSeq(threat.displayId ?? "");
    if (fromLabel !== null && fromLabel !== threat.sequenceNumber) {
      next = { ...next, sequenceNumber: fromLabel };
    }
    if (next.displayId && claimed.has(next.displayId)) {
      const seq = nextSequenceNumber(
        [...pool, ...all.filter((t) => t.source === "manual")],
        labelStem(next.displayId),
      );
      next = withSequenceNumber(next, seq);
    }

    if (next.displayId) claimed.add(next.displayId);
    pool.push(next);
    if (next !== threat) replaced.set(threat, next);
  }

  if (replaced.size === 0) return tables;
  return tables.map((table) =>
    table.threats.some((t) => replaced.has(t))
      ? {
          ...table,
          threats: table.threats.map((t) => replaced.get(t) ?? t),
        }
      : table,
  );
}
