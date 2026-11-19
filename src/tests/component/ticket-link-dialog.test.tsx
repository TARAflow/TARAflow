// src/tests/component/ticket-link-dialog.test.tsx
//
// Adapters design IT-13 (user 2026-11-10): the link dialog asks the tracker
// with a status filter (open by default) and a search text, suggests the
// tickets of the same mitigation, marks linked tickets instead of hiding
// them, links only after "Link", and offers to create a ticket when nothing
// is found.
import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "i18n/services/i18n";
import { TicketLinkDialog } from "features/risks/components/ticket-link-dialog";
import type { TicketLink } from "features/risks/services/ticket-links";

vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: () => {} },
  useTranslation: () => ({
    t: (k: string, o?: { defaultValue?: string } & Record<string, unknown>) =>
      (o?.defaultValue ?? k).replace(/\{\{(\w+)\}\}/g, (_m, n: string) => String(o?.[n] ?? "")),
    i18n: { language: "en" },
  }),
}));

const ticket = (key: string, ticketStatus: string, summary = key) => ({ key, summary, status: ticketStatus, ticketStatus, issueType: "Task", url: `https://acme/${key}` });
const port = (tickets: ReturnType<typeof ticket>[]) => ({
  fetchTickets: vi.fn(async () => tickets),
  createTicket: vi.fn(),
  fetchTicketStates: vi.fn(async () => new Map()),
  ticketUrl: (k: string) => `https://acme/${k}`,
});
const LINKS: TicketLink[] = [
  { key: "SCRUM-7", mitigationId: "M-T-001", mitigationLabel: "M-T-001", riskId: "r2", riskDisplayId: "P1-T-1", ticketStatus: "OPEN" },
  { key: "SCRUM-2", mitigationId: "M-I-002", mitigationLabel: "M-I-002", riskId: "r3", riskDisplayId: "DF1-I-1" },
  { key: "SCRUM-2", mitigationId: "M-I-002", mitigationLabel: "M-I-002", riskId: "r4", riskDisplayId: "DF2-I-1" },
];
const renderDialog = (p: ReturnType<typeof port>, onLink = vi.fn(), onCreateInstead = vi.fn()) =>
  render(
    <TicketLinkDialog
      open
      label="M-T-001"
      mitigationId="M-T-001"
      riskId="r1"
      port={p as never}
      projectKey="SCRUM"
      issueTypes={[{ id: "1", name: "Task" }]}
      links={LINKS}
      onLink={onLink}
      onCreateInstead={onCreateInstead}
      onClose={() => {}}
    />,
  );

describe("ticket link dialog (IT-13)", () => {
  it("asks for not-done tickets by default and shows only the open ones; done on request", async () => {
    const p = port([ticket("SCRUM-1", "OPEN"), ticket("SCRUM-3", "IN_PROGRESS")]);
    renderDialog(p);
    await screen.findByTestId("ticket-SCRUM-1");
    expect(p.fetchTickets).toHaveBeenLastCalledWith("SCRUM", "__all__", { scope: "active" });
    expect(screen.queryByTestId("ticket-SCRUM-3")).toBeNull();
    fireEvent.mouseDown(within(screen.getByTestId("ticket-link-dialog")).getAllByRole("combobox")[0]);
    fireEvent.click(await screen.findByRole("option", { name: "Done" }));
    await waitFor(() => expect(p.fetchTickets).toHaveBeenLastCalledWith("SCRUM", "__all__", { scope: "done" }));
  });

  it("the search text goes to the tracker", async () => {
    const p = port([]);
    renderDialog(p);
    fireEvent.change(screen.getByTestId("ticket-link-search"), { target: { value: " SCRUM-12 " } });
    await waitFor(() => expect(p.fetchTickets).toHaveBeenLastCalledWith("SCRUM", "__all__", { scope: "active", text: "SCRUM-12" }));
  });

  it("suggests the same mitigation's ticket; linked tickets are marked, after the free ones, hidden on request", async () => {
    const p = port([ticket("SCRUM-2", "OPEN"), ticket("SCRUM-1", "OPEN"), ticket("SCRUM-7", "OPEN")]);
    renderDialog(p);
    const suggested = await screen.findByTestId("ticket-link-suggested");
    expect(within(suggested).getByText("SCRUM-7")).toBeTruthy();
    // SCRUM-7 is a suggestion, not listed twice
    expect(screen.queryByTestId("ticket-SCRUM-7")).toBeNull();
    const order = screen.getAllByTestId(/^ticket-SCRUM-/).map((e) => e.getAttribute("data-testid"));
    expect(order).toEqual(["ticket-SCRUM-1", "ticket-SCRUM-2"]);
    expect(screen.getByTestId("linked-SCRUM-2").textContent).toBe("linked with M-I-002 · DF1-I-1 (+1)");
    fireEvent.click(screen.getByTestId("ticket-link-hide-linked"));
    expect(screen.queryByTestId("ticket-SCRUM-2")).toBeNull();
  });

  it("a click chooses, Link links", async () => {
    const onLink = vi.fn();
    renderDialog(port([ticket("SCRUM-1", "OPEN", "Sign the firmware")]), onLink);
    const confirm = screen.getByTestId("ticket-link-confirm") as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.click(await screen.findByTestId("ticket-SCRUM-1"));
    expect(onLink).not.toHaveBeenCalled();
    expect(confirm.textContent).toBe("Link SCRUM-1");
    fireEvent.click(confirm);
    expect(onLink.mock.calls[0][0]).toMatchObject({ key: "SCRUM-1", url: "https://acme/SCRUM-1", summary: "Sign the firmware" });
  });

  it("nothing found: a way to create a new ticket", async () => {
    const onCreateInstead = vi.fn();
    render(
      <TicketLinkDialog open label="M-X" mitigationId="M-X" riskId="r1" port={port([]) as never} projectKey="SCRUM" issueTypes={[]} links={[]} onLink={vi.fn()} onCreateInstead={onCreateInstead} onClose={() => {}} />,
    );
    fireEvent.click(await screen.findByTestId("ticket-link-create-instead"));
    expect(onCreateInstead).toHaveBeenCalled();
  });
});
