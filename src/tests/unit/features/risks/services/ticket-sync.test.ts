// tests/unit/features/risks/services/ticket-sync.test.ts
//
// Issue-tracker adapters design §3.2 (user 2026-10-29): the mitigation status
// mirrors its ticket in both directions (a reopen sets it back), but only a
// CHANGE of the ticket is applied — what the analyst set while the ticket
// stays the same is kept; "won't fix" → rejected with the ticket as reason.
// A sync that changes nothing returns the same objects (no file churn, §3.3).

import { describe, it, expect } from "vitest";
import {
  applyTicketState,
  hasRejectionReason,
  applyTicketStates,
  applyTicketStatesToRisks,
  linkedTicketKeys,
} from "features/risks/services/ticket-sync";
import type { TicketState } from "shared/models/ticket-types";
import type { SelectedMitigation } from "features/risks/models/risk-mitigation-types";

const NOW = "2026-10-29T12:00:00.000Z";
const st = (category: TicketState["category"], extra: Partial<TicketState> = {}): TicketState => ({
  key: "SCRUM-1",
  category,
  raw: category,
  ...extra,
});
const m = (over: Partial<SelectedMitigation> = {}): SelectedMitigation => ({
  id: "M-S-001",
  status: "open",
  ticketId: "SCRUM-1",
  ...over,
});

describe("applyTicketState", () => {
  it("a newly linked ticket is adopted", () => {
    expect(applyTicketState(m(), st("in_progress"), NOW)).toMatchObject({
      status: "in_progress",
      ticketStatus: "IN_PROGRESS",
      ticketSyncedAt: NOW,
      statusChangedAt: NOW,
    });
  });

  it("done → implemented; a reopen sets it back", () => {
    const done = applyTicketState(m({ ticketStatus: "IN_PROGRESS", status: "in_progress" }), st("done"), NOW);
    expect(done).toMatchObject({ status: "implemented", ticketStatus: "CLOSED" });
    const reopened = applyTicketState(done, st("in_progress"), NOW);
    expect(reopened).toMatchObject({ status: "in_progress", ticketStatus: "IN_PROGRESS" });
  });

  it("while the ticket stays the same, what the analyst set stays (verified, rejected)", () => {
    const verified = m({ ticketStatus: "CLOSED", status: "verified" });
    expect(applyTicketState(verified, st("done"), NOW)).toBe(verified);
    const rejected = m({ ticketStatus: "OPEN", status: "rejected", rejectionReason: "not needed" });
    expect(applyTicketState(rejected, st("todo"), NOW)).toBe(rejected);
  });

  it("won't fix → rejected with the ticket as the reason (data, no English text); review → in_review", () => {
    const rejected = applyTicketState(m({ ticketStatus: "IN_PROGRESS" }), st("done_without_fix", { raw: "Closed", resolution: "Won't Fix" }), NOW);
    expect(rejected).toMatchObject({
      status: "rejected",
      ticketStatus: "DECLINED",
      rejectedByTicket: { key: "SCRUM-1", resolution: "Won't Fix" },
    });
    expect(rejected.rejectionReason).toBeUndefined();
    expect(hasRejectionReason(rejected)).toBe(true);
    const reopened = applyTicketState(rejected, st("todo"), NOW);
    expect(reopened).toMatchObject({ status: "open" });
    expect(reopened.rejectedByTicket).toBeUndefined();
    expect(applyTicketState(m({ ticketStatus: "IN_PROGRESS" }), st("review"), NOW)).toMatchObject({ status: "in_review", ticketStatus: "REVIEW" });
  });

  it("no ticket or no state (unknown to the tracker): unchanged", () => {
    const noTicket = m({ ticketId: undefined });
    expect(applyTicketState(noTicket, st("done"), NOW)).toBe(noTicket);
    const linked = m({ ticketStatus: "OPEN" });
    expect(applyTicketState(linked, undefined, NOW)).toBe(linked);
  });
});

describe("over a risk and all risks", () => {
  const states = new Map([["SCRUM-1", st("done")]]);

  it("same array / same data when nothing changed — no churn", () => {
    const ms = [m({ ticketStatus: "CLOSED", status: "implemented" }), m({ id: undefined, notes: "x", ticketId: undefined })];
    expect(applyTicketStates(ms, states, NOW)).toBe(ms);
    const data = { risks: [{ selectedMitigations: ms }] };
    expect(applyTicketStatesToRisks(data, states, NOW, () => { throw new Error("no update expected"); })).toBe(data);
  });

  it("changed risks go through update (the same path as the dialog)", () => {
    const data = { risks: [{ id: "r1", selectedMitigations: [m({ ticketStatus: "OPEN" })] }, { id: "r2", selectedMitigations: [] }] };
    const updated: string[] = [];
    const next = applyTicketStatesToRisks(data, states, NOW, (d, r) => {
      updated.push((r as { id: string }).id);
      return { ...d, risks: d.risks.map((x) => ((x as { id: string }).id === (r as { id: string }).id ? r : x)) };
    });
    expect(updated).toEqual(["r1"]);
    expect(next.risks[0].selectedMitigations[0]).toMatchObject({ status: "implemented", ticketStatus: "CLOSED" });
  });

  it("linked ticket keys, each once", () => {
    expect(
      linkedTicketKeys([
        { selectedMitigations: [m(), m({ ticketId: "SCRUM-2" })] },
        { selectedMitigations: [m(), m({ ticketId: undefined })] },
      ]),
    ).toEqual(["SCRUM-1", "SCRUM-2"]);
  });
});
