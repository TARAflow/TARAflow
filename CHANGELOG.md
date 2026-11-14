## [0.19.0-beta] - unreleased

**Component TARAs in a machine TARA:** the analysis of a reused component
(a sensor, a controller, a supplier's module) is imported into the TARA of
the machine that contains it, pinned to a commit of the component's
repository, instead of being analysed again. New project schema **14**:
projects are converted when opened (with a backup) and then no longer open
in 0.18.x.

### Added
- **Import a component TARA** (DFD tab, *Import component TARA…*): the
  component's committed file is read at its commit (or tag), checked and
  inserted as a multiprocess with the component's DFD on read-only pages
  and its boundaries around it on the parent page. The component's external
  entities are mapped to elements of the machine; several instances of one
  component get their own prefix (e.g. *SD1*, *SD2*), identical units a
  quantity. The import keeps the component's threats, attack trees,
  intrinsic factors, measures, assets, asset relations, assumptions of use,
  supporting claims and its overview (description, responsible, tags,
  item definition texts, source references) — never its impact, context
  factors, risk levels or hazards: those depend on the machine.
- **What the machine decides per instance:** the impact of the instance's
  assets, the context factors, the window of opportunity of the
  component's attack paths (also per step of an AND combination), the
  relevance of threats on the flows across the component's boundary (with
  a rationale), the assumptions of use as a checklist (fulfilled, not
  fulfilled, not applicable — with this TARA's evidence), a component
  measure *not effective here*, and the component's supporting claims cited
  in the requirement matrix. Ratings can be copied from another instance of
  the same component once.
- **Component measures count only while they hold:** a measure of the
  component reduces the machine's risk only while the component
  implemented it and every assumption it relies on is fulfilled in the
  instance with implemented evidence; otherwise it is *unclear* or *not
  effective* and the risk is shown with its value before treatment. The
  same rule decides whether a component measure is evidence in the
  requirement matrix.
- **Drift and update:** TARAflow checks whether a newer state of an
  imported component exists (*Check*, *Fetch and check*; a state on a
  separate branch is named as such, never offered as newer). *Update…*
  shows what changed, which of the machine's decisions are affected, new
  external entities to map and threats or paths to pair with their
  predecessors; a trivial update says that no decision is affected.
  Decisions that no longer fit are listed for review; *Discard update*
  restores the state before it until the project is saved. *Refresh stored
  state* rewrites a component this TARAflow version reads differently.
- **Overview tab *Components*** (only while something is imported): per
  component its overview, where it comes from (repository, file, branch /
  tag, commit), the methodology match, its instances with their
  assumptions of use, *Show in DFD*, the drift status with *Check* and
  *Update…*, and the **deviations** — what this TARA decided differently
  from the component (goals added to its assets, measures not effective,
  assumptions not fulfilled, relevances overridden, factors rated anew) and
  the claims it relies on — copied as Markdown for the component's team.
- **Report:** the imported threats per component with the instances where
  they differ, the provenance of each imported risk, the imported attack
  trees with every attack-potential factor per step, a chapter *Imported
  components* (overview, origin, instances, measures not effective or
  unclear with the reason, assumptions with their evidence, deviations),
  in every format including the PDF.
- **Audit Verification Engine v2:** new check *component-import* — the
  snapshot of every imported component in a committed project file must
  still match its recorded hash (`CMP_SNAPSHOT_HASH_MISMATCH`, error).
  Results now carry `aveVersion: 2`; all other checks are unchanged, and
  projects without imported components verify as before. The commit diff
  names instance changes (assumption status, external-entity mapping,
  quantity, overrides) instead of *instance modified*.
- **Issue trackers:** a ticket row per mitigation with a link dialog
  (search, status filter, suggestions) and *create*; with a linked ticket
  the progress follows the ticket.

### Changed
- **Asset group fields** (data type, lifecycle, exposure, role, …) are
  asked for as an *info*, no longer as a warning, and the message says what
  the field does: recorded with the asset, or context for rating the attack
  feasibility that TARAflow does not evaluate yet, or which model field is
  evaluated instead — no longer "required for … threat selection". A DFD
  can therefore reach *complete* without them. Functions marked as safety
  function are not prioritised automatically; the documentation said so and
  is corrected.
- **Audit commit message:** the subject names the TARA file after the round
  (`[TARA] Detail Review — machines/panel.tara.json`) and a trailer
  `Project-File` carries its path — with several TARA files in one
  repository each commit says which one it is for. The message schema and
  the commit hook accept it as before.
- **Status by hand with a tracker:** in a project with a tracker, a
  mitigation set to done by hand needs evidence or a reference.
- **Phase indicators:** the findings of imported components count on the
  DFD phase; a source reference with credentials in its URL is a warning on
  General.
- **Compliance tab and report:** the to-do list names the properties under
  the DFD form's labels and only the fields an element leaves unset; the
  reasons of a row's status (also an edition's void reason) and the
  missing fields in the report are in the document language.
- **Per-element threats:** flows between two external entities are out of
  scope on single-page DFDs too; a regeneration lists existing threats on
  such flows as obsolete (info `DFD_EE_TO_EE_FLOW`).
- **Safety card** of an asset hidden while it is empty and cannot be set;
  always shown for people, physical and infrastructure assets.

### Removed
- **Asset fields *Protection need* and *Criticality*:** ratings entered as
  fields that no calculation used — threats, risks, compliance and the
  report take the impact from the security goals and the damage scenarios —
  and that could contradict them. Their warnings ("required for threat
  prioritisation") were wrong and are gone too. Unused model fields without
  an input (business impact, aggregated criticality, analysis depth, the
  physical hazard potential on the asset, the old asset-tab text fields)
  are removed with them.

### Fixed
- **Risk status:** a risk is *verified* only when every active mitigation
  is; one mitigation that is only implemented keeps it at *implemented*.
- **CLI report** builds its data with the app's transform: labels (MoSCoW,
  impact, STRIDE, status) and the active STRIDE methods were missing.
- **Repository URLs** are stored without credentials; a stored URL with
  credentials is flagged in the Overview's sources.
- **Multi-page DFDs after a project switch:** coming back to a project
  with a leveled DFD, the DFD tab lost its page tree on loading and offered
  *Adopt pages* for every page; saving was refused until another tab was
  opened. Adopting there re-linked the pages from scratch and dropped
  identity links (e.g. the boundaries around an imported component lost
  their properties). The page tree now stays when the DFD is loaded.
- **Autosave:** a change made while the project was being written (e.g. the
  DFD tab saving right after another edit) was replaced in memory by the
  older copy; the file was right, the app was not. A write now only marks
  the project saved, and only when nothing changed meanwhile — otherwise
  the next autosave writes it.
- **Open project** starts the file dialog in the folder of the open
  project, without one in the home directory.

### Upgrade notes
- Projects are converted to schema 14 when opened (backup alongside); a
  project without imported components changes in nothing else, and a TARA
  verification stays valid.
- A component TARA must be committed to be imported pinned; an uncommitted
  file is imported *unpinned*. Once the file is committed, *Check* names the
  commit and offers *Refresh stored state…*, which binds the import to it —
  also when the content did not change. The drift check needs a local clone
  of the component's repository.
- **Risk status *verified*:** a risk is verified only when every active
  mitigation is. In existing projects risks can fall back from *verified*
  to *implemented* when opened — check the overview before an audit.
- **Trackers:** in a project with a tracker, setting a mitigation to done
  by hand now asks for evidence or a reference; mitigations done without
  either are reported as a finding.
- **Per-element threats on EE → EE flows** (out of scope on single-page
  DFDs too): a regeneration removes them; the next risk sync then removes
  their risks, including ratings and mitigations. Before regenerating,
  check whether such flows carry risks — if a flow is security-relevant,
  model one side as a process.
- **Credentials in source URLs:** a source reference stored with a token
  in its URL is flagged. Removing it from the project is not enough — the
  token stays in the git history of every repository the file was
  committed to: revoke it at the provider.
- **Leveled DFDs where *Adopt pages* was confirmed after a project switch**
  (0.14 – 0.18): the adoption may have dropped identity links between pages —
  check the context copies and the page tree of such DFDs.
- **Protection need, criticality and the other removed asset fields:**
  existing values are dropped when a project is opened and are gone from
  the file after the next save; the first commit diff lists them once. A
  verification of the TARA stays valid.
- **CI with `taraflow-verify`:** the JSON result carries `aveVersion: 2`
  — a pipeline that checks the version or compares results with a stored
  one sees the new number.
- The component's source references are shown read-only in the machine;
  the machine does not resolve or check them itself.
- Not in 0.19 (planned for 0.20): the compliance modules EN 303 645,
  EN 18031, EN 50742 Approach B and ISO/SAE 21434; model coverage stage 2;
  measure ownership (one status per measure).

## [0.18.0-beta] - 2026-11-06

More of the requirement matrices from the model, EN 50742 Approach A as a
matrix of its own, Azure DevOps and further issue trackers, AND gates as
one attack scenario. New project schema **13**: projects are converted
when opened (with a backup) and then no longer open in 0.17.x.

### Added
- **Model fields for the requirement matrices** (process, multiprocess,
  data flow — each shown only where the settings before it make it
  meaningful): user accounts (per person / per role / shared), password
  rules and lifetime, role-to-permission mapping, default credentials and
  whether authenticators can be changed, login lockout on the element
  that verifies a login, update delivery and update defaults, secure by
  default and security-configuration reporting, deletion of user data,
  access mode and data minimisation on data flows. More IEC 62443-4-2
  rows are derived from the model instead of needing a statement (CR 1.1
  RE(1), CR 1.5, CR 1.7, CR 1.11, CR 2.1 RE(2), CR 3.10, CR 7.6, CR 7.9).
- **Security section in sub-tabs** on processes and multiprocesses (Login
  & accounts, Authorization, Communication, Robustness, Sessions &
  traceability, Operation, Data) — the categories the standards share
  (EN 303 645, EN 18031, IEC 62443-4-2); a tab names its open fields.
  *Communication* holds the multiprocess's boundary authentication and
  the **secure channels** an element terminates — a multi-select instead
  of TLS only: TLS (server), mutual TLS, VPN / IPsec, SSH, application
  level (e.g. OPC UA Secure Channel), other; only where the element has a
  flow over a network or bus. A data flow's *encryption in transit* also
  offers SSH and application level. The DFD checks each flow against its
  endpoints — TLS / mTLS as before, SSH needs one endpoint offering it,
  application level both — and warns about a channel an element offers
  that none of its flows uses (an open service without a visible
  purpose, EN 303 645 5.6 / CR 7.7), and asks for the secure channel
  where an element has a flow over a network or fieldbus but none is
  chosen (unset is unknown — "none" is a choice; on-board chip buses are
  not asked). *Exposed to Internet* is context, not a control: on the
  process it moved from *Operation* up to the context, as on the
  multiprocess. Two new fields: *update package encrypted* (no / per
  device type / per device, under *Operation* once the element is
  updated) and *key / certificate renewal* (not possible · in an
  encrypted update package · over a secure channel · on site ·
  unencrypted, under *Communication* where the element holds keys); the
  DFD warns about keys renewed in plain, over a channel the element does
  not offer, or in an update that is not encrypted. A multiprocess's safety fields
  (safety-relevant, rationale) sit below the tabs, always in view.
- **Black-box multiprocess:** a multiprocess without a child page — a PLC
  drawn as a box, a supplier's module — gets seven fields for the
  processes and data it contains, in the tab of their topic
  (robustness, operation, and a tab *Data* for the stored data); the
  matrix checks it with the process and data-store rules once one is
  set.
- **EN 50742 Approach A** as a standard of its own in the Compliance tab
  (sub-tab next to the IEC 62443 editions, shown by the EN 50742 A tag):
  23 baseline requirements checked against the model, the risks (SRSL,
  mandated §7.4.3 controls) and the project data (hazards, safety
  functions, window of opportunity, system definition); the header shows
  the highest SRSL per safety function and the interfaces on the path to
  it, derived from the DFD (a one-way boundary ends the path); its own
  part in the report.
- **Report:** the requirement matrix chapter has one part per active
  standard (both IEC 62443 editions, EN 50742 A); rejected mitigations
  are listed with their reason (the analyst's text or the ticket closed
  without a fix) instead of being left out.
- **Claims for measures of the system:** a requirement the system around
  the component meets is covered by a cybersecurity claim of the kind
  *supporting* (row info dialog: new, link, remove); it counts for the
  value with measures of the system, never for the SL-C of the product;
  own report section.
- **Project mitigations** name the IEC 62443-4-2 requirements they
  implement (searchable field while a 62443 edition is active).
- **Issue trackers:** **Azure DevOps** (Azure Boards work items, PAT bound
  to the organization), and in *preview* — selectable, real runs follow —
  **Jira Server / Data Center**, **GitHub Issues**, **GitLab Issues** and
  **OpenProject**. Polarion follows later.
