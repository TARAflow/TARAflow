// tests/unit/features/risks/services/ticket-links.test.ts
//
// Adapters design IT-13: the project's ticket links — the link dialog marks
// linked tickets and suggests the tickets of the same mitigation.

import { describe, expect, it } from "vitest";
import { collectTicketLinks, linkedWith, suggestedTickets } from "features/risks/services/ticket-links";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const risk = (id: string, selectedMitigations: any[]): any => ({ id, threatDisplayId: `D-${id}`, selectedMitigations });
const RISKS = [
  risk("1", [{ id: "M-T-001", status: "open", ticketId: "SCRUM-1", ticketStatus: "OPEN" }, { id: "M-T-002", status: "open" }]),
  risk("2", [{ id: "M-T-001", status: "implemented", ticketId: "SCRUM-1" }, { notes: "Lock the cabinet", status: "open", ticketId: "SCRUM-2" }]),
  risk("3", [{ id: "M-T-001", status: "open", ticketId: "SCRUM-3" }]),
];

describe("ticket links (IT-13)", () => {
  it("every mitigation with a ticket, free-text ones by their text", () => {
    const links = collectTicketLinks(RISKS);
    expect(links.map((l) => [l.key, l.mitigationLabel, l.riskDisplayId])).toEqual([
      ["SCRUM-1", "M-T-001", "D-1"],
      ["SCRUM-1", "M-T-001", "D-2"],
      ["SCRUM-2", "Lock the cabinet", "D-2"],
      ["SCRUM-3", "M-T-001", "D-3"],
    ]);
    expect(links[2].mitigationId).toBeUndefined();
  });

  it("suggestions: the same mitigation on other risks, one per ticket; none for free text", () => {
    const links = collectTicketLinks(RISKS);
    expect(suggestedTickets(links, "M-T-001", "1").map((l) => l.key)).toEqual(["SCRUM-1", "SCRUM-3"]);
    expect(suggestedTickets(links, "M-T-001", "4").map((l) => l.key)).toEqual(["SCRUM-1", "SCRUM-3"]);
    expect(suggestedTickets(links, undefined, "4")).toEqual([]);
  });

  it("linked with: the first link and how many more", () => {
    const links = collectTicketLinks(RISKS);
    expect(linkedWith(links, "SCRUM-1")).toEqual({ first: "M-T-001 · D-1", more: 1 });
    expect(linkedWith(links, "SCRUM-9")).toBeNull();
  });
});
