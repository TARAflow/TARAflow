// ==================== CONNECT A TRACKER ====================
// The connection test of the Integration tab (adapters design §4.4): the
// secret goes to the main process's keychain under tool + host + account,
// the adapter tests the connection through the host-bound channel, and a
// failed test removes the secret again. What comes back for the project holds
// no secret.

import {
  issueTracker,
  normalizeTrackerHost,
  trackerAccount,
  type IssueTrackerId,
} from "shared/models/issue-trackers";
import { adapterFor } from "../adapters/create-ticket-adapter";
import type { ConnectionTestOutcome } from "../adapters/ticket-adapter";
import { deleteTrackerToken, saveTrackerToken, type TrackerRef } from "../adapters/tracker-channel";
import type { TrackerCredentials } from "../models/integration-types";

export interface ConnectInput {
  tool: string;
  host: string;
  user?: string;
  secret: string;
}

export type ConnectResult =
  | (ConnectionTestOutcome & { ref: TrackerRef; credentials: TrackerCredentials })
  | { success: false; message: string; projects: [] };

const fail = (message: string): ConnectResult => ({ success: false, message, projects: [] });

export async function connectTracker(input: ConnectInput): Promise<ConnectResult> {
  const tracker = issueTracker(input.tool);
  if (!tracker?.available) return fail("This tracker is not available yet.");
  const host = normalizeTrackerHost(input.host);
  if (!host) return fail(`${tracker.hostLabel} must be an https address.`);
  const account = trackerAccount(tracker, input.user);
  if (!account) return fail(`${tracker.userField?.label ?? "User"} is required.`);
  if (!input.secret.trim()) return fail(`${tracker.secretLabel} is required.`);

  const ref: TrackerRef = { tool: tracker.id as IssueTrackerId, host, account };
  const adapter = adapterFor(ref);
  if (!adapter) return fail("This tracker is not available yet.");
  if (!(await saveTrackerToken(ref, input.secret.trim()))) {
    return fail("The token could not be stored in the OS keychain (desktop app required).");
  }
  const outcome = await adapter.testConnection();
  if (!outcome.success) {
    await deleteTrackerToken(ref);
    return { ...outcome, projects: [] } as ConnectResult;
  }
  return {
    ...outcome,
    ref,
    credentials: {
      authMethod: "pat",
      baseUrl: host,
      ...(tracker.userField ? { email: account } : {}),
      ...(outcome.accountId ? { accountId: outcome.accountId } : {}),
    },
  };
}
