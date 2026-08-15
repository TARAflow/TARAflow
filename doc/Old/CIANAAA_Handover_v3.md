# TARAflow — Handover: CIANAAA & Asset-Tab Refactoring

**Version 3** — vollständiger Analyst-Workflow, Cause Mechanism, Skalenharmonisierung

---

## 1. Konzeptuelle Grundlage

### CIANAAA ist kein Severity-Mass

CIANAAA war nie eine zweite Impact-Bewertung. CIANAAA beschreibt die **Schutzziele** —
also womit man sich vor dem bewerteten Impact schützen kann.

Gleichzeitig liefert CIANAAA das **deterministische Mapping zu STRIDE**: welche Threats
überhaupt generiert werden und über welchen Beziehungstyp.

### Die drei Ebenen (konsistentes Modell)

| Ebene | Frage | Beispiel |
|---|---|---|
| **Impact** | Was passiert wenn verletzt? | Safety=Critical |
| **CIANAAA** | Wogegen muss geschützt werden? | Integrity=Critical |
| **STRIDE** | Wie wird dieses Schutzziel verletzt? | Tampering |

CIANAAA ist der **Übersetzer** zwischen Business-Impact und technischer Schutzanforderung.

### Cause Mechanism — das fehlende Bindeglied

Der direkte Sprung Impact→CIANAAA ist zu grob. Derselbe Impact kann durch verschiedene
Mechanismen entstehen. Der Cause Mechanism ist das Bindeglied:

```
Impact → Cause Mechanism → CIANAAA → STRIDE
```

Die 7 Cause Mechanisms sind **domain-agnostisch und universell**:

| Cause Mechanism (UI: was der Analyst sieht) | → CIANAAA (intern) | → STRIDE |
|---|---|---|
| Manipulation des Inhalts | Integrity | Tampering |
| Offenlegung des Inhalts | Confidentiality | Information Disclosure |
| Ausfall / Nichtverfügbarkeit | Availability | Denial of Service |
| Identitätsmissbrauch | Authentication | Spoofing |
| Unautorisierter Zugriff | Authorization | Elevation of Privilege |
| Fehlender Nachweis | Non-Repudiation | Repudiation |
| Fehlende Zurechenbarkeit | Accountability | Repudiation |

**Wichtig:** Der Analyst sieht nie "CIANAAA" oder "Integrity" im UI.
Er sieht: *"Wie könnte der Schaden eintreten?"* — und wählt Cause Mechanisms.
Die CIANAAA-Ableitung geschieht intern und unsichtbar.

Die Domänenspezifität steckt ausschliesslich im **Impact** — nicht in den Cause Mechanisms.
Wasseraufbereitung und Brauerei haben denselben Cause Mechanism "Manipulation",
aber unterschiedliche Impact-Levels (Safety=Critical vs. Operational=Critical).

---

## 2. Vollständiger Analyst-Workflow (Asset Tab)

### Schritt 0 — Asset Inventory (automatisch priorisiert)

Der Analyst sieht eine nach Relevanz sortierte Asset-Liste:

```
Priorität = HVA-Flag (höchste Priorität)
          + Anzahl verknüpfte DFD-Elemente
          + Anzahl Interfaces mit EL ≥ EL3 (externe Exposition)
          + Anzahl Trust Boundary Crossings
```

**UI-Darstellung:**

```
[A-2] Kalibrierparameter          ⬤ HVA · 4 Elemente · 1 EL3-Interface  ← hier starten
[A-8] Rauchdetektionsfunktion     ⬤ 3 Elemente · 2 TB-Crossings
[A-4] Controller Firmware         ⬤ 2 Elemente
[A-7] Device Config               ○ 1 Element
```

Status: `○` unbewertet | `◑` teilweise | `⬤` vollständig bewertet

---

### Schritt 1 — Asset verstehen

Der Analyst sieht Kontext bevor er bewertet:

```
Asset:     Kalibrierparameter
Kategorie: Data
Verknüpft mit:
  P-13 Calibration Controller  ──stores──▶  [dieses Asset]
  P-1  Optical Sensor          ──reads──▶   [dieses Asset]
  IF-8 Debug UART              ──accesses──▶[dieses Asset]
```

