# TARAflow CLI Report — Umsetzungsplan

Headless Report-Generierung aus `.tara.json` ohne Projekt-Load in der UI, ohne
Electron, CI-fähig. Alle Phasen sind so geschnitten, dass die UI-App zu **keinem
Zeitpunkt** beeinträchtigt wird.

---

## 1. Architektur-Prinzip

Es gibt **keine Runtime-Weiche** in `main.tsx`/`app.tsx`. Die Trennung passiert
auf **Entry-Point-Ebene** — zwei unabhängige Einstiegspunkte, die sich nur die
reine Generierungs-Logik teilen:

```
main.tsx                 → Renderer (Electron/Browser-Fenster)  ─┐
bin/taraflow-report.ts   → CLI (nacktes Node)                   ─┴→ teilen NUR den pure core
```

Der "pure core" ist der Generierungs-Pfad:

```
features/documentation/
  models/doc-types.ts                 (rein: Typen + Helper)
  utils/doc-generator.ts              (Factory — UI-Pfad, inkl. PDF)
  utils/generators/
    base-generator.ts                 (rein NACH Phase 1)
    markdown|asciidoc|html|strictdoc-generator.ts   (rein)
    pdf-generator-renderer.ts         (UNREIN — window/IPC, NUR UI)
  utils/property-doc-mappers.ts       (rein, braucht i18n-Singleton)
  utils/templates/**                  (rein)
```

### Die Invariante (Purity Boundary)

> Kein Modul im Generierungs-Pfad darf einen **Feature-Barrel**
> (`features/*/index.ts`), `react`, `react-dom`, `@mui/*`, draw.io oder ein
> Modul mit Top-Level-`window`/`document` importieren.

Diese Invariante wird in Phase 0 als Lint-Regel verankert und in Phase 7 in CI
durchgesetzt. Solange sie hält, ist die CLI build-bar und die UI bleibt
unberührt.

---

## 2. Was explizit NICHT angefasst wird

Diese Files bleiben über alle Phasen unverändert — das ist die UI-Sicherheits-Garantie:

- `main.tsx`, `app.tsx` (Renderer-Entry, ReactDOM, MUI)
- `use-document-generation.ts` und alle Hooks/Components der Features
- `utils/pdf-helpers.ts`, `pdf-generator-renderer.ts` (Renderer-PDF-Pfad)
- `utils/doc-generator.ts` als **UI-Factory** (CLI bekommt eine eigene Factory)
- Vite-/Electron-Build-Config des Renderers

Phase 1 ändert nur **Import-Specifier** im Generierungs-Pfad (Barrel → Deep-Path).
Das ist laufzeit-identisch: der Renderer löst exakt dieselben Funktionen auf wie
vorher. Alles andere ist rein **additiv** (neue Files unter `bin/` und `cli/`).

---

## 3. Ziel-Verzeichnislayout (additiv)

```
bin/
  taraflow-report.ts          # CLI-Entry, arg parsing, Orchestrierung
cli/
  i18n-node.ts                # i18n-Singleton in Node initialisieren
  load-project.ts             # .tara.json lesen + Schema-Migrationen
  to-doc-project-data.ts      # Project → DocProjectData Mapper
features/documentation/utils/generators/
  cli-generators.ts           # CLI-Factory (NUR md/adoc/html/strictdoc)
tools/
  depcruise-doc.cjs           # dependency-cruiser Regel für die Purity Boundary
```

---

## 4. Phasen

### Phase 0 — Baseline & Guardrail (keine Verhaltensänderung)

**Ziel:** Den aktuellen Verstoss messbar machen, bevor irgendwas refactored wird.

**Schritte:**
1. `npm i -D dependency-cruiser` (oder `madge`).
2. Import-Graph ab `utils/generators/base-generator.ts` erzeugen:
   `npx depcruise features/documentation/utils --output-type dot`.
