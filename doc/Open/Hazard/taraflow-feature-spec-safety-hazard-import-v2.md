# Feature Spec: Safety Hazard Import & Regulatory Profile

**Status:** Draft v3  
**Autor:** Jürgen Messerer  
**Datum:** 2026-05-26  
**Bereich:** Overview Feature / Project Initialization / Doc Generator

---

## Änderungshistorie

| Version | Datum | Änderung |
|---|---|---|
| v1 | 2026-05-13 | Initiale Version |
| v2 | 2026-05-26 | Abschnitt 4 vollständig überarbeitet: Column-Mapping-Flow als eigene Phase zwischen Adapter-Erkennung und Parse ergänzt. Abschnitt 5 und 6 um Column-Mapping-Dialog und Import-Preview erweitert. Offene Frage 1 (manuelles Abtippen) geschlossen. |
| v3 | 2026-05-26 | Abschnitt 3 um Safety-Annotationen auf DFD-Elementen erweitert. Neuer Abschnitt 7 (Graph Builder Integration) mit `deriveSafetyContext()`, Dual-Pfad-Logik, Impact-Ableitung und `safetyImpactPath`-Traversal. Implementierungsplan Phase 3 ergänzt. |

---

## 1. Ziel

TARAflow soll Safety-Gefährdungen strukturiert importieren und verwalten können.
Dabei stehen zwei Modi zur Verfügung:

- **Modus A – ISO 12100 Import:** Der Benutzer importiert eine bestehende FMEA/Gefährdungsliste
  aus einem externen Safety-Prozess. TARAflow referenziert diese Gefährdungen in der
  Threat-Analyse und im generierten Dokument.
- **Modus B – TARAflow-nativer Prozess:** Safety-Eigenschaften werden direkt im Graphen
  modelliert (Safety-Annotationen auf DataFlow und Asset). Der Dok-Generator beschreibt
  den verwendeten Prozess transparent.

Der Benutzer wählt den Modus bei der Projekterstellung und kann ihn nachträglich im
Overview-Tab anpassen.

---

## 2. Konzeptioneller Rahmen

### 2.1 Regulatory Profile

Ein **Regulatory Profile** konfiguriert TARAflow für einen bestimmten normativen Kontext.
Es aktiviert domänenspezifische Felder, Importmöglichkeiten und Dokumentvorlagen.

```typescript
type RegulatoryProfile =
  | 'generic_cra'   // EU Cyber Resilience Act, kein domänenspezifischer Kontext
  | 'machinery'     // Maschinenverordnung + EN 50742 + ISO 12100
  | 'medical'       // MDR + IEC 81001-5-1 + ISO 14971
  | 'automotive'    // ISO 21434
  | 'industrial'    // IEC 62443
```

Das Profil steuert:
- Welche Safety-Importfelder angeboten werden
- Welche Hazard-Kategorien im Vokabular verfügbar sind
- Welche Normreferenzen der Dok-Generator ausgibt
- Ob ISO 12100 / ISO 14971 / FMEA-Import aktiviert ist

### 2.2 Safety Analysis Mode

Unabhängig vom Profil wählt der Benutzer den Safety-Analysemodus:

```typescript
type SafetyAnalysisMode =
  | 'graph_native'  // Modus B: Safety via Graph-Annotationen
  | 'iso_import'    // Modus A: Import einer externen Gefährdungsliste
  | 'combined'      // Beide Modi aktiv, Crossreferenz möglich
```

---

## 3. Datenmodell

### 3.1 Erweiterung Project (Top-Level)

`SafetyHazardData` ist ein eigenständiger Top-Level-Knoten in `Project` –
semantisch gleichwertig zu `dfd`, `assets`, `threats`. Er gehört nicht zu
`ProjectInfoData`, weil er von mehreren Features konsumiert wird (Threats,
Assets, DFD-Elemente, Dok-Generator) und eine eigene Lebenszeit hat.

```typescript
// In project-types.ts (shared)
export interface Project {
  id: string;
  info: ProjectInfoData;        // regulatoryProfile + safetyAnalysisMode hier
  lastOpened?: string;
  currentPhase: number;
  strideMethod: StrideMethod | null;
  methodSelected: boolean;
  phaseStatus: PhaseStatusMap;
  settings: ProjectSettingsData;
  status: ProjectStatus;
  dfd: DFDData | null;
  assets: AssetData | null;
  threats: ThreatData | null;
  risks: RiskData | null;
  attackTrees: AttackTreeData | null;
  documentation: DocData | null;
  integration: IntegrationData | null;
  audit: AuditData | null;

  // NEU
  safetyHazards: SafetyHazardData | null;

  hasUnsavedChanges?: boolean;
  isOpen?: boolean;
  filePath?: string;
}

export interface SafetyHazardData {
  hazards: SafetyHazard[];
  lastImportedAt?: string;              // ISO timestamp des letzten Imports
  lastImportedFile?: string;            // Ursprünglicher Dateiname
  lastImportedProfile?: RegulatoryProfile;
  columnMapping?: PersistedColumnMapping; // NEU: gespeichertes Mapping für Re-Import
}
```

### 3.2 Erweiterung ProjectInfoData

`regulatoryProfile` und `safetyAnalysisMode` gehören zur Projektkonfiguration
und steuern UI und Dok-Generator – daher in `ProjectInfoData`.

```typescript
// In overview-types.ts
export interface ProjectInfoData {
  // ... bestehende Felder unverändert ...
  name: string;
  description: string;
  version: string;
  responsible: string;
  created: string;
  lastModified: string;
  tags: ProjectTags;
  team: string[];
  isHighImpact: boolean;

  // NEU
  regulatoryProfile: RegulatoryProfile;
  safetyAnalysisMode: SafetyAnalysisMode;
}
```

### 3.3 Erweiterung NewProjectData

