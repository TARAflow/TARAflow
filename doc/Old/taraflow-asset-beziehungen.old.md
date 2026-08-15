# Asset-Beziehungen in TARAflow

## Konzept

Die Beziehungen zwischen DFD-Elementen und Assets folgen dem **"Active-Impact Modell"** für präzise Bedrohungsanalyse (TARA):

```
DFD-Element → wirkt auf → Asset
```

### Zwei Perspektiven für vollständige Threat-Analyse

1. **Angriffsvektor** (`uses` mit Qualifiern): *Wie* kann ein Angreifer das System kompromittieren?
2. **Schadenspotenzial** (`depends_on`): *Welche* Kaskadeneffekte entstehen bei Ausfall?

| Beziehung | Fokus | TARA-Relevanz |
|-----------|-------|---------------|
| `uses` | Interaktion | Wo ist der Angriffsvektor? (Likelihood) |
| `depends_on` | Verfügbarkeit | Wie hoch ist der Schaden bei Ausfall? (Impact) |

## is_an - Spezialbeziehung

Die `is_an`-Beziehung ist eine **exklusive, definitorische Beziehung**:
- Ein DFD-Element ist entweder eine Instanz des Assets (`is_an`)
- **ODER** es hat Auswirkungsbeziehungen zum Asset
- **Nie beides gleichzeitig**
- **Mathematische Bedeutung**: `is_an` schafft eine logisch eindeutige Brücke für transitive Ableitungen (siehe Abschnitt "Transitivität")

**Beispiel:**
- External Entity "Administrator" → `is_an` → Human Asset "System Admin Role"  
  *(kann keine weiteren Beziehungen zu diesem Asset haben)*
- Process "User Management" → `manages` → Human Asset "System Admin Role"  
  *(ist nicht is_an)*

---

## Data Assets

Beschreibt Auswirkungen auf Daten und Informationen.

### Beziehungen
```
creates      - DFD-Element erzeugt das Data Asset
reads        - DFD-Element liest das Data Asset
modifies     - DFD-Element verändert das Data Asset
deletes      - DFD-Element löscht das Data Asset
stores       - DFD-Element speichert das Data Asset
transports   - DFD-Element transportiert das Data Asset
is_an        - DFD-Element ist eine Instanz des Data Assets
```

### Beispiele
```
Process "User Registration"
├─ creates → Data Asset "User Credentials"
└─ stores → Data Asset "User Profile"

Data Store "Customer Database"
└─ is_an → Data Asset "Customer Records"

Data Flow "Encrypted Session"
└─ transports → Data Asset "Session Token"
```

---

## Data Flows - Spezialfall für `transports`

### Das Redundanz-Problem

Data Flows transportieren per Definition Daten. Die `transports`-Beziehung wäre damit redundant - **aber**: Für präzise Threat-Analyse muss explizit sein, **welche** Assets konkret transportiert werden.

### Lösung: Explizit mit UI-Unterstützung (Option C)

**Prinzip**: 
- Jeder Data Flow **muss** explizit deklarieren, welche Data Assets er transportiert
- Das UI macht dies einfach durch intelligente Vorschläge
- Ein Data Flow ohne `transports`-Beziehung ist unvollständig

**Warum explizit?**
1. **Payload-Präzision**: "HTTPS Request" kann `Password` (hoch kritisch) oder `Language Setting` (niedrig kritisch) enthalten
2. **Multiple Assets**: Ein Flow kann mehrere Assets gleichzeitig transportieren
3. **Threat-Generierung**: Automatische STRIDE-Analyse pro Asset auf diesem Kommunikationspfad
4. **Transitivität**: Ohne explizite Zuordnung bricht die Ableitungskette (siehe Abschnitt "Transitivität")

### UI-Workflow für Data Flows

```
User erstellt: Data Flow "API Response" von Process "Login Service"
                                        ↓
UI analysiert: Welche Assets kennt "Login Service"?
               - creates: "Session Token"
               - reads: "User Profile"
               - reads: "User Credentials"
                                        ↓
UI schlägt vor: "Transportiert dieser Flow alle 3 Assets?" 
                [ Alle auswählen ] [ Einzeln wählen ]
                                        ↓
User bestätigt: Flow transportiert "Session Token" + "User Profile"
                (Credentials bleiben intern)
                                        ↓
Validierung: ✓ Flow ist vollständig definiert
```

### Einschränkungen für Data Flow Elemente

