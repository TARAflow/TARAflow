// ==================== AZURE DEVOPS ADAPTER ====================
// Azure Boards work items on the host-bound channel (adapters design §4,
// IT-8, REST API 7.1). No token here: the main process adds it (Basic with an
// empty user and the PAT, issue-trackers.ts). The organization is the
// account of the reference — the token is bound to host + organization.
//
//   connection test   _apis/connectionData, then the projects with their
//                     work item types
//   tickets to link   WIQL on the project and type, newest first; the open
//                     ones are kept
//   create            POST _apis/wit/workitems/$<type>, JSON Patch, HTML
//   status            one batch _apis/wit/workitems?ids=… (200 per call);
//                     the state's CATEGORY decides (Proposed / InProgress /
//                     Resolved / Completed / Removed — the same for Agile,
//                     Scrum, CMMI and custom processes), read once per
//                     project and work item type; the reason marks a
//                     completed item closed without fix (won't fix,
//                     obsolete, duplicate, cut …)

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
import { categoryFromName, chunks, connectionFailure, noted, htmlParagraphs, WITHOUT_FIX } from "./adapter-support";

const API = "api-version=7.1";
const BATCH = 200;
const WORK_ITEM_ID = /^[1-9][0-9]*$/;

/** Azure DevOps state category + reason → normalised ticket state. Pure. */
export function azureTicketCategory(stateName: string, stateCategory: string | undefined, reason: string | undefined): TicketCategory {
  switch (stateCategory) {
    case "Proposed":
      return "todo";
    case "InProgress":
      return "in_progress";
    case "Resolved":
      return "review";
    case "Completed":
      return reason && WITHOUT_FIX.test(reason) ? "done_without_fix" : "done";
    case "Removed":
      return "done_without_fix";
  }
  return categoryFromName(stateName, reason);
}

/** A value inside a WIQL string literal (single quotes doubled). */
export const wiqlString = (value: string) => `'${value.replace(/'/g, "''")}'`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

export class AzureDevOpsAdapter implements TicketAdapter {
  /** State categories per "project|type". */
  private readonly categories = new Map<string, Map<string, string>>();

  constructor(readonly ref: TrackerRef) {}

  /** Path of the organization: /<org> on dev.azure.com, empty on <org>.visualstudio.com. */
  private get base(): string {
    return this.ref.host.endsWith("//dev.azure.com") ? `/${encodeURIComponent(this.ref.account)}` : "";
  }

  private project(name: string): string {
    return `${this.base}/${encodeURIComponent(name)}`;
  }

  ticketUrl(key: string): string {
    return `${this.ref.host}${this.base}/_workitems/edit/${encodeURIComponent(key)}`;
  }

  async testConnection(): Promise<ConnectionTestOutcome> {
    const me = await trackerRequest<Json>(this.ref, "GET", `${this.base}/_apis/connectionData?${API}`);
    if (!me.ok) return { success: false, projects: [], ...noted(connectionFailure(me, "organizationPat")) };
    const res = await trackerRequest<Json>(this.ref, "GET", `${this.base}/_apis/projects?${API}`);
    if (!res.ok) return { success: false, projects: [], ...noted({ code: "listFailed", status: res.status, unit: "projects" }) };
    const projects: TrackerProject[] = [];
    for (const p of res.data?.value ?? []) {
      const types = await trackerRequest<Json>(this.ref, "GET", `${this.project(p.name)}/_apis/wit/workitemtypes?${API}`);
      projects.push({
        id: String(p.id),
        key: p.name,
        name: p.name,
        description: p.description || undefined,
        issueTypes: (types.ok ? types.data?.value ?? [] : [])
          .filter((t: Json) => !t.isDisabled)
          .map((t: Json) => ({ id: t.referenceName ?? t.name, name: t.name, iconUrl: t.icon?.url })),
      });
    }
    const user = me.data?.authenticatedUser;
    return {
      success: true,
      projects,
      ...(user?.id ? { accountId: String(user.id) } : {}),
      ...noted({ code: "connected", account: user?.providerDisplayName ?? this.ref.account, count: projects.length, unit: "projects" }),
    };
  }

