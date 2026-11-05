// tests/unit/features/integration/openproject-adapter.test.ts
//
// OpenProject adapter (0.18, preview, API v3): statuses with isClosed (read
// once), closed under a rejecting name → without fix, one filtered query for
// all ids with the status filter "*", types by project, markdown
// descriptions. (Test values are fake.)

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpenProjectAdapter, openProjectTicketCategory } from "features/integration/adapters/openproject-adapter";
import { createTicketAdapter } from "features/integration/adapters/create-ticket-adapter";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const REF = { tool: "openproject" as const, host: "https://op.example.com", account: "default" };
let request: ReturnType<typeof vi.fn>;
beforeEach(() => {
  request = vi.fn();
  (window as Any).electronAPI = { integration: { request, saveToken: vi.fn(), deleteToken: vi.fn(), hasToken: vi.fn() } };
});
afterEach(() => {
  delete (window as Any).electronAPI;
});

const ok = (data: unknown) => ({ ok: true, status: 200, data });
const STATUSES = ok({
  _embedded: {
    elements: [
      { id: 1, name: "New", isClosed: false, _links: { self: { href: "/api/v3/statuses/1" } } },
      { id: 7, name: "In progress", isClosed: false, _links: { self: { href: "/api/v3/statuses/7" } } },
      { id: 12, name: "Closed", isClosed: true, _links: { self: { href: "/api/v3/statuses/12" } } },
      { id: 14, name: "Rejected", isClosed: true, _links: { self: { href: "/api/v3/statuses/14" } } },
    ],
  },
});

describe("openProjectTicketCategory", () => {
  it("isClosed and the name decide", () => {
    expect(openProjectTicketCategory("New", false)).toBe("todo");
    expect(openProjectTicketCategory("In progress", false)).toBe("in_progress");
    expect(openProjectTicketCategory("In testing", false)).toBe("review");
    expect(openProjectTicketCategory("Closed", true)).toBe("done");
    expect(openProjectTicketCategory("Rejected", true)).toBe("done_without_fix");
  });
});

describe("OpenProjectAdapter", () => {
  it("ticket states: one query with status '*' and the ids, statuses read once", async () => {
    request.mockImplementation(async (req: Any) => {
      if (req.path === "/api/v3/statuses") return STATUSES;
      return ok({
        _embedded: {
          elements: [
            { id: 3, _links: { status: { href: "/api/v3/statuses/14", title: "Rejected" } } },
            { id: 4, _links: { status: { href: "/api/v3/statuses/7", title: "In progress" } } },
          ],
        },
      });
    });
    const states = await new OpenProjectAdapter(REF).fetchTicketStates(["3", "4", "x"]);
    expect([...states.values()].map((s) => [s.key, s.category, s.resolution])).toEqual([
      ["3", "done_without_fix", "Rejected"],
      ["4", "in_progress", undefined],
    ]);
    const query = request.mock.calls.find(([r]) => r.path.startsWith("/api/v3/work_packages?"))![0].path;
    expect(JSON.parse(decodeURIComponent(/filters=([^&]+)/.exec(query)![1]))).toEqual([
      { status: { operator: "*", values: [] } },
      { id: { operator: "=", values: ["3", "4"] } },
    ]);
    expect(request.mock.calls.filter(([r]) => r.path === "/api/v3/statuses")).toHaveLength(1);
  });

  it("create: subject, markdown description, the type by name", async () => {
    request.mockImplementation(async (req: Any) =>
      req.path.endsWith("/types") ? ok({ _embedded: { elements: [{ id: 1, name: "Task" }, { id: 2, name: "Bug" }] } }) : ok({ id: 77 }),
    );
    const result = await new OpenProjectAdapter(REF).createTicket({ projectKey: "plant", issueType: "Bug", summary: "S", description: "D" } as Any);
    expect(result).toEqual({ success: true, ticketId: "77", ticketUrl: "https://op.example.com/work_packages/77" });
    const post = request.mock.calls.find(([r]) => r.method === "POST")![0];
    expect(post).toMatchObject({
      path: "/api/v3/projects/plant/work_packages",
      body: { subject: "S", description: { format: "markdown", raw: "D" }, _links: { type: { href: "/api/v3/types/2" } } },
    });
  });

  it("connection test: the anonymous user counts as failed authentication", async () => {
    request.mockResolvedValue(ok({ _type: "AnonymousUser" }));
    const outcome = await new OpenProjectAdapter(REF).testConnection();
    expect(outcome).toMatchObject({ success: false, message: "Authentication failed — check the API key." });
    expect(outcome.note).toEqual({ code: "authFailed", hint: "apiKey" });
  });

  it("the factory gives the OpenProject adapter", () => {
    expect(createTicketAdapter({ tool: "openproject", status: "connected", credentials: { authMethod: "pat", baseUrl: REF.host } } as Any)).toBeInstanceOf(OpenProjectAdapter);
  });
});
