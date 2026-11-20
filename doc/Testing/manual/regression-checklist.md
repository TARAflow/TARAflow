# Manual regression checklist

## Purpose

This checklist covers behaviour that unit and E2E tests do not fully cover:
layout, tooltips, dialogs, cross-tab consistency, the report, git and tracker
round trips. Run it by hand before every release and before the 1.0.0-rc.
Component import has its own checklist: `component-import.md` in this folder.

## Prerequisites

- Desktop app (Electron). Build it with `npm run build:electron-dev`, then start it,
  or use the release build. The keychain and git checks only work in the desktop app.
- The `TARAflow_Examples` repository checked out.
- Work on copies. Some checks change files. Copy the examples first, for example:
  `cp TARAflow_Examples/*.tara.json /tmp/` and open the files from `/tmp`.
- Optional: a Jira Cloud test instance (or another supported tracker) for the
  Integration checks. Skip those rows without one.
- Optional: a scratch git repository for the Audit commit checks.
- UI language English unless a check says otherwise.

Example files used below:

| File | Use |
|---|---|
| `SmokeDetector-leveled.tara.json` | Tags CRA + IEC 62443, safety-relevant (5 hazards), 22 assets, per-element and per-interaction risks, DFD with several pages |
| `Headlamp_ISO21434_Example.tara.json` | ISO/SAE 21434: 10 attack trees, 17 attack-path risks, goals and claims, Item Definition |
| `Pump_Station_Controller-IEC62443-CRA.tara.json` | Tags EN IEC 62443 (CRA) + CRA, requirement matrix with statements, SL-T set |
| `Simple_Test_Project.tara.json` | Tags IEC 62443 + EN 50742 A, attack tree with an AND gate, tracker settings |
| `cnc-ref.tara.json` | Tags CRA + EN 50742 A, one hazard |

Mark each row: OK, or a deviation with a note (screenshot, finding text, console message).

---

## General / Overview

| ID | Check | Expected |
|---|---|---|
| GEN-1 | Open each example file listed above. | Opens without a conversion dialog and without an error. |
| GEN-2 | Save each file once, then run `grep -ciE '"(apiToken\|accessToken\|refreshToken\|password\|token)"' <file>` and `node scripts/secret-scan.mjs <file>`. | grep prints `0`; the secret scan exits with 0. |
| GEN-3 | SmokeDetector-leveled → Overview → Phase Progress. | Every card shows its own status. The Hazard card is there (safety-relevant). |
| GEN-4 | Hover over a phase card that has findings. | Tooltip shows the phase and status, the count of errors and warnings, up to five findings, then "… n more", and "Click to open the tab". |
| GEN-5 | Clear Version or Responsible in the Overview, hover the General card. | Tooltip shows "Missing: Version, Responsible" (or the missing fields). Restore afterwards. |
| GEN-6 | Click a phase card (for example DFD). | The matching tab opens. |
| GEN-7 | Hover the phase tabs at the top (DFD, Threats, Risk). | Same text as the card tooltip, one line per finding. |
| GEN-8 | Compare the error count on the DFD tab badge, the DFD card and the DFD notification panel (filter "Errors"). | All three show the same number. |
| GEN-9 | Create a DFD error (for example a flow without target), go back to the Overview. Then remove it. | Card and tab show the error at once; it disappears after the fix. |
| GEN-10 | Pump Station → Overview → Phase Progress. | Not safety-relevant: no Hazard tab. General, DFD, Assets, Threats and Risk are "Complete". |
| GEN-11 | Pump Station → Overview → Definition. | Neutral wording: "System boundary" and "Architecture", no ISO clauses. Functions and assumptions ASM-01 … are filled. Headlamp shows the ISO wording ("Item boundary", "Preliminary architecture"). |
| GEN-12 | Overview → Tags → add "EN IEC 62443 (CRA)" and remove "CRA" on a copy. | Hint "EN IEC 62443 (CRA) is a harmonised standard under the Cyber Resilience Act — consider adding the CRA tag as well." It is a hint, not a block. Restore the tag. |
| GEN-13 | cnc-ref copy: remove `"safetyRelevant": true` from `info` with a text editor, open the file. | The Hazard tab is shown at once; the Safety Analysis setting shows "Required by EN 50742 — locked on". After saving, `"safetyRelevant": true` is back in the file. |
| GEN-14 | A project without an EN 50742 tag: switch the Safety Analysis on by hand, save, reopen. | It stays on. |
| GEN-15 | Two projects open (A and B). In A move or rename a DFD element and switch to B within one second. Repeat with a risk, a hazard, the Overview description, an attack tree DSL edit, "Generate" in Threats, a Compliance statement. | Every change stays in A. B is unchanged. Save both and compare with `git diff` or a diff tool: no data of A in B. |

