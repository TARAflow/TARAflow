# TARAflow — Integration Feature Handover
## Adapter Pattern for Multi-Tool Ticket Integration

**Version:** 1.0  
**Status:** Design & Planning — PoC (Jira) complete  
**Priority:** ADO → GitHub → GitLab / Polarion / OpenProject

---

## 1. Current State (Jira PoC)

### What Works
- Jira Cloud PAT authentication via OS keychain (keytar)
- Connection test with rich project cards (icon, description, issue count, lead, issue types)
- `fetchJiraTickets()` — JQL search with issue type filter, sprint/priority/assignee
- `createJiraTicket()` — ADF description, EARS-style template pre-fill
- `syncTicketStatus()` / `syncAllMitigationTickets()` — batch sync, 5s interval in dialog
- `RiskMitigationStatusDialog` — dual-mode (offline / Jira), linked ticket card, auto-sync

### Known Limitations
- Only Jira Cloud supported (no Jira Server / Data Center)
- ADO, GitHub, GitLab, Polarion, OpenProject not yet implemented
- `integration-types.ts` mixes Jira- and ADO-specific credential types in one file
- Integration Tab still renders as ADO/Jira tabs — needs redesign (see Section 5)

### File Structure
```
src/features/integration/
  models/
    integration-types.ts          ← shared types (to be split, see Section 3)
  services/
    integration-service.ts        ← facade (to be refactored to factory)
    jira-service.ts               ← Jira connection + project fetch
    ado-service.ts                ← ADO stub (incomplete)
  hooks/
    use-integration-connection.ts ← state management for Integration Tab
  components/
    integration-tab.tsx           ← main tab (to be redesigned)
    jira-config.tsx               ← Jira-specific config form
    ado-config.tsx                ← ADO config form (stub)

src/features/risks/
  models/
    risk-integration-types.ts     ← minimal ticket types for Risk Tab
                                    (TicketStatus, TicketSummary, CreateTicketInput,
                                     CreateTicketResult, TicketSyncResult,
                                     RiskIntegrationConnection)
  services/
    jira-mitigation-service.ts    ← ticket CRUD + sync for Risk Tab
                                    (to become jira-adapter.ts)
```

---

## 2. Adapter Pattern Design

### 2.1 Core Interface

```typescript
// src/features/integration/adapters/ticket-adapter.ts

export interface ITicketAdapter {
  // ── Connection ────────────────────────────────────────────────────────────
  
  /**
   * Test authentication and fetch available projects.
   * Token is never passed — always retrieved from OS keychain.
   */
  testConnection(): Promise<ConnectionTestResult & { accountId?: string }>;

  // ── Project metadata ──────────────────────────────────────────────────────

  /**
   * Fetch issue/work item types for the selected project.
   * Called after project selection in Integration Tab.
   */
  fetchIssueTypes(projectKey: string): Promise<IssueType[]>;

  // ── Ticket operations ─────────────────────────────────────────────────────

  /**
   * Fetch open tickets filtered by issue type.
   * issueType = "__all__" means no filter.
   */
  fetchTickets(
    projectKey: string,
    issueType: string,
  ): Promise<TicketSummary[]>;

  /**
   * Create a new ticket in the selected project.
   * Returns ticket key/ID and direct URL.
   */
  createTicket(input: CreateTicketInput): Promise<CreateTicketResult>;

  /**
   * Fetch current status for a single ticket.
   * Maps tool-specific status to internal TicketStatus.
   */
  syncTicketStatus(ticketId: string): Promise<TicketSyncResult | null>;

  /**
   * Batch sync all mitigations that have a linked ticketId.
   * Returns updated mitigations — caller merges into Risk state.
   */
  syncAllTickets(
    mitigations: SelectedMitigation[],
  ): Promise<SelectedMitigation[]>;
}
```

### 2.2 Factory

```typescript
// src/features/integration/adapters/ticket-adapter-factory.ts

export function createTicketAdapter(
  connection: RiskIntegrationConnection,
): ITicketAdapter | null {
  switch (connection.tool) {
    case "jira":          return new JiraAdapter(connection);
    case "azure-devops":  return new AdoAdapter(connection);
    case "github":        return new GithubAdapter(connection);
    case "gitlab":        return new GitlabAdapter(connection);
    case "polarion":      return new PolarionAdapter(connection);
    case "openproject":   return new OpenProjectAdapter(connection);
    default:              return null;
  }
}
```

### 2.3 Base Class (optional, reduces boilerplate)

