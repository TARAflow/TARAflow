// ==================== LOCAL USER SETTINGS ====================
// Per-user values of a project that must not go into the shared .tara.json
// (user 2026-10-30): every team member commits under their own name and
// connects to the tracker with their own account. The file keeps what the
// team shares — audit provider, remote, branch, rounds, auth method, signing
// policy; tracker tool, URL, auth method, project, issue types, mapping.
//
// Local only (stripped by prepare-for-disk, kept here):
//   - audit.config.author                    per project
//   - integration.lastSync                   per project
//   - connection.credentials.email/accountId,
//     connection.status / lastTested / lastError
//                                            per tracker and host — the same
//                                            account for every project there
// Secrets stay in the OS keychain (credential service), as before.
//
// Storage: localStorage (Electron renderer and browser alike).
//
// Precedence: the stored value wins over the in-memory one, which only fills
// in when nothing is stored — a file written before 0.16 still carries the
// values of whoever saved it; they are adopted once (rememberLocalSettings on
// opening) and leave the file with the next save. Edits go through
// rememberLocalSettings first, so the store and memory agree.

import type { Project } from "../models/project-types";

type Audit = Project["audit"];
type Integration = Project["integration"];
type Connection = NonNullable<NonNullable<Integration>["connection"]>;

interface ProjectLocal {
  auditAuthor?: { name: string; email: string };
  integrationLastSync?: string;
}

interface TrackerLocal {
  email?: string;
  accountId?: string;
  status?: Connection["status"];
  lastTested?: string;
  lastError?: string;
}

const projectKey = (projectId: string) => `taraflow:local:project:${projectId}`;

/** One account per tracker and host; null without a URL (nothing to bind to). */
function trackerKey(connection: Connection | null | undefined): string | null {
  const url = connection?.credentials?.baseUrl?.trim();
  if (!connection || !url) return null;
  let host = url;
  try {
    host = new URL(url).origin;
  } catch {
    /* keep the raw value */
  }
  return `taraflow:local:tracker:${connection.tool}:${host.toLowerCase()}`;
}

function read<T>(key: string | null): T | undefined {
  if (!key) return undefined;
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function write(key: string | null, value: object): void {
  if (!key) return;
  try {
    const clean = Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined && v !== ""));
    if (Object.keys(clean).length === 0) globalThis.localStorage?.removeItem(key);
    else globalThis.localStorage?.setItem(key, JSON.stringify(clean));
  } catch {
    /* storage full or unavailable — the in-memory value still works */
  }
}

const filled = (author?: { name?: string; email?: string }) => !!author && (!!author.name || !!author.email);

/** Store the personal values of a project (an edit, or a file written before 0.16). */
export function rememberLocalSettings(
  projectId: string,
  audit: Audit,
  integration: Integration,
  { onlyMissing = false }: { onlyMissing?: boolean } = {},
): void {
  const storedProject = read<ProjectLocal>(projectKey(projectId)) ?? {};
  const author = audit?.config?.author;
  const nextProject: ProjectLocal = { ...storedProject };
  if (filled(author) && !(onlyMissing && filled(storedProject.auditAuthor))) {
    nextProject.auditAuthor = { name: author!.name ?? "", email: author!.email ?? "" };
  }
  if (integration?.lastSync && !(onlyMissing && storedProject.integrationLastSync)) {
    nextProject.integrationLastSync = integration.lastSync;
  }
  write(projectKey(projectId), nextProject);

  const connection = integration?.connection;
  const key = trackerKey(connection);
  if (!key || !connection) return;
  const storedTracker = read<TrackerLocal>(key) ?? {};
  const fromMemory: TrackerLocal = {
    email: connection.credentials?.email,
    accountId: connection.credentials?.accountId,
    status: connection.status,
    lastTested: connection.lastTested,
    lastError: connection.lastError,
  };
  if (onlyMissing) {
    // Adopt a file's values only for a host this user has never connected to.
    if (storedTracker.email || storedTracker.status) return;
    if (!fromMemory.email && !fromMemory.accountId) return;
  }
  write(key, onlyMissing ? { ...storedTracker, ...fromMemory } : fromMemory);
}

/** The audit block with this user's values (the author is always an object). */
export function withLocalAudit(projectId: string, audit: Audit): Audit {
  if (!audit) return audit;
  const stored = read<ProjectLocal>(projectKey(projectId))?.auditAuthor;
  const author = stored ?? (filled(audit.config?.author) ? audit.config.author : { name: "", email: "" });
  if (audit.config?.author === author) return audit;
  return { ...audit, config: { ...audit.config, author } };
}

/** The integration block with this user's account and connection state. */
export function withLocalIntegration(projectId: string, integration: Integration): Integration {
  if (!integration) return integration;
  const lastSync = read<ProjectLocal>(projectKey(projectId))?.integrationLastSync ?? integration.lastSync;
  const connection = integration.connection;
  if (!connection) return lastSync === integration.lastSync ? integration : { ...integration, lastSync };
  const stored = read<TrackerLocal>(trackerKey(connection)) ?? {};
  const credentials = connection.credentials
    ? {
        ...connection.credentials,
        ...(stored.email ?? connection.credentials.email ? { email: stored.email ?? connection.credentials.email } : {}),
        ...(stored.accountId ?? connection.credentials.accountId
          ? { accountId: stored.accountId ?? connection.credentials.accountId }
          : {}),
      }
    : connection.credentials;
  const lastTested = stored.lastTested ?? connection.lastTested;
  const lastError = stored.lastError ?? connection.lastError;
  return {
    ...integration,
    ...(lastSync ? { lastSync } : {}),
    connection: {
      ...connection,
      credentials,
      // No local state: this user has not connected yet (a teammate's file).
      status: stored.status ?? connection.status ?? "disconnected",
      ...(lastTested ? { lastTested } : {}),
      ...(lastError ? { lastError } : {}),
    },
  };
}
