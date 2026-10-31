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
  type IssueTrackerDescriptor,
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

/** Why the test did not start — the UI shows integration.error.<code> (labels in the UI language). */
export type ConnectFailure = "unavailable" | "hostNotHttps" | "userRequired" | "secretRequired" | "keychain";

export type ConnectResult =
  | (ConnectionTestOutcome & { ref: TrackerRef; credentials: TrackerCredentials })
  | { success: false; message: string; code?: ConnectFailure; projects: [] };

/** English default of each failure; {{host}} / {{user}} / {{secret}} are the form labels. */
export const CONNECT_FAILURE_TEXT: Record<ConnectFailure, string> = {
  unavailable: "This tracker is not available yet.",
  hostNotHttps: "{{host}} must be an https address.",
  userRequired: "{{user}} is required.",
  secretRequired: "{{secret}} is required.",
  keychain: "The token could not be stored in the OS keychain (desktop app required).",
};

/** `message` is the English text with the tracker's English labels; the UI translates by `code`. */
const fail = (code: ConnectFailure, tracker?: IssueTrackerDescriptor): ConnectResult => ({
  success: false,
  code,
  message: CONNECT_FAILURE_TEXT[code]
    .replace("{{host}}", tracker?.hostLabel ?? "")
    .replace("{{user}}", tracker?.userField?.label ?? "User")
    .replace("{{secret}}", tracker?.secretLabel ?? ""),
  projects: [],
});

export async function connectTracker(input: ConnectInput): Promise<ConnectResult> {
  const tracker = issueTracker(input.tool);
  if (!tracker?.available) return fail("unavailable");
  const host = normalizeTrackerHost(input.host);
  if (!host) return fail("hostNotHttps", tracker);
  const account = trackerAccount(tracker, input.user);
  if (!account) return fail("userRequired", tracker);
  if (!input.secret.trim()) return fail("secretRequired", tracker);

  const ref: TrackerRef = { tool: tracker.id as IssueTrackerId, host, account };
  const adapter = adapterFor(ref);
  if (!adapter) return fail("unavailable");
  if (!(await saveTrackerToken(ref, input.secret.trim()))) return fail("keychain");
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
