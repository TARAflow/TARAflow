// tests/unit/features/integration/jira-adapter.test.ts
//
// Issue-tracker adapters design IT-2: the Jira Cloud adapter on the host-bound
// channel — status from category + resolution (custom workflows keep
// working), escaped JQL, one batch for ticket states with a single-key
// fallback, ADF descriptions — and connectTracker's checks before any secret
// is stored. (Test values are fake.)

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JiraAdapter, jiraTicketCategory, jqlString } from "features/integration/adapters/jira-adapter";
import { createTicketAdapter, trackerRefOf } from "features/integration/adapters/create-ticket-adapter";
import { connectTracker } from "features/integration/services/connect-tracker";

const REF = { tool: "jira" as const, host: "https://acme.atlassian.net", account: "someone@example.com" };
let request: ReturnType<typeof vi.fn>;
const saveToken = vi.fn(async () => ({ success: true }));
beforeEach(() => {
  request = vi.fn();
  (window as any).electronAPI = { integration: { request, saveToken, deleteToken: vi.fn(), hasToken: vi.fn() } };
});
afterEach(() => {
  delete (window as any).electronAPI;
  saveToken.mockClear();
});

describe("jiraTicketCategory", () => {
  it("category and resolution decide; names only refine 'indeterminate'", () => {
    expect(jiraTicketCategory("Backlog", "new", undefined)).toBe("todo");
    expect(jiraTicketCategory("Umsetzung", "indeterminate", undefined)).toBe("in_progress");
    expect(jiraTicketCategory("Code Review", "indeterminate", undefined)).toBe("review");
    expect(jiraTicketCategory("Erledigt", "done", "Done")).toBe("done");
    expect(jiraTicketCategory("Closed", "done", "Won't Do")).toBe("done_without_fix");
    expect(jiraTicketCategory("Closed", "done", "Declined")).toBe("done_without_fix");
    expect(jiraTicketCategory("Closed", "done", "Duplicate")).toBe("done_without_fix");
  });
  it("without a category the name decides (as before)", () => {
    expect(jiraTicketCategory("In Progress", undefined, undefined)).toBe("in_progress");
    expect(jiraTicketCategory("Done", undefined, undefined)).toBe("done");
    expect(jiraTicketCategory("Reopened", undefined, undefined)).toBe("in_progress");
  });
});

describe("JiraAdapter", () => {
  const jira = new JiraAdapter(REF);

  it("JQL values are escaped", async () => {
    expect(jqlString('A"B\\C')).toBe('"A\\"B\\\\C"');
    request.mockResolvedValue({ ok: true, status: 200, data: { issues: [] } });
    await jira.fetchTickets('SC"RUM', "Task");
    const path = decodeURIComponent(request.mock.calls[0][0].path);
    expect(path).toContain('project = "SC\\"RUM" AND issuetype = "Task" AND statusCategory != Done');
    expect(request.mock.calls[0][0]).toMatchObject({ ...REF, method: "GET" });
  });

  it("ticket states: one batch, only well-formed keys", async () => {
    request.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        issues: [
          { key: "SCRUM-1", fields: { status: { name: "Done", statusCategory: { key: "done" } }, resolution: { name: "Won't Fix" } } },
          { key: "SCRUM-2", fields: { status: { name: "In Progress", statusCategory: { key: "indeterminate" } }, resolution: null } },
        ],
      },
    });
    const states = await jira.fetchTicketStates(["SCRUM-1", "SCRUM-2", "SCRUM-1", "x) OR 1=1"]);
    expect(request).toHaveBeenCalledTimes(1);
    expect(decodeURIComponent(request.mock.calls[0][0].path)).toContain("key in (SCRUM-1,SCRUM-2)");
    expect([...states.values()]).toEqual([
      { key: "SCRUM-1", category: "done_without_fix", raw: "Done", resolution: "Won't Fix" },
      { key: "SCRUM-2", category: "in_progress", raw: "In Progress" },
    ]);
  });

  it("a deleted ticket fails the batch (400) — the keys are asked singly", async () => {
    request.mockImplementation(async (req: { path: string }) =>
      req.path.startsWith("/rest/api/3/search/jql")
        ? { ok: false, status: 400, data: null }
        : req.path.includes("SCRUM-1")
          ? { ok: true, status: 200, data: { key: "SCRUM-1", fields: { status: { name: "To Do", statusCategory: { key: "new" } } } } }
          : { ok: false, status: 404, data: null },
    );
    const states = await jira.fetchTicketStates(["SCRUM-1", "SCRUM-9"]);
    expect([...states.keys()]).toEqual(["SCRUM-1"]);
  });

  it("create: ADF description, optional fields only when given, the URL on the host", async () => {
    request.mockResolvedValue({ ok: true, status: 201, data: { key: "SCRUM-7" } });
    const res = await jira.createTicket({ projectKey: "SCRUM", issueType: "Task", summary: "S", description: "a\n\nb" });
    expect(res).toEqual({ success: true, ticketId: "SCRUM-7", ticketUrl: "https://acme.atlassian.net/browse/SCRUM-7" });
    const { body, method, path } = request.mock.calls[0][0];
    expect([method, path]).toEqual(["POST", "/rest/api/3/issue"]);
    expect(body.fields).toEqual({
      project: { key: "SCRUM" },
      summary: "S",
      issuetype: { name: "Task" },
      description: {
        type: "doc",
        version: 1,
        content: [
          { type: "paragraph", content: [{ type: "text", text: "a" }] },
          { type: "paragraph", content: [] },
          { type: "paragraph", content: [{ type: "text", text: "b" }] },
        ],
      },
    });
  });
});

describe("references and connecting", () => {
  it("the reference of a stored connection; none for http, missing user or unknown tools", () => {
    const conn = (baseUrl: string, email?: string, tool = "jira") => ({ tool, credentials: { baseUrl, email } }) as never;
    expect(trackerRefOf(conn("https://ACME.atlassian.net/", "Someone@Example.com"))).toEqual(REF);
    expect(trackerRefOf(conn("http://acme.atlassian.net", "a@b"))).toBeNull();
    expect(trackerRefOf(conn("https://acme.atlassian.net"))).toBeNull();
    expect(createTicketAdapter(conn("https://acme.atlassian.net", "a@b", "github"))).toBeNull();
    expect(createTicketAdapter(conn("https://acme.atlassian.net", "a@b"))).toBeInstanceOf(JiraAdapter);
  });

  it("connectTracker checks before storing a secret", async () => {
    expect(await connectTracker({ tool: "github", host: "https://api.github.com", secret: "x" })).toMatchObject({ success: false });
    expect(await connectTracker({ tool: "jira", host: "http://acme.atlassian.net", user: "a@b", secret: "x" })).toMatchObject({
      success: false,
      message: "Jira URL must be an https address.",
    });
    expect(await connectTracker({ tool: "jira", host: "https://acme.atlassian.net", user: " ", secret: "x" })).toMatchObject({
      success: false,
    });
    expect(saveToken).not.toHaveBeenCalled();
  });
});
