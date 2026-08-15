# TARAflow — Handover: CIANAAA Refactoring

## Kontext & Zweck

TARAflow ist ein TARA-Tool (Threat Analysis and Risk Assessment) für OT/Embedded-Systeme.
Assets haben aktuell Schutzziele (CIANAAA) als **Boolean-Checkboxen** definiert.
Diese sollen auf eine **5-stufige Severity-Skala** umgestellt werden.

**Warum:** CIANAAA ist der primäre Input für den Threat Generator. Die Kombination aus
`Asset-Kategorie × CIANAAA-Level × Element-zu-Asset-Beziehungstyp` bestimmt deterministisch
welche STRIDE-Threats generiert werden und mit welcher Basis-Severity.

---

## Problem (Current State)

```typescript
// Aktuell (Boolean — nur: generieren ja/nein)
cianaaa: {
  confidentiality: boolean;
  integrity: boolean;
  availability: boolean;
  nonRepudiation: boolean;
  authentication: boolean;
  authorization: boolean;
  accountability: boolean;
}
```

- CIANAAA taucht aktuell **nur im Attack Tree** auf, nicht im Threat Generator
- Boolean gibt keine Severity-Information → alle generierten Threats gleich gewichtet
- Kein deterministischer Zusammenhang: gleiche Eingabe → unterschiedliche Threats möglich

---

## Design-Entscheidungen (bereits getroffen)

### 1. Neuer Typ: CIANAAALevel

```typescript
type CIANAAALevel = "none" | "low" | "medium" | "high" | "critical";

// Semantik für Threat Generator:
// none     → kein Threat für diese STRIDE-Kategorie generieren
// low      → Threat generieren, Basis-Severity = Low
// medium   → Threat generieren, Basis-Severity = Medium
// high     → Threat generieren, Basis-Severity = High
// critical → Threat generieren, Severity = Critical (Override, gewinnt immer)
```

Gleiche Skala wie `impactCriteria` → Konsistenz im gesamten Modell.

### 2. Alle 7 Dimensionen verwenden dieselbe 5-stufige Skala

Obwohl N/AuthN/AuthZ/Acc eher Anforderungen als Gradationen sind, wird aus
Konsistenzgründen dieselbe Skala verwendet. Der Analyst muss nicht zwischen
verschiedenen Skalierungslogiken unterscheiden.

### 3. CIANAAA → STRIDE Mapping (deterministisch)

| CIANAAA-Dimension | STRIDE-Kategorie | Wird ausgelöst durch Beziehungstyp |
|---|---|---|
| Confidentiality (C) | Information Disclosure (I) | `reads`, `transports`, `stores` |
| Integrity (I) | Tampering (T) | `creates`, `modifies`, `stores`, `executes`, `controls`, `configures` |
| Availability (A) | Denial of Service (D) | `depends_on`, `executes`, `powers`, `monitors` |
| Non-Repudiation (N) | Repudiation (R) | `creates`, `modifies`, `deletes` |
| Authentication (AuthN) | Spoofing (S) | `uses`, `controls`, `invokes`, `executes` |
| Authorization (AuthZ) | Elevation of Privilege (E) | `controls`, `configures`, `executes`, `modifies` |
| Accountability (Acc) | Repudiation (R) | alle schreibenden Beziehungen |

### 4. Threat Generator Flow (Zielarchitektur)

```typescript
function generateThreats(
  element: DFDElement,
  asset: Asset,
  relationship: ElementToAssetRelation
): Threat[] {
  const applicableSTRIDE = mapToSTRIDE(
    asset.cianaaa,        // CIANAAAProperties mit Levels
    relationship.type,    // creates | stores | controls | depends_on | ...
    asset.category        // data | function | system | service | ...
  );

  return applicableSTRIDE
    .filter(({ level }) => level !== "none")          // none = kein Threat
    .map(({ stride, level }) => ({
      stride,
      baseSeverity: level,                            // direkt aus CIANAAA
      source: element,
      target: asset,
      via: relationship,
      // Finale Severity = max(baseSeverity, asset.impactSeverity)
    }));
}
```

### 5. Auto-Ableitung aus Asset-Kategorie (Defaults)

Beim Erstellen eines Assets werden Defaults aus der Kategorie abgeleitet.
Analyst kann jeden Wert überschreiben.

---

## CIANAAA Defaults pro Asset-Kategorie

### 📄 Data Asset
*Atomare Werte, Konfigurationen, Logs, Credentials, Messwerte*

| Dimension | Default | Begründung |
|---|---|---|
| C | `medium` | Variiert stark nach Inhalt — Analyst muss justieren |
| I | `high` | Daten-Integrität fast immer kritisch |
| A | `medium` | Hängt von Nutzungskontext ab |
| N | `low` | Basis-Audit-Trail sinnvoll |
| AuthN | `none` | Auth ist Element-Sache, nicht Data-Sache |
| AuthZ | `none` | Auth ist Element-Sache, nicht Data-Sache |
| Acc | `low` | Wer hat Daten verändert? |

