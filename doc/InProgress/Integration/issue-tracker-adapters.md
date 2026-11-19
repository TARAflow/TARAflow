# Issue-tracker integration — adapters, secure channel, ticket sync

**Status:** v5 · 2026-11-10 · IT-1 … IT-14 done (§5) — Jira Cloud, Jira Server / DC, Azure DevOps, GitHub, GitLab, OpenProject; Polarion 0.19 · branch `feature/iso21434-item-definition`,
release 0.16.0-beta (Jira); further trackers 0.17
**Replaces:** `doc/Open/Integration/HANDOVER_Integration_Adapter_v1.md` (removed — it
predates the OAuth services, the 0.15.2 token fix and the security findings below, and
only renamed the proxy).
**Related:** 0.15.2-beta (tokens out of the project file, secret-scan hooks);
`doc/Done/Threat/closed-loop-review.md` (mitigation status drives the closed loop).

---

## 1. Today

| Part | Code | What it does |
|---|---|---|
| Integration tab | `features/integration/components/integration-tab.tsx`, `jira-config.tsx`, `ado-config.tsx` (+ unused `ado-config-with-oauth.tsx`) | Jira: URL, e-mail, API token, connection test, project cards. ADO: org URL, PAT, test. OAuth radio buttons for both |
| Services | `integration/services/jira-service.ts`, `ado-service.ts`, `oauth-jira-service.ts`, `oauth-ado-service.ts`, `integration-service.ts` (switch facade) | connection test, project list, ADO work items |
| Risk tab | `risks/services/jira-mitigation-service.ts`, `risk-mitigation-status-dialog.tsx`, `risks-tab.tsx` | Jira only: fetch / create tickets, link a mitigation, status sync |
| IPC | `electron/ipc/jira-handlers.ts`, preload `jiraRequest`, `jira.{save,get,delete}Token` | fetch proxy (CORS), keychain `TARAFlow / jira:<account>` |
| Project data | `project.integration` (`IntegrationData`), `SelectedMitigation.ticketId / ticketUrl / ticketStatus / ticketSyncedAt` | connection without secrets (0.15.2), mapping, links |

## 2. Findings (2026-10-29)

1. **Token not bound to a host.** The keychain key is the account (accountId or e-mail);
   the request target is `credentials.baseUrl` from the project file. A crafted
   `.tara.json` with another `baseUrl` and the victim's account makes the background
   sync send the victim's token to that host. Project files are shared with customers.
2. **Open proxy, token in the renderer.** `jira:request` fetches any URL with any headers;
   `jira:getToken` hands the raw token to the renderer.
3. **Background sync can overwrite edits.** The Risk tab's 5 s interval reads a stale
   snapshot of the risks ("stale closure is acceptable") and writes all of them back into
   local state; the result is never persisted (`onUpdate` deliberately skipped).
4. **Status mapping.** Ticket → mitigation status overwrites every sync: `verified`
   becomes `implemented` again while the ticket stays Done, `rejected` becomes `open`
   while the ticket is open, and "Won't fix" maps to `implemented`.
5. **Polling.** Every 5 s one request per linked ticket (Risk tab), plus a second 5 s
   interval in the status dialog — rate limits on larger projects.
6. **OAuth not usable.** Client id and secret are empty, yet the Jira form preselects
   OAuth as "Recommended". A client secret cannot be kept secret in a desktop app.
7. **Two code paths.** `integration-service` (Jira + ADO) and
   `risks/jira-mitigation-service` (Jira) each build auth and requests; the Risk tab casts
   any connection to Jira credentials, an ADO connection included.
8. **Leak (fixed in 0.15.2):** the token reached the project file; no secret scan in
   audit repositories.

## 3. Decisions (user 2026-10-29)

