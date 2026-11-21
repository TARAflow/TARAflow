# Results dump

**Status:** 0.19 reference created 2026-11-20 (0.20 patch 01) · roadmap-to-1.0.md rule 3.1

A results dump records what the code computes from a project file: the threats a fresh
generation produces, their drift against the stored threats, the risk values recalculated
from the stored ratings, and the requirement matrices of the project's active standards.
The dump of **0.19** on the example projects is the reference. The catalogue version stamp
and every later change of results are compared with it. A change shows up as a diff, and
the release note can name it.

## What a dump holds

One `<name>.results.json` per `<name>.tara.json`. The keys are sorted and the JSON is
pretty-printed, so a dump is byte-stable and readable in a git diff.

| Part | Content | Computed by |
|---|---|---|
| `header` | TARAflow version and commit, commit of the input repository, input file name and sha256 | — (not compared) |
| `project` | name, schema version after loading, schema version migrated from, tags | `parseAndRepairWithMetadata` (as the app opens a file) |
| `threats.methods.<method>.threats` | every threat a fresh generation produces, keyed by natural key (element / flow + STRIDE): texts, actor, trust boundary, linked assets, proposed mitigations and verifications (catalogue ids), template, display id | `generateFresh` with the stored threat configuration (default if none), both STRIDE methods unless the regulation preset disables one |
| `threats.methods.<method>.drift` | stored generated threats the rules no longer produce, number of threats they would add | `detectGenerationDrift` |
| `risks.risks.<id>` | impact, likelihood, risk before / after, SRSL, attack potential, ISO risk value — recalculated from the stored ratings; `stored` only where the file holds other values | `recalculateRiskValues`, `calculateRiskValues`, `computeIsoRisks` |
| `risks.progress`, `risks.findings` | done / total, the Risks tab's findings | `calculateProgress`, `riskFindings` |
| `compliance.<standard>` | scope, achieved and planned run: every row (status, source, failing / unknown elements, mitigations), SL-C vectors, EN 50742 A SRSL header | `prepareProjectCompliance` (as the Compliance tab and the report) |

A threat's random id and the generator's clock stamps are left out. Everything else is a
result. Ids that a migration creates while an older file loads come from a counter, so they
are stable from run to run.

Not in the dump: the security goal derivation, DFD validation findings, attack tree values
beyond the ISO risk value, documents.

## Making and comparing dumps

```sh
# dump (directories recursively; *.backup.json are skipped)
npm run dump:results -- ../TARAflow_Examples --out /tmp/dump

# compare with the reference — exit code 1 on any difference; several --compare:
# the first folder that has the project counts (a release folder holds only
# the projects whose results changed)
npm run dump:results -- ../TARAflow_Examples --out /tmp/dump \
  --compare doc/Testing/results-dump/0.20 --compare doc/Testing/results-dump/0.19
```

`--compare` prints one line per changed leaf:

```
DIFF  SmokeDetector.tara.json (3)
      ~ threats.methods.per-element.threats.<element>::D.threatDescription: "…" → "…"
      - risks.risks.R-…
      ~ compliance.iec-62443-4-2-2019.achieved.component.TRE: 4 → 2
```

Before comparing, check that the input repository is at the commit named in the header
(`inputCommit`). An input file that changed is a different input, not a changed result.

## Rules

- **`0.19/` is never changed.** A release that changes results on purpose (the catalogue
  stamp, the EN 50742 A SRSL 0 guard, the 0.21 generator changes …) adds its own folder
  (`0.20/`, …) in the same patch as the change — with only the projects whose results
  changed; the others are as in the folder before. The patch shows the diff against the last
  reference, and the release note names it.
- **Customer projects never enter the repository** (roadmap rule 8). Run the same command
  with `--out` outside the repository. Keep those dumps locally as the reference for the
  regression run before 1.0.0-rc. Make them with the 0.19 code, before any 0.20 change of
  results.
- The dump uses the production functions and nothing of its own. If the app changes how it
  computes a result, the dump changes with it.

## What the 0.19 reference shows

Inputs: TARAflow_Examples at `70201b5`, 15 projects, TARAflow at `79b73ca8` (0.19.0-beta).

