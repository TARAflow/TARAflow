# TARAflow

### Threat Analysis and Risk Assessment for Cybersecurity and Safety

TARAflow is a desktop-based Threat Analysis and Risk Assessment (TARA) tool for structured security and safety analysis of complex systems.

It combines **Data Flow Diagrams (DFDs)**, asset analysis, threat generation, risk assessment, attack trees, safety analysis, documentation, and an auditable Git-based workflow in a single application.

> **Current version:** `v0.15.2-beta`

TARAflow is currently under active development. The `0.x` version series is a beta: the features are complete enough for real projects, but interfaces and the project format may still change between releases; older project files are migrated when they are opened.

---

## Overview

TARAflow's core concept is a **model-driven, relationship-based TARA workflow**: DFD elements, assets, threats, risks, and attack paths are not isolated artifacts but explicitly linked parts of one evolving analysis model. The DFD is specifically extended for **embedded and automotive systems**, enabling the analysis of threats based on system elements, communication protocols, interfaces, and their context.

TARAflow also follows a **closed-loop approach** that connects the security analysis with the actual engineering process. Mitigations can be tracked through Jira, and when a mitigation ticket is closed, TARAflow can notify the affected risk and DFD context, allowing engineers to review and update the system model and propagate the resulting changes through the analysis. This creates a traceable feedback loop between **system modeling, security analysis, mitigation, and implementation**.

The application supports both **security-oriented TARA workflows** and **safety-related analysis**, making it particularly suitable for **automotive and embedded systems** where cybersecurity and safety considerations need to be analyzed together.

---

## Key Features

### Data Flow Diagrams

TARAflow provides an interactive DFD modeling environment based on draw.io.

Supported modeling concepts include:

* Processes
* Data Stores
* Data Flows
* Interfaces
* External Entities
* Trust Boundaries
* Multiprocess elements
* Chip Boundaries
* Physical Boundaries
* Structured element properties
* Protocol and communication metadata
* Security and contextual properties
* Validation and consistency checks
* Asset relationships, restricted to the relation types the element rules allow
* **Leveled DFDs:** one project can hold several draw.io pages — a top-level diagram plus child pages that decompose individual multiprocesses. Elements keep one identity across pages (definitions and context copies), are numbered hierarchically (`P-2.1` under `MP-2`), and flows drawn on a parent level are resolved to the parts that actually handle them. One element namespace, one asset register, one threat and risk register for the whole project.

Three views of the same model: the **diagram**, a **description** view with one accordion per element, and the **asset graph**.

The DFD model acts as the foundation for subsequent security analysis.

---

### Asset Graph

The asset graph shows how assets relate to each other across layers — chains such as Data → Function → System, or which function a process invokes in which step — that a list per asset hides.

* Layer view: one lane per vertical layer (data → function → system → infrastructure), process, service, physical, human and environment in a side column; presets and a custom layer choice
* Focus view around one asset (depth 1–3), including the DFD elements that relate to it
* Links to hidden layers shown as counters on the node; relation type filter and search that explains why a hit is not visible
* Detail cards for assets and links; "Show in graph" from the asset table and "Show in table" back
* Edit mode: connect assets by dragging, with every target marked as valid, reverse-only or not allowed and a type chooser that offers only allowed types; create and delete assets; edit link attributes and asset properties; relate DFD elements to assets; undo / redo
* Hazard items as read-only nodes with their `contributes_to` and `endangers` edges (severity as label), also as neighbours in the focus view; "Open in Hazard tab" from the card
* Moving nodes as in draw.io: drag a node to move it (along its lane; side-column nodes snap to a row, including a free row above the top lane), Ctrl / ⌘ + drag pans
* Stable layout — nodes move only when you drag them or on "Rearrange"; positions are remembered locally per project, never in the project file
* Keyboard operation (Tab / arrow keys, Enter, Delete, Esc)

---

### Asset Analysis

Assets can be modeled and associated with DFD elements.

TARAflow supports:

* CIANAAA security goals (Confidentiality, Integrity, Availability, Non-repudiation, Authentication, Authorization, Accountability)
* Goals derived from the DFD relations and the asset impact, with the reason shown for every goal and level
* Analyst decisions per goal — adjust, add or exclude — always with a rationale; the suggestion a decision was made against is recorded, so a later change of its basis is flagged for review
* Impact per security goal (e.g. a lower safety impact for integrity than for availability), capped by the asset's damage potential
* Findings panel below the asset table (errors, warnings, infos) that opens the asset where a finding is fixed, and a "Needs review only" filter
* Threat ↔ goal cross-checks: threats that violate no active goal, goals no threat violates, and the number of threats per goal
* Impact assessment, safety impact, asset categorization
* Asset-to-DFD synchronization and asset relationship management
* Asset links (asset-to-asset relations) stored in the project, shown in the asset table and the asset dialog, read from the listed asset; findings for links the rules no longer allow
* Asset export / import with asset links; the import adds assets and asks per asset whether an asset already in the project is kept or replaced
* Project-wide asset deletion (DFD, hazards, risks)

Changes to the underlying DFD can be reflected in the corresponding asset model.

---

### Threat Analysis

TARAflow provides automated and semi-automated threat generation based on the system model.

The threat analysis includes:

* STRIDE-based threat analysis
* STRIDE per element
* STRIDE per interaction
* Context-aware threat generation
* Protocol-specific threat matching
* Element-specific threat generation
* Threat catalogs and templates
* Threat categorization
* Threat-to-asset relationships
* Threat synchronization with the DFD
* Manual threat creation
* Threat mitigation information
* Controls proposed per attack path by its attack vector (network / adjacent / local / physical) and the project context (domain, platform); 20 additional catalog controls for networks, access control, Linux hardening, in-vehicle communication and operations
* Relevance-based filtering (unrated / relevant / uncertain / not relevant)
* A STRIDE category is generated only if it is technically possible for the element **and** violates an active security goal
* Generation drift detection: threats the current rules no longer produce are shown in a banner and on the phase tab, and are kept (marked as retained, with undo) or removed explicitly — never silently
* Reconciliation before regenerating: the dialog lists new, unchanged, changed and obsolete threats; a threat whose references changed keeps its rating but is flagged for review
* Leveled DFDs: threat tables grouped per decomposed multiprocess, filter by page and analysis state; a flow between two multiprocesses belongs to the side it attacks

Threat generation uses contextual information from the modeled system instead of relying exclusively on a flat list of generic threats.

---

### Risk Assessment

TARAflow provides integrated risk assessment based on identified threats and their potential impact.

Features include:

* Likelihood assessment
* Impact assessment
* Risk matrices
* Risk scoring
* Severity evaluation
* Assessment rationale
* Mitigation tracking
* Risk treatment
* Risk synchronization with threats and attack paths
* Before/after mitigation assessment
* EN 50742 Approach A — Security Requirement Severity Level (SRSL), as a parallel output to R = L × I
* Mandated EN 50742 §7.4.3 controls surfaced in the mitigation picker and reports
* Risk-level filtering (Critical / High / Medium / Low)
* Risk impact from the security goals the threat violates, including per-goal impact
* Impact aggregation per regulation preset — **harm floor** (safety, physical damage and environment are never diluted by milder consequences), **maximum** (ISO/SAE 21434, ETSI TVRA) or weighted mean — switchable with a preview of every changed risk
* Asset criterion weights as the default for the impact weights, overridable per factor
* Explanation of how a risk's impact was formed, in the risk dialog and the report
* ISO/SAE 21434: risk value 1–5 from the matrix of Annex H.8 (Minimal … Critical), threat scenarios per attack tree and a review list of treatment decisions
* Likelihood factor levels named by the situation they stand for (e.g. "4 – No technical skills"); ETSI TVRA factors with the norm's levels (e.g. "≤ 1 week (2)")
* Leveled DFDs: risks grouped per decomposed multiprocess, a risk matrix per DFD group

Risk information remains connected to the underlying threat and asset models.

---

### Attack Trees

TARAflow supports attack-tree-based analysis for modeling how an attacker can achieve a specific goal.

Features include:

* Attack tree creation and editing
* Threat-anchored attack trees
* Attack paths
* Attack-potential evaluation
* Feasibility assessment
* Attack-path synchronization
* Integration of attack paths with threats and risks
* Attack vector `av=network|adjacent|local|physical` on any node (ISO/SAE 21434 G.9), inherited down the tree; it selects fitting controls and leaves attack potential and feasibility unchanged
* Visualization and structured editing

Attack-tree information can be used as an additional input to the risk analysis.

---

### Safety and Hazard Analysis

TARAflow also contains functionality for safety-oriented analysis.

The safety workflow includes:

* Hazard identification
* BowTie-based hazard analysis
* Safety-related assets and impacts
* Hazard management
* Safety-related project configuration
* Integration of safety information into the broader project model
* Two modeling paths: a **safety annotation** on an element→asset relation for a single cause, or a **hazard item** for combined causes (ANY/ALL) and several protection targets
* One five-level harm scale everywhere — reversible minor/major, irreversible minor/major, fatal (IEC 62061 Se1–Se4, mappable to ISO 26262 S1–S3 and EN 50742)
* An asset's safety rating is the worse of its annotations and hazard items (a justified manual override wins); rating an asset through both paths raises a warning
* Safety Override Rule: direct relevance with irreversible-major or fatal harm makes the asset CRITICAL, independent of business impact
* Import of EN ISO 12100 / EN ISO 13849-1 risk assessments from spreadsheets: severity on the five-level scale with a value-map editor, default affected persons, lifecycle phase, hazard zone, protective measures and their type, risk graph S/F/P, PLr and PL, safety function; the customer's rating (probability, RPN, source values) is kept; a warning when the severity contradicts the risk graph
* Import profiles stored in the project; a re-import of a revised sheet recognises the profile, follows moved or renamed columns and reconciles the rows (new / changed / unchanged / removed) instead of appending them
* Hazard category suggested from the free-text hazard type (German and English keywords)

Rationale, rules and code locations: [`doc/taraflow-safety-model.md`](doc/taraflow-safety-model.md).

Safety analysis can be enabled as part of a project's workflow.

---

## Audit Trail and Git Integration

One of the major features introduced in the recent development versions is the integration of TARAflow with Git.

TARAflow can associate project changes with a Git repository and maintain an auditable history of analysis changes.

The audit functionality includes:

* Git repository discovery
* Canonical project serialization
* Signed commits
* Authorized signer management
* Signer manifests
* Protected-branch configuration
* Commit signing
* Managed Git hooks
* Commit author verification
* Offline/local commit handling
* Audit trail verification
* Classified DFD diff in the commit dialog — semantic, graphical, structural and identity changes per page, plus the effect of a change on the analysis (e.g. a flow now resolved below a multiprocess)

This makes it possible to use Git not only for source-code versioning but also as part of the **traceability and integrity model of the security analysis itself**.

---

## Audit Verification Engine

TARAflow includes the **Audit Verification Engine (AVE)** for verifying the integrity of the audit trail.

The verification system provides:

* Verification of the audit history
* Signed-commit verification
* Signer authorization checks
* Commit-chain validation
* Detection of unauthorized authors
* Verification of audit metadata
* Machine-readable verification functionality
* In-application verification results
* Integration tests and verification fixtures

The verification functionality is available both inside the application and through the standalone `taraflow-verify` command-line tool.

---

## Source Version Binding

TARAflow can record which **source version** a security analysis was performed against, giving version-exact traceability from the TARA to the implementation it describes — supporting EN 50742 §7.5 / §8.4 ("identification of software").

At the project level, an analyst records a source reference — a repository URL and a ref (branch, release branch, tag, or commit) — and resolves it, on demand and behind an explicit per-host network-consent prompt, to a pinned commit SHA via `git ls-remote`. On-premise and offline Git hosts are handled explicitly rather than silently failing.

Once a binding is pinned, TARAflow can **detect drift**: re-checking classifies the current state into six outcomes (in sync, branch advanced, expected release-branch advance, tag moved, ref no longer exists, or unreachable) and keeps a bounded, append-only record of every state *transition* — the evidence of whether, and when, the analysed source moved after the analysis was performed.

