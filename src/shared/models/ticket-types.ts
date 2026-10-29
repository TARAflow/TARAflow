// ==================== TICKET TYPES ====================
// What the Risk tab and the issue-tracker adapters exchange (adapters design
// doc/InProgress/Integration/issue-tracker-adapters.md §4.2). In shared so
// that neither feature imports the other; the app wires an adapter into the
// Risk tab.

/** Ticket status as stored on a mitigation (SelectedMitigation.ticketStatus). */
export type TicketStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "REVIEW"
  | "CLOSED"
  /** Closed without the fix — won't fix / won't do / declined / duplicate (design §3.2). */
  | "DECLINED"
  | "UNKNOWN";

/** A tracker's state of a ticket, normalised by its adapter. */
export type TicketCategory = "todo" | "in_progress" | "review" | "done" | "done_without_fix";

export interface TicketState {
  key: string;
  category: TicketCategory;
  /** The tracker's own status name, for display. */
  raw: string;
  /** Resolution (Jira) or close reason, when the tracker reports one. */
  resolution?: string;
}

export function ticketStatusOf(category: TicketCategory): TicketStatus {
  switch (category) {
    case "todo":
      return "OPEN";
    case "in_progress":
      return "IN_PROGRESS";
    case "review":
      return "REVIEW";
    case "done":
      return "CLOSED";
    case "done_without_fix":
      return "DECLINED";
  }
}

/** Compact ticket info when listing existing tickets. */
export interface TicketSummary {
  key: string;
  summary: string;
  status: string;
  ticketStatus: TicketStatus;
  issueType: string;
  issueTypeIconUrl?: string;
  assignee?: string;
  assigneeAvatarUrl?: string;
  priority?: string;
  priorityIconUrl?: string;
  sprint?: string;
  url: string;
}

export interface CreateTicketInput {
  projectKey: string;
  issueType: string;
  summary: string;
  description: string;
  priority?: string;
  labels?: string[];
}

export interface CreateTicketResult {
  success: boolean;
  ticketId?: string;
  ticketUrl?: string;
  error?: string;
}