Data Flows haben **nur** folgende erlaubte Beziehungen:
- `transports` → Data Asset (Pflicht, kann mehrfach vorkommen)
- `is_an` → Data Asset (Optional, z.B. für Protokoll-Assets wie "TLS 1.3 Connection")

**Nicht erlaubt** für Data Flows:
- `creates`, `reads`, `modifies`, `deletes`, `stores` (das machen Processes/Data Stores)

### Warnung bei unvollständigen Flows

```
⚠️ Data Flow "API Request" hat keine transports-Beziehung
   → Bedrohungsanalyse für diesen Kommunikationspfad nicht möglich
```

### Beispiel
```
Data Flow "Payment Transaction"
├─ transports → Data Asset "Credit Card Number"
├─ transports → Data Asset "Transaction Amount"
└─ transports → Data Asset "Customer ID"

→ STRIDE-Analyse generiert automatisch:
  - Tampering: Kann Transaction Amount manipuliert werden?
  - Information Disclosure: Kann Credit Card Number abgefangen werden?
  - Spoofing: Kann Customer ID gefälscht werden?
```

### Edge Case: Bidirektionale Kommunikation (Request/Response)

**Problem:**  
In DFDs zeichnen User oft nur einen Pfeil für bidirektionale Kommunikation (z.B. API-Call mit Request und Response). Wenn ein Flow "API Call" heißt und sowohl `Login Credentials` (Request) als auch `Session Token` (Response) transportiert, könnte STRIDE fälschlicherweise annehmen, dass beide Assets in beide Richtungen fließen.

**Beispiel des Problems:**
```
┌─────────┐                           ┌──────────┐
│ Client  │──── API Call ───────────→ │  Server  │
└─────────┘                           └──────────┘

Flow "API Call" transports:
- Login Credentials  (nur Request →)
- Session Token      (nur Response ←)

❌ Falsche Interpretation: 
   Client könnte Session Token senden (unrealistisch)
```

**Lösungsoptionen:**

**Option A: Zwei separate Flows (empfohlen für kritische Analysen)**
```
┌─────────┐                           ┌──────────┐
│ Client  │──── Login Request ────→  │  Server  │
│         │                           │          │
│         │←─── Login Response ────  │          │
└─────────┘                           └──────────┘

Flow "Login Request"
└─ transports → Data Asset "Login Credentials"

Flow "Login Response"
└─ transports → Data Asset "Session Token"
```

**Option B: Richtungs-Qualifier am Flow (vereinfacht, aber präzise)**
```typescript
interface DataFlowAssetMapping {
  assetId: string;
  direction: 'source_to_target' | 'target_to_source' | 'bidirectional';
}

// Beispiel:
Flow "API Communication"
├─ transports [source_to_target] → Data Asset "Login Credentials"
└─ transports [target_to_source] → Data Asset "Session Token"
```

**UI-Empfehlung:**  
Für hochsensible Assets (Credentials, PII, Financial Data) sollte das UI empfehlen oder erzwingen, dass separate Flows gezeichnet werden. Für weniger kritische Daten kann Option B verwendet werden.

---

## Process Assets

Beschreibt Auswirkungen auf Prozesse und Abläufe.

### Beziehungen
```
executes     - DFD-Element führt den Prozess aus
invokes      - DFD-Element startet/ruft den Prozess auf
terminates   - DFD-Element beendet den Prozess
suspends     - DFD-Element pausiert den Prozess
monitors     - DFD-Element überwacht den Prozess
is_an        - DFD-Element ist eine Instanz des Process Assets
```

### Beispiele
```
Process "Login Service"
└─ invokes → Process Asset "Authentication Process"

Process "User Authentication"
└─ is_an → Process Asset "Authentication Process"

Process "System Monitor"
└─ monitors → Process Asset "Background Sync"

Process "Admin Panel"
└─ terminates → Process Asset "Long-running Jobs"
```

---

## System Assets

Beschreibt Auswirkungen auf Systeme und Infrastruktur. System-Beziehungen unterscheiden zwischen aktiver Nutzung (mit Qualifier für Angriffsvektoren) und Abhängigkeiten (für Impact-Analyse).

### Beziehungen
```
controls     - DFD-Element hat umfassende Kontrolle (start/stop/suspend/configure)
configures   - DFD-Element ändert Konfiguration
monitors     - DFD-Element beobachtet/liest Systemzustand
uses         - DFD-Element nutzt Funktionalität [REQUIRES QUALIFIER]
depends_on   - DFD-Element ist abhängig vom System (Kaskadeneffekt bei Ausfall)
is_an        - DFD-Element ist eine Instanz des System Assets
```

### System Qualifiers für `uses`

