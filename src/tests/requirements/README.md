# Requirement tests

One test file per design document, one `describe` per requirement. Each test
walks the chain the app runs with the **real services** — deriver, goal state,
threat generator, risk factors, calculation, preview, report helpers — no
mocks. They answer "is requirement X of design Y still met?", not "does
function Z work" (that is `unit/`).

```
npm run test:requirements
```

They are part of the default suite (`npm test`, `vitest.config.ts`).

**UI aspects** (chips, dialogs, previews as the analyst sees them) are covered
by the component tests listed in the matrix. A full Electron end-to-end layer
(Playwright) does not exist yet.

Builders: `builders.ts` — small project pieces made through the real deriver
and the app-layer reference builder.

## Matrix — security-goal rework

`doc/Done/Asset/security-goal-rework-design.md`

| Id | Requirement (design §) | Requirement test | Further coverage (unit / component) |
|---|---|---|---|
| SG-01 | Goals derived from DFD relations and asset impact (§4.1) | `security-goal-rework.req.test.ts` | `asset-cianaaa-deriver.test.ts` |
| SG-02 | Invariant A — manual wins over derivation (§4.5) | ″ | `asset-goal-state.test.ts` |
| SG-03 | Invariant B — snapshot is historical, change → review (§4.5) | ″ | `asset-goal-state.test.ts` |
| SG-04 | Invariant C — exclusion visible in table, report, generator (§4.5) | ″ | `security-goal-chips.test.tsx`, `security-goal-doc-rows.test.ts` |
| SG-05 | Invariant D — floor is "assessment required", not Low (§4.5) | ″ | `security-goal-card.test.tsx` |
| SG-06 | Invariant E — override above asset: error, no mutation (§4.3, §4.5) | ″ | `asset-goal-impact.test.ts` |
| SG-07 | Generator: technically possible ∩ active goal (Phase 1) | ″ | `unified-strategy` / element-generator tests |
| SG-08 | Risk impact from the violated goals, cases 1–5 (§4.3, §4.5) | ″ | risk calculation unit tests |
| SG-09 | Report: goal state in "Source" (Phase 5) | ″ | `security-goal-doc-rows.test.ts` |
| SG-10 | Cross-checks THREAT_WITHOUT_GOAL / GOAL_WITHOUT_THREAT (Phase 6) | ″ | `asset-threat-crosscheck.test.ts`, `security-goal-card.test.tsx` (back-reference) |
| SG-11 | "Needs review only" = errors and warnings (§4.4) | ″ | `asset-table.review-filter.test.tsx` |

## Matrix — risk impact aggregation

`doc/Open/Risk/risk-impact-aggregation-design.md`

| Id | Requirement (design §) | Requirement test | Further coverage (unit / component) |
|---|---|---|---|
| RA-01 | Req. 1, 4 — worst harm never diluted (harm floor, Q3) | `risk-impact-aggregation.req.test.ts` | `impact-aggregation.test.ts` |
| RA-02 | Req. 2 — aggregation from the preset; new projects take it | ″ | `risks-tab-helpers.impact-aggregation.test.ts` |
| RA-03 | Req. 3 — standard weighs business consequences | ″ | `impact-aggregation.test.ts` (§5.4 table) |
| RA-04 | Req. 5 — asset weights by default, override wins (phase 4) | ″ | `impact-weight-source.test.ts`, `risk-config-dialog.impact-aggregation.test.tsx` |
| RA-05 | Req. 6 — no silent change; preview before apply (§6) | ″ | `impact-aggregation-preview.test.ts`, `risk-config-dialog.impact-aggregation.test.tsx` |
| RA-06 | Req. 7 — explanation in dialog and report (§5.5) | ″ | `impact-basis-text.test.ts`, `risks-impact-aggregation.test.ts` (all formats) |
| RA-07 | Part B — likelihood level labels, TVRA levels, hint (§7.4) | ″ | `factor-level-options.test.ts` (incl. en/de completeness) |
| RA-08 | ISO risk per impact category, display (§5.6, phase 5 A) | ″ | `iso-risk-by-category.test.ts`, `risks-impact-aggregation.test.ts` (traceability) |

## Adding a requirement

1. Give it an id in the matrix above, with the design section.
2. Add a `describe("XX-nn …")` to the document's `*.req.test.ts`; use the
   builders, not hand-made intermediate objects.
3. Each negative check gets a positive control (the same setup without the
   cause must show the effect) — otherwise a broken fixture passes silently.

## Example projects

`src/tests/examples` builds the **Simple Controller** examples for
TARAflow_Examples (one small model, one example per aspect) through the same
services and checks what each example promises. Write them with
`WRITE_EXAMPLES=<dir> npx vitest run src/tests/examples`.

| Example | Requirements |
|---|---|
| 01 Goals derived | SG-01, SG-07 |
| 02 Goals decided | SG-02, SG-04, SG-09 |
| 03 Goals need review | SG-03, SG-05, SG-11 |
| 04 Impact per goal | SG-06, SG-08 |
