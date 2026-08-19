# Update Notification — Design

## Purpose
Tell the user, non-intrusively, when a newer TARAflow version is published on
GitHub, and let them read that version's release notes and open the release page
in a browser. **Notify only** — TARAflow never downloads or installs anything.

This fits the existing unsigned-installer policy: a real auto-updater
(electron-updater / update-electron-app / Squirrel.Mac) requires a signed app on
macOS, which we explicitly do not do. So the ceiling for this feature is "inform
+ link", by design, not by omission.

## Scope

### Goals
- Detect that a newer version exists by comparing the running app version with
  the versions published on `github.com/TARAflow/TARAflow`.
- Surface it as a dismissible, non-blocking hint (banner/snackbar).
- Let the user expand **Details** to read the release notes (rendered Markdown).
- Let the user open the release page in the external browser.
- Two entry points only: **on app start**, and a **manual "Check for updates"**
  button (menu or settings).

### Non-goals (explicitly out)
- No auto-download, no auto-install, no staged/silent update. Not now, not later.
- No "skip this version" / "remind me later" persistence in v1 (see Deferred).
- No changelog aggregation across multiple missed versions — we show the single
  latest release's notes. (Optional later; see Deferred.)

## Data source

Use the **GitHub Releases REST API**, not the tags endpoint and not
`releases/latest`:

- `GET https://api.github.com/repos/TARAflow/TARAflow/releases`
  returns all releases **including prereleases**, newest first, and — crucially —
  each carries the fields we need: `tag_name`, `name`, `body` (release notes as
  Markdown), `html_url`, `published_at`, `prerelease`, `draft`.
- `GET .../releases/latest` is **rejected**: it silently skips prereleases, so
  while we ship `-alpha` tags it would report "nothing new" forever.
- The `/tags` endpoint (what the linked page shows) is **rejected as the primary
  source** because a tag object has no release notes and no reliable ordering.
  Tags remain the human-facing page we link to as a fallback if a tag has no
  matching release.

Selection from the `/releases` array:
1. Drop `draft: true`.
2. Drop `prerelease: true` **unless** the user's `includePrereleases` preference
   is set — a checkbox, default **on** (see Decision 1). The renderer passes the
   current value into the IPC call, so main stays stateless about the preference.
3. Parse each remaining `tag_name` as SemVer; pick the **highest by SemVer**, not
   simply array index 0. (GitHub's order is close to chronological, but don't rely
   on it for correctness.)

## Version comparison

- Current version = `app.getVersion()` (the `version` field of package.json),
  e.g. `0.7.0-alpha`. Tags carry a `v` prefix (`v0.7.0-alpha`) — normalize by
  stripping a leading `v` on both sides before comparing.
- Use the `semver` package. `semver.gt(latest, current)` correctly orders
  prereleases: `0.7.0-alpha < 0.7.0-beta < 0.7.0 < 0.10.0`. A naive string or
  split-on-dot compare breaks exactly on the prerelease and the `10 < 9` cases,
  so the dependency earns its place.
