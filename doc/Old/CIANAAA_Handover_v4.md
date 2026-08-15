# TARAflow — Handover: CIANAAA & Asset-Tab Refactoring

**Version 4** — Asset Tab vollständig implementiert; offene Punkte: Threat-Generierung, Risk-Tab-Import

**Status:**
- ✅ Asset Tab / CIANAAA-Datenmodell — implementiert
- ✅ Cause Mechanism UI + Derivations-Pipeline — implementiert
- ✅ i18n-Migration aller Typ-Dateien — implementiert
- 🔲 Threat-Generierung (RelationStrategy mit CIANAAALevel) — offen
- 🔲 Risk-Tab-Import-Modell — offen

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
| Manipulation des Inhalts | Integrity (I) | Tampering (T) |
| Offenlegung des Inhalts | Confidentiality (C) | Information Disclosure (I) |
| Ausfall / Nichtverfügbarkeit | Availability (A) | Denial of Service (D) |
| Identitätsmissbrauch | Authentication (AuthN) | Spoofing (S) |
| Unautorisierter Zugriff | Authorization (AuthZ) | Elevation of Privilege (E) |
| Fehlender Nachweis | Non-Repudiation (N) | Repudiation (R) |
| Fehlende Zurechenbarkeit | Accountability (Acc) | Repudiation (R) |

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

### Schritt 1 — Asset verstehen ✅

Der Analyst sieht Kontext im Dialog (Tab 0 "Impact Assessment"):

```
Asset:     Kalibrierparameter
Kategorie: Data
Verknüpft mit:
  P-13 Calibration Controller  ──stores──▶  [dieses Asset]
  P-1  Optical Sensor          ──reads──▶   [dieses Asset]
  IF-8 Debug UART              ──accesses──▶[dieses Asset]
```

---

### Schritt 2 — Impact Assessment ✅

*"Was passiert wenn dieses Asset kompromittiert wird?"*

Tab 0 ("Impact Assessment") enthält:
- Impact-Ratings pro Kriterium (Safety, Operational, Financial, Regulatory, Recoverability, …)
- Safety Override (manuell, mit Rationale-Pflicht)
- HVA-Bewertung (nur für Infrastructure/Physical)

| Kriterium | Brauerei | Tunnelbetreiber | Wasseraufbereitung |
|---|---|---|---|
| Safety | Low | Critical | Critical |
| Operational | Critical | Critical | Critical |
| Financial | High | High | High |
| Regulatory | High | Critical | Critical |
| Recoverability | High | High | High |

---

### Schritt 3 — Cause Mechanism Auswahl ✅

*"Wie könnte dieser Schaden eintreten?"*

Tab 1 ("Derived Protection Requirements") — Sektion "Wie könnte der Schaden eintreten?":

```
  ☑ Manipulation des Inhalts        [I — Critical]  ↳ safety = 4 → critical · Content Manipulation
  ☑ Ausfall / Nichtverfügbarkeit    [A — High]
  ☐ Offenlegung des Inhalts         [Graph suggestion]
  ☐ Identitätsmissbrauch
  ☐ Unautorisierter Zugriff
  ☐ Fehlender Nachweis
  ☑ Fehlende Zurechenbarkeit        [Acc — High]
```

**Implementierungsdetails:**
- Graph-vorgeschlagene Goals werden **automatisch vorausgewählt** beim Öffnen des Dialogs
- Level = `MAX(relevante Impact-Kriterien)` via `CAUSE_MECHANISM_CRITERIA`
- Fallback: `MAX(alle impactRatings)` wenn keine spezifischen Kriterien bewertet (`computeMaxRatingLevel`)
- Absolutes Minimum: `"low"` — nie `"none"` für graph-suggested Goals
- Source-Tracking: `"suggested"` (Graph) | `"manual"` (Analyst-Override)
- "Manually excluded" Chip wenn Analyst ein vorgeschlagenes Goal deaktiviert

---

### Schritt 4 — Protection Strength Override ✅

In der Sektion "Derived Protection Requirements" (Accordion pro aktivem Schutzziel):

```
┌─ I — Integrity  [Critical]  [Graph suggestion] ─────────────────────────────┐
│  [Low] [Medium] [High] [Critical ✓]                                          │
│  ↳ safety = 4 → critical · Manipulation des Inhalts                         │
│  Formal requirement: _________________________________ [📝]                 │
└──────────────────────────────────────────────────────────────────────────────┘
```

