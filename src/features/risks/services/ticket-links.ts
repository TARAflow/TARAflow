// ==================== TICKET LINKS ====================
// Which tickets the project's mitigations are linked to (adapters design
// IT-13, user 2026-11-10). The link dialog marks a ticket that is linked
// already instead of hiding it — one ticket often covers the same mitigation
// on many risks — and offers the tickets of the same mitigation first. From
// the project's own data: no tracker request.

import type { Risk } from "../models/risk-assessment-types";
import type { TicketStatus } from "shared/models/ticket-types";

export interface TicketLink {
  key: string;
  url?: string;
  ticketStatus?: TicketStatus;
  /** Catalog / project mitigation id; absent for a free-text mitigation. */
  mitigationId?: string;
  /** The mitigation as shown: its id, else its text. */
  mitigationLabel: string;
  riskId: string;
  riskDisplayId: string;
}

export function collectTicketLinks(risks: readonly Risk[]): TicketLink[] {
  return risks.flatMap((r) =>
    r.selectedMitigations
      .filter((m) => !!m.ticketId)
      .map((m) => ({
        key: m.ticketId!,
        ...(m.ticketUrl ? { url: m.ticketUrl } : {}),
        ...(m.ticketStatus ? { ticketStatus: m.ticketStatus } : {}),
        ...(m.id ? { mitigationId: m.id } : {}),
        mitigationLabel: m.id ?? m.notes ?? "",
        riskId: r.id,
        riskDisplayId: r.threatDisplayId,
      })),
  );
}

/** Tickets linked to the same mitigation on other risks — one per ticket, the suggestions. */
export function suggestedTickets(links: readonly TicketLink[], mitigationId: string | undefined, riskId: string): TicketLink[] {
  if (!mitigationId) return [];
  const seen = new Set<string>();
  return links.filter((l) => l.mitigationId === mitigationId && l.riskId !== riskId && !seen.has(l.key) && seen.add(l.key));
}

/** "M-T-001 · FP-DF1-T-OUT-1" and how many more links the ticket has. */
export function linkedWith(links: readonly TicketLink[], key: string): { first: string; more: number } | null {
  const of = links.filter((l) => l.key === key);
  if (of.length === 0) return null;
  return { first: `${of[0].mitigationLabel} · ${of[0].riskDisplayId}`, more: of.length - 1 };
}
