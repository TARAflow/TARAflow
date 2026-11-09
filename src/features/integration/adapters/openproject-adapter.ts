// ==================== OPENPROJECT ADAPTER ====================
// OpenProject work packages on the host-bound channel (adapters design §4,
// 0.18, API v3). No token here: the main process adds it (Basic
// apikey:<key>, issue-trackers.ts).
//
//   "project"         a project, key = its identifier; issue types = the
//                     project's work package types
//   ticket key        the work package id ("123")
//   status            OpenProject statuses carry isClosed: a closed status
//                     is done — or done without fix when its name says so
//                     (rejected, duplicate, won't fix …); an open status is
//                     review / in progress / to do by its name. The
//                     statuses are read once (/api/v3/statuses).
//   batch             one filtered query for all ids (100 per call); the
//                     status filter "*" is explicit — without it the API
//                     returns open work packages only

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

const API = "/api/v3";
const BATCH = 100;
const WORK_PACKAGE_ID = /^[1-9][0-9]*$/;
const IN_PROGRESS = /progress|develop|doing|active|confirmed|scheduled/i;

/** OpenProject status name + isClosed → normalised ticket state. Pure. */
export function openProjectTicketCategory(statusName: string, isClosed: boolean | undefined): TicketCategory {
  if (isClosed) return WITHOUT_FIX.test(statusName) ? "done_without_fix" : "done";
  if (REVIEW.test(statusName)) return "review";
  if (IN_PROGRESS.test(statusName)) return "in_progress";
  return "todo";
}

const filters = (list: unknown[]) => `filters=${encodeURIComponent(JSON.stringify(list))}`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

export class OpenProjectAdapter implements TicketAdapter {
  private statuses: Map<string, { name: string; isClosed: boolean }> | undefined;
  private readonly types = new Map<string, Map<string, string>>();

  constructor(readonly ref: TrackerRef) {}

  ticketUrl(key: string): string {
    return `${this.ref.host}/work_packages/${encodeURIComponent(key)}`;
  }

  async testConnection(): Promise<ConnectionTestOutcome> {
    const me = await trackerRequest<Json>(this.ref, "GET", `${API}/users/me`);
    if (!me.ok || me.data?._type === "AnonymousUser") {
      return { success: false, projects: [], ...noted(connectionFailure(me.ok ? { ...me, status: 401 } : me, "apiKey")) };
    }
    const res = await trackerRequest<Json>(this.ref, "GET", `${API}/projects?pageSize=100`);
    if (!res.ok) return { success: false, projects: [], ...noted({ code: "listFailed", status: res.status, unit: "projects" }) };
    const projects: TrackerProject[] = [];
    for (const p of res.data?._embedded?.elements ?? []) {
      const types = await this.projectTypes(p.identifier);
      projects.push({
        id: String(p.id),
        key: p.identifier,
        name: p.name,
        description: p.description?.raw || undefined,
        issueTypes: [...types].map(([name, id]) => ({ id, name })),
      });
    }
    return {
      success: true,
      projects,
      ...(me.data?.id ? { accountId: String(me.data.id) } : {}),
      ...noted({ code: "connected", account: me.data?.name ?? this.ref.account, count: projects.length, unit: "projects" }),
    };
  }

