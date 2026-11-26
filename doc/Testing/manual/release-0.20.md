# Manual test: release 0.20

## Purpose

This guide tests the changes of 0.20 by hand before the release: the guard rails
(opening changes nothing, stable results), EN 50742 A and B, the exposure-level marks in
the diagram, the audit commits, the component import fixes and the smaller notes from
the 0.19 manual test. EN 50742 has its own guide; this one calls it in section B.

Mark every step **OK** or **Deviation** (see [Reporting](#reporting)).

## Prerequisites

- TARAflow desktop app (Electron), built from the release branch
  (`npm run build:electron-dev`).
- The `TARAflow_Examples` repository checked out next to the TARAflow repository.
- A git repository for the audit steps (a copy of an example in a fresh `git init`
  folder is enough; signing off).

### Test data

| File | Use |
|---|---|
| `Simple_Test_Project.tara.json` | EN 50742 A, safety zone `MTB` — sections B, C, F |
| `SmokeDetector-leveled.tara.json` | No EN 50742 tag — section C |
| `Pump_Station_Controller-IEC62443-CRA.tara.json` | Audit steps (section D) |
| `import-example/SmokeDetectorCase.tara.json`, `…Controller.tara.json` | Component import (section E) |
| `en50742/EN50742-A-SafetyZone.tara.json`, `…-B-…` | Generated in preparation (section B) |
| A machine with a component imported in 0.19 | Section E (upgrade); any machine saved with 0.19 that has an instance |

### Preparation

1. Generate the EN 50742 examples (in the TARAflow repository):
   `WRITE_EXAMPLES=../TARAflow_Examples/en50742 npx vitest run src/tests/examples/en50742-examples.test.ts`
2. Copy every file you open to a scratch folder and work on the copies only.

---

## A. Guard rails

| # | Step | Expected |
|---|---|---|
| A.1 | Open each test file, wait, close without touching anything. | No "unsaved changes" prompt, no conversion dialog, no sync banner in the Risks or Threats tab. `git status` in the examples repository shows no change. |
| A.2 | `npm run dump:results -- ../TARAflow_Examples --out /tmp/dump --compare doc/Testing/results-dump/0.20` | Exit code 0: every example the same as the 0.20 reference. |
| A.3 | Open `import-example/SmokeDetectorController.tara.json` → Overview. | The imported component is not reported as having a newer state. |

## B. EN 50742

| # | Step | Expected |
|---|---|---|
| B.1 | Run `doc/Testing/manual/en-50742.md` completely. | As described there. |
| B.2 | Overview → *Methodology* for these tag sets: none; *EN 50742 A*; *ETSI TVRA* + *EN 50742 A*; *IEC 62443* + *EN 50742 B*; *ETSI TVRA* + *IEC 62443* + *EN 50742 B*. | *Method*: "Standard (TARAflow)", "Standard (TARAflow) + EN 50742 Approach A", "ETSI TVRA + EN 50742 Approach A", "Standard (TARAflow) + EN 50742 Approach B", "ETSI TVRA + EN 50742 Approach B". |
| B.3 | Open `en50742/EN50742-A-SafetyZone.tara.json`. | Nothing changes (A.1). Risks tab: the risks of `DF-3` and the attack-path risk carry an SRSL and the mark in the *Safety* column; the other risks have no SRSL. Compliance → EN 50742 A: row 7.3.4 is a gap with "no data store in scope keeps the audit logs". |
| B.4 | Open `en50742/EN50742-B-SafetyZone.tara.json`. | Nothing changes. Compliance shows EN 50742 B and IEC 62443-4-2:2019; no row waits for the device category (EDR is set). No SRSL anywhere. |

## C. Exposure levels in the diagram

| # | Step | Expected |
|---|---|---|
| C.1 | `Simple_Test_Project` → DFD. | Boundaries and interfaces show their EL / PEL at the top right; `MTB` has a yellow dashed frame and the text "Safety · EL1". The texts cannot be selected or edited in draw.io. |
| C.2 | Change the EL of `IF-1` in the side panel. | Its text follows at once. |
| C.3 | Save, then search the file for `elbadge` and `elzone`. | No hit: the marks are never stored. |
| C.4 | `SmokeDetector-leveled` → DFD. | No EL texts (no EN 50742 tag). Project settings → *Diagram* → *Show exposure levels in the diagram* on → texts appear; off → gone; the choice stays after reopening. |
| C.5 | Report (Markdown and PDF) of `Simple_Test_Project`, DFD chapter. | Below the statistics a table *Diagram legend* explains the EL texts and the safety-zone frame. |

## D. Audit commits

Work in the git repository of the prerequisites. Commit the unchanged file first.

| # | Step | Expected |
|---|---|---|
| D.1 | Change a threat's relevance and a risk's MoSCoW priority, save, open the Audit tab. | The priority under *Risks*; the relevance under *Changes the audit diff does not list* as `threats.perElement[<id>].relevance: … → …` (or `perInteraction`). |
| D.2 | Commit, then *Verify audit trail*. | The commit is accepted; the list stands in the message before the trailers; the verification passes. |
| D.3 | Change only the report language and move an element, save. | *Derived values* with "layout or report setting" — nothing under "does not list". Commit it. |
| D.4 | Change the risk treatment and the treatment justification of more than 20 risks (or regenerate threats with relevance changes), save. | At most 20 places, then "N more". |
| D.5 | A project stores threats of both methods, one is active (`Simple_Test_Project`: per element). Threats tab → switch to **per interaction**, change the relevance of one of its threats, switch back to **per element**, save, open the Audit tab. | Under *Threats*, that threat with `Relevance: … → …`; no line for the method (it was switched back). (Checks a fixed gap: up to 0.19 the audit compared only the threats of the active method.) |
| D.6 | A risk with one selected mitigation, e.g. M-T-001 *open*: deselect it and select another one with the **same status**, e.g. M-T-002 *open*. Save, open the Audit tab. | Under *Risks*, at the risk: `Mitigations: M-T-001:open → M-T-002:open`. (Checks a fixed gap: up to 0.19 the audit compared only the number and the statuses of the mitigations, so this swap was signed without a line.) |
| D.7 | Change the tracker connection's base URL in the integration settings, save. | Named as `integration.connection.credentials.baseUrl` with "(set) → (changed)", never the value. |

## E. Component import

| # | Step | Expected |
|---|---|---|
| E.1 | Import `SmokeDetectorCase` twice into `SmokeDetectorController` (prefixes `SD1`, `SD2`). | The boundaries read "Smoke Detector Case [SD1:CASE]" and "[SD2:CASE]", also on the copies around the multiprocesses and in the report. No "ID label … is used multiple times". |
| E.2 | The machine from 0.19 with an instance: open, then update the component (**Update…**, **Apply update**, as in `component-import.md` §12). | Before the update the boundaries keep "[CASE]"; after it they read "[<prefix>:CASE]". The audit lists the new display ids once. A manual threat in the machine's table of such a boundary stays in that table. |
| E.3 | Nested import: save the controller of E.1 as a component, import it into a new machine with prefix `C1`, save, close, reopen. | The case's process reads `C1:SD1:P-1` (not `SD1:C1:P-1`), the boundary "[C1:SD1:CASE]"; after reopening the same; no missing-id finding. |
| E.4 | An instance: *Component* tab → an assumption of use → *not fulfilled*. | The note field asks "Why it is not fulfilled" (German: "Warum sie nicht erfüllt ist"). |

## F. Smaller changes

| # | Step | Expected |
|---|---|---|
| F.1 | Open a project. Open a second window with a copy. | Window title "<project> — <file path> — TARAflow <version>"; the two windows can be told apart. Without a project: "TARAflow <version>". |
| F.2 | Risks tab with open risks: hover the status chip and the Risk phase in the phase bar. | The reasons with the risks: mitigations not implemented yet, no mitigation selected, SRSL controls missing (EN 50742 A). |
| F.3 | In a copy of an example, set a threat's `threatDescription` to `general.D-009.threat` in the file, open it. | The text of the template appears (also in its risk); a text the analyst wrote is not touched. |
| F.4 | Overview → remove the tag *EN 50742 A* from `Simple_Test_Project`, save the project information. | Dialog "Risk ratings will be deleted" with the factors and the number of ratings and risks; *Cancel* keeps everything. |
| F.5 | Audit settings: a push to an HTTPS remote with a personal access token. | The push works; `git remote -v` shows the URL without the token. |
| F.6 | Overview → *Methodology* of a project whose threats were generated before 0.20. | The threat catalogue version of the stored threats and the current one. |

## Reporting

Per deviation, note the step number, what happened, and a screenshot. Name the project
file and the app version (About).