## DFD

| ID | Check | Expected |
|---|---|---|
| DFD-1 | Pump Station → DFD notification panel. | No messages. |
| DFD-2 | Pump Station → DFD notification panel, filter "Notes". | Planned controls of open mitigations (for example at DF-7, DF-10, DF-11) appear as "planned", without "Apply". Tooltip: "Planned mitigation (open / in progress) — not yet in the DFD. Apply is offered once the mitigation is implemented." |
| DFD-3 | Headlamp: on a data flow with Integrity Protection "HMAC" set it to "None". | A gap or "Drift" line appears for the mitigation behind it. "Apply" writes the value back into the element; the line disappears. |
| DFD-4 | After DFD-3, set the same property to "None" again. | Line "Drift" with "Property was reverted after Apply" and with "Apply". Apply restores the value. |
| DFD-5 | New project → DFD → library. | Three data flows: "Dataflow (curved)", "Dataflow (orthogonal)", "Dataflow (straight)". The straight one draws a line without a bend. |
| DFD-6 | Draw more than 9 data flows, auto-number. | The ID box of DF-10 and higher is wide enough (no wrap). Editing an ID label by hand resizes the box. |
| DFD-7 | Drag an interface from the second library page into the DFD, auto-number. | The interface gets an ID box (IF-n). |
| DFD-8 | Pump Station → P-1 HMI Runtime → details panel → Security. | Tabs "Login & accounts", "Authorization", "Communication", "Robustness", "Sessions & traceability", "Operation". "Secure channel (endpoint)" is under "Communication". Tabs with open fields show a count. The bar fits the narrow panel; tabs wrap to a second line, they do not scroll. |
| DFD-9 | Select tab "Operation" on P-1, click another process, then P-1 again. Then pick a tab on MP-1. | The other process also opens "Operation" (remembered per element type). A multiprocess remembers its own tab. |
| DFD-10 | MP-1 Pump Controller (PLC) → Security. | No "Safety" tab: "Safety-Relevant System" is shown below the tabs on every tab. |
| DFD-11 | New process with only a human-input flow, then add an OPC UA flow. | No "Communication" tab at first; it appears with the network flow. |
| DFD-12 | P-1 → "Secure channel (endpoint)". | Multi-select; "None" excludes the others. |
| DFD-13 | P-1: tick "SSH" in addition to TLS, no flow uses SSH. | Warning "P-1 … offers SSH, but none of its flows uses it …". Draw a flow to P-1 with encryption SSH → warning gone. Untick SSH on P-1 → error "the flow uses SSH but neither endpoint offers it". Undo. |
| DFD-14 | New process with an OPC UA flow, leave "Secure channel (endpoint)" empty. | Warning that the field must be set. Choose "None" → warning gone. Process with only operator input: no warning. |
| DFD-15 | P-1: Update Mechanism "Signed OTA". | "Operation" shows "Update package encrypted"; "Communication" shows "Key / certificate renewal". Renewal "Unencrypted" → DFD warning (keys travel in plain). Without an update mechanism the fields are hidden. |
| DFD-16 | Process with a flow from an operator: Authentication required empty → yes → no → yes. | "User accounts" appears only with yes. The chosen value is still there after no → yes. |
| DFD-17 | Operator flow with Endpoint Authentication "password", then "certificate". | "Password strength rules" and "Password lifetime limits" appear only with password. |
| DFD-18 | Update Mechanism empty / none / manual local / signed OTA. | "Update delivery" appears only with a mechanism other than none; manual local offers only "Manual only" and "Notification of available updates". Delivery "Automatic" shows "Automatic update settings". |
| DFD-19 | Process without a human neighbour. | No session fields; they appear once a flow to an operator is added. |
| DFD-20 | Multiprocess without a child page (black box) → Security. | Tab "Data" with the inside fields; "Robustness" and "Operation" hold the other inside fields. A multiprocess with a child page has no "Data" tab. |
| DFD-21 | Data flow with protocol Modbus TCP → Security. | Field "Access Mode" (Read only / Read / write / Write only). Human input or hard-wired signal: no field. |
| DFD-22 | Data flow from or to an external entity. | Field "Data Minimisation". Between two processes: no field. |
| DFD-23 | Pump Station → Trust Boundary CN → "Default Traffic Policy". | Multi-select with ticks. Choosing "Allow All" removes the others. |
| DFD-24 | Pump Station → Physical Boundary CAB. | "Further Physical Controls" is filled. Trust Boundary CN shows "Assumptions (Item Definition)" with ASM-02 and ASM-03. |
| DFD-25 | Two processes in two trust boundaries with a derived exposure level, connected. Enlarge one boundary until both are inside. | The flow loses the derived level. A manually set level stays. |
| DFD-26 | DFD → "Describe DFD". | Section "Assets" is always there; in a new project it says "No assets yet — create one with “+” or link one in an element." |
| DFD-27 | "+" in the Assets section → Name, Category → "Create". | The asset opens for editing, shows up in the Assets tab and in the asset graph ("Not in the DFD"). Esc or Cancel closes the input. Survives save and reopen. |
| DFD-28 | Describe view → expand P-1. | Same security tabs as in the details panel. |

