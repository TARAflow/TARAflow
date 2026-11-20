# Manual test: component import

## Purpose

This guide tests the import of a component TARA into a machine TARA by hand:
import, read-only component pages, imported assets, threats and risks, several
instances, update to a newer component state, the Overview, the report and the
audit trail. Run it before every release that touches the component import.

Mark every step **OK** or **Deviation** (see [Reporting](#reporting)).

## Prerequisites

- TARAflow desktop app (Electron). The import reads the component from git, so
  the browser build is not enough.
- The `TARAflow_Examples` repository checked out, with a working `git`.
- Optional: a Jira test instance. You only need it for the ticket steps in
  section 12. Skip those steps without it.

### Test data

All steps use the example pair in `TARAflow_Examples/import-example/`. Its
`README.md` explains the pair.

| File | Role |
|---|---|
| `import-example/SmokeDetectorCase.tara.json` | **Component**: the smoke detector case with its sensor chip |
| `import-example/SmokeDetectorController.tara.json` | **Machine**: the controller the detector is built into |

Both files are in the same git repository. The machine therefore pins the
import to the component's commit and finds the component by its repository path.

**EE mapping** (used in every import):

| Component external entity | Machine element |
|---|---|
| EE-6 Smoke Detector Controller | P-1 Alarm Processing Controller |
| EE-1 Debugger | EE-1 Debugger |

**Prefixes:** `SD1` for the first instance, `SD2` for the second.

### Work on a throwaway branch

Several steps save and commit the example files. Do all of it on a local
branch, so the example stays clean. In the `TARAflow_Examples` root:

```bash
git switch -c try-update
```

Commits that touch a `*.tara.json` file must have a subject starting with
`[TARA]` or `audit:` (commit hook). The commit dialog in the Audit tab writes
such messages. In a terminal use `git commit -m "audit: …"`.

Clean up at the end (section 17).

---

## 0. Look at the component (optional, about 5 minutes)

1. Open `import-example/SmokeDetectorCase.tara.json`.
   - **Expected:**
     - The DFD shows the physical boundary **Smoke Detector Case [CASE]**, the
       chip boundary **Smoke Detector Sensor [SDS]** and the trust boundary
       **Sensor Boundary [SB]**.
     - Inside: P-1 Optical Detection Controller, P-2 Sensor Communication
       Controller, P-3 Sensor Diagnostic Controller, P-4 Sensor Update Handler,
       DS-1 Flash Calibration Parameters, DS-2 Flash Sensor Firmware,
       IF-1 RS485 and IF-2 JTAG.
     - Two external entities: **EE-1 Debugger** and **EE-6 Smoke Detector Controller**.
     - 11 flows. Three of them cross to an external entity (boundary flows):
       DF-7 *stream sensor data*, DF-9 *pull calibration command* (both
       between P-2 and EE-6) and DF-8 *pull debug commands* (EE-1 → P-3).
     - Threats: 74 per element (27 relevant), 65 per interaction (26 relevant).
     - Risk tab: 53 risks, all rated and treated.
     - No errors or warnings in any tab.
2. Close the file **without saving**. Saving does no harm, but it changes the
   content hash.

## 1. Open the machine

1. Open `import-example/SmokeDetectorController.tara.json`.
   - **Expected:**
     - No migration dialog, unless this TARAflow has a newer project schema
       than the file.
     - The machine's own elements: P-1 Alarm Processing Controller, P-2 Fire
       Panel Communication Service, DS-1 Flash Alarm Configuration, EE-1
       Debugger, EE-2 Alarm Receiving Centre, EE-3 Service Technician and the
       trust boundary Fire Panel [FP], with 6 own flows (DF-1 … DF-6).
     - Risk tab: 60 own risks.
2. Start state check: the machine must not contain an imported component yet.
   - If the DFD shows a multiprocess **Smoke Detector Case**, or the Overview
     has a **Components** view, delete every imported multiprocess first as in
     section 11, then save.

## 2. Import the component

1. DFD tab → toolbar **Import component TARA…** → **Choose file…** →
   `import-example/SmokeDetectorCase.tara.json`.
2. **Expected in the dialog:**
   - The source shows the commit and "same repository as this project".
   - **No** unpinned warning and no "Import the unpinned state anyway" checkbox.
   - **No** list of flows that "end on a boundary and will not resolve in the machine".
   - **Multiprocess name:** Smoke Detector Case. **Prefix:** suggested `SDC1`.
   - The table **External entities of the component** has 2 rows.
3. Set the mapping (see [Test data](#test-data)).
4. Prefix check:
   - Enter `SD 1` (with a space). **Expected:** "1–12 letters, digits, - or _".
   - Enter `SD1`.
5. **Import**.

## 3. DFD after the import

1. **Expected on the top page:**
   - A new multiprocess **Smoke Detector Case**. It may lie on top of other elements.
   - Around it, nested: **Smoke Detector Case [CASE]** (outer) and **Sensor
     Boundary [SB]** (inner). They are references to the component's boundaries.
   - To move it, select the multiprocess **and** both boundaries together. The
     boundaries can be resized.
   - **No** "Adopt pages…" notice above the diagram. If it appears: do **not**
     confirm it, stop the test and report.
   - Three new flows (boundary flows):
     - Debugger → multiprocess *pull debug commands*
     - multiprocess → P-1 *stream sensor data*
     - P-1 → multiprocess *pull calibration command*
   - New items may carry placeholder ids (MP-xx, DF-xx) until you renumber (step 6).
2. Click the multiprocess → details panel.
   - **Expected:**
     - Tabs **Component**, **General**, **Asset** in one bar. The panel opens
       on **Component**. Identity and child page are shown as a header above.
     - Tab **Component**: "Imported component (SD1) — read-only" with
       **Open component TARA**. The tab shows a count of open items (here the
       2 open assumptions of use).
   - Choose another tab, then click a second imported multiprocess (once there
     is one, section 9): the chosen tab stays.
   - Click the CMP_AOU_OPEN finding in the DFD panel: the **Component** tab opens.
   - **Open component TARA** opens the component file.
3. Open the multiprocess's child page.
   - **Expected:**
     - The component elements carry the prefix: SD1:P-1 Optical Detection
       Controller, SD1:P-2 Sensor Communication Controller, SD1:P-3 Sensor
       Diagnostic Controller, SD1:P-4 Sensor Update Handler, SD1:DS-1,
       SD1:DS-2, SD1:IF-1 RS485, SD1:IF-2 JTAG.
     - The 8 internal flows carry the prefix too (SD1:DF-1 … SD1:DF-11,
       without DF-7, DF-8, DF-9).
     - The boundaries CASE, SDS and SB carry **no** prefix.
     - Context copies of *Debugger* and *Alarm Processing Controller* stand
       where the component's external entities were.
4. Read-only check on the child page:
   - Moving, deleting or renaming a component element → **not possible**.
   - Drawing a new flow to an SD1 element → **not possible**.
5. The machine's own page stays editable. Move a process, for example.
6. Save, then **Renumber all pages**.
   - **Expected:**
     - The SD1 numbers on the child page do not change.
     - Only machine items are renumbered. The multiprocess and the three
       boundary flows get real numbers (MP-n, DF-n).
   - Click a boundary flow: the details show the component's properties. On
     the child page it is the **same** flow (same DF number), not a second one.
7. DFD findings.
   - **Expected:**
     - CMP_AOU_OPEN: 2 assumptions of use open for SD1 (wanted, not noise).
     - **No** CMP_SOURCE_UNPINNED.
     - **No** CMP_FLOW_NOT_IN_COMPONENT, **no** CMP_COMPONENT_PAGE_CHANGED.
     - **No** BAL findings (for example BAL_MISSING_PARENT_FLOW) and no
       invalid source/target errors on the boundary flows.

## 4. Assets

1. Assets tab.
   - **Expected:**
     - Four new assets: **SD1:DA-001** smoke meas data, **SD1:DA-002**
       calibration data, **SD1:DA-005** sensor firmware, **SD1:FU-001** smoke detection.
     - Each shows the owner chip "Component SD1".
     - No impact rating. The machine rates the impact.
     - The links point to SD1 elements, for example SD1:DA-002 → SD1:DS-1.
     - Name, description, DFD links and the component's security goals are
       read-only. Impact, damage scenarios and further goals can be edited.

## 5. Threats

1. Threats tab, method **STRIDE per Element**.
   - **Expected:**
     - A section **Threats from imported components (…) — read-only** with
       the group of instance SD1.
     - 70 imported threats, 25 of them relevant. The component's threats on
       its external entities (Debugger, Smoke Detector Controller) are **not**
       taken over; the machine generates threats for its own elements.
     - Ids have the form `SD1:DF7-T-1`.
2. The machine's own threats:
   - **None** on an SD1 element.
   - **None** on the three boundary flows; per element these flows belong to the component.
   - Threat sync reports **nothing missing** for the component.
3. Switch to **STRIDE per Interaction**.
   - **Expected:**
     - The section shows 52 imported threats, 13 of them relevant.
     - On the three boundary flows the machine generates only the perspective
       with the machine side as victim.
4. Switch back to **STRIDE per Element**.

## 6. Override the relevance of a boundary-flow threat

1. In the import section only the rows on the component's boundary flows
   (component DF-7, DF-8, DF-9) have the button **Override**. Per element
   these are 9 rows. Rows on internal flows or elements do **not** have it.
2. On **SD1:DF7-T-1** (component relevance: relevant) → **Override**.
   - **Expected:** a dialog "Relevance of SD1:DF7-T-1 in this machine" with an intro text.
   - **Save** stays disabled while **Rationale (required)** is empty.
3. Choose **not relevant**, enter a rationale (for example "The flow runs
   inside the machine housing, no access") → **Save**.
   - **Expected:**
     - The row shows the machine's decision and the button **Change**.
     - The matching risk leaves the risk register or is no longer listed as relevant.
4. **Change** → **Back to the component's decision**.
   - **Expected:** the row is back in the component's state; the risk is back.
5. Set the override again. Keep it for section 8.

## 7. Risks and taken-over factors

1. Risk tab.
   - **Expected:**
     - Besides the 60 own risks there are the risks of the relevant imported
       threats, without the overridden one.
     - **No** CMP_METHOD_MISMATCH: both files use the same likelihood method.
2. Open an imported risk (id `SD1:…`).
   - **Expected:**
     - *Skill Level* and *Ease of Exploit* are prefilled and carry the badge
       **Component** (tooltip: "Taken over from the imported component's rating (intrinsic factor)").
     - *Motive*, *Opportunity* and *Deployment Scope* are empty. They depend
       on the context; the machine rates them.
3. Change the value of *Skill Level*.
   - **Expected:** the field **Why this differs from the component's rating (required)** appears.
4. Close the dialog **without** a rationale.
   - **Expected:** the message panel of the Risk tab (below the list) shows
     CMP_FACTOR_OVERRIDE_RATIONALE: "Component SD1 (Smoke Detector Case): 1
     risk(s) override a factor value taken over from the component without a
     rationale." It counts for the Risk phase, not the DFD phase. A click opens
     the risk in the risk dialog.
5. Add a rationale.
   - **Expected:** the warning is gone.

## 8. Save, close, reopen

1. Save and close the file.
   - If a commit/diff dialog appears: it lists the component import, instance
     SD1 and the changed factor ratings.
2. Open the file again.
   - **Expected:** everything is back:
     - the multiprocess and its locked child page
     - the 4 SD1 assets
     - the import section with its threats and the override (section 6)
     - the factor value with its rationale (section 7)
     - no CMP_SOURCE_UNPINNED

## 9. Second import of the same component

1. **Import component TARA…** again with the same file.
   - **Expected:** a dialog "Smoke Detector Case is imported already" with the
     existing instance (SD1) and two choices: identical units in the same
     place → raise the quantity; another place or other connections → add a
     further instance.
2. Choose **Raise quantity (SD1: 1 → 2)**.
   - **Expected:** the dialog closes, the DFD does not change. The
     **Component** tab of the multiprocess shows quantity 2. The threat group
     is labelled with "×2"; the threats are listed once.
3. Set the quantity in the **Component** tab back to 1.
4. Import again, choose **Add a further instance**.
   - **Expected:** the import form with suggested prefix `SDC1` (or the next
     free one) and a **Quantity** field (1). Entering `SD1` shows "Already used
     by another instance". Enter `SD2`.
5. Import with the same mapping.
   - **Expected:**
     - Threats and Risk tab show the same structure. Each instance stands in
       the group of **its** multiprocess as a card "[SD1] SD1 · Smoke Detector
       Case" or "[SD2] SD2 · Smoke Detector Case", with an info icon
       (read-only). All threats and risks of an instance are in that card,
       also those on boundary flows. The top level has no SD card.
     - **Override** acts on its own instance only.
     - The filter bar filters the cards too.
     - Check the DFD panel for "ID label "CASE" is used multiple times" (also
       SB, SDS). The boundaries keep their unprefixed id, so a second instance
       brings them twice. If the warning appears, report it as a deviation.
6. Set the assumptions of use differently (multiprocess → **Component** tab):
   - SD1: both assumptions **fulfilled**, with evidence.
   - SD2: ASM-01 **not fulfilled**, with a rationale.
   - **Expected:**
     - SD2 shows the error CMP_AOU_VIOLATED.
     - The component measures relying on ASM-01 (M-T-008, M-T-009) count as
       **not effective here** in SD2 (CMP_MEASURE_NOT_EFFECTIVE). Their risks
       in SD2 show the value before treatment. SD1 is not affected.
7. Copy ratings:
   - In SD1 rate some risks (context factors, one taken-over factor
     overridden with a rationale) and override one boundary-flow threat.
   - Click the SD2 multiprocess → **Copy ratings from another instance…** →
     source SD1, defaults (decisions on, impact off, "Only fill what is not
     rated here yet") → **Copy**.
   - **Expected:** a message "Copied: n factor rating(s), 1 relevance
     override(s), …". The SD2 risks have the same values, with the rationale.
     The override appears in the SD2 row. Changing SD1 afterwards leaves SD2 unchanged.
8. Delete SD2 again (multiprocess and child page).

## 10. Foreign flow on the component

1. On the top page draw a new flow from **P-2 Fire Panel Communication
   Service** to the multiprocess *Smoke Detector Case*. Save.
   - **Expected:** the flow carries CMP_FLOW_NOT_IN_COMPONENT: "… is attached
     to the imported component SD1 (Smoke Detector Case) but is none of its interfaces …".
2. Delete the flow.
   - **Expected:** the error is gone.

## 11. Delete the instance

1. Delete the multiprocess *Smoke Detector Case* on the top page and save.
   Answer "Delete the child page too?" with **Delete page**. The boundaries
   CASE and SB on the top page go with the child page.
   - **Expected:**
     - The message "Component instance removed with its multiprocess: SD1".
     - Gone: the child page, the 3 boundary flows, the 4 SD1 assets, the
       import section in the Threats tab and the imported risks.
     - The machine's own elements, threats and risks are unchanged.

## 12. Update to a newer component state (about 30 minutes)

### 12.0 Preparation

1. In the machine, import the component again as **SD1** (section 2) and a
   second time as a further instance **SD2** with the same mapping (section 9).
   - **Expected:** no CMP_SOURCE_UNPINNED. The **Component** tab of the
     multiprocess shows a commit.
   - **Expected after the import** (wanted, not noise): CMP_AOU_OPEN "2
     assumption(s) of use still open" per instance; the impact of the imported
     assets (SD1:DA-001 …) is unrated; the machine-side threats on the new
     boundary flows wait for a decision.
2. Optional: connect the Jira test instance (Integration tab).
3. Risk tab:
   - **SD1:P2-T-1** (Undefined fail-safe output state, on SD1:P-2): set a likelihood factor.
   - **SD1:P4-T-1** (Embedded process firmware tampering, on SD1:P-4 Sensor
     Update Handler): set a factor and choose an **own measure**.
     With Jira: in the status dialog, in the ticket row of the measure,
     **Create…** → **Create ticket**. Note the ticket key (called TICKET below).
   - **SD2:P2-T-1**: set a factor only.
4. Save. Commit in the Audit tab.

### 12.1 Layout change only

1. In the component, only move elements (add or delete nothing). Save, commit.
2. In the machine, **Component** tab of SD1 → **Check**.
   - **Expected:** "Newer state available (…)" — the DFD layout is part of the
     imported state. **Update…** shows "No decision of this machine is affected
     — the update can be applied right away." **Apply update** changes no
     rating; the component pages show the new layout.

### 12.2 Change the component

Open `import-example/SmokeDetectorCase.tara.json` in TARAflow as a second project:

1. **Change a threat text:** P2-T-1 (Undefined fail-safe output state) → edit
   the description slightly.
2. **Remove an element:** in the DFD delete **P-4 Sensor Update Handler** with
   its flows. Regenerate the threats in the Threats tab. The P-4 threats are gone.
3. **Redraw a boundary flow:**
   - Delete **DF-8 "pull debug commands"** (EE-1 Debugger → P-3 Sensor Diagnostic Controller).
   - Draw it again between the same two elements, in the same direction.
   - Set the protocol **spi** and the same label as before.
   - Regenerate the threats.

   Renaming alone is not enough: the id would stay the same and there would be nothing to pair.
4. Save. Commit in the Audit tab of the component (or in a terminal:
   `git commit -m "audit: try component change" -- import-example/SmokeDetectorCase.tara.json`).

### 12.3 Drift and update

1. In the machine select multiprocess **SD1**, tab **Component** → **Check**.
   - **Expected:** "Newer state available (<commit>) — the update follows as an
     explicit step" and an info finding (CMP_NEWER_STATE_AVAILABLE) in the DFD panel.
2. Open **Update…**.
   - **Expected:**
     - **What changed in the component** lists removed elements, added and
       removed threats, and added and removed flows.
     - **Possible pairings** lists the boundary flow DF-8 old → new ("same ends
       and protocol") and threat pairings for the threats on DF-8 ("same text"
       or "same STRIDE and target"). Nothing is ticked.
     - "Afterwards N decision(s) to review": N includes at least the ratings of
       SD1:P2-T-1 and SD2:P2-T-1 (text changed).
     - With Jira: "Tickets losing their risk: TICKET …".
     - The dropped items include the risk rating and the risk treatment of P4-T-1.
   - Tick a **threat** pairing. **Expected:** N changes if the machine rated a
     threat on DF-8.
   - Tick the **boundary flow** pairing. **Expected:** N stays the same. The
     machine works per element and has no own threats on boundary flows. This is not an error.
3. **Apply update.**
   - **Expected:**
     - The DFD reloads. SD1 and SD2 are updated.
     - The boundaries (CASE, SB) lie correctly around the multiprocesses.
     - The new DF-8 is attached to the machine's Debugger.
     - P-4 is gone from the component pages.
     - The status shows **Up to date** right away.
     - The **Component** tab of **SD1** and of **SD2** each shows a list
       "n decision(s) to review after the update", at least "Risk rating: …" for P2-T-1.

### 12.4 Discard

1. In SD1 **Confirm** one review. It leaves the list.
2. **Discard update**.
   - **Expected:** the question "Discard the update?" names confirmed reviews,
     ratings and DFD. **Cancel** is preselected. Cancel once, then again and **Discard**.
   - **Expected after Discard:**
     - DFD: P-4 and the old DF-8 are back on both component pages.
     - Threats tab, section "Threats from imported components": the P-4 threats are back.
     - Risk tab: the P-4 risk is back (with TICKET, if created).
     - The review list is gone; the confirmed review is not kept either.
     - The status shows **Newer state available** again.

### 12.5 Apply for good

1. Open **Update…** again and apply it with the same choices. **Save**.
   - **Expected:** **Discard update** is no longer offered.
2. Audit tab → open the commit dialog and read the proposed message.
   - **Expected:** below the component import change there are lines
     "Update: …", among them:
     - `… riskTreatment … dropped (ticket TICKET loses its risk)` (with Jira)
     - the paired decisions with `→ … (to review)`
   - Commit or cancel.
3. With Jira: TICKET was **not** closed. TARAflow closes no tickets. Close it
   by hand after the test.

### 12.6 Offline

1. Switch the network off. Or, in the examples repository:
   `git remote set-url origin git@invalid.example:x.git` (note the real URL first).
2. In the machine **Fetch and check**.
   - **Expected:** "Not checked — the remote is not reachable (offline?)",
     **not** "Not checked — branch or tag not found …".
3. Switch the network on again or restore the real URL.

## 13. Overview: Components view (about 10 minutes)

Use the machine from section 12 (SD1 and SD2 imported).

1. Overview → **Components**.
   - **Expected:** the view is there only when something is imported. The
     component itself does not have it.
2. One card (accordion) per component; the first one is open.
   - **Expected:**
     - Header: name, version, chips SD1 and SD2, the check status as a chip.
     - Description (as in the component), Responsible, Tags.
     - **Component TARA:** Repository "this repository", File
       `import-example/SmokeDetectorCase.tara.json`, Commit (8 characters), Imported on.
     - **Methodology:** "same likelihood method and factor scales as this TARA".
     - **Instances in this TARA:** SD1 and SD2 with "assumptions of use: x of 2
       decided, y not fulfilled".
     - **Show in DFD** switches to the DFD, selects the multiprocess and opens
       its **Component** tab, also if another tab was chosen before.
     - Everything is read-only; no input field.
3. In the component change the description, commit. In the machine **Check**.
   - **Expected:** "Newer state available"; the **Components** view shows a badge 1;
     **Update…** names "The component's overview changed (description, responsible,
     sources, Item Definition texts)." After the update the card shows the new description.
4. Optional: in the component, Overview → **Sources**, add a source reference,
   commit, update the machine. **Expected:** it appears under **Sources of the component**.
5. Only when testing with a machine whose import was made by an older
   TARAflow: **Check** may show "Up to date · this TARAflow reads it differently
   — refresh the stored state" (CMP_SNAPSHOT_BUILDER_CHANGED), or the card says
   "Imported before the component's overview was taken along …". In the
   **Component** tab, **Refresh stored state…** opens the update dialog on the
   same commit. Apply, save. **Expected:** **Check** shows **Up to date** without addition.

## 14. Report (about 25 minutes)

Use the machine from section 12 (SD1 and SD2 imported, some decisions made).
For the deviation list first set in SD1:

- assumption ASM-01 **not fulfilled**, with a rationale;
- a component measure **Not effective here…** with a rationale (risk dialog,
  section "Treatment in the component");
- a boundary-flow threat with an overridden relevance;
- an imported risk with a factor rated differently from the component.

Documentation tab: generate Markdown **and** PDF, each in English and German.

1. **Threat chapter:** the imported threats stand per component (group
   "Smoke Detector Case — imported (SD1, SD2)"), each threat once, the
   instances only where they differ.
   - **Expected:** every row of an imported risk links to its threat and names
     where its rating comes from (component / this TARA).
2. **Attack trees:** the component has one tree on DA-002 (calibration data)
   with two AND combinations. Structure once, paths per instance (SD1, SD2),
   per step all five factors with their origin. Multi-line cells wrap in every
   format (Markdown, AsciiDoc, HTML, PDF).
   - **Expected** in this IEC 62443 / CRA machine: under the rating "For
     information — this TARA does not rate attack paths …"; per step the window
     of opportunity marked "component" like the other four factors, nowhere
     "not rated"; attack potential, feasibility and relevance "–".
3. **Chapter "Imported Components"** after the Item Definition:
   - per component: description, version, responsible, repository / file /
     commit, imported on, last update, methodology, sources;
   - per instance: quantity, EE mapping, measures "Not effective here" /
     "Unclear here" with reason, assumptions of use with status, rationale and evidence;
   - **Deviations from the component:** groups in this order — goals added by
     this TARA, measures not effective here, assumptions of use not fulfilled,
     threat relevances overridden, factors rated anew by this TARA. Cited claims
     stand **separately** ("This TARA relies on — a change affects it").
   - **Expected** in the German report: headings and fixed texts in German;
     component texts and own rationales as written.
4. Overview → **Components** → **Copy as text**, paste into an editor.
   - **Expected:** the same groups as in the report, in the app language; title
     "Deviations from Smoke Detector Case @ …", "For: …" with the responsible person.

## 15. Audit, findings and update from the Overview (about 20 minutes)

1. Audit tab → **Verify audit trail**.
   - **Expected:** no finding "An imported component's snapshot was changed after the import".
   - Optional: in a text editor change a text inside the embedded `snapshot` of
     the machine file (for example a threat description), commit with
     `git commit -m "audit: try snapshot edit" -- import-example/SmokeDetectorController.tara.json`,
     verify again. **Expected:** CMP_SNAPSHOT_HASH_MISMATCH with the commit; the
     **Component** tab of the multiprocess offers **Refresh stored state…**.
     Then close the machine and undo the commit on the throwaway branch:
     `git reset --hard HEAD~1`. Reopen the machine.
2. **Commit message:** commit in the Audit tab.
   - **Expected:** subject `[TARA] <round> — import-example/SmokeDetectorController.tara.json`,
     trailer `Project-File: import-example/SmokeDetectorController.tara.json`.
     `git log --oneline` shows the file. The commit passes the hook; verification
     reports no MSG_SCHEMA finding.
3. **Diff lines:** change an assumption of use or the quantity, save, look at
   the changes in the Audit tab.
   - **Expected:** a readable line (assumption status, EE mapping, quantity),
     not "Component instance modified: n change(s)" alone.
4. **Findings visible:** set an assumption in SD1 to **not fulfilled**.
   - **Expected:** the DFD phase is no longer green (badge, progress in the
     Overview, the tooltip names the component finding).
   - Overview → **Sources**: add a source reference with credentials in the
     URL (for example `https://user:token@example.com/repo`).
     **Expected:** the form warns ("The URL contains credentials — remove them …")
     and saving is blocked. Without credentials it saves, and the General phase
     shows no warning. Remove it again.
5. Overview → **Components**: **Check** and **Fetch and check** in the card.
   - **Expected:** the check status chip updates; both buttons are disabled
     while the check runs.
6. In the component change only the **description**, commit. In the machine
   Overview → **Components** → **Check**, then **Update…**.
   - **Expected:** the DFD tab opens with the update dialog (the same as from
     the **Component** tab). At the top, in green: "No decision of this machine
     is affected — the update can be applied right away." The apply button has
     the focus. Cancel is possible; nothing is applied without a click.
   - Apply. **Expected:** the new description in the card, status **Up to date**.
7. In the component delete a threat the machine has rated, commit. **Update…**
   from the Overview.
   - **Expected:** **no** green notice; the decisions to review / dropped are
     listed (as in 12.3).

## 16. Unpinned import, then commit (about 10 minutes)

1. In the examples repository create an uncommitted copy of the component with
   its own project id. Without its own id it counts as the same component and
   the dialog only offers quantity or a further instance.

   ```bash
   cp import-example/SmokeDetectorCase.tara.json import-example/SmokeDetectorCase-copy.tara.json
   perl -pi -e 's/"id": "proj_smoke_detector_case"/"id": "proj_smoke_detector_case_copy"/' import-example/SmokeDetectorCase-copy.tara.json
   ```
2. In the machine: **Import component TARA…** → **Choose file…**.
   - **Expected:** the file dialog starts in the machine's folder.
3. Choose `SmokeDetectorCase-copy.tara.json`.
   - **Expected:**
     - The source is marked unpinned with the reason "The file is not committed
       in its repository." (A file outside any repository shows "The file is
       not in a git repository.")
     - The checkbox **Import the unpinned state anyway** is there. **Import**
       stays disabled until it is ticked.
4. Map as usual, prefix of your choice, tick the checkbox, **Import**.
   - **Expected:**
     - CMP_SOURCE_UNPINNED: "Component … is imported unpinned (…)" with the hint to commit the file.
     - **Check** shows "Up to date" with "not pinned — its file is not committed
       yet", no **Update…** button.
     - Overview → **Components** shows two cards, one per component; each can be
       collapsed. The copy shows "not pinned to a commit".
5. Commit the copy unchanged
   (`git add import-example/SmokeDetectorCase-copy.tara.json && git commit -m "audit: try unpinned copy"`), then **Check**.
   - **Expected:** "Up to date · committed by now (<commit>) — refresh the stored
     state to pin the import to it" and the button **Refresh stored state…**. The
     dialog says "No decision of this machine is affected …". Apply → the
     CMP_SOURCE_UNPINNED finding is gone, the card shows the commit.
6. Remove the copy's instance in the machine and save.

## 17. Delete the instances and clean up

1. Delete SD2 in the DFD, save.
   - **Expected:** the card in Overview → **Components** shows only SD1.
2. Delete SD1.
   - **Expected:** the **Components** view disappears; the Overview shows **Project**.
3. Clean up the examples repository:

   ```bash
   git switch -          # back to the branch you started from
   git branch -D try-update
   rm -f import-example/SmokeDetectorCase-copy.tara.json
   git status            # must be clean
   ```

---

## Reporting

For every step report **OK** or **Deviation**. For a deviation add:

- a screenshot,
- the exact finding text (and code, for example CMP_AOU_VIOLATED),
- the console output (Developer Tools → Console),
- the section and step number.

## Known limits

These are deliberate. Do not report them as deviations.

- The component's source references are read-only in the machine. The
  machine does not check or resolve them itself.
- The PDF has no internal links.
- ISO/SAE 21434 with components is covered by automated tests only; there is
  no ISO example pair with an import. When a project uses ISO/SAE 21434 with
  imported components, test these four things by hand:
  - rating the window of opportunity per step in the dialog, also for AND combinations;
  - the attack potential with the machine's window in the report;
  - the findings CMP_PATH_WINDOW_UNRATED, CMP_PATH_NOT_RATABLE and CMP_NO_ATTACK_PATHS;
  - copying the window ratings between instances.