Dieser Kontext ist entscheidend: der Analyst versteht welche Elemente auf dieses Asset
zugreifen können — und damit wo Threats entstehen werden.

---

### Schritt 2 — Impact Assessment

*"Was passiert wenn dieses Asset kompromittiert wird?"*

Bewertung pro Kriterium — vollständig kundenkontext-getrieben:

| Kriterium | Brauerei | Tunnelbetreiber | Wasseraufbereitung |
|---|---|---|---|
| Safety | Low | Critical | Critical |
| Operational | Critical | Critical | Critical |
| Financial | High | High | High |
| Regulatory | High | Critical | Critical |
| Recoverability | High | High | High |

Derselbe Asset — völlig unterschiedlicher Impact je nach Kunde. Das ist korrekt so.

---

### Schritt 3 — Cause Mechanism (UI-sichtbar, CIANAAA intern)

*"Wie könnte dieser Schaden eintreten?"*

Der Analyst sieht Checkboxen in Alltagssprache — nie CIANAAA-Begriffe:

```
Wie könnte der bewertete Schaden eintreten?

  ☑ Manipulation des Inhalts
  ☑ Ausfall / Nichtverfügbarkeit
  ☐ Offenlegung des Inhalts
  ☐ Identitätsmissbrauch
  ☐ Unautorisierter Zugriff
  ☐ Fehlender Nachweis
  ☑ Fehlende Zurechenbarkeit       ← für Audit-Trail (wer hat wann kalibriert?)
```

Das System schlägt basierend auf Asset-Kategorie und Impact-Levels vor.
Analyst bestätigt oder passt an.

**Intern (unsichtbar) wird abgeleitet:**
```
Manipulation          → Integrity = critical   (weil Safety/Operational=Critical)
Ausfall               → Availability = high    (weil Operational=Critical)
Fehlende Zurechenbark.→ Accountability = high  (weil Regulatory=High)
```

---

### Schritt 4 — CIANAAA (intern, Analyst sieht nur Threat Preview)

CIANAAA wird automatisch aus Cause Mechanism × Impact abgeleitet.
Der Analyst sieht es **nicht direkt** — er sieht den Effekt als Threat Preview.

**Optionaler Expert-Mode:** Analyst kann CIANAAA-Werte feinjustieren.
Standard-Workflow: nie notwendig.

**Applicability aus Asset-Kategorie (automatisch):**

| Kategorie | C | I | A | N | AuthN | AuthZ | Acc |
|---|---|---|---|---|---|---|---|
| **Data** | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ |
| **Function** | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Process** | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **System** | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ |
| **Infrastructure** | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✗ |
| **Physical** | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ |
| **Service** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Human** | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |

`✗` = nicht anwendbar für diese Kategorie (konzeptuell auf Element-Ebene).

---

### Schritt 5 — Threat Preview (unmittelbares Feedback)

Direkt nach Cause-Mechanism-Auswahl erscheint die Threat Preview:

```
Threats die für dieses Asset generiert werden:

  Beziehung              Threat                   Severity
  ─────────────────────────────────────────────────────────
  P-13 stores            🔴 Tampering              Critical
  P-1  reads             🟠 Information Disclosure  High
  IF-8 accesses          🔴 Tampering              Critical
  A-9  depends_on (A2A)  🔴 DoS (Kaskade)          Critical
```

**Warum das wichtig ist:**

Der Analyst sieht sofort warum seine Bewertung relevant ist — nicht abstrakt als CIANAAA-Werte,
sondern als konkrete Threats auf konkreten Beziehungen. Das schafft Verständnis und erlaubt
sofortige Korrektur wenn etwas nicht stimmt.

---

### Schritt 6 — Nächstes Asset

Analyst klickt zum nächsten Asset. Die Threats werden im Hintergrund generiert.
Der vollständige Threat-Tab wird nach Abschluss aller Assets befüllt.

---

## 3. Skalenharmonisierung

### Problem (Current State)

- Asset Tab: `low | med | med+ | high | high+ | critical` (6 Stufen, teilweise manuell setzbar)
- CIANAAA: Boolean (zu ändern)
- Risk Tab: konfigurierbar 3/4/5-stufig