1. **The token lives in the main process only, bound to its host.** Adapters (queries,
   mapping, status logic) run in the renderer; every HTTP call goes through a new channel
   `integration:request` with `{ tool, host, account, method, path, body }`. The main
   process looks up the token under `integration:<tool>:<host>:<account>`, sets the
   authorization itself and refuses any other host. The renderer never sees a token; a
   foreign `baseUrl` in a project file gets none.
2. **The mitigation status mirrors the ticket — in both directions** (a reopen in Jira
   sets the mitigation back). Two rules:
   - **Only a change of the ticket is applied.** The last seen ticket status
     (`ticketStatus`) is kept; while the ticket does not change, what the analyst set
     (`verified`, `rejected`) stays.
   - **Mapping:** done without fix (Won't fix / Won't do / Declined / Duplicate /
     Rejected) → `rejected`, with the ticket as rationale; done → `implemented`; reopened
     or in progress → `in_progress`; review → `in_review`; to do → `open`.
3. **Sync on opening the Risk tab and on "Sync now"** — one batch request (Jira: JQL
   `key in (…)`), no polling; the result is stored through `onUpdate` (status changes are
   project content and go into the audit), applied to the current risks, not a snapshot.
4. **Scope 0.16.0:** the fixes above, the secure channel, the adapter interface and
   factory, Jira as the first adapter; OAuth removed from the UI (API token / PAT only).
   ADO, GitHub, GitLab, Polarion, OpenProject as adapters in 0.17.
5. **Old code is removed, not kept alongside** (user): the handover document, the OAuth
   services and hook, `ado-config-with-oauth.tsx`, the duplicate Jira services, the IPC
   channels `jira:request` / `jira:getToken` / `jira:saveToken` / `jira:deleteToken`, and
   the ADO stub (`ado-service.ts`, `ado-config.tsx`, the ADO tab) — the ADO adapter of
   0.17 is written new on the interface.

Further choices [D] (to confirm in review):

- **Keychain migration:** no automatic move of old `jira:<account>` entries — the old key
  has no host, and taking the host from a project file is exactly finding 1. After the
  update the Integration tab asks for one connection test; the old entry is deleted then.
- **Status from Jira's status category and resolution**, not from status names alone:
  `statusCategory` new / indeterminate / done plus `resolution` decide; the name only
  distinguishes review inside "indeterminate" (`review`, `testing`, `qa`). Custom
  workflows keep working.
- **Rejected by ticket:** `rejectedByTicket` = `{ key, resolution }`, shown as "Ticket
  <key> closed as <resolution>" in the UI language (IT-6); the analyst can add a
  `rejectionReason` of their own.
- **Main-side allowlist:** methods GET / POST / PUT, path relative to the host, JSON
  bodies only; the main process strips any `Authorization` / `Cookie` header from the
  renderer.

## 4. Design

### 4.1 Channel and keychain (main process)

```
integration:saveToken   { tool, host, account, token } → keychain integration:<tool>:<host>:<account>
integration:hasToken    { tool, host, account } → boolean
integration:deleteToken { tool, host, account }
integration:request     { tool, host, account, method, path, body? } → { ok, status, data }
```

`host` is the origin (`https://company.atlassian.net`), normalised (lower case, no
trailing slash). `request` builds `host + path`, refuses absolute or protocol-relative
paths, and sets the tool's authorization (Jira: `Basic base64(email:token)` — the account
is the e-mail for the header, the accountId only names the key —; ADO 0.17: `Basic
base64(:pat)`; GitHub 0.17: `Bearer`).

### 4.2 Adapter (renderer)

```ts
interface TicketAdapter {
  readonly tool: IntegrationTool;
  testConnection(input: ConnectionInput): Promise<ConnectionTestResult>; // saves the token
  fetchIssueTypes(projectKey: string): Promise<IssueType[]>;
  fetchTickets(projectKey: string, issueType: string, query?: TicketQuery): Promise<TicketSummary[]>; // IT-13: scope + text
  createTicket(input: CreateTicketInput): Promise<CreateTicketResult>;
  fetchTicketStates(keys: string[]): Promise<Map<string, TicketState>>; // one batch
}
createTicketAdapter(connection: IntegrationConnection): TicketAdapter | null
```