  async fetchTickets(projectKey: string, issueType: string, query: TicketQuery = {}): Promise<TicketSummary[]> {
    const typeId = issueType && issueType !== "__all__" ? (await this.projectTypes(projectKey)).get(issueType) : undefined;
    const scope = query.scope ?? "active";
    const text = query.text?.trim().replace(/^#/, "") ?? "";
    // status "o" = open, "c" = closed; subjectOrId "**" = contains (the id too).
    const list = [
      ...(scope === "all" ? [] : [{ status: { operator: scope === "active" ? "o" : "c", values: [] } }]),
      ...(typeId ? [{ type: { operator: "=", values: [typeId] } }] : []),
      ...(text ? [{ subjectOrId: { operator: "**", values: [text] } }] : []),
    ];
    const res = await trackerRequest<Json>(
      this.ref,
      "GET",
      `${API}/projects/${encodeURIComponent(projectKey)}/work_packages?${filters(list)}&sortBy=${encodeURIComponent('[["updatedAt","desc"]]')}&pageSize=50`,
    );
    if (!res.ok) return [];
    const out: TicketSummary[] = [];
    for (const wp of res.data?._embedded?.elements ?? []) {
      const status = await this.status(wp._links?.status?.href, wp._links?.status?.title);
      out.push({
        key: String(wp.id),
        summary: wp.subject ?? "",
        status: status.name,
        ticketStatus: ticketStatusOf(openProjectTicketCategory(status.name, status.isClosed)),
        issueType: wp._links?.type?.title ?? "",
        assignee: wp._links?.assignee?.title,
        priority: wp._links?.priority?.title,
        sprint: wp._links?.version?.title,
        url: this.ticketUrl(String(wp.id)),
      });
    }
    return out;
  }

  async createTicket(input: CreateTicketInput): Promise<CreateTicketResult> {
    const typeId = (await this.projectTypes(input.projectKey)).get(input.issueType);
    const res = await trackerRequest<Json>(this.ref, "POST", `${API}/projects/${encodeURIComponent(input.projectKey)}/work_packages`, {
      subject: input.summary,
      description: { format: "markdown", raw: input.description },
      ...(typeId ? { _links: { type: { href: `${API}/types/${typeId}` } } } : {}),
    });
    if (!res.ok) return { success: false, error: `OpenProject error ${res.status}: ${res.data?.message ?? res.error ?? "unknown error"}` };
    const key = String(res.data?.id);
    return { success: true, ticketId: key, ticketUrl: this.ticketUrl(key) };
  }

  async fetchTicketStates(keys: readonly string[]): Promise<Map<string, TicketState>> {
    const ids = [...new Set(keys.filter((k) => WORK_PACKAGE_ID.test(k)))];
    const states = new Map<string, TicketState>();
    for (const chunk of chunks(ids, BATCH)) {
      const list = [{ status: { operator: "*", values: [] } }, { id: { operator: "=", values: chunk } }];
      const res = await trackerRequest<Json>(this.ref, "GET", `${API}/work_packages?${filters(list)}&pageSize=${BATCH}`);
      if (!res.ok) continue;
      for (const wp of res.data?._embedded?.elements ?? []) {
        const status = await this.status(wp._links?.status?.href, wp._links?.status?.title);
        const category = openProjectTicketCategory(status.name, status.isClosed);
        states.set(String(wp.id), {
          key: String(wp.id),
          category,
          raw: status.name,
          ...(category === "done_without_fix" ? { resolution: status.name } : {}),
        });
      }
    }
    return states;
  }

  /** A status by its link; all statuses are read once. */
  private async status(href: string | undefined, title: string | undefined): Promise<{ name: string; isClosed: boolean | undefined }> {
    if (!this.statuses) {
      const res = await trackerRequest<Json>(this.ref, "GET", `${API}/statuses`);
      this.statuses = new Map(
        (res.ok ? res.data?._embedded?.elements ?? [] : []).map((s: Json) => [s._links?.self?.href ?? `${API}/statuses/${s.id}`, { name: s.name, isClosed: !!s.isClosed }]),
      );
    }
    const known = href ? this.statuses.get(href) : undefined;
    return known ?? { name: title ?? "", isClosed: undefined };
  }

  /** Work package types of a project: name → id, read once per project. */
  private async projectTypes(project: string): Promise<Map<string, string>> {
    let types = this.types.get(project);
    if (!types) {
      const res = await trackerRequest<Json>(this.ref, "GET", `${API}/projects/${encodeURIComponent(project)}/types`);
      types = new Map((res.ok ? res.data?._embedded?.elements ?? [] : []).map((t: Json) => [t.name, String(t.id)]));
      this.types.set(project, types);
    }
    return types;
  }
}
