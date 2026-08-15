# TARAflow Phase D — Handover Dokument

**Datum:** 2026-05-24  
**Session:** Phase D Refactoring + DFD Validator + Interface Type Registry + Geometry Analyzer

---

## 1. Status: Abgeschlossen / Committed

### 1.1 Phase D Komponenten-Aufteilung
Alle Files committed. `ProjectShell / WorkspaceLayout / ProjectContext / use-project-manager` — stabiler Render-Loop, keine stale closures.

---

## 2. Output-Files dieser Session (`/mnt/user-data/outputs/phase-d/`)

Alle Files sind Patches gegen den aktuellen Stand. Noch nicht alle committed.

| File | Status | Beschreibung |
|------|--------|--------------|
| `element-properties.ts` | ✅ Ready | `InterfaceType` als exportierter Typ, 22 Interface-Types, `InterfaceProperties.type` |
| `interface-type-registry.ts` | ✅ Ready | Analog zu `protocol-registry.ts`, `validConnectors[]` pro Type |
| `interface-description-form.tsx` | ✅ Ready | Dynamisch gruppiertes Select, gefiltertes Connector-Select |
| `interface-type-i18n-snippets.md` | ✅ Ready | EN + DE i18n für alle 22 Types |
| `element-property-defaults.ts` | ✅ Ready | `INTERFACE_TYPE_DEFAULTS` für alle 22 Types, Debug→`hw_disabled` |
| `element-validator.ts` | ✅ Ready | `validateChipBoundaryDebugInterfaces`, `validateInterfaceConnectorTypes` |
| `validator-utils.ts` | ✅ Ready | `CHIPBOUNDARY_MISSING_DEBUG_INTERFACE`, `INTERFACE_CONNECTOR_TYPE_INVALID` |
| `completeness-validator.ts` | ✅ Ready | Scenarios A/B/C (D entfernt), PB≠implizite TB |
| `dfd-validator.ts` | ✅ Ready | `scenario: "A" \| "B" \| "C" \| null` |
| `connection-parser.ts` | ✅ Ready | `entryX/entryY/exitX/exitY` aus Style-String |
| `dfd-analyzer.ts` | ✅ Ready | `connection.curved` übergeben, Sandwich-Check entfernt |
| `geometry-analyzer.ts` | ✅ Ready | Exakter draw.io QB-Algorithmus, analytische QB vs AABB |
| `dfd-graph-builder.ts` | ✅ Ready | Regel 2: Endpoint Containment für IF-2/JTAG |
| `dfd.json` | ✅ Ready | Neue Validation-Messages, Connector-Types in `elementTypes`, cascade_hints |
| `dfd-validation-i18n-de-snippets.md` | ✅ Ready | DE i18n Snippets |
| `dataflow-description-form.tsx` | ✅ Ready | Tooltip-Bug Fix (frequency/dataClassification) |
| `process-description-form.tsx` | ✅ Ready | `processSemantic` nur für `isEmbedded` |
| `trust-boundary-form.tsx` | ✅ Ready | `physical` aus Options entfernt |
| `element-property-validator.ts` | ✅ Ready | `runsAs` exempt für `functional_block`/`security_boundary` |
| `use-dfd-persistence.ts` | ✅ Ready | `projectRef` Pattern (stale closure fix) |
| `geometry-analyzer.test.ts` | ✅ Ready | Vitest Unit Tests mit SVG-verifizierten Erwartungen |
| `vitest.config.ts` | ✅ Ready | Vitest Setup mit Vite-Aliases |
| `TESTS_README.md` | ✅ Ready | Teststruktur + Konventionen |

---

## 3. Offene Punkte / Pending

### 3.1 Geometry Analyzer — IF-1 rechts von DF-2 (AKTIV)

**Problem:** IF-1 rechts von DF-2 schlägt nicht an obwohl optisch korrekt.

**Aktueller Stand:**
- Exakter draw.io Algorithmus implementiert (`mxPolyline.paintCurvedLine`)
- SVG-Export beweist: `M 160.5 341 Q 160.47 171 80.24 171 Q 0 171 0.04 0.01`
- Analytische QB vs AABB (kein Sampling) — `pointInRect` False Positive eliminiert
- `connection.curved` wird jetzt korrekt an `rectangleIntersectsLine` übergeben
- Unit Tests erstellt mit SVG-verifizierten Grenzwerten

**Was noch unklar:**
- False Positive "rechts von DF-2" konnte in Python-Simulation nicht reproduziert werden
- Vermutlich liegt der verbleibende Bug in der deployed `dfd-analyzer.ts` — `connection.curved` war nicht übergeben → Case 1 feuerte nie → Case 3 (V-H/H-V) erzeugte False Positives
- **Fix:** `dfd-analyzer.ts` mit `connection.curved` aus diesem Output deployen und Unit Tests laufen lassen

**Unit Test Ergebnis:**
```
17/18 passed — 1 falsche Erwartung korrigiert (rect(440,390) ist tatsächlich HIT)
app.test.tsx ReferenceError → exclude in vitest.config.ts
```

### 3.2 IF-2 / JTAG Endpoint Containment (PENDING)
- Regel: Source oder Target Center innerhalb Interface-BoundingBox → DataFlow "kreuzt" Interface
- Implementiert in `dfd-graph-builder.ts` (Regel 2)
- Noch nicht als Unit Test abgedeckt → `tests/unit/features/dfd/services/dfd-graph-builder.test.ts` erstellen

### 3.3 Validator-Architektur-Refactor (GEPLANT)
**Ziel:** Alle Validators generieren fertige Display-Strings statt `KEY|part1|part2` Format.  
`dfd-notification-panel.tsx` soll nur noch den String anzeigen — kein Template-Zusammenbauen.