- `ToggleButtonGroup` Low/Medium/High/Critical für manuelle Anpassung
- Derivation Trace (`↳ …`) immer sichtbar wenn vorhanden
- Rationale-Pflichtfeld wenn `source === "manual"` (IEC 62443-4-1)

---

### Schritt 5 — Threat Preview 🔲 (offen)

*Noch nicht implementiert — Voraussetzung: RelationStrategy mit CIANAAALevel.*

Geplant: Direkt nach Cause-Mechanism-Auswahl erscheint eine Vorschau der Threats die
für dieses Asset generiert werden:

```
Threats die für dieses Asset generiert werden:

  Beziehung              Threat                   Severity
  ─────────────────────────────────────────────────────────
  P-13 stores            🔴 Tampering              Critical
  P-1  reads             🟠 Information Disclosure  High
  IF-8 accesses          🔴 Tampering              Critical
  A-9  depends_on (A2A)  🔴 DoS (Kaskade)          Critical
```

---

### Schritt 6 — Nächstes Asset

Analyst klickt zum nächsten Asset. Threats werden im Hintergrund generiert.

---

## 3. Implementierter Stand — Typen und Services

### CIANAAALevel

```typescript
// asset-security-goals-types.ts
type CIANAAALevel = "none" | "low" | "medium" | "high" | "critical";

// Semantik:
// none     → nicht anwendbar oder nicht bewertet; kein Threat
// low      → Threat generieren, Basis-Impact = Low
// medium   → Threat generieren, Basis-Impact = Medium
// high     → Threat generieren, Basis-Impact = High
// critical → Threat generieren, Impact = Critical (Override, gewinnt immer)
```

### SecurityGoal (migriert von boolean)

```typescript
// war: { type, enabled: boolean, formalDescription }
// neu:
interface SecurityGoal {
  type:              SecurityGoalType;      // "C"|"I"|"A"|"N"|"AuthZ"|"AuthN"|"Acc"
  level:             CIANAAALevel;          // "none"|"low"|"medium"|"high"|"critical"
  formalDescription: string;               // verbindliche Schutzanforderung
  source?:           "suggested"|"manual"; // Herkunft (IEC 62443-4-1 Audit Trail)
  rationale?:        string;               // Pflicht bei source === "manual"
}

// Migration (asset-migration.ts):
// enabled: true  → level: "high"  (konservativ)
// enabled: false → level: "none"
```

### Cause Mechanism Mapping

```typescript
// asset-security-goals-types.ts

type CauseMechanismType =
  | "content_manipulation"    // → I (Integrity)
  | "content_disclosure"      // → C (Confidentiality)
  | "unavailability"          // → A (Availability)
  | "identity_abuse"          // → AuthN (Authentication)
  | "unauthorized_access"     // → AuthZ (Authorization)
  | "missing_evidence"        // → N (Non-Repudiation)
  | "missing_accountability"; // → Acc (Accountability)

const CAUSE_MECHANISM_TO_GOAL: Record<CauseMechanismType, SecurityGoalType>;

// Impact-Kriterien die den Level pro Mechanism treiben (MAX wins):
const CAUSE_MECHANISM_CRITERIA: Record<CauseMechanismType, string[]> = {
  content_manipulation:    ["safety", "operational", "financial_damage", "regulatory_compliance"],
  content_disclosure:      ["regulatory_compliance", "financial_damage", "reputation"],
  unavailability:          ["operational", "recoverability"],
  identity_abuse:          ["safety", "operational", "regulatory_compliance"],
  unauthorized_access:     ["safety", "operational", "regulatory_compliance", "financial_damage"],
  missing_evidence:        ["regulatory_compliance"],
  missing_accountability:  ["regulatory_compliance", "operational"],
};
```

### CIANAAA_APPLICABLE Matrix

```typescript
// Welche CIANAAA-Dimensionen sind pro Asset-Kategorie anwendbar:
const CIANAAA_APPLICABLE: Record<AssetGroup, Record<SecurityGoalType, boolean>> = {
  data:           { C:true,  I:true,  A:true,  N:true,  AuthN:false, AuthZ:false, Acc:true  },
  function:       { C:false, I:true,  A:true,  N:true,  AuthN:true,  AuthZ:true,  Acc:true  },
  process:        { C:false, I:true,  A:true,  N:true,  AuthN:true,  AuthZ:true,  Acc:true  },
  system:         { C:true,  I:true,  A:true,  N:false, AuthN:true,  AuthZ:true,  Acc:true  },
  infrastructure: { C:true,  I:true,  A:true,  N:false, AuthN:true,  AuthZ:true,  Acc:false },
  physical:       { C:false, I:true,  A:true,  N:false, AuthN:false, AuthZ:false, Acc:true  },
  service:        { C:true,  I:true,  A:true,  N:true,  AuthN:true,  AuthZ:true,  Acc:true  },
  human:          { C:true,  I:false, A:false, N:false, AuthN:true,  AuthZ:true,  Acc:true  },
};
```