## Assets

| ID | Check | Expected |
|---|---|---|
| AST-1 | Pump Station → Assets. | No findings. Function assets FU-001 … FU-003 exist and are linked in the asset graph. |
| AST-2 | SmokeDetector-leveled → Assets → "Asset type". | "All types"; each type with tick, icon and count. Unticking narrows the table in all accordions; empty accordions disappear. The last ticked type cannot be unticked; "Show all types" ticks all again. |
| AST-3 | "Criticality" filter → a level. | Only assets with that level or higher in "Overall". Unrated assets are hidden until "also unrated" is ticked. |
| AST-4 | Combine type, criticality and "Needs review only (n)". | Intersection. Right side shows "x of y assets shown". |
| AST-5 | Set a filter that matches nothing. | "No asset matches the filter." "Reset filter" shows everything again, also with "Needs review only" off. |
| AST-6 | Set a filter, switch to DFD and back; open another project and back; restart the app. | Filter stays while switching tabs; the other project has no filter; after a restart no filter. The file is not changed by the filter. |
| AST-7 | Asset graph: an asset hidden by the filter → "Show in table". | Filter is cleared, the row is highlighted. |
| AST-8 | Asset form (Assets tab and DFD asset panel) on any example. | No "Protection Need" field, no "Criticality" field on system assets, and no warning that either is missing. |
| AST-9 | DFD with only asset group fields missing (for example data type). | These show as info, saying "recorded with the asset; no calculation uses it, not in the report yet". The DFD can still reach "Complete". |
| AST-10 | SmokeDetector-leveled → asset graph. | Each category, "DFD elements" and both "Free row" lanes show three guide lines. Dragging a data asset snaps to a line of its own category, never into another. |
| AST-11 | Asset graph → "Rearrange" twice. | Full categories spread over three lines. The second run gives the same picture. |
| AST-12 | Pan the asset graph far to the right. | Category labels stay visible at the left edge, not hidden by nodes. |
| AST-13 | Asset graph → "Relations" menu. | Ticks "DFD element", "Asset", "Hazard", all set. Unticking one hides the assets and hazards that have that kind of relation; button shows "Relations: filtered (n)". "Show all" resets. Project without hazards: no "Hazard" tick. |
| AST-14 | SmokeDetector-leveled copy: set one hazard to "Out of scope" in the Hazard tab, then open the asset graph with hazards shown. | Counter "… of 4 hazards"; the out-of-scope hazard is not shown. |

## Hazards

| ID | Check | Expected |
|---|---|---|
| HAZ-1 | SmokeDetector-leveled → Hazard tab. | 5 hazards, no errors. |
| HAZ-2 | Remove the "endangers" link of a hazard. | Finding "Hazard "…" endangers no protection target." in the hazard findings panel and in the Hazard card tooltip. Undo. |
| HAZ-3 | H-04 "False alarm": clear the ISO 12100 type, then description, then rationale. | One warning each ("… has no ISO 12100 hazard type.", "… has no description.", "… has no rationale."). Warning badge on the Hazard tab and card. The phase stays complete. Undo. |
| HAZ-4 | Findings panel below the hazard table. | Errors first, then warnings. Resizable with the top handle, collapsible. Click on a finding opens that hazard; after the fix the finding disappears. |
| HAZ-5 | Project without hazard findings. | No findings panel. |

## Threats

