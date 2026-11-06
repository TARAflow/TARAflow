// Issue-tracker adapters IT-8 — Azure DevOps over the whole chain, real code
// end to end (as issue-tracker-chain.int.test.ts for Jira):
//
//   Integration form ──connectTracker──► keychain (main) bound to tool + host
//   + ORGANIZATION ──createTicketAdapter──► AzureDevOpsAdapter
//   ──integration:request──► main process (Basic :PAT added, host enforced)
//   ──► Azure DevOps ──► ticket states ──applyTicketStatesToRisks──► status
//
// Only the keychain (a Map) and Azure DevOps (a fake fetch) are stand-ins. A
// crafted host or another organization in a project file gets no token.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { performIntegrationRequest } from "../../../../electron/services/integration-request";
import { normalizeTrackerHost, trackerKeychainKey } from "shared/models/issue-trackers";
import { connectTracker } from "features/integration/services/connect-tracker";
import { createTicketAdapter } from "features/integration/adapters/create-ticket-adapter";
import { applyTicketStatesToRisks } from "features/risks/services/ticket-sync";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const HOST = "https://dev.azure.com";
const keychain = new Map<string, string>();
const sent: { url: string; auth: string }[] = [];

const ado = async (url: string, init: RequestInit): Promise<Response> => {
  const auth = (init.headers as Record<string, string>).Authorization;
  sent.push({ url, auth });
  if (auth !== `Basic ${Buffer.from(":FAKE-pat").toString("base64")}`) return new Response("{}", { status: 401 });
  const u = new URL(url);
  if (u.pathname === "/contoso/_apis/connectionData") return new Response(JSON.stringify({ authenticatedUser: { id: "u-1", providerDisplayName: "Someone" } }));
  if (u.pathname === "/contoso/_apis/projects") return new Response(JSON.stringify({ value: [{ id: "p-1", name: "Plant" }] }));
  if (u.pathname === "/contoso/Plant/_apis/wit/workitemtypes") return new Response(JSON.stringify({ value: [{ name: "Task" }, { name: "Bug" }] }));
  if (u.pathname === "/contoso/_apis/wit/workitems") {
    return new Response(
      JSON.stringify({
        value: [
          { id: 11, fields: { "System.State": "Closed", "System.Reason": "Completed", "System.WorkItemType": "Task", "System.TeamProject": "Plant" } },
          { id: 12, fields: { "System.State": "Removed", "System.Reason": "Removed from the backlog", "System.WorkItemType": "Task", "System.TeamProject": "Plant" } },
        ],
      }),
    );
  }
  if (u.pathname === "/contoso/Plant/_apis/wit/workitemtypes/Task/states") {
    return new Response(JSON.stringify({ value: [{ name: "Closed", category: "Completed" }, { name: "Removed", category: "Removed" }] }));
  }
  return new Response(null, { status: 404 });
};

const keyOf = (ref: Any) => trackerKeychainKey(ref.tool, normalizeTrackerHost(ref.host)!, ref.account.trim().toLowerCase());

beforeAll(() => {
  (globalThis as Any).window = {
    electronAPI: {
      integration: {
        saveToken: async (ref: Any) => (keychain.set(keyOf(ref), ref.token), { success: true }),
        hasToken: async (ref: Any) => ({ success: true, hasToken: keychain.has(keyOf(ref)) }),
        deleteToken: async (ref: Any) => ({ success: keychain.delete(keyOf(ref)) }),
        request: (req: Any) => performIntegrationRequest(req, { getToken: async (k) => keychain.get(k) ?? null, fetch: ado as typeof fetch }),
      },
    },
  };
});
afterAll(() => {
  delete (globalThis as Any).window;
});

describe("Azure DevOps — from the connection test to the mitigation status", () => {
  let credentials: Any;

  it("connecting binds the PAT to host and organization; the project keeps the organization URL, no secret", async () => {
    const result: Any = await connectTracker({ tool: "azure-devops", host: `${HOST}/Contoso/`, secret: "FAKE-pat" });
    expect(result.success).toBe(true);
    expect(result.projects).toEqual([expect.objectContaining({ key: "Plant", issueTypes: [expect.objectContaining({ name: "Task" }), expect.objectContaining({ name: "Bug" })] })]);
    expect([...keychain.keys()]).toEqual([`integration:azure-devops:${HOST}:contoso`]);
    credentials = result.credentials;
    expect(credentials).toEqual({ authMethod: "pat", baseUrl: `${HOST}/contoso`, accountId: "u-1" });
    expect(JSON.stringify(credentials)).not.toContain("FAKE");
  });

  it("the stored connection syncs: completed → implemented, removed → rejected with the reason", async () => {
    const adapter = createTicketAdapter({ tool: "azure-devops", status: "connected", credentials })!;
    const states = await adapter.fetchTicketStates(["11", "12"]);
    const data = {
      risks: [{ id: "r1", selectedMitigations: [
        { id: "M-S-001", status: "in_progress", ticketId: "11", ticketStatus: "IN_PROGRESS" },
        { id: "M-S-002", status: "open", ticketId: "12", ticketStatus: "TODO" },
      ] }],
    } as Any;
    const next = applyTicketStatesToRisks(data, states, "2026-11-03T09:00:00.000Z", (d: Any, r: Any) => ({ ...d, risks: d.risks.map((x: Any) => (x.id === r.id ? r : x)) }));
    expect(next.risks[0].selectedMitigations).toEqual([
      expect.objectContaining({ status: "implemented" }),
      expect.objectContaining({ status: "rejected", rejectedByTicket: { key: "12", resolution: "Removed from the backlog" } }),
    ]);
    expect(sent.every((s) => s.url.startsWith(`${HOST}/contoso/`))).toBe(true);
  });

  it("another organization or a crafted host in a project file gets no token and sends nothing", async () => {
    const before = sent.length;
    for (const baseUrl of [`${HOST}/fabrikam`, "https://evil.example/contoso"]) {
      const evil = createTicketAdapter({ tool: "azure-devops", status: "connected", credentials: { ...credentials, baseUrl } });
      if (evil) expect((await evil.fetchTicketStates(["11"])).size).toBe(0);
    }
    expect(sent.length).toBe(before);
  });
});