Die `uses`-Beziehung **erfordert** einen Qualifier, der den Angriffsvektor spezifiziert:

```
api        - Nutzung via API/REST/RPC (→ Injection, Authentication Bypass)
network    - Kommunikation über Netzwerk (→ Man-in-the-Middle, Eavesdropping)
hardware   - Physischer Zugriff (→ Tampering, Physical Attack)
library    - Shared Library/Code-Einbindung (→ Code Injection, Dependency Confusion)
```

**Wichtig**: Ohne Qualifier ist die Bedrohungsanalyse nicht präzise durchführbar.

### Beispiele
```
Process "Container Orchestrator"
└─ controls → System Asset "Application Server"

Process "Config Manager"
└─ configures → System Asset "Database Server"

Process "Health Check Service"
└─ monitors → System Asset "Application Server"

Process "Web Application"
└─ uses [api] → System Asset "Database Server"

Process "API Gateway"
├─ uses [network] → System Asset "Auth Service"
└─ depends_on → System Asset "Auth Service"
   (beide Beziehungen sind möglich und sinnvoll!)

External Entity "Cloud VM"
└─ is_an → System Asset "Virtual Machine Infrastructure"
```

---

## Human Assets

Beschreibt Auswirkungen auf Menschen als **Schutzobjekte** (Safety/Security/Privacy).

### Beziehungen
```
affects_safety    - DFD-Element beeinflusst physische Sicherheit
affects_privacy   - DFD-Element beeinträchtigt Privatsphäre/DSGVO
identifies        - DFD-Element identifiziert/de-anonymisiert Person
tracks            - DFD-Element verfolgt/überwacht Person  
exposes           - DFD-Element gefährdet/exponiert Person
is_an             - DFD-Element repräsentiert diese Person/Rolle
```

### Beispiele
```
External Entity "Machine Operator"
└─ is_an → Human Asset "Machine Operator"

Process "CNC Emergency Stop"
└─ affects_safety → Human Asset "Machine Operator"

Process "Employee Location Tracking"
├─ tracks → Human Asset "Staff Members"
└─ affects_privacy → Human Asset "Staff Members"

Data Store "Patient Database"
└─ exposes → Human Asset "Patients" (bei Breach)

Process "Medical Record Access"
└─ identifies → Human Asset "Patients"
```

**Hinweis zur transitiven Herleitung:**  
Viele Bedrohungen für Human Assets entstehen durch transitive Ketten. Beispiel:
```
Process "Web Server" (compromised)
└─ reads → Data Store "Patient DB"
           └─ is_an → Data Asset "Medical Records"
                     └─ [implizit] → exposes → Human Asset "Patients"

Während der direkte Eintrag `Data Store → exposes → Human Asset` für die 
Dokumentation korrekt ist, entsteht die eigentliche Bedrohung oft durch eine 
kompromittierte vorgelagerte Komponente. Die abgeleiteten Beziehungen helfen, 
solche Ketten sichtbar zu machen.
```

---

---

## Transitivität und Abgeleitete Beziehungen

### Das Konzept

Wenn ein DFD-Element mit einem anderen DFD-Element interagiert, das wiederum eine `is_an`-Beziehung zu einem Asset hat, entsteht eine **mathematisch eindeutige transitive Beziehung**:

```
Data Store "User DB" IS_AN Data Asset "User Records"
Process "Login" reads Data Store "User DB"
────────────────────────────────────────────────────
∴ Process "Login" reads Data Asset "User Records" [ABGELEITET]
```

### Warum Transitivität wichtig ist

**Für TARA:**
- ✅ Verhindert "Blind Spots" (übersehene Asset-Bedrohungen)
- ✅ Vollständige Threat-Coverage über alle Systemebenen
- ✅ Compliance-Nachweis (ISO 21434, IEC 62443)

**Risiken ohne Transitivität:**
- ❌ Threats werden nur auf DFD-Element-Ebene erkannt, nicht auf Asset-Ebene
- ❌ Regulatorische Anforderungen (z.B. DSGVO für PII-Assets) werden übersehen
- ❌ Impact-Bewertung unvollständig

### Hybrid-Ansatz: Assistiert, aber nicht automatisch

**Prinzip**: System **berechnet** abgeleitete Beziehungen, aber User **bestätigt** sie.