```typescript
// src/features/integration/adapters/base-adapter.ts

export abstract class BaseTicketAdapter implements ITicketAdapter {
  protected credentials: RiskIntegrationConnection;

  constructor(connection: RiskIntegrationConnection) {
    this.credentials = connection;
  }

  /** Fetch token from OS keychain — accountId preferred, email fallback */
  protected async getToken(): Promise<string | null> {
    const key = this.credentials.credentials?.accountId
              ?? this.credentials.credentials?.email;
    if (!key) return null;
    const result = await (window as any).electronAPI.jira.getToken(key);
    return result?.token ?? null;
  }

  /** All HTTP calls go through Electron IPC proxy to avoid CORS */
  protected async request(
    url: string,
    options: { method: string; headers: Record<string, string>; body?: string },
  ): Promise<{ ok: boolean; status: number; data: any }> {
    return (window as any).electronAPI.jiraRequest({ url, options });
  }

  abstract testConnection(): Promise<ConnectionTestResult>;
  abstract fetchIssueTypes(projectKey: string): Promise<IssueType[]>;
  abstract fetchTickets(projectKey: string, issueType: string): Promise<TicketSummary[]>;
  abstract createTicket(input: CreateTicketInput): Promise<CreateTicketResult>;
  abstract syncTicketStatus(ticketId: string): Promise<TicketSyncResult | null>;

  async syncAllTickets(
    mitigations: SelectedMitigation[],
  ): Promise<SelectedMitigation[]> {
    const withTickets = mitigations.filter((m) => !!m.ticketId);
    if (!withTickets.length) return mitigations;

    const results = await Promise.allSettled(
      withTickets.map((m) => this.syncTicketStatus(m.ticketId!)),
    );

    return mitigations.map((m) => {
      if (!m.ticketId) return m;
      const idx = withTickets.findIndex((wt) => wt.ticketId === m.ticketId);
      const result = results[idx];
      if (result?.status !== "fulfilled" || !result.value) return m;
      const { ticketStatus, mappedMitigationStatus, syncedAt } = result.value;
      return {
        ...m,
        ticketStatus,
        status: mappedMitigationStatus ?? m.status,
        ticketSyncedAt: syncedAt,
      };
    });
  }
}
```

### 2.4 Refactoring jira-mitigation-service.ts → JiraAdapter

`jira-mitigation-service.ts` becomes `adapters/jira-adapter.ts` implementing `ITicketAdapter`.  
`jira-service.ts` (connection test + project fetch) gets folded into `JiraAdapter.testConnection()`.

---

## 3. Type File Split

### Current problem
`integration-types.ts` mixes generic types (`IntegrationConnection`, `IntegrationData`) with tool-specific credential shapes (`JiraCredentials`, `AzureDevOpsCredentials`). Adding 4 more tools would make it unmanageable.

### Target structure

```
src/features/integration/models/
  integration-types.ts              ← shared/generic only
  credentials/
    jira-credentials.ts             ← JiraCredentials, JiraProject
    ado-credentials.ts              ← AzureDevOpsCredentials, AzureDevOpsProject
    github-credentials.ts           ← GitHubCredentials, GitHubRepo
    gitlab-credentials.ts           ← GitLabCredentials, GitLabProject
    polarion-credentials.ts         ← PolarionCredentials, PolarionProject
    openproject-credentials.ts      ← OpenProjectCredentials, OpenProjectProject
```

### `integration-types.ts` (generic only, after split)

```typescript
// Stays in integration-types.ts:
export type IntegrationTool =
  | "jira"
  | "azure-devops"
  | "github"
  | "gitlab"
  | "polarion"
  | "openproject";

export type ConnectionStatus = "disconnected" | "connected" | "error" | "testing";
export type AuthMethod = "pat" | "oauth" | "basic" | "apikey";

export interface IntegrationConnection {
  tool: IntegrationTool;
  status: ConnectionStatus;
  credentials: Record<string, string | undefined> | null;  // opaque — adapter reads
  lastTested?: string;
  lastError?: string;
  projectName?: string;
  projectKey?: string;
}

export interface IntegrationData {
  connection: IntegrationConnection | null;
  mapping: TicketMapping | null;
  lastSync?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  projects?: ExternalProject[];
  accountId?: string;
}

export interface TicketMapping {
  mustPriority: string;
  shouldPriority: string;
  couldPriority: string;
  wontPriority: string;
  workItemType: string;
  defaultLabels?: string[];
}

export interface ExternalProject {
  id: string;
  key?: string;
  name: string;
  projectTypeKey?: string;
  description?: string;
  avatarUrl?: string;
  issueTypes?: IssueType[];
}

export interface IssueType {
  id: string;
  name: string;
  iconUrl?: string;
  subtask?: boolean;
}

export interface IntegrationTabData {
  integration: IntegrationData | null;
}
```