```typescript
// In new-project-dialog.tsx
export interface NewProjectData {
  name: string;
  description: string;
  version: string;
  responsible: string;
  tags: ProjectTags;
  isHighImpact?: boolean;
  filePath?: string;

  // NEU
  regulatoryProfile: RegulatoryProfile;
  safetyAnalysisMode: SafetyAnalysisMode;
  // Kein initialHazardImport hier – Import erfolgt nach Projekterstellung
  // oder optional über den Import-Button im Dialog (siehe Abschnitt 5)
}
```

### 3.4 SafetyHazard – Kanonisches Datenmodell

Das interne Datenmodell ist normalisiert und FMEA-kompatibel, aber nicht
an ein spezifisches Quellformat gebunden. Adapter (siehe Abschnitt 4)
übersetzen externe Formate in dieses Modell.

```typescript
export interface SafetyHazard {
  id: string;                    // z.B. "H-01" – projektintern eindeutig
  description: string;           // "Quetschen durch unkontrollierten Roboterarm"
  hazardCategory: HazardCategory;
  severity: HazardSeverity;
  probability?: HazardProbability;
  rpn?: number;                  // Severity x Probability, optional vorberechnet
  sourceNorm?: string;           // "ISO 12100", "ISO 14971", "IEC 62061", ...
  affectedElements?: string[];   // DFD Element IDs – nach Import manuell verknüpfbar
  affectedAssets?: string[];     // Asset IDs – nach Import manuell verknüpfbar
  notes?: string;
  // Herkunfts-Metadaten für Traceability
  importedFrom?: string;         // Adapter-ID: "taraflow_json", "csv_generic", ...
  originalId?: string;           // ID im Quellformat falls abweichend
}

export type HazardSeverity =
  | 'negligible'     // Kein Personenschaden
  | 'marginal'       // Leichte, reversible Verletzung
  | 'critical'       // Schwere, irreversible Verletzung
  | 'catastrophic';  // Tod oder mehrere Schwerverletzte

export type HazardProbability =
  | 'very_low'
  | 'low'
  | 'medium'
  | 'high'
  | 'very_high';
```


### 3.5 Safety-Annotationen auf DFD-Elementen (Modus B / Combined)

Für den graph-nativen Modus werden bestehende DFD-Typen um Safety-Felder erweitert.
Diese Felder sind unabhängig vom Hazard-Import und können immer gesetzt werden.

```typescript
// Erweiterung ProcessProperties (process + multiprocess)
interface ProcessProperties {
  // ...bestehende Felder unverändert...

  // NEU – Safety-Annotation
  safetyRelevant?: boolean;            // Prozess ist Teil einer Sicherheitsfunktion
  safetyFunctionDescription?: string;  // z.B. "Schutzabschaltung bei Überlast"
}

// Erweiterung DataFlowProperties
interface DataFlowProperties {
  // ...bestehende Felder (crossesSafetyBoundary existiert bereits)...

  // NEU
  carriesSafetySignal?: boolean;       // z.B. 2-Hand-Signal, NOT-Halt, Encoder-Feedback
  safetySignalDescription?: string;    // z.B. "EN ISO 13849 PL d – 2-Hand-Signal"
}
```

Diese Flags sind der Einstiegspunkt für `deriveSafetyContext()` im Graph Builder
(siehe Abschnitt 7.1).

### 3.5 HazardCategory – ISO 12100 Vokabular

```typescript
export type HazardCategory =
  | 'mechanical'          // Quetschen, Schneiden, Stechen, Einwickeln...
  | 'electrical'          // Stromschlag, Lichtbogen, elektrostatisch
  | 'thermal'             // Verbrennung, Erfrierung, Hitzeschaden
  | 'noise'               // Hörverlust, Stress, Kommunikationsstörung
  | 'vibration'           // Hand-Arm, Ganzkörper
  | 'radiation'           // Ionisierend, nicht-ionisierend, optisch
  | 'material_substance'  // Aerosole, biologisch, chemisch
  | 'ergonomic'           // Körperhaltung, repetitive Bewegung, mentale Überlastung
  | 'environment'         // Rutsch-, Sturz-, Stolpergefahr
  | 'combined'            // Mehrere Kategorien
  | 'other';              // Nicht klassifizierbar
```

### 3.6 Erweiterung ProjectSettingsData (Phase 4)

```typescript
export interface ProjectSettingsData {
  strictMode: boolean;
  autoSave: boolean;
  autoSaveInterval?: number;

  // NEU (Phase 4 – Dok-Generator)
  safetyChapterStyle?: 'iso12100_reference' | 'taraflow_native' | 'combined';
}
```

---

## 4. Import-Adapter-Architektur

### 4.1 Designprinzip und Gesamtflow

Der Import läuft in vier klar getrennten Phasen ab:

```
1. Datei einladen
       ↓
2. Adapter-Erkennung  →  canHandle() pro Adapter
       ↓
   ┌─────────────────────────────────────────────┐
   │ Bekanntes Format          Unbekanntes Format │
   │ (taraflow_json,           (fremdes Excel,    │
   │  csv_generic)             proprietäres CSV)  │
   │        ↓                        ↓           │
   │   direkt zu Phase 4      Phase 3 (Mapping)   │
   └─────────────────────────────────────────────┘
       ↓
3. Column-Mapping-Dialog  →  sniffColumns() + Benutzer weist Spalten zu
       ↓
4. Parse  →  parse(file, mapping) → HazardImportResult
       ↓
5. Import-Preview  →  Warnings anzeigen, Benutzer bestätigt
       ↓
6. Commit  →  SafetyHazardData wird gespeichert
```

Adapter mit festem Schema (TARAflow JSON, CSV Generic) überspringen Phase 3 vollständig.
Alle anderen Adapter – insbesondere `fmea_excel` für fremde FMEA-Tabellen – durchlaufen
den Column-Mapping-Dialog.

### 4.2 Adapter-Interface (erweitert)

