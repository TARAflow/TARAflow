// ==================== INTEGRATION REQUEST (MAIN PROCESS) ====================
// The one way the app talks to an issue tracker (design
// doc/InProgress/Integration/issue-tracker-adapters.md, decision §3.1, IT-1).
// The renderer names tool, host, account and a relative path; this module
// looks the token up in the OS keychain under exactly that tool + host +
// account, sets the tracker's authorization header itself and sends the
// request to that host only. The renderer never sees a token, and a host from
// a crafted project file finds none.
//
//   - host: https origin only (normalizeTrackerHost); the path must stay on it
//   - methods GET / POST / PUT; JSON bodies
//   - renderer headers: only Accept / Content-Type / X-Atlassian-Token pass
//     (an Authorization or Cookie from the renderer is dropped)
//   - redirects are not followed (a redirect could carry the header elsewhere)
//
// Pure apart from the injected keychain lookup and fetch — unit-tested.

import {
  issueTracker,
  normalizeTrackerHost,
  trackerKeychainKey,
  type IssueTrackerId,
  type TrackerAuthScheme,
} from "../../src/shared/models/issue-trackers";

export interface IntegrationRequest {
  tool: string;
  host: string;
  account: string;
  method: string;
  /** Relative to the host, e.g. "/rest/api/3/myself". */
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface IntegrationResponse {
  ok: boolean;
  status: number;
  data: unknown;
  error?: string;
}

const METHODS = new Set(["GET", "POST", "PUT"]);
const PASS_HEADERS = new Set(["accept", "content-type", "x-atlassian-token"]);

/** The authorization header of a scheme. */
export function authHeaders(scheme: TrackerAuthScheme, account: string, token: string): Record<string, string> {
  const basic = (s: string) => `Basic ${Buffer.from(s, "utf8").toString("base64")}`;
  switch (scheme) {
    case "basic-user-token":
      return { Authorization: basic(`${account}:${token}`) };
    case "basic-empty-user":
      return { Authorization: basic(`:${token}`) };
    case "basic-apikey":
      return { Authorization: basic(`apikey:${token}`) };
    case "bearer":
      return { Authorization: `Bearer ${token}` };
    case "private-token":
      return { "PRIVATE-TOKEN": token };
  }
}

export type CheckedRequest = {
  url: string;
  key: string;
  scheme: TrackerAuthScheme;
  method: string;
  headers: Record<string, string>;
  body?: string;
};

/** Validate a renderer request; the error names the rule, never a value. */
export function checkIntegrationRequest(req: IntegrationRequest): CheckedRequest | { error: string } {
  const tracker = issueTracker(req.tool);
  if (!tracker) return { error: "unknown tracker" };
  const host = normalizeTrackerHost(req.host);
  if (!host) return { error: "host must be an https origin" };
  const account = req.account?.trim().toLowerCase();
  if (!account) return { error: "account missing" };
  const method = (req.method ?? "GET").toUpperCase();
  if (!METHODS.has(method)) return { error: `method ${method} not allowed` };
  if (typeof req.path !== "string" || !req.path.startsWith("/") || req.path.startsWith("//")) {
    return { error: "path must be relative to the host" };
  }
  let url: URL;
  try {
    url = new URL(req.path, host);
  } catch {
    return { error: "invalid path" };
  }
  if (url.origin.toLowerCase() !== host) return { error: "path leaves the host" };

  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers ?? {})) {
    if (PASS_HEADERS.has(k.toLowerCase()) && typeof v === "string") headers[k] = v;
  }
  let body: string | undefined;
  if (req.body !== undefined && method !== "GET") {
    body = JSON.stringify(req.body);
    if (!Object.keys(headers).some((k) => k.toLowerCase() === "content-type")) {
      headers["Content-Type"] = "application/json";
    }
  }
  return {
    url: url.toString(),
    key: trackerKeychainKey(tracker.id as IssueTrackerId, host, account),
    scheme: tracker.auth,
    method,
    headers,
    ...(body !== undefined ? { body } : {}),
  };
}

export interface IntegrationDeps {
  getToken: (key: string) => Promise<string | null>;
  fetch: typeof fetch;
}

export async function performIntegrationRequest(
  req: IntegrationRequest,
  deps: IntegrationDeps,
): Promise<IntegrationResponse> {
  const checked = checkIntegrationRequest(req);
  if ("error" in checked) return { ok: false, status: 0, data: null, error: checked.error };
  const token = await deps.getToken(checked.key);
  if (!token) return { ok: false, status: 0, data: null, error: "no token for this tracker, host and account" };
  try {
    const response = await deps.fetch(checked.url, {
      method: checked.method,
      headers: {
        Accept: "application/json",
        ...checked.headers,
        ...authHeaders(checked.scheme, req.account.trim().toLowerCase(), token),
        "User-Agent": "TARAflow",
      },
      body: checked.body,
      redirect: "manual",
    });
    if (response.status >= 300 && response.status < 400) {
      return { ok: false, status: response.status, data: null, error: "redirect not followed" };
    }
    const text = await response.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, data: null, error: error instanceof Error ? error.message : "request failed" };
  }
}
