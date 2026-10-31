// ==================== JIRA CLOUD ADAPTER ====================
// Jira Cloud on the host-bound channel (adapters design IT-2): replaces
// integration/services/jira-service.ts (connection test, projects) and — from
// IT-3 — risks/services/jira-mitigation-service.ts (tickets). No token here:
// the main process adds it (Basic e-mail:token, issue-trackers.ts).
//
// Status from the status category and the resolution, not from names (design
// §3, [D]) — custom workflows keep working:
//   statusCategory new → todo; indeterminate → in_progress (review when the
//   name says review / test / QA / verify); done → done, or done_without_fix
//   when the resolution says won't fix / won't do / declined / duplicate /
//   rejected / cannot reproduce / invalid / obsolete.
// JQL values are escaped; ticket keys must look like Jira keys.

import {
  ticketStatusOf,
  type CreateTicketInput,
  type CreateTicketResult,
  type TicketCategory,
  type TicketState,
  type TicketSummary,
} from "shared/models/ticket-types";
import type { TrackerProject } from "../models/integration-types";
import type { ConnectionTestOutcome, TicketAdapter } from "./ticket-adapter";
import { trackerRequest, type TrackerRef } from "./tracker-channel";

const WITHOUT_FIX = /won'?t|declin|reject|duplicate|cannot|can't|invalid|obsolete|not a bug|incomplete/i;
const REVIEW = /review|test|qa|verif/i;
const JIRA_KEY = /^[A-Z][A-Z0-9_]*-[0-9]+$/;
const BATCH = 100;

/** Jira status + resolution → normalised ticket state. Pure. */
export function jiraTicketCategory(
  statusName: string,
  statusCategoryKey: string | undefined,
  resolutionName: string | undefined,
): TicketCategory {
  switch (statusCategoryKey) {
    case "new":
      return "todo";
    case "indeterminate":
      return REVIEW.test(statusName) ? "review" : "in_progress";
    case "done":
      return resolutionName && WITHOUT_FIX.test(resolutionName) ? "done_without_fix" : "done";
  }
  // No category (unusual): fall back to the name.
  const name = statusName.toLowerCase();
  if (/done|closed|resolved|complete/.test(name)) return WITHOUT_FIX.test(name) ? "done_without_fix" : "done";
  if (REVIEW.test(name)) return "review";
  if (/progress|doing|active|development|reopen/.test(name)) return "in_progress";
  return "todo";
}

/** A value inside a JQL string literal. */
export const jqlString = (value: string) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

