// ==================== GITHUB ISSUES ADAPTER ====================
// GitHub Issues on the host-bound channel (adapters design §4, 0.18). No
// token here: the main process adds it (Bearer PAT, issue-trackers.ts).
//
//   "project"         a repository, key "owner/repo" (GitHub has no issue
//                     types: the type of the Integration tab is a label —
//                     "Issue" = no label)
//   ticket key        "owner/repo#123"
//   status            open / closed with the close reason: completed →
//                     done; not_planned / duplicate → done_without_fix; an
//                     open issue with a label for progress or review is in
//                     progress / review
//   batch             one GraphQL query for all keys (aliases per repo and
//                     issue)
//   GitHub Enterprise Server: REST under /api/v3, GraphQL at /api/graphql

import {
  ticketStatusOf,
  type CreateTicketInput,
  type CreateTicketResult,
  type TicketCategory,
  type TicketQuery,
  type TicketState,
  type TicketSummary,
} from "shared/models/ticket-types";
import type { TrackerProject } from "../models/integration-types";
import type { ConnectionTestOutcome, TicketAdapter } from "./ticket-adapter";
import { trackerRequest, type TrackerRef } from "./tracker-channel";
import { chunks, connectionFailure, noted, REVIEW, WITHOUT_FIX } from "./adapter-support";

const HEADERS = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
const ISSUE_KEY = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)#([1-9][0-9]*)$/;
const PLAIN_ISSUE = "Issue";
const BATCH = 50;
const IN_PROGRESS = /progress|doing|wip|active/i;

/** GitHub state + close reason + labels → normalised ticket state. Pure. */
export function githubTicketCategory(state: string, stateReason: string | null | undefined, labels: readonly string[] = []): TicketCategory {
  if (state.toLowerCase() === "closed") {
    const reason = (stateReason ?? "").toLowerCase();
    return reason === "not_planned" || reason === "duplicate" || labels.some((l) => WITHOUT_FIX.test(l)) ? "done_without_fix" : "done";
  }
  if (labels.some((l) => REVIEW.test(l))) return "review";
  if (labels.some((l) => IN_PROGRESS.test(l))) return "in_progress";
  return "todo";
}