### CIANAAA → STRIDE Mapping

```typescript
// asset-security-goals-types.ts
const CIANAAA_TO_STRIDE: Record<SecurityGoalType, StrideCategory> = {
  C:     "I",  // Information Disclosure
  I:     "T",  // Tampering
  A:     "D",  // Denial of Service
  N:     "R",  // Repudiation
  AuthN: "S",  // Spoofing
  AuthZ: "E",  // Elevation of Privilege
  Acc:   "R",  // Repudiation
};
```

### BASE_RULES (assetGroup-aware, feingranularer als RELATIONSHIP_TRIGGERS)

```typescript
// asset-cianaaa-deriver.ts
// Key: "assetGroup:relationType[:qualifier]"
// Nicht wie im Handover v3 als flacher RELATIONSHIP_TRIGGERS — assetGroup ist Teil des Keys
const BASE_RULES: Record<string, SecurityGoalType[]> = {
  "data:stores":          ["I", "A"],   // + C* wenn isSecureStorage
  "data:reads":           ["C", "AuthZ"],
  "data:modifies":        ["I", "AuthZ", "N"],
  "data:creates":         ["I", "AuthN", "N"],  // + Acc** wenn isPersonalData
  "process:is_an":        ["I", "A"],   // + C* wenn isBusinessSecret
  "system:controls":      ["I", "A", "AuthZ"],
  "system:uses:network":  ["AuthN", "AuthZ", "I"],
  // ... weitere Regeln
};
```

### Derivations-Pipeline (asset-cianaaa-deriver.ts)

```
1. BASE_RULES[assetGroup:relationType[:qualifier]] → applicable SecurityGoalTypes
2. CIANAAA_APPLICABLE[assetGroup] → Kategoriefilter
3. CAUSE_MECHANISM_CRITERIA[mechanism] → MAX(relevante impactRatings) → CIANAAALevel
4. Fallback: computeMaxRatingLevel(impactRatings) wenn keine spezifischen Kriterien bewertet
   → Absolutes Minimum: "low" (nie "none" für graph-suggested Goals)
5. source: "suggested" | "manual" + rationale (Pflicht bei "manual")
6. explainSuggestion() → Derivations-Trace für UI-Transparenz
```

### i18n Key-Prefixes (keine hardcodierten Texte mehr in Typ-Dateien)

```typescript
SECURITY_GOAL_KEY_PREFIX   = "tabs.assets.securityGoals"   // .{type}.{name|description|template}
CAUSE_MECHANISM_KEY_PREFIX = "tabs.assets.causeMechanism"  // .{mechanism}.{label|description}
CIANAAA_LEVEL_KEY_PREFIX   = "tabs.assets.cianaaa.level"   // .{level}
IMPACT_CRITERION_KEY_PREFIX = "tabs.assets.impactCriteria" // .{id}.{name|description}
IMPACT_SCALE_KEY_PREFIX    = "tabs.assets.impactScale"     // .{scaleType}.{value}.label
```

---

## 4. Offene Punkte — Nächster Commit

### 4.1 Threat-Generierung: RelationStrategy mit CIANAAALevel

**Ziel:** `RelationStrategy` nutzt Asset-`securityGoals[].level` statt des alten
`RELATION_TO_STRIDE` um STRIDE-Kategorien abzuleiten, und setzt `initialImpact`
basierend auf dem CIANAAALevel.

**Aktuelle `relation-strategy.ts`:**
```typescript
// Heute: relationType → STRIDE direkt (bypassed CIANAAA)
const RELATION_TO_STRIDE: Record<AnyAssetRelationType, StrideCategory[]> = {
  creates: ["T"], modifies: ["T"], stores: ["T", "I"], ...
};
```