| ID | Check | Expected |
|---|---|---|
| THR-1 | SmokeDetector-leveled → open a threat → "New project mitigation" with text and one DFD effect. | Entry M-C-001. The threat shows its text, not a key. |
| THR-2 | Create a second one. | M-C-002. The threat dialog offers catalog mitigations and "New project mitigation"; "Add custom verification" is still there. |
| THR-3 | Threats → "Configuration" → "Project mitigations". | Both with text and "Used by" the threat. Delete is disabled with "Still used — remove it from the threats, risks and attack trees first, or merge it." |
| THR-4 | Select M-C-001 and M-C-002 on the same risk with different status, then "Merge into …" M-C-001 → M-C-002. | Merge refused: "M-C-001 cannot be merged into M-C-002: risk … uses both with a different status, ticket, evidence or scope. …". Both unchanged. |
| THR-5 | Align the status, merge again. | M-C-001 disappears. The risk holds M-C-002 once, with ticket or evidence of M-C-001. |
| THR-6 | Regenerate threats. | Project mitigations on manual and generated threats stay. |
| THR-7 | Data flow "On Board (PCB)", no Physical Path Protection, unencrypted → regenerate per element. | Threat "On-board bus eavesdropping — plaintext data captured from exposed PCB traces" exists. With path protection or TLS it is gone. |
| THR-8 | Modbus TCP flow with Access Mode "Read / write", regenerate. | The tampering threat for write commands appears. "Read only" removes it. |
| THR-9 | Pump Station → regenerate threats. | No threat appears or disappears. |
| THR-10 | Pump Station → open threats. | Each threat has threat, attack and cause text; proposed mitigations and verifications have text right after opening the file. |
| THR-11 | Pump Station → "New project mitigation". | Section "IEC 62443-4-2 requirements it implements" with search. With an effect that already meets a row: "Met through the effects already: …". |
| THR-12 | Project without a 62443 tag (for example cnc-ref) → edit a project mitigation. | No requirements field. |

## Attack trees

| ID | Check | Expected |
|---|---|---|
| ATK-1 | Headlamp → Attack Tree tab. | 10 trees AT-1 … AT-10, leaves with `av=`; no parser errors. |
| ATK-2 | Overview of AT-1; editor → AT-1 → path AT-1.1. | "AT-1" before the title on the card and in the editor list. Path table has a first column "ID" with AT-1.1 …; the path dialog shows the tree ID and path ID. Same numbers as in the Risk tab and the report. |
| ATK-3 | Simple_Test_Project → tree "Integrity Violation" → paths. | "Input Validation Bypass" (AND) is one path "Find Weak Validation + Inject Malicious Data", not two. Its feasibility combines both steps. |
| ATK-4 | Write a tree with OR under AND (for example debug port OR JTAG, AND bypass signature). | Two paths, one per branch; each with the feasibility of its own branch. |

## Risks

| ID | Check | Expected |
|---|---|---|
| RSK-1 | Headlamp → Risk tab. | 17 risks, no ISO findings. Each risk has a rationale before and after. Toolbar shows the assessed count; the progress chip shows "n/17 done" with a tooltip. |
| RSK-2 | Headlamp: filter the risk table. | "Showing n of 17". |
| RSK-3 | Headlamp: remove all mitigations of a Reduce risk. | Finding "…: Reduce without a selected mitigation". Undo. |
| RSK-4 | Headlamp: remove the residual rating of a Reduce risk. | Finding "…: Reduce without a residual risk rating". Undo. |
| RSK-5 | SmokeDetector-leveled: remove all mitigations of SHE-T-1 (Reduce). | Warning "1 risk to reduce has no mitigation (SHE-T-1)" in the Risk toolbar, the Risk card and the Risk tab tooltip. Accepted risks do not trigger it. Undo. |
| RSK-6 | SmokeDetector-leveled: clear the factors after mitigation of SHE-D-1. | Warning "1 risk to reduce has no residual risk rating (SHE-D-1)". Undo. |
| RSK-7 | SmokeDetector-leveled: hover the inactive method button (Per-Element / Per-Interaction). | Badge with the risk count of that method; tooltip "…: n risks from m threats (k rated not relevant)". |
| RSK-8 | Headlamp: open AT-1.1 → "Risk Before" and "Risk After". | Boxes Feasibility, Impact, Risk. Before: feasibility from attack tree path AT-1.1, impact from the damage scenario. No read-only attack tree field and no "Attack Tree Likelihood" picker among the factors. Rating all five factors in After updates the feasibility box and nothing jumps back. Close without saving. |
| RSK-9 | Headlamp: open an attack-path risk, look at the list on the left of the dialog. | Sorted by ID: AT-1.1, AT-1.2, AT-1.3, AT-2.1 … AT-10.2. |
| RSK-10 | Headlamp: risk dialog → tab "Goal / Claim". | AT-1.1 shows CSG-01; AT-10.1 shows CLM-01; AT-9.1 shows CLM-02. |
| RSK-11 | Headlamp: "Goals & Claims" → delete the last goal, create a new one. Same for a claim and an Item Definition assumption. | New IDs continue after the highest ever used (no reuse of the deleted ID). Restore the copy afterwards. |
| RSK-12 | Headlamp: rename a node of a path that has a goal, sync risks, open "Goals & Claims". | The goal shows "removed (R-AT-…)" with "Re-link to …" and "Remove link"; finding "… is linked to a risk that no longer exists". "Re-link to …" offers only paths of the same tree and STRIDE category. Picking one clears the finding. |
| RSK-13 | SmokeDetector-leveled (not ISO): Risk tab, risk dialog, report, Audit tab. | No "Goals & Claims" button, no "Goal / Claim" tab, no goal/claim markers, no "Cybersecurity Goals and Claims" chapter, no verification panel. |
| RSK-14 | Simple_Test_Project: Risk configuration → set own thresholds. | One risk has the same level and colour in matrix cell, matrix tooltip, table chip and tooltip, the list in the risk dialog, the risk score panel and the report. Impact and Likelihood chips show the colour of their own level. |
| RSK-15 | Save after RSK-14 without changing a value. | The display does not change the file. |
| RSK-16 | Project with open risk items (unrated risk, "Won't" without justification, Reduce without mitigation). | Toolbar chip and phase tooltip use singular and plural correctly ("1 risk has not been rated" / "3 risks have not been rated") and list the IDs. |

