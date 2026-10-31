// Issue-tracker adapters design IT-4/5 — the whole chain, real code end to end:
//
//   Integration form ──connectTracker──► keychain (main) bound to tool+host+account
//   project connection ──createTicketAdapter──► JiraAdapter ──integration:request──►
//   main process (performIntegrationRequest: token added, host enforced) ──► Jira
//   ticket states ──applyTicketStatesToRisks──► mitigation status (decision §3.2)
//
// Only the keychain (a Map) and Jira (a fake fetch) are stand-ins. A crafted
// host in a project file gets no token and no request leaves.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { performIntegrationRequest } from "../../../../electron/services/integration-request";
import { normalizeTrackerHost, trackerKeychainKey } from "shared/models/issue-trackers";
import { connectTracker } from "features/integration/services/connect-tracker";
import { createTicketAdapter } from "features/integration/adapters/create-ticket-adapter";
import { applyTicketStatesToRisks } from "features/risks/services/ticket-sync";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const HOST = "https://acme.atlassian.net";
const keychain = new Map<string, string>();
const sent: { url: string; auth: string }[] = [];

const jira = async (url: string, init: RequestInit): Promise<Response> => {
  const auth = (init.headers as Record<string, string>).Authorization;
  sent.push({ url, auth });
  if (auth !== `Basic ${Buffer.from("someone@example.com:FAKE-token").toString("base64")}`) {
    return new Response(JSON.stringify({ errorMessages: ["unauthorized"] }), { status: 401 });
  }
  const path = new URL(url).pathname;
  if (path === "/rest/api/3/myself") return new Response(JSON.stringify({ accountId: "acc-1", displayName: "Someone" }));
  if (path === "/rest/api/3/project") return new Response(JSON.stringify([{ id: "1", key: "SCRUM", name: "Scrum", issueTypes: [] }]));
  if (path === "/rest/api/3/search/jql") {
    return new Response(
      JSON.stringify({
        issues: [
          { key: "SCRUM-1", fields: { status: { name: "Done", statusCategory: { key: "done" } }, resolution: { name: "Done" } } },
          { key: "SCRUM-2", fields: { status: { name: "Closed", statusCategory: { key: "done" } }, resolution: { name: "Won't Do" } } },
        ],
      }),
    );
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
        request: (req: Any) =>
          performIntegrationRequest(req, { getToken: async (k) => keychain.get(k) ?? null, fetch: jira as typeof fetch }),
      },
    },
  };
});
afterAll(() => {
  delete (globalThis as Any).window;
});

describe("issue tracker — from the connection test to the mitigation status", () => {
  let credentials: Any;

  it("connecting stores the token bound to its reference; the project gets none", async () => {
    const result: Any = await connectTracker({ tool: "jira", host: `${HOST}/`, user: "Someone@Example.com", secret: "FAKE-token" });
    expect(result.success).toBe(true);
    expect([...keychain.keys()]).toEqual([`integration:jira:${HOST}:someone@example.com`]);
    credentials = result.credentials;
    expect(credentials).toEqual({ authMethod: "pat", baseUrl: HOST, email: "someone@example.com", accountId: "acc-1" });
    expect(JSON.stringify(credentials)).not.toContain("FAKE");
  });

  it("the stored connection syncs: unchanged ticket keeps 'verified', won't do → rejected", async () => {
    const adapter = createTicketAdapter({ tool: "jira", status: "connected", credentials })!;
    const states = await adapter.fetchTicketStates(["SCRUM-1", "SCRUM-2"]);
    const data = {
      risks: [
        {
          id: "r1",
          selectedMitigations: [
            { id: "M-S-001", status: "verified", ticketId: "SCRUM-1", ticketStatus: "CLOSED" },
            { id: "M-S-002", status: "in_progress", ticketId: "SCRUM-2", ticketStatus: "IN_PROGRESS" },
          ],
        },
      ],
    } as Any;
    const next = applyTicketStatesToRisks(data, states, "2026-10-30T09:00:00.000Z", (d: Any, r: Any) => ({
      ...d,
      risks: d.risks.map((x: Any) => (x.id === r.id ? r : x)),
    }));
    expect(next.risks[0].selectedMitigations).toEqual([
      data.risks[0].selectedMitigations[0],
      expect.objectContaining({ status: "rejected", ticketStatus: "DECLINED", rejectedByTicket: { key: "SCRUM-2", resolution: "Won't Do" } }),
    ]);
    expect(sent.every((s) => s.url.startsWith(`${HOST}/`))).toBe(true);
  });

  it("a crafted host in a project file gets no token and sends nothing", async () => {
    const before = sent.length;
    const evil = createTicketAdapter({ tool: "jira", status: "connected", credentials: { ...credentials, baseUrl: "https://evil.example" } })!;
    expect((await evil.fetchTicketStates(["SCRUM-1"])).size).toBe(0);
    expect(sent.length).toBe(before);
  });
});
