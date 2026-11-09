// tests/unit/features/integration/ticket-query.test.ts
//
// Adapters design IT-13 (user 2026-11-10): the tickets to link are asked for
// by scope (not done — the default, as before —, done, all) and by text; a
// ticket key or number finds that ticket. Every adapter builds the query in
// its tracker's own language. (Test values are fake.)

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JiraAdapter } from "features/integration/adapters/jira-adapter";
import { GitHubAdapter } from "features/integration/adapters/github-adapter";
import { GitLabAdapter } from "features/integration/adapters/gitlab-adapter";
import { OpenProjectAdapter } from "features/integration/adapters/openproject-adapter";
import { AzureDevOpsAdapter } from "features/integration/adapters/azure-devops-adapter";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

let request: ReturnType<typeof vi.fn>;
beforeEach(() => {
  request = vi.fn();
  (window as Any).electronAPI = { integration: { request, saveToken: vi.fn(), deleteToken: vi.fn(), hasToken: vi.fn() } };
});
afterEach(() => {
  delete (window as Any).electronAPI;
});
const ok = (data: unknown) => ({ ok: true, status: 200, data });
const paths = () => request.mock.calls.map(([r]) => decodeURIComponent(r.path as string));

describe("Jira", () => {
  const jira = new JiraAdapter({ tool: "jira", host: "https://acme.atlassian.net", account: "a@b.c" } as Any);

  it("scope: not done by default, done, all", async () => {
    request.mockResolvedValue(ok({ issues: [] }));
    await jira.fetchTickets("SCRUM", "__all__");
    await jira.fetchTickets("SCRUM", "__all__", { scope: "done" });
    await jira.fetchTickets("SCRUM", "__all__", { scope: "all" });
    const [active, done, all] = paths();
    expect(active).toContain('project = "SCRUM" AND statusCategory != Done ORDER BY');
    expect(done).toContain('project = "SCRUM" AND statusCategory = Done ORDER BY');
    expect(all).toContain('project = "SCRUM" ORDER BY');
  });

  it("text searches the text, escaped; a key is looked up in a request of its own, first in the list", async () => {
    request.mockImplementation(async (r: Any) => {
      const path = decodeURIComponent(r.path);
      if (path.includes("issuekey =")) return ok({ issues: [{ key: "SCRUM-12", fields: { summary: "by key" } }] });
      return ok({ issues: [{ key: "SCRUM-3", fields: { summary: "mentions SCRUM-12" } }, { key: "SCRUM-12", fields: { summary: "by key" } }] });
    });
    expect(await jira.fetchTickets("SCRUM", "__all__", { text: 'sign "fw"' })).toHaveLength(2);
    expect(paths()[0]).toContain('AND text ~ "sign \\"fw\\""');
    request.mockClear();
    const byKey = await jira.fetchTickets("SCRUM", "__all__", { text: "scrum-12" });
    expect(byKey.map((t) => t.key)).toEqual(["SCRUM-12", "SCRUM-3"]);
    expect(paths().some((p) => p.includes('issuekey = "SCRUM-12"'))).toBe(true);
  });

  it("an unknown key (the request fails) leaves the text hits", async () => {
    request.mockImplementation(async (r: Any) =>
      decodeURIComponent(r.path).includes("issuekey =") ? { ok: false, status: 400, data: {} } : ok({ issues: [{ key: "SCRUM-3", fields: {} }] }),
    );
    expect((await jira.fetchTickets("SCRUM", "__all__", { text: "SCRUM-999" })).map((t) => t.key)).toEqual(["SCRUM-3"]);
  });
});