## Compliance (IEC 62443 / CRA / EN 50742 A)

| ID | Check | Expected |
|---|---|---|
| CMP-1 | SmokeDetector-leveled (tags CRA + IEC 62443). | Entry "Compliance" on the right of the tab bar, classic edition "IEC 62443-4-2:2019" (filter "All" = 125 rows) with device categories. The CRA tag alone does not pick the CRA edition. |
| CMP-2 | Add tag "EN IEC 62443 (CRA)". | Sub-tab bar with "EN IEC 62443-4-2 (CRA)" first and selected, then "IEC 62443-4-2:2019". The CRA edition has 97 rows, a draft chip and no device categories. |
| CMP-3 | Switch sub-tab, open another tab, come back. | The last chosen sub-tab is open again. The filter of each sub-tab is separate. |
| CMP-4 | Add a statement on CR 7.8 in one edition, look at the other. | The statement applies there too. Remove it again. |
| CMP-5 | Remove all 62443 tags. | The Compliance entry disappears; the matrix data stays in the file. Restore the tags. |
| CMP-6 | Pump Station → Compliance. | No sub-tab bar. "How to work with this tab" is collapsed (SL-T set) and opens with five steps. "Component under evaluation": "Whole model". |
| CMP-7 | Pump Station → "To do up to the SL-T". | Elements with open items, the one with most items first, among them DF-7. CR 7.8 under "Statements needed". Items closed by open mitigations carry the chip "closed by planned mitigations". |
| CMP-8 | Hover CR 1.2 in the to-do list, then click CR 7.8. | Tooltip with title and summary. The info dialog shows "What it is about", "How TARAflow checks it" and "Summary in our own words — the standard is authoritative." "Add statement" closes the info dialog first, then opens the statement dialog. |
| CMP-9 | Statement on CR 7.8: status met, reasoning, evidence; save. Then remove it. | CR 7.8 leaves the to-do list and RA in "SL-C (product)" rises. After removal it is back. |
| CMP-10 | Info dialog of CR 3.1. | "not met by" DF-7, DF-9, DF-10, DF-11, DF-14 — not DF-1 (human input) and not DF-12 / DF-13 (internal to the store). |
| CMP-11 | Statement on CR 1.2 "not met", then change Endpoint Authentication of DF-10. | Row shows "The model changed since the statement — review it." Reset DF-10, remove the statement. |
| CMP-12 | "Show" filter. | All, Open, Gap, Statement needed, Information missing, Not applicable, Met (incl. claimed), each with a count. Default "Open". An empty filter shows "No requirements with this status." With "All" each row names its source. |
| CMP-13 | Click DF-7 in the to-do list (tooltip "Show in the diagram"), also from the Describe view and the asset graph. | DFD drawing opens, DF-7 is selected and shown in the details panel. A second click selects it again. |
| CMP-14 | SL-T "all FR" → 3, then back to 2. | All seven FR change; the to-do list grows, then shrinks back. |
| CMP-15 | Component under evaluation → MP-1 Pump Controller (PLC), then back to "Whole model". | Values and rows follow the component; back gives the previous values. |
| CMP-16 | P-1 → "Session Lock after Inactivity" → No, then Not specified, then back to Yes. | CR 2.5: gap at P-1, then information missing, then met again. |
| CMP-17 | MP-1 → "User accounts" → "One login per role", then reset. | CR 1.1 RE(1) becomes a gap; CR 1.1 stays met. |
| CMP-18 | Filter "Met" → CR 1.7. | Source "statement"; note "model still open — information missing on …". The dialog explains the model alone does not show it yet. Setting "Password strength rules" to "Configurable policy" on the elements named makes the model meet it. |
| CMP-19 | Filter "Information missing" → open a row. | The row and the dialog name each element with only its missing field. Setting the field in the DFD moves the row out of the filter. |
| CMP-20 | CRA edition, filter "All": CR 1.14, CR 2.3, CR 7.5. | Shown as links; hover shows the reason. The dialog has "Why not applicable" and no statement section. |
| CMP-21 | Add tag "IEC 62443" to Pump Station → open row (for example CR 2.9) → "Add claim" → new claim with supporting measure and party. | New CLM number after the existing claims; row "claimed", source "claim". SL-C (product) unchanged; "With measures of the system" may rise. The other edition shows the same row claimed. |
| CMP-22 | Unlink the claim (✕), then open "Add claim" → "Claim". | The claim shows "unused" with a bin; "Delete this unused claim for good" removes it. Claims still in use have no bin. |
| CMP-23 | Project mitigation with CR 7.8, chosen on a risk and set to Implemented. | CR 7.8 met, source "mitigation", the note names M-C-nnn. In the planned run it is met already while open. |
| CMP-24 | Black box only, inside "Input validation" = strict, then none. | CR 3.5 met from the model, then a gap naming the multiprocess. |
| CMP-25 | Simple_Test_Project (tags IEC 62443 + EN 50742 A) → Compliance. | Sub-tabs "IEC 62443-4-2:2019" and "EN 50742 A" in this order. |
| CMP-26 | EN 50742 A sub-tab. | Title "prEN 50742:2025 Approach A (draft)". No SL table, no SL-T, no component picker. Chip "Scope: the whole machine", box "Requirements per status", column "Group" instead of "SL-C from", 23 rows with "All". Guide notes that the SRSL comes from the risk tab. |
| CMP-27 | EN 50742 A head table. | "Safety function" / "Highest SRSL (from the risks)" / "Interfaces on the path"; safety functions without a rated risk show "not rated". |
| CMP-28 | Choose a component for IEC 62443, then go to EN 50742 A. | EN 50742 A still evaluates the whole machine. |
| CMP-29 | Overview: set "Window of Opportunity"; Item Definition: fill boundary and environment. Then clear the window. | The row that needs them goes from information missing ("not set yet: window of opportunity, …") to met, and back. |
| CMP-30 | Data store with stored data "audit_logs" and integrity protection none, then HMAC. | The information collection rows (7.3) are met from the model; the integrity row is a gap with none and met with HMAC. |
| CMP-31 | Tag "EN 50742 B" only. | No compliance sub-tab for it. |

