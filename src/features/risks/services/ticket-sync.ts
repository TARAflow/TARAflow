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

import { ticketStatusOf, type TicketState, type TicketStatus } from "shared/models/ticket-types";
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

const STATUS_OF_TICKET: Partial<Record<TicketStatus, MitigationStatus>> = {
  OPEN: "open",
  IN_PROGRESS: "in_progress",
  REVIEW: "in_review",
  CLOSED: "implemented",
  DECLINED: "rejected",
};

/** The mitigation status the ticket's last seen status stands for; none while unknown. */
export function statusFromTicket(ticketStatus: TicketStatus | undefined): MitigationStatus | undefined {
  return ticketStatus ? STATUS_OF_TICKET[ticketStatus] : undefined;
}

/**
 * With a linked ticket, the statuses the analyst can choose (adapters design
 * IT-14, user 2026-11-10): progress comes from the ticket — it is changed in
 * the tracker, TARAflow does not move tickets. Left to choose: the ticket's
 * own status (back to it), "verified" once the ticket is done (the TARA's
 * step after the fix, the ticket does not know it), "rejected" always (with
 * a reason), and the current status so the choice shows it.
 */
export function selectableWithTicket(m: Pick<SelectedMitigation, "status" | "ticketStatus">): ReadonlySet<MitigationStatus> {
  const fromTicket = statusFromTicket(m.ticketStatus);
  return new Set<MitigationStatus>([
    m.status,
    "rejected",
    ...(fromTicket ? [fromTicket] : []),
    ...(m.ticketStatus === "CLOSED" ? (["verified"] as const) : []),
  ]);
}

/** Set beside the ticket (verified, rejected, an older manual status): offer to follow the ticket again. */
export function differsFromTicket(m: Pick<SelectedMitigation, "status" | "ticketStatus">): boolean {
  const fromTicket = statusFromTicket(m.ticketStatus);
  return !!fromTicket && fromTicket !== m.status;
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
