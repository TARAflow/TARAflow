// tests/unit/features/integration/github-adapter.test.ts
//
// GitHub Issues adapter (0.18, preview): repositories as projects, issue keys
// "owner/repo#n", close reason → done / closed without fix, labels for
// progress / review, one GraphQL query for all states, Enterprise Server
// paths. (Test values are fake.)

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GitHubAdapter, githubTicketCategory, parseIssueKey } from "features/integration/adapters/github-adapter";
import { createTicketAdapter } from "features/integration/adapters/create-ticket-adapter";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const REF = { tool: "github" as const, host: "https://api.github.com", account: "default" };
let request: ReturnType<typeof vi.fn>;
beforeEach(() => {
  request = vi.fn();
  (window as Any).electronAPI = { integration: { request, saveToken: vi.fn(), deleteToken: vi.fn(), hasToken: vi.fn() } };
});
afterEach(() => {
  delete (window as Any).electronAPI;
});

describe("githubTicketCategory / keys", () => {
  it("close reason and labels decide", () => {
    expect(githubTicketCategory("open", null)).toBe("todo");
    expect(githubTicketCategory("open", null, ["in progress"])).toBe("in_progress");
    expect(githubTicketCategory("open", null, ["needs review"])).toBe("review");
    expect(githubTicketCategory("closed", "completed")).toBe("done");
    expect(githubTicketCategory("CLOSED", "NOT_PLANNED")).toBe("done_without_fix");
    expect(githubTicketCategory("closed", "completed", ["wontfix"])).toBe("done_without_fix");
  });
  it("issue keys owner/repo#n; anything else is refused (also for the GraphQL query)", () => {
    expect(parseIssueKey("acme/plant-fw#12")).toEqual({ owner: "acme", repo: "plant-fw", number: 12 });
    expect(parseIssueKey('acme/x") { y }#1')).toBeUndefined();
    expect(parseIssueKey("PROJ-1")).toBeUndefined();
  });
});

describe("GitHubAdapter", () => {
  const ok = (data: unknown) => ({ ok: true, status: 200, data });

  it("ticket states: one GraphQL query, aliases per issue, unknown ones left out", async () => {
    request.mockResolvedValue(ok({ data: { i0: { issue: { state: "CLOSED", stateReason: "NOT_PLANNED", labels: { nodes: [] } } }, i1: { issue: null } } }));
    const states = await new GitHubAdapter(REF).fetchTicketStates(["acme/fw#1", "acme/fw#2", "bad"]);
    expect([...states.values()]).toEqual([{ key: "acme/fw#1", category: "done_without_fix", raw: "CLOSED", resolution: "not planned" }]);
    expect(request).toHaveBeenCalledTimes(1);
    const [req] = request.mock.calls[0];
    expect(req.method).toBe("POST");
    expect(req.path).toBe("/graphql");
    expect(req.body.query).toContain('i0: repository(owner: "acme", name: "fw") { issue(number: 1)');
    expect(req.headers["X-GitHub-Api-Version"]).toBe("2022-11-28");
  });

  it("create: title, body, labels (the type when not 'Issue'); key and URL from the answer", async () => {
    request.mockResolvedValue(ok({ number: 9, html_url: "https://github.com/acme/fw/issues/9" }));
    const result = await new GitHubAdapter(REF).createTicket({ projectKey: "acme/fw", issueType: "security", summary: "S", description: "D", labels: ["TARAflow"] } as Any);
    expect(result).toEqual({ success: true, ticketId: "acme/fw#9", ticketUrl: "https://github.com/acme/fw/issues/9" });
    expect(request.mock.calls[0][0]).toMatchObject({ path: "/repos/acme/fw/issues", body: { title: "S", body: "D", labels: ["TARAflow", "security"] } });
  });

  it("tickets to link: open issues of the repository, pull requests left out", async () => {
    request.mockResolvedValue(ok([{ number: 1, title: "A", state: "open", labels: [] }, { number: 2, title: "PR", state: "open", pull_request: {} }]));
    const tickets = await new GitHubAdapter(REF).fetchTickets("acme/fw", "Issue");
    expect(tickets.map((t) => t.key)).toEqual(["acme/fw#1"]);
    expect(request.mock.calls[0][0].path).toBe("/repos/acme/fw/issues?state=open&sort=updated&per_page=50");
  });

  it("Enterprise Server: REST under /api/v3, GraphQL /api/graphql, links on the host", async () => {
    const ghe = new GitHubAdapter({ ...REF, host: "https://git.example.com" });
    request.mockResolvedValue(ok({ data: {} }));
    await ghe.fetchTicketStates(["a/b#1"]);
    expect(request.mock.calls[0][0].path).toBe("/api/graphql");
    expect(ghe.ticketUrl("a/b#1")).toBe("https://git.example.com/a/b/issues/1");
    expect(new GitHubAdapter(REF).ticketUrl("a/b#1")).toBe("https://github.com/a/b/issues/1");
  });

  it("the factory gives the GitHub adapter", () => {
    expect(createTicketAdapter({ tool: "github", status: "connected", credentials: { authMethod: "pat", baseUrl: "https://api.github.com" } } as Any)).toBeInstanceOf(GitHubAdapter);
  });
});