```typescript
interface DerivedRelation {
  id: string;
  dfdElementId: string;      // Process "Login"
  assetId: string;           // Data Asset "User Records"
  relationType: string;      // 'reads'
  
  // Ableitungs-Metadaten
  derivedFrom: string;       // Data Store "User DB" ID
  bridgeRelation: string;    // is_an Relation ID
  status: 'pending' | 'confirmed' | 'rejected';
  
  // Optional: Scope-Verfeinerung
  scope?: {
    attributes?: string[];   // Nur bestimmte Asset-Attribute
    qualifier?: string;      // Zusätzlicher Kontext
    restrictions?: string;   // Einschränkungen
  };
  
  // Audit Trail
  derivedAt: Date;
  confirmedBy?: string;
  confirmedAt?: Date;
}
```

### UI-Workflow für abgeleitete Beziehungen

#### 1. Discovery Mode (Automatisch)

```
User verknüpft: Data Store "User DB" → is_an → Data Asset "User Records"
                                                ↓
System scannt: Welche Prozesse greifen auf "User DB" zu?
               - Process "Login" → reads
               - Process "Profile Display" → reads
               - Process "Admin Panel" → modifies
                                                ↓
System generiert: 3 abgeleitete Beziehungen (Status: pending)
```

#### 2. Visualisierung

Abgeleitete Beziehungen werden **visuell unterscheidbar** dargestellt:

```
Process "Login"
├─ reads → Data Store "User DB"           [durchgezogene Linie]
└─ 🪄 reads → Data Asset "User Records"   [gestrichelte Linie, grau]
   └─ Status: Pending ⏸️
```

**Visual Indicators:**
- 🪄 = Abgeleitet (Magic Wand Icon)
- ✓ = Bestätigt (grüne gestrichelte Linie)
- ✗ = Abgelehnt (nicht angezeigt)
- ⚠️ = Benötigt Review (orange)

#### 3. Action Buttons

```
┌─────────────────────────────────────────────────────────┐
│ Process "Login" → Data Asset "User Records"            │
│ Abgeleitet von: Data Store "User DB" (is_an)           │
│                                                         │
│ [✅ Übernehmen] [❌ Ignorieren] [🔍 Scope definieren]  │
└─────────────────────────────────────────────────────────┘
```

**Aktionen:**
- **Übernehmen**: Status → 'confirmed', Beziehung wird fest im Modell verankert
- **Ignorieren**: Status → 'rejected', wird ausgeblendet (wichtig für Noise-Reduktion!)
- **Scope definieren**: User spezifiziert welche Teile des Assets betroffen sind

#### 4. Scope-Editor (Verfeinerung)

```
Process "Login" liest welche Attribute von "User Records"?

Data Asset "User Records" enthält:
☐ user_id
☐ username
☐ password_hash
☐ email
☐ phone_number
☐ payment_info
☐ medical_data

User wählt: ☑ user_id, ☑ username, ☑ password_hash

Scope gespeichert: {attributes: ["user_id", "username", "password_hash"]}
```

### Separate Speicherung (KRITISCH!)

Abgeleitete Beziehungen werden **getrennt** von expliziten Beziehungen gespeichert:

**Warum getrennt?**
1. **Update-Propagation**: Wenn Bridge-Beziehung gelöscht wird → alle Ableitungen neu berechnen
2. **Audit Trail**: Nachvollziehbarkeit wie Beziehung zustande kam
3. **Performance**: Keine Filter-Logik bei jedem Query
4. **Rollback**: User kann Bestätigung rückgängig machen

```
// FALSCH - Disaster waiting to happen
interface AssetRelation {
  isDerived?: boolean;  // ❌ Vermischt explizit und abgeleitet
}

// RICHTIG - Separate Datenstrukturen
database/
  ├─ explicit_relations/
  │    └─ {id, dfdElementId, assetId, relationType, ...}
  └─ derived_relations/
       └─ {id, dfdElementId, assetId, relationType, derivedFrom, status, ...}
```

### Graph-Algorithmus

```typescript
function deriveRelations(graph: TaraGraph): DerivedRelation[] {
  const derived: DerivedRelation[] = [];
  
  // Finde alle is_an Beziehungen (die "Brücken")
  const bridges = graph.relations.filter(r => r.relationType === 'is_an');
  
  for (const bridge of bridges) {
    // bridge: DFD-Element X → is_an → Asset A
    
    // Finde alle Elemente die auf X zugreifen
    const accessors = graph.relations.filter(r => 
      r.assetId === bridge.dfdElementId && 
      r.relationType !== 'is_an'
    );
    
    for (const accessor of accessors) {
      // accessor: Element Y → [relationType] → Element X
      // Ableitung: Element Y → [relationType] → Asset A
      
      // Prüfe ob bereits existiert (vermeidet Duplikate)
      const existingExplicit = graph.relations.find(r =>
        r.dfdElementId === accessor.dfdElementId &&
        r.assetId === bridge.assetId &&
        r.relationType === accessor.relationType
      );
      
      if (!existingExplicit) {
        derived.push({
          id: generateId(),
          dfdElementId: accessor.dfdElementId,
          assetId: bridge.assetId,
          relationType: accessor.relationType,
          derivedFrom: bridge.dfdElementId,
          bridgeRelation: bridge.id,
          status: 'pending',
          derivedAt: new Date()
        });
      }
    }
  }
  
  return derived;
}
```