- **Asset tab filter:** by asset type and by criticality "from level",
  across all group accordions, combinable with *Needs review only*; kept
  per project for the session, never in the file.
- **Asset graph rows:** every category lane, the DFD-element lane and the
  two free rows hold three rows to align assets on (dragging or Ctrl / ⌘ +
  Shift + ↑ / ↓ snaps onto them, a lane's asset stays in its lane);
  *Rearrange* spreads a crowded lane over its rows by the asset's links —
  links to the layer above put it on the top row, to the layer below on
  the bottom row — at most a third per row. Positions remembered by an
  earlier version are placed anew once (view only, not in the file). The
  lane labels are left-aligned, drawn on top of nodes and stay at the
  left edge when the graph is scrolled to the right — side-column labels
  (persons, hazards, …) too, once their column is out of view.
- **Asset graph relation filter:** a menu *Relations* next to the presets
  with one checkbox per kind of relation — DFD element, asset, hazard —
  all ticked. Unticking a kind hides the assets and hazards that have
  such a relation (a hazard's link to an asset counts as an asset
  relation); nothing ticked leaves the assets and hazards without any
  relation — the work list of what is still to be linked. Layer view
  only, combinable with the presets.
- **Asset graph shows only relevant hazards** — those marked *in scope*
  in the Hazard tab; out-of-scope and unreviewed hazards and their edges
  are left out, also from the counts.
- **New asset from the description view:** the *Assets* accordion is
  always shown, with "+" for a new asset by name and category — linked
  to elements later; the new asset opens to be described.
- **Hazard tab findings panel** below the table, like the Asset tab: the
  validation's errors and warnings in the UI language, a click opens the
  hazard.
- **Goals & Claims:** a goal or claim linked to a risk that no longer
  exists — its attack-tree node was renamed — offers *Re-link to …* (the
  paths of the same tree and STRIDE category) and *Remove link*.

### Changed
- **AND gates in attack trees:** an AND gate is one attack path per
  combination of its steps (minimal cut set; an OR below the gate gives
  one path per branch), with the feasibility of the gate over exactly
  that combination. Before, every leaf was a path of its own — one
  scenario became several threats and risks.
- **Multi-select:** malware protection (process, multiprocess) and
  physical path protection (data flows) hold several measures.
- **Threat catalog:** the matcher reads the conditions on physical path
  protection and encryption in transit, and a condition naming a missing
  or weak control (e.g. access mode read / write, no backup, no fail-safe
  state) also matches an unset property — an unfinished model no longer
  looks safer than a complete one. Templates matched by facts rank before
  those matched by an assumption.
- **Risk levels:** labels and colours of risk values follow the project's
  own severity thresholds everywhere (risk dialog, score panel, risk
  table, matrix tooltips), and the matrix cells use the same rule as the
  chips (before, I=2 / L=2 read *Low* in the matrix and *Medium* on the
  chip); impact and likelihood chips are coloured on their own scale.
- **Translated messages:** the Risk tab's validation (toolbar chip, phase
  bar, Overview), the hazard findings and the issue trackers' connection
  test in the UI language.
- **CR 7.1:** only exposed protocol interfaces are checked for abuse
  protection (a touch panel can never meet it).
- **Asset tab — filter bar (AF-2):** the asset types are a dropdown with
  checkboxes (icon and count per type) instead of a row of chips — all
  ticked by default, unticking hides a type, as the relation filter of
  the asset graph; the last ticked type stays. Criticality is a select
  like "Risk level" in the risk tab (filter icon, colour per level,
  highest first; the highest level reads its name alone, e.g.
  "Critical", not "Critical or higher"); the bar is as high as the risk
  tab's, the two filter dropdowns come first, then the buttons.

### Fixed
- **Compliance tab — delete unused claims:** a supporting claim removed
  from all its requirements stayed in the project with no way to delete
  it; in the dialog "Add claim" an unused claim (no requirement, no
  risk) is marked *unused* in the claim dropdown, with a delete button
  next to it. A claim still in use cannot be deleted there. The list
  and the dialog scroll when they grow long.
- **Report — gaps against the SL-T:** the column "Catalog mitigations"
  listed only ids; it now gives each mitigation with its text in the
  document language ("M-S-009: Authenticate the sensor per device …"),
  a project mitigation with its own text.
- **Compliance tab — void rows:** rows the edition declares void or
  without a component requirement (e.g. CR 1.14, CR 2.3, CR 7.5) were
  plain text; they now link to the info dialog, which gives the reason
  ("Why not applicable") in EN / DE — no statement section there.
- **Compliance tab — "Information missing":** the status and filter
  "Unknown" read "Information missing" (DE "Angaben fehlen"), also in the
  compliance report; the row note and the info dialog name the empty
  fields per element, e.g. "information missing on MP-1 Controller
  (Password lifetime limit)" — only the fields the row reads that are
  unset, under their DFD form label.
- **Compliance tab — met by a statement:** a row met by a statement,
  mitigation, supporting measure or claim while the model alone still
  has gaps or missing properties (e.g. CR 1.7) said only "properties
  missing on …"; the note now says *model still open*, and the info
  dialog explains that the row is met by that source and the model will
  show it once the elements' properties meet it.
- **Security sub-tabs:** coming back to an element, the chosen tab (e.g.
  *Operation*) was shown cut off or at another place of the scrolling
  tab bar; the bar no longer scrolls — in a narrow panel the tabs wrap
  onto a second line, the chosen one marked by a fixed underline.
- **Audit commit:** the branch is checked out before the project file is
  staged — a failed switch left the file staged on the old branch.
- **Project switch:** the DFD, threat, compliance, concept, documentation
  and integration updates are pinned to their project like the fixes of
  0.17.2 — a DFD save flushed on switching wrote into the next project.
- Included from 0.17.1 / 0.17.2: Hazard tab from the regulation tag,
  out-of-scope hazards, stale exposure level, cross-project overwrites.

### Upgrade notes
- Projects are converted to schema 13 when opened (backup alongside):
  the matrix data is stored per standard family; malware and physical
  path protection and the TLS termination (now *secure channel*) become
  a selection of one (1:1). Both steps keep the
  analysis — a TARA verification stays valid.
- **Attack trees with an AND gate:** the conversion recomputes their
  paths. Assessments of the former leaf paths are merged onto the
  combined path; where they disagree or a step had none (not assessed is
  never *not relevant*), the combined path is *relevant* and the old
  assessments stay for review. Risks are renamed or merged; each one
  notes where it came from (*Carried over from …* / *Merged from …*),
  with *review the rating and the treatment* where the decisions differ
  or not every step had a risk — nothing is lost, but review these
  risks. The conversion reports this per file; a verification of such a
  file asks to be confirmed again.
- **Regenerated threats** (catalog matcher): a threat may now name the
  variant for the missing control where the property is unset (e.g. the
  read / write tampering threat on a flow without access mode). No threat
  is added or removed in the examples; a few templates switch.
- The trackers marked *preview* were built and tested against recorded
  answers; report problems with a real instance.
- Not in 0.18: Polarion, the time source (EN 50742 / IEC 62443 stage 2),
  the split of the workspace layout and the risk dialog (0.19).

## [0.17.2-beta] - 2026-11-04

Bug fixes: data of one project could end up in another when switching or
closing projects. No new project schema (still 12).

### Fixed
- **Risks written into the wrong project:** with the Risk tab open in two
  projects, closing one could copy all of its risks into the other. The
  tab kept the risks of the project shown before and its auto-save wrote
  them into the project that was active when the save ran. The Risk tab is
  now rebuilt for every project, saves only into the project it shows, and
  an edit made just before the switch is saved to that project.
- **Hazards, audit settings, Overview:** the same kind of mix-up —
  - Hazard tab: a project without hazards showed the hazards of the
    project before and saved them with the next edit;
  - Audit tab: a project without audit data took over author and signing
    settings of the project before; a commit finishing after a switch
    landed in the other project;
  - Overview: an open *Project info* edit survived the switch and saving
    it renamed the other project; a source binding resolve or drift check
    finishing after a switch wrote name, settings and Item Definition of
    the project it started in into the active one, and could roll back
    edits made meanwhile.
  Each tab is now rebuilt per project and saves into its own project only.
- **Attack trees:** a change made within the last second before a project
  switch was lost; it is now saved, into its own project. (DSL typed in the
  last half second is not yet parsed and still not taken over.)

### Notes
- No schema change: projects of 0.17.1-beta open unchanged, and 0.17.1-beta
  still opens files saved by 0.17.2-beta.
- A project that already received data of another project is not repaired
  automatically — check projects that were open together with another one
  (risks, hazards, Overview data) and remove what does not belong.

## [0.17.1-beta] - 2026-11-03

Bug fixes for EN 50742 machinery projects, no new project schema (still 12).

### Fixed
- **Hazard tab missing for an EN 50742 project:** a regulation tag that
  mandates hazard analysis (EN 50742, IEC 81001, IEC TR 60601, IEC 63452,
  CLC/TS 50701) switched the safety analysis on only while the Overview was
  edited. A project whose tags were set elsewhere (another tool, an edited
  file) had the tag but no *Safety Analysis* flag and showed no Hazard tab.
  The flag is now set from the tags when a project is opened and on every
  Overview / risk update; it is only ever switched on.
- **Hazard validation of out-of-scope hazards:** every hazard needed a
  contributing asset (`contributes_to`), also one the analyst ruled out of
  scope (system relevance *out of scope* — e.g. a protective measure that is
  purely mechanical or organisational). An imported risk assessment with
  such hazards never validated without errors. Out-of-scope hazards are now
  exempt; unreviewed (*unknown* or unset) and in-scope hazards keep the
  error, and every hazard still needs a protection target it endangers.
- **Stale exposure level on a data flow:** a flow that once crossed a trust
  boundary kept its derived exposure level after both ends came into one
  zone (boundary enlarged, elements moved) or the boundaries were removed;
  the old value fed the risk tab and the EN 50742 attack potential. A
  derived value is now cleared, a manual one stays.

### Changed
- **Compliance tab:** with both tags `IEC 62443` and `EN IEC 62443 (CRA)`
  the classic and the CRA edition are shown side by side as sub-tabs (the
  last one chosen is remembered per user); with one tag the tab looks as
  before. The report still shows the CRA edition.

### Notes
- No schema change: projects of 0.17.0-beta open unchanged, and 0.17.0-beta
  still opens files saved by 0.17.1-beta.
- Project files saved by a development build of 0.18 (schema 13) do not open
  in 0.17.x.

## [0.17.0-beta] - 2026-11-02

IEC 62443-4-2 requirement matrices — the classic edition (2019) and the
CRA edition EN IEC 62443-4-2/prAA (draft) — derived from the TARA model:
a new Compliance tab, a report chapter and the model properties they need.
New project schema **12**: projects are converted when opened (with a
backup) and then no longer open in 0.16.x.

### Added
- **Requirement matrices IEC 62443-4-2:** the regulation tag selects the
  matrix — `IEC 62443` the classic edition (with the device categories
  SAR / EDR / HDR / NDR), the new tag `EN IEC 62443 (CRA)` the CRA edition
  (draft prAA:2026, marked as such); with both tags the CRA edition
  applies. The tag validator suggests the generic `CRA` tag next to the
  new one. Every row is derived from the model where it can be:
  - from the DFD properties of the elements in scope — an unset property
    counts as *unknown*, never as *not applicable*;
  - from the mitigations of the risk treatment: a mitigation counts for the
    elements its risks concern, in the achieved state only when marked
    done and never against a property the model shows not met; the
    planned state applies the values the chosen mitigations expect;
  - from supporting measures of the system around the component and the
    analyst's statements for what the model cannot show.
- **Compliance tab** (on the right of the tab bar, only when a tag selects
  a matrix): component under evaluation (an element or the whole model);
  device categories of the 2019 edition proposed from the model and
  confirmed by the analyst; the security levels per foundational
  requirement — SL-T (target), SL-C of the product, SL-C planned and the
  value with measures of the system (the basis for the SL-A); the rows
  with status, source and notes, filtered by status (all, open, gap,
  statement needed, unknown, not applicable, met — each with its count;
  open first); statements (met / not met / not applicable, reasoning,
  supporting measure, evidence) that keep the model result of their
  moment and say when the model changed since — one statement per
  requirement, valid in both editions;
  a tooltip and an info dialog per requirement with its title and a
  summary in our own words (EN / DE — never the normative text), how
  TARAflow checks it, the elements concerned and catalog mitigations
  that fit the open elements; a **to-do list up to the SL-T** per element
  (which property to set or check, what the planned mitigations close,
  which statements are missing) — the element's name leads to it in the
  diagram (DFD tab, element selected, details panel open) — and a
  five-step quick guide, open the first time and collapsed afterwards.