### Per-tool credential files (example)

```typescript
// credentials/jira-credentials.ts
export interface JiraCredentials {
  authMethod: "pat" | "oauth";
  baseUrl: string;
  email?: string;
  accountId?: string;       // keychain key (stable)
  cloudId?: string;         // OAuth only
  accessToken?: string;     // OAuth only
  projectKey?: string;
}

// credentials/ado-credentials.ts
export interface AdoCredentials {
  authMethod: "pat" | "oauth";
  organizationUrl: string;
  email?: string;
  accountId?: string;       // keychain key
  projectName?: string;
}

// credentials/github-credentials.ts
export interface GitHubCredentials {
  authMethod: "pat" | "oauth";
  baseUrl: string;           // https://api.github.com or GHE URL
  owner: string;             // org or user
  accountId?: string;        // keychain key (= GitHub login)
}

// credentials/polarion-credentials.ts
export interface PolarionCredentials {
  authMethod: "basic" | "pat";
  baseUrl: string;           // https://company.polarion.com/polarion
  projectId: string;         // Polarion project ID (not display name)
  username?: string;
  accountId?: string;        // keychain key
}
```

---

## 4. Tool-Specific API Notes

### Azure DevOps (Priority 1)

| Aspect | Detail |
|---|---|
| Base URL | `https://dev.azure.com/{org}` or on-premise |
| Auth (PAT) | `Basic base64(:token)` — no email, just token |
| Auth (OAuth) | Azure AD OAuth 2.0 |
| Projects | `GET /_apis/projects?api-version=7.0` |
| Work items | `POST /_apis/wit/wiql` (WIQL query) |
| Create | `POST /{project}/_apis/wit/workitems/$Task?api-version=7.0` — JSON Patch format |
| Status field | `System.State` (To Do / Doing / Done — customizable) |
| Issue types | Called "Work Item Types": Bug, Task, User Story, Epic, Feature |
| Sprint | `System.IterationPath` |
| IPC proxy | Same `jira:request` handler works — rename to `integration:request` |

**Important:** ADO Create uses JSON Patch (`application/json-patch+json`), not regular JSON:
```json
[{ "op": "add", "path": "/fields/System.Title", "value": "My Task" }]
```

### GitHub Issues (Priority 2)

| Aspect | Detail |
|---|---|
| Base URL | `https://api.github.com` (or GHE: `https://GHE_HOST/api/v3`) |
| Auth (PAT) | `Authorization: token ghp_xxx` |
| Auth (OAuth) | GitHub OAuth App — scope: `repo` |
| Projects | Repositories as "projects" — `GET /user/repos` or `GET /orgs/{org}/repos` |
| Issues | `GET /repos/{owner}/{repo}/issues?state=open` |
| Create | `POST /repos/{owner}/{repo}/issues` |
| Labels | Used instead of issue types — create `security`, `threat-model` labels |
| Status | Open / Closed only — no intermediate states |
| Milestones | Equivalent to Sprints — `milestone.title` |

**Limitation:** GitHub Issues has no native "In Progress" state — labels are used as workaround.  
Status mapping: `open` → OPEN, `closed` → CLOSED, label `in-progress` → IN_PROGRESS.

### GitLab Issues

| Aspect | Detail |
|---|---|
| Base URL | `https://gitlab.com/api/v4` or self-hosted |
| Auth (PAT) | `PRIVATE-TOKEN: glpat-xxx` header |
| Projects | `GET /projects?membership=true` |
| Issues | `GET /projects/{id}/issues?state=opened` |
| Create | `POST /projects/{id}/issues` |
| Status | opened / closed — labels for intermediate states |
| Milestones | Sprint equivalent |

### Polarion (Lower Priority)

| Aspect | Detail |
|---|---|
| Base URL | `https://company.polarion.com/polarion` |
| Auth | Basic Auth or API token (`X-Polarion-Token`) |
| API | OSLC REST (`/oslc/`) or REST API (`/rest/v1/`) |
| Work Items | Called "Work Items" — type: Task, Defect, Requirement |
| Status | Project-specific workflow — needs mapping per project |
| Sprint | Called "Iterations" |
| Complexity | High — OSLC is RDF-based, REST API v1 is simpler but newer |