3. Regel in `tools/depcruise-doc.cjs` definieren — verboten im Pfad
   `features/documentation/(utils|models)/**`:
   - Import von `features/*/index` (Barrel)
   - Import von `react`, `react-dom`, `@mui/*`
   - Import eines Moduls mit Top-Level-`window`/`document`
   - **Erlaubt:** `import type`-Edges (werden beim Build gelöscht)
4. Regel zunächst auf `warn`, nicht `error` (Phase 0 darf nicht rot sein).

**Acceptance:** Graph liegt vor, alle Barrel-Verstösse sind enumeriert.
UI unverändert (nur Dev-Tooling).

---

### Phase 1 — Barrel-Imports im Generierungs-Pfad kappen

**Ziel:** Die Purity Boundary herstellen. Reiner Import-Pfad-Wechsel, null
Logikänderung.

**Konkrete Ersetzungen** (aus den realen Barrels verifiziert):

| Symbol | Bisher (Barrel) | Neu (Deep-Path) |
|---|---|---|
| `getSecurityLevelText`, `getTrustLevelText`, `getDFDElementTypeText`, `getDFDElementTypePluralText` | `features/dfd` | `features/dfd/models/dfd-formatters` |
| `deriveImplementationProgress` | `features/risks` | `features/risks/models/risk-mitigation-types` |
| `resolveMitigationDrafts`, `resolveVerificationDrafts` | `features/threats` | `features/threats/services/threat-catalog-service` |
| `TAG_CATEGORIES`, `flattenProjectTags`, `getRegulationTags` | `shared` | `shared/utils/<tag-categories>` (exakten Pfad verifizieren) |
| `type Asset` | `features/assets` | `features/assets/models/asset-types` |
| `type DFDElement`, `type DFDConnection`, `type DFDElementType` | `features/dfd` | `features/dfd/models/dfd-types` bzw. `dfd-element-types` |

**Betroffene Files:** `base-generator.ts`, `property-doc-mappers.ts`, sowie alle
`utils/templates/*` mit Barrel-Imports.

**Wichtig:** `property-doc-mappers.ts` importiert `import { i18n } from "i18n"`
(den konfigurierten Singleton). Das **bleibt** — es ist Node-tauglich, sobald
der Singleton initialisiert ist (Phase 3). Kein Deep-Path nötig.

**Verifikation des Threat-Service:** `threat-catalog-service.ts` muss nach dem
Deep-Import ebenfalls die Purity Boundary erfüllen (kein eigener Barrel-/window-
Import). Mit `depcruise` gegenprüfen; falls es selbst einen Barrel zieht, dort
genauso deep-importieren.

**Acceptance:**
- `npm run build` (Renderer) + App-Smoke-Test: Doku-Generierung in der UI
  identisch zu vorher.
- `depcruise` zeigt den Generierungs-Pfad frei von `react`/draw.io/Barrels.
- Regel aus Phase 0 kann auf `error` gestellt werden.

---

### Phase 2 — CLI-Generator-Factory ohne PDF

**Ziel:** Einen Generierungs-Einstieg, der `pdf-generator-renderer.ts`
(window/IPC) **nicht** in den Graph zieht.

**Schritte:**
1. `utils/generators/cli-generators.ts` anlegen — importiert die vier reinen
   Generatoren **direkt** (nicht den `generators/index.ts`-Barrel, der
   `PdfGenerator` mitschleppt):
   ```ts
   import { MarkdownGenerator } from "./markdown-generator";
   import { AsciidocGenerator } from "./asciidoc-generator";
   import { HtmlGenerator } from "./html-generator";
   import { StrictdocGenerator } from "./strictdoc-generator";
   ```
2. `createCliGenerator(project, config, t)` analog zu `createDocumentGenerator`,
   aber `case "pdf"` wirft `"PDF requires --format pdf path (Phase 6)"`.
3. `generateDocumentCli(project, config, t)` als dünner Wrapper.

**UI bleibt unberührt:** Der bestehende `doc-generator.ts` (mit PDF, über den
Barrel) wird nicht angefasst und weiter vom Hook genutzt.