- **Report chapter *IEC 62443-4-2 requirement matrix*** (all formats incl.
  PDF and the CLI): basis, security levels per FR, statement of
  applicability with the source of every row, the CRA view by Annex I
  letter, gaps with suggested catalog mitigations.
- **Mitigation catalog:** 73 mitigations name the IEC 62443-4-2
  requirements they implement; a mitigation also meets the requirements
  its DFD effects satisfy, for elements of that type.
- **DFD:** update mechanism and session control (session lock, remote
  termination, session limit — three-valued: not specified / yes / no) on
  processes and multiprocesses; session control had no field before. The
  trust boundary's traffic policy is a multi-select (default deny, island
  mode, fail close together; *allow all* excludes the others).
- **TARA verification:** the hash covers the matrix data (component,
  target, statements) when a project has them — projects without keep
  their hash.
- **Tags that change the workflow are marked:** the tags that switch the
  method of the project (ISO 21434, EN 50742 A / B, ETSI TVRA) dark with a
  cog, the tags that enable a requirement matrix outlined with a shield —
  in the tag editor with a legend, never by colour alone.
- **System definition:** outside ISO/SAE 21434 the item definition reads
  as the system definition (for the CRA: intended purpose and product
  description) — Overview, trust boundary assumptions, report chapter.
- **Physical boundary:** free text *Further physical controls* (shown in
  the report, not evaluated).
- **DFD shape libraries:** a third data flow *Dataflow (straight)*; id
  labels widen to the id the numbering writes.
- **Asset graph:** a second free row above the top lane for side-column
  nodes (e.g. persons).
- **Example Pump Station Controller** (IEC 62443 / CRA, in
  TARAflow_Examples): a complete TARA of a water pump station controller
  with the matrix in both editions.

### Changed
- **Closed loop for multi-select properties:** a control is met when the
  selection contains its value, *Apply* adds the value to the selection;
  island mode no longer counts as default deny (separate capabilities).
- **Report property tables:** update mechanism on processes and one row per
  session setting instead of *N/A*.
- **Multiprocess form:** the update mechanism sits under Security next to
  the session fields (as on the process); *safety-relevant* closes the
  section.
- **Threat catalog:** the embedded spoofing template S-002 applies with
  both IEC 62443 tags (before only with `IEC 62443`).

### Fixed
- DFD_2 shape library: the interface shape's id label works (a broken
  attribute hid it).
- CRA view: CR 7.6 maps to Annex I (2)(b) and (k) only — it also showed
  (l), a subclause number of Annex ZZ read as a CR number.
- The requirement info dialog takes at most 80 % of the window; a long
  description scrolls, title and buttons stay in view.

### Upgrade notes
- Projects are converted to schema 12 when opened (backup alongside):
  a trust boundary's traffic policy becomes a selection of one, and the
  old free text *boundary controls* (no form field for a long time) is
  appended to *custom boundary controls* — nothing is lost. A TARA
  verification recorded with 0.16 stays valid (the conversion is declared
  analysis-preserving).
- The CRA edition follows the draft EN IEC 62443-4-2/prAA:2026; the matrix
  will follow the cited edition. The standards' texts are not part of
  TARAflow — the summaries are our own words, the standard is
  authoritative.
- **Azure DevOps** and the further tracker adapters did not make 0.17 —
  they follow in 0.18. A project that depends on Azure DevOps should stay
  on 0.15.2.

### Security
- Dependencies: `follow-redirects` and `joi` (dev tooling via `wait-on`)
  updated after `npm audit`.

## [0.16.1-beta] - 2026-11-02

Bug fix, no new project schema (still 11).

### Fixed
- **Project conversion dialog:** with a long list of conversion steps (e.g.
  a project from an early schema) the dialog grew past the window and its
  buttons could not be reached. The dialog is now limited to the window
  height, the text scrolls and *Convert* / *Cancel* stay visible below it.
- **Confirmation dialogs** (shared dialog): a long message scrolls the same
  way, title and buttons stay visible.

### Notes
- No schema change: projects of 0.16.0-beta open unchanged, and 0.16.0-beta
  still opens files saved by 0.16.1-beta.

## [0.16.0-beta] - 2026-10-31

ISO/SAE 21434 work products of the concept phase — Item Definition,
cybersecurity goals and claims, TARA verification — a project mitigation
catalog, a reworked closed loop and a new issue-tracker integration.
New project schema **11**: projects are converted when opened (with a
backup) and then no longer open in 0.15.x.

### Added
- **Item Definition (ISO/SAE 21434 Clause 9, WP-09-01):** the Overview gets
  sub-tabs Project / Definition / Methodology / Sources.
  - Definition: purpose and functions, item boundary, preliminary
    architecture, operational environment, constraints and legal
    requirements — each with text, a source (document, section, version)
    and links to DFD elements, flows, pages and assets; functions with their
    lifecycle phases and an optional function asset.
  - Assumptions ASM-nn with source, owner, review date and status (open /
    confirmed / invalid); a trust boundary links the assumptions it relies
    on, and free text there can be converted into one.
  - Findings: under ISO/SAE 21434 item boundary, preliminary architecture
    and operational environment are mandatory; in every preset a missing
    purpose, an invalid assumption still in use, an overdue review date and
    links to removed model items are reported. Badges on the sub-tabs.
  - Methodology view: the methodology record of the project, read-only.
  - Report chapter *Item Definition* right after the system overview.
- **Cybersecurity goals and claims (9.4, WP-09-03/04), ISO/SAE 21434
  projects:**
  - Risk dialog, new tab *Goal / Claim*: a risk to reduce gets goals
    CSG-nn (proposed from the formal description of the asset × property
    it violates, optional CAL; one-click reuse of a goal of the same
    scenario with a text preview); retain gets claims CLM-nn relying on
    assumptions, share claims with the responsible party.
  - Risk-tab dialog *Goals & Claims*: all goals and claims grouped by
    scenario, goal proposals for every risk to reduce without one, merge,
    remove unused; findings as a badge and as a marker in the risk table.
  - Findings: reduce without goal, without a selected control or without a
    residual rating; retain / share without claim; avoid without
    justification; claims without assumption or party; review date passed;
    links to removed risks.
  - CSG, CLM and ASM numbers are never reused after a delete.
  - Report chapter *Cybersecurity Goals and Claims* and a goal / claim
    column in the traceability matrix.
- **TARA verification (RQ-09-07, WP-09-05), ISO/SAE 21434 projects:** the
  Audit tab records a verification — date, reviewer, the four points of
  RQ-09-07 as a checklist with the open findings per point, result,
  findings — together with a hash of the analysis content. The status
  (verified / changed / confirm again / outdated after 90 days,
  configurable / failed) shows in the Overview, the phase bar and at the
  top of the report (marked, never blocked). An entry is committed with
  the round *Verification* and a `Reviewed-by` trailer; until then it can
  be edited or removed. Implementation progress (mitigation status,
  tickets) does not change the hash; schema migrations only keep an entry
  verified when they are declared analysis-preserving, otherwise it asks
  to be confirmed again.
- **Project mitigation catalog M-C-nnn:** the analyst's own mitigations
  are catalog entries of the project — text, description, STRIDE category,
  optional attack vectors and the DFD effects the closed loop checks.
  Usable on every threat and risk, kept on regeneration, listed with their
  usage in the threat configuration (edit, merge, delete only when unused);
  merging keeps status and tickets and refuses contradicting data. Numbers
  are never reused. Free text that equals a catalog text offers a link.
- **Issue-tracker integration rebuilt:** one Integration tab with one form
  per tracker description (Jira Cloud in 0.16; Azure DevOps, GitHub,
  GitLab, Polarion, OpenProject and Jira Server listed for 0.17). The token
  stays in the main process, bound to tool, host and account; the
  renderer never sees it and a host from a crafted project file finds
  none (https only, no redirects). Ticket states sync in one batch when
  the Risk tab opens and on *Sync ticket status*; the mitigation status
  mirrors its ticket in both directions, a ticket closed as won't fix /
  declined / duplicate sets *rejected* with the ticket as reason, and a
  sync without change leaves the project file untouched.
- **Hazards:** a person edge can be rated *none* (no injury, S0) — it
  makes nobody safety-relevant; the hazard import accepts "none". Under
  ISO/SAE 21434 person severities read with their ISO 26262 class
  (*S2 · Irreversible, major*).
- **Attack trees:** *AT-n* before every tree title and an ID column
  *AT-n.m* in the path tables, the ids threats, risks and the report use.
- **Overview and phase bar:** a phase card tells what is behind its status
  (missing fields, the hazard, DFD and risk findings, generation drift,
  the verification status) and opens its tab; the phase tabs show the same
  in their tooltip. Badges on General, Hazard, DFD, Threats and Risk; the
  Audit entry shows a chip when the project has no audit repository or
  uncommitted verification entries.
- **Closed loop for attack-path risks:** controls of an ISO project reach
  the DFD through the attack tree's anchor asset (its elements and flows);
  the risk dialog's "already implemented" badge checks them too.

### Changed
- **Closed loop (DFD notification panel):** one answer to "does the DFD
  value meet the control?" for derivation, drift, coverage and the panel
  (empty values incl. `not_*`, stronger values meet weaker ones, e.g. mTLS
  meets TLS). A control of a mitigation still open or in progress is
  information (*n planned*), not a warning; a warning or conflict only
  when the mitigation is marked done and the DFD disagrees. One row per
  expected value. *Apply* writes into the element's properties and is
  offered only for a mitigation that counts as done — also on a drift row,
  to restore a reverted value. Mitigations reach only interfaces their
  controls fit (no debug-interface controls on WLAN or RS-485).
  15 catalog effects corrected; the automotive controls (SecOC, Bluetooth
  hardening, CAN IDS) got DFD effects.
- **Threats:** no new free-text mitigations — a project mitigation needs
  only its text. Existing free text stays editable and can be converted.
  Manual threats keep catalog ids, so they reach the closed loop.
- **Goals, claims and the TARA verification are ISO/SAE 21434 only:**
  another preset shows no Goals & Claims button, no Goal / Claim tab, no
  report chapter and no verification panel; stored data stays in the file.
- **Personal values stay on this machine:** the commit author and the
  tracker account (e-mail, account id) and connection state are stored
  locally, no longer in the `.tara.json`. The file keeps what the team
  shares: audit provider, remote, branch, rounds, auth method, signing
  on/off and format; tracker, URL, auth method, project, issue types and
  mapping. Values in an older file are taken over once when it is opened
  and leave the file with the next save.
- **Signed audit repositories stay signed:** once a repository's history
  introduced a signer manifest, every commit in it is signed — for every
  project, whatever the project's signing switch (locked and explained in
  the configuration). The decision follows the manifest committed on the
  branch the commit goes to, as the verification engine does; a missing
  key, an author not in the committed manifest or a removed manifest are
  shown in the commit dialog before the click.
- **Risk dialog (ISO/SAE 21434):** the panels read Feasibility | Impact |
  Risk and name their source (attack-tree path and attack potential, the
  five residual factors, the damage scenario); the impact after mitigation
  is the damage scenario's, read-only. The residual factors list their
  levels least likely first with the likelihood colour dot, like every
  other likelihood factor. The side list follows the display id
  (AT-1.1 … AT-10.2).
- **Risk tab:** counts include attack-path risks (an ISO project showed
  "0/0 Risks"); "Showing n of m" counts every risk the tab shows; the
  STRIDE method buttons count risks, not threats; the progress chip
  explains what counts as done (*share* included). The tab's validation
  is shown — toolbar chip, Overview, phase bar — with new warnings for a
  risk to reduce without mitigation or (classic projects) without a
  residual rating; the former "high risk without mitigation" rule, which
  flagged accepted risks, is gone.
- **Azure DevOps removed for now:** the Azure DevOps connection of 0.15
  (PAT and OAuth) is gone with the old integration services; it returns as
  an adapter of the new integration in 0.17. The OAuth deep-link handler
  is removed as well.
- The Continue / phase-complete buttons are gone (tabs are switched in the
  phase bar).
- CI runs the component tests.

### Fixed
- **Report:** the PDF (pdfmake, also the CLI) lacked six chapters the other
  formats have — applicable regulations, methodology, DFD element
  descriptions, asset-element relations, attack-path threat scenarios,
  traceability matrix — and its table of contents checked outdated ids.
  Risk levels in reports of classic projects follow the scale thresholds
  (the executive summary counted 188 of 199 Smoke Detector risks as
  critical; the risk tab: 16).
- **Overview:** DFD findings appeared under Hazard (old phase number), and
  the DFD status came from the validation stored in the file instead of
  the current one.
- **Assets:** protection targets of the hazard analysis (persons, the
  building) are no longer reported as "not placed in DFD".