  async fetchTickets(projectKey: string, issueType: string, ticketQuery: TicketQuery = {}): Promise<TicketSummary[]> {
    const typeClause = issueType && issueType !== "__all__" ? ` AND [System.WorkItemType] = ${wiqlString(issueType)}` : "";
    const scope = ticketQuery.scope ?? "active";
    // A number finds that work item; words search the title.
    const text = ticketQuery.text?.trim().replace(/^#/, "") ?? "";
    const textClause = !text
      ? ""
      : /^\d+$/.test(text)
        ? ` AND ([System.Id] = ${Number(text)} OR [System.Title] CONTAINS ${wiqlString(text)})`
        : ` AND [System.Title] CONTAINS ${wiqlString(text)}`;
    const query = `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = ${wiqlString(projectKey)}${typeClause}${textClause} ORDER BY [System.ChangedDate] DESC`;
    const res = await trackerRequest<Json>(this.ref, "POST", `${this.project(projectKey)}/_apis/wit/wiql?$top=50&${API}`, { query });
    if (!res.ok) return [];
    const ids = (res.data?.workItems ?? []).map((w: Json) => String(w.id));
    const items = await this.workItems(ids, [
      "System.Title", "System.State", "System.Reason", "System.WorkItemType", "System.TeamProject",
      "System.AssignedTo", "Microsoft.VSTS.Common.Priority", "System.IterationPath",
    ]);
    const out: TicketSummary[] = [];
    for (const item of items) {
      const f = item.fields ?? {};
      const category = await this.category(f);
      // The state category is known only per item: the scope filters here.
      const done = category === "done" || category === "done_without_fix";
      if ((scope === "active" && done) || (scope === "done" && !done)) continue;
      out.push({
        key: String(item.id),
        summary: f["System.Title"] ?? "",
        status: f["System.State"] ?? "",
        ticketStatus: ticketStatusOf(category),
        issueType: f["System.WorkItemType"] ?? "",
        assignee: f["System.AssignedTo"]?.displayName,
        priority: f["Microsoft.VSTS.Common.Priority"] !== undefined ? String(f["Microsoft.VSTS.Common.Priority"]) : undefined,
        sprint: f["System.IterationPath"],
        url: this.ticketUrl(String(item.id)),
      });
    }
    return out;
  }

  async createTicket(input: CreateTicketInput): Promise<CreateTicketResult> {
    const patch: Json[] = [
      { op: "add", path: "/fields/System.Title", value: input.summary },
      { op: "add", path: "/fields/System.Description", value: htmlParagraphs(input.description) },
      ...(input.labels?.length ? [{ op: "add", path: "/fields/System.Tags", value: input.labels.join("; ") }] : []),
      // Priority is a number 1 – 4 in Azure Boards; names (Jira) are left out.
      ...(input.priority && /^[1-4]$/.test(input.priority)
        ? [{ op: "add", path: "/fields/Microsoft.VSTS.Common.Priority", value: Number(input.priority) }]
        : []),
    ];
    const res = await trackerRequest<Json>(
      this.ref,
      "POST",
      `${this.project(input.projectKey)}/_apis/wit/workitems/$${encodeURIComponent(input.issueType)}?${API}`,
      patch,
      { "Content-Type": "application/json-patch+json" },
    );
    if (!res.ok) return { success: false, error: `Azure DevOps error ${res.status}: ${res.data?.message ?? res.error ?? "unknown error"}` };
    const key = String(res.data?.id);
    return { success: true, ticketId: key, ticketUrl: this.ticketUrl(key) };
  }

  async fetchTicketStates(keys: readonly string[]): Promise<Map<string, TicketState>> {
    const ids = [...new Set(keys.filter((k) => WORK_ITEM_ID.test(k)))];
    const items = await this.workItems(ids, ["System.State", "System.Reason", "System.WorkItemType", "System.TeamProject"]);
    const states = new Map<string, TicketState>();
    for (const item of items) {
      const f = item.fields ?? {};
      states.set(String(item.id), {
        key: String(item.id),
        category: await this.category(f),
        raw: f["System.State"] ?? "",
        ...(f["System.Reason"] ? { resolution: f["System.Reason"] } : {}),
      });
    }
    return states;
  }

  /** Work items by id, `BATCH` per request; unknown ids (deleted items) are left out. */
  private async workItems(ids: readonly string[], fields: readonly string[]): Promise<Json[]> {
    const out: Json[] = [];
    for (const chunk of chunks(ids, BATCH)) {
      const res = await trackerRequest<Json>(
        this.ref,
        "GET",
        `${this.base}/_apis/wit/workitems?ids=${chunk.join(",")}&fields=${fields.join(",")}&errorPolicy=omit&${API}`,
      );
      if (res.ok) out.push(...(res.data?.value ?? []).filter(Boolean));
    }
    return out;
  }

  /** The category of a work item's state, from its type's states (read once per project and type). */
  private async category(fields: Json): Promise<TicketCategory> {
    const project = fields["System.TeamProject"];
    const type = fields["System.WorkItemType"];
    const state = fields["System.State"] ?? "";
    let byState = this.categories.get(`${project}|${type}`);
    if (!byState && project && type) {
      const res = await trackerRequest<Json>(
        this.ref,
        "GET",
        `${this.project(project)}/_apis/wit/workitemtypes/${encodeURIComponent(type)}/states?${API}`,
      );
      byState = new Map((res.ok ? res.data?.value ?? [] : []).map((s: Json) => [s.name, s.category]));
      this.categories.set(`${project}|${type}`, byState);
    }
    return azureTicketCategory(state, byState?.get(state), fields["System.Reason"]);
  }
}