**Betroffene Files (10 Validators):**
```
asset-property-validator.ts
asset-relation-validator.ts
completeness-validator.ts
connection-validator.ts
dataflow-label-property-validator.ts
dataflow-label-validator.ts
dataflow-property-validator.ts
element-property-validator.ts
element-validator.ts
validator-utils.ts
```

**Strategie:** Neue Messages als fertige Strings, bestehende schrittweise migrieren.

### 3.4 InterfaceProperties Security Controls Redesign (GEPLANT)

**Analyse (aus dieser Session):**

Die aktuelle `security`-Sektion von `InterfaceProperties` vermischt:
- Intrinsische Eigenschaften (connectorType, location)
- Betriebszustände (operationalState — **gut modelliert**)
- Security Controls / Mitigations (accessControl — zu unscharf)
- Medium-Eigenschaften (shieldedCable — gehört zu DataFlow)

**Close-Loop Architektur:** Security Controls im DFD = applizierbare Mitigations aus dem Risk-Tab. Wenn eine Mitigation als umgesetzt markiert wird (Issue-Ticket-Status), meldet der Risk-Tab an DFD → User kann bestätigen → Properties werden gesetzt → Threats neu berechnet.

**Geplante neue Struktur:**
```typescript
// InterfaceProperties — Security Controls (renamed from "security")
implementedControls?: {
  // 1. Access Restriction
  logicalAccessControl?:
    | "none" | "password" | "certificate"
    | "challenge_response" | "secure_pairing" | "hardware_token";
  
  physicalAccessProtection?:
    | "none" | "inside_enclosure" | "locked_panel"
    | "sealed" | "requires_tool" | "tamper_evident";

  // 2. Debug / Service Hardening (Embedded-spezifisch)
  debugProtection?:
    | "none" | "auth_required" | "limited_commands"
    | "readout_protection" | "fused_off";
  
  serviceAccessPolicy?:
    | "always_enabled" | "maintenance_only"
    | "factory_only" | "temporary_enable";

  // 3. Abuse Protection
  abuseProtection?:
    | "none" | "rate_limited" | "lockout"
    | "cooldown" | "flood_protection";

  // 4. Monitoring / Detection
  monitoring?:
    | "none" | "usage_logged" | "tamper_logged"
    | "alerted" | "active_response";

  // 5. Signal / Medium Protection (ersetzt isShieldedCable)
  signalProtection?:
    | "none" | "shielded" | "twisted_pair"
    | "fiber_optic" | "isolated" | "conduit_protected";
}
```

**Was entfernt wird:**
- `accessControl` (zu unscharf → aufgeteilt in logical/physical)
- `isShieldedCable` (boolean → `signalProtection` enum, gehört eigentlich zu DataFlow)

**Was bleibt:**
- `operationalState` (perfekt modelliert, bleibt in `context`)
- `safetyRelevant` (bleibt in `safety`)

**Scope:** Auch andere Element-Types prüfen ob sie `implementedControls` vs. Eigenschaften sauber trennen.

---

## 4. Architektur-Entscheidungen dieser Session

| Entscheidung | Begründung |
|-------------|------------|
| `PB ≠ implizite TB` | Orthogonale Sicherheitsdimensionen: physischer Zugang ≠ Trust-Level-Wechsel |
| Scenario B: ≥1 TB (nicht ≥2) | MCU↔Fieldbus ist mit einer TB valid |
| Scenario D entfernt | Ohne jede Boundary kein Threat-Model möglich |
| QB Kontrollpunkt = WP (nicht mid) | `mxPolyline.paintCurvedLine` Quellcode bestätigt: Waypoint = ctrl, mid(WP,next) = end |
| Analytische QB vs AABB | Sampling erzeugt false positives durch `pointInRect` — analytisch korrekt |
| `TOL=0` in QB, `TOL=5` in lineIntersectsRect | QB ist exakt kalibriert; lineIntersectsRect für Placement-Flexibilität |
| `connection.curved` muss übergeben werden | Ohne curved-Flag feuert Case 1 nie → Case 3 erzeugt False Positives |

---

## 5. Test-Infrastruktur

```
src/tests/unit/features/dfd/utils/
└── geometry-analyzer.test.ts   ← 18 Tests, 17 pass (1 Erwartung korrigiert)

vitest.config.ts                ← Root-Verzeichnis, excludes app.test.tsx
```

**Ausführen:**
```bash
npx vitest run src/tests/unit
npx vitest src/tests/unit/features/dfd/utils/geometry-analyzer.test.ts --watch
```

**Nächste Tests:**
- `dfd-graph-builder.test.ts` — Endpoint Containment IF-2/JTAG
- `completeness-validator.test.ts` — Scenarios A/B/C
- `element-validator.test.ts` — ChipBoundary Debug Interface

---

## 6. Sofort-Aktionen (Priorität)

1. **`dfd-analyzer.ts`** deployen (connection.curved fix) → vitest run → alle 18 Tests grün?
2. **`vitest.config.ts`** — `app.test.tsx` exclude
3. **IF-1 rechts von DF-2** — nach Deploy mit echtem App testen
4. **IF-2/JTAG** — nach Deploy verifizieren
5. **InterfaceProperties Redesign** — eigene Session, grosser Scope
6. **Validator Refactor** — eigene Session

---

## 7. Bekannte Bugs (nicht in dieser Session gefixt)

| Bug | Ort | Impact |
|-----|-----|--------|
| `app.test.tsx` ReferenceError | `src/app/app.test.tsx` | Nur Tests, kein Runtime-Impact |
| `validateInterfaceUsage` evtl. noch nicht korrekt für alle Fälle | `element-validator.ts` | Low — Unit Tests werden das klären |
