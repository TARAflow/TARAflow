# Ticket 2 — Interface/DataFlow Crossing Detection (Geometry)

**Priorität:** Mittel  
**Typ:** Bug + Enhancement  
**Scope:** `src/features/dfd/utils/geometry-analyzer.ts` + Tests

---

## Aktueller Stand (committed in dieser Session)

### Was funktioniert ✅
- **Case 1 — curved=1 + Waypoints:** Exakter draw.io QB-Algorithmus (`mxPolyline.paintCurvedLine`)
  - SVG-Export verifiziert: `M 160.5 341 Q 160.47 171 80.24 171 Q 0 171 0.04 0.01`
  - Analytische QB vs AABB — kein Sampling, kein `pointInRect` False Positive
  - Loop-Bound korrekt: `i < n-2` (nicht `n-1`)
  - EPS-Clamp für Floating-Point Tangenten
- **Case 2 — Waypoints ohne curved:** Gerade Segmente, `LINE_TOL=5`
- **Case 3 — Keine Waypoints:** Near-straight + V-H/H-V Orthogonal
- **Rule 2 — Endpoint Containment:** Source/Target Center in Interface-BoundingBox (für JTAG/SWD auf ChipBoundary)
- **`connection.curved` wird übergeben** (war fehlend → Case 1 feuerte nie)
- **20 Unit Tests** mit SVG-verifizierten Erwartungen

### Was noch unklar ist ⚠️
- **IF-1 rechts von DF-2** — In Python-Simulation MISS, in App möglicherweise noch HIT
  - Nach Deploy der neuen `dfd-analyzer.ts` (mit `connection.curved`) testen
  - Unit Test `x=619 → MISS` soll das abdecken
- **IF-2 (JTAG) Endpoint Containment** — implementiert aber nicht als Unit Test abgedeckt

---

## Offene Aufgaben

### 1. Deploy verifizieren
Nach Merge: manuelle Tests in der App:
- [ ] IF-1 links von DF-2 → HIT
- [ ] IF-1 rechts von DF-2 (klar daneben) → MISS
- [ ] IF-2 (JTAG) auf ChipBoundary → HIT wenn Debugger→ChipBoundary DataFlow vorhanden

### 2. Unit Tests erweitern
**Neues File:** `src/tests/unit/features/dfd/services/dfd-graph-builder.test.ts`

```typescript
// IF-2 / JTAG Endpoint Containment
it("Debugger→ChipBoundary flow, JTAG interface on chip → HIT via endpoint containment")
it("Debugger→ChipBoundary flow, JTAG interface NOT on chip → MISS")
```

### 3. `getElementConnectionPoint` verbessern (optional)
Deployed `dfd-analyzer.ts` priorisiert noch `sourcePoint` (stale XML-Wert) vor `entryX/entryY`.  
Fix: `entryX/entryY` haben Priorität — verhindert falsche Startpunkte für QB-Algorithmus.

```typescript
// Aktuell (falsch):
if (type === "exit" && connection.sourcePoint) return connection.sourcePoint;

// Korrekt:
const conn = connection as any;
if (type === "exit" && conn.exitX !== undefined) {
  return { x: element.position.x + conn.exitX * element.size.width, ... };
}
// Fallback: sourcePoint, dann Center
```

---

## Files zu übergeben (committed)

| Ziel-Pfad | Output-File |
|-----------|-------------|
| `src/features/dfd/utils/geometry-analyzer.ts` | `phase-d/geometry-analyzer.ts` (uploaded version) |
| `src/features/dfd/utils/dfd-analyzer.ts` | `phase-d/dfd-analyzer.ts` |
| `src/features/dfd/services/dfd-graph-builder.ts` | `phase-d/dfd-graph-builder.ts` |
| `src/features/dfd/services/parsers/connection-parser.ts` | `phase-d/connection-parser.ts` |
| `src/tests/unit/features/dfd/utils/geometry-analyzer.test.ts` | `phase-d/geometry-analyzer.test.ts` |
| `vitest.config` | `phase-d/vitest.config.ts` |

---

## Bekannte Algorithmus-Details

```
draw.io paintCurvedLine (mxgraph@4.2.2):
  moveTo(pts[0])
  for i = 1 to n-2 (exclusive):
    quadTo(ctrl=pts[i], end=mid(pts[i], pts[i+1]))
  quadTo(ctrl=pts[n-2], end=pts[n-1])

QB vs AABB analytisch:
  Für jede Rect-Kante: löse (a0-2ac+a1)t² + (-2a0+2ac)t + (a0-val) = 0
  t ∈ [-EPS, 1+EPS], clamped auf [0,1]
  Prüfe ob anderer Koordinatenwert in Rect-Bounds liegt
```