**Acceptance:** `cli-generators.ts` kompiliert isoliert; `depcruise` zeigt keinen
Pfad zu `pdf-generator-renderer`. UI unverändert.

---

### Phase 3 — i18n-Singleton in Node initialisieren

**Ziel:** `i18n.getFixedT(lang, "dfd")` aus `property-doc-mappers.ts` muss in
Node Werte liefern.

**Schritte:**
1. `cli/i18n-node.ts`: dieselbe i18next-Instanz (`import "i18n"`-Modul)
   initialisieren, aber mit Node-Resource-Loading (statische JSON-Imports oder
   `i18next-fs-backend`).
2. **Alle Namespaces** registrieren, die Templates/Mappers nutzen — mindestens
   `dfd`, plus die von den Generatoren via injiziertem `t` verwendeten. Fehlt ein
   NS, erscheinen rohe Keys statt Labels.
3. Sprache aus `config.language` (Dokument-Sprache) treiben — sowohl für den
   injizierten `t` als auch für `getFixedT` im Singleton.

**Acceptance:** Node-Skript, das `getFixedT("de","dfd")("…")` auflöst, gibt
übersetzten Text zurück.

---

### Phase 4 — Node-Loader + DocProjectData-Mapper

**Ziel:** `.tara.json` (schemaVersion 2) → migrierte `Project` → `DocProjectData`,
ohne `storage-service` (der ist Electron/Browser-gekoppelt).

**Schritte:**
1. `cli/load-project.ts`:
   - `fs.readFile` + `JSON.parse`.
   - Schema-Migrationen anwenden, die die App beim Laden auch fährt —
     deep-importiert: `migrateRiskData`
     (`features/risks/models/risk-assessment-types`), `migrateAssetConfiguration`
     (`features/assets/services/asset-migration`), `migrateFactorRatings` /
     `migrateActiveFactors` (`features/risks/models/risk-factor-types`).
   - `schemaVersion` prüfen, bei Bedarf hochmigrieren.
2. `cli/to-doc-project-data.ts` — Mapping (es gibt keinen bestehenden transform;
   der Hook reicht `project` bereits in `DocProjectData`-Form durch, gebaut weiter
   oben in der Tab-Assemblierung):
   - `name ← project.info.name`
   - `lastModified ← project.info.lastModified`
   - `attackTree ← project.attackTrees` **(Plural→Singular!)**
   - `computed ←` Stub mit **leeren Maps** (nicht `undefined` — `base-generator`
     greift auf `project.computed.impactLabels.get(...)` mit `??`-Fallback zu;
     das Objekt muss existieren, die Werte sind optional).
   - Rest 1:1 (`id`, `phaseStatus`, `info`, `dfd`, `assets`, `threats`, `risks`,
     `documentation`).

**Hinweis DFD-Diagramm:** Das On-Disk-`dfd.thumbnail` ist bereits eine
base64-SVG. Reports können sie direkt einbetten — **kein headless draw.io nötig**.

**Acceptance:** Gegen `Simple_Test_Project_tara.json` entsteht ein valides
`DocProjectData`-Objekt (Typecheck grün, `attackTree` korrekt gemappt).

---

### Phase 5 — CLI-Entry + Build-Wiring

**Ziel:** `node bin/taraflow-report.js <projekt> --format markdown` schreibt einen
Report, identisch zur UI-Ausgabe.

**Schritte:**
1. `bin/taraflow-report.ts`: Arg-Parsing (`input`, `--format`, `--lang`,
   `--out`, `--chapters`), Orchestrierung:
   `loadProject → initI18nNode → toDocProjectData → generateDocumentCli → writeFile`.
   Config aus `project.documentation.configuration` als Default, per CLI-Flag
   überschreibbar; Dateiname über `getFileExtension(format)`.