### Erweiterte Features

#### Bulk Actions

```
Sie haben 12 abgeleitete Beziehungen für "Process Login":

[✅ Alle übernehmen] [❌ Alle ignorieren] [🔍 Einzeln prüfen]
```

#### Smart Suggestions

```
💡 Ähnlicher Process "User Registration" hat diese Relation bestätigt.
   Auch für "Login" übernehmen?
   
   [Ja, übernehmen] [Nein, manuell prüfen]
```

#### Conflict Resolution

```
⚠️ Konflikt erkannt:
   - Explizite Relation: Process "Login" → reads → Data Asset "User Records"
   - Abgeleitete Relation: Process "Login" → reads → Data Asset "User Records"
   
   Action: Abgeleitete Relation wird automatisch als 'confirmed' markiert
```

### Beispiel: Komplette Kette

```
                           [Explizit]
External Entity "Admin" ──is_an──> Human Asset "System Admin"
                                           ↑
                                    [Abgeleitet]
                                           │
Process "Admin Panel" ──operates_by──> External Entity "Admin"


                           [Explizit]
Data Store "User DB" ──────is_an──────> Data Asset "User Records"
                                                  ↑
                                          [Abgeleitet]
                                                  │
Process "Login" ──────reads──────> Data Store "User DB"


Resultat nach Bestätigung:
Process "Admin Panel" → [abgeleitet, bestätigt] → affects_safety → Human Asset "System Admin"
Process "Login" → [abgeleitet, scope: {id, username}] → reads → Data Asset "User Records"
```

---

## Implementierungshinweise

### TypeScript Typdefinition

```typescript
type AssetGroup = 'data' | 'process' | 'system' | 'human';

// Qualifier für System Assets (nur bei 'uses')
type SystemQualifier = 'api' | 'hardware' | 'network' | 'library';

// Basis-Interface
interface BaseAssetRelation {
  assetId: string;
  assetGroup: AssetGroup;
}

// Asset-spezifische Beziehungen (explizit)
type DataRelation = BaseAssetRelation & {
  assetGroup: 'data';
  relationType: 'creates' | 'reads' | 'modifies' | 'deletes' | 'stores' | 'transports' | 'is_an';
};

type ProcessRelation = BaseAssetRelation & {
  assetGroup: 'process';
  relationType: 'executes' | 'invokes' | 'terminates' | 'suspends' | 'monitors' | 'is_an';
};

// System Relations mit Qualifier für 'uses'
type SystemRelation = BaseAssetRelation & ({
  assetGroup: 'system';
  relationType: 'controls' | 'configures' | 'monitors' | 'depends_on' | 'is_an';
} | {
  assetGroup: 'system';
  relationType: 'uses';
  qualifier: SystemQualifier;  // REQUIRED für 'uses'
});

type HumanRelation = BaseAssetRelation & {
  assetGroup: 'human';
  relationType: 'affects_safety' | 'affects_privacy' | 'identifies' | 'tracks' | 'exposes' | 'is_an';
};

// Union aller expliziten Beziehungen
type ExplicitAssetRelation = DataRelation | ProcessRelation | SystemRelation | HumanRelation;

// Abgeleitete Beziehungen (separat gespeichert!)
interface DerivedAssetRelation {
  id: string;
  dfdElementId: string;
  assetId: string;
  assetGroup: AssetGroup;
  relationType: string;
  
  // Ableitungs-Kontext
  derivedFrom: string;       // ID des Bridge-Elements (z.B. Data Store)
  bridgeRelation: string;    // ID der is_an Relation
  status: 'pending' | 'confirmed' | 'rejected';
  
  // Optional: Verfeinerung
  scope?: {
    attributes?: string[];
    qualifier?: string;
    restrictions?: string;
  };
  
  // Audit Trail
  derivedAt: Date;
  confirmedBy?: string;
  confirmedAt?: Date;
}

// Helper-Funktionen
function validateRelations(
  relations: ExplicitAssetRelation[], 
  assetId: string
): boolean {
  const relationsToAsset = relations.filter(r => r.assetId === assetId);
  const hasIsAn = relationsToAsset.some(r => r.relationType === 'is_an');
  const hasOthers = relationsToAsset.some(r => r.relationType !== 'is_an');
  
  // is_an XOR andere Beziehungen
  return !(hasIsAn && hasOthers);
}

function requiresQualifier(relation: ExplicitAssetRelation): boolean {
  return relation.assetGroup === 'system' && relation.relationType === 'uses';
}
```