```typescript
// In safety-hazard-importer.ts (shared/services)

export interface HazardImportResult {
  hazards: SafetyHazard[];
  warnings: HazardImportWarning[];
  adapterUsed: string;
  sourceFile?: string;
}

export interface HazardImportWarning {
  row?: number;
  field?: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

// Beschreibt eine erkannte Spalte aus der Quelldatei
export interface SourceColumn {
  index: number;               // Spaltenindex (0-basiert)
  header: string;              // Originaler Spaltenname aus der Datei
  sampleValues: string[];      // Erste 3–5 nicht-leere Werte als Vorschau
  suggestedTarget?: TargetField; // Automatischer Vorschlag (kann null sein)
  confidence: number;          // 0.0–1.0, Qualität des Vorschlags
}

// Die TARAflow-Zielfelder die zugewiesen werden können
export type TargetField =
  | 'id'
  | 'description'
  | 'hazardCategory'
  | 'severity'
  | 'probability'
  | 'notes'
  | 'ignore';                  // Spalte bewusst überspringen

// Das vom Benutzer bestätigte Mapping: Quellenindex → Zielfeld
export type ColumnMapping = Record<number, TargetField>;

// Persistiertes Mapping für Re-Import (gespeichert in SafetyHazardData)
export interface PersistedColumnMapping {
  adapterUsed: string;
  headerSignature: string[];   // Originalheader zur Wiedererkennung
  mapping: ColumnMapping;
}

export interface HazardImportAdapter {
  readonly id: string;
  readonly label: string;
  readonly acceptedExtensions: string[];
  readonly acceptedMimeTypes: string[];
  readonly requiresColumnMapping: boolean;   // NEU: steuert ob Phase 3 aktiv wird

  canHandle(file: File): Promise<boolean>;

  // NEU: nur implementiert wenn requiresColumnMapping === true
  // Liest Header + Beispielwerte, gibt Spalten mit automatischen Vorschlägen zurück
  sniffColumns?(file: File): Promise<SourceColumn[]>;

  // mapping ist undefined wenn requiresColumnMapping === false
  parse(file: File, mapping?: ColumnMapping): Promise<HazardImportResult>;
}

export class HazardImporterRegistry {
  private adapters: Map<string, HazardImportAdapter> = new Map();

  register(adapter: HazardImportAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  getAll(): HazardImportAdapter[] {
    return Array.from(this.adapters.values());
  }

  async detect(file: File): Promise<HazardImportAdapter | null> {
    for (const adapter of this.adapters.values()) {
      if (await adapter.canHandle(file)) return adapter;
    }
    return null;
  }
}

export const hazardImporterRegistry = new HazardImporterRegistry();
```

### 4.3 Keyword-Matching für automatische Spalten-Vorschläge

Der `sniffColumns()`-Aufruf analysiert die Headerzeile der Quelldatei und schlägt
automatisch Zielfelder vor. Das Matching ist case-insensitiv, trimmt Leerzeichen und
ignoriert Sonderzeichen.

```typescript
// In shared/services/column-matcher.ts

const KEYWORD_MAP: Record<TargetField, string[]> = {
  id: [
    'nr', 'id', 'nummer', 'no', 'lfd', 'lfd. nr', 'hazard nr',
    'gefährdung nr', 'pos', 'position', 'ref'
  ],
  description: [
    'beschreibung', 'gefährdung', 'hazard', 'description', 'title',
    'bezeichnung', 'gefährdungsart', 'gefahrenquelle', 'gefährdungsbezeichnung',
    'titel', 'name'
  ],
  hazardCategory: [
    'kategorie', 'category', 'typ', 'type', 'art', 'klasse', 'class',
    'gefährdungsart', 'hazard type'
  ],
  severity: [
    'severity', 'schwere', 'schweregrad', 'auswirkung', 'ernst',
    'schadensausmass', 's', 'ernst des schadens', 'harm severity',
    'consequence', 'konsequenz'
  ],
  probability: [
    'probability', 'wahrscheinlichkeit', 'p', 'auftreten',
    'eintrittswahrscheinlichkeit', 'likelihood', 'häufigkeit'
  ],
  notes: [
    'notes', 'bemerkung', 'kommentar', 'anmerkung', 'note', 'hinweis',
    'ergänzung', 'zusatz', 'bemerkungen', 'worst case', 'ereignis'
  ],
  ignore: [],
};

export function suggestTargetField(header: string): {
  field: TargetField;
  confidence: number;
} {
  const normalized = header.toLowerCase().trim().replace(/[^a-z0-9äöü ]/g, '');

  for (const [field, keywords] of Object.entries(KEYWORD_MAP)) {
    if (field === 'ignore') continue;
    for (const kw of keywords) {
      if (normalized === kw) return { field: field as TargetField, confidence: 1.0 };
      if (normalized.includes(kw)) return { field: field as TargetField, confidence: 0.7 };
    }
  }
  return { field: 'ignore', confidence: 0.0 };
}
```

**Praxisbeispiel – EM2 Safety-Analyse Excel:**

| Originalspalte | Vorgeschlagenes Zielfeld | Confidence |
|---|---|---|
| `Gefährdung Nr.` | `id` | 1.0 |
| `Gefahrenquelle` | `description` | 0.7 |
| `Ereignis (Worst Case)` | `notes` | 0.7 |
| `betroffene Person(en)` | `ignore` | 0.0 |
| `Auslösender Faktor` | `ignore` | 0.0 |
| `A` … `N` (Betriebsarten) | `ignore` | 0.0 |

Spalten ohne Treffer werden als `ignore` vorgeschlagen – der Benutzer sieht sie trotzdem
im Dialog und kann sie manuell zuweisen.

### 4.4 Adapter: TARAflow JSON (primär, kein Mapping)

