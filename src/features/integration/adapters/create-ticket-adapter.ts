// ==================== ADAPTER FACTORY ====================
// The adapter of a stored connection (adapters design §4.2). The reference
// (tool, host, account) is derived from the project's connection; the main
// process only finds a token when exactly this reference was saved by a
// connection test on this machine — a host from a crafted file finds none.

import {
  issueTracker,
  normalizeTrackerHost,
  trackerAccount,
  type IssueTrackerId,
} from "shared/models/issue-trackers";
import type { IntegrationConnection } from "../models/integration-types";
import { JiraAdapter } from "./jira-adapter";
import type { TicketAdapter } from "./ticket-adapter";
import type { TrackerRef } from "./tracker-channel";

export function trackerRefOf(connection: Pick<IntegrationConnection, "tool" | "credentials"> | null | undefined): TrackerRef | null {
  const tracker = connection ? issueTracker(connection.tool) : undefined;
  const host = normalizeTrackerHost(connection?.credentials?.baseUrl);
  const account = tracker ? trackerAccount(tracker, connection?.credentials?.email) : null;
  return tracker && host && account ? { tool: tracker.id as IssueTrackerId, host, account } : null;
}

export function adapterFor(ref: TrackerRef): TicketAdapter | null {
  switch (ref.tool) {
    case "jira":
      return new JiraAdapter(ref);
    default:
      return null; // from 0.17
  }
}

export function createTicketAdapter(connection: IntegrationConnection | null | undefined): TicketAdapter | null {
  const ref = trackerRefOf(connection);
  return ref ? adapterFor(ref) : null;
}