2. **Build/Resolver** — der kritische Punkt für die Path-Aliase
   (`features/*`, `shared`, `i18n`):
   - `tsx` + `tsconfig-paths`, ODER
   - `esbuild --platform=node --bundle` mit Alias-Plugin, das die `tsconfig`
     `paths` spiegelt.
   - Eigene `tsconfig.cli.json` (extends Basis), damit der Renderer-Build
     unangetastet bleibt.
3. `package.json`: `"bin": { "taraflow-report": "dist-cli/taraflow-report.js" }`
   und Script `"report:cli"`. **Keine** Änderung an Renderer-Scripts/Vite-Config.

**Acceptance:** CLI erzeugt `.md`/`.adoc`/`.html`/`.sdoc`; Diff gegen UI-Ausgabe
für dasselbe Projekt ist leer (modulo Timestamp).

---

### Phase 6 — PDF in der CLI (optional, später)

**Ziel:** `--format pdf` ohne Electron, in CI.

**Schritte:**
1. `puppeteer` ist bereits Dependency (`^24.34.0`). In Node direkt nutzen:
   `HtmlGenerator` → HTML-String → `puppeteer` rendert zu PDF.
2. Den Renderer-Umweg (`createProjectWithPng` via Canvas) **nicht** nachbauen —
   die `dfd.thumbnail`-SVG direkt ins HTML einbetten, Puppeteer rasterisiert sie.
3. `cli-generators.ts` um den PDF-Pfad erweitern (eigene Node-PDF-Funktion, nicht
   `pdf-generator-renderer`).

**Acceptance:** `--format pdf` erzeugt eine PDF ohne laufenden Electron-Prozess.

---

### Phase 7 — CI-Guardrail & Smoke-Test

**Ziel:** Regression verhindern — niemand reisst die Purity Boundary versehentlich
wieder ein.

**Schritte:**
1. `depcruise`-Regel (Phase 0/1) als `error` in CI verdrahten: Build rot, sobald
   der Generierungs-Pfad einen Feature-Barrel oder `react` importiert.
2. Smoke-Test: Report aus `Simple_Test_Project_tara.json` generieren, asserten
   dass Output nicht leer ist und erwartete Kapitel-Titel enthält.
3. CLI-Bin in einem CI-Job ausführen (`report:cli` auf Fixture).

**Acceptance:** Reintroduzierter Barrel-Import lässt CI fehlschlagen; Smoke-Test
grün.

---

## 5. Gotchas / Risiken

- **`computed` darf nicht `undefined` sein** — leere `Map`s liefern, sonst NPE in
  `base-generator` bei `project.computed.impactLabels.get(...)`.
- **i18n-Namespaces unvollständig** → rohe Keys im Report. Vor Phase 5 die
  tatsächlich genutzten NS aus Templates + `property-doc-mappers` ("dfd")
  zusammentragen.
- **`threat-catalog-service` Purity** in Phase 1 gegenprüfen — falls es selbst
  einen Barrel/`window` zieht, dort deep-importieren.
- **`shared`-Deep-Path** für `TAG_CATEGORIES` etc. exakt verifizieren (der
  Kommentar in `base-generator` nennt mehrere Kandidaten).
- **`generators/index.ts`-Barrel** niemals aus der CLI importieren — er exportiert
  `PdfGenerator` aus `pdf-generator-renderer` (window/IPC). Immer die vier reinen
  Generatoren direkt.
- **`import type` ist sicher** — Type-only-Edges werden beim Build gelöscht und
  ziehen keinen Runtime-Code; die depcruise-Regel muss sie erlauben.

---

## 6. Reihenfolge / Abhängigkeiten

```
Phase 0 ─► Phase 1 ─► Phase 2 ─► Phase 4 ─► Phase 5 ─► Phase 7
                 └─► Phase 3 ──────┘            └─► Phase 6 (optional)
```

Phase 1 ist der einzige Eingriff in bestehende Files (reiner Import-Wechsel).
Alles ab Phase 2 ist additiv. MVP = Phasen 0–5 für md/adoc/html/strictdoc;
PDF (Phase 6) und CI (Phase 7) danach.