/** Plain text → Atlassian Document Format, one paragraph per line. */
export const atlassianDoc = (text: string) => ({
  type: "doc",
  version: 1,
  content: text.split("\n").map((line) => ({
    type: "paragraph",
    content: line.trim() ? [{ type: "text", text: line }] : [],
  })),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

export class JiraAdapter implements TicketAdapter {
  constructor(readonly ref: TrackerRef) {}

  ticketUrl(key: string): string {
    return `${this.ref.host}/browse/${encodeURIComponent(key)}`;
  }

  async testConnection(): Promise<ConnectionTestOutcome> {
    const me = await trackerRequest<Json>(this.ref, "GET", "/rest/api/3/myself");
    if (!me.ok) {
      return {
        success: false,
        projects: [],
        message:
          me.status === 401 || me.status === 403
            ? "Authentication failed — check e-mail and API token."
            : `Connection failed (${me.status || me.error || "no response"}).`,
      };
    }
    const projects = await trackerRequest<Json[]>(
      this.ref,
      "GET",
      "/rest/api/3/project?expand=insight,description,lead,issueTypes",
    );
    if (!projects.ok) return { success: false, projects: [], message: `Projects could not be loaded (${projects.status}).` };
    const list: TrackerProject[] = (projects.data ?? []).map((p: Json) => ({
      id: String(p.id),
      key: p.key,
      name: p.name,
      projectTypeKey: p.projectTypeKey,
      description: p.description || undefined,
      avatarUrl: p.avatarUrls?.["48x48"],
      lead: p.lead ? { displayName: p.lead.displayName, avatarUrl: p.lead.avatarUrls?.["24x24"] } : undefined,
      insight: p.insight
        ? { totalIssueCount: p.insight.totalIssueCount, lastIssueUpdateTime: p.insight.lastIssueUpdateTime }
        : undefined,
      issueTypes: (p.issueTypes ?? [])
        .filter((t: Json) => !t.subtask)
        .map((t: Json) => ({ id: String(t.id), name: t.name, iconUrl: t.iconUrl })),
    }));
    return {
      success: true,
      projects: list,
      accountId: me.data?.accountId,
      message: `Connected as ${me.data?.displayName ?? this.ref.account} — ${list.length} project(s).`,
    };
  }

  async fetchTickets(projectKey: string, issueType: string): Promise<TicketSummary[]> {
    const typeClause = issueType && issueType !== "__all__" ? ` AND issuetype = ${jqlString(issueType)}` : "";
    const jql = `project = ${jqlString(projectKey)}${typeClause} AND statusCategory != Done ORDER BY updated DESC`;
    // customfield_10020 = sprint on Jira Cloud
    const fields = "summary,status,resolution,issuetype,assignee,priority,customfield_10020";
    const res = await trackerRequest<Json>(
      this.ref,
      "GET",
      `/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&fields=${fields}&maxResults=50`,
    );
    if (!res.ok) return [];
    return (res.data?.issues ?? []).map((issue: Json) => {
      const f = issue.fields ?? {};
      const sprints: Json[] = f.customfield_10020 ?? [];
      const sprint = sprints.find((s) => s.state === "active") ?? sprints[0];
      const category = jiraTicketCategory(f.status?.name ?? "", f.status?.statusCategory?.key, f.resolution?.name);
      return {
        key: issue.key,
        summary: f.summary ?? "",
        status: f.status?.name ?? "",
        ticketStatus: ticketStatusOf(category),
        issueType: f.issuetype?.name ?? "",
        issueTypeIconUrl: f.issuetype?.iconUrl,
        assignee: f.assignee?.displayName,
        assigneeAvatarUrl: f.assignee?.avatarUrls?.["24x24"],
        priority: f.priority?.name,
        priorityIconUrl: f.priority?.iconUrl,
        sprint: sprint?.name,
        url: this.ticketUrl(issue.key),
      };
    });
  }

  async createTicket(input: CreateTicketInput): Promise<CreateTicketResult> {
    // Priority and labels only when given — some projects / screens lack them.
    const fields: Json = {
      project: { key: input.projectKey },
      summary: input.summary,
      issuetype: { name: input.issueType },
      description: atlassianDoc(input.description),
      ...(input.priority ? { priority: { name: input.priority } } : {}),
      ...(input.labels?.length ? { labels: input.labels } : {}),
    };
    const res = await trackerRequest<Json>(this.ref, "POST", "/rest/api/3/issue", { fields });
    if (!res.ok) {
      const errors = res.data?.errors
        ? Object.entries(res.data.errors)
            .map(([k, v]) => `${k}: ${v}`)
            .join(", ")
        : res.data?.errorMessages?.[0] ?? res.error ?? "unknown error";
      return { success: false, error: `Jira error ${res.status}: ${errors}` };
    }
    const key = res.data?.key;
    return { success: true, ticketId: key, ticketUrl: this.ticketUrl(key) };
  }

  async fetchTicketStates(keys: readonly string[]): Promise<Map<string, TicketState>> {
    const valid = [...new Set(keys.filter((k) => JIRA_KEY.test(k)))];
    const states = new Map<string, TicketState>();
    for (let i = 0; i < valid.length; i += BATCH) {
      const chunk = valid.slice(i, i + BATCH);
      const jql = `key in (${chunk.join(",")})`;
      const res = await trackerRequest<Json>(
        this.ref,
        "GET",
        `/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&fields=status,resolution&maxResults=${BATCH}`,
      );
      if (res.ok) {
        for (const issue of res.data?.issues ?? []) this.addState(states, issue);
      } else if (res.status === 400) {
        // One unknown key (a deleted ticket) fails the whole JQL — ask singly.
        for (const key of chunk) {
          const one = await trackerRequest<Json>(
            this.ref,
            "GET",
            `/rest/api/3/issue/${encodeURIComponent(key)}?fields=status,resolution`,
          );
          if (one.ok) this.addState(states, one.data);
        }
      }
    }
    return states;
  }

  private addState(states: Map<string, TicketState>, issue: Json): void {
    const f = issue?.fields ?? {};
    if (!issue?.key) return;
    states.set(issue.key, {
      key: issue.key,
      category: jiraTicketCategory(f.status?.name ?? "", f.status?.statusCategory?.key, f.resolution?.name),
      raw: f.status?.name ?? "",
      ...(f.resolution?.name ? { resolution: f.resolution.name } : {}),
    });
  }
}