- If a tag fails to parse as SemVer, skip it (don't crash the check).

## Behaviour by trigger

The check function returns a discriminated result; the **caller** decides what to
surface, because startup and manual checks have different UX contracts.

Result shape (from main → renderer):

```
type UpdateCheckResult =
  | { status: "update-available";
      currentVersion: string;
      latestVersion: string;      // normalized, no "v"
      releaseName: string;        // GitHub release "name", falls back to tag
      releaseNotes: string;       // raw Markdown ("body")
      releaseUrl: string;         // html_url
      publishedAt: string; }      // ISO
  | { status: "up-to-date"; currentVersion: string }
  | { status: "error"; message: string }
```

- **On startup:** only `update-available` is ever shown. `up-to-date` and `error`
  are silent — no nagging when the user is current or offline.
- **Manual button:** all three states are shown. The user asked, so they get
  feedback: the update hint, or "You're on the latest version", or a short "Couldn't
  check for updates" message. The manual button should also show a brief "Checking…"
  state so the click feels acknowledged.

## UI

- **Hint:** a dismissible MUI Snackbar (or a slim banner) — "Version X.Y.Z is
  available." with two actions: **Details** and **Dismiss**.
- **Details dialog:** MUI Dialog titled with the release name/version, body =
  the release notes rendered from Markdown, plus:
  - published date,
  - an **Open release page** button → `shell.openExternal(releaseUrl)`.
- **Markdown rendering:** render `releaseNotes` (the API's raw-Markdown `body`)
  with **`react-markdown` (`^10.1.0`, already in package.json)**. No HTML scraping
  of the GitHub release page, and do **not** dangerously inject GitHub HTML. Keep
  it read-only —
  links inside the notes should also route through `shell.openExternal`, not
  navigate the Electron window.

## Architecture (fits the existing renderer ↔ IPC ↔ main pattern)

- **Main process** owns the network call and the compare — consistent with the
  "renderer never does net/git itself" rule and avoids any CORS ambiguity.
  New service `electron/services/update-check.ts`:
  - `checkForUpdate(opts): Promise<UpdateCheckResult>` — `fetch` (Node 24 global,
    no `node-fetch`), parse, select, compare, map to the result union.
  - Sends `User-Agent: TARAflow` and `Accept: application/vnd.github+json`
    (GitHub requires a User-Agent).
- **IPC (the known three hops):**
  1. `electron/main.ts` — `ipcMain.handle("update:check", (_e, opts) => checkForUpdate(opts))`,
     where `opts = { includePrereleases: boolean; force?: boolean }`.
  2. `preload.ts` — `contextBridge.exposeInMainWorld("updates", { check: (opts) => ipcRenderer.invoke("update:check", opts) })`.
  3. `global.d.ts` — `Window.updates` type.
  - Reminder: `main.ts` is **not** hot-reloaded by Vite. A correct handler looks
    broken until a full app restart / main rebuild.
- **Renderer:** `useUpdateCheck()` hook wrapping the IPC call + the "checking"
  state; the startup call fires once after the main window is ready; the manual
  button calls the same hook with `trigger: "manual"` so the hook knows to surface
  `up-to-date`/`error`. The hook reads the persisted `includePrereleases`
  preference and passes it into every `update:check` call.
- **i18n:** `update.*` keys in en + de (available, upToDate, checkFailed, details,
  dismiss, openReleasePage, checking, publishedOn).

## Caching & rate limit

- Unauthenticated GitHub API = **60 requests/hour per IP**. One call per app start
  plus occasional manual clicks is far under budget — but:
  - Cache the last result in-memory in main for a short TTL (e.g. 30–60 min) so
    repeated manual clicks and quick restarts don't refetch. A **manual** check may
    pass `force: true` to bypass the cache.
  - Do **not** refetch on window focus.

## Error handling

- Any network/parse/HTTP failure → resolve to `{ status: "error" }`, never throw
  across IPC. Startup swallows it; manual surfaces a one-line message.
- Handle HTTP 403 (rate limit) as just another `error` — the message can hint
  "try again later", nothing more.

## Container/allowlist note (dev environment only)
`api.github.com` isn't in the sandbox bash allowlist used for this workspace, but
that only affects tooling here. The running Electron app has normal network access
at runtime, so this is a non-issue for the feature itself.

## Decisions (confirmed)

1. **Prereleases: included, user-configurable via a checkbox** — labelled e.g.
   "Include pre-release versions", **default on**. Persisted as a renderer
   preference (localStorage, same hybrid pattern as repo-discovery) and passed into
   each `update:check` call. Alpha tags like `v0.8.3-alpha` are therefore eligible;
   a user who unchecks it only gets stable releases once those exist. Surface the
   checkbox in the manual-check dialog (and/or Settings).
2. **Markdown renderer: `react-markdown` `^10.1.0`** — already a dependency; render
   the API's raw-Markdown `body` with it. No HTML scraping.
3. **Manual trigger: app menu "Help → Check for updates…".** Shows a brief
   "Checking…" state and surfaces all three result states (update / up-to-date /
   error).

## Deferred (not v1)
- "Skip this version" / "Remind me later" persistence (localStorage in renderer,
  same hybrid pattern as repo-discovery). Not requested; easy to add later.
- Aggregated notes across several missed releases.
- A "you're N versions behind" indicator.

## Rough effort & file list
Small — roughly half a day to a day including tests.
- `electron/services/update-check.ts` (fetch + select + SemVer compare) + unit test
  (pure select/compare over a fixed `/releases` JSON fixture; the fetch is injected
  so the core is testable without network).
- IPC wiring: `main.ts` handler, `preload.ts` bridge, `global.d.ts` type (3 edits).
- `src/features/.../useUpdateCheck.ts` hook.
- Update hint (snackbar/banner) + details dialog components.
- `semver` dependency (+ `react-markdown` if not already present).
- i18n `update.*` en/de.
- Manual "Check for updates" entry (menu or settings).