/** "owner/repo#12" → its parts; undefined for anything else. */
export function parseIssueKey(key: string): { owner: string; repo: string; number: number } | undefined {
  const m = ISSUE_KEY.exec(key);
  return m ? { owner: m[1], repo: m[2], number: Number(m[3]) } : undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

export class GitHubAdapter implements TicketAdapter {
  constructor(readonly ref: TrackerRef) {}

  /** github.com: api.github.com without prefix; Enterprise Server: /api/v3. */
  private get rest(): string {
    return this.ref.host === "https://api.github.com" ? "" : "/api/v3";
  }

  private get graphql(): string {
    return this.ref.host === "https://api.github.com" ? "/graphql" : "/api/graphql";
  }

  private get web(): string {
    return this.ref.host === "https://api.github.com" ? "https://github.com" : this.ref.host;
  }

  ticketUrl(key: string): string {
    const k = parseIssueKey(key);
    return k ? `${this.web}/${k.owner}/${k.repo}/issues/${k.number}` : this.web;
  }

  async testConnection(): Promise<ConnectionTestOutcome> {
    const me = await trackerRequest<Json>(this.ref, "GET", `${this.rest}/user`, undefined, HEADERS);
    if (!me.ok) return { success: false, projects: [], ...noted(connectionFailure(me, "pat")) };
    const repos = await trackerRequest<Json[]>(this.ref, "GET", `${this.rest}/user/repos?per_page=100&sort=updated`, undefined, HEADERS);
    if (!repos.ok) return { success: false, projects: [], ...noted({ code: "listFailed", status: repos.status, unit: "repositories" }) };
    const projects: TrackerProject[] = (repos.data ?? [])
      .filter((r: Json) => r.has_issues !== false)
      .map((r: Json) => ({
        id: String(r.id),
        key: r.full_name,
        name: r.full_name,
        description: r.description || undefined,
        avatarUrl: r.owner?.avatar_url,
        insight: typeof r.open_issues_count === "number" ? { totalIssueCount: r.open_issues_count } : undefined,
        issueTypes: [{ id: PLAIN_ISSUE, name: PLAIN_ISSUE }],
      }));
    return {
      success: true,
      projects,
      ...(me.data?.id ? { accountId: String(me.data.id) } : {}),
      ...noted({ code: "connected", account: me.data?.login ?? this.ref.account, count: projects.length, unit: "repositories" }),
    };
  }

  async fetchTickets(projectKey: string, issueType: string, query: TicketQuery = {}): Promise<TicketSummary[]> {
    const typed = issueType && issueType !== "__all__" && issueType !== PLAIN_ISSUE;
    const scope = query.scope ?? "active";
    const state = scope === "active" ? "open" : scope === "done" ? "closed" : "all";
    const text = query.text?.trim().replace(/^#/, "") ?? "";
    let issues: Json[];
    if (text) {
      // The list endpoint has no text filter: the search API ("in:title" plus
      // the number — "#12" or "12" finds issue 12 too).
      const q = [
        `repo:${projectKey}`,
        "is:issue",
        ...(state === "all" ? [] : [`state:${state}`]),
        ...(typed ? [`label:"${issueType.replace(/"/g, "")}"`] : []),
        /^\d+$/.test(text) ? text : `${text} in:title`,
      ].join(" ");
      const res = await trackerRequest<Json>(this.ref, "GET", `${this.rest}/search/issues?q=${encodeURIComponent(q)}&sort=updated&per_page=50`, undefined, HEADERS);
      if (!res.ok) return [];
      issues = res.data?.items ?? [];
    } else {
      const label = typed ? `&labels=${encodeURIComponent(issueType)}` : "";
      const res = await trackerRequest<Json[]>(
        this.ref,
        "GET",
        `${this.rest}/repos/${projectKey.split("/").map(encodeURIComponent).join("/")}/issues?state=${state}&sort=updated&per_page=50${label}`,
        undefined,
        HEADERS,
      );
      if (!res.ok) return [];
      issues = res.data ?? [];
    }
    return issues
      .filter((i: Json) => !i.pull_request)
      .map((i: Json) => {
        const labels = (i.labels ?? []).map((l: Json) => (typeof l === "string" ? l : l.name));
        const key = `${projectKey}#${i.number}`;
        return {
          key,
          summary: i.title ?? "",
          status: i.state ?? "",
          ticketStatus: ticketStatusOf(githubTicketCategory(i.state ?? "", i.state_reason, labels)),
          issueType: labels[0] ?? PLAIN_ISSUE,
          assignee: i.assignee?.login,
          assigneeAvatarUrl: i.assignee?.avatar_url,
          sprint: i.milestone?.title,
          url: i.html_url ?? this.ticketUrl(key),
        };
      });
  }

  async createTicket(input: CreateTicketInput): Promise<CreateTicketResult> {
    const labels = [...(input.labels ?? []), ...(input.issueType && input.issueType !== PLAIN_ISSUE ? [input.issueType] : [])];
    const res = await trackerRequest<Json>(
      this.ref,
      "POST",
      `${this.rest}/repos/${input.projectKey.split("/").map(encodeURIComponent).join("/")}/issues`,
      { title: input.summary, body: input.description, ...(labels.length ? { labels } : {}) },
      HEADERS,
    );
    if (!res.ok) return { success: false, error: `GitHub error ${res.status}: ${res.data?.message ?? res.error ?? "unknown error"}` };
    const key = `${input.projectKey}#${res.data?.number}`;
    return { success: true, ticketId: key, ticketUrl: res.data?.html_url ?? this.ticketUrl(key) };
  }

  async fetchTicketStates(keys: readonly string[]): Promise<Map<string, TicketState>> {
    const parsed = [...new Set(keys)].map((key) => ({ key, k: parseIssueKey(key) })).filter((x) => !!x.k) as { key: string; k: NonNullable<ReturnType<typeof parseIssueKey>> }[];
    const states = new Map<string, TicketState>();
    for (const chunk of chunks(parsed, BATCH)) {
      // One alias per issue; the values are checked by ISSUE_KEY and quoted as JSON strings.
      const fields = chunk
        .map(({ k }, i) => `i${i}: repository(owner: ${JSON.stringify(k.owner)}, name: ${JSON.stringify(k.repo)}) { issue(number: ${k.number}) { state stateReason labels(first: 20) { nodes { name } } } }`)
        .join(" ");
      const res = await trackerRequest<Json>(this.ref, "POST", this.graphql, { query: `query { ${fields} }` }, HEADERS);
      if (!res.ok) continue;
      chunk.forEach(({ key }, i) => {
        const issue = res.data?.data?.[`i${i}`]?.issue;
        if (!issue) return; // deleted or no access — left out
        const labels = (issue.labels?.nodes ?? []).map((n: Json) => n.name);
        states.set(key, {
          key,
          category: githubTicketCategory(issue.state ?? "", issue.stateReason, labels),
          raw: issue.state ?? "",
          ...(issue.stateReason ? { resolution: String(issue.stateReason).toLowerCase().replace(/_/g, " ") } : {}),
        });
      });
    }
    return states;
  }
}