**Wichtige Abweichungen vom Default (Analyst-Hinweis im UI):**
- Credentials / Passwords → C=`critical`, I=`critical`
- Public Measurement Data → C=`none`, A=`high`
- Firmware Image → C=`high`, I=`critical`
- Calibration Parameters → C=`high`, I=`critical`, A=`low`
- Audit Logs → C=`low`, I=`high`, N=`high`, Acc=`high`

---

### ⚙️ Function Asset
*Fähigkeiten/Capabilities: Grenzwert-Überwachung, Kalibrierungsfunktion, Authentifizierung*

| Dimension | Default | Begründung |
|---|---|---|
| C | `none` | Funktionen selbst sind nicht vertraulich |
| I | `high` | Funktionsverhalten darf nicht manipuliert werden |
| A | `high` | Funktion muss verfügbar sein wenn gebraucht |
| N | `none` | Funktionen haben keine Repudiation im klassischen Sinn |
| AuthN | `medium` | Wer darf diese Funktion aufrufen? |
| AuthZ | `medium` | Hat der Aufrufer die Berechtigung? |
| Acc | `low` | Wer hat die Funktion ausgelöst? |

**Wichtige Abweichungen:**
- Safety-kritische Funktionen (Not-Halt, Alarmierung) → A=`critical`, I=`critical`
- Authentifizierungsfunktion selbst → AuthN=`high`, AuthZ=`high`, Acc=`high`

---

### 🔄 Process Asset
*Aktive Abläufe zur Laufzeit: Firmware-Update-Prozess, Kalibrierungsprozess, Messprozess*

| Dimension | Default | Begründung |
|---|---|---|
| C | `none` | Prozessausführung selbst nicht vertraulich |
| I | `high` | Sequenz und Zustand des Prozesses dürfen nicht manipuliert werden |
| A | `high` | Prozess soll vollständig durchlaufen |
| N | `medium` | Kann bewiesen werden dass Prozess ausgeführt wurde? |
| AuthN | `medium` | Wer darf Prozess starten? |
| AuthZ | `high` | Nur Autorisierte dürfen starten/stoppen |
| Acc | `medium` | Accountability für Prozessausführung |

**Wichtige Abweichungen:**
- Firmware-Update-Prozess → I=`critical`, AuthN=`high`, AuthZ=`critical`
- Kalibrierungsprozess → I=`critical`, N=`high`, Acc=`high`

---

### 💻 System Asset
*Blackbox-Komponenten: SiDis AD 40, TurBiScat PM 40, Backend, SCADA*

| Dimension | Default | Begründung |
|---|---|---|
| C | `low` | Systemkonfiguration teilweise vertraulich |
| I | `high` | System darf nicht manipuliert werden |
| A | `high` | System muss verfügbar sein |
| N | `none` | Systeme haben selten Repudiation-Anforderungen |
| AuthN | `high` | Wer darf das System steuern? |
| AuthZ | `high` | Welche Operationen sind autorisiert? |
| Acc | `medium` | Wer hat Systemzustand verändert? |

**Wichtige Abweichungen:**
- Embedded Controller (MCU, SOM) → I=`critical`, A=`critical`
- Safety-System → alle relevanten Dims auf `critical`

---

### 🏭 Infrastructure Asset
*Umgebung/Arena: OT-Netz, Produktionsnetzwerk, Serverraum, Netzwerksegment*

| Dimension | Default | Begründung |
|---|---|---|
| C | `low` | Netzwerkstruktur teilweise vertraulich |
| I | `medium` | Physische/logische Konfiguration |
| A | `high` | Infrastruktur-Ausfall = alles fällt aus |
| N | `none` | |
| AuthN | `medium` | Physische Zugangskontrolle |
| AuthZ | `medium` | Wer darf auf Infra zugreifen? |
| Acc | `low` | |

**Wichtige Abweichungen:**
- Kritisches OT-Netz → A=`critical`, AuthN=`high`
- High-Value Infrastructure → alle Dims erhöhen (HVA-Override greift)

---

### 🔌 Physical Asset
*Passive Sachwerte ohne Software: Kabel, Gehäuse, Sensorkopf, M12-Stecker*

| Dimension | Default | Begründung |
|---|---|---|
| C | `none` | Physische Objekte haben keine Vertraulichkeit |
| I | `medium` | Physische Integrität — ist es das Original? |
| A | `high` | Physisches Asset soll vorhanden und funktional sein |
| N | `none` | |
| AuthN | `none` | Objekte authentifizieren sich nicht (Ausnahme: isUnique=true) |
| AuthZ | `none` | |
| Acc | `low` | Wer ist für dieses Asset verantwortlich? |

**Wichtige Abweichungen:**
- `isUnique=true` (Unikat, Fälschungsrisiko) → AuthN=`low` (Anti-Counterfeiting)
- Safety-relevantes Physical Asset → I=`critical`, A=`critical`