`TicketState = { key, category: "todo" | "in_progress" | "review" | "done" | "done_without_fix", raw: string }`.
The pure function `applyTicketStates(mitigations, states, now)` implements decision 2 for
every tracker; adapters only map their native fields to `TicketState`.

### 4.3 Risk tab

- Sync on open and "Sync now" (toolbar, with the time of the last sync); the status
  dialog syncs its one ticket on open and on demand — no intervals.
- Changes through `onUpdate`; nothing kept only in local state.
- A mitigation set to `rejected` by its ticket shows the ticket as the reason.

### 4.4 Integration tab — one tab, one form (user 2026-10-29)

Authentication is the same everywhere in substance — instance URL, for some trackers a
user, and a secret; trackers differ only in the fields and the header scheme. So there is
**one** Integration tab with a tracker selector and **one** form built from a description
per tracker (`shared/models/issue-trackers.ts`: label, host label / default host, user
field, secret label, header scheme). The main process takes the header scheme from the
same description. A new tracker in 0.17 is a row there plus its adapter — no new tab, no
new form; the per-tracker tabs and forms (`jira-config.tsx`, `ado-config.tsx`) go.

| Tracker | Fields | Header (main process) |
|---|---|---|
| Jira Cloud | URL, e-mail, API token | `Basic base64(email:token)` |
| Jira Server / DC | URL, PAT | `Bearer <pat>` |
| Azure DevOps | organization URL, PAT | `Basic base64(:pat)` |
| GitHub | API URL (default api.github.com), PAT | `Bearer <pat>` |
| GitLab | URL, PAT | `PRIVATE-TOKEN: <pat>` |
| Polarion | URL, token | `Bearer <token>` |
| OpenProject | URL, API key | `Basic base64(apikey:key)` |

- 0.16: Jira Cloud selectable; the others listed with "from 0.17". No OAuth.
- After the update with an old keychain entry: "Run the connection test once — the token
  is now bound to this Jira instance."

## 5. Steps

