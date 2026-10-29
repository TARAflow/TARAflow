// electron/tests/integration-request.test.ts
//
// Issue-tracker adapters design §3.1 / IT-1: the main process holds the token,
// bound to tool + host + account, sets the authorization itself and talks to
// that host only. A crafted host gets no token, the renderer cannot set
// Authorization, redirects are not followed. (Test values are fake.)

import { describe, expect, it, vi } from "vitest";
import {
  authHeaders,
  checkIntegrationRequest,
  performIntegrationRequest,
  type IntegrationRequest,
} from "../services/integration-request";
import {
  ISSUE_TRACKERS,
  normalizeTrackerHost,
  trackerAccount,
  trackerKeychainKey,
} from "../../src/shared/models/issue-trackers";

const HOST = "https://acme.atlassian.net";
const KEY = trackerKeychainKey("jira", HOST, "someone@example.com");
const req = (over: Partial<IntegrationRequest> = {}): IntegrationRequest => ({
  tool: "jira",
  host: "https://ACME.atlassian.net/",
  account: "Someone@Example.com",
  method: "GET",
  path: "/rest/api/3/myself",
  ...over,
});
const okFetch = () =>
  vi.fn(async () => new Response(JSON.stringify({ accountId: "acc-1" }), { status: 200 })) as unknown as typeof fetch;
const keychain = (entries: Record<string, string>) => async (key: string) => entries[key] ?? null;

describe("tracker descriptions", () => {
  it("one per tracker, Jira Cloud available in 0.16, every scheme known", () => {
    expect(ISSUE_TRACKERS.filter((t) => t.available).map((t) => t.id)).toEqual(["jira"]);
    for (const t of ISSUE_TRACKERS) expect(Object.keys(authHeaders(t.auth, "u", "t")).length).toBe(1);
  });

  it("host: https origin, lower case; anything else refused", () => {
    expect(normalizeTrackerHost("https://ACME.atlassian.net/jira/")).toBe(HOST);
    expect(normalizeTrackerHost("http://acme.atlassian.net")).toBeNull();
    expect(normalizeTrackerHost("https://user:pw@acme.atlassian.net")).toBeNull();
    expect(normalizeTrackerHost("not a url")).toBeNull();
  });

  it("account: the user in lower case, or default for token-only trackers", () => {
    const jira = ISSUE_TRACKERS.find((t) => t.id === "jira")!;
    const ado = ISSUE_TRACKERS.find((t) => t.id === "azure-devops")!;
    expect(trackerAccount(jira, " Someone@Example.com ")).toBe("someone@example.com");
    expect(trackerAccount(jira, "")).toBeNull();
    expect(trackerAccount(ado)).toBe("default");
  });
});

describe("authorization schemes", () => {
  it("builds the tracker's header", () => {
    expect(authHeaders("basic-user-token", "a@b", "t")).toEqual({ Authorization: `Basic ${btoa("a@b:t")}` });
    expect(authHeaders("basic-empty-user", "default", "t")).toEqual({ Authorization: `Basic ${btoa(":t")}` });
    expect(authHeaders("basic-apikey", "default", "t")).toEqual({ Authorization: `Basic ${btoa("apikey:t")}` });
    expect(authHeaders("bearer", "default", "t")).toEqual({ Authorization: "Bearer t" });
    expect(authHeaders("private-token", "default", "t")).toEqual({ "PRIVATE-TOKEN": "t" });
  });
});

describe("checkIntegrationRequest", () => {
  it("normalises host and account into the keychain key, builds the URL on the host", () => {
    const c = checkIntegrationRequest(req());
    expect(c).toMatchObject({ url: `${HOST}/rest/api/3/myself`, key: KEY, method: "GET" });
  });

  it("refuses unknown trackers, http, absolute and protocol-relative paths, other methods", () => {
    expect(checkIntegrationRequest(req({ tool: "evil" }))).toEqual({ error: "unknown tracker" });
    expect(checkIntegrationRequest(req({ host: "http://acme.atlassian.net" }))).toEqual({ error: "host must be an https origin" });
    expect(checkIntegrationRequest(req({ path: "https://evil.example/x" }))).toEqual({ error: "path must be relative to the host" });
    expect(checkIntegrationRequest(req({ path: "//evil.example/x" }))).toEqual({ error: "path must be relative to the host" });
    expect(checkIntegrationRequest(req({ method: "DELETE" }))).toEqual({ error: "method DELETE not allowed" });
    expect(checkIntegrationRequest(req({ account: " " }))).toEqual({ error: "account missing" });
  });

  it("passes only Accept / Content-Type / X-Atlassian-Token from the renderer; JSON body", () => {
    const c = checkIntegrationRequest(
      req({ method: "POST", body: { a: 1 }, headers: { Authorization: "Basic stolen", Cookie: "c", "X-Atlassian-Token": "no-check" } }),
    );
    expect(c).toMatchObject({ headers: { "X-Atlassian-Token": "no-check", "Content-Type": "application/json" }, body: '{"a":1}' });
  });
});

describe("performIntegrationRequest", () => {
  it("sends the token of exactly this tool + host + account, set by the main process", async () => {
    const f = okFetch();
    const res = await performIntegrationRequest(req({ headers: { Authorization: "Basic stolen" } }), {
      getToken: keychain({ [KEY]: "FAKE-token" }),
      fetch: f,
    });
    expect(res).toEqual({ ok: true, status: 200, data: { accountId: "acc-1" } });
    const [url, init] = (f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];
    expect(url).toBe(`${HOST}/rest/api/3/myself`);
    expect((init.headers as Record<string, string>).Authorization).toBe(`Basic ${btoa("someone@example.com:FAKE-token")}`);
    expect(init.redirect).toBe("manual");
  });

  it("a crafted host from a project file finds no token and sends nothing", async () => {
    const f = okFetch();
    const res = await performIntegrationRequest(req({ host: "https://evil.example" }), {
      getToken: keychain({ [KEY]: "FAKE-token" }),
      fetch: f,
    });
    expect(res).toMatchObject({ ok: false, status: 0, error: "no token for this tracker, host and account" });
    expect(f).not.toHaveBeenCalled();
  });

  it("a redirect is not followed; text bodies come back as text", async () => {
    const redirect = vi.fn(async () => new Response(null, { status: 302, headers: { Location: "https://evil.example" } })) as unknown as typeof fetch;
    expect(await performIntegrationRequest(req(), { getToken: keychain({ [KEY]: "t" }), fetch: redirect })).toMatchObject({
      ok: false,
      status: 302,
      error: "redirect not followed",
    });
    const text = vi.fn(async () => new Response("plain", { status: 500 })) as unknown as typeof fetch;
    expect(await performIntegrationRequest(req(), { getToken: keychain({ [KEY]: "t" }), fetch: text })).toEqual({
      ok: false,
      status: 500,
      data: "plain",
    });
  });
});
