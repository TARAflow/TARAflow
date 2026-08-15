# TARAflow — Threat Enrichment: Mitre ATT&CK & LLM

**Verweis:** Aufbaut auf CIANAAA_Handover_v6.md — insbesondere Phase 2b (UnifiedStrategy).
Dieses Dokument beschreibt Ebene 2 der Threat-Generierungs-Pipeline.

---

## Konzept: Zwei Ebenen der Threat-Generierung

```
Ebene 1 — STRIDE Ableitung (was wird bedroht?)          ← implementiert / Phase 2b
  Element Properties  → STRIDE-Kategorien (modifiziert)
  Asset Schutzziele   → STRIDE-Kategorien + initialImpact (CIANAAA)
  Fallback            → Classic STRIDE per Element-Typ

Ebene 2 — Threat Enrichment (wie wird es angegriffen?)  ← dieses Dokument
  Mitre ATT&CK        → konkrete Angriffstechniken (TTP)
  Spezialisiertes LLM → domänenspezifische Angriffsbeschreibungen
```

Ebene 1 und Ebene 2 sind unabhängig — Ebene 2 reichert bestehende Threats an,
sie generiert keine neuen. Ein Threat ohne Enrichment ist vollständig gültig.

---

## Phase E1 — Mitre ATT&CK Anbindung 🔲

### Ziel

Für jeden generierten Threat: passende ATT&CK Techniken (TTPs) vorschlagen
basierend auf STRIDE-Kategorie, Element-Typ und verfügbaren Properties.

### Mapping-Ansatz

ATT&CK Techniken lassen sich deterministisch auf STRIDE mappen:

| STRIDE | ATT&CK Tactic | Beispiele |
|---|---|---|
| S (Spoofing) | Credential Access, Initial Access | T1078 Valid Accounts, T1566 Phishing |
| T (Tampering) | Impact, Persistence | T1565 Data Manipulation, T1059 Command Execution |
| R (Repudiation) | Defense Evasion | T1070 Indicator Removal |
| I (Information Disclosure) | Collection, Exfiltration | T1005 Data from Local System |
| D (Denial of Service) | Impact | T1499 Endpoint DoS, T1498 Network DoS |
| E (Elevation of Privilege) | Privilege Escalation | T1068 Exploitation for Privilege Escalation |

Verfeinerung durch Element-Typ und Properties:
- `Process` mit `processSemantic: "bootloader"` → ICS/OT Techniken (ATT&CK for ICS)
- `DataFlow` mit `protocol: "modbus"` → T0836 Modify Parameter
- `Interface` mit `type: "jtag"` → Hardware-spezifische Techniken

### Datenmodell-Erweiterung

```typescript
// Erweiterung auf Threat:
export interface MitreReference {
  techniqueId: string;    // z.B. "T1078"
  techniqueName: string;  // z.B. "Valid Accounts"
  tactic: string;         // z.B. "Credential Access"
  url: string;            // ATT&CK Navigator Link
  source: "auto" | "manual";
}

// Auf Threat:
mitreReferences?: MitreReference[];
```

### Schnittstellenanforderung an Phase 2b (UnifiedStrategy)

Die UnifiedStrategy-Pipeline muss nach der STRIDE-Ableitung einen
**Enrichment-Hook** vorsehen:

```typescript
interface IEnrichmentProvider {
  enrich(threat: Threat, element: DFDElementReference, project: ThreatProjectData): Partial<Threat>;
}
```

Der Hook wird nach `getStrideCategories()` und `getInitialImpact()` aufgerufen —
nicht Teil der Kernableitung, sondern optionale Anreicherung.

### UI

- Threat Dialog Tab 2 oder eigener Abschnitt: "ATT&CK Techniques"
- ATT&CK Navigator Link pro Technik
- Analyst kann Techniken bestätigen / entfernen / ergänzen
- Lückenanalyse: *"Diese STRIDE-Kategorie ist in deinem Asset-Modell nicht abgedeckt"*

---

## Phase E2 — Spezialisiertes LLM 🔲 (später)

### Ziel

Domänenspezifische Threat-Beschreibungen und Angriffsszenarien für Branchen
wie OT/ICS, Automotive (ISO 21434), Medizintechnik — wo generische Templates
nicht ausreichen.

### Unterschied zu Mitre ATT&CK

| Mitre ATT&CK | LLM |
|---|---|
| Deterministisch | Generativ |
| Technique-ID referenzierbar | Freitext |
| Hohe Vertrauensstufe | Mittlere Vertrauensstufe |
| Kein Kontext nötig | Benötigt Projektkontext |

### Vertrauensstufen

```
Asset Schutzziele (Analyst)   → Vertrauen: Hoch
Element Properties (DFD)      → Vertrauen: Hoch
Mitre ATT&CK                  → Vertrauen: Mittel
LLM                           → Vertrauen: Mittel-Niedrig
```

Threats aus LLM werden immer als `source: "generated:llm"` markiert und
benötigen explizite Analyst-Bestätigung (`relevance: "unrated"` bis Bestätigung).

### Schnittstellenanforderung

Gleicher `IEnrichmentProvider`-Hook wie Phase E1 — LLM ist ein weiterer Provider.
Konfigurierbar per Projekt: welche Enrichment-Provider aktiv sind.

---

## Phasenplan

| Phase | Inhalt | Abhängigkeit |
|---|---|---|
| 2b | UnifiedStrategy — Pipeline mit Enrichment-Hook | CIANAAA_Handover_v6 |
| E1 | Mitre ATT&CK Anbindung | Phase 2b (Hook vorhanden) |
| E2 | LLM Enrichment | Phase E1 (Infrastruktur vorhanden) |

---

## Offene Entscheidungen

1. **Lokale Mitre-Daten oder API?** — Lokale JSON-Kopie (offline-fähig, Electron) vs. Live-API
2. **ATT&CK for ICS separat?** — OT/ICS-Projekte brauchen ICS-spezifische Techniken
3. **Lückenanalyse als Feature?** — Vergleich ATT&CK-Vorschläge vs. Asset-Modell-Abdeckung
4. **LLM lokal oder Cloud?** — Datenschutz bei industriellen Projekten kritisch
