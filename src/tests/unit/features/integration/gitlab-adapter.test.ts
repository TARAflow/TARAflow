// tests/unit/features/integration/gitlab-adapter.test.ts
//
// GitLab issues adapter (0.18, preview): projects by full path, keys
// "group/project#iid", labels for review / progress / closed without fix
// (GitLab has no close reason), one request per project with iids[].
// (Test values are fake.)

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GitLabAdapter, gitlabTicketCategory, parseGitLabKey } from "features/integration/adapters/gitlab-adapter";
import { createTicketAdapter } from "features/integration/adapters/create-ticket-adapter";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const REF = { tool: "gitlab" as const, host: "https://gitlab.example.com", account: "default" };
let request: ReturnType<typeof vi.fn>;
beforeEach(() => {
  request = vi.fn();
  (window as Any).electronAPI = { integration: { request, saveToken: vi.fn(), deleteToken: vi.fn(), hasToken: vi.fn() } };
});
afterEach(() => {
  delete (window as Any).electronAPI;
});

describe("gitlabTicketCategory / keys", () => {
  it("state and labels decide (scoped labels too)", () => {
    expect(gitlabTicketCategory("opened")).toBe("todo");
    expect(gitlabTicketCategory("opened", ["workflow::in review"])).toBe("review");
    expect(gitlabTicketCategory("opened", ["Doing"])).toBe("in_progress");
    expect(gitlabTicketCategory("closed")).toBe("done");
    expect(gitlabTicketCategory("closed", ["won't fix"])).toBe("done_without_fix");
  });
  it("keys group/sub/project#iid", () => {
    expect(parseGitLabKey("plant/fw/core#7")).toEqual({ project: "plant/fw/core", iid: 7 });
    expect(parseGitLabKey("core#7")).toBeUndefined();
  });
});

describe("GitLabAdapter", () => {
  const ok = (data: unknown) => ({ ok: true, status: 200, data });

  it("ticket states: one request per project with iids[], closed with a won't-fix label → without fix", async () => {
    request.mockResolvedValue(ok([{ iid: 1, state: "closed", labels: ["duplicate"] }, { iid: 2, state: "opened", labels: [] }]));
    const states = await new GitLabAdapter(REF).fetchTicketStates(["plant/fw#1", "plant/fw#2", "x"]);
    expect([...states.values()].map((s) => [s.key, s.category, s.resolution])).toEqual([
      ["plant/fw#1", "done_without_fix", "duplicate"],
      ["plant/fw#2", "todo", undefined],
    ]);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0].path).toBe("/api/v4/projects/plant%2Ffw/issues?iids[]=1&iids[]=2&per_page=100");
  });

  it("create: title, description, labels as one list; key and URL from the answer", async () => {
    request.mockResolvedValue(ok({ iid: 5, web_url: "https://gitlab.example.com/plant/fw/-/issues/5" }));
    const result = await new GitLabAdapter(REF).createTicket({ projectKey: "plant/fw", issueType: "Issue", summary: "S", description: "D", labels: ["TARAflow", "M-T-001"] } as Any);
    expect(result).toEqual({ success: true, ticketId: "plant/fw#5", ticketUrl: "https://gitlab.example.com/plant/fw/-/issues/5" });
    expect(request.mock.calls[0][0]).toMatchObject({ method: "POST", path: "/api/v4/projects/plant%2Ffw/issues", body: { title: "S", description: "D", labels: "TARAflow,M-T-001" } });
  });

  it("connection test: user, then the member projects with issues", async () => {
    request.mockImplementation(async (req: Any) =>
      req.path === "/api/v4/user"
        ? ok({ id: 3, username: "someone" })
        : ok([{ id: 9, path_with_namespace: "plant/fw", name_with_namespace: "Plant / FW" }, { id: 10, path_with_namespace: "x/y", issues_enabled: false }]),
    );
    const outcome = await new GitLabAdapter(REF).testConnection();
    expect(outcome).toMatchObject({ success: true, accountId: "3", projects: [{ key: "plant/fw", name: "Plant / FW" }] });
    // A coded note the Integration tab translates; the English sentence for logs.
    expect(outcome.note).toEqual({ code: "connected", account: "someone", count: 1, unit: "projects" });
    expect(outcome.message).toBe("Connected as someone — 1 project(s).");
    expect(new GitLabAdapter(REF).ticketUrl("plant/fw#5")).toBe("https://gitlab.example.com/plant/fw/-/issues/5");
  });

  it("the factory gives the GitLab adapter", () => {
    expect(createTicketAdapter({ tool: "gitlab", status: "connected", credentials: { authMethod: "pat", baseUrl: "https://gitlab.com" } } as Any)).toBeInstanceOf(GitLabAdapter);
  });
});
