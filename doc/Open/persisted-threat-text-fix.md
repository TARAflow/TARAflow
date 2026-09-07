# Fixing Persisted Unresolved i18n Keys in Threat & Risk Text

**Status:** Proposed
**Area:** Threats / Risks / Project schema
**Schema impact:** bump 6 → 7 (repair migration)

---

## 1. Problem

Some threats and risks store a **raw i18n key** — e.g. `general.D-009.threat` —
in their `threatDescription` / `attackDescription` / `causeDescription` fields
instead of the localized text. The UI then renders that literal string, because
these fields are treated as final display text and are never re-translated.

Concrete instance (project `DataTrack`):

```
threats.perElementTables[1].threats[2]   (IF1-D-1)  threatDescription = "general.D-009.threat"
risks.risks[14]                          (R-IF1-D-1) threatDescription = "general.D-009.threat"
```

### 1.1 Root cause

The text is **resolved once at generation/sync time and then persisted**:

1. `getLocalizedElementThreat(templateId, domain)` in
   `src/features/threats/services/threat-catalog-service.ts` builds the key
   `${domain}.${templateId}.threat` in namespace `element-threats-attacks`.
2. If the primary lookup misses, it falls back to `general.${templateId}.threat`.
   When **that** also misses (the translation did not exist yet), i18next
   returns the **raw key string** rather than throwing.
3. The generator/sync writes that returned string into the threat's
   `threatDescription` (and the risk inherits it via `risk-sync-service`).
4. Later, the translation is added to
   `src/i18n/locales/{en,de}/threats/shared/threats-interface.json`
   (`interface.D-009.*`). But the stored field is now a frozen string — it is
   **displayed as-is and never re-translated**, so the fix in the resource
   files has no effect on already-generated projects.

There are therefore **two independent defects**:

| # | Defect | Layer |
|---|--------|-------|
| A | A missing translation is materialized as a raw key and **persisted** | write path (catalog service + generators/sync) |
| B | Existing projects already contain frozen raw keys | stored data |

Fixing only the resource files (as was attempted) cannot resolve either A or B.

### 1.2 Why `D-009` specifically slipped through

`D-009` (reduced wireless-interface DoS) was added to the catalog with
`domain: "interface"`, but its i18n text under `interface.D-009.*` was added
**after** at least one project had already generated the threat. During that
window the lookup fell through `interface.D-009` → `general.D-009` → raw key,
and the raw key was saved. This is a race between *catalog template
availability* and *translation availability*, and it will recur for any future
template whose text lands in a later commit than its first use.

---

## 2. Goals

1. **Never persist an unresolved i18n key** again (defect A).
2. **Repair** existing projects that already contain frozen raw keys (defect B).
3. **Self-heal**: once a translation exists, previously-broken text should
   resolve without manual intervention.
4. No regression to the threat/risk identity model or the sync flow.

### Non-goals

- Changing the i18n namespace layout or the `${domain}.${id}` key scheme.
- Converting *all* threat text to render-time translation in one step (the
  larger refactor in Phase 4 is optional and staged).

---

## 3. Design

The write path and the stored data are addressed separately, then hardened.

### 3.1 Guard the resolver (defect A, immediate)

`getLocalizedElementThreat` / `...Attack` / `...Cause` (and their interaction
counterparts) must **never return a raw key**. On a miss after the `general`
fallback, return a **sentinel-free, safe placeholder** derived from the
template id, and log loudly.

```ts
// threat-catalog-service.ts
function safeText(kind: "threat" | "attack" | "cause", templateId: string): string {
  // Human-readable, never a dotted i18n key. Rendered only when a text is
  // genuinely missing; picked up by the missing-translation report.
  return `[${templateId}] (${kind} text pending translation)`;
}
```

- The resolver returns `safeText(...)` instead of the i18n key when both the
  domain-specific and `general` lookups miss.
- Crucially, a placeholder is **recognizable as unresolved** (see 3.3) so it can
  be re-resolved later, unlike a plausible-looking sentence.

### 3.2 Stop persisting resolved text where possible (defect A, structural)

The durable cause is that display text is **stored**. Two options, staged:

- **3.2a (Phase 2, minimal):** at the point where generators/sync assign
  `threatDescription` etc., detect a resolver miss and **store the template
  reference, not the placeholder** — i.e. leave the field empty/undefined and
  rely on render-time resolution (3.4) for that record. This prevents new
  frozen strings without a full refactor.
- **3.2b (Phase 4, optional):** stop materializing `threatDescription` /
  `attackDescription` / `causeDescription` for catalog-derived threats entirely;
  resolve at render time from `(domain, templateId)`. This makes the whole class
  self-healing but touches more surfaces (see §6).