**Recommendation:** Use Polarion REST API v1 (`/rest/v1/`), not OSLC.

### OpenProject (Lower Priority)

| Aspect | Detail |
|---|---|
| Base URL | `https://company.openproject.com/api/v3` |
| Auth | API Key as Basic Auth (`Basic base64(:api_key)`) |
| Projects | `GET /api/v3/projects` |
| Work Packages | Equivalent to issues — `GET /api/v3/projects/{id}/work_packages` |
| Create | `POST /api/v3/projects/{id}/work_packages` |
| Status | Fully configurable — fetch from `/api/v3/statuses` |

---

## 5. Integration Tab Redesign

### New Layout (Dropdown-based, compact)

```
┌──────────────────────────────────────────────────────────┐
│ External System Integration                              │
│ Connect to an issue tracker to link mitigations         │
│ directly to tickets.                                     │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  System     [Jira Cloud               ▾]                │
│  Auth       [Personal API Token       ▾]                │
│                                                          │
│  ── Connection ─────────────────────────────────────── │
│  Instance   [https://company.atlassian.net            ]  │
│  Email      [user@company.com                         ]  │
│  API Token  [••••••••••••••••••••    ] [Test ✓]         │
│                                                          │
│  ── Project ────────────────────────────────────────── │
│  ┌─────────────────────┐  ┌─────────────────────┐      │
│  │ [🏗] SCRUM          │  │ [📦] INFRA          │      │
│  │ My Software Team    │  │ Infrastructure      │      │
│  │ 42 issues · Sprint 3│  │ 8 issues · Backlog  │      │
│  └─────────────────────┘  └─────────────────────┘      │
│                                                          │
│  ✅ Connected to SCRUM                                  │
└──────────────────────────────────────────────────────────┘
```

### System Dropdown Options
```typescript
const INTEGRATION_TOOLS = [
  { value: "jira",         label: "Jira Cloud",         icon: "🔵" },
  { value: "jira-server",  label: "Jira Server / DC",   icon: "🔵" },
  { value: "azure-devops", label: "Azure DevOps",        icon: "🔷" },
  { value: "github",       label: "GitHub Issues",       icon: "⚫" },
  { value: "gitlab",       label: "GitLab Issues",       icon: "🟠" },
  { value: "polarion",     label: "Polarion",            icon: "🟣" },
  { value: "openproject",  label: "OpenProject",         icon: "🟢" },
];
```

### Auth Method per Tool
```typescript
const AUTH_METHODS: Record<IntegrationTool, AuthMethod[]> = {
  "jira":         ["pat", "oauth"],
  "jira-server":  ["pat"],
  "azure-devops": ["pat", "oauth"],
  "github":       ["pat", "oauth"],
  "gitlab":       ["pat", "oauth"],
  "polarion":     ["basic", "pat"],
  "openproject":  ["apikey"],
};
```

### Dynamic Form Fields per Tool+Auth
Each combination renders different fields:

| Tool | Auth | Fields |
|---|---|---|
| Jira Cloud | PAT | Instance URL, Email, API Token |
| Jira Cloud | OAuth | Instance URL, [Sign in with Atlassian] |
| Jira Server | PAT | Instance URL, Email, API Token |
| ADO | PAT | Organization URL, PAT (no email needed) |
| ADO | OAuth | Organization URL, [Sign in with Microsoft] |
| GitHub | PAT | Base URL (optional for GHE), PAT |
| GitHub | OAuth | [Sign in with GitHub] |
| GitLab | PAT | Base URL, PAT |
| Polarion | Basic | Base URL, Username, Password |
| Polarion | PAT | Base URL, API Token |
| OpenProject | API Key | Base URL, API Key |

---

## 6. IPC Proxy Generalization

Currently `jira:request` IPC handler in `main.ts` is named after Jira but is actually generic.  
Rename to `integration:request` — no functional change needed, just naming:

```typescript
// main.ts — rename handler
ipcMain.handle("integration:request", async (_, { url, options }) => { ... });

// preload.ts — rename bridge
integrationRequest: (config: { url: string; options: any }) =>
  ipcRenderer.invoke("integration:request", config),

// base-adapter.ts — use renamed bridge
protected async request(url, options) {
  return (window as any).electronAPI.integrationRequest({ url, options });
}
```

Similarly, keychain handlers `jira:saveToken` / `jira:getToken` / `jira:deleteToken`  
generalize to `integration:saveToken` etc. with `tool` as part of the key:

