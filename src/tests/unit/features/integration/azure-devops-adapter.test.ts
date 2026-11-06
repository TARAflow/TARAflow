// tests/unit/features/integration/azure-devops-adapter.test.ts
//
// IT-8: the Azure DevOps adapter on the host-bound channel — the state's
// category decides (any process template), the reason marks a completed item
// closed without fix, one batch for ticket states with the categories read
// once per project and type, WIQL escaping, JSON Patch with HTML, the
// organization from the URL as the account the token is bound to.
// (Test values are fake.)

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AzureDevOpsAdapter, azureTicketCategory, wiqlString } from "features/integration/adapters/azure-devops-adapter";
import { createTicketAdapter, trackerRefOf } from "features/integration/adapters/create-ticket-adapter";
import { connectTracker } from "features/integration/services/connect-tracker";
import { azureOrganizationOf, issueTracker, trackerAccount } from "shared/models/issue-trackers";
import { htmlParagraphs } from "features/integration/adapters/adapter-support";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const REF = { tool: "azure-devops" as const, host: "https://dev.azure.com", account: "contoso" };
let request: ReturnType<typeof vi.fn>;
const saveToken = vi.fn(async () => ({ success: true }));
beforeEach(() => {
  request = vi.fn();
  (window as Any).electronAPI = { integration: { request, saveToken, deleteToken: vi.fn(), hasToken: vi.fn() } };
});
afterEach(() => {
  delete (window as Any).electronAPI;
  saveToken.mockClear();
});

describe("azureTicketCategory", () => {
  it("the state category decides; a completed item with a won't-fix reason is closed without fix", () => {
    expect(azureTicketCategory("New", "Proposed", undefined)).toBe("todo");
    expect(azureTicketCategory("Committed", "InProgress", undefined)).toBe("in_progress");
    expect(azureTicketCategory("Resolved", "Resolved", undefined)).toBe("review");
    expect(azureTicketCategory("Closed", "Completed", "Fixed and verified")).toBe("done");
    expect(azureTicketCategory("Closed", "Completed", "Won't Fix")).toBe("done_without_fix");
    expect(azureTicketCategory("Done", "Completed", "Cut")).toBe("done_without_fix");
    expect(azureTicketCategory("Removed", "Removed", undefined)).toBe("done_without_fix");
  });
  it("without a category the name decides", () => {
    expect(azureTicketCategory("Active", undefined, undefined)).toBe("in_progress");
    expect(azureTicketCategory("Closed", undefined, "Obsolete")).toBe("done_without_fix");
  });
});

describe("organization = account (token bound to host + organization)", () => {
  it("from dev.azure.com/<org> and <org>.visualstudio.com; nothing else", () => {
    expect(azureOrganizationOf("https://dev.azure.com/Contoso/")).toBe("contoso");
    expect(azureOrganizationOf("https://contoso.visualstudio.com")).toBe("contoso");
    expect(azureOrganizationOf("https://dev.azure.com/")).toBeNull();
    expect(azureOrganizationOf("https://example.com/contoso")).toBeNull();
    expect(trackerAccount(issueTracker("azure-devops")!, undefined, "https://dev.azure.com/contoso")).toBe("contoso");
  });

  it("the stored connection keeps the organization URL; the reference names the organization", () => {
    const ref = trackerRefOf({ tool: "azure-devops", credentials: { authMethod: "pat", baseUrl: "https://dev.azure.com/contoso" } as Any });
    expect(ref).toEqual(REF);
    expect(createTicketAdapter({ tool: "azure-devops", status: "connected", credentials: { authMethod: "pat", baseUrl: "https://dev.azure.com/contoso" } } as Any)).toBeInstanceOf(AzureDevOpsAdapter);
  });

  it("connecting without an organization fails before any secret is stored", async () => {
    const result: Any = await connectTracker({ tool: "azure-devops", host: "https://dev.azure.com/", secret: "FAKE" });
    expect(result).toMatchObject({ success: false, code: "organizationRequired" });
    expect(saveToken).not.toHaveBeenCalled();
  });
});