**Ziel-Implementierung:**
```typescript
// Neu: Asset.securityGoals[].level → STRIDE + initialImpact
function getStrideCategories(element, baseCategories, project): StrideCategory[] {
  // 1. Finde alle Assets die mit diesem Element verknüpft sind
  // 2. Für jedes Asset: active securityGoals (level !== "none")
  // 3. CIANAAA_TO_STRIDE → StrideCategory[]
  // 4. Union aller Kategorien über alle verknüpften Assets
}

// Neues Konzept: initialImpact auf Threat-Objekt
function getInitialImpact(element, strideCategory, project): CIANAAALevel {
  // Lookup: welcher Asset + welches SecurityGoal treibt diese STRIDE-Kategorie?
  // → level als initialImpact auf das Threat-Objekt schreiben
}
```

**Voraussetzung:** `ThreatProjectData` muss `assets?: AssetData` enthalten damit
`relation-strategy.ts` auf `securityGoals` zugreifen kann.

**Benötigte Dateien für nächsten Chat:**
- `relation-strategy.ts` (bereits gesehen — braucht Umbau)
- `threat-types.ts` (ThreatProjectData-Struktur + Threat-Interface)
- `per-element-generator.ts` oder der Haupt-Generator-Einstiegspunkt
- `risk-types.ts` (für das Impact-Feld)

### 4.2 Risk-Tab-Import-Modell

**Ziel:** Asset-Impact-Faktoren werden per default in den Risk Tab importiert.

```
Risk Tab erhält per default:
  ✅ Safety              ← aus Asset Tab
  ✅ Operational         ← aus Asset Tab
  ✅ Financial           ← aus Asset Tab
  ✅ Regulatory          ← aus Asset Tab
  ✅ Recoverability      ← aus Asset Tab
  ➕ Affected Users      ← im Risk Tab gesetzt (NICHT aus Asset Tab, threat-spezifisch)
```

Analyst kann einzelne Faktoren deaktivieren oder Werte manuell überschreiben.
Manuell überschriebene Werte erhalten Marker: `severitySource: "derived" | "manual"`.

**Affected Users gehört NICHT in den Asset Tab** — es ist ein threat-spezifischer
Scope-Faktor der je nach Angriffspfad stark variiert.

**Risk Tab Formel:** Likelihood × Impact (kein DREAD mehr)

```typescript
// Direkte Impact-Übernahme aus CIANAAALevel:
// critical → Impact = 4
// high     → Impact = 3
// medium   → Impact = 2
// low      → Impact = 1
// none     → kein Threat (kein Risk-Eintrag)

// Risk Score = Likelihood × Impact (beide 1-4)
```

**Benötigte Dateien für nächsten Chat:**
- `risk-types.ts` (vollständig)
- Risk-Tab-Komponente oder Import-Service

---

## 5. Abgrenzung: Was NICHT geändert wurde / wird

**Safety Override Rule und HVA Override Rule bleiben unverändert.**
Sie arbeiten weiterhin auf `aggregatedImpact` (`"LOW"|"MED"|"MED+"|"HIGH"|"HIGH+"|"CRITICAL"`)
in `asset-physical-impact-deriver.ts`.

**`aggregatedImpact` ist unabhängig von `CIANAAALevel`.**
`aggregatedImpact` beschreibt die Business+Safety-Gesamtbewertung des Assets.
`CIANAAALevel` beschreibt den Schutzbedarf einer spezifischen Dimension.
Beides koexistiert — kein Konflikt.

**AuthN/AuthZ bleiben auch auf Element-/Prozess-Ebene.**
Auf Asset-Ebene: Schutzziel-Anforderung. Auf Element-Ebene: Implementierung.
Keine Redundanz — verschiedene Schichten.

**Safety-Properties bleiben separate Felder.**
`physicalImpact`, `physicalImpactSource`, `physicalImpactRationale` werden nicht in
CIANAAA integriert. Safety hat eigene Propagation-Logik (Safety Override Rule).

**`DerivedCriticalityLevel` (`"MED+"|"HIGH+"`) bleibt im Modell** — als berechnete
Werte für `aggregatedImpact` bei Safety-Indirect-Kontext. Sie sind nie manuell
setzbar und erscheinen nicht im Risk Tab (werden dort auf `"high"` gemappt).

---

## 6. Für den nächsten Chat

**Bitte folgende Dateien hochladen:**

Für Threat-Generierung:
- `relation-strategy.ts`
- `threat-types.ts` (vollständig — ThreatProjectData + Threat-Interface)
- Haupt-Generator (per-element oder orchestrierender Service)

Für Risk-Tab-Import:
- `risk-types.ts` (vollständig)
- Risk-Tab Import-Service oder die Komponente die Assets → Risk überträgt

**Dieses Dokument mitgeben** als Kontext-Grundlage.