- **Hazards:** a hazard without ISO 12100 type, description or rationale
  is reported (warnings); the toolbar chip shows warnings.
- The threat configuration dialog dropped configuration fields it did not
  know on save.
- The audit commit message could carry `Author: Unknown` when the author
  was set after the Audit tab opened.

### Upgrade notes
- Projects are converted to schema 11 when opened (backup alongside);
  afterwards they open in 0.16 and later only.
- **Jira:** run the connection test once in the Integration tab — tokens
  are now bound to the tracker address (older keychain entries are
  removed). Each team member connects with their own account.
- **Azure DevOps** users: there is no Azure DevOps connection in 0.16.
  A project that depends on it should stay on 0.15.2 until 0.17 — once
  opened in 0.16 it is converted to schema 11 and no longer opens in
  0.15.2. Ticket keys stored on mitigations stay in the project.
- After the first save, the commit author and the Jira e-mail are no
  longer in the project file; teammates set their own (the author is
  taken from `git config` when empty).
- In a repository with a signer manifest, commits are signed always — a
  project with signing switched off must have a signing key set.

## [0.15.2-beta] - 2026-10-30

Security fix for the issue-tracker integration and two DFD fixes, no new
project schema (projects stay on schema 10 and open in 0.15.0-beta and
0.15.1-beta as well).

### Security
- **Issue-tracker tokens no longer reach the project file.** After a
  successful Jira connection test the form wrote its test credentials a
  second time — with the API token — into the project, undoing the
  keychain-only handling of the token; depending on timing the token ended
  up in `integration.connection.credentials` (and the account id was lost).
  The Azure DevOps tab stored its personal access token and OAuth tokens
  there by design. Project files go into the audit repository, so a
  token there is a leak.
  - The Jira form no longer passes the token on; the token stays in the
    OS keychain under the account id.
  - The Azure DevOps PAT is kept in the OS keychain as well; Azure
    DevOps OAuth tokens are kept in memory only (sign in again after
    reopening the project).
  - Safety net for every writer (save, export, audit commit): secret
    fields (`apiToken`, `personalAccessToken`, `accessToken`,
    `refreshToken`, `token`, `password`, `clientSecret`) are removed
    from `integration` before a file is written. Files that contain a
    token are cleaned on their next save.
  - **Action:** revoke tokens that may have been saved in a project file
    or an audit repository, and create new ones.
- **Secret scan in audit repositories:** TARAflow installs a second
  managed git hook (`pre-commit`, hooks version 3) next to `commit-msg`.
  It blocks a commit that stages a `*.tara.json` containing a secret
  field with a value or a well-known token format (Atlassian, GitHub,
  GitLab, AWS, Slack, private keys) — also for commits from the console —
  and names file and line, never the value. Existing audit repositories
  are offered the update in the Audit tab (hooks version 2 → 3).
- **Secret scan in this repository:** `npm run secret-scan`
  (`scripts/secret-scan.mjs`) runs in CI over every tracked file and as
  the versioned pre-commit hook (`git config core.hooksPath .githooks`);
  the same patterns as the audit-repository hook, plus local patterns for
  JSON files in a git-ignored `.secret-scan.local`.

### Fixed
- **Interfaces passed by a data flow:** the DFD analysis drew every flow
  from the centre of its source to the centre of its target and ignored
  the draw.io anchors, so a flow could seem to pass an interface it does
  not pass, or miss the one it does. It now follows exit anchor →
  waypoints → entry anchor. Projects whose detected interfaces change
  show the threat generation-drift banner after the update (examples:
  SmokeDetector "push debug commands" now passes JTAG; Simple Test
  Project "push register data" passes JTAG only).
- **Validation of multi-page DFDs:** flows excluded from threat
  generation (external entity to external entity, "exclude from threat
  generation", abstract flows with a valid refinement) were left out of
  the validation, so an element connected only by such flows was
  reported as unconnected and those flows were not checked at all. A
  multi-page DFD now gets the same findings as a single page.
- **Versioned pre-commit hook of this repository:** `.githooks/pre-commit`
  (secret scan of the staged contents) was documented but missing from the
  first build of this release; it is included now.
- **Windows (CRLF checkout):** `scripts/secret-scan.mjs` no longer starts
  with a shebang — with CRLF line endings Vite could not parse it and the
  secret-scan tests failed on Windows (the script is always run via
  `node`). `.gitattributes` keeps LF for git hooks and shell scripts: with
  CRLF the pre-commit hook scanned every tracked file instead of the
  staged contents.

## [0.15.1-beta] - 2026-10-25

Extensions of existing features, no new project schema: the hazard
import reads EN ISO 12100 / EN ISO 13849-1 risk assessments completely
and can re-import a revised sheet, attack paths get controls that fit
their attack vector, and the asset graph shows hazard items and lets you
move nodes. Projects stay on schema 10 and open in 0.15.0-beta as well.

### Added
- **Hazard import for ISO 12100 / 13849 risk assessments:**
  - severity on the five-level person-harm scale (reversible minor …
    fatal) instead of a coarser intermediate scale, with a value-map
    editor for a single severity, probability or category column;
    profiles with the old values import as before;
  - default affected persons for sheets without a person column, and a
    configurable list separator (`,` keeps "Bediener/Einrichter" one
    person);
  - fields for lifecycle phase, hazard zone, protective measures and
    their type (inherent / technical / information / combined), risk
    graph S/F/P, PLr, PL achieved and safety function, shown in the
    hazard dialog;
  - a warning per row when the severity contradicts the risk graph's S
    (reversible with S2, irreversible or fatal with S1);
  - the hazard category suggested from free-text hazard types (German
    and English keywords); ambiguous values are left to the analyst.
- **Import profiles in the project:** a profile is stored with its
  source file, sheet and header row and offered again.
- **Re-import:** a revised sheet is recognised by file name or header
  row; moved, renamed, added and removed columns are followed. Rows are
  reconciled by their id — new, changed, unchanged, removed — after a
  preview; changed and removed hazards are flagged ("changed in source",
  "removed from source") until marked as reviewed. Nothing the analyst
  edited is overwritten; removed rows are never deleted.
- **Attack vector in attack trees:** `av=network|adjacent|local|physical`
  on any node (ISO/SAE 21434 G.9 vectors, aliases `net/adj/loc/phys`),
  inherited down the tree. It only selects controls — attack potential,
  feasibility and path keys stay unchanged.
- **Controls by attack vector and project context:** attack-path risks
  get the catalog controls that fit their vector first, then
  vector-independent ones; in-vehicle controls only in the Automotive
  domain. 20 new controls with verifications (firewall default deny,
  egress filtering, RBAC/ABAC, SELinux/AppArmor, seccomp, read-only
  verified root file system, SecOC, CAN IDS, signed OTA with
  anti-rollback, SBOM-based patch management and more).
- **Asset graph:**
  - hazard items as read-only nodes in their own lane above the
    protection targets, coloured by their worst severity, with
    `contributes_to` and `endangers` edges, a read-only card and
    "Open in Hazard tab";
  - hazards as neighbours in the focus view, and a hazard as the focus;
  - "DFD elements" can be switched off in the focus view too.

### Changed
- **Asset graph mouse as in draw.io:** dragging a node moves it,
  Ctrl / ⌘ + drag pans (also over a node), dragging the empty canvas
  pans, the wheel zooms. Nodes of the data … infrastructure lanes move
  along their lane; side-column nodes snap to a row, including a free
  row above the top lane. Moved positions are stored locally, never in
  the project file. The graph starts with the preset *All*, hazards on.
- Report: controls and verifications appear as "ID — text" in the risk
  tables of every format, and in the attack-path threat chapter. The
  attack-trees chapter comes right before the threat scenarios.

### Fixed
- The hazard import no longer invents data: a missing or unknown
  severity no longer becomes a minor injury (no person edge is created,
  with a warning), and no fixed English or German text is written into
  the project (residual-risk notes stay in the imported data).
- The imported rating is kept: probability, RPN and the source values
  ("VS 3", "AW 2") appear in the hazard dialog under *Imported data*.
- The import's column suggestion found no aliases; it now does, in every
  available language.
- The asset graph missed manually created assets, so the protection
  targets of hazards and their edges were absent.
- ⌘ + drag on macOS panned the asset graph.
- An ISO project with stored per-interaction threats no longer shows a
  "STRIDE per Interaction" chapter; in the PDF, each threat chapter
  renders its own threats once.

### Notes
- **No schema change** (still schema 10). The new data — import
  profiles, re-import flags in the imported data and `av=` in the tree
  DSL — is passed through unchanged by 0.15.0-beta, which ignores
  `av=` when parsing; a file saved with 0.15.1-beta can be opened and
  saved with 0.15.0-beta without losing it.

## [0.15.0-beta] - 2026-10-25

ISO/SAE 21434 projects get the risk value 1–5 of the standard, with
threat scenarios, a review list and a methodology chapter in the report.
On a 3- or 4-level risk scale, the attack-tree likelihood is corrected
in every preset. Opening a project migrates it to schema 10 (TARAflow
asks first and keeps a backup of the original). **Risk values change** —
see the notes.

### Added
- **ISO/SAE 21434 risk value 1–5** (clause 15.8): impact × attack
  feasibility, read from the matrix of Annex H.8, shown with a word
  (Minimal / Low / Medium / High / Critical) and, in the report, with
  its inputs ("4 – High (Impact Major × AF High)"). Register, filter,
  heat map (the 4 × 4 matrix of H.8), risk dialog, report and
  traceability matrix show it instead of I × L. The residual value is
  computed from the ratings after mitigation.
- **Threat scenarios** in the risk register of an ISO project: the
  attack paths of one tree form one scenario. The scenario's value and
  residual are the highest of its paths, and its options are the union
  of theirs.
- **Review list** (ISO): Retain at a value of 4 or more, Reduce at a
  value of 1. A banner lists them, and *only these* filters the
  register. Nothing changes automatically.
- **ISO treatment names** (15.9): Avoid / Reduce / Share / Retain.
  Stored values stay the same; a stored *transfer* shows as
  "Share (transfer)" with a review hint.
- **ISO impact scale:** four levels named Negligible / Moderate /
  Major / Severe. An ISO project uses the 4-level scale; it is set while
  nothing is rated, otherwise a finding asks to re-rate. A safety
  rating of 4 given only as a number is flagged as ambiguous.
- **Calculation stamps:** ISO risks and attack-path analyses record the
  method, the calculation version and a hash of the tables they were
  computed with.
- **Report:**
  - *Methodology* chapter (ISO only): method, attack-potential bands
    (Table G.7), attack-tree gate rules, the H.8 matrix, treatment names,
    the seven cybersecurity properties and the calculation stamps.
  - *Risk Assessment (Threat Scenarios)* chapter (ISO only).
  - *Attack Trees* chapter (all presets, previously empty): anchor,
    structure with AND/OR gates and leaf ratings, and paths with attack
    potential, feasibility and relevance decision.

### Changed
- **Tree likelihood on the project's risk scale** (all presets with
  attack trees on a 3- or 4-level risk scale). A path with feasibility
  *high* gave likelihood 5 — above the scale. The mapping is now 1/1/2/3
  (3-level), 1/2/3/4 (4-level) and unchanged 1/2/3/5 (5-level). The
  migration recomputes the affected risks, so their I × L values change;
  for example, 12.5 → 10 in the Headlamp example.
- Under ISO, the I × L risk per impact category is no longer shown, and
  the risk configuration dialog hides the I × L settings.
- `taraflow-report` completes the stored chapter list the way the app
  does, so the CLI report of an older project gains the newer chapters,
  and `--chapters` can select them.
- An attack tree whose stored structure no longer matches its DSL is
  parsed again when the project is opened.

### Fixed
- A risk sync without a change no longer gives every risk a new
  modification date and no longer marks the project as changed.
- Re-analysing an attack tree without a change keeps its dates.
- Report: the table-of-contents links in HTML and Markdown work again
  (they broke on parentheses, umlauts and custom titles). HTML and the
  PDF from the app leave out deselected chapters. The CLI PDF shows each
  STRIDE risk chapter once, with its own risks.
- The conversion dialog names everything the schema 10 migration does.

### Notes
- **Project schema 10.** Earlier TARAflow versions refuse a schema 10
  file. The migration:
  - normalises old person-harm names again (`fatality` → `fatal`; names
    only, no rating change);
  - corrects the attack-tree likelihood on 3- and 4-level risk scales;
  - computes the ISO risk value for every risk of an ISO project and
    stamps it.

  Treatments, priorities and justifications stay unchanged.
- **Values to review after the update:**
  - ISO projects now show risk values 1–5 instead of I × L; the review
    list names the decisions worth a second look.
  - Projects with attack trees on a 3- or 4-level risk scale get
    corrected I × L values in every preset.
