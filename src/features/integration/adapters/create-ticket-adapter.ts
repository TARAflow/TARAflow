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
import { AzureDevOpsAdapter } from "./azure-devops-adapter";
import { GitHubAdapter } from "./github-adapter";
import { GitLabAdapter } from "./gitlab-adapter";
import { OpenProjectAdapter } from "./openproject-adapter";
import type { TicketAdapter } from "./ticket-adapter";
import type { TrackerRef } from "./tracker-channel";

export function trackerRefOf(connection: Pick<IntegrationConnection, "tool" | "credentials"> | null | undefined): TrackerRef | null {
  const tracker = connection ? issueTracker(connection.tool) : undefined;
  const host = normalizeTrackerHost(connection?.credentials?.baseUrl);
  const account = tracker ? trackerAccount(tracker, connection?.credentials?.email, connection?.credentials?.baseUrl) : null;
  return tracker && host && account ? { tool: tracker.id as IssueTrackerId, host, account } : null;
}

export function adapterFor(ref: TrackerRef): TicketAdapter | null {
  switch (ref.tool) {
    case "jira":
      return new JiraAdapter(ref);
    case "jira-server":
      return new JiraAdapter(ref, "server");
    case "azure-devops":
      return new AzureDevOpsAdapter(ref);
    case "github":
      return new GitHubAdapter(ref);
    case "gitlab":
      return new GitLabAdapter(ref);
    case "openproject":
      return new OpenProjectAdapter(ref);
    default:
      return null; // not available yet (issue-trackers.ts)
  }
}

export function createTicketAdapter(connection: IntegrationConnection | null | undefined): TicketAdapter | null {
  const ref = trackerRefOf(connection);
  return ref ? adapterFor(ref) : null;
}
