// ==================== GITLAB ISSUES ADAPTER ====================
// GitLab issues on the host-bound channel (adapters design §4, 0.18). No
// token here: the main process adds it (PRIVATE-TOKEN, issue-trackers.ts).
// gitlab.com or a self-managed instance, API v4.
//
//   "project"         a project, key = its full path "group/sub/project";
//                     the type of the Integration tab is a label ("Issue" =
//                     none) — GitLab Free has no issue types
//   ticket key        "group/project#iid"
//   status            opened / closed; GitLab gives no close reason, so a
//                     won't-fix label (won't fix, duplicate, invalid …)
//                     marks closed without fix; open issues with a progress
//                     / review label (also scoped ones like
//                     "workflow::in review") are in progress / review
//   batch             per project one request with iids[] (100 per call)

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
import { chunks, connectionFailure, REVIEW, WITHOUT_FIX } from "./adapter-support";

const API = "/api/v4";
const ISSUE_KEY = /^([A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)+)#([1-9][0-9]*)$/;
const PLAIN_ISSUE = "Issue";
const BATCH = 100;
const IN_PROGRESS = /progress|doing|wip|active/i;

/** GitLab state + labels → normalised ticket state. Pure. */
export function gitlabTicketCategory(state: string, labels: readonly string[] = []): TicketCategory {
  if (state === "closed") return labels.some((l) => WITHOUT_FIX.test(l)) ? "done_without_fix" : "done";
  if (labels.some((l) => REVIEW.test(l))) return "review";
  if (labels.some((l) => IN_PROGRESS.test(l))) return "in_progress";
  return "todo";
}

/** "group/project#12" → its parts; undefined for anything else. */
export function parseGitLabKey(key: string): { project: string; iid: number } | undefined {
  const m = ISSUE_KEY.exec(key);
  return m ? { project: m[1], iid: Number(m[2]) } : undefined;
}

const projectPath = (fullPath: string) => `${API}/projects/${encodeURIComponent(fullPath)}`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

export class GitLabAdapter implements TicketAdapter {
  constructor(readonly ref: TrackerRef) {}

  ticketUrl(key: string): string {
    const k = parseGitLabKey(key);
    return k ? `${this.ref.host}/${k.project}/-/issues/${k.iid}` : this.ref.host;
  }

  async testConnection(): Promise<ConnectionTestOutcome> {
    const me = await trackerRequest<Json>(this.ref, "GET", `${API}/user`);
    if (!me.ok) return { success: false, projects: [], message: connectionFailure(me, "check the personal access token") };
    const res = await trackerRequest<Json[]>(this.ref, "GET", `${API}/projects?membership=true&order_by=last_activity_at&per_page=100&simple=true`);
    if (!res.ok) return { success: false, projects: [], message: `Projects could not be loaded (${res.status}).` };
    const projects: TrackerProject[] = (res.data ?? [])
      .filter((p: Json) => p.issues_enabled !== false)
      .map((p: Json) => ({
        id: String(p.id),
        key: p.path_with_namespace,
        name: p.name_with_namespace ?? p.path_with_namespace,
        description: p.description || undefined,
        avatarUrl: p.avatar_url || undefined,
        issueTypes: [{ id: PLAIN_ISSUE, name: PLAIN_ISSUE }],
      }));
    return {
      success: true,
      projects,
      ...(me.data?.id ? { accountId: String(me.data.id) } : {}),
      message: `Connected as ${me.data?.username ?? this.ref.account} — ${projects.length} project(s).`,
    };
  }

  async fetchTickets(projectKey: string, issueType: string): Promise<TicketSummary[]> {
    const label = issueType && issueType !== "__all__" && issueType !== PLAIN_ISSUE ? `&labels=${encodeURIComponent(issueType)}` : "";
    const res = await trackerRequest<Json[]>(this.ref, "GET", `${projectPath(projectKey)}/issues?state=opened&order_by=updated_at&per_page=50${label}`);
    if (!res.ok) return [];
    return (res.data ?? []).map((i: Json) => {
      const key = `${projectKey}#${i.iid}`;
      const labels: string[] = i.labels ?? [];
      return {
        key,
        summary: i.title ?? "",
        status: i.state ?? "",
        ticketStatus: ticketStatusOf(gitlabTicketCategory(i.state ?? "", labels)),
        issueType: labels[0] ?? PLAIN_ISSUE,
        assignee: i.assignee?.name,
        assigneeAvatarUrl: i.assignee?.avatar_url,
        sprint: i.milestone?.title ?? i.iteration?.title,
        url: i.web_url ?? this.ticketUrl(key),
      };
    });
  }

  async createTicket(input: CreateTicketInput): Promise<CreateTicketResult> {
    const labels = [...(input.labels ?? []), ...(input.issueType && input.issueType !== PLAIN_ISSUE ? [input.issueType] : [])];
    const res = await trackerRequest<Json>(this.ref, "POST", `${projectPath(input.projectKey)}/issues`, {
      title: input.summary,
      description: input.description,
      ...(labels.length ? { labels: labels.join(",") } : {}),
    });
    if (!res.ok) return { success: false, error: `GitLab error ${res.status}: ${JSON.stringify(res.data?.message ?? res.error ?? "unknown error")}` };
    const key = `${input.projectKey}#${res.data?.iid}`;
    return { success: true, ticketId: key, ticketUrl: res.data?.web_url ?? this.ticketUrl(key) };
  }

  async fetchTicketStates(keys: readonly string[]): Promise<Map<string, TicketState>> {
    const byProject = new Map<string, number[]>();
    for (const key of new Set(keys)) {
      const k = parseGitLabKey(key);
      if (k) byProject.set(k.project, [...(byProject.get(k.project) ?? []), k.iid]);
    }
    const states = new Map<string, TicketState>();
    for (const [project, iids] of byProject) {
      for (const chunk of chunks(iids, BATCH)) {
        const query = chunk.map((iid) => `iids[]=${iid}`).join("&");
        const res = await trackerRequest<Json[]>(this.ref, "GET", `${projectPath(project)}/issues?${query}&per_page=${BATCH}`);
        if (!res.ok) continue;
        for (const issue of res.data ?? []) {
          const key = `${project}#${issue.iid}`;
          const labels: string[] = issue.labels ?? [];
          const withoutFix = labels.find((l) => WITHOUT_FIX.test(l));
          states.set(key, {
            key,
            category: gitlabTicketCategory(issue.state ?? "", labels),
            raw: issue.state ?? "",
            ...(issue.state === "closed" && withoutFix ? { resolution: withoutFix } : {}),
          });
        }
      }
    }
    return states;
  }
}