- Projects saved as schema 10 by a development build before this release
  are not migrated again. Set `schemaVersion` to `9` in the project file
  before opening them; the migration can safely run a second time.

## [0.14.0-beta] - 2026-10-23

The first beta. A project can now hold a leveled DFD — a top-level
diagram plus child pages that decompose multiprocesses — and safety is
rated on one five-level harm scale, derived from annotations and hazard
items instead of being typed in on the asset. Opening a project migrates
it to schema 9 (TARAflow asks first and keeps a backup of the original).

From here on the beta counts its patch number: the next releases are
`0.14.1-beta`, `0.14.2-beta`, …

### Security
- **electron ^44.9.3** (GHSA-x562-297c-g43g).
- **Build and test tooling** (not shipped with the app): vite 7.3.7,
  vitest 4.1.12 (several advisories), follow-redirects 1.16.1.
  `npm audit` reports no vulnerabilities.

### Added
- **Leveled DFDs.** Several draw.io pages per project: a *Top* page and a
  child page per decomposed multiprocess, created and deleted with the
  multiprocess. Elements keep one logical identity across pages
  (definitions and context copies, linked in `dfd.pages`), are numbered
  hierarchically (`P-2.1` under `MP-2`), and can be renumbered per page.
- **Effective model.** Threat generation, assets and the report work on
  the leaves of the decomposition: flows drawn on a parent level are
  stitched to the parts that handle them, interfaces inherit physical and
  chip boundaries. `refines` links and abstract flows keep parent and
  child pages balanced; the DFD validation reports leveled findings
  (dangling references, unbalanced flows, duplicated definitions).
- **Working with pages:** adoption dialog for existing multi-page
  diagrams and pasted copies, *Insert as context* with category tabs,
  *Sync context*, page info on draw.io's page tabs, a child page opened
  with a button, one thumbnail per page with a page selector in the
  previews, confirmation when a definition moves or a linked definition
  would be lost.
- **Grouping per decomposed multiprocess** for threats, risks and assets,
  with a summary per group, filters by page and analysis state, a risk
  matrix per DFD group, an asset roll-up and a page filter in the asset
  graph. A flow between two multiprocesses belongs to the side it
  attacks; a banner lists flows analysed on a parent level.
- **Reconciliation before regenerating threats:** the dialog shows new,
  unchanged, changed and obsolete threats; a threat whose references
  changed keeps its rating and is flagged for review.
- **Audit: classified DFD diff** (semantic, graphical, structural,
  identity) per page, definition, copy and layout, plus the effect a
  change has on the analysis.
- **Reporter:** in every format the DFD chapter starts with its
  statistics, then one section per page with its figure and element
  table, then the flows analysed on a parent level; threat and risk
  tables are grouped like the app, with statistics in the threat and
  risk chapters. The `taraflow-report` CLI runs the same DFD analysis
  (via `@xmldom/xmldom`).
- **Safety severity scale** with five levels — reversible minor/major,
  irreversible minor/major, fatal — used by safety annotations, hazard
  items, asset ratings and the risk factor. Mapped to IEC 62061 Se1–Se4,
  ISO 26262 S1–S3 and EN 50742.
- **Safety model reference** `doc/taraflow-safety-model.md`: why there
  are two paths (annotation for a single cause, hazard item for combined
  causes), how the rating is derived, where it lives in the code.
- Development builds show a notice when the running Electron part is
  older than the source.

### Changed
- **An asset's safety rating is derived.** The asset properties
  *Contains safety-relevant data*, *Safety relevant*, *Safety impact* and
  *Safety rationale* are gone; the asset form explains where the rating
  comes from. The rating is the worse of the asset's safety annotations
  and hazard items; a justified manual override still wins.
- **Both paths on one asset raise a warning** (validation and asset
  table tooltip) — use one of them. The stricter rating is kept.
- **Safety Override Rule:** direct relevance with irreversible-major or
  fatal harm → CRITICAL, irreversible-minor direct or the severe levels
  indirect → HIGH+, reversible harm direct → HIGH, indirect → MED+.
- `fatality` is now called `fatal`.
- The asset and asset-to-asset relationship documents are available in
  English next to the German versions; the README links them together
  with the safety model.
- Threat, risk and asset groups share one accordion; leveled DFD actions
  report errors as codes with i18n texts.

### Fixed
- Descriptions of elements and flows are editable and kept on save; a
  description edit updates the DFD phase status.
- Per-interaction threats keep the assets of their endpoints.
- Undo after an autosave restores links and records.
- No false "mitigations changed" after reopening a project.
- Phase statuses on the overview are derived from the project data; the
  attack tree counts toward progress only for ISO/SAE 21434.
- The asset group toolbar stays in place.
- The asset overlay in a leveled DFD keeps every page and marks an
  element on all pages that show it (definition and context copies).
- *Renumber this page* is disabled while the multiprocess the page
  decomposes has no number (its parts would get flat numbers).
- Scrolling or an undone change is no longer recorded as a DFD change.
- Report: the DFD statistics list every element type present and their
  total is the sum of the rows; the element descriptions chapter has its
  title again, and StrictDoc sections are balanced (later chapters no
  longer nest one level deeper).

### Notes
- **Project schema 9.** For the DFD the step is a version fence: classic
  projects keep their data (`dfd.pages` stays absent), but earlier
  TARAflow versions refuse a schema 9 file instead of silently merging
  the pages of a multi-page diagram. For safety it renames the levels
  conservatively (`reversible_injury` / `reversible_moderate` →
  `reversible_major`, `irreversible_injury` → `irreversible_major`,
  `fatality` → `fatal`, safety impact rating 3 → 4), drops the old asset
  safety properties and turns a lone *Safety impact* into a manual
  override marked `[MIGRATED]`.
- Projects saved as schema 9 by a development build before this release
  skip the safety part of the migration; set `schemaVersion` to `8` in
  the project file before opening them.
- An existing multi-page draw.io file is analysed after its pages are
  adopted in the adoption dialog.

## [0.13.4-alpha] - 2026-10-20

A security and bugfix release: all known vulnerabilities in the
dependencies are closed, enclosures and interfaces get the threats meant
for them, and two annoyances in the DFD editor are gone.

### Security
- **simple-git 4.0.2** (critical). simple-git runs the Git operations of
  the audit workflow and the source version binding in the main process.
  Versions up to 4.0.1 let a crafted configuration or option run commands
  (GHSA-g4wm-2vf7-vfgr, GHSA-858h-whjf-mvg5, GHSA-x6jw-m9v5-85vh,
  GHSA-v5rq-49vh-5v5c). Every Git command TARAflow issues was verified
  against a real repository with the new version, including commit, push
  and `ls-remote`.
- **handlebars 4.7.10** (critical): JavaScript injection through
  precompiled templates. Installed as a dependency of `asciidoctor`, which
  is declared but not loaded by the app — no exploitable path, updated
  anyway.
- **Build and development tooling** (not shipped with the app):
  shell-quote / concurrently (critical), axios, undici, brace-expansion,
  http-cache-semantics, source-map-js (high), and the sprintf-js
  denial-of-service in the electron-builder chain (moderate; `global-agent`
  overridden to 4.x). `npm audit` now reports no vulnerabilities.