describe("GitHub", () => {
  const gh = new GitHubAdapter({ tool: "github", host: "https://api.github.com", account: "default" } as Any);

  it("without text: the list endpoint with state open / closed / all", async () => {
    request.mockResolvedValue(ok([]));
    await gh.fetchTickets("acme/fw", "Issue", { scope: "done" });
    await gh.fetchTickets("acme/fw", "Issue", { scope: "all" });
    expect(paths()).toEqual([
      "/repos/acme/fw/issues?state=closed&sort=updated&per_page=50",
      "/repos/acme/fw/issues?state=all&sort=updated&per_page=50",
    ]);
  });

  it("with text: the search API — words in the title, a number as the issue", async () => {
    request.mockResolvedValue(ok({ items: [{ number: 12, title: "Sign", state: "open", labels: [] }] }));
    const tickets = await gh.fetchTickets("acme/fw", "security", { text: "sign" });
    expect(tickets.map((t) => t.key)).toEqual(["acme/fw#12"]);
    await gh.fetchTickets("acme/fw", "Issue", { text: "#12", scope: "all" });
    const [words, number] = paths();
    expect(words).toContain('q=repo:acme/fw is:issue state:open label:"security" sign in:title');
    expect(number).toContain("q=repo:acme/fw is:issue 12");
  });
});

describe("GitLab", () => {
  it("state opened / closed / none, search or iids[]", async () => {
    request.mockResolvedValue(ok([]));
    const gl = new GitLabAdapter({ tool: "gitlab", host: "https://gitlab.example.com", account: "default" } as Any);
    await gl.fetchTickets("plant/fw", "Issue");
    await gl.fetchTickets("plant/fw", "Issue", { scope: "done", text: "sign fw" });
    await gl.fetchTickets("plant/fw", "Issue", { scope: "all", text: "#7" });
    const [active, done, all] = paths();
    expect(active).toContain("&state=opened");
    expect(done).toContain("&state=closed");
    expect(done).toContain("&search=sign fw");
    expect(all).not.toContain("state=");
    expect(all).toContain("&iids[]=7");
  });
});

describe("OpenProject", () => {
  it("status open / closed / none and subjectOrId contains", async () => {
    request.mockResolvedValue(ok({ _embedded: { elements: [] } }));
    const op = new OpenProjectAdapter({ tool: "openproject", host: "https://op.example.com", account: "default" } as Any);
    await op.fetchTickets("plant", "__all__");
    await op.fetchTickets("plant", "__all__", { scope: "done", text: "sign" });
    await op.fetchTickets("plant", "__all__", { scope: "all" });
    const [active, done, all] = paths();
    expect(active).toContain('{"status":{"operator":"o","values":[]}}');
    expect(done).toContain('{"status":{"operator":"c","values":[]}}');
    expect(done).toContain('{"subjectOrId":{"operator":"**","values":["sign"]}}');
    expect(all).not.toContain('"status"');
  });
});

describe("Azure DevOps", () => {
  const work = (async (req: Any) => {
    if (req.path.includes("/_apis/wit/wiql")) return ok({ workItems: [{ id: 1 }, { id: 2 }] });
    if (req.path.includes("workitems?ids=")) {
      return ok({
        value: [
          { id: 1, fields: { "System.Title": "Open", "System.State": "Active", "System.WorkItemType": "Task", "System.TeamProject": "Plant" } },
          { id: 2, fields: { "System.Title": "Old", "System.State": "Closed", "System.WorkItemType": "Task", "System.TeamProject": "Plant" } },
        ],
      });
    }
    return ok({ value: [{ name: "Active", category: "InProgress" }, { name: "Closed", category: "Completed" }] });
  }) as Any;

  it("scope filters by the state category; title CONTAINS, a number also as the id", async () => {
    request.mockImplementation(work);
    const ado = new AzureDevOpsAdapter({ tool: "azure-devops", host: "https://dev.azure.com", account: "contoso" } as Any);
    expect((await ado.fetchTickets("Plant", "Task", { scope: "done" })).map((t) => t.key)).toEqual(["2"]);
    expect((await ado.fetchTickets("Plant", "Task", { scope: "all", text: "42" })).map((t) => t.key)).toEqual(["1", "2"]);
    const queries = request.mock.calls.filter(([r]) => r.path.includes("wiql")).map(([r]) => r.body.query as string);
    expect(queries[1]).toContain("AND ([System.Id] = 42 OR [System.Title] CONTAINS '42')");
  });
});