```typescript
// In adapters/taraflow-json-adapter.ts
export class TARAflowJsonAdapter implements HazardImportAdapter {
  readonly id = 'taraflow_json';
  readonly label = 'TARAflow JSON';
  readonly acceptedExtensions = ['.json'];
  readonly acceptedMimeTypes = ['application/json'];
  readonly requiresColumnMapping = false;   // Fixe Struktur, kein Mapping nötig

  async canHandle(file: File): Promise<boolean> {
    if (!file.name.endsWith('.json')) return false;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      return parsed?.format === 'taraflow-hazard-list';
    } catch { return false; }
  }

  async parse(file: File): Promise<HazardImportResult> {
    const raw = JSON.parse(await file.text());
    const warnings: HazardImportWarning[] = [];
    const hazards: SafetyHazard[] = [];

    for (const [i, item] of raw.hazards.entries()) {
      if (!item.id || !item.description) {
        warnings.push({ row: i, message: 'Missing required field (id or description)', severity: 'error' });
        continue;
      }
      hazards.push({ ...item, importedFrom: this.id, sourceNorm: item.sourceNorm ?? raw.sourceNorm });
    }
    return { hazards, warnings, adapterUsed: this.id, sourceFile: file.name };
  }
}
```

**JSON-Format (Referenz):**

```json
{
  "format": "taraflow-hazard-list",
  "version": "1.0",
  "sourceNorm": "ISO 12100",
  "exportedAt": "2026-05-13T10:00:00Z",
  "hazards": [
    {
      "id": "H-01",
      "description": "Quetschen durch unkontrollierte Maschinenbewegung",
      "hazardCategory": "mechanical",
      "severity": "critical",
      "probability": "low",
      "notes": "Relevant bei Ausfall der Schutzabschaltung"
    }
  ]
}
```

### 4.5 Adapter: CSV Generic (kein Mapping)

Erwartete Spalten: `id, description, hazardCategory, severity, probability, notes`.
Trennzeichen Komma oder Semikolon (automatisch erkannt). Header ist Pflicht.

```typescript
export class CsvGenericAdapter implements HazardImportAdapter {
  readonly id = 'csv_generic';
  readonly label = 'CSV (TARAflow-Schema)';
  readonly acceptedExtensions = ['.csv'];
  readonly acceptedMimeTypes = ['text/csv'];
  readonly requiresColumnMapping = false;
}
```

### 4.6 Adapter: FMEA Excel (mit Column-Mapping)

Dieser Adapter ist für fremde, kundenseitig aufgebaute FMEA- oder
Gefährdungsbeurteilungs-Excels konzipiert. Da jedes Excel einzigartig strukturiert ist,
ist `requiresColumnMapping = true` – der Adapter liefert nur die Rohdaten und Vorschläge,
die finale Zuweisung liegt beim Benutzer.

```typescript
export class FmeaExcelAdapter implements HazardImportAdapter {
  readonly id = 'fmea_excel';
  readonly label = 'FMEA / Gefährdungsbeurteilung (.xlsx)';
  readonly acceptedExtensions = ['.xlsx', '.xls'];
  readonly acceptedMimeTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ];
  readonly requiresColumnMapping = true;

  async canHandle(file: File): Promise<boolean> {
    return this.acceptedExtensions.some(ext => file.name.endsWith(ext));
  }

  async sniffColumns(file: File): Promise<SourceColumn[]> {
    // Liest erste Zeile (Header) + nächste 5 Datenzeilen via SheetJS
    // Gibt für jede Spalte: index, header, sampleValues[], suggestedTarget, confidence zurück
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });

    const headers = rows[0] ?? [];
    const dataRows = rows.slice(1, 6);

    return headers.map((header, index) => {
      const sampleValues = dataRows
        .map(row => String(row[index] ?? '').trim())
        .filter(v => v.length > 0)
        .slice(0, 3);
      const { field, confidence } = suggestTargetField(String(header));
      return { index, header: String(header), sampleValues, suggestedTarget: field, confidence };
    });
  }

  async parse(file: File, mapping: ColumnMapping): Promise<HazardImportResult> {
    // Liest alle Datenzeilen und wendet das bestätigte Mapping an
    // Zeilen ohne id oder description → Warning, überspringen
    // ...
  }
}
```

### 4.7 Geplante Adapter

| Adapter-ID | Format | Quell-Norm | Column-Mapping | Phase |
|---|---|---|---|---|
| `taraflow_json` | TARAflow JSON | – | Nein | 2 |
| `csv_generic` | CSV (TARAflow-Schema) | – | Nein | 2 |
| `fmea_excel` | FMEA-Tabelle (.xlsx) | IEC 60812 | **Ja** | 3 |
| `iso14971_xml` | ISO 14971 Risk Register XML | ISO 14971 | Nein | 3 |
| `sistema_csv` | SISTEMA Export CSV | ISO 13849 | Nein | 4 |

### 4.8 Adapter-Registrierung (Bootstrapping)

```typescript
// In app bootstrap / main.ts
import { hazardImporterRegistry } from 'shared/services/safety-hazard-importer';
import { TARAflowJsonAdapter } from 'shared/services/adapters/taraflow-json-adapter';
import { CsvGenericAdapter } from 'shared/services/adapters/csv-generic-adapter';
import { FmeaExcelAdapter } from 'shared/services/adapters/fmea-excel-adapter';

hazardImporterRegistry.register(new TARAflowJsonAdapter());
hazardImporterRegistry.register(new CsvGenericAdapter());
hazardImporterRegistry.register(new FmeaExcelAdapter());
// Neue Adapter: eine Zeile hier, fertig.
```

---

## 5. UI – Projekterstellung (NewProjectDialog)

### 5.1 Neuer Abschnitt im Dialog

Nach dem bestehenden "Criticality"-Block wird ein neuer Block eingefügt:

```
┌─────────────────────────────────────────────────────┐
│ Regulatory Profile                                  │
│                                                     │
│ ○ Generic CRA    (kein domänenspezifischer Kontext) │
│ ● Machinery      (Maschinenverordnung, EN 50742,    │
│                   ISO 12100)                        │
│ ○ Medical        (MDR, IEC 81001-5-1, ISO 14971)   │
│ ○ Automotive     (ISO 21434)                        │
│ ○ Industrial OT  (IEC 62443)                        │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ Safety Analysis                                     │
│                                                     │
│ ● Graph-native   Safety via Annotationen im         │
│                  Systemmodell (empfohlen)            │
│ ○ ISO Import     Gefährdungsliste importieren       │
│ ○ Combined       Beide Modi – Crossreferenz möglich │
│                                                     │
│ [⬆ Datei importieren]  (nur sichtbar wenn           │
│                          iso_import oder combined)  │
└─────────────────────────────────────────────────────┘
```

Import-Button öffnet File-Picker → Adapter-Erkennung → ggf. Column-Mapping-Dialog.
Import ist optional bei Projekterstellung, kann nachträglich erfolgen.

### 5.2 Column-Mapping-Dialog

Wird angezeigt wenn der erkannte Adapter `requiresColumnMapping === true` hat.
Der Dialog ersetzt das manuelle Abtippen vollständig – der Benutzer weist
gefundene Quellspalten den TARAflow-Zielfeldern zu.

```
┌────────────────────────────────────────────────────────────────────────┐
│ Spalten zuweisen – EM2_Safety_Analyse.xlsx                             │
│                                                                        │
│ TARAflow hat 14 Spalten gefunden. Weise sie den TARAflow-Feldern zu.   │
│ Pflichtfelder: ID, Beschreibung                                        │
│                                                                        │
├──────────────────────────────┬──────────────────┬──────────────────────┤
│ Quellspalte (Excel)          │ Beispielwerte    │ TARAflow-Feld        │
├──────────────────────────────┼──────────────────┼──────────────────────┤
│ Gefährdung Nr.               │ 00.01, 00.02,    │ [● ID            ▾] │
│                              │ 01.01            │                      │
├──────────────────────────────┼──────────────────┼──────────────────────┤
│ Gefahrenquelle               │ Beim Schweissen  │ [● Beschreibung  ▾] │
│                              │ spezieller…      │                      │
├──────────────────────────────┼──────────────────┼──────────────────────┤
│ Ereignis (Worst Case)        │ Taubheit, schwe- │ [● Notizen       ▾] │
│                              │ re Quetschverl…  │                      │
├──────────────────────────────┼──────────────────┼──────────────────────┤
│ betroffene Person(en)        │ Bediener, Servi- │ [○ Ignorieren    ▾] │
│                              │ ce-personal      │                      │
├──────────────────────────────┼──────────────────┼──────────────────────┤
│ Auslösender Faktor           │ Unordnung, Vers- │ [○ Ignorieren    ▾] │
│                              │ chmutzu…         │                      │
├──────────────────────────────┼──────────────────┼──────────────────────┤
│ A (Normalbetrieb)            │ x, , x           │ [○ Ignorieren    ▾] │
├──────────────────────────────┼──────────────────┼──────────────────────┤
│ … (weitere Betriebsspalten)  │                  │ [○ Ignorieren    ▾] │
└──────────────────────────────┴──────────────────┴──────────────────────┘
│                                                                        │
│ ⚠ Pflichtfeld "Beschreibung" ist noch nicht zugewiesen.               │
│ ℹ Kategorie, Schwere, Wahrscheinlichkeit: nicht zugewiesen –          │
│   Werte müssen nach dem Import manuell ergänzt werden.                 │
│                                                                        │
│ [ Mapping speichern für künftige Re-Importe ]                          │
│                                          [Abbrechen]  [Import starten] │
└────────────────────────────────────────────────────────────────────────┘
```

**Verhalten:**

- Automatisch vorgeschlagene Felder sind vorausgewählt (grau hinterlegt wenn confidence ≥ 0.7).
- Jedes Dropdown enthält alle `TargetField`-Optionen plus "Ignorieren".
- Ein Zielfeld kann nur einmal zugewiesen werden; wird es ein zweites Mal gewählt,
  wird das erste automatisch auf "Ignorieren" zurückgesetzt.
- "Import starten" ist disabled solange `id` oder `description` nicht zugewiesen sind.
- "Mapping speichern" persistiert das Mapping in `SafetyHazardData.columnMapping`
  anhand der Spaltenheader als Signatur – beim nächsten Import derselben Dateistruktur
  wird es automatisch vorgeladen.

### 5.3 Import-Preview und Validierung

Nach dem Mapping-Bestätigung und vor dem Commit:

```
┌────────────────────────────────────────────────────────────────────────┐
│ Import-Vorschau – 42 Einträge erkannt                                  │
│                                                                        │
│ ✓ 38 Einträge können importiert werden                                 │
│ ⚠  4 Warnungen                                                         │
│                                                                        │
│ ┌────┬──────────────────────────────────┬────────────┬──────────────┐  │
│ │ ID │ Beschreibung                     │ Kategorie  │ Severity     │  │
│ ├────┼──────────────────────────────────┼────────────┼──────────────┤  │
│ │H-01│ Beim Schweissen spezieller…      │ —          │ —            │  │
│ │H-02│ Stolpern oder Ausrutschen…       │ —          │ —            │  │
│ │ …  │                                  │            │              │  │
│ └────┴──────────────────────────────────┴────────────┴──────────────┘  │
│                                                                        │
│ Warnungen:                                                             │
│ ⚠ Zeile 5: Doppelte ID "00.01" – wird als "00.01-2" importiert        │
│ ℹ 42 Einträge haben keine Kategorie (nach Import zuweisbar)            │
│ ℹ 42 Einträge haben keinen Severity-Wert (nach Import zuweisbar)      │
│                                                                        │
│                                          [Zurück]  [Importieren (38)] │
└────────────────────────────────────────────────────────────────────────┘
```

