# TARAflow Backlog — Interaction Threat Deduplication

## Problem

Bei per-interaction Threat-Generierung erscheinen T, I, D Threats (Kanal-Threats)
auf beiden Seiten eines DataFlows — Sender-TB und Receiver-TB.

### Gewollte Duplikation (cross-team)

Prozess A (IT-TB) → Prozess B (OT-TB)

Zwei verschiedene Teams (IT-Entwickler, Embedded-Entwickler) müssen unabhängig
voneinander Massnahmen implementieren:
- IT-Team: TLS auf Sender-Seite implementieren
- OT-Team: TLS auf Receiver-Seite validieren

→ Duplikation ist methodisch korrekt und gewollt.

### Ungewollte Duplikation (same-team)

Prozess A (IT-TB-1) → Prozess B (IT-TB-2)

Dasselbe IT-Team sieht T, I, D Threats zweimal — in zwei verschiedenen
Akkordions. Das ist Overhead ohne Mehrwert.

## Aktueller Stand

Der Generator verwendet `crossesTrustBoundary` und `zeroTrustMode` als Kriterium
für Receiver-Perspektive. Das deckt den cross-TB Fall ab, unterscheidet aber nicht
zwischen cross-team und same-team.

```typescript
const needsReceiverPerspective =
  !senderTB || (!internalFlow && (zeroTrust || df.crossesTrustBoundary));
```

## Gewünschte Lösung

**Cross-team Detection** als zusätzliches Kriterium:

Zwei TBs sind cross-team wenn:
- Unterschiedliche `owner` Property auf den TrustBoundary-Elementen, ODER
- Unterschiedliche `boundaryType` (z.B. `"network"` vs `"peripheral"`)

```typescript
const isCrossTeam = (senderTB, receiverTB) => {
  const senderOwner = getTBOwner(graph, senderTB);
  const receiverOwner = getTBOwner(graph, receiverTB);
  if (senderOwner && receiverOwner && senderOwner !== receiverOwner) return true;

  const senderType = getTBType(graph, senderTB);
  const receiverType = getTBType(graph, receiverTB);
  if (senderType !== receiverType) return true;

  return false;
};

const needsReceiverPerspective =
  !senderTB ||
  (!internalFlow && (zeroTrust || df.crossesTrustBoundary)) &&
  isCrossTeam(senderTB, receiverTB);
```

## Betroffene Dateien

- `src/features/threats/services/per-interaction/interaction-generator.ts`
  → `generateThreatsForProject()` — `needsReceiverPerspective` Logik
- `src/features/dfd/models/element-properties.ts`
  → `TrustBoundaryProperties.owner` ist bereits vorhanden ✅
  → `TrustBoundaryProperties.boundaryType` ist bereits vorhanden ✅
- `src/features/threats/models/threat-types.ts`
  → `ThreatConfiguration` — optional: `deduplicationMode: "cross-tb" | "cross-team"`

## Priorität

Medium — methodisch sauber aber kein Blocker.
Duplikation ist konservativ (zu viel besser als zu wenig).
Erst adressieren wenn Kunden-Feedback zeigt, dass same-team Duplikation stört.
