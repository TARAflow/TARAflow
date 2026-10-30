// ==================== TICKET → MITIGATION STATUS ====================
// Issue-tracker adapters design decision §3.2 (user 2026-10-29): the
// mitigation status mirrors its ticket — in both directions, a reopen sets it
// back — with two rules:
//   - only a CHANGE of the ticket is applied. The last seen ticket status
//     (ticketStatus) is kept; while the ticket stays the same, what the
//     analyst set (verified, rejected, …) stays.
//   - mapping: to do → open, in progress → in_progress, review → in_review,
//     done → implemented, done without fix (won't fix / declined / duplicate)
//     → rejected, with the ticket as the rationale (rejectedByTicket — data,
//     not an English sentence; dropped again when the ticket moves on).
// Tracker-independent: adapters deliver normalised TicketStates. Pure.

import { ticketStatusOf, type TicketState } from "shared/models/ticket-types";
import type { MitigationStatus, SelectedMitigation } from "../models/risk-mitigation-types";

const STATUS_OF: Record<TicketState["category"], MitigationStatus> = {
  todo: "open",
  in_progress: "in_progress",
  review: "in_review",
  done: "implemented",
  done_without_fix: "rejected",
};

/** The mitigation after its ticket's state; the same object when nothing changes. */
export function applyTicketState(
  mitigation: SelectedMitigation,
  state: TicketState | undefined,
  now: string,
): SelectedMitigation {
  if (!mitigation.ticketId || !state) return mitigation;
  const ticketStatus = ticketStatusOf(state.category);
  if (mitigation.ticketStatus === ticketStatus) return mitigation;
  const status = STATUS_OF[state.category];
  const { rejectedByTicket: _previous, ...rest } = mitigation;
  return {
    ...rest,
    ticketStatus,
    ticketSyncedAt: now,
    status,
    statusChangedAt: now,
    ...(status === "rejected"
      ? { rejectedByTicket: { key: state.key, resolution: state.resolution ?? state.raw } }
      : {}),
  };
}

/** Whether a rejected mitigation has its reason — written by the analyst or from the ticket. */
export function hasRejectionReason(m: Pick<SelectedMitigation, "rejectionReason" | "rejectedByTicket">): boolean {
  return !!m.rejectionReason?.trim() || !!m.rejectedByTicket;
}

/** All mitigations of a risk; the same array when nothing changes. */
export function applyTicketStates(
  mitigations: SelectedMitigation[],
  states: ReadonlyMap<string, TicketState>,
  now: string,
): SelectedMitigation[] {
  let changed = false;
  const next = mitigations.map((m) => {
    const after = applyTicketState(m, m.ticketId ? states.get(m.ticketId) : undefined, now);
    if (after !== m) changed = true;
    return after;
  });
  return changed ? next : mitigations;
}

/** Ticket keys linked anywhere in these risks. */
export function linkedTicketKeys(risks: readonly { selectedMitigations: SelectedMitigation[] }[]): string[] {
  return [...new Set(risks.flatMap((r) => r.selectedMitigations.flatMap((m) => (m.ticketId ? [m.ticketId] : []))))];
}

/**
 * The Risk tab's sync over all risks: changed risks go through `update`
 * (riskService.updateRisk — the same path as the status dialog). Returns the
 * input object when no ticket changed.
 */
export function applyTicketStatesToRisks<D extends { risks: { selectedMitigations: SelectedMitigation[] }[] }>(
  data: D,
  states: ReadonlyMap<string, TicketState>,
  now: string,
  update: (data: D, risk: D["risks"][number]) => D,
): D {
  let next = data;
  for (const risk of data.risks) {
    const mitigations = applyTicketStates(risk.selectedMitigations, states, now);
    if (mitigations !== risk.selectedMitigations) next = update(next, { ...risk, selectedMitigations: mitigations });
  }
  return next;
}
