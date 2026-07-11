# TARAflow 0.6.0 alpha
### A Semi-automated Threat Modeling Tool for threat analysis and risk assesment

## Description
This project is a web application that allows users to either import existing models or create new ones. Users can upload a .JSON containing a model, which is then parsed and displayed if the parsing is successful. The application also provides functionalities to analyze diagrams and manage threat tables.

## Features
- Import existing models from JSON files.
- Create new models.
- Parse and validate uploaded models.
- Display diagrams, overview table and threat tables.
- Analyze diagrams for dataflows crossing trust boundaries.
- Manage and save threat tables.
- Export threat tables to JSON files.
- Headless report generation (Markdown, AsciiDoc, HTML, PDF, StrictDoc) via the `taraflow-report` CLI — no UI, no Electron. See [TARAflow Report (CLI)](#taraflow-report-cli) below.


## Technologies
- **Language**: TypeScript
- **Frameworks**: React, Material-UI

## Installation
1. **Clone the repository**:
    ```bash
    git https://github.com/mirovv/CoReTM-2.0.git
    cd CoReTM-2.0
    ```

2. **Install dependencies**:
    ```bash
    npm install
    ```

3. **Start the development server**:
    ```bash
    npm start / npm dev start
    ```
   **Note**: The application should now be running on [http://localhost:3000](http://localhost:3000).

4. **Build the project**:
    ```bash
    npm run build
    ```

5. **Eject the project**:
    ```bash
    npm run eject
    ```
    **Note**: This is a one-way operation. Once you eject, you can't go back!
   
6. **Build electron**:
	 npx tsc -p tsconfig.electron.json
 	 node scripts/rename-to-cjs.js
	 npm run dev:electron


## Usage
1. **Importing a Model**:
    - Navigate to the Import page.
    - Upload a JSON file containing the model.
    - If the parsing is successful, you will be redirected to the Model page where the model is displayed.
    - Continue with the analysis or change the model.
    - Export the threat model to a JSON.

2. **Creating a New Model**:
    - Navigate to the Create page.
    - Provide the necessary details to create a new model.
    - Save the model and proceed with the analysis.
    - Export the threat model to a JSON.

---

## TARAflow Report (CLI)

`taraflow-report` generates the same documentation the Documentation tab produces in the desktop app — Markdown, AsciiDoc, HTML, PDF, or StrictDoc — directly from a `.tara.json` file, with no UI and no Electron. Built for CI/CD pipelines (Jenkins, GitHub Actions) and Docker/Podman containers where launching the desktop app isn't practical.

All CLI source lives under `taraflow-reporter/` (application code in `taraflow-reporter/cli/` + `taraflow-reporter/taraflow-report.ts`, packaging in `taraflow-reporter/packaging/`, deployment scripts in `taraflow-reporter/scripts/`, tests in `taraflow-reporter/tests/`).

### Usage

```bash
taraflow-report <project.tara.json> --format <markdown|asciidoc|html|pdf|strictdoc> [--lang en|de] [--out <path>] [--chapters <id1,id2,...>]
```

- `--format` (required): output format. All five formats are supported, including PDF (via `pdfmake`'s Node API — no headless browser, no Puppeteer).
- `--lang`: overrides the document language stored in the project (`documentation.configuration.language`).
- `--out`: output file path. Defaults to `<input-basename>.<extension>` next to the input file.
- `--chapters`: comma-separated chapter IDs to include; all others are disabled. Defaults to the project's saved chapter configuration.

Example:
```bash
taraflow-report project.tara.json --format pdf --lang de --out report.pdf
```

### Development

```bash
npm run report:cli -- <project.tara.json> --format markdown --out test.md
```
Runs the CLI directly via `tsx` (no build step) against `tsconfig.cli.json`.

### Building the standalone bundle

```bash
npm run build:cli
```
Bundles `taraflow-reporter/taraflow-report.ts` (and everything it imports, including `pdfmake`, `i18next`, `asciidoctor`) into a single `dist-cli/taraflow-report.js` via esbuild.

### Packaging as a Debian package

```bash
npm run package:cli:deb
sudo apt install ./release/tara-report_<version>_amd64.deb
```
Produces `tara-report_<version>_amd64.deb`, installing `taraflow-report` to `/usr/bin`. Depends on `nodejs` (installed automatically by `apt` if missing). Requires [`nfpm`](https://nfpm.goreleaser.com/) (`npm install -g @goreleaser/nfpm`) — a `dpkg-deb`-only alternative is available at `taraflow-reporter/packaging/build-deb.sh` if you'd rather not install `nfpm`.

### Tests

```bash
npm test -- --run
```
Runs the full suite, including `taraflow-reporter/tests/{unit,component,integration}`.

## Known Issues
1. **Browser**:
    - This tool was developed using Google Chrome browser.
    - Functionality and compatibility with other browsers is not guaranteed.