| Step | Content | Patch | Status |
|---|---|---|---|
| IT-1 | Main process: `integration:saveToken / hasToken / deleteToken / request` (`electron/ipc/integration-handlers.ts`, `electron/services/integration-request.ts`): keychain `integration:<tool>:<host>:<account>`, https origin only, path on that host, GET / POST / PUT, renderer headers filtered (no Authorization / Cookie), auth header set in main from the tracker description, redirects not followed; tracker descriptions (`shared/models/issue-trackers.ts`, §4.4); preload and `electronAPI.integration` types. No handler returns a token. | 203 | done |
| IT-2 | `TicketAdapter` and factory (`integration/adapters/`), `JiraAdapter` on the host-bound channel — status from category + resolution, escaped JQL, one batch for ticket states (single-key fallback on 400), ADF descriptions —, `connectTracker` (secret to the keychain, test, removed again on failure); the **one Integration tab / one form** (§4.4) with project cards, disconnect and the re-test notice; ticket types in `shared/models/ticket-types.ts` (`TicketStatus` gains `DECLINED`). Removed: `jira-service`, `integration-service`, `ado-service`, both OAuth services and their hook, `jira-config`, `ado-config(-with-oauth)`, `use-integration-connection`, the OAuth deep-link handler and bridge (the single-instance lock it carried moved to `electron/single-instance.ts`, unchanged) | 204 | done |
| IT-3 | The app derives the adapter from the stored connection and passes it to the Risk tab as `TicketPort` (`shared/models/ticket-types.ts`) — no feature imports the other. `risks/services/ticket-sync.ts`: decision 2 (only a ticket change is applied, both directions, done without fix → rejected with the ticket as reason; `ticketSyncedAt` only on a change — no file churn), `applyTicketStatesToRisks` through `riskService.updateRisk`. Risk tab: one batch on opening and "Sync ticket status" in the toolbar, persisted by the auto-save; the 5 s interval and its stale snapshot are gone. Status dialog: the port instead of credentials, one sync on opening, linking / creating adopt the ticket's state; the status select stays visible with a linked ticket ("follows SCRUM-1 when it changes"); mitigations keyed by `mitigationSelectionKey` (keyed by id, a ticket was linked to every custom mitigation at once). Issue types of the chosen project are stored with the connection. Removed: `jira-mitigation-service` (ticket texts moved to `ticket-text.ts`), the `jira:*` IPC channels, bridges, types and keychain methods; legacy `jira:<account>` keychain entries are deleted when a bound Jira token is saved | 205 | done |
| IT-4/5 | Merged (user 2026-10-30): what IT-4 planned came with IT-3 (ticket links on the adapter URL, rejected-by-ticket rationale). Integration test over the whole chain (`src/tests/integration/integration/issue-tracker-chain.int.test.ts`): connection test → token in the keychain bound to its reference, none in the project → stored connection → adapter → main-process request (token added, host enforced) → ticket states → mitigation status; a crafted host gets no token and sends nothing. CHANGELOG / release note with the 0.16.0 release patch (users run the connection test once after the update) | 206 | done |
| IT-6 | Review 2026-10-30, i18n: the form labels come from i18n (`integration.host.<id>`, `integration.user.<kind>`, `integration.secret.<id>`; the descriptions keep the English defaults, `tracker-labels.ts`); the connection test's own errors carry a code (`integration.error.<code>`, the English message stays for other callers); the project cards' issue count; a ticket closed without fix stores its reason as data — `rejectedByTicket: { key, resolution }` instead of an English sentence in `rejectionReason`, rendered in the UI language, counted as the reason, dropped when the ticket moves on (hash and merge treat it with the ticket fields). Ticket texts sent to the tracker stay English (older, separate step) | 215 | done |

| IT-8 | **Azure DevOps** (0.18, user 2026-11-03): `AzureDevOpsAdapter` (REST 7.1) — connection test `connectionData` + projects with their work item types; tickets to link by WIQL (escaped, newest first, open ones kept); create by JSON Patch (`application/json-patch+json`, HTML description, tags, numeric priority only); ticket states in one batch of 200 (`errorPolicy=omit`), the state **category** (Proposed / InProgress / Resolved / Completed / Removed, read once per project and type) decides, the reason marks a completed item closed without fix. The organization is the account: `accountFromUrl: "azure-organization"` reads it from `https://dev.azure.com/<org>` or `<org>.visualstudio.com`, so the PAT is bound to host **and** organization; the connection keeps the organization URL. Shared pieces for every adapter in `adapter-support.ts` (without-fix / review words, name fallback, batching, HTML paragraphs, connection failure text) — the Jira adapter uses them too (user: one adapter per tracker, no duplicated code). Tests: `azure-devops-adapter.test.ts`, `issue-tracker-chain-ado.int.test.ts` (another organization or host gets no token) | 34 | done |

| IT-7 | **Jira Server / Data Center** (0.18): the Jira adapter in a second flavour — REST v2 (`/rest/api/2/…`, `/search`), wiki-markup descriptions, no fixed sprint field, PAT as Bearer (account "default", bound to the host); no second adapter. Trackers built and tested against recorded answers only carry `preview` in `issue-trackers.ts` — the form marks them until a real run confirmed them (user 2026-11-03: every tracker except Polarion in 0.18, real tests over time) | 35 | done (preview) |