### Fixed
- **Enclosures got flow threats with themselves on both ends.** In the
  per-interaction method a physical boundary received the data-flow
  templates with sender = receiver ("Attacker impersonates the enclosure
  to deceive the enclosure"). Both methods now take its threats from the
  physical boundary templates. Impersonation of personnel (S-008, S-009)
  and the missing audit trail (R-012) apply only to cabinets, rooms and
  buildings; a STRIDE category without a matching template produces no
  threat for an enclosure.
- **An enclosure inside a trust boundary lost its own table** (per
  element): its threats landed in the trust boundary's table. Physical and
  chip boundaries now have their own table, together with the threats of
  their interfaces — one table per boundary, no second one of the same
  name.
- **Interfaces got flow threats with themselves on both ends** (per
  interaction), like the enclosures. They now get the interface templates,
  as in the per-element method. The threat identity (element + STRIDE) is
  unchanged, so ratings are kept on regeneration.
- **An element stuck to the pointer after a click in the DFD.** Opening the
  details panel interrupted draw.io's mouse gesture, so the element
  followed the mouse until the next click. The selection is now reported
  after the button is released.
- **The diagram opened tiny.** draw.io fitted the whole diagram into the
  window on opening; it now opens at 100 %, as after "Reset view".

### Changed
- **New mitigation M-PB-T-006 "Tamper-resistant enclosure"** (security
  screws, lockable or sealed cover, vandal-resistant), proposed for opening
  (T-001) together with active tamper protection, and for destruction
  (D-007).
- **Risk tab opens faster.** Tooltips in the risk table are created on
  first hover instead of up front (on a project with 87 risks the table
  mounted in 1.2 s instead of 2.8 s).
- The unused `i18next-parser` development dependency was removed.

### Notes
- **Existing projects with enclosures or interfaces:** the generation
  drift banner offers to remove the per-interaction threats that are no
  longer generated; a regeneration updates the texts and templates of the
  others. Analyst fields (relevance, status, notes, risk ratings) are
  kept.
- No project format change (schema 8).

## [0.13.3-alpha] - 2026-10-14

A bugfix release for threat regeneration: it lost analyst decisions.

### Fixed
- **Regeneration dropped the relevance override.** Relevance, status and
  note were kept, but not the `relevanceOverridden` marker that protects the
  analyst's relevance from the ISO 21434 derivation from the asset link. The
  next graph sync then overwrote the decision — on a real project 59 threats
  marked "not relevant" despite an asset link would have become "relevant".
  The marker is now kept.
- **A kept threat whose rule returned was dropped or duplicated.** A threat
  the analyst kept after a rule change (drift review → Keep) became manual.
  When a later rule change produced it again, regeneration either dropped it
  with its evaluation (manual threats not kept) or added the generated one
  next to it (manual threats kept). It is now merged back: same id, the
  analyst's relevance, status and note, source from the generator, the
  "kept" marker removed. Analyst-authored manual threats are unchanged and
  never merged.

### Notes
- Projects regenerated with 0.13.2 or earlier may already have lost
  overrides. They cannot be recovered from the project itself; restore them
  from a copy saved before the regeneration.

## [0.13.2-alpha] - 2026-10-14

A bugfix release for the CIANAAA derivation: security goals are suggested from
the relation between a DFD element and an asset, and several relations had no
rule — those assets silently got fewer (or no) suggested goals. Every
combination of asset group, relation type and qualifier now has a rule; a
test guards that it stays so.

### Fixed
- **`deletes` on data assets suggested nothing.** The rule was keyed
  `data:destroys`, a relation that does not exist; the stored relation is
  `deletes`. It now suggests Integrity and Non-Repudiation (+ Accountability
  for personal data).
- **Function assets got no suggestions for `invokes`, `implements` and
  `monitors`.** Added: `invokes` → Authorization, `implements` → Integrity,
  Availability, `monitors` → Integrity, Non-Repudiation. The specified rules
  for `is_an`, `executes` and `depends_on` were missing in the code as well.
- **On-site access to infrastructure was never derived.** The rule was keyed
  `accesses:local`, but the qualifier is `on-site`. The unused
  `accesses:remote` rule is removed — there is no such qualifier; remote
  access is modelled as `uses [network]` on the system asset.
- **Missing rules completed:** data `is_an`; system `monitors` and `uses`
  with the qualifiers authentication, authorization, storage, computation,
  messaging, configuration, monitoring and networking; all physical and
  service relations. Human `endangers` and all environment relations are
  explicit "no suggestion" rules — these are protection targets whose damage
  is rated as safety or environment impact.

### Notes
- Existing projects can get **new suggested goals** on assets with these
  relations, and with them new threats in the threat preview. Goals the
  analyst decided (`manual`) are never changed.
- The rule tables in `doc/taraflow-cnc-referenzfall.md` § 4.2 now list every
  group and relation, including what is filtered as not applicable.

## [0.13.1-alpha] - 2026-10-13

A bugfix release from a real-size ISO/SAE 21434 project (36 DFD elements,
26 assets, 87 attack trees): the app became sluggish, tab switches took
seconds, and memory grew with every visit to the DFD tab.

### Fixed
- **Tab switches took seconds with many attack trees.** The attack-tree tab
  stays mounted in the workspace (hidden), and MUI v5 keeps the content of a
  collapsed accordion mounted — so the path tables of every tree group were
  rendered on each workspace render, even with all groups collapsed. A
  group's trees are now rendered only while it is expanded
  (`unmountOnExit`). Measured on the 87-tree project: re-render ~4 s → ~0.15 s
  (jsdom), DOM nodes 12k → <500.
- **Memory leak in the DFD tab.** The draw.io bridge registered a `window`
  message listener that was never removed; disposing the bridge only set a
  flag. Every visit to the DFD tab kept the previous draw.io controller, its
  detached iframe and the whole draw.io window alive, and each of them kept
  handling every message. The listener is now removed when the bridge is
  disposed.
- **Asset findings asked for a goal the asset cannot have.** "N threat(s) of
  category S/E violate no active security goal — add AuthN/AuthZ" was also
  shown for data assets, where AuthN and AuthZ do not apply. For such assets
  the finding now says to link a function or system asset carrying the goal
  to the DFD element (or to check whether the threats belong to the asset);
  for applicable goals the hint lists only those.
- **Pure hazard protection targets got goal/DFD findings.** Assets that a
  hazard only endangers (people, environment, building) are no longer asked
  for a security goal and a DFD link; an asset that is also a cause keeps
  both checks.

## [0.13.0-alpha] - 2026-10-12

A feature release around **asset-to-asset relations**. Asset links are now
stored in the project and survive save and reopen — before, they lived only
on a runtime copy and were lost. On top of that, the DFD tab gets a third
view: the **asset graph**, which shows how assets relate across layers and
lets the analyst model them directly — asset links, assets, their properties
and DFD element relations.

> **Project format:** schema version **8** (was 7). Asset links are stored as
> an edge list in `assets.relations`. Opening an older project asks before it
> is converted; a backup is written first. A converted project cannot be
> opened by an older TARAflow version.

### Upgrading existing projects
- **Conversion only on request.** Starting the app no longer converts the
  projects of the recent list. Opening a project with an older schema shows
  what changes per schema step, the backup path, and that older versions
  cannot open the file afterwards; Cancel writes nothing.
- **Asset links from older files** that are still found on the DFD asset
  copy are taken over into `assets.relations`. Links that an earlier version
  already lost when saving cannot be restored.
- **Element → asset relations** get the group of the asset they point to
  when the project is loaded. Earlier versions stored every "uses" as a
  system and every "accesses" as an infrastructure relation, also for
  service and physical assets. Qualifiers are left as they are; the relation
  dialog asks for a valid one when it is edited next.
- **Validation of data flows** follows the element rules. Relations the rules
  allow (e.g. DataFlow → Function "invokes") are no longer reported; types
  the rules do not allow are reported for data flows as for other elements.

### Added
- **Asset graph** — third view in the DFD tab next to Diagram and Description:
  - Layer view with one lane per vertical layer (data → function → system →
    infrastructure) and a side column for process, service, physical, human
    and environment; presets (All, Architecture, Flow, Services &
    dependencies, Protection targets) and a custom layer choice. Links to
    hidden layers appear as counters on the node; a click shows the layer.
  - Focus view around one asset with depth 1–3, including the DFD elements
    that relate to it.
  - Relation type filter and search; a hit in a hidden layer or outside the
    focus says why and offers to show it.
  - Detail card for an asset (relations grouped by type, DFD elements) or a
    link (type, step, rationale, degraded mode, notes); "Show in table".
  - Highlights: selection, newly appeared assets and links, search hit, and a
    symbol on links the rules no longer allow.
  - Stable layout: nodes move only on "Rearrange"; positions are remembered
    locally per project (never in the project file).
  - Keyboard: Tab and arrow keys select nodes, Enter focuses, Delete removes
    (edit mode), Esc closes or cancels.
- **Edit mode in the asset graph** (visibly marked):
  - Connect by dragging from a node's handle; while dragging, every asset is
    marked as valid, reverse-only or not allowed. The chooser offers only
    allowed types (core types first), shows existing ones as taken, and helps
    with the direction.
  - Create an asset in a layer ("+" on the lane) and delete one with the
    usual confirmation listing everything that depends on it.
  - Edit link attributes (step, rationale, notes, degraded mode) and asset
    properties in the card — the same forms and write paths as the side panel.
  - Relate DFD elements to assets: from an element's handle or "Link to
    element" in the asset card, with the side panel's relation dialog.
  - Undo / redo of link changes (Ctrl+Z, Ctrl+Shift+Z).
- **Asset Links** column in the asset table and "Linked assets" in the asset
  dialog, read from the listed asset ("requires DA-002" at the target).
- **"Show in graph"** from the asset table; the row is marked when coming
  back via "Show in table".
- **Findings for asset links** the rules no longer allow (e.g. after a group
  change), in the asset tab and in the DFD notification panel; nothing is
  deleted.
- **Mirror hint** in the relation dialog when the same fact already exists
  in the opposite direction (e.g. required_by ↔ reads).
- **Audit diff**: asset links (added, removed, changed).
- **Asset export/import** carries the asset links between the exported assets.

### Changed
- **One place to edit per view** in the DFD tab: the side panel only in the
  diagram view; the description view edits in its accordions, the asset graph
  in its cards. Notifications navigate in the current view. The description
  view uses the full width.
- **Asset import adds.** The former "Replace all" mode (which imported no
  assets) is gone. Assets already in the project — same id, or same group and
  name — are listed with **Keep** (default) or **Replace** per asset; replacing
  keeps the asset's identity, so DFD relations, risks and hazard references
  stay valid. Nothing is deleted.
- **Element → asset relation dialog** offers only the relation types and
  asset groups the element rules allow, and the qualifiers of the asset's
  group (service: api/sdk/webhook/managed, physical: direct/indirect/remote).
  Stored relations the rules do not allow are marked and must be removed
  before saving.
- **Step order** is offered only for relation types where it means something
  (invokes, configures).
- The asset tree in the DFD asset panel follows a selection made elsewhere.

### Fixed
- Asset-to-asset relations were lost on save and reopen.
- The first asset edit after opening a project from the list was dropped
  without notice.
- A DFD import into a new project lost the asset-to-asset relations.
- The relation dialog in the description view offered no target assets, and
  hid a target as soon as any relation to it existed.
- Service "uses" and physical "accesses" relations were stored with the wrong
  group and lost their qualifier in the asset table.
- The DFD editor stayed empty because diagrams.net rejects requests with a
  localhost referrer; draw.io is loaded without a referrer.
- Loading the recent list converted and overwrote every older project.

## [0.12.0-alpha] - 2026-10-02

A feature release around **security goals and risk impact**. Security goals
are now decisions with a traceable basis instead of checkboxes: TARAflow
derives them from the DFD and the asset impact, the analyst confirms, adjusts
or excludes them with a rationale, and every later change of the basis is
flagged. The goals drive threat generation and the risk impact, and the risk
impact no longer dilutes harm to people. Threat generation reports — instead
of silently applying — the effect of rule and goal changes on stored threats.

> **Project format:** schema version **7**, unchanged. New data (goal
> decisions with their snapshot, per-goal impact, impact aggregation, weight
> source) is stored in additional optional fields.

### Upgrading existing projects
- **Stored threats and risk values do not change on load.**
- **Generation drift may appear.** Security goals and element properties now
  combine by intersection, and per-element data flows pass their properties
  to the generator. Threats the current rules would no longer produce (or
  would add) are shown in a banner in the Threats tab and as a warning on the
  phase tab; keep or remove them explicitly.
- **Impact aggregation and asset weights** stay at the previous behaviour
  (weighted mean, own risk weights) until switched in the risk configuration,
  where a preview lists every risk that changes. New projects take the
  preset's recommendation.
- **Risk impact from security goals** applies on the next risk sync. Without
  per-goal impacts a value changes only where a linked asset without a
  matching goal had the highest value.
- **New asset findings** appear for manual goals without rationale and for
  assets without impact rating.

### Added
- **Security-goal cards** in the asset dialog, one per goal: level and source
  (Suggested / Adjusted / Added / Excluded), why this goal (DFD relations),
  why this level (driving criterion), rationale, formal requirement and
  damage-scenario consequence. A rationale is required for every deviation
  from the suggestion; the suggestion a decision was made against is
  recorded, and a later change of its basis is flagged ("Review" /
  "Suggestion changed"). An unassessed goal never shows as "Low" — it says
  "Assessment required" and points to the impact rating.
- **Impact per security goal**: a goal can rate a criterion lower than the
  asset (e.g. safety for integrity); a value above the asset is reported as
  an error and never changed silently.
- **Risk impact from the violated goals**: the impact of a risk comes from
  the active goals its STRIDE category violates on the linked assets,
  including per-goal impacts; without a matching goal the asset values apply
  as before.
- **Asset table**: goal chips with level and state (coloured by source, pen
  icon for decisions, markers for errors and warnings), a findings panel below
  the table that opens the asset where a finding is fixed, and a "Needs review
  only" filter.
- **Threat ↔ goal cross-checks**: threats that violate no active goal of
  their assets (warning), active goals no threat violates (info), and "N
  threats" on each goal card.
- **Report**: security-goal table with level, state, basis and consequence,
  excluded goals with their rationale.
- **Impact aggregation** per regulation preset: harm floor = max(safety,
  physical damage, environment, weighted mean of the other impact factors)
  for the standard and EN 50742 presets, maximum for ISO/SAE 21434 and ETSI
  TVRA, weighted mean for existing projects. Switchable in the risk
  configuration with a preview of every changed risk; the risk dialog and
  the report explain how the impact was formed.
- **Impact weights from the asset configuration**: the asset criterion
  weights are the default for the risk impact weights, overridable per
  factor in the risk configuration.
- **ISO/SAE 21434 risk per impact category** (S/F/O/P) in the risk dialog
  and the traceability matrix (display; treatment per category is a design
  draft).
- **Likelihood factor levels** named by the situation they stand for
  ("4 – No technical skills" instead of "4 – High"), for 3-, 4- and 5-level
  scales, en/de; custom factors show the direction.
- **Generation drift**: detection, banner, review dialog (keep as manual or
  remove), warning before a regeneration that would drop threats, warning on
  the Threats phase tab; kept threats are marked "retained" and can be
  restored.
- **Sidebar**: full project name and file path as tooltip.
- **draw.io shape library**: orthogonal data-flow symbol.

### Changed
- **Threat generation**: a STRIDE category is generated only if it is
  technically possible for the element (properties) **and** violates an
  active security goal. Before, both were united whenever a property fired,
  so a derived goal could override an explicit assumption and a property
  that reduces the attack surface could add a category.
- **ETSI TVRA factors** in the risk dialog show the norm's levels with the
  value ("≤ 1 week (2)") and their own number of levels (time 5, intensity
  3, others 4) instead of the project scale.
- **Reading order** in threat tables, drift review and DFD description:
  element kind, natural display ids (DF-2 before DF-10), S-T-R-I-D-E.
- **New Project dialog** uses the same fields as the Overview tab; the
  obsolete criticality switch is gone, the EN 50742-A window of opportunity
  is offered.
- **EN 50742 B tag** is no longer offered (no IEC 62443-4-2 support yet);
  existing projects with the tag keep working.
- **Asset deletion** is project-wide (asset store, DFD, hazard edges, risks)
  from the DFD and the Asset tab; attack trees anchored on the asset block
  it.

### Fixed
- **Phase status**: every threat update replaced the whole phase status map
  with an empty list; the DFD, asset and risk services wrote into the wrong
  phase slot (Hazard, DFD, Threats). Affected projects heal on load and on
  the next save of each tab.
- **Per-element data flows** did not pass their properties to the generator
  (e.g. EL0 had no effect in per-element mode).
- **Threat texts** of cloud, mobile and embedded data-flow templates
  resolved to the text of a different template.
- **Per-element deduplication** dropped the threats of elements sharing a
  display id (e.g. physical and chip boundary "SDC").
- **Per-interaction sync** reported flows outside every trust boundary as
  "without threats" forever.
- **Security goal levels** were inflated to "critical" when every relevant
  criterion was n/a.
- **Readable ids instead of UUIDs** in validation messages, the hazard
  dialog, the threat asset chip, attack-tree DSL and the "missing in DFD"
  list; linked assets read "DA-005: sensor firmware".
- **Hazards**: quick-capture assets get correct labels and are not created
  when their edge was removed; imported hazards get H-<n> ids; hazard
  relations of projects migrated to schema 6 are repointed to the asset
  UUIDs on load.
- **DFD asset tree** clicks work again after a notification focused an
  asset.
- **Risk configuration dialog**: Cancel discards the edits; "reset to
  default" for impact restores the factors configured in the Asset tab
  instead of switching all off.

### Internal
- Requirement tests (`npm run test:requirements`): one test per requirement
  of the security-goal and risk-aggregation design documents, through the
  real services.
- Simple Controller example projects for TARAflow_Examples, generated and
  checked by the test suite.
- Design documents: security-goal rework (rev. 3.11) and risk impact
  aggregation (rev. 5) moved to `doc/Done`; new drafts for risk treatment
  per impact category and the asset graph view.

Full commit range: `v0.11.2-alpha..v0.12.0-alpha`

## [0.11.2-alpha] - 2026-09-24

A maintenance release focused on **dependency and supply-chain hygiene**,
prompted by feedback from an external security engineer: TARAflow could not be
installed behind a corporate proxy that blocks third-party CDNs, and
`npm audit` reported 16 vulnerabilities. Both are resolved — `npm ci` now only
needs the npm registry, and `npm audit` reports **0 vulnerabilities**.

> **Project format:** unchanged (schema version **7**). Projects are fully
> compatible with 0.11.1.

### Security
- **Electron 39 → 44.** Electron 39 is out of support, so the bundled
  Chromium/Node no longer received security fixes. `npm audit --omit=dev` did
  not show this because `electron` is a devDependency, although it ships with
  the application. Also clears the `extract-zip` advisories
  (GHSA-jmr9-qjv8-65gv, GHSA-7pqw-9j4j-h8q3).
- **Build and test toolchain.** vite 5.0.10 → 7.3.6, vitest 1.2.2 → 4.1.11,
  @vitejs/plugin-react 4.2.1 → 5.2.0. Clears the vite dev-server advisories
  (mostly `server.fs.deny` bypasses), the esbuild dev-server advisory
  (GHSA-67mh-4wv8-2f99) and two critical vitest API/UI-server advisories
  (GHSA-9crc-q9x8-hgqq, GHSA-5xrq-8626-4rwp). All are development-time only —
  they affect a running dev/test server, not the shipped application.
- **Transitive fixes** for ajv (8.17.1 → 8.20.0), fast-uri, js-yaml, nanoid,
  joi and @xmldom/xmldom.

### Changed
- **SheetJS is vendored.** `xlsx` (hazard import from .xlsx/.xls/.ods) was
  fetched from `cdn.sheetjs.com` during install. The official 0.20.3 release
  tarball now lives in `vendor/sheetjs/` and is referenced via `file:`; the
  lockfile integrity is unchanged, i.e. it is the identical artifact. The
  npm-registry `xlsx@0.18.5` was not an option (frozen, affected by
  GHSA-4r6h-8v6p-xvw6 / GHSA-5pgg-2g8v-p4x9).
- **Integrity guard for vendored tarballs.** npm does not verify the lockfile
  `integrity` of `file:` dependencies, so a swapped tarball would install
  silently. A `preinstall` script (`scripts/verify-vendored.mjs`) hashes every
  vendored tarball and aborts the install on a mismatch.

### Removed
- **Unused dependencies:** `react-router-dom` (never imported; several
  react-router advisories, e.g. GHSA-wrjc-x8rr-h8h6 and GHSA-337j-9hxr-rhxg,
  have no fix in the 6.x line), and `monaco-editor`, `@monaco-editor/react`, `monaco-editor-react`
  together with the unused Monaco-based attack-tree editor backup — the editor
  runs on CodeMirror. This also removes the vulnerable `dompurify`.

### Internal
- New smoke test for the xlsx/ods importer's SheetJS layer (it had none) —
  the tripwire for future SheetJS upgrades, which npm outdated/Dependabot do
  not track for a vendored tarball.
- A regression test mock adapted to Vitest 4 (`vi.fn()` called with `new`
  needs a constructible implementation).

Full commit range: `v0.11.1-alpha..v0.11.2-alpha`

## [0.11.1-alpha] - 2026-09-23

A maintenance release focused on **identity and label integrity**. Threat and
risk identities were already UUID-based; this release removes the last places
where a human-readable label still acted as a key, repairs data written by
older builds on load, and fixes the DFD thumbnail. Found and verified on a real
ISO/SAE 21434 project.

> **Project format:** schema version **7**. Projects are migrated on open (a
> backup of the original file is written alongside it). A file saved with
> 0.11.1 cannot be opened by 0.11.0 or older.

### Changed
- **Risk identity is keyed on the threat UUID.** `Risk.id` is now
  `R-<threat UUID>` instead of `R-<threat display id>`. The readable label
  (`R-<threat display id>`) is derived wherever a risk is shown — reports,
  audit diff, Jira footer, attack-tree risk anchors. Schema v7 migration
  (`migrate_6_to_7`) rekeys existing risks and repoints attack-tree risk
  anchors and DFD control-provenance references in one pass.
- **DFD thumbnail only on real edits.** The thumbnail is no longer exported and
  saved on every project open; it is generated once for projects without one
  and refreshed after edits. This removes a write on every open (churn in the
  `.tara.json` history).

### Fixed
- **Risk labels after a DFD renumber.** Renumbering relabelled threats but the
  risk register kept the old label — after a renumber possibly the label of a
  different threat. The risk sync now detects label drift and the banner shows
  "N threat IDs renumbered".
- **Colliding risk ids overwrote each other.** Two risks could share an id
  (same threat label); saving one silently overwrote the other, threat link
  included. Fixed by the UUID-based risk key; the v7 migration separates
  existing duplicates.
- **Manual threats got duplicate labels.** Their sequence number was never
  persisted, the next number was counted per table instead of across all
  tables, and regeneration did not see manual threats. Numbers are now
  `max + 1` over the whole project and persisted; collisions are resolved after
  regeneration.
- **Regeneration could merge a manual threat into a generated one.** A freshly
  generated threat of the same element and STRIDE category inherited the manual
  threat's identity and analyst fields. Manual threats are no longer treated as
  generator predecessors.
- **Threat groups without a title.** Threat tables written by older builds in an
  element-keyed shape rendered as untitled accordions (React duplicate-key
  warning) and survived every regeneration. They are dissolved on load into the
  table of their trust boundary; manual threats take their table's boundary.
- **Empty Threats tab.** The tab only renders with a DFD graph, which is derived
  and never saved; it was rebuilt only as a side effect of the per-open
  thumbnail save. The graph is now rebuilt where it is used.
- **Broken DFD thumbnails.** Exports ran on fixed timers, often while the DFD
  was hidden or not yet laid out, producing missing or shifted labels. The
  export now waits until the draw.io frame is visible and settled, is safe for
  the cross-origin frame, and is skipped rather than saved broken.
- **DFD preview zoom scrolled the page** ("Unable to preventDefault inside
  passive event listener").
- **Custom mitigations stored as catalog ids.** Selecting a custom mitigation in
  the risk dialog stored its text as a catalog id (i18next "missingKey"
  warnings, wrong catalog lookups). Custom selections are stored as notes;
  existing data is repaired on load.
- **Opening a project without tags failed** ("Failed to open project") when the
  regulation preset was reconciled.

### Internal
- Component test suites load again (partial mocks); both had failed at import
  time since 0.11.0, hiding four failing tests.
- Updated workflow diagram (`doc/TARAflow-Workflow.drawio` / `.png`).

Full commit range: `v0.11.0-alpha..v0.11.1-alpha`

## [0.11.0-alpha] - 2026-09-22

The headline of this release is **ISO/SAE 21434 support**: TARAflow's TARA
pipeline and documentation generator now conform to ISO/SAE 21434 end to end —
asset-driven threat relevance, attack-potential-based attack feasibility
(Annex G / ISO 18045), SFOP impact, and risk derived from attack-path
feasibility. STRIDE per-element/per-interaction threats become the enumeration
that feeds attack-tree analysis rather than risks in their own right.

### Added
- **Asset-driven threat relevance (ISO mode).** In an ISO/SAE 21434 project a
  per-element/per-interaction threat's relevance is derived from its asset
  relationship (asset-linked → relevant, none → not-relevant), self-correcting
  on every graph sync. The analyst can still override in the threat dialog, but
  deviating from the asset-derived value requires a justification; "uncertain"
  remains a transient, note-free working state.
- **Attack-path threats carry catalog controls.** Attack-path threats now
  receive the catalog's STRIDE-category mitigations and verifications (capped;
  the analyst's DSL `[M-]` refs are kept first) instead of only the tree's own
  refs. The generic element fallback is capped consistently.
- **SFOP impact mandatory and locked.** Exclusive-mode presets (ISO/SAE 21434 →
  SFOP) force the impact criteria on and lock them: they cannot be deselected on
  the risk side or in the asset-config dialog, and any missing mandatory
  criterion is re-added automatically (self-correcting).
- **Attack-tree editor factor tooltips.** Hovering an audit-DSL factor token
  (`et=1w`, `se=expert`, `b=high` …) shows a readable "&lt;factor&gt;: &lt;level&gt;"
  tooltip (EN/DE).
- **Sensor / Actuator STRIDE templates (OT-reviewed).** Compensating controls
  where per-device crypto is infeasible on legacy/analog field devices
  (IEC 62443-3-3 SR 5.1), freshness/anti-replay on the sensor path, and
  physical/process-side sensor spoofing plus actuator feedback spoofing.

### Changed
- **STRIDE threats excluded from the risk register in ISO mode.** They are
  enumeration feeding attack-tree analysis; risk comes only from attack-path
  threats. The risk toolbar's STRIDE method switcher is hidden in ISO mode.
- **Single source of truth for the feasibility bands.** The ISO risk core and
  the attack-tree config now derive their Table G.7 band tables from one shared
  definition (`shared/attack-feasibility-bands`), so they cannot drift.
- **Risk-dialog ISO factor pickers** show the canonical Table G.7 level order
  with clean level names; the ISO 18045 attack-potential points moved into a
  per-entry tooltip.
- **i18n (EN/DE)** for the ISO factor levels and names, residual strings, and
  the attack-tree factor levels.

### Fixed
- **Element threat text resolved without its domain.** The create-threat dialog
  looked up element threat/attack/cause text without the template domain, so an
  embedded template whose id also exists under "general" (e.g. `S-004`) showed
  the wrong text. It now resolves with the template's domain.

Full commit range: `v0.10.0-alpha..v0.11.0-alpha`

## [0.10.0-alpha] - 2026-09-10

The headline of this release is **Source Version Binding**: TARAflow can now
record which source version a security analysis was performed against, resolve
it to a pinned commit, and detect when that source has drifted since — giving
version-exact traceability from the TARA to the implementation it describes
(EN 50742 §7.5 / §8.4, "identification of software"). This release delivers the
project-level scope end to end (Phases 1–3); element-level bindings and the
validation/coverage reporting that builds on them are deferred (see `doc/Open/`).

### Added
- **Source references (project scope).** An analyst can record a project-level
  source reference — repository URL, ref type (branch / release branch / tag /
  commit) and ref label — on the Overview tab, as an optional
  documentation/evidence reference. The full data model (`SourceBinding`,
  `DriftStatus`, `DriftEvent`) ships up front so later phases need no migration.
- **Commit resolution (remote-first, consent-gated).** A per-binding *Resolve*
  action pins a ref to a commit SHA via `git ls-remote`, behind an explicit
  network-consent prompt shown once per host per Electron session (never
  persisted, never silent). Host/network-unreachable is distinguished from
  repo-reached-but-ref-not-found, and on-prem / offline hosts are handled
  explicitly rather than failing silently.
- **Drift detection.** A *Check for changes* action re-resolves a pinned binding
  and classifies the result into six states (in sync, branch advanced, expected
  release-branch advance, tag moved, ref missing, unreachable), with a live
  status badge and an expandable history. Every state *transition* is recorded
  to an append-only `driftEvents` log; repeated or clean checks add no entry,
  keeping the record bounded. A declined-consent or engine-unavailable check
  records nothing, so the log never conflates "chose not to check" with "the
  host was down". Reuses the audit Finding/severity vocabulary.

### Changed
- **Build target raised to es2022** (`tsconfig.json` and
  `tsconfig.electron.json`), with `useDefineForClassFields` pinned to `false` so
  the existing class-field emit is unchanged — a lib/syntax bump only.

### Fixed
- **D-009 (wireless-interface DoS) i18n.** The catalog interface D-009 had no
  threat/attack/cause text and resolved to the raw fallback key; en + de entries
  added. Fixes newly generated threats only — projects generated before this
  text existed have the raw key frozen into their stored descriptions.
- **Missing asset-to-asset relation i18n keys.** `noTargets`, `noRelationTypes`,
  `stepOrder` and `rationale` under `assets.relations.a2a` were absent in en + de
  and logged `missingKey`; added.

Full commit range: `v0.9.0-alpha..v0.10.0-alpha` (9 commits)

## [0.9.0-alpha] - 2026-09-07

The headline of this release is **EN 50742 Approach A (SRSL)**: the Security
Requirement Severity Level is now a first-class, parallel output alongside the
standard R = L × I risk — surfaced in the Risk tab, the mitigation picker, and
every report format. This release also adds risk- and threat-level filtering,
consolidates the asset store into a single source of truth, and fixes a class
of "assets disappearing" bugs.

### Added
- **EN 50742 Approach A — SRSL in the Risk tab.** An SRSL column (en-50742-a
  projects only) renders `calculatedSrsl` as a coloured SRSL0–3 chip (muted "–"
  when not yet determined). The dialog's SRSL section is gated on an
  exposure-bearing anchor (`exposure_level > 0`) — it shows for crossing
  DataFlows and Interfaces, not internal elements — and, when no
  safety-function asset provides a severity, collapses to a single "No linked
  safety-function asset for Severity" note (AP stays visible; it is valid
  without severity) with an info tooltip describing exactly how to resolve it.
- **Mandated 7.4.3 controls.** The SRSL-mandated protection requirements
  (anchor type × STRIDE × SRSL, from `mandatedRequirementsForThreat`) are mixed
  into the mitigation picker with an "EN 50742 A" chip and pre-selected;
  standard catalogue and custom mitigations remain selectable alongside them. A
  "Mandated 7.4.3 Controls" column is added to the SRSL report table.
- **SRSL Assessment report chapter (all formats).** A new "SRSL Assessment
  (EN 50742 Approach A)" chapter — one row per exposure-anchored risk (safety
  asset, severity, EL / WoO / AC → AP → SRSL) plus the "SRSL vs R = L × I"
  separation note — is available in Markdown, AsciiDoc, HTML, StrictDoc and PDF,
  and auto-hides on non-en-50742-a projects. Existing projects pick up the
  chapter without a migration (`withDefaultChapters` merge), and reports now
  resolve asset UUIDs to names and use the asset `displayId` (not the UUID) as
  the relation heading.
