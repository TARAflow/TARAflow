// src/tests/component/mitigation-ticket-sync.test.tsx
//
// Issue-tracker adapters design IT-3: the mitigation status dialog works on
// the TicketPort the app passes in — a linked ticket is synced once when the
// dialog opens (no polling), the status stays editable with a linked ticket
// (verified / rejected by the analyst, §3.2), and linking a ticket to one
// custom mitigation does not touch the others (they have no id).
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "i18n/services/i18n";
import { RiskMitigationStatusDialog } from "features/risks/components/risk-mitigation-status-dialog";
import type { TicketPort, TicketState } from "shared/models/ticket-types";

vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: () => {} },
  useTranslation: () => ({
    t: (k: string, o?: { defaultValue?: string } & Record<string, unknown>) =>
      (o?.defaultValue ?? k).replace(/\{\{(\w+)\}\}/g, (_m, n: string) => String(o?.[n] ?? "")),
    i18n: { language: "en" },
  }),
}));

const port = (states: Record<string, TicketState["category"]>): TicketPort & { calls: string[][] } => {
  const calls: string[][] = [];
  return {
    calls,
    fetchTickets: vi.fn(async () => [
      { key: "SCRUM-5", summary: "Badge check", status: "To Do", ticketStatus: "OPEN" as const, issueType: "Task", url: "https://acme.atlassian.net/browse/SCRUM-5" },
    ]),
    createTicket: vi.fn(),
    fetchTicketStates: vi.fn(async (keys: readonly string[]) => {
      calls.push([...keys]);
      return new Map(keys.filter((k) => states[k]).map((k) => [k, { key: k, category: states[k], raw: states[k] }]));
    }),
    ticketUrl: (k: string) => `https://acme.atlassian.net/browse/${k}`,
  };
};

const risk = (selectedMitigations: unknown[]): any => ({
  id: "r1",
  threatId: "t1",
  threatDisplayId: "P1-S-1",
  threatDescription: "Spoofed operator",
  attackDescription: "",
  selectedMitigations,
  proposedMitigations: [],
});
const connection: any = { tool: "jira", status: "connected", projectName: "SCRUM" };

describe("mitigation status dialog on the ticket port", () => {
  it("syncs a linked ticket once on opening; the status stays editable", async () => {
    const p = port({ "SCRUM-1": "done" });
    const onSave = vi.fn();
    render(
      <RiskMitigationStatusDialog
        open
        risk={risk([{ id: "M-S-001", status: "in_progress", ticketId: "SCRUM-1", ticketStatus: "IN_PROGRESS" }])}
        integrationConnection={connection}
        ticketPort={p}
        issueTypes={[{ id: "1", name: "Task" }]}
        onSave={onSave}
        onClose={() => {}}
      />,
    );
    await waitFor(() => expect(p.calls).toEqual([["SCRUM-1"]]));
    expect(screen.getByTestId("status-follows-ticket").textContent).toContain("SCRUM-1");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave.mock.calls[0][1].selectedMitigations[0]).toMatchObject({ status: "implemented", ticketStatus: "CLOSED" });
  });

  it("linking a ticket to one custom mitigation leaves the other custom one alone", async () => {
    const p = port({ "SCRUM-5": "todo" });
    const onSave = vi.fn();
    render(
      <RiskMitigationStatusDialog
        open
        risk={risk([
          { notes: "Badge check at the panel", status: "open" },
          { notes: "Lock the cabinet", status: "open" },
        ])}
        integrationConnection={connection}
        ticketPort={p}
        issueTypes={[{ id: "1", name: "Task" }]}
        onSave={onSave}
        onClose={() => {}}
      />,
    );
    const tickets = await screen.findAllByText("SCRUM-5");
    fireEvent.click(tickets[0]);
    await waitFor(() => expect(p.calls.length).toBe(1));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    const [first, second] = onSave.mock.calls[0][1].selectedMitigations;
    expect(first).toMatchObject({ notes: "Badge check at the panel", ticketId: "SCRUM-5", ticketStatus: "OPEN", status: "open" });
    expect(second.ticketId).toBeUndefined();
  });
});