### Lösung: Eine kanonische Skala + berechnete Erweiterungen

**Manuelle Eingabeskala (5 Stufen — überall wo Analyst tippt):**

```typescript
type BaseImpactLevel = "none" | "low" | "medium" | "high" | "critical";
```

Gilt für: Impact-Kriterien, CIANAAA-Level (intern), Risk Tab Severity.

**Berechnete Ausgabeskala (7 Stufen — nur computed, nie manuell):**

```typescript
type DerivedCriticalityLevel = BaseImpactLevel | "medium_plus" | "high_plus";
```

`medium_plus` und `high_plus` sind **ausschliesslich berechnete Werte** basierend auf:

```
businessImpact=MEDIUM + safetyRelevance=indirect + safetyImpact∈{fatality|irreversible} 
→ aggregatedCriticality = "medium_plus"

businessImpact=HIGH + safetyRelevance=indirect + safetyImpact∈{fatality|irreversible}
→ aggregatedCriticality = "high_plus"
```

**Semantik (aus Dokumentation):**
- `high_plus` = "oberes Ende der HIGH-Stufe — systemischer Einfluss der durch hohe Likelihood zu CRITICAL eskalieren kann"
- Nie direkt zu CRITICAL elevated (nur indirect safety), braucht Likelihood-Kontext im Risk Tab

### Risk Tab: interne kanonische Skala, Display ist Bucketing

Risk Tab speichert intern immer `BaseImpactLevel` (0–4).
Die konfigurierbare 3/4/5-stufige Anzeige ist **reines Display-Bucketing**:

| Intern | 3-stufige Anzeige | 5-stufige Anzeige |
|---|---|---|
| none / low | Low | Low |
| medium | Medium | Medium |
| high | High | High |
| critical | High | Critical |

`very high` als eigenständige Anzeige-Option wird nicht unterstützt —
es gibt kein internes Äquivalent. Bestehende `very high`-Konfigurationen → `high`.

**Problem mit `medium_plus` / `high_plus` im Risk Tab:**

Wenn der Analyst Impact-Faktoren aus dem Asset Tab in den Risk Tab übernimmt,
darf `aggregatedCriticality` dort nicht als `medium_plus` oder `high_plus` erscheinen.

**Fix:** Beim Import Asset Tab → Risk Tab wird gemappt:

```typescript
function importToRiskTab(level: DerivedCriticalityLevel): BaseImpactLevel {
  if (level === "medium_plus") return "high";    // konservativ aufrunden
  if (level === "high_plus")   return "high";    // bleibt high, Likelihood entscheidet ob Critical
  return level;
}
```

`high_plus` → `high` im Risk Tab ist korrekt: der Eskalationspfad zu CRITICAL erfolgt
im Risk Tab durch die Likelihood-Bewertung — das ist die Intention des Designs.

### Aggregation: Max-Wins statt Durchschnitt

Die Gesamtbewertung eines Assets aggregiert immer über **Max-Wins**:

```typescript
function aggregateImpact(criteria: ImpactCriteria): BaseImpactLevel {
  return max(
    criteria.financial,
    criteria.operational,
    criteria.regulatory,
    criteria.recoverability,
    criteria.reputation,
    // Safety wird separat über Safety Override Rule behandelt
  );
}
```

Ein Asset mit Financial=Medium und Operational=Critical ist **Critical** — nicht `med+`.

---

### Risk Tab: Import-Modell und Affected Users

**Default: alle Asset-Impact-Faktoren werden übernommen**

```
Risk Tab erhält per default:
  ✅ Safety              ← aus Asset Tab importiert
  ✅ Operational         ← aus Asset Tab importiert
  ✅ Financial           ← aus Asset Tab importiert
  ✅ Regulatory          ← aus Asset Tab importiert
  ✅ Recoverability      ← aus Asset Tab importiert
  ✅ Affected Users      ← im Risk Tab gesetzt (NICHT aus Asset Tab)
```

Analyst kann einzelne Faktoren deaktivieren oder Werte manuell überschreiben.
Manuell überschriebene Werte erhalten einen Marker: `severitySource: "derived" | "manual"`.