### 3.3 Detector for persisted keys/placeholders

A single predicate is the backbone of both repair and self-heal:

```ts
// threat-identity.ts  (or a new text-provenance.ts under threats/services)
const RAW_KEY_RE = /^(general|interface|physical|gap)\.[A-Za-z]+-\d+\.(threat|attack|cause)$/;
const PLACEHOLDER_RE = /^\[[A-Za-z]+-\d+\]\s*\(.*pending translation\)$/;

export function isUnresolvedThreatText(value: string | undefined | null): boolean {
  if (!value) return false;
  return RAW_KEY_RE.test(value) || PLACEHOLDER_RE.test(value);
}

/** Recover (domain, templateId, kind) from a stored raw key, if present. */
export function parseStoredThreatKey(value: string):
  | { domain: string; templateId: string; kind: "threat" | "attack" | "cause" }
  | null {
  const m = RAW_KEY_RE.exec(value);
  if (!m) return null;
  return { domain: m[1], templateId: /* id between first and last dot */ value.split(".")[1], kind: m[3] as any };
}
```

### 3.4 Re-resolve on sync (self-heal, defect B for live projects)

`sync-threats-with-graph.ts` already re-derives system-owned fields on every
graph sync. Add a **text-refresh pass**: for each catalog-derived threat, if a
description field `isUnresolvedThreatText(...)`, attempt to resolve it again via
`getLocalizedElementThreat(templateId, domain)`. If it now resolves, write the
real text; if not, write the placeholder (still unresolved, still detectable).

The same refresh runs for risks in `risk-sync-service.ts`, which already copies
`threatDescription` from the threat — it simply inherits the healed value on the
next sync.

Because this keys off `(domain, templateId)`, it recovers even the already-frozen
`general.D-009.threat` strings: the parser yields `templateId = "D-009"`, and the
resolver now finds `interface.D-009.threat`.

> Note: the stored raw key encodes the **wrong** domain (`general`, from the
> fallback). Re-resolution must use the **template's current domain** from the
> catalog (look the template up by id), not the `general` captured in the string.

### 3.5 One-shot repair migration (defect B for at-rest projects)

Add `migrate-6-to-7.ts` (`src/app/services/versions/`) that walks
`threats.perElementTables[].threats[]`,
`threats.perInteractionTables[].threats[]`, and `risks.risks[]`, and for every
field matching `isUnresolvedThreatText`, re-resolves via the catalog + i18n. This
repairs projects on load without requiring a graph sync, and bumps the schema
version 6 → 7.

Migrations run headless (no React), so the migration resolves through the same
`i18n` instance used elsewhere; if a text still cannot be resolved, it leaves the
detectable placeholder so the missing-translation report (3.6) still flags it.

### 3.6 Guardrails so it never recurs silently

- **CI catalog/i18n completeness check** (new test under
  `tests/unit/features/threats/`): for every template id in the catalog, assert
  that `<domain>.<id>.{threat,attack,cause}` exists in **both** `en` and `de`.
  This turns "translation added later than template" into a red build.
- **Serialization assertion:** extend `prepare-for-disk` (or a dedicated test
  like the existing `no-raw-project-serialisation.test.ts`) to fail if any
  persisted threat/risk text matches `RAW_KEY_RE`.

---

## 4. Implementation Phases

### Phase 0 — Immediate data repair (unblocks the affected project)
- Fix the four fields in the affected project file (`IF1-D-1` threat +
  `R-IF1-D-1` risk) with the correct `D-009` text. *(Already done as a hotfix.)*
- **Deliverable:** working project; no code changes.
- **Risk:** none.

### Phase 1 — Resolver guard (defect A, stop the bleeding)
- `threat-catalog-service.ts`: replace every `return i18n.t(\`general.${id}...\`)`
  fallback so a miss returns `safeText(...)`, never a raw key. Applies to the six
  functions (element + interaction × threat/attack/cause).
- Add `isUnresolvedThreatText` + `parseStoredThreatKey` in `threat-identity.ts`.
- **Tests:** extend `threat-catalog-service.*.test.ts` — a missing key yields a
  placeholder, not a dotted string.
- **Deliverable:** newly generated threats can no longer freeze a raw key.
- **Risk:** low; isolated to the resolver.

### Phase 2 — Self-heal on sync (defect B, live projects)
- `sync-threats-with-graph.ts`: add a text-refresh pass that re-resolves any
  `isUnresolvedThreatText` description from the template's **current** domain.
