# Handover — Future: Threat Graph Extension

## Status: POST-RELEASE — nicht vor First Release umsetzen

Dieses Dokument beschreibt eine architektonische Erweiterung die **nach dem
First Release** geplant ist. Der Umbau ist ein Breaking Change der 3-4 Wochen
Entwicklungszeit benötigt und alle Threat-bezogenen Files betrifft.

**First Release Scope:** Dialog → Multiprocess → Generator Strategy →
Mitigation Coverage → Risk Tab → Doc Tab → Release.

---

## Warum diese Erweiterung

TARAflows stärkster Differenzierungsfaktor ist die durchgehende
Ursache-Wirkungs-Kette:

```
DFD Element → Asset → Asset → Safety Impact
```

Heute sind Threats **de facto Nodes** — sie haben stabile IDs, Referenzen
auf Elemente und Assets, und persistierte Analyst-Entscheidungen. Aber sie
sind als flache Listen gespeichert (`perElementTables`, `perInteractionTables`),
nicht als formale Graph-Nodes.

Der Umbau zahlt sich aus sobald folgende Abfragen gebraucht werden:

- "Welche Threats teilen denselben Asset-Pfad?"
- "Welche Controls decken mehrere Threats gleichzeitig ab?"
- "Welche Threats führen zum gleichen Safety Impact?"
- "Wo gibt es Single Points of Failure in der Mitigation?"
- "Wenn sich Asset B ändert, welche Threats sind betroffen?"

Das sind Abfragen die ein Analyst heute manuell beantwortet. Mit einem
echten Graph beantwortet sie das Tool automatisch.

---

## Aktueller Zustand (First Release)

```
ThreatData {
  configuration: ThreatConfiguration
  perElementTables: ThreatTable[]    ← flache Listen
  perInteractionTables: ThreatTable[]
}

ThreatTable {
  trustBoundaryId: string | null
  trustBoundaryName: string
  threats: Threat[]
}

Threat {
  id: string
  linkedAssetIds: string[]           ← Referenz als string[]
  linkedElement: any | null          ← Referenz als Objekt
  dataFlow: any | null               ← Referenz als Objekt
  // ... Analyst-Entscheidungen
}
```

Verbindungen existieren als **Felder**, nicht als **Kanten**.

---

## Zielzustand: Hybrid Graph

Der Graph bleibt die Wahrheit. Threats werden materialisiert aber bleiben
referenziert auf ihren Ursprung.

```
┌─────────────────────────────────────────────────────────────┐
│                     TARAflow Graph                          │
│                                                             │
│  DFD Element ──affects──▶ Asset ──depends_on──▶ Asset       │
│       │                     │                    │          │
│       │                     └──────────┐         │          │
│       ▼                                ▼         ▼          │
│    Threat ──exposes──▶ Asset ──leads_to──▶ Impact           │
│       │                                                     │
│       ▼                                                     │
│  Mitigation ──protects──▶ Asset / Element                   │
│       │                                                     │
│       ▼                                                     │
│  Verification ──validates──▶ Mitigation                     │
└─────────────────────────────────────────────────────────────┘
```

### Node-Typen

```typescript
type GraphNodeType =
  | "dfd_element"     // Process, DataStore, DataFlow, etc.
  | "asset"           // Asset aus dem Asset Tab
  | "threat"          // Generierter oder manueller Threat
  | "mitigation"      // Mitigation (Katalog oder custom)
  | "verification"    // Verification (Katalog oder custom)
  | "impact";         // Aggregierter Impact-Node (Safety/Business)
```

### Edge-Typen

```typescript
type GraphEdgeType =
  | "affects"         // DFD Element → Threat (Element hat diesen Threat)
  | "exposes"         // Threat → Asset (Threat gefährdet diesen Asset)
  | "depends_on"      // Asset → Asset (Asset-zu-Asset Beziehung)
  | "leads_to"        // Asset → Impact (Asset-Impact-Kette)
  | "protects"        // Mitigation → Asset/Element
  | "validates"       // Verification → Mitigation
  | "mitigates"       // Mitigation → Threat
  | "derived_from";   // Threat → DFD Element (Generierungsherkunft)
```

### Graph Schema

