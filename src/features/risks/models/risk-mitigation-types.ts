// ==================== RISK MITIGATION TYPES ====================
// Mitigation lifecycle, selected mitigation, implementation progress.
//
// Dependencies:
//   shared               (MitigationPropertyRole)
//   risk-integration-types (TicketStatus)

import type { MitigationPropertyRole } from "shared";
import type { TicketStatus } from "./risk-integration-types";

// ==================== MITIGATION STATUS ====================

/**
 * Lifecycle state of a selected mitigation.
 *
 * State machine:
 *   open → in_progress → in_review → implemented → verified
 *                                              ↘ rejected (any time)
 */
export type MitigationStatus =
  | "open"
  | "in_progress"
  | "in_review"
  | "implemented"
  | "verified"
  | "rejected";

export interface MitigationStatusConfig {
  value: MitigationStatus;
  label: string;
  color: string;
  icon: string;
}

export const MITIGATION_STATUS_CONFIGS: MitigationStatusConfig[] = [
  { value: "open",        label: "Open",        color: "#9ca3af", icon: "⚪" },
  { value: "in_progress", label: "In Progress", color: "#3b82f6", icon: "🔵" },
  { value: "in_review",   label: "In Review",   color: "#8b5cf6", icon: "🟣" },
  { value: "implemented", label: "Implemented", color: "#22c55e", icon: "🟢" },
  { value: "verified",    label: "Verified",    color: "#16a34a", icon: "✅" },
  { value: "rejected",    label: "Rejected",    color: "#ef4444", icon: "🔴" },
];

// ==================== SELECTED MITIGATION ====================

export interface SelectedMitigation {
  /** Catalog ID (e.g. "M-S-001"). Undefined = custom analyst entry. */
  id?: string;

  /** Analyst-provided text for custom entries, or annotation for catalog entries. */
  notes?: string;

  /** Current lifecycle status. Default: "open". */
  status: MitigationStatus;

  /** Required when status = "rejected". IEC 62443-4-1 audit trail. */
  rejectionReason?: string;

  /** ISO timestamp when status last changed. */
  statusChangedAt?: string;

  /** External reference for evidence (offline mode). */
  evidenceRef?: string;

  /** Free-text evidence note. */
  evidenceNote?: string;

  // ── Jira / ADO Integration ────────────────────────────────────────────────

  /** Linked ticket key (e.g. "SCRUM-42") */
  ticketId?: string;

  /** Direct URL to ticket in Jira / ADO */
  ticketUrl?: string;

  /** Last known ticket status synced from Jira / ADO. */
  ticketStatus?: TicketStatus;

  /** ISO timestamp when ticket status was last synced */
  ticketSyncedAt?: string;

  // ─────────────────────────────────────────────────────────────────────────

  /** Scope override for per-interaction threats. */
  scopeOverride?: MitigationPropertyRole[];
}

// ==================== IMPLEMENTATION PROGRESS ====================

export type ImplementationProgress =
  | "not_started"
  | "open"
  | "in_progress"
  | "in_review"
  | "partial"
  | "implemented"
  | "verified"
  | "rejected";

/**
 * Derives aggregated implementation progress from a risk's mitigations.
 *
 * Ruleset (priority order):
 *   1. No mitigations                          → not_started
 *   2. All rejected                            → rejected
 *   3. All implemented or verified             → implemented
 *   4. Min. 1 verified, rest implemented/ok   → verified
 *   5. Min. 1 in_review                        → in_review
 *   6. Min. 1 in_progress                      → in_progress
 *   7. Min. 1 open (non-rejected)              → open (= not yet started)
 *
 * Pure function — call at render time, never store result.
 */
export function deriveImplementationProgress(
  selectedMitigations: SelectedMitigation[],
): ImplementationProgress {
  if (!selectedMitigations.length) return "not_started";

  const active = selectedMitigations.filter((m) => m.status !== "rejected");

  // Rule 2: all rejected
  if (active.length === 0) return "rejected";

  // Rule 3+4: all completed
  const allDone = active.every(
    (m) => m.status === "implemented" || m.status === "verified",
  );
  if (allDone) {
    // Rule 4: at least one verified → verified
    return active.some((m) => m.status === "verified")
      ? "verified"
      : "implemented";
  }

  // Rule 5: any in_review
  if (active.some((m) => m.status === "in_review")) return "in_review";

  // Rule 6: any in_progress (or partial: some implemented but not all)
  if (
    active.some((m) => m.status === "in_progress") ||
    active.some((m) => m.status === "implemented" || m.status === "verified")
  ) {
    return "in_progress";
  }

  // Rule 7: at least 1 open non-rejected → open
  return "open";
}

// ==================== MIGRATION HELPERS ====================

export function normalizeMitigationEntry(
  entry: string | SelectedMitigation,
): SelectedMitigation {
  if (typeof entry === "string") {
    return { id: entry, status: "open" };
  }
  return { ...entry };
}

export function normalizeMitigations(
  entries: (string | SelectedMitigation)[],
): SelectedMitigation[] {
  return entries.map(normalizeMitigationEntry);
}
// ==================== CUSTOM (NON-CATALOG) SELECTIONS ====================
// A SelectedMitigation with an `id` is a CATALOG mitigation (the id is an i18n
// / catalog key such as "M-I-003"); a custom analyst entry has NO id and keeps
// its text in `notes`. The Risk dialog used `m.id ?? m.notes` as a selection
// key and stored it as `id`, so selecting a custom proposed mitigation wrote
// its free text into `id`. Every consumer then treated the sentence as a
// catalog key (i18next "missingKey … <sentence>.mitigation", "M-…: text"
// labels, catalog/coverage lookups).

/** Stable UI/selection key that cannot confuse custom text with a catalog id. */
export function mitigationSelectionKey(entry: {
  id?: string;
  notes?: string;
}): string {
  return entry.id ? entry.id : `custom:${entry.notes ?? ""}`;
}

/** New selection for a proposed mitigation — custom entries stay id-less. */
export function toSelectedMitigation(entry: {
  id?: string;
  notes?: string;
}): SelectedMitigation {
  return entry.id
    ? { id: entry.id, status: "open" }
    : { notes: entry.notes ?? "", status: "open" };
}

/**
 * Repair selections written by the old Risk dialog: an entry whose `id` equals
 * the text of a CUSTOM proposed mitigation (no id) becomes `{ notes: text }`.
 * Precise by construction — only text that is a custom draft of this very risk
 * is moved; catalog ids are never touched. Returns the same array when clean.
 */
export function repairCustomMitigationSelections(
  selected: (string | SelectedMitigation)[] | undefined,
  proposed: { id?: string; notes?: string }[] | undefined,
): (string | SelectedMitigation)[] | undefined {
  if (!Array.isArray(selected) || !Array.isArray(proposed)) return selected;
  const customTexts = new Set(
    proposed.filter((p) => !p.id && p.notes).map((p) => p.notes as string),
  );
  if (customTexts.size === 0) return selected;

  let changed = false;
  const repaired = selected.map((entry) => {
    if (typeof entry === "string") {
      if (!customTexts.has(entry)) return entry;
      changed = true;
      return { notes: entry, status: "open" as MitigationStatus };
    }
    if (!entry.id || !customTexts.has(entry.id)) return entry;
    changed = true;
    const { id, ...rest } = entry;
    return { ...rest, notes: rest.notes || id };
  });
  return changed ? repaired : selected;
}