## Documentation / Report

| ID | Check | Expected |
|---|---|---|
| DOC-1 | Documentation tab → Markdown, HTML, AsciiDoc, PDF for Headlamp, SmokeDetector-leveled and Pump Station, in English and German. | All formats build without errors. |
| DOC-2 | Headlamp PDF table of contents. | Executive Summary, Applicable Regulations, Methodology, System Overview, Item Definition, Data Flow Diagram, DFD Element Descriptions, Asset Inventory, Asset-Element Relations, Threat Analysis (STRIDE per Element), Attack Trees, Threat Scenarios (Attack Path), Risk Assessment (Threat Scenarios), Cybersecurity Goals and Claims, Traceability Matrix (ISO/SAE 21434). |
| DOC-3 | Pump Station report. | Chapter "System Definition" (not "Item Definition") and "Requirement Matrix" with basis, security levels, Statement of Applicability with a source per row, the CRA view and "Gaps against the SL-T". The CRA view has the sentence that Annex II information is not part of this assessment. |
| DOC-4 | Pump Station with tag "IEC 62443" added → report. | One "Requirement Matrix" chapter with a heading per standard; the CRA view only in the CRA part. In the PDF table of contents both standards are indented under the chapter. |
| DOC-5 | "Gaps against the SL-T" in English and German. | Catalog mitigations as "ID: text" in the report language, separated by ";". Project mitigations with their text. |
| DOC-6 | Pump Station element tables (P-1, MP-1). | Update mechanism, session settings and other new fields with the form labels; hidden fields are left out. |
| DOC-7 | Simple_Test_Project report (EN 50742 A). | "Requirement Matrix" with the EN 50742 A part: basis (scope whole machine, window of opportunity), SRSL per safety function, Statement of Applicability with "Group", "Open requirements". No SL table, no CRA view. |
| DOC-8 | Report after a claim was added (CMP-21). | Section "Claims — measures of the system"; the SoA row names the claim. The ISO chapter "Cybersecurity Goals and Claims" does not list it. |
| DOC-9 | A risk with one implemented, one rejected-with-reason and one rejected-without-reason mitigation → report in all formats, English and German. | Active mitigation first, then "Rejected: M-… — text · Reason: …"; without text "none given" ("keine angegeben"). A ticket closed without fix shows "Ticket KEY closed as …". Residual risk unchanged. |
| DOC-10 | Report after THR-5. | Threat and risk tables show "M-C-002 — text", never a key like `M-C-002.mitigation`. |
| DOC-11 | SmokeDetector-leveled report, app and CLI. | Risk tables show value and level (for example "10.4 – High"), identical in app and CLI; the level matches the Risk tab tooltip. |
| DOC-12 | PDF tables (traceability matrix, asset relations, requirement matrix). | Readable, nothing cut off. |
| DOC-13 | `npm run build:cli`, then `node dist-cli/taraflow-report.js /tmp/Headlamp_ISO21434_Example.tara.json --format pdf --lang de --out /tmp/hl.pdf` and the same for Pump Station with `--format markdown`. | Exit 0; same chapters as from the app. |
| DOC-14 | Headlamp report, Markdown and PDF, also from the CLI. | The TARA verification status line is written out, no raw key. |