```typescript
interface ThreatGraphNode {
  id: string;
  type: GraphNodeType;
  /** Payload — typed per node type */
  data:
    | DFDElementReference         // type = "dfd_element"
    | AssetReference              // type = "asset"
    | Threat                      // type = "threat"
    | MitigationNode              // type = "mitigation"
    | VerificationNode            // type = "verification"
    | ImpactNode;                 // type = "impact"
}

interface ThreatGraphEdge {
  id: string;
  type: GraphEdgeType;
  source: string;   // Node ID
  target: string;   // Node ID
  /** Optional edge metadata */
  weight?: number;
  label?: string;
}

interface ThreatGraph {
  nodes: Map<string, ThreatGraphNode>;
  edges: ThreatGraphEdge[];

  /** Convenience index: nodeId → outgoing edges */
  outgoing: Map<string, ThreatGraphEdge[]>;
  /** Convenience index: nodeId → incoming edges */
  incoming: Map<string, ThreatGraphEdge[]>;
}
```

---

## Derived with Override — Kernprinzip

Threats bleiben logisch abgeleitet, aber physisch persistiert.

```typescript
interface Threat {
  // ── Herkunft ────────────────────────────────────────────────────────
  /** true = durch Generator erstellt, false = manuell */
  derived: boolean;
  /** ID des DFD-Elements oder DataFlows aus dem dieser Threat abgeleitet wurde */
  derivedFromElementId?: string;
  /** Template-ID aus dem Katalog (z.B. "T-S-001") */
  derivedFromTemplateId?: string;

  // ── Override ────────────────────────────────────────────────────────
  /** true = Analyst hat Text editiert → i18n-Verknüpfung unterbrochen */
  isTextCustomized: boolean;

  // ── Graph-Referenzen ─────────────────────────────────────────────────
  /** Asset-IDs die dieser Threat gefährdet — Graph-Kanten "exposes" */
  linkedAssetIds: string[];

  // ── Analyst-Entscheidungen (persistiert) ────────────────────────────
  relevance: ThreatRelevance;
  workflowStatus: ThreatWorkflowStatus;
  evalNote?: string;
  proposedMitigations: MitigationDraft[];
  proposedVerifications: VerificationDraft[];
}
```

---

## Propagation Engine

Der eigentliche Mehrwert des Graph-Modells: automatisches Weiterleiten
von Impact und Risk durch die Asset-Kette.

### Use Cases

**1. Impact-Propagation**

Wenn Asset B `physicalImpact = fatality` und Asset A `depends_on` Asset B:
→ Asset A bekommt automatisch `safetyRelevant = true`
→ Threats auf Asset A bekommen `safetyFlag` gesetzt

```typescript
function propagateImpact(graph: ThreatGraph): void {
  // Traversiere alle "depends_on" Kanten rückwärts
  // Propagiere Safety-Relevanz von Ziel zu Quelle
}
```

**2. Coverage-Propagation**

Wenn Mitigation M `protects` Element E und E `affects` Asset A:
→ Coverage von M gilt auch für Threats die Asset A gefährden

```typescript
function propagateCoverage(
  mitigationId: string,
  graph: ThreatGraph
): string[] {  // Threat-IDs die von dieser Mitigation abgedeckt werden
}
```

**3. Single Point of Failure Detection**

Wenn alle Threats die zu Safety-Impact führen durch dieselbe Mitigation
abgedeckt werden:
→ Diese Mitigation ist ein SPOF — Ausfall = vollständige Coverage-Lücke

```typescript
function findMitigationSPOF(graph: ThreatGraph): MitigationSPOF[] {
}
```

**4. Redundanz-Erkennung**

Mitigations die dieselben Asset-Pfade schützen — möglicherweise redundant.

---

## Reasoning Layer — Explainability

Das Tool kann dem Analysten erklären warum ein Threat kritisch ist:

```typescript
interface ThreatReasoning {
  threatId: string;
  /** Ursache-Wirkungs-Kette als lesbare Beschreibung */
  causalChain: CausalStep[];
  /** Warum ist das kritisch? */
  criticalityJustification: string;
  /** Welche Controls fehlen auf dem Pfad? */
  coverageGaps: CoverageGap[];
}

interface CausalStep {
  nodeId: string;
  nodeType: GraphNodeType;
  label: string;
  edgeToNext?: GraphEdgeType;
}
```

Beispiel-Output für einen Threat auf dem CNC Controller:

```
Causal Chain:
  Threat: "Firmware tampering via unsigned update"
    → affects: CNC Controller (Process)
    → exposes: NC Program Asset
    → depends_on: Calibration Data Asset
    → leads_to: Physical Safety Impact (irreversible_injury)

Criticality: Safety impact chain — 2-step dependency to fatality risk
Coverage Gap: No signature verification on update mechanism
```