| Project | per-element: count / drift | per-interaction: count / drift | Risks | Standards |
|---|---|---|---|---|
| Headlamp_ISO21434_Example | 99 / – | disabled (ISO preset) | 17 (ISO values) | — |
| Pump_Station_Controller-IEC62443-CRA | 87 / – | 77 / – | 164 | EN IEC 62443-4-2 prAA |
| Simple_Test_Project-IEC62443 (schema 12) | 37 / – | 32 / 10 obsolete | 13 | EN 50742 A, IEC 62443-4-2 |
| Simple_Test_Project | 37 / 2 obsolete | 32 / 10 obsolete | 13 | EN 50742 A, IEC 62443-4-2 |
| SmokeDetector | 229 / 4 obsolete | 214 / 4 obsolete | 155 | IEC 62443-4-2 |
| SmokeDetector-leveled | 229 / – | 209 / 5 obsolete | 202 | IEC 62443-4-2 |
| cnc-ref | 156 / – | 276 / – | 35 | EN 50742 A |
| taraflow-self-analysis | 175 / – | 203 / – | 106 | — |
| import-example/SmokeDetectorCase | 74 / – | 65 / – | 53 | IEC 62443-4-2 |
| import-example/SmokeDetectorController | 30 / – | 43 / 13 to add | 60 | IEC 62443-4-2 |
| simple-controller/00 … 04 | 30 – 40 / 04: 2 obsolete | 24 – 40 / – | – | — |

Observations, all part of the reference and not fixed here:

- **Drift in stored examples.** SmokeDetector, SmokeDetector-leveled, both
  Simple_Test_Projects and `04-goal-impact` hold generated threats the 0.19 rules no longer
  produce (in SmokeDetector the S and R threats of the physical boundaries CTE and SHE, the enclosures).
  SmokeDetectorController would get 13 per-interaction threats. The drift banner in the app
  shows the same.
- **Stored risk values are current.** In every example, the values recalculated from the
  stored ratings equal the stored ones.
- **EN 50742 A is barely rated.** cnc-ref has no SRSL rated (both safety functions
  unknown), and Simple_Test_Project has one risk with SRSL 1 (one safety function at
  SRSL 1). The SRSL 0 guard of 0.20 would hardly show in this reference. An example with rated EL / AC / WoO on
  several interfaces is needed before that change. The matrix reads the SRSL stored on the
  risk (`calculatedSrsl`), the risk part shows it recalculated.

## What changed in 0.20 (`0.20/`)

**Patch 11 — EN 50742 relevance (O17 / O18, user 2026-11-20).** Only the three EN 50742 A
examples change; the other twelve are as in 0.19.

- Every risk of an EN 50742 project carries `en50742Relevant` — whether its threat sits
  on an interface or a data flow that crosses the safety zone or (without a zone, as in
  all examples) lies on a path to a safety function. Only relevant risks get EL, attacker
  capability, WoO and an SRSL. In the examples no SRSL changes: the one rated SRSL
  (Simple_Test_Project) is on a relevant interface.
- The model rows of the `en-50742-a` sub-tab are evaluated on the relevance scope instead
  of the whole machine: in Simple_Test_Project the store `11` leaves the scope of 7.3.2 /
  7.3.3 (no longer failing there); in cnc-ref — safety functions without DFD elements —
  nothing is relevant: 7.3.2, 7.3.3 and 7.3.5 stay *unknown*, now with the reason "no
  interface or data flow crosses the safety zone or leads to a safety function" instead
  of a list of unset properties.

**Patch 12 — risks without SRSL are not "unrated".** A risk on an anchor that is not
EN 50742 relevant has no SRSL at all (undefined), not "not rated yet" (null): the rows of
the `en-50742-a` sub-tab that list unrated risks (7.4.2, 7.4.3.x, 4.3/229) no longer name
the process and store risks of Simple_Test_Project (R-P1-*, R-DB-S-1) and the flow risks
off the path (R-DF4-*). No status changes in the examples.

**Patch 13 — retention of the audit records (B-F6).** EN-7.3.4 of Approach A is a model
row now (was a statement row): some data store in scope holds audit logs for at least
5 years. Simple_Test_Project (both): no data store in the scope → *gap* "no data store in
scope keeps the audit logs" (was *needs statement*); cnc-ref: *unknown* (no relevant
interface, patch 11).

**Patches 21 + 22 — SRSL 0 only for an isolated safety function (F2).** When Table B.6
gives SRSL0, the SRSL is now SRSL1 if the interface is above EL0 (21) or if any interface on
a path to the risk's safety function is (22). No example changes: the examples have no
risk rated to AP0 on such an interface (the one rated SRSL is SRSL1). The A example with a
safety zone, made by the manual test (`doc/Testing/manual/en-50742.md` §9), is the first
to show the guard once it is in the examples repository.