### UI-Verhalten

1. **Dynamische Beziehungsauswahl:** 
   - Verfügbare Beziehungstypen werden basierend auf der Asset-Gruppe des ausgewählten Assets gefiltert
   - Bei System Assets mit `uses`: Qualifier-Auswahl wird automatisch geöffnet

2. **is_an Exklusivität:**
   - Wenn User `is_an` auswählt → alle anderen Beziehungstypen werden deaktiviert
   - Wenn User eine andere Beziehung auswählt → `is_an` wird deaktiviert
   - Pro DFD-Element/Asset-Paar: entweder `is_an` **oder** 1-n Auswirkungsbeziehungen
   - Bei `is_an`-Auswahl → System triggert automatisch Berechnung abgeleiteter Beziehungen

3. **Qualifier-Erzwingung für System Assets:**
   ```
   User wählt: Process "API Gateway" → uses → System Asset "Auth Service"
                                               ↓
   UI blockiert: "Bitte Qualifier auswählen:"
                 ○ api        - API/REST/RPC Aufruf
                 ○ network    - Netzwerkkommunikation
                 ○ hardware   - Physischer Zugriff
                 ○ library    - Shared Library
   ```

4. **Data Flow Validierung:**
   - Beim Erstellen eines Data Flows: Automatische Aufforderung Assets zuzuweisen
   - Warnung bei unvollständigen Flows: ⚠️ "Keine Assets transportiert"
   - Intelligente Vorschläge basierend auf Quell-/Ziel-Element

5. **Abgeleitete Beziehungen:**
   - Visualisierung mit gestrichelten Linien und Icons (🪄/✓/✗)
   - Action-Buttons: Übernehmen / Ignorieren / Scope definieren
   - Bulk-Actions für mehrere Ableitungen
   - Notification wenn neue Ableitungen verfügbar

6. **Mehrfachbeziehungen:** 
   Ein DFD-Element kann mehrere Auswirkungsbeziehungen zum gleichen Asset haben (außer wenn `is_an`)
   ```
   Process "User Service"
   ├─ creates → Data Asset "User Profile"
   ├─ reads → Data Asset "User Profile"
   └─ modifies → Data Asset "User Profile"
   ```

7. **Conflict Resolution:**
   - Warnung wenn explizite und abgeleitete Beziehung identisch sind
   - Automatische Markierung der Ableitung als 'confirmed'
   - User kann nachträglich Scope verfeinern

---

---

## Kritische Design-Entscheidungen - Zusammenfassung

### 1. Semantic Overlap bei System Assets (gelöst)

**Problem:** `uses` war zu vage für präzise Threat-Analyse.

**Lösung: Active-Impact Modell**
- `uses [qualifier]` → Angriffsvektor (Likelihood)
- `depends_on` → Kaskadeneffekt (Impact)

**Implementierung:**
```typescript
// Process "API Gateway" greift auf Auth Service zu
{
  relationType: 'uses',
  qualifier: 'network',  // REQUIRED
  // → Threat: Man-in-the-Middle, Eavesdropping
}

// Process "API Gateway" fällt aus wenn Auth Service ausfällt
{
  relationType: 'depends_on'
  // → Threat: Denial of Service, Cascading Failure
}
```

### 2. Redundanz bei `transports` (gelöst)

**Problem:** Data Flows transportieren per Definition Daten → scheinbare Redundanz.

**Lösung: Explizit mit UI-Unterstützung**
- Jeder Data Flow muss explizit deklarieren welche Assets transportiert werden
- UI macht dies einfach durch intelligente Vorschläge
- Ermöglicht präzise Threat-Analyse pro Asset auf dem Kommunikationspfad
- Kritisch für Transitivität-Ketten

**Warum wichtig:**
- "HTTPS Request" kann `Password` ODER `Language Setting` enthalten
- Unterschiedliche Criticality → unterschiedliche Threats
- Automatische STRIDE-Generierung pro Asset