```typescript
// Key format: "{tool}:{accountId or email}"
// e.g. "jira:juergen.messerer@bbv.ch"
//      "azure-devops:juergen.messerer@bbv.ch"
//      "github:jpm-dev"
```

---

## 7. Implementation Sequence

### Phase 1 — Adapter Infrastructure (before ADO)
1. Rename `jira:request` → `integration:request` in main.ts + preload.ts + global.d.ts
2. Generalize keychain handlers to `integration:saveToken/getToken/deleteToken`
3. Create `ITicketAdapter` interface and `BaseTicketAdapter` class
4. Refactor `jira-mitigation-service.ts` → `adapters/jira-adapter.ts`
5. Create `ticket-adapter-factory.ts`
6. Split `integration-types.ts` → `integration-types.ts` + `credentials/jira-credentials.ts`
7. Update `risk-mitigation-status-dialog.tsx` to use `ITicketAdapter` via factory
8. Update `risks-tab.tsx` auto-sync to use factory

### Phase 2 — ADO Adapter
1. Create `credentials/ado-credentials.ts`
2. Implement `AdoAdapter extends BaseTicketAdapter`
   - `testConnection()` — `GET /_apis/projects`
   - `fetchTickets()` — WIQL query
   - `createTicket()` — JSON Patch format
   - `syncTicketStatus()` — `System.State` field
3. Add ADO to Integration Tab dropdown + dynamic form fields

### Phase 3 — GitHub Adapter
1. Create `credentials/github-credentials.ts`
2. Implement `GitHubAdapter extends BaseTicketAdapter`
   - Label-based status mapping
   - Milestone as sprint equivalent
3. Add GitHub to Integration Tab dropdown

### Phase 4 — Integration Tab Redesign
1. Replace tab-based layout with dropdown-based single form
2. Dynamic field rendering based on tool + auth selection
3. Rich project cards (already implemented for Jira — reuse pattern)
4. Status badge in header when connected

### Phase 5 — GitLab / Polarion / OpenProject (optional)

---

## 8. Open Questions / Decisions

| # | Question | Recommendation |
|---|---|---|
| 1 | Jira Server vs Cloud — same adapter or separate? | Separate: `JiraCloudAdapter`, `JiraServerAdapter` — auth differs significantly |
| 2 | `credentials` field in `IntegrationConnection` — typed or opaque `Record<string, string>`? | Opaque `Record<string, string \| undefined>` in generic types; each adapter casts internally |
| 3 | OAuth flow for ADO/GitHub — implement now or defer? | Defer — PAT covers all use cases for internal tools; OAuth adds complexity |
| 4 | IPC proxy rename — breaking change? | Low risk — only used in integration feature; rename in one PR |
| 5 | `jiraProject.issueTypes` currently not persisted across sessions | Store in `IntegrationConnection` after test; load from there in dialog |

---

## 9. Files to Create / Modify

### New files
```
src/features/integration/
  adapters/
    ticket-adapter.ts               ← ITicketAdapter interface
    base-adapter.ts                 ← BaseTicketAdapter abstract class
    ticket-adapter-factory.ts       ← createTicketAdapter() factory
    jira-adapter.ts                 ← from jira-mitigation-service.ts
    ado-adapter.ts                  ← new
    github-adapter.ts               ← new
  models/
    credentials/
      jira-credentials.ts           ← from integration-types.ts
      ado-credentials.ts            ← from integration-types.ts
      github-credentials.ts         ← new
      gitlab-credentials.ts         ← new
      polarion-credentials.ts       ← new
      openproject-credentials.ts    ← new
```

### Modified files
```
electron/main.ts                    ← rename jira:request → integration:request
electron/preload.ts                 ← rename bridge
src/app/global.d.ts                 ← update electronAPI interface
src/features/integration/
  models/integration-types.ts       ← strip tool-specific types
  services/integration-service.ts   ← replace switch with factory
  components/integration-tab.tsx    ← redesign (Section 5)
  hooks/use-integration-connection.ts ← update for new types
src/features/risks/
  services/jira-mitigation-service.ts ← becomes jira-adapter.ts
  components/risk-mitigation-status-dialog.tsx ← use ITicketAdapter
  components/risks-tab.tsx          ← use factory for auto-sync
```

### Deleted files
```
src/features/integration/services/jira-service.ts   ← folded into jira-adapter.ts
src/features/integration/components/jira-config.tsx ← replaced by unified form
src/features/integration/components/ado-config.tsx  ← replaced by unified form
```