## Audit

| ID | Check | Expected |
|---|---|---|
| AUD-1 | Headlamp (no verification) → Overview. | "Not verified yet — record the verification in the Audit tab." Warning badge on the General tab and card, text in the tooltip. |
| AUD-2 | Audit tab → "Record verification". | All four scope items (a–d) are unticked; Save needs at least one tick. |
| AUD-3 | Record a passed verification. | Overview: "Verified on … by … — state unchanged." The entry shows "state unchanged". The badge from AUD-1 disappears. |
| AUD-4 | Uncommitted entry → "Edit", change the result, save; then "Remove". | Same entry changed; Remove deletes it. After a commit there is neither Edit nor Remove. |
| AUD-5 | Audit button in the phase bar with an uncommitted verification; also without an audit repository. | Chip with "1 TARA verification not committed — commit it in the Audit tab." or "No audit repository for this project file — set it up in the Audit tab." Gone after the commit. |
| AUD-6 | Change a mitigation status or sync a ticket status. | Verification stays verified. |
| AUD-7 | Set a mitigation to Rejected, or change a risk treatment. Then undo. | "Changed since the verification on … — verify again in the Audit tab." Undo → verified again. |
| AUD-8 | Close and reopen the file. | Verification status unchanged. |
| AUD-9 | Pump Station copy with a recorded verification: add a statement in Compliance. | Status changes to changed. Undo. |
| AUD-10 | Commit to a new branch, then to an existing other branch ("Existing Branch:"). | Branch created or switched, commit on it, `git status` clean. |
| AUD-11 | Target branch has another version of the file and the file has unsaved local changes → commit. | Git refuses the switch, the app shows the error. The file is not staged afterwards. |
| AUD-12 | Repository with a committed signer manifest (`.tara/allowed_signers`). | Commit dialog: "Sign commit — required, this repository has a signer manifest", ticked and locked, even if signing is off in the project. A missing key or an unauthorized author e-mail shows its error before the click; Commit is disabled. |
| AUD-13 | Delete `.tara/allowed_signers` locally (not committed). | The dialog still requires signing. |
| AUD-14 | Commit the deletion of the manifest. | Commit blocked: "The signer manifest was removed from this branch — …". No unsigned commit. |
| AUD-15 | A signed commit. | Trailer `Author:` is the entered author, never "Unknown". Label "Sign commit (SSH)" or "(GPG)" by format. |

## Integration / Trackers