---

## Migration vom aktuellen Modell

### Schritt 1 — ThreatData → ThreatGraph

```typescript
function migrateThreatDataToGraph(
  threatData: ThreatData,
  dfdGraph: DFDGraphReference,
  assetData: AssetDataReference
): ThreatGraph {
  const graph: ThreatGraph = { nodes: new Map(), edges: [] };

  // 1. DFD-Elemente als Nodes
  for (const [id, el] of dfdGraph.elementsById) {
    graph.nodes.set(id, { id, type: "dfd_element", data: el });
  }

  // 2. Assets als Nodes
  for (const asset of assetData.assets) {
    graph.nodes.set(asset.id, { id: asset.id, type: "asset", data: asset });
  }

  // 3. Threats aus flachen Listen als Nodes
  const allThreats = [
    ...threatData.perElementTables.flatMap(t => t.threats),
    ...threatData.perInteractionTables.flatMap(t => t.threats),
  ];

  for (const threat of allThreats) {
    graph.nodes.set(threat.id, { id: threat.id, type: "threat", data: threat });

    // Kante: DFD Element → Threat
    if (threat.linkedElement?.elementId) {
      graph.edges.push({
        id: `${threat.linkedElement.elementId}-affects-${threat.id}`,
        type: "affects",
        source: threat.linkedElement.elementId,
        target: threat.id,
      });
    }

    // Kanten: Threat → Assets
    for (const assetId of threat.linkedAssetIds) {
      graph.edges.push({
        id: `${threat.id}-exposes-${assetId}`,
        type: "exposes",
        source: threat.id,
        target: assetId,
      });
    }
  }

  return graph;
}
```

### Schritt 2 — Backward compatibility

Während der Migration müssen beide Formate parallel existieren.
Alte Projekte laden als `ThreatData`, werden on-the-fly zu `ThreatGraph`
konvertiert. Neue Projekte speichern direkt als `ThreatGraph`.

---

## Betroffene Files beim Umbau

```
src/features/threats/models/
  threat-types.ts              ← ThreatGraph, ThreatGraphNode, ThreatGraphEdge
  threat-graph.ts              ← neu: Graph-Operationen, Traversierung

src/features/threats/services/
  threat-graph-builder.ts      ← neu: Generator schreibt in ThreatGraph
  propagation-engine.ts        ← neu: Impact + Coverage Propagation
  reasoning-service.ts         ← neu: Explainability
  element-generator.ts         ← Output → ThreatGraph statt ThreatTable[]
  interaction-generator.ts     ← Output → ThreatGraph statt ThreatTable[]
  element-sync.ts              ← Graph-Update statt Table-Diff
  interaction-sync.ts          ← Graph-Update statt Table-Diff

src/features/threats/components/
  element-threat-table.tsx     ← Datenquelle = ThreatGraph Query
  interaction-threat-table.tsx ← Datenquelle = ThreatGraph Query
  threat-dialog.tsx            ← Graph-Node Update

src/app/components/layout/
  main-layout.tsx              ← extractThreatReferences() neu

src/app/services/
  project-migration.ts         ← migrateThreatDataToGraph()
```

**Geschätzte Entwicklungszeit:** 3-4 Wochen

---

## Trigger für die Umsetzung

Dieser Umbau ist sinnvoll sobald **einer** dieser Punkte zutrifft:

1. **Analysten fragen aktiv:** "Welche Threats hängen zusammen?"
2. **Risk-Tab braucht** Asset-Pfad-basiertes Risk Scoring
3. **Doc-Generator braucht** automatische Kausalkettenexplizierung
4. **Coverage-Propagation** wird für Compliance-Reports benötigt
5. **Second Release Planning** — dann als erstes Thema

---

## Was bis dahin NICHT verloren gehen darf

Die folgenden Strukturen sind die Vorarbeit für den Graph-Umbau und
müssen beim First Release sauber implementiert sein:

- `threat.linkedAssetIds: string[]` — Kanten-Vorläufer für "exposes"
- `threat.linkedElement` / `threat.dataFlow` — Kanten-Vorläufer für "affects"
- `threat.derivedFromTemplateId` (noch zu ergänzen) — für "derived_from"
- `proposedMitigations: MitigationDraft[]` — Kanten-Vorläufer für "mitigates"
- Stabile Threat-IDs — Voraussetzung für Graph-Node-Identität

Diese Felder bleiben beim Umbau erhalten — sie werden zu formalen
Graph-Kanten promoviert, nicht ersetzt.
