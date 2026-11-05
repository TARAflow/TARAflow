// ==================== ADAPTER SUPPORT ====================
// What every tracker adapter needs and no adapter should repeat (user
// 2026-11-03: one adapter per tracker, no duplicated code): the words that
// mean "closed without a fix" or "in review", the fallback category from a
// status name, batching, plain text as HTML, and the error text of a failed
// request. Tracker specifics (endpoints, fields, native status model) stay in
// the tracker's own adapter.

import type { TicketCategory } from "shared/models/ticket-types";
import type { TrackerResponse } from "./tracker-channel";

/** A resolution / reason that closes a ticket without fixing it. */
export const WITHOUT_FIX = /won'?t|declin|reject|duplicate|cannot|can't|invalid|obsolete|not a bug|incomplete|\bcut\b|removed/i;

/** A status name inside "in progress" that means review / test. */
export const REVIEW = /review|test|qa|verif/i;

/** The category from a status name alone — when the tracker gives no status category. */
export function categoryFromName(statusName: string, reason?: string): TicketCategory {
  const name = statusName.toLowerCase();
  if (/done|closed|resolved|complete/.test(name)) return WITHOUT_FIX.test(`${name} ${reason ?? ""}`) ? "done_without_fix" : "done";
  if (REVIEW.test(name)) return "review";
  if (/progress|doing|active|development|reopen|committed/.test(name)) return "in_progress";
  if (/removed/.test(name)) return "done_without_fix";
  return "todo";
}

/** A list in slices of `size`. */
export function chunks<T>(list: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Plain text → HTML, one paragraph per line, escaped (trackers with HTML descriptions). */
export const htmlParagraphs = (text: string) =>
  text
    .split("\n")
    .map((line) => (line.trim() ? `<p>${escapeHtml(line)}</p>` : "<p></p>"))
    .join("");

// ==================== CONNECTION TEST NOTE ====================
// What a connection test reports, as a code with parameters: the Integration
// tab shows it in the UI language (integration.connection.<code>), `message`
// keeps the English sentence (logs, tests).

/** What the connection test asks the user to check when the tracker refuses the login. */
export type AuthHint = "pat" | "emailApiToken" | "organizationPat" | "apiKey";

/** What a tracker lists for the project choice. */
export type TrackerListUnit = "projects" | "repositories";

export type ConnectionNote =
  | { code: "connected"; account: string; count: number; unit: TrackerListUnit }
  | { code: "authFailed"; hint: AuthHint }
  | { code: "connectionFailed"; detail: string }
  | { code: "listFailed"; status: number; unit: TrackerListUnit };

const AUTH_HINT_TEXT: Record<AuthHint, string> = {
  pat: "check the personal access token",
  emailApiToken: "check e-mail and API token",
  organizationPat: "check the organization URL and the personal access token",
  apiKey: "check the API key",
};

/** The English sentence of a note — the stored / logged form and the UI fallback. */
export function connectionNoteEnglish(note: ConnectionNote): string {
  switch (note.code) {
    case "connected":
      return `Connected as ${note.account} — ${note.count} ${note.unit === "repositories" ? "repositories" : "project(s)"}.`;
    case "authFailed":
      return `Authentication failed — ${AUTH_HINT_TEXT[note.hint]}.`;
    case "connectionFailed":
      return `Connection failed (${note.detail}).`;
    case "listFailed":
      return `${note.unit === "repositories" ? "Repositories" : "Projects"} could not be loaded (${note.status}).`;
  }
}

/** A note with its English sentence, as the connection test returns it. */
export const noted = (note: ConnectionNote) => ({ note, message: connectionNoteEnglish(note) });

/** The note of a failed login request: refused (401 / 403) or not reached. */
export function connectionFailure(res: TrackerResponse, hint: AuthHint): ConnectionNote {
  return res.status === 401 || res.status === 403
    ? { code: "authFailed", hint }
    : { code: "connectionFailed", detail: String(res.status || res.error || "no response") };
}
