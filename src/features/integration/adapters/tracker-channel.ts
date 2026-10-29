// ==================== TRACKER CHANNEL ====================
// The renderer side of the host-bound channel (adapters design §3.1 / §4.1):
// requests name tool, host and account; the main process adds the token. No
// function here ever sees a token after it was handed to saveToken.

import type { IssueTrackerId } from "shared/models/issue-trackers";

export interface TrackerRef {
  tool: IssueTrackerId;
  /** https origin, normalised (normalizeTrackerHost). */
  host: string;
  /** user (lower case) or "default" (trackerAccount). */
  account: string;
}

export interface TrackerResponse<T = any> {
  ok: boolean;
  status: number;
  data: T;
  error?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api = () => (window as any).electronAPI?.integration;

export async function trackerRequest<T = any>(
  ref: TrackerRef,
  method: "GET" | "POST" | "PUT",
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
): Promise<TrackerResponse<T>> {
  const channel = api();
  if (!channel) return { ok: false, status: 0, data: null as T, error: "desktop app required" };
  return channel.request({ ...ref, method, path, ...(body !== undefined ? { body } : {}), ...(headers ? { headers } : {}) });
}

export async function saveTrackerToken(ref: TrackerRef, token: string): Promise<boolean> {
  const result = await api()?.saveToken({ ...ref, token });
  return !!result?.success;
}

export async function hasTrackerToken(ref: TrackerRef): Promise<boolean> {
  const result = await api()?.hasToken(ref);
  return !!result?.hasToken;
}

export async function deleteTrackerToken(ref: TrackerRef): Promise<void> {
  await api()?.deleteToken(ref);
}