- `risk-sync-service.ts`: ensure risks inherit the refreshed threat text (they
  already copy it; add a direct re-resolve for orphaned/edited risks whose
  threat is gone).
- **Tests:** `risk-sync-service.*.test.ts` + a new
  `sync-threats-with-graph.text-refresh.test.ts` reproducing the `D-009` case.
- **Deliverable:** opening a project and syncing heals stale text.
- **Risk:** low–medium; runs inside existing sync, so cover with a regression
  fixture built from the `DataTrack` case.

### Phase 3 — Repair migration (defect B, at-rest projects)
- Add `migrate-6-to-7.ts` + register in `versions/index.ts`; bump
  `schema-version.ts` to 7.
- Re-resolve all unresolved threat/risk text during migration; leave detectable
  placeholders where translation is genuinely absent.
- **Tests:** `migrate_6_to_7.test.ts` with a fixture project containing
  `general.D-009.threat` → asserts healed output and version bump; idempotency
  test (running twice is a no-op).
- **Deliverable:** projects heal on load, no sync required.
- **Risk:** medium; migrations are load-bearing — cover idempotency and the
  "still missing" branch.

### Phase 4 — Guardrails (prevent recurrence)
- CI test: catalog-vs-i18n completeness (all ids present in en + de).
- Serialization guard: fail if any persisted text matches `RAW_KEY_RE`.
- **Deliverable:** the class of bug becomes a build failure, not a shipped
  project.
- **Risk:** low.

### Phase 5 — *(Optional)* Render-time resolution
- Stop materializing catalog-derived `threatDescription` / `attackDescription` /
  `causeDescription`; resolve from `(domain, templateId)` at display time
  (Risk table, Threat table, dialogs, doc generators).
- Makes the whole class structurally impossible; larger surface (docs/CLI must
  resolve too). Schedule only if the maintenance burden of stored text persists.
- **Risk:** high (touches report generators, CLI, search/filtering that assume
  literal text). Stage behind Phases 1–4.

---

## 5. Affected Files

| File | Change |
|------|--------|
| `src/features/threats/services/threat-catalog-service.ts` | Phase 1: safe fallback; expose `resolveElementText(domain,id,kind)` for reuse |
| `src/features/threats/services/threat-identity.ts` | Phase 1: `isUnresolvedThreatText`, `parseStoredThreatKey` |
| `src/features/threats/services/sync-threats-with-graph.ts` | Phase 2: text-refresh pass |
| `src/features/risks/services/risk-sync-service.ts` | Phase 2: inherit/re-resolve risk text |
| `src/app/services/versions/migrate-6-to-7.ts` *(new)* | Phase 3: repair migration |
| `src/app/services/versions/index.ts` | Phase 3: register migration |
| `src/app/services/schema-version.ts` | Phase 3: bump 6 → 7 |
| `src/i18n/locales/{en,de}/threats/shared/threats-interface.json` | already contains `D-009`; keep |
| `tests/unit/features/threats/…` | Phases 1–4: unit + regression + completeness tests |
| `tests/unit/app/services/migrate_6_to_7.test.ts` *(new)* | Phase 3 |

---

## 6. Risks & Considerations

- **Domain drift in stored keys.** The frozen string carries `general` (the
  fallback domain), not the template's real domain. Re-resolution must look the
  template up by id and use its current `domain`, or the heal will miss again.
- **Placeholder vs. plausible text.** The safe fallback must stay *detectable*
  (regex-matchable) so later passes can re-resolve it. Never emit a natural
  sentence for a missing translation.
- **Migration without React/i18n context.** Confirm the migration path has an
  initialized `i18n` instance (it imports the same singleton). If not, the
  migration should defer to the Phase 2 sync heal and only strip/placeholder in
  Phase 3.
- **Report/CLI parity (Phase 5).** `taraflow-report` and the doc generators read
  the stored text today; a render-time move must update them too, or reports
  regress to showing keys.
- **Search & filters.** Any code that greps threat text (search boxes, exports)
  assumes literal strings; keep that in mind before removing materialization.

---

## 7. Acceptance Criteria

1. Generating a threat whose translation is missing yields a **detectable
   placeholder**, never a dotted i18n key. *(Phase 1)*
2. Opening the `DataTrack` project and syncing replaces
   `general.D-009.threat` with the real `D-009` text. *(Phase 2)*
3. Loading any pre-schema-7 project repairs all unresolved threat/risk text and
   bumps to schema 7; running the migration twice changes nothing. *(Phase 3)*
4. CI fails if a catalog template id lacks `threat`/`attack`/`cause` text in en
   or de, or if any persisted project text matches the raw-key pattern.
   *(Phase 4)*