| IT-9 | **GitHub Issues** (0.18, preview): `GitHubAdapter` — repositories as projects (key `owner/repo`; GitHub has no issue types: the type is a label, "Issue" = none), ticket key `owner/repo#n`; state + close reason (completed → done; not_planned / duplicate, or a won't-fix label → closed without fix), open issues with a progress / review label; ticket states in one GraphQL query (aliases; owner / repo checked by pattern before they enter the query); Enterprise Server under `/api/v3` and `/api/graphql`. Main process lets `X-GitHub-Api-Version` pass | 36 | done (preview) |

| IT-10 | **GitLab Issues** (0.18, preview): `GitLabAdapter` (API v4, gitlab.com or self-managed) — projects by full path (`group/sub/project`), the type is a label ("Issue" = none), key `group/project#iid`; opened / closed — GitLab has no close reason, so a won't-fix / duplicate / invalid label marks closed without fix; review / progress labels (scoped ones too); states per project in one request with `iids[]` | 37 | done (preview) |

| IT-11 | **OpenProject** (0.18, preview, API v3): `OpenProjectAdapter` — projects by identifier with their work package types, key = work package id; statuses carry `isClosed` (read once): closed = done, or closed without fix under a rejecting name; open statuses by name (review / in progress / to do); ticket states in one filtered query with the status filter `*` (the default returns open ones only); markdown descriptions, type by name | 38 | done (preview) |

| IT-12 | **Status by hand, with evidence** (0.19, user 2026-11-10): the status stays manual; with a tracker connected, a done status (`in_review`, `implemented`, `verified`) without a linked ticket needs an evidence note or a reference — the status dialog does not save without it, offline nothing changes (`risks/services/mitigation-evidence.ts`). Evidence and reference are offered whenever no ticket is linked (before: only offline, so with a tracker a status could be set without anything); "set by hand" next to the status, "follows SCRUM-1 when it changes" with a ticket. Risk finding `doneWithoutEvidence` (warning, with a tracker only; the stored validation does not depend on it). Per mitigation one ticket row (`mitigation-ticket-row.tsx`): linked → the ticket card; not linked → "No ticket — Link… / Create…", linking and creating in their own dialog — the status dialog stays short, the tracker is asked for tickets only when linking | 65 | done |
| IT-13 | **Link dialog** (0.19, user 2026-11-10, `ticket-link-dialog.tsx`): search (key or text) and status filter — open (default), in progress, done, all; done tickets stay reachable to link a mitigation afterwards —, type; "Suggested" = tickets linked to the same mitigation on other risks, from the project's own data (`risks/services/ticket-links.ts`); tickets linked already are marked ("linked with M-T-001 · P1-T-1 (+2)") and listed after the free ones, hiding them is a choice (off); a click chooses, "Link KEY" links (double click links at once); nothing found → "Create a new ticket"; every text of the ticket row and both dialogs through i18n. `fetchTickets(projectKey, type, { scope, text })` (`TicketQuery`, default scope "active" = before): Jira `statusCategory` + `text ~`, a key in a request of its own (an unknown key fails the whole JQL); GitHub `state=` on the list, with text the search API (`in:title`, a number as the issue); GitLab `state=` + `search` / `iids[]`; OpenProject status `o` / `c` + `subjectOrId **`; Azure DevOps `[System.Title] CONTAINS` / `[System.Id]`, the scope filtered per item by its state category (WIQL has none — "done" sees the 50 most recently changed items only) | 66 | done |
| IT-14 | **Progress from the ticket** (0.19, user 2026-11-10): with a linked ticket the status dialog offers only what the ticket cannot say — "verified" once the ticket is done (the TARA's step after the fix), "rejected" always (with a reason), the ticket's own status (back to it) and the current one; open / in progress / in review / implemented are greyed: changed in the tracker ("progress comes from SCRUM-12 — change it in the tracker"). "Follow SCRUM-12 again" when the status differs from the ticket's. TARAflow does not move tickets: workflows and transitions differ per project and tracker, and one source of progress stays (decision 2 unchanged). `ticket-sync.ts`: `statusFromTicket`, `selectableWithTicket`, `differsFromTicket` | 67 | done |

Every tracker except Polarion is in 0.18 (preview until a real run). Polarion (REST v1) moves
to 0.19 (user 2026-11-03).
