// ==================== ISSUE TRACKERS ====================
// One description per issue tracker (design doc/InProgress/Integration/
// issue-tracker-adapters.md §4.4): the Integration tab builds its one form
// from it, and the main process picks the authorization scheme from it — the
// renderer never sees a token (§3.1). A new tracker is a row here plus its
// adapter, not a new tab.
//
// Pure, no imports: the Electron main process imports this file directly.

export type IssueTrackerId =
  | "jira" // Jira Cloud (id kept: project files store tool "jira")
  | "jira-server"
  | "azure-devops"
  | "github"
  | "gitlab"
  | "polarion"
  | "openproject";

/** How the main process turns account + secret into the request header. */
export type TrackerAuthScheme =
  | "basic-user-token" // Basic base64(user:token) — Jira Cloud
  | "basic-empty-user" // Basic base64(:token) — Azure DevOps PAT
  | "basic-apikey" // Basic base64(apikey:token) — OpenProject
  | "bearer" // Bearer token — Jira Server / DC, GitHub, Polarion
  | "private-token"; // PRIVATE-TOKEN: token — GitLab

export interface IssueTrackerDescriptor {
  id: IssueTrackerId;
  label: string;
  /** Selectable in this release; the others are listed as coming. */
  available: boolean;
  availableFrom: string;
  hostLabel: string;
  /** Prefilled host, e.g. https://api.github.com. */
  defaultHost?: string;
  /** The user field, when the tracker authenticates a user + secret. */
  userField?: { label: string; kind: "email" | "username" };
  secretLabel: string;
  auth: TrackerAuthScheme;
}

export const ISSUE_TRACKERS: readonly IssueTrackerDescriptor[] = [
  {
    id: "jira",
    label: "Jira Cloud",
    available: true,
    availableFrom: "0.16",
    hostLabel: "Jira URL",
    userField: { label: "E-mail", kind: "email" },
    secretLabel: "API token",
    auth: "basic-user-token",
  },
  { id: "jira-server", label: "Jira Server / Data Center", available: false, availableFrom: "0.17", hostLabel: "Jira URL", secretLabel: "Personal access token", auth: "bearer" },
  { id: "azure-devops", label: "Azure DevOps", available: false, availableFrom: "0.17", hostLabel: "Organization URL", defaultHost: "https://dev.azure.com", secretLabel: "Personal access token", auth: "basic-empty-user" },
  { id: "github", label: "GitHub Issues", available: false, availableFrom: "0.17", hostLabel: "API URL", defaultHost: "https://api.github.com", secretLabel: "Personal access token", auth: "bearer" },
  { id: "gitlab", label: "GitLab Issues", available: false, availableFrom: "0.17", hostLabel: "GitLab URL", defaultHost: "https://gitlab.com", secretLabel: "Personal access token", auth: "private-token" },
  { id: "polarion", label: "Polarion", available: false, availableFrom: "0.17", hostLabel: "Polarion URL", secretLabel: "Personal access token", auth: "bearer" },
  { id: "openproject", label: "OpenProject", available: false, availableFrom: "0.17", hostLabel: "OpenProject URL", secretLabel: "API key", auth: "basic-apikey" },
];

export function issueTracker(id: string): IssueTrackerDescriptor | undefined {
  return ISSUE_TRACKERS.find((t) => t.id === id);
}

/**
 * The origin a token is bound to: https only, lower case, no path, no
 * trailing slash. null for anything else (decision §3.1 — the token never
 * goes to a host it was not saved for).
 */
export function normalizeTrackerHost(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    if (u.protocol !== "https:" || u.username || u.password) return null;
    return u.origin.toLowerCase();
  } catch {
    return null;
  }
}

/** The account a secret is stored under: the user (lower case), or "default" for token-only trackers. */
export function trackerAccount(tracker: IssueTrackerDescriptor, user?: string): string | null {
  if (!tracker.userField) return "default";
  const v = user?.trim().toLowerCase();
  return v ? v : null;
}

/** Keychain account of a tracker secret: tool, host and account — host-bound. */
export function trackerKeychainKey(tool: IssueTrackerId, host: string, account: string): string {
  return `integration:${tool}:${host}:${account}`;
}