**Affected Users gehört NICHT in den Asset Tab**

"Affected Users" ist kein intrinsischer Asset-Faktor — es ist ein threat-spezifischer
Scope-Faktor der je nach Angriffspfad stark variiert:

```
Derselbe Asset "Controller Firmware":
  Angriff via Debug-Interface  →  Affected Users: low   (1 Gerät)
  Angriff via OTA-Update-Server → Affected Users: critical (alle Geräte)
```

Würde "Affected Users" in den Asset Tab gezogen, müsste der Analyst bei jedem
Threat den Financial-Impact manuell rekalibrieren — das macht Bewertungen
inkonsistent und nicht auditierbar.

**Warum das kein Doppelzählungs-Problem ist:**

"Affected Users" wird ausschliesslich im Risk Tab gesetzt und nicht importiert.
Es fliesst wie alle anderen Faktoren in den Impact via Max-Wins ein:

```typescript
// Risk Tab Final Impact Berechnung:
function calculateRiskImpact(
  importedFactors: ImportedImpactFactors,
  affectedUsers: BaseImpactLevel
): BaseImpactLevel {
  return max(
    importedFactors.safety,
    importedFactors.operational,
    importedFactors.financial,
    importedFactors.regulatory,
    importedFactors.recoverability,
    affectedUsers,           // ← threat-spezifisch, nie aus Asset Tab
  );
}
```

**Kein separater Eskalations-Mechanismus nötig:**
Wenn fleet-wide = Critical, geht das in den MAX ein wie jeder andere Faktor.
Das Modell bleibt einfach und konsistent.

---

## 4. CIANAAA Typ-Definition (neu)

```typescript
type CIANAAALevel = "none" | "low" | "medium" | "high" | "critical";

interface CIANAAAAProperties {
  confidentiality?:   CIANAAALevel;  // nicht für: Function, Process, Physical, Human
  integrity?:         CIANAAALevel;  // nicht für: Human
  availability?:      CIANAAALevel;  // nicht für: Human
  nonRepudiation?:    CIANAAALevel;  // nicht für: System, Infrastructure, Physical, Human
  authentication?:    CIANAAALevel;  // nicht für: Data, Physical
  authorization?:     CIANAAALevel;  // nicht für: Data, Physical
  accountability?:    CIANAAALevel;  // nicht für: Infrastructure, Human
}

// Semantik des Levels:
// none     → kein Threat für diese STRIDE-Kategorie generieren
// low      → Threat generieren, Basis-Severity = Low
// medium   → Threat generieren, Basis-Severity = Medium
// high     → Threat generieren, Basis-Severity = High
// critical → Threat generieren, Severity = Critical (Override, gewinnt immer)
```

---

## 5. CIANAAA → STRIDE Mapping (deterministisch)

```typescript
const CIANAAA_TO_STRIDE: Record<keyof CIANAAAAProperties, STRIDECategory> = {
  confidentiality: "InformationDisclosure",
  integrity:       "Tampering",
  availability:    "DenialOfService",
  nonRepudiation:  "Repudiation",
  authentication:  "Spoofing",
  authorization:   "ElevationOfPrivilege",
  accountability:  "Repudiation",
};

const RELATIONSHIP_TRIGGERS: Record<RelationshipType, (keyof CIANAAAAProperties)[]> = {
  creates:    ["integrity"],
  reads:      ["confidentiality"],
  modifies:   ["integrity", "accountability"],
  stores:     ["integrity", "availability"],
  transports: ["confidentiality", "integrity"],
  executes:   ["integrity", "availability", "authentication"],
  controls:   ["integrity", "authorization"],
  configures: ["integrity", "authorization"],
  depends_on: ["availability"],
  exposes:    ["confidentiality", "integrity"],
  uses:       ["authentication", "authorization"],
  monitors:   ["availability"],
  invokes:    ["authentication", "authorization"],
  implements: ["integrity"],
};

function generateThreats(
  element: DFDElement,
  asset: Asset,
  relationship: ElementToAssetRelation
): Threat[] {
  const triggers = RELATIONSHIP_TRIGGERS[relationship.type] ?? [];
  const applicable = CIANAAA_APPLICABLE[asset.category] ?? {};

  return triggers
    .filter(dim => applicable[dim] !== false)           // Kategorie-Filter
    .filter(dim => asset.cianaaa[dim] !== "none")       // Level-Filter
    .map(dim => ({
      stride:   CIANAAA_TO_STRIDE[dim],
      severity: asset.cianaaa[dim]!,                    // direkt aus CIANAAA-Level
      source:   element,
      target:   asset,
      via:      relationship,
    }));
}
```