| ID | Check | Expected |
|---|---|---|
| INT-1 | Integration tab. | One form. "Tracker": Jira Cloud; Jira Server / Data Center, Azure DevOps, GitHub Issues, GitLab Issues, OpenProject marked "preview"; Polarion not selectable. Labels for Jira: "Jira URL", "E-mail", "API token". |
| INT-2 | Jira URL with `http://`. | "Jira URL must be an https address." No token stored. |
| INT-3 | Azure DevOps with `https://dev.azure.com/` only. | "Organization URL must name the organization, e.g. https://dev.azure.com/contoso." |
| INT-4 | Real connection test. | "Connected as … — n projects." (GitHub: repositories). Wrong token: "Authentication failed — …". Wrong host: "Connection failed (…)". Choose a project. |
| INT-5 | Risk → status chip → status dialog of a mitigation without ticket. | Row "No ticket" with "Link…" and "Create…". Opening the dialog does not query the tracker. |
| INT-6 | "Create…". | Dialog "New ticket for M-…", title and description pre-filled. Cancel changes nothing. Creating gives a ticket with priority mapping and a link. |
| INT-7 | "Link…". | Dialog "Link a ticket to M-…": search "Key or text", status "Open" preset, "All types". Only open tickets. "Done" and "All" widen the list. A key search puts that ticket on top; an unknown key gives no error. |
| INT-8 | Same catalog mitigation on a second risk where the first has a ticket → "Link…". | "Suggested — linked to M-… on other risks" with that ticket. Already linked tickets show "linked with …"; "Hide tickets linked already" hides them. |
| INT-9 | Click a ticket, then the button; also double-click; also an empty filter. | One click only selects ("Link KEY"); the button links; double-click links at once. Empty filter: "No tickets in this filter." with "Create a new ticket". |
| INT-10 | Mitigation with an open linked ticket → status dropdown. | Only the ticket's status, and "Rejected", are selectable; text "progress comes from KEY — change it in the tracker; verified once it is done". |
| INT-11 | Move the ticket to In Progress, Done, reopen; "Sync ticket status" each time. | In progress → Implemented → back to open or in progress. After Done, "Verified" is selectable; choosing it shows "Follow KEY again", which returns to Implemented. |
| INT-12 | Close the ticket as Won't Fix → sync. Reopen → sync. | Status Rejected with "Ticket KEY closed as Won't Fix" under the reason; no required-field error. After reopen the reason disappears. |
| INT-13 | Set Rejected by hand without a ticket. | Reason is required: "Required for audit trail". |
| INT-14 | Tracker connected: mitigation without ticket set to Implemented with empty evidence. | "set by hand"; evidence field red with "Without a linked ticket this status needs evidence or a reference"; Save disabled. Evidence or reference → Save works. Open / in progress need nothing. |
| INT-15 | Copy of a file: remove `evidenceNote` from an implemented mitigation without ticket, open with a tracker connected; then disconnect. | Warning "1 risk has a mitigation done without ticket or evidence (…)", also in the phase badge. Disconnected: no warning. |
| INT-16 | Risk with two mitigations: implemented + verified; both verified; verified + rejected. | Risk status: Implemented; Verified; Verified. |
| INT-17 | Project file: change the tracker URL to another host, open, sync. | No sync and no request (no token for that host). |

## Personal data stays local

| ID | Check | Expected |
|---|---|---|
| PRV-1 | Connect a tracker, enter "Author Name" and "Author Email" in the Audit tab, save. | The `.tara.json` holds tracker URL, auth method, project, mapping and the audit policy — no e-mail, account ID, connection status or author. `grep -c '"author"\|"email"' <file>` → 0. No token (GEN-2). |
| PRV-2 | Restart the app, reopen the file. | Author and tracker connection are back (stored locally). |
| PRV-3 | Another project on the same tracker URL. | Shows the same account e-mail. |
| PRV-4 | Repository with `git config core.hooksPath .githooks`: stage a file with a fake token, commit. | Commit blocked; file and line are named, the value is not printed. |

## Language

| ID | Check | Expected |
|---|---|---|
| LNG-1 | Switch English ↔ German: Overview (Definition, Sources, views, verification line), Integration tab, status dialog, phase tooltips. | All texts translated, no raw keys like `itemDefinition.intro`. |
| LNG-2 | Compliance tab in both languages: guide, to-do list, info dialog, row notes, void reasons. | Fully translated. Property names in the to-do list use the DFD form labels of the UI language and name only the missing fields. |
| LNG-3 | Pump Station report in German, Requirement Matrix. | Reasons and "information missing on" texts in German, each element with its missing fields. With an EN 50742 A tag the missing project data is listed in German. |
| LNG-4 | Hazard findings and Risk toolbar findings in both languages. | Sentences in the UI language, singular and plural correct. The `risks.validation` stored in the file stays English. |
| LNG-5 | Tracker connection messages in German. | Success and failure messages in German; in English UI in English. |
| LNG-6 | Conversion dialog of an old example backup (for example `SmokeDetector.tara.v12.backup.json`, opened from a copy). | Dialog fits the window, buttons visible, reasons readable in both languages. |