**Validierungsregeln:**

- Pflichtfelder prüfen (`id`, `description`)
- Doppelte IDs: automatisch umbenennen (`H-01` → `H-01-2`) mit Warning
- Unbekannte `hazardCategory`-Werte: Warning, Feld leer lassen, nach Import editierbar
- Fehlende Severity/Probability: erlaubt, Warning, nach Import editierbar
- Maximale Anzahl: 500 Einträge (Performance-Grenze)

---

## 6. UI – Overview Tab (ProjectInfo)

### 6.1 Anzeige im Read-Mode

Unterhalb des Criticality-Badges:

```
Regulatory Profile:  [Machinery – EN 50742 / ISO 12100]
Safety Analysis:     [Combined]
Hazard List:         [42 Einträge · importiert 2026-05-26]  [Verwalten ▸]
```

### 6.2 Edit-Mode

- Regulatory Profile: Radio-Gruppe (wie im Dialog)
- Safety Analysis Mode: Radio-Gruppe
- Hazard List: Button "Importieren" / "Ersetzen" / "Exportieren"
- Beim Wechsel `iso_import` → `graph_native`: Warning-Dialog
  ("Importierte Gefährdungen bleiben gespeichert, werden aber nicht mehr referenziert.")

### 6.3 Hazard-Verwaltungsdialog

Separater Dialog, erreichbar über "Verwalten ▸":

```
┌──────────────────────────────────────────────────────────────────────┐
│ Safety Hazard List              [+ Manuell hinzufügen] [⬆ Importieren│
├────┬────────────────────────────────┬────────────┬────────────────────┤
│ ID │ Beschreibung                   │ Kategorie  │ Severity           │
├────┼────────────────────────────────┼────────────┼────────────────────┤
│H-01│ Quetschen durch Roboterarm     │ mechanical │ critical           │
│H-02│ Elektrischer Schlag            │ electrical │ critical     ⚠ leer│
│H-03│ Überdosierung Medikament       │ —          │ catastrophic        │
└────┴────────────────────────────────┴────────────┴────────────────────┘
```

- Jede Zeile ist inline editierbar (Klick auf Zelle → Edit-Modus).
- Fehlende Pflicht-/Empfehlungsfelder werden mit ⚠ markiert.
- Löschen mit Bestätigungsdialog wenn bereits referenziert.
- "Manuell hinzufügen" öffnet ein leeres Inline-Formular am Ende der Liste –
  kein separater Dialog, kein Abtippen in einem Modal.

---

## 7. Graph Builder Integration

Der Graph Builder (Threat-Generator) ist die zentrale Stelle, die Safety-Kontext
aus beiden Quellen — Graph-Annotationen und Hazard-Liste — zusammenführt und auf
jeden generierten Threat überträgt.

### 7.1 `deriveSafetyContext()` – Dual-Pfad-Logik

```typescript
// In threat-generator.ts

function deriveSafetyContext(
  element: DFDElement,
  project: Project
): ThreatSafetyContext | null {

  const linkedHazardIds: string[] = [];
  let isRelevant = false;

  // Pfad 1: graph_native – direkte Safety-Annotation am DFD-Element
  if (
    (element as ProcessProperties).safetyRelevant ||
    (element as DataFlowProperties).crossesSafetyBoundary ||
    (element as DataFlowProperties).carriesSafetySignal
  ) {
    isRelevant = true;
  }

  // Pfad 2: iso_import – Hazards aus der Liste die dieses Element referenzieren
  if (project.safetyHazards && project.info.safetyAnalysisMode !== 'graph_native') {
    const directHazards = project.safetyHazards.hazards.filter(h =>
      h.affectedElements?.includes(element.id)
    );
    // Indirekte Verknüpfung: Element ist mit einem Asset verbunden,
    // das wiederum einen Hazard referenziert
    const indirectHazards = project.safetyHazards.hazards.filter(h =>
      h.affectedAssets?.some(aid =>
        project.assets?.assets
          .find(a => a.id === aid)
          ?.linkedDfdElements?.includes(element.id)
      )
    );
    const allHazards = [...new Set([...directHazards, ...indirectHazards])];
    if (allHazards.length > 0) {
      isRelevant = true;
      linkedHazardIds.push(...allHazards.map(h => h.id));
    }
  }

  if (!isRelevant) return null;

  return {
    linkedHazardIds,
    hazardCategory: deriveWorstCaseCategory(linkedHazardIds, project),
    safetyImpactPath: buildSafetyImpactPath(element, project),
  };
}
```

### 7.2 `buildSafetyImpactPath()` – Automatische Pfad-Traversierung

Der Impact-Pfad wird aus dem Asset-Relations-Graph abgeleitet. Ausgehend vom
betroffenen Element werden `depends_on`-Relationen downstream traversiert bis
zu Aktoren oder physischen Assets.

```typescript
function buildSafetyImpactPath(
  element: DFDElement,
  project: Project
): string {
  // Startet beim verknüpften Asset des Elements
  const startAssets = project.assets?.assets.filter(a =>
    a.linkedDfdElements?.includes(element.id)
  ) ?? [];

  if (startAssets.length === 0) return element.label ?? element.id;

  // Traversiert depends_on-Relationen (nutzt bestehendes Relation-System)
  // Bricht ab bei physischen Assets (category: 'Physical') oder Safety-Assets
  const path = traverseDownstream(startAssets[0], project, [
    'Physical', 'Function'
  ]);

  return path.map(a => a.name).join(' → ');
  // Beispiel: "Generator Control → IO Print → Intradrive → el. Zylinder"
}
```

### 7.3 Automatische Safety-Impact-Ableitung im Risk Tab

Wenn ein Threat `safetyContext` gesetzt hat, leitet der Risk Tab den Safety Impact
automatisch aus dem schlimmsten verlinkten Hazard ab – ohne manuelle Eingabe:

```typescript
// In risk-assessment-service.ts

function deriveSafetyImpact(
  threat: Threat,
  project: Project
): RiskImpactLevel | null {
  if (!threat.safetyContext?.linkedHazardIds.length) return null;

  const hazards = threat.safetyContext.linkedHazardIds
    .map(id => project.safetyHazards?.hazards.find(h => h.id === id))
    .filter(Boolean) as SafetyHazard[];

  const worstSeverity = hazards.reduce<HazardSeverity | null>((worst, h) => {
    const order: HazardSeverity[] = [
      'negligible', 'marginal', 'critical', 'catastrophic'
    ];
    if (!worst) return h.severity;
    return order.indexOf(h.severity) > order.indexOf(worst) ? h.severity : worst;
  }, null);

  // Mapping HazardSeverity → RiskImpactLevel
  const severityToImpact: Record<HazardSeverity, RiskImpactLevel> = {
    negligible:   'low',
    marginal:     'medium',
    critical:     'high',
    catastrophic: 'critical',
  };

  return worstSeverity ? severityToImpact[worstSeverity] : null;
}
```

Der abgeleitete Impact wird im Risk Dialog als Vorschlag angezeigt:

```
Safety Impact  [critical ▾]  ← abgeleitet aus H-01 (catastrophic)
               ⚠ Automatisch aus Safety-Analyse übernommen. Manuell überschreibbar.
```

Der Analyst kann den Wert überschreiben — das wird als `safetyImpactOverridden: true`
markiert und in der Dokumentation explizit ausgewiesen (Traceability).

### 7.4 Verhalten je Safety-Analysemodus

| Modus | Pfad 1 (Graph-Annotation) | Pfad 2 (Hazard-Liste) | Impact-Ableitung |
|---|---|---|---|
| `graph_native` | ✓ aktiv | — | Nur aus Graph-Flags (kein Severity-Mapping) |
| `iso_import` | — | ✓ aktiv | Aus verlinkten Hazards (vollständig) |
| `combined` | ✓ aktiv | ✓ aktiv | Union beider Pfade, Hazard-Severity hat Vorrang |

Im `graph_native`-Modus ohne Hazard-Liste wird `safetyRelevant = true` gesetzt,
aber kein automatischer Impact-Level abgeleitet — der Analyst muss diesen manuell
setzen. Ein Info-Hinweis im Risk Dialog empfiehlt den ISO-Import für vollständige
Automatisierung.

---

## 8. Integration in Threat-Modellierung

### 7.1 Verknüpfung Hazard ↔ DFD-Element / Asset

Im DFD-Element-Formular und Asset-Dialog (nur wenn `iso_import` oder `combined`):

```
Linked Safety Hazards:  [H-01 – Quetschen ×]  [H-02 – Elektr. ×]  [+ Hinzufügen]
```

Verknüpfung über `affectedElements[]` und `affectedAssets[]` in `SafetyHazard`.

### 7.2 Threat-Referenzierung

Bei Threat-Generierung: Hat das Asset/Element eine verknüpfte `SafetyHazard`?
→ Threat erhält automatisch Safety-Flag:

```typescript
interface ThreatSafetyContext {
  linkedHazardIds: string[];        // Referenz auf SafetyHazard.id
  safetyImpactPath?: string;        // "Sensor → Controller → Aktuator"
  hazardCategory?: HazardCategory;  // Aus Graph-Annotation oder Hazard-Import
}
```

### 7.3 Crossreferenz im Combined-Modus

Im Threat-Dialog:

```
Safety Context
├── Graph-native:  safetyRelevant = true · crossesSafetyBoundary = true
└── ISO 12100 Ref: H-01 (mechanical · critical) · H-03 (material · catastrophic)
```

---

## 9. Dok-Generator

### 8.1 Kapitelstruktur je Modus

**Modus A (iso_import):**
```
Kapitel N: Safety-Security-Kopplung
  N.1  Importierte Gefährdungsliste (ISO 12100)
       Tabelle: ID | Beschreibung | Kategorie | Severity
  N.2  Mapping: Gefährdung → Threat
       Tabelle: Hazard-ID | Threat-ID | STRIDE-Kategorie | Schutzmassnahme
  N.3  Normreferenz: ISO 12100, EN 50742, Maschinenverordnung
```

**Modus B (graph_native):**
```
Kapitel N: Safety-Security-Kopplung
  N.1  Methodik (TARAflow Safety-Annotation-Prozess)
  N.2  Safety-relevante Datenflüsse
       Tabelle: DataFlow-ID | safetyRelevant | crossesSafetyBoundary | Threats
  N.3  Asset Safety-Impact-Pfade (Asset-zu-Asset mit Safety-Propagation)
  N.4  Normreferenz: EN 50742, Maschinenverordnung, CRA
```

**Modus C (combined):**
Beide Kapitel, plus:
```
  N.x  Crossreferenz-Tabelle
       Hazard-ID | Graph-Element | Threat-ID | Abdeckung
```

### 8.2 Regulatory Profile → Normreferenzen

| Profil | Normreferenzen im Dokument |
|---|---|
| generic_cra | EU Cyber Resilience Act Anhang I |
| machinery | Maschinenverordnung, EN 50742, ISO 12100, CRA |
| medical | MDR Anhang I, ISO 14971, IEC 81001-5-1, CRA |
| automotive | ISO 21434, CRA |
| industrial | IEC 62443-4-1/4-2, CRA |

---

## 10. Implementierungsplan

### Phase 1 – Datenmodell & Projekterstellung (Prio: hoch)

