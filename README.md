# TARAflow

### Threat Analysis and Risk Assessment for Cybersecurity and Safety

TARAflow is a desktop-based Threat Analysis and Risk Assessment (TARA) tool for structured security and safety analysis of complex systems.

It combines **Data Flow Diagrams (DFDs)**, asset analysis, threat generation, risk assessment, attack trees, safety analysis, documentation, and an auditable Git-based workflow in a single application.

> **Current version:** `v0.8.0-alpha`

TARAflow is currently under active development. The `0.x` version series should therefore be considered experimental and may contain breaking changes.

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
* Asset relationships

The DFD model acts as the foundation for subsequent security analysis.

---

### Asset Analysis

Assets can be modeled and associated with DFD elements.

TARAflow supports:

* Security goals
* CIANAAA-based protection requirements
* Confidentiality, Integrity, Availability, Authenticity and related properties
* Impact assessment
* Safety impact
* Asset categorization
* Asset-to-DFD synchronization
* Automatic derivation of security-relevant properties
* Asset relationship management

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

The same reporting functionality can be used through the graphical application and the `taraflow-report` CLI.

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
* **CodeMirror / Monaco Editor**
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

Integration tests use a dedicated Vitest configuration:

```bash
npm run test:integration
```

The repository contains unit, component, and integration tests covering application functionality as well as CLI and audit-related functionality.

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

The purpose of this workflow is to keep the different analysis artifacts connected rather than treating the DFD, threat model, risk assessment, and documentation as independent documents.

---

## Releases

TARAflow is currently in the alpha development phase.

Recent development versions include:

* `v0.6.0-alpha`
* `v0.7.0-alpha`
* `v0.7.1-alpha`
* `v0.8.0-alpha`

The current development state is represented by:

```text
v0.8.0-alpha
```

Because the project is still in the `0.x` series, interfaces, project formats, and internal APIs may change between releases.

---

## Known Limitations

TARAflow is still under active development.

In particular:

* The application is an alpha release.
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

**TARAflow 0.8.0-alpha**

TARAflow is an actively developed threat analysis and risk assessment platform combining:

**System Modeling → Asset Analysis → Threat Analysis → Risk Assessment → Attack Trees → Safety Analysis → Documentation → Auditable Git History**

The project is currently focused on extending the analysis capabilities while improving traceability, reproducibility, verification, and integration with engineering workflows.