> Current scope: project-level bindings. Element-level bindings (a source reference per Function/Process/System asset) and the validation/coverage reporting that builds on them are planned — see `doc/Open/`.

---

## ISO/SAE 21434 Support

TARAflow's TARA pipeline and documentation generator conform to ISO/SAE 21434 end to end — an **asset-driven, attack-feasibility-based** method for road-vehicle cybersecurity engineering. The preset is selected via the project's regulation tag.

In an ISO/SAE 21434 project, threat relevance is derived from the **asset relationship**: a STRIDE per-element/per-interaction threat is relevant when it relates to an asset, and is treated as the enumeration that feeds attack-tree analysis rather than a risk in its own right. The analyst may still override relevance in the threat dialog, with a documented justification. Impact is assessed per **SFOP** (Safety, Financial, Operational, Privacy — ISO 15.5), which is mandatory and locked on both the risk and the asset side.

Attack feasibility follows **Annex G / ISO 18045**: the five attack-potential factors — elapsed time, specialist expertise, knowledge of the item, window of opportunity, equipment — sum to an attack potential that maps to a four-level feasibility band (Table G.7). Attack trees carry these factors per leaf; the resulting attack-path feasibility drives risk, and attack-path threats are enriched with the catalog's STRIDE-category mitigations and verifications.

The **risk value 1–5** (15.8) is read from the matrix of Annex H.8: impact of the damage scenario (4-level scale Negligible / Moderate / Major / Severe) × attack feasibility, shown with a word (Minimal / Low / Medium / High / Critical) instead of I × L. The attack paths of one tree form a **threat scenario**, whose value is the highest of its paths. Treatment options carry the ISO names Avoid / Reduce / Share / Retain (15.9); a review list names Retain at a high value and Reduce at value 1. The report documents the method in a **methodology chapter** generated from the project's configuration, and every ISO risk records the calculation it was computed with.

> Current scope: a structured (dropdown-based) leaf editor for the attack-tree DSL, and generating starter attack trees from confirmed threats, are planned — see the post-release backlog.

---

## Command-Line Tools

TARAflow contains standalone command-line functionality in addition to the desktop application.

### TARAflow Report

`taraflow-report` generates project documentation directly from a `.tara.json` project file.

It can be used without starting the UI or Electron application and is therefore suitable for automation and CI/CD pipelines.

Supported output formats include:

* Markdown
* AsciiDoc
* HTML
* PDF
* StrictDoc

Example:

```bash
taraflow-report project.tara.json \
  --format pdf \
  --lang de \
  --out report.pdf
```

Available options include:

```text
--format     Output format
--lang       Output language (en/de)
--out        Output file
--chapters   Select specific documentation chapters
```

The report generator can also be built as a standalone bundle.

```bash
npm run build:cli
```

A Debian package can be generated with:

```bash
npm run package:cli:deb
```

---

### TARAflow Verify

`taraflow-verify` is the command-line verification tool for the TARAflow audit trail.

It provides a way to verify audit information independently of the graphical application.

During development it can be executed with:

```bash
npm run verify:cli
```

The standalone verifier can be built with:

```bash
npm run build:cli:verify
```

A Debian package can be generated with:

```bash
npm run package:cli:verify:deb
```

---

## Documentation

TARAflow contains an integrated documentation generator.

Documentation can be generated from the project model and configured according to the project's documentation settings.

The documentation workflow supports:

* Configurable chapters
* Multiple output formats
* English and German output
* Project information
* DFD information
* Assets
* Threats
* Risks
* Analysis results
* Other project-specific analysis information
* Leveled DFDs: one DFD section per page with its figure and element table, the flows analysed on a parent level, and threat and risk tables grouped like the app

The same reporting functionality can be used through the graphical application and the `taraflow-report` CLI.

---

## Method and Model Documentation

Background on the analysis model behind TARAflow, for readers who want to understand how relationships, threats and ratings come about:

* [TARAflow method](https://taraflow.github.io/method.html) — overview of the method
* [Safety model](doc/taraflow-safety-model.md) — how harm to persons is modeled (safety annotations and Hazard Items), the 5-level harm scale, the Safety Override Rule and where safety acts in the analysis
* [Asset relationships](doc/taraflow-asset-relations.md) ([Deutsch](doc/taraflow-asset-beziehungen.md)) — the active-impact model: which relationship a DFD element may have to which asset category, and what it means for threat generation
* [Asset-to-asset relationships](doc/taraflow-asset-to-asset-relations.md) ([Deutsch](doc/taraflow-asset-zu-asset-beziehungen.md)) — direct relationships between assets, the core set and the domain catalogs

---

## Internationalization

TARAflow supports multiple languages.

The application currently provides English and German localization for the user interface and generated documentation.

Internationalized content includes, among other things:

* Application UI
* Dialogs
* Validation messages
* Threat and mitigation information
* Documentation
* Configuration
* Audit-related UI

---

## Architecture

TARAflow is implemented as a TypeScript application using React and Electron.

The main technologies include:

* **TypeScript**
* **React**
* **Electron**
* **Vite**
* **Material UI**
* **draw.io**
* **Vitest**
* **i18next**
* **CodeMirror**
* **D3**
* **esbuild**
* **Electron Builder**

The application separates the browser/UI part from Electron-specific functionality and provides dedicated command-line entry points for reporting and audit verification.

The repository currently contains, among others:

```text
src/
├── app/
├── features/
├── shared/
└── i18n/

electron/

taraflow-reporter/
└── ...

taraflow-verifier/
└── ...

scripts/
build-resources/
doc/
.github/workflows/
```

---

## Requirements

The current project configuration requires:

* **Node.js 24.x**
* npm
* Git

The required Node.js version is currently defined in `package.json` as:

```text
>=24 <25
```

A working Git installation is required for the Git-integrated audit functionality.

---

## Installation

Clone the repository:

```bash
git clone https://github.com/TARAflow/TARAflow.git
cd TARAflow
```

Install dependencies:

```bash
npm install
```

Installation only needs the npm registry — no third-party CDN. The one dependency that is not published there, SheetJS (`xlsx`), is vendored as its official release tarball under [`vendor/`](vendor/README.md); a `preinstall` check verifies it against the integrity recorded in `package-lock.json`.

---

## Development

### Web development server

Start the Vite development server with:

```bash
npm run dev
```

The development server is provided by Vite.

### Electron development

To start the desktop application in development mode:

```bash
npm run dev:electron
```

This builds the Electron-side code and starts the Vite development server together with Electron.

---

## Building

### Web application

```bash
npm run build
```

### Electron application

```bash
npm run build:electron
```

The Electron build is configured for the following platforms:

* Linux

  * AppImage
  * Debian package
* Windows

  * NSIS installer
* macOS

  * DMG

For a clean Electron build:

```bash
npm run build:electron:clean
```

Build artifacts are written to the configured release/output directories.

---

## Testing

TARAflow uses **Vitest** for automated testing.

Run the test suite with:

```bash
npm test -- --run
```

Component tests and integration tests use dedicated Vitest configurations:

```bash
npm run test:component
npm run test:integration
```

Requirement tests check the requirements of the design documents end to end through the real services (one test per requirement, see `src/tests/requirements/README.md`):

```bash
npm run test:requirements
```

The example projects in [TARAflow_Examples](https://github.com/TARAflow/TARAflow_Examples) (Simple Controller) are generated from `src/tests/examples` and checked by the same suite.

The repository contains unit, component, requirement, and integration tests covering application functionality as well as CLI and audit-related functionality.

---

## Project Files

TARAflow projects are stored using the `.tara.json` format.

The project format contains the information required to reconstruct and analyze a TARAflow project, including relevant:

* Project metadata
* DFD information
* Assets
* Threats
* Risks
* Attack-tree information
* Safety information
* Documentation configuration
* Audit-related configuration

Project serialization is designed to provide stable, reproducible project data suitable for version control.

The file carries a schema version. Opening a project saved with an older schema asks before it is converted and names the change per schema step; a backup of the original file is written alongside it first. Loading the project list never converts a file. A converted project cannot be opened again by an older TARAflow version (current schema: **10**, since `v0.15.0-beta`).

View state such as the positions in the asset graph is not part of the project file.

---

## Git-Based Workflow

A typical workflow can look like this:

```text
Create / Import Project
        │
        ▼
Data Flow Diagram
        │
        ├──► Assets
        │
        ├──► Threat Analysis
        │        │
        │        ▼
        │      Risks
        │
        ├──► Attack Trees
        │
        └──► Safety / Hazards
                 │
                 ▼
          Documentation
                 │
                 ▼
            Git / Audit
                 │
                 ▼
       Signed Commit History
                 │
                 ▼
        Audit Verification
```

A detailed version of this workflow is available as a diagram in [`doc/TARAflow-Workflow.png`](doc/TARAflow-Workflow.png) (source: `doc/TARAflow-Workflow.drawio`).

The purpose of this workflow is to keep the different analysis artifacts connected rather than treating the DFD, threat model, risk assessment, and documentation as independent documents.

---

## Releases

TARAflow is currently in the beta development phase.

Recent development versions include:

* `v0.8.x-alpha`
* `v0.9.0-alpha`
* `v0.10.0-alpha` — Source Version Binding
* `v0.11.0-alpha` — ISO/SAE 21434 support
* `v0.11.1-alpha` — identity and label integrity, DFD thumbnail fixes
* `v0.11.2-alpha` — dependency and supply-chain hardening
* `v0.12.0-alpha` — security-goal rework, risk impact aggregation, threat generation drift
* `v0.13.3-alpha` — asset graph with edit mode, persistent asset-to-asset relations (schema 8)
* `v0.13.4-alpha` — dependency security update, enclosure and interface threat fixes, DFD editor fixes
* `v0.14.0-beta` — leveled DFDs (several pages per project), five-level safety scale and worst-of safety rating (schema 9)
* `v0.15.0-beta` — ISO/SAE 21434 risk value 1–5, threat scenarios and methodology chapter; attack-tree likelihood on the project's risk scale (schema 10)
* `v0.15.1-beta` — hazard import for ISO 12100 / 13849 risk assessments with re-import, controls by attack vector, hazard items and node moving in the asset graph
* `v0.15.2-beta` — security fix: issue-tracker tokens (Jira, Azure DevOps) are kept in the OS keychain and never written into the project file

The current development state is represented by:

```text
v0.15.2-beta
```

Versions in the beta: releases without a new project schema count the patch number (`0.15.1-beta`, `0.15.2-beta`, …), a release with a new project schema raises the minor version — no extra pre-release counter.

See [`CHANGELOG.md`](CHANGELOG.md) for details.

Because the project is still in the `0.x` series, interfaces, project formats, and internal APIs may change between releases.

---

## Known Limitations

TARAflow is still under active development.

In particular:

* The application is a beta release.
* Some functionality may still change substantially.
* Project formats may evolve between versions.
* Not all workflows have reached a final stable state.
* Cross-platform behavior may differ depending on the operating system and environment.
* The Git/audit functionality assumes a correctly configured Git repository and signing setup.

---

## Contributing

Contributions, bug reports, and feature suggestions are welcome.

Before making larger changes, please consider opening an issue or discussing the proposed change with the project maintainers.

When contributing code, please ensure that:

1. The project builds successfully.
2. Relevant tests pass.
3. New functionality is covered by appropriate tests where practical.
4. Changes to the project format are handled with care.
5. User-facing strings are properly internationalized.
6. Security- and audit-related changes receive particular attention.

---

## License

TARAflow is licensed under the **GNU General Public License v3.0 or later (GPL-3.0-or-later)**.

See [`LICENSE`](LICENSE) for the full license text.

---

## Repository

Source code and development history are available on GitHub:

https://github.com/TARAflow/TARAflow

---

## Status

**TARAflow 0.15.2-beta**

TARAflow is an actively developed threat analysis and risk assessment platform combining:

**System Modeling → Asset Analysis → Threat Analysis → Risk Assessment → Attack Trees → Safety Analysis → Documentation → Auditable Git History**

The project is currently focused on extending the analysis capabilities while improving traceability, reproducibility, verification, and integration with engineering workflows.