### 3. Transitivität (gelöst)

**Problem:** Beziehungen über mehrere Ebenen werden übersehen.

**Lösung: Hybrid-Ansatz**
- System **berechnet** abgeleitete Beziehungen (mathematisch eindeutig via `is_an`)
- User **bestätigt** sie (verhindert Alert Fatigue + Compliance-Nachweis)
- **Separate Speicherung** (kritisch für Wartbarkeit)

**Vorteile:**
- ✅ Keine Blind Spots
- ✅ Vollständige Threat-Coverage
- ✅ User behält Kontrolle
- ✅ Compliance-fähig (Audit Trail)

### 4. Validierungsregeln (Edge Cases)

**Wichtige Einschränkungen:**
- `is_an` nur für repräsentative DFD-Elemente (z.B. nur External Entities für System Assets)
- Data Flows dürfen nur `transports` und `is_an` verwenden
- Bidirektionale Kommunikation sollte durch separate Flows modelliert werden
- Siehe Abschnitt "Validierungsregeln und Edge Cases" für Details

---

---

## Validierungsregeln und Edge Cases

### Regel 1: `is_an` nur für repräsentative Elemente

**Problem:**  
Ein Process kann versehentlich mit `is_an` zu einem System Asset verknüpft werden, obwohl er eigentlich nur darauf läuft oder davon abhängt.

**Beispiel des Problems:**
```
❌ FALSCH:
Process "Web Application" → is_an → System Asset "Application Server"
(Ein Process IST KEIN Server, er läuft darauf!)

✓ RICHTIG:
External Entity "App Server Instance" → is_an → System Asset "Application Server"
Process "Web Application" → uses [api] → System Asset "Application Server"
Process "Web Application" → depends_on → System Asset "Application Server"
```

**Validierungsregel:**

```typescript
function validateIsAnRelation(
  dfdElement: DFDElement, 
  asset: Asset
): ValidationResult {
  
  // System Assets: nur External Entities oder Data Stores dürfen is_an sein
  if (asset.group === 'system') {
    if (dfdElement.type !== 'external_entity' && dfdElement.type !== 'data_store') {
      return {
        valid: false,
        error: 'Processes können System Assets nur nutzen (uses/depends_on), nicht repräsentieren (is_an)'
      };
    }
  }
  
  // Data Assets: nur Data Stores dürfen is_an sein
  if (asset.group === 'data') {
    if (dfdElement.type !== 'data_store') {
      return {
        valid: false,
        error: 'Nur Data Stores können Data Assets repräsentieren (is_an)'
      };
    }
  }
  
  // Process Assets: nur Processes dürfen is_an sein
  if (asset.group === 'process') {
    if (dfdElement.type !== 'process') {
      return {
        valid: false,
        error: 'Nur Processes können Process Assets repräsentieren (is_an)'
      };
    }
  }
  
  // Human Assets: nur External Entities dürfen is_an sein
  if (asset.group === 'human') {
    if (dfdElement.type !== 'external_entity') {
      return {
        valid: false,
        error: 'Nur External Entities können Human Assets repräsentieren (is_an)'
      };
    }
  }
  
  return { valid: true };
}
```

### Regel 2: `is_an` ist exklusiv

```typescript
function validateExclusiveIsAn(
  relations: AssetRelation[], 
  dfdElementId: string,
  assetId: string
): ValidationResult {
  const relationsToAsset = relations.filter(r => 
    r.dfdElementId === dfdElementId && 
    r.assetId === assetId
  );
  
  const hasIsAn = relationsToAsset.some(r => r.relationType === 'is_an');
  const hasOthers = relationsToAsset.some(r => r.relationType !== 'is_an');
  
  if (hasIsAn && hasOthers) {
    return {
      valid: false,
      error: 'is_an darf nicht mit anderen Beziehungen kombiniert werden'
    };
  }
  
  return { valid: true };
}
```

### Regel 3: System `uses` benötigt Qualifier

```typescript
function validateSystemUsesQualifier(
  relation: AssetRelation
): ValidationResult {
  if (relation.assetGroup === 'system' && 
      relation.relationType === 'uses' &&
      !relation.qualifier) {
    return {
      valid: false,
      error: 'uses-Beziehung zu System Asset benötigt Qualifier (api/network/hardware/library)'
    };
  }
  
  return { valid: true };
}
```

### Regel 4: Data Flows nur mit `transports` und `is_an`