**Hinweis:** Physical Assets haben keine direkten DFD-Element-Verbindungen ausser
`ExternalEntity → damages` (Sabotage-Szenario). Die meisten Threats kommen über
Asset-zu-Asset-Beziehungen (Ebene 2).

---

### 🔌 Service Asset
*Interne/externe Dienste: Sigrist Update Server, WLAN AP, Certificate Store, Web Server*

| Dimension | Default | Begründung |
|---|---|---|
| C | `medium` | Servicedaten und -konfiguration vertraulich |
| I | `high` | Service liefert korrekte Ergebnisse |
| A | `high` | Service-Ausfall propagiert via depends_on-Ketten |
| N | `medium` | Können Service-Aktionen zugeordnet werden? |
| AuthN | `high` | Wer darf diesen Service nutzen? |
| AuthZ | `high` | Welche Operationen sind autorisiert? |
| Acc | `medium` | Audit-Trail für Service-Nutzung |

**Wichtige Abweichungen:**
- Update Server (Supply Chain) → I=`critical`, AuthN=`critical`, A=`high`
- Certificate Store → C=`critical`, I=`critical`, A=`critical`
- Managed External Service (third-party) → A=`critical`, AuthN=`high`
  → Bei `responsibility=third-party`: `responsibilityScope` Pflichtfeld (CRA Art. 13)

---

### 👤 Human Asset
*Personen als Schutzsubjekte und Akteure: Operator, Techniker, Administrator*

Human Assets sind Schutzsubjekte — die CIANAAA-Semantik ist anders als bei
digitalen Assets. Threats gegen Menschen sind primär Safety und Privacy.

| Dimension | Default | Begründung |
|---|---|---|
| C | `low` | Datenschutz: personenbezogene Daten dieser Person |
| I | `none` | Menschen sind kein Datensatz der "tampered" werden kann |
| A | `none` | Menschen sind externe Entitäten, nicht "verfügbar" im IT-Sinn |
| N | `none` | |
| AuthN | `low` | Ist diese Person wer sie vorgibt zu sein? |
| AuthZ | `low` | Was ist diese Person berechtigt zu tun? |
| Acc | `high` | Menschliche Accountability ist zentral |

**Hinweis:** Für Human Assets sind die Domain Extensions relevanter als CIANAAA:
- `affects_safety` → Safety-Threat (direct/indirect)
- `affects_privacy` → Privacy/InfoDisclosure-Threat
- `isProtectionTarget` → Pflicht-Threat: Safety wenn direkt exponiert

**Wichtige Abweichungen:**
- Administrator → AuthN=`high`, AuthZ=`high`, Acc=`critical`
- Person mit Zugang zu Safety-kritischen Systemen → Acc=`critical`

---

## Implementierungsscope

### Dateien die geändert werden müssen

1. **`element-properties.ts`** (oder wo `CIANAAAAProperties` definiert ist)
   - `boolean` → `CIANAAALevel` für alle 7 Dimensionen
   - Neuen Typ `CIANAAALevel` exportieren

2. **Asset-Description-Form** (TSX-Datei mit Checkbox-Rendering)
   - 7 × `Checkbox` → 7 × `Select` mit den 5 Optionen
   - Tooltip pro Dimension (STRIDE-Referenz)

3. **`element-property-defaults.ts`**
   - Bestehende boolean Defaults → `CIANAAALevel` Defaults
   - Defaults nach Asset-Kategorie aus diesem Dokument

4. **Threat Generator** (Hauptziel)
   - `mapToSTRIDE(cianaaa, relationshipType, assetCategory)` implementieren
   - Generator verwendet Level als Basis-Severity
   - `none` → kein Threat, alle anderen → Threat mit entsprechender Severity

### Was der nächste Chat benötigt

Bitte folgende Dateien hochladen:
- `element-properties.ts` (Asset-Properties-Definition inkl. CIANAAAAProperties)
- Das Asset-Description-Form TSX (wo Checkboxen gerendert werden)
- `element-property-defaults.ts`
- Den Threat-Generator-Einstiegspunkt (Datei die Threats generiert und CIANAAA liest)
- Ggf. `asset-types.ts` oder wo `AssetCategory` definiert ist

---

## Abgrenzung: Was NICHT geändert wird

- **AuthN/AuthZ bleiben auch auf Element-/Prozess-Ebene** (ProcessProperties,
  DataFlowProperties) — das ist korrekt und redundanzfrei. Auf Asset-Ebene
  beschreiben sie die Anforderung AN das Asset, auf Element-Ebene die
  Implementierung AM Element.
- **Safety-Properties bleiben separate Felder** — `safetyRelevant`,
  `crossesSafetyBoundary`, `safetyRationale` werden nicht in CIANAAA integriert.
  Safety hat eigene Propagation-Logik (Safety Override Rule).
- **Impact-Kriterien bleiben unverändert** — CIANAAA-Level beeinflusst
  Threat-Basis-Severity, Impact-Kriterien bestimmen Asset-Kritikalität.
  Beide fliessen separat in die finale Risk-Berechnung.