- [ ] `RegulatoryProfile`, `SafetyAnalysisMode` Typen in `shared`
- [ ] `HazardCategory`, `HazardSeverity`, `HazardProbability` Typen in `shared`
- [ ] `SafetyHazard`, `SafetyHazardData` Interfaces in `shared`
- [ ] `TargetField`, `SourceColumn`, `ColumnMapping`, `PersistedColumnMapping` Typen in `shared`
- [ ] `Project` Interface: `safetyHazards: SafetyHazardData | null` ergänzen
- [ ] `ProjectInfoData`: `regulatoryProfile` + `safetyAnalysisMode` ergänzen
- [ ] `NewProjectData`: `regulatoryProfile` + `safetyAnalysisMode` ergänzen
- [ ] Defaultwerte: `regulatoryProfile: 'generic_cra'`, `safetyAnalysisMode: 'graph_native'`
- [ ] `new-project-dialog.tsx`: Regulatory Profile + Safety Analysis Blöcke
- [ ] `project-info.tsx`: Read/Edit-Mode für neue Felder

### Phase 2 – Import-Adapter & Verwaltung, fixe Schemata (Prio: mittel)

- [ ] `HazardImportAdapter` Interface + `HazardImporterRegistry` in `shared`
- [ ] `suggestTargetField()` Keyword-Matcher in `shared/services/column-matcher.ts`
- [ ] `TARAflowJsonAdapter` implementieren
- [ ] `CsvGenericAdapter` implementieren
- [ ] Adapter-Registrierung im App-Bootstrap
- [ ] Import-Button in `NewProjectDialog` und `ProjectInfo`
- [ ] Import-Preview-Dialog (Warnings-Liste, Commit)
- [ ] Hazard-Verwaltungsdialog (Tabelle + Inline-Edit + Inline-Add)
- [ ] Validierung: Pflichtfelder, Duplikate, unbekannte Kategorien

### Phase 3 – Column-Mapping-Dialog & FMEA Excel (Prio: mittel)

- [ ] `FmeaExcelAdapter` mit `sniffColumns()` implementieren (SheetJS)
- [ ] `ColumnMappingDialog` Komponente (Tabelle mit Dropdowns, Validation, Mapping speichern)
- [ ] Persistierung `PersistedColumnMapping` in `SafetyHazardData`
- [ ] Automatisches Vorladen gespeicherter Mappings bei Re-Import
- [ ] DFD/Asset-Integration: `linkedHazardIds` auf Elementen
- [ ] Verknüpfungs-UI im Element-Formular (nur wenn `iso_import` oder `combined`)

### Phase 3b – Graph Builder Safety-Integration (Prio: hoch, parallel zu Phase 3)

- [ ] `safetyRelevant`, `safetyFunctionDescription` auf `ProcessProperties`
- [ ] `carriesSafetySignal`, `safetySignalDescription` auf `DataFlowProperties`
- [ ] Safety-Annotations-UI in DFD-Element-Formularen (Process, DataFlow)
- [ ] `ThreatSafetyContext` Interface im Threat-Modell
- [ ] `deriveSafetyContext()` im Threat-Generator (Dual-Pfad: Graph + Hazard-Liste)
- [ ] `buildSafetyImpactPath()` – Downstream-Traversal via Asset-Relations
- [ ] `deriveWorstCaseCategory()` – HazardCategory aus verlinkten Hazards ableiten
- [ ] Threat-Generierung: `safetyContext` auf jedem generierten Threat setzen
- [ ] Risk Tab: `deriveSafetyImpact()` – automatische Safety-Impact-Ableitung
- [ ] Risk Dialog: Vorschlags-Banner wenn Safety Impact automatisch abgeleitet
- [ ] `safetyImpactOverridden: boolean` für manuelle Überschreibung + Traceability

### Phase 4 – Dok-Generator & weitere Adapter (Prio: hoch nach Phase 1–3)

- [ ] Safety-Security-Kapitel je Modus im Dok-Generator
- [ ] Normreferenzen aus Regulatory Profile
- [ ] Crossreferenz-Tabelle im Combined-Modus
- [ ] Traceability-Tabelle: Hazard-ID → Threat-ID → Safety Impact → Schutzmassnahme
- [ ] `iso14971_xml` Adapter
- [ ] `sistema_csv` Adapter

---

## 11. Offene Fragen

1. ~~**Manuelles Hinzufügen:** Soll der Benutzer Hazards direkt in TARAflow erfassen
   können (ohne Import)?~~
   → **Entschieden:** Kein separates Eingabe-Modal. Manuelles Hinzufügen erfolgt
   über ein Inline-Formular am Ende der Hazard-Tabelle im Verwaltungsdialog.
   Manuelles Abtippen in Modals entfällt – der Column-Mapping-Dialog ersetzt
   diesen Workflow für alle externen Quellen.

2. **Profil-Wechsel nach Projektstart:** Was passiert mit importierten Hazards
   beim Wechsel von `machinery` auf `medical`?
   → Empfehlung: Hazards bleiben erhalten, `sourceNorm` zeigt Herkunft.
   Normreferenzen im Dok-Generator passen sich automatisch an.

3. **Severity-Skala Normalisierung:** ISO 14971 und ISO 12100 verwenden leicht
   unterschiedliche Terminologien.
   → Empfehlung: Normalisierung auf 4-stufige Skala
   (negligible / marginal / critical / catastrophic), Quell-Skala im `notes`-Feld.

4. **Regulatory Profile als Tag:** Soll das Profil auch als `regulation`-Tag
   erscheinen (für Filterung/Reporting)?
   → Empfehlung: Automatisch als `regulation`-Tag setzen wenn Profil gewählt.
   Bidirektionale Synchronisation.

5. **Mapping-Konflikt bei Re-Import:** Was passiert wenn sich Spaltenheader
   leicht ändern (z.B. Umbenennung einer Spalte im Excel des Kunden)?
   → Offene Frage: Partial-Match anhand vorhandener Header-Signatur, fehlende
   Spalten im Dialog als "nicht gefunden" markieren und Benutzer neu zuweisen lassen.