- **Risk-level filter.** A "Risk Level" dropdown on the risk filter bar
  (Critical / High / Medium / Low). Options are derived from the active scale
  (`RISK_SCALES`), so 3-/4-/5-level projects all work, each with a colour swatch.
- **Threat relevance filter.** A second dropdown beside the STRIDE filter
  filters threats by triage status (unrated / relevant / uncertain /
  not_relevant) in both per-element and per-interaction views.

### Changed
- **SRSL is now fully separated from the R = L × I risk.** EN 50742 factors
  (EL, AC, WoO) are excluded from the likelihood mean
  (`EN50742_SRSL_FACTOR_IDS`, single source in the core) and drive **only** the
  SRSL, which `calculateGatedRiskValues` overlays as a parallel output.
  Setting EL / AC / WoO no longer changes likelihood or the risk score; the
  residual risk stays the standard L × I. *(Behaviour change — previously these
  factors moved the risk via the attack potential.)*
- **Single canonical asset store (SSOT completion).** `syncFromDFD` is now
  create/update only — it never removes records from a mirror diff. An asset
  whose DFD links are gone becomes *orphaned* (`getAssetsMissingInDFD`) and is
  removed only by an explicit user action, eliminating the mirror-diff
  asset-loss class entirely.
- **Risk notifications consolidated into one accordion.** The separate
  sync-warning, uncertain-threats and out-of-sync banners are replaced by a
  single collapsible notifications accordion (count when collapsed, a bulleted
  list when expanded, "Sync Now" preserved on the out-of-sync entry). This
  removes the nested-`Collapse` height-measurement glitches and banner clipping
  under the parent's `overflow: hidden`.