```typescript
function validateDataFlowRelations(
  dfdElement: DFDElement,
  relation: AssetRelation
): ValidationResult {
  if (dfdElement.type === 'data_flow') {
    const allowedTypes = ['transports', 'is_an'];
    
    if (!allowedTypes.includes(relation.relationType)) {
      return {
        valid: false,
        error: `Data Flows können nur 'transports' oder 'is_an' Beziehungen haben, nicht '${relation.relationType}'`
      };
    }
  }
  
  return { valid: true };
}
```

### Regel 5: Mindestens ein Asset bei Data Flows

```typescript
function validateDataFlowCompleteness(
  dfdElement: DFDElement,
  relations: AssetRelation[]
): ValidationResult {
  if (dfdElement.type === 'data_flow') {
    const hasTransports = relations.some(r => 
      r.dfdElementId === dfdElement.id && 
      r.relationType === 'transports'
    );
    
    if (!hasTransports) {
      return {
        valid: false,
        warning: true,
        error: 'Data Flow hat keine transports-Beziehung. Threat-Analyse nicht möglich.'
      };
    }
  }
  
  return { valid: true };
}
```

### UI-Integration der Validierungsregeln

**Bei Beziehungs-Erstellung:**
```
User versucht: Process "API" → is_an → System Asset "Server"
                                        ↓
UI blockiert: ❌ "Processes können System Assets nur nutzen oder 
                  von ihnen abhängen, nicht repräsentieren.
                  
                  Meinten Sie:
                  ○ uses [network] → System Asset 'Server'
                  ○ depends_on → System Asset 'Server'"
```

**Bei Flow-Erstellung ohne Assets:**
```
User erstellt: Data Flow "API Response"
                                        ↓
UI warnt: ⚠️ "Dieser Flow transportiert noch keine Assets.
              Bedrohungsanalyse nicht möglich.
              
              [Assets zuweisen]"
```

**Bei Konflikt:**
```
User versucht: Process "Login" → is_an → Data Asset "User"
               (hat bereits): Process "Login" → reads → Data Asset "User"
                                        ↓
UI blockiert: ❌ "is_an kann nicht mit anderen Beziehungen kombiniert werden.
                  
                  Optionen:
                  • is_an entfernen und nur 'reads' behalten
                  • 'reads' entfernen und is_an setzen"
```

---

## Besondere Szenarien

### Doppelte Rolle (Akteur & Schutzobjekt)

Eine Person kann gleichzeitig Akteur und Schutzobjekt sein:

```
Human Asset "Machine Operator"
├─ External Entity "Operator" → is_an
│  └─ [triggert: abgeleitete Beziehungen für alle Prozesse die auf Entity zugreifen]
│
├─ Process "CNC Control" → affects_safety
│  └─ Qualifier: Direct physical control
│
└─ Data Store "Access Logs" → affects_privacy
   └─ Scope: {tracking_data, location, work_hours}
```

### System-Hierarchien mit Qualifiern

Bei verteilten Systemen können Beziehungen auf verschiedenen Ebenen bestehen:

```
System Asset "Production Environment"
├─ External Entity "Cloud Platform" → is_an
│
├─ Process "Deployment Pipeline" → configures
│
├─ Process "API Gateway" → uses [network]
│  └─ Threat: Man-in-the-Middle auf Prod-Umgebung
│
└─ Process "Frontend App" → depends_on
   └─ Threat: Cascading failure wenn Prod-Umgebung ausfällt
```

### Transitivität mit Data Flows

Komplette Kette von DFD-Element über Flow zu Asset:

```
[Explizite Beziehungen]
Process "Login Service"
├─ creates → Data Asset "Session Token"
└─ reads → Data Store "User DB"

Data Store "User DB"
└─ is_an → Data Asset "User Credentials"

Data Flow "Login Response"
├─ transports → Data Asset "Session Token" (explizit bestätigt)
└─ transports → Data Asset "User Profile"  (explizit bestätigt)


[Abgeleitete Beziehungen]
Process "Login Service"
└─ 🪄 reads → Data Asset "User Credentials"
   ├─ Status: Pending
   ├─ Abgeleitet von: Data Store "User DB" (is_an)
   └─ Action: [✅ Übernehmen mit Scope: {user_id, password_hash}]


[Threat-Analyse Resultat]
Data Flow "Login Response":
- Tampering auf "Session Token" → Session Hijacking
- Information Disclosure auf "User Profile" → Privacy Violation
- [NICHT analysiert]: "User Credentials" (wird nicht transportiert!)

Process "Login Service":
- Information Disclosure auf "User Credentials" [abgeleitet, bestätigt]
  → Threat: Credential Leakage through Process Memory
```