---

## 6. Implementierungsscope

### Dateien die geändert werden müssen

**`element-properties.ts`**
- CIANAAA: `boolean` → `CIANAAALevel` für alle 7 Dimensionen
- Neuen Typ `CIANAAALevel` exportieren
- Neuen Typ `BaseImpactLevel` exportieren
- Neuen Typ `DerivedCriticalityLevel` exportieren

**Asset-Description-Form (TSX)**
- CIANAAA-Checkboxen entfernen (nicht mehr im Standard-Workflow sichtbar)
- Neuer Step "Wie könnte der Schaden eintreten?" mit 7 Cause-Mechanism-Checkboxen
- Cause Mechanism → CIANAAA Ableitung (intern, nicht angezeigt)
- Threat Preview Sektion nach Cause Mechanism

**`element-property-defaults.ts`**
- Boolean Defaults → `CIANAAALevel` Defaults aus Kategorie-Defaults
- Impact-Aggregation: Durchschnitt → Max-Wins

**Asset Inventory View**
- Sortierung implementieren: HVA + Element-Count + EL3-Interfaces + TB-Crossings
- Status-Indikator: unbewertet / teilweise / vollständig

**Risk Tab**
- `importToRiskTab()` Funktion: `DerivedCriticalityLevel` → `BaseImpactLevel`
- `medium_plus` und `high_plus` dürfen im Risk Tab nicht als-solche erscheinen
- Display-Bucketing für 3/4/5-stufige Anzeige (rein UI, kein Datenmodell)

**Threat Generator**
- `generateThreats()` Funktion implementieren (siehe Abschnitt 5)
- `CIANAAA_APPLICABLE` Map (Kategorie → anwendbare Dimensionen)
- `RELATIONSHIP_TRIGGERS` Map (Beziehungstyp → betroffene CIANAAA-Dimensionen)

**Schema-Migration**
- Bestehende `cianaaa.x === true` → `"high"` (konservativ)
- Bestehende `cianaaa.x === false` → `"none"`
- `schemaVersion` in `dfd.json` von 1 → 2

### Was der nächste Chat benötigt

Bitte folgende Dateien hochladen:
- `element-properties.ts` (Asset-Properties-Definition inkl. CIANAAAAProperties)
- Asset-Description-Form TSX (wo Checkboxen gerendert werden)
- `element-property-defaults.ts`
- Den Threat-Generator-Einstiegspunkt
- Die Risk-Tab-Import-Logik (wo Asset-Impact in Risk Tab übernommen wird)
- `asset-types.ts` oder wo `AssetCategory` definiert ist

---

## 7. Abgrenzung: Was NICHT geändert wird

**Safety Override Rule und HVA Override Rule bleiben unverändert.**
Sie arbeiten weiterhin auf `DerivedCriticalityLevel` und erzwingen korrekt
`high_plus` oder `critical` als Ausgabe.

**AuthN/AuthZ bleiben auch auf Element-/Prozess-Ebene.**
Auf Asset-Ebene: Schutzziel-Anforderung. Auf Element-Ebene: Implementierung.
Keine Redundanz — verschiedene Schichten.

**Safety-Properties bleiben separate Felder.**
`safetyRelevant`, `crossesSafetyBoundary`, `safetyRationale` werden nicht in
CIANAAA integriert. Safety hat eigene Propagation-Logik (Safety Override Rule).

**`medium_plus` und `high_plus` bleiben im Modell** — als berechnete Werte
für Safety-Indirect-Kontext. Sie sind nie manuell setzbar und erscheinen nicht
im Risk Tab (werden dort auf `high` gemappt).