- **Severity terminology and guidance.** The `physicalImpact` severity label
  "Fatality" → "Fatal" (en + de), aligning with the EN 50742 "fatal" naming;
  the no-severity tooltip now points to the DFD tab as the place to create the
  asset relation (Interface: invokes/monitors; DataFlow: invokes).

### Fixed
- **Assets could silently disappear.** `syncFromDFD` pruned every
  `source:"dfd"` asset absent from the `dfd.assets` mirror — but that mirror is
  stripped on disk and re-derived on load, so a partial/empty mirror wiped the
  canonical feature store. The prune is now skipped when the incoming mirror is
  empty; genuine removals against a non-empty mirror are unaffected. Regression
  test reproduces the loss.
- **False "asset not found" on DFD relations.** The asset-relation validator
  checked `project.dfd.assets` (the mirror, which can lag the canonical store),
  so a relation to a known asset not yet mirrored errored until the Asset tab
  was opened. It now validates against the canonical asset registry threaded
  through `ValidateOptions.knownAssets`, with the mirror as fallback.
- **EN 50742 severity didn't resolve after a relation was added later.** A
  threat's `linkedAssetIds` cache went stale when a DFD asset relation was added
  after generation, so the risk never saw the safety asset and its SRSL could
  not resolve. `syncThreatsWithGraph` now re-derives `linkedAssetIds` from the
  current asset store on every graph sync; the risk gate resolves assets from
  the fresh threat, asset-link drift is an update trigger, and
  `checkRiskSyncStatus` detects the drift so the sync affordance lights up.
- **Manual STRIDE-method switch was silently reverted.** The active method was
  re-derived from confirmed-threat counts on every render, flipping a manual
  switch back to per-element when the target method's threats weren't confirmed
  yet. Auto-selection is now based only on whether a method has any threats at
  all; a dedicated "threats not yet confirmed" empty state replaces the
  misleading "Sync from Threats" prompt (which would have synced nothing).
- **Per-interaction group labels showed the flow name instead of its id.** The
  data-flow accordion headers read "DF-&lt;flow name&gt;" instead of e.g.
  "DF-7", because the id was parsed from a trust-boundary-prefixed display id
  and fell back to the name. Grouping now uses the authoritative
  `dataFlow.dataFlowId` (already in "DF-nn" form).
- **Wrong relations in the asset-assignment dialog for data flows.** A DataFlow
  (a connection) resolved to `elementType=undefined`, so it offered the wrong
  allowed relations (`is_an` instead of `invokes`) and hid its existing ones.
  The dialog now resolves connections too, treats them as DataFlow for the
  allowed-relation lookup, and reads their `assetRelations`.
- **Risk filters never filtered the table.** The Risk tab passed unfiltered
  risks to the table, so the priority and search filters had no effect on the
  rows. It now passes the filtered set with a matching count — fixed alongside
  the new risk-level filter.
- **Mandated-control labels and SRSL fields were unreadable.** Mandated
  controls showed a raw `en50742-<clause>` id; they are now recomposed as
  "EN50742: &lt;category&gt; — &lt;requirement&gt; (&lt;clause&gt;)". The
  risk-table mitigation tooltip resolves every selected mitigation (catalogue,
  custom and mandated, not just proposed) and drops the redundant trailing
  `[status]`; the SRSL report's Severity and WoO now render with spaces instead
  of underscores.

---

Full commit range: `v0.8.8-alpha..v0.9.0-alpha` (20 commits)

---

## [0.8.8-alpha] - 2026-09-02

### Fixed
- **Impact chips showed the raw asset UUID instead of its name.** Since
  the Phase 5b identity split, `asset.id` is the opaque
  `crypto.randomUUID()` reference key, but `ImpactCell` still rendered it
  directly as the chip label — every chip in the Threats table showed a
  UUID instead of a readable asset label. `AssetReference` gained
  `displayId` and `description` (populated in
  `buildAssetDataReference` from `a.displayId` / `a.properties?.description
  ?? ""`); the chip label now uses `asset.name`, and the tooltip header
  switches from `{id} — {name}` to `{displayId}: {name}` with the asset
  description appended below it.
- **EN 50742 exposure level silently dropped for data-flow threats.** The
  Risk tab showed no exposure level even though the DFD had it set on the
  connection, due to two anchor-resolution gaps in series:
  1. `resolveAnchorProperties` only looked `linkedElement.elementId` up in
     `dfd.elements`, but a per-element STRIDE anchor on a DataFlow carries
     the *connection* id with `elementType: "DataFlow"`, which lives in
     `dfd.connections`. DataFlow-typed anchors are now resolved against
     connections, with a defensive elements-to-connections fallback for
     older data lacking `elementType`.
  2. `extractThreatReferences` built the `ThreatReferences` feeding the
     Risk dialog and sync without copying `linkedElement`/`dataFlow` onto
     them, leaving the EL adapter with an anchorless reference. Both are
     now populated on the reference.

  Verified end-to-end against `Simple_Test_Project`: DF-3 (EL3) → rating
  4, DF-4 (EL1) → rating 2, both `source: "derived"`. AP/SRSL still
  require a rated attacker capability (and, for SRSL, a resolvable asset
  severity) as designed. Also updates
  `en-50742-approach-a-design.md` §11.1 (two-anchor → three-anchor model)
  and extends `en50742-exposure-level-adapter.test.ts` with DataFlow-anchor
  regression cases (17/17 green).

---

Full commit range: `v0.8.7-alpha..v0.8.8-alpha` (3 commits)

---

## [0.8.7-alpha] - 2026-09-01

### Added
- **Asset identity: UUID + readable displayId (Phase 5b).** Feature-store
  assets now mint a stable, opaque `crypto.randomUUID()` as `id` — the
  reference key every relation points at — plus a regenerable, human-readable
  `displayId` (e.g. `DA-001`), mirroring the existing Threat identity model.
  On a group change (`data` → `system`, etc.) only `displayId` is
  regenerated; the stable `id` keeps every existing relation resolvable.
  `migrate_5_to_6` rewrites every readable asset id to a UUID and repoints
  all foreign keys (`assetId` / `sourceAssetId` / `targetAssetId` /
  `linkedAssetIds` / `assetIds`) across the project in one idempotent pass.
  Bumps schema version 5 → 6.
- **Single canonical asset store (Phase 5c).** `dfd.assets` is no longer a
  second persisted store: it is now a runtime projection of the canonical
  feature store (`project.assets`), re-derived on load (`commitAssetSync`)
  and emptied on save (`prepareForDisk`). `migrate_5_to_6` drops the
  `dfd.assets` mirror instead of remapping it. This removes the structural
  source of asset drift between the DFD canvas and the Asset tab.
- **Canonical flat `AssetProperties` (Phase 4).** A single shared property
  schema now backs both `Asset.properties` (Asset tab) and
  `DFDAsset.properties` (DFD canvas), replacing two independently-typed
  shapes. Property edits on the DFD canvas now flow through to the feature
  store via sync instead of being silently dropped.
- Manual (`source: "manual"`) threats are now preserved across "Regenerate
  Threats" and "Delete All Threats" unless the analyst explicitly opts in to
  deleting them (new confirmation-dialog checkbox, default off).

### Fixed
- **Asset `assetGroup` drift on group change.** Relation *types* are
  group-bound (`creates`/`reads` are data relations, `uses`/`depends_on` are
  system relations); a group change could leave relations of the old
  family attached to an asset of the new group, with a stale cached
  `assetGroup` on the relation. `updateAsset` now keeps only relations whose
  type is valid for the new group and updates their cached `assetGroup` to
  match, so it can no longer drift. Existing projects with already-drifted
  relations are not retroactively repaired — the fix applies on the next
  group change.
- **Analyst edits silently lost on full threat regeneration.** Regeneration
  rebuilt every threat from scratch with no lookup against the previous
  table, dropping analyst-owned fields (relevance, workflow status,
  evaluation notes, threat actor, customised text, mitigation/verification
  notes) on every run — up to ~470 records in one reported case. A
  natural-key merge pass now overlays analyst-owned fields from the
  predecessor threat onto each freshly generated one, while system-derived
  fields are recomputed from the current graph.
- **Phantom sync drift on un-migrated / legacy threat data.** Drift
  detection compared `threat.displayId` directly, flagging any threat
  without a `displayId` (legacy v4 data, minimal test doubles) as drifted
  even when nothing had changed. Comparison now falls back to `id` when
  `displayId` is absent.
- **Interface security controls rendered as N/A in generated reports.** The
  doc mapper read interface controls from the top level instead of
  `properties.implementedControls`, so every value showed as missing.
  Free-text fields (owner, notes, …) were also incorrectly run through
  enum-option translation, risking mistranslation of values that happened
  to match an enum token.
- **Reports showed raw UUIDs instead of display labels.** After the
  threat/risk identity split, generated reports rendered `threat.id`
  (UUID) instead of `threat.displayId` in every text/PDF format. Report
  tables and cross-reference anchors now use the display labels again.
- `verify:fixtures` script crashed at load after `canonicalStringify` was
  moved out of `prepare-for-disk` into `tcs-serialize`; import path fixed.
- Missing i18n keys (`safetyAnnotation.impact`, `.physicalHazardPotential`,
  `.rationale.label/placeholder`, EN + DE) for the asset-relation selector.

### Changed
- `dfd.assets` on disk is now always empty; consumers reading assets should
  use `project.assets` (the feature store) as the single source of truth.
- Removed a dead, never-wired `onAssetFeatureUpdate` double-write path in
  the DFD asset panel chain (properties already reach the feature store via
  sync since Phase 4b-iii).
- Renamed asset-view DFD reference types (`DFDAssetReference` /
  `DFDElementReference` / `DFDConnectionReference` →
  `AssetDFDAsset` / `AssetDFDElement` / `AssetDFDConnection`) to resolve a
  name collision with the unrelated shared graph-analysis types of the same
  name. Pure rename, no behaviour change.

---

Full commit range: `v0.8.6-alpha..v0.8.7-alpha` (24 commits)