describe("AzureDevOpsAdapter", () => {
  const ok = (data: unknown) => ({ ok: true, status: 200, data });

  it("ticket states: one batch, categories once per project and type, unknown ids left out", async () => {
    request.mockImplementation(async (req: Any) => {
      if (req.path.startsWith("/contoso/_apis/wit/workitems?ids=")) {
        return ok({
          value: [
            { id: 7, fields: { "System.State": "Closed", "System.Reason": "Won't Fix", "System.WorkItemType": "Bug", "System.TeamProject": "Plant" } },
            { id: 8, fields: { "System.State": "Active", "System.WorkItemType": "Bug", "System.TeamProject": "Plant" } },
            null,
          ],
        });
      }
      if (req.path === "/contoso/Plant/_apis/wit/workitemtypes/Bug/states?api-version=7.1") {
        return ok({ value: [{ name: "Active", category: "InProgress" }, { name: "Closed", category: "Completed" }] });
      }
      return { ok: false, status: 404, data: null };
    });
    const states = await new AzureDevOpsAdapter(REF).fetchTicketStates(["7", "8", "9", "PROJ-1"]);
    expect([...states.values()].map((s) => [s.key, s.category, s.resolution])).toEqual([
      ["7", "done_without_fix", "Won't Fix"],
      ["8", "in_progress", undefined],
    ]);
    const batch = request.mock.calls.filter(([r]) => r.path.includes("workitems?ids="));
    expect(batch).toHaveLength(1);
    expect(batch[0][0].path).toContain("ids=7,8,9&");
    expect(request.mock.calls.filter(([r]) => r.path.includes("/states?"))).toHaveLength(1);
  });

  it("create: JSON Patch with an HTML description and tags, numeric priority only", async () => {
    request.mockResolvedValue(ok({ id: 42 }));
    const result = await new AzureDevOpsAdapter(REF).createTicket({
      projectKey: "Plant",
      issueType: "Task",
      summary: "Sign firmware",
      description: "Line 1\n<script>",
      priority: "High",
      labels: ["TARAflow", "M-T-001"],
    } as Any);
    expect(result).toEqual({ success: true, ticketId: "42", ticketUrl: "https://dev.azure.com/contoso/_workitems/edit/42" });
    const [req] = request.mock.calls[0];
    expect(req.method).toBe("POST");
    expect(req.path).toBe("/contoso/Plant/_apis/wit/workitems/$Task?api-version=7.1");
    expect(req.headers).toEqual({ "Content-Type": "application/json-patch+json" });
    expect(req.body).toEqual([
      { op: "add", path: "/fields/System.Title", value: "Sign firmware" },
      { op: "add", path: "/fields/System.Description", value: "<p>Line 1</p><p>&lt;script&gt;</p>" },
      { op: "add", path: "/fields/System.Tags", value: "TARAflow; M-T-001" },
    ]);
  });

  it("tickets to link: WIQL with escaped values, only open items", async () => {
    request.mockImplementation(async (req: Any) => {
      if (req.path.includes("/_apis/wit/wiql")) return ok({ workItems: [{ id: 1 }, { id: 2 }] });
      if (req.path.includes("workitems?ids=")) {
        return ok({
          value: [
            { id: 1, fields: { "System.Title": "Open", "System.State": "Active", "System.WorkItemType": "Task", "System.TeamProject": "O'Brien" } },
            { id: 2, fields: { "System.Title": "Old", "System.State": "Closed", "System.WorkItemType": "Task", "System.TeamProject": "O'Brien" } },
          ],
        });
      }
      return ok({ value: [{ name: "Active", category: "InProgress" }, { name: "Closed", category: "Completed" }] });
    });
    const tickets = await new AzureDevOpsAdapter(REF).fetchTickets("O'Brien", "Task");
    expect(tickets.map((t) => [t.key, t.summary])).toEqual([["1", "Open"]]);
    const wiql = request.mock.calls.find(([r]) => r.path.includes("wiql"))![0];
    expect(wiql.body.query).toContain("[System.TeamProject] = 'O''Brien'");
    expect(wiqlString("a'b")).toBe("'a''b'");
  });

  it("<org>.visualstudio.com: no organization segment in the paths", () => {
    const legacy = new AzureDevOpsAdapter({ tool: "azure-devops", host: "https://contoso.visualstudio.com", account: "contoso" });
    expect(legacy.ticketUrl("5")).toBe("https://contoso.visualstudio.com/_workitems/edit/5");
  });

  it("htmlParagraphs escapes and keeps empty lines", () => {
    expect(htmlParagraphs("a & b\n\nc")).toBe("<p>a &amp; b</p><p></p><p>c</p>");
  });
});
