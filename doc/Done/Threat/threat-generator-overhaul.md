# TARAflow Threat Generator Overhaul

## Design Goals

1. Threats werden immer generiert — implementierte Controls erscheinen als
   `alreadyImplemented: true` auf `proposedMitigations` (Close-Loop-Prinzip).
2. Risk Treatments bilden sich sauber auf STRIDE-Outcomes ab:
   - **Eliminate**: Property macht Szenario physisch/logisch unmöglich → kein Threat
   - **Reduce**: Control implementiert → Threat + `alreadyImplemented: true`
   - **Transfer / Share / Accept**: keine Generator-Änderung → Analyst-Entscheid im Risk Tab
3. Alle Threat-Domänen abgedeckt: Cloud, Mobile, Enterprise, Embedded, OT.
4. PhysicalBoundary als vollwertiger Element-Typ mit eigenen Templates.
5. Interface-Threats im Per-Interaction-Modus korrekt (Bug behoben).
6. Katalog vollständig: alle Properties haben passende M-xx / V-xx Einträge.

---

## Commit Status

### ✅ Commit 1 — Type Foundation + Adapter Fix (DONE)

**Dateien:**
- `src/shared/models/dfd-reference-types.ts` — `DFDGraphReference` + Supporting-Types
  als zweiter Abschnitt hinzugefügt
- `src/shared/index.ts` — 6 neue Type-Exports im DFD-Block
- `src/features/threats/models/threat-types.ts`:
  - Lokale Interface-Definitionen entfernt, Re-Exports aus `shared`
  - `MitigationDraft`: + `alreadyImplemented?`, `implementedByProperty?`, `implementedByValue?`
  - `MitigationTargetType`: + `PhysicalBoundary`, `ChipBoundary`
  - `TemplateContext`: + `boundaryType?`, `serviceAccessPolicy?`, `physicalMobility?`,
    `accessibility?`, `monitoringType?`, `debugInterfaceAccessible?`, `removableMediaAccessible?`
- `src/app/utils/to-reference-graph.ts`:
  - `element.properties` und `connection.properties` werden durchgemappt
  - `elementChipBoundaries`, `chipBoundaryElements`, `elementPhysicalBoundaries`,
    `physicalBoundaryElements` in `DFDGraphReference` aufgenommen
  - CB/PB-Felder in `DataFlowAnalysisReference`
  - `parentTrustBoundaryId`: `null → undefined`
  - Import von `"features/threats"` → `"shared"`
- `workspace-layout.tsx`: `dfdGraph` via `toReferenceGraph()`
- `property-doc-mappers.ts`: `accessControl` → `implementedControls?.logicalAccessControl`;
  `isShieldedCable` → `implementedControls?.signalProtection`

---

### ⬜ Commit 2 — Interface Bug Fix (Per-Interaction Mode)

**Datei:** `src/features/threats/services/generators/interaction-generator.ts`

**Root Cause:** Interface-Threats für JTAG/SWD/physische Ports die nur in einer
`PhysicalBoundary` oder `ChipBoundary` liegen (ohne `TrustBoundary`) zeigen im
Threat-Tab "Physical Interfaces" statt dem korrekten Boundary-Namen. Ausserdem
wurden vor Commit 1 keine `element.properties` durchgemappt → `matchesContext()`
fand keinen Template-Match → leere Threat-Descriptions.

**Fix — Interface-Threat-Loop ersetzen:**
```ts
for (const element of graph.elementsById.values()) {
  if (element.type !== "Interface" && element.type !== "PhysicalInterface") continue;

  const elProps = element.properties ?? {};

  // Eliminate: permanent_disabled → keine Threats
  if (elProps["operationalState"] === "permanent_disabled") continue;

  const effectiveTB = graph.effectiveElementTrustBoundary.get(element.id);
  const tbId = effectiveTB ?? null;

  // Parent-Name: TB > PB > CB > Fallback
  let tbName: string;
  let tbDisplayId: string;
  if (tbId) {
    tbName = this.getTBName(graph, tbId);
    tbDisplayId = this.getTBDisplayId(graph, tbId);
  } else {
    const pbIds = graph.elementPhysicalBoundaries?.get(element.id) ?? [];
    const cbIds = graph.elementChipBoundaries?.get(element.id) ?? [];
    tbName =
      (pbIds.length > 0 ? graph.elementsById.get(pbIds[0])?.name : null) ??
      (cbIds.length > 0 ? graph.elementsById.get(cbIds[0])?.name : null) ??
      "Physical Interfaces";
    tbDisplayId = "";
  }

  const tableKey = tbId ?? "__no_tb__";
  const config = project.threats?.configuration ?? defaultConfig;

  const { categories: applicableStride } = strategy.getStrideCategories(
    element, STRIDE_PER_INTERACTION, project, config,
  );

  for (const stride of applicableStride) {
    if (shouldEliminateThreat(element.type, elProps, stride)) continue;

    const threat = this.createInterfaceThreat(
      element, stride, tbId, tbName, tbDisplayId,
      elementToAssets, project, strategy,
    );
    const existing = tableMap.get(tableKey) ?? [];
    existing.push(threat);
    tableMap.set(tableKey, existing);
  }
}
```

---

### ⬜ Commit 3 — Eliminate Pre-Filter

**Neue Datei:** `src/features/threats/services/generators/threat-elimination-filter.ts`

```ts
import type { StrideCategory } from "shared";

/**
 * Returns true when a property value makes the threat scenario physically or
 * logically impossible — no threat should be generated.
 * Risk treatment: Eliminate. Only unambiguous cases covered.
 */
export function shouldEliminateThreat(
  elementType: string,
  props: Record<string, unknown>,
  strideCategory: StrideCategory,
): boolean {
  if (elementType === "Interface" || elementType === "PhysicalInterface") {
    if (props["operationalState"] === "permanent_disabled") return true;
    const controls = props["implementedControls"] as Record<string, unknown> | undefined;
    if (controls) {
      if (controls["debugProtection"] === "fused_off")
        return ["T", "I", "E"].includes(strideCategory);
      if (controls["physicalAccessProtection"] === "sealed")
        return ["T", "E"].includes(strideCategory);
      if (controls["signalProtection"] === "fiber_optic")
        return strideCategory === "I";
    }
    if (props["operationalState"] === "enabled_read_only")
      return ["S", "E"].includes(strideCategory);
  }
  if (elementType === "DataFlow") {
    if (props["physicalPathProtection"] === "buried" && strideCategory === "T")
      return true;
  }
  return false;
}
```

**Einbinden in:**
- `element-generator.ts` → `createThreatForElement()`: vor Template-Lookup
- `interaction-generator.ts` → Interface-Loop: bereits in Commit 2
- `interaction-generator.ts` → `createDataFlowThreat()`: vor Threat-Erstellung

---

### ⬜ Commit 4 — Close-Loop: `getImplementedMitigationHints()`

**Neue Datei:** `src/features/threats/services/generators/implemented-controls-mapper.ts`

Inspiziert Element-Properties und gibt `MitigationDraft[]` mit `alreadyImplemented: true`
zurück. Wird mit Template-Mitigations zusammengeführt (kein Duplikat per id).

**Merge-Logik:**
```ts
function mergeMitigations(
  templateMitigations: MitigationDraft[],
  hints: MitigationDraft[],
): MitigationDraft[] {
  const result = [...templateMitigations];
  for (const hint of hints) {
    const existing = result.find((m) => m.id === hint.id);
    if (existing) {
      existing.alreadyImplemented = hint.alreadyImplemented;
      existing.implementedByProperty = hint.implementedByProperty;
      existing.implementedByValue = hint.implementedByValue;
    } else {
      result.push(hint);
    }
  }
  return result;
}
```

**Property → Mitigation Mapping** (aus Gap Analysis Sektion C):

| Element | Property | Value | Marks |
|---------|----------|-------|-------|
| Interface | `implementedControls.logicalAccessControl` | `≠ none` | M-S-001 |
| Interface | `implementedControls.logicalAccessControl` | `certificate\|mfa\|hardware_token` | M-S-001, M-S-002 |
| Interface | `implementedControls.debugProtection` | `≠ none` | M-CB-T-001 (T/E) |
| Interface | `implementedControls.debugProtection` | `readout_protection` | M-CB-I-001 (I) |
| Interface | `implementedControls.physicalAccessProtection` | `≠ none` | M-IF-T-001 (T/E) |
| Interface | `implementedControls.abuseProtection` | `rate_limited` | M-D-001 (D) |
| Interface | `implementedControls.abuseProtection` | `lockout` | M-S-001 (S) |
| Interface | `implementedControls.signalProtection` | `≠ none` | M-IF-I-001; `fiber\|isolated` → M-IF-I-002 |
| Interface | `operationalState` | `sw\|hw_disabled` | M-IF-E-001 (S/T/E) |
| Process | `malwareProtection` | `≠ none` | M-E-001 (E), M-T-001 (T) |
| Process | `malwareProtection` | `whitelist\|code_signing` | M-E-001, M-E-002 |
| DataFlow | `physicalPathProtection` | `≠ none` | M-T-001 (T), M-D-001 (D) |

---

### ⬜ Commit 5 — `matchesContext()` Extensions

**Datei:** `src/features/threats/services/threat-catalog-service.ts`

Nach bestehenden Project-level Checks einfügen:

```ts
// Physical Boundary context dimensions
if (boundaryType?.length) {
  const v = elementProps?.["boundaryType"] as string | undefined;
  if (!v || !boundaryType.includes(v)) return false;
}
if (serviceAccessPolicy?.length) {
  const controls = elementProps?.["implementedControls"] as Record<string, unknown> | undefined;
  const v = controls?.["serviceAccessPolicy"] as string | undefined;
  if (!v || !serviceAccessPolicy.includes(v)) return false;
}
if (physicalMobility?.length) {
  const v = elementProps?.["physicalMobility"] as string | undefined;
  if (!v || !physicalMobility.includes(v)) return false;
}
if (accessibility?.length) {
  const v = elementProps?.["accessibility"] as string | undefined;
  if (!v || !accessibility.includes(v)) return false;
}
if (monitoringType?.length) {
  const v = elementProps?.["monitoringType"] as string | undefined;
  if (!v || !monitoringType.includes(v)) return false;
}
// failSafeOutputState
if (failSafeOutputState?.length) {
  const v = elementProps?.["failSafeOutputState"] as string | undefined;
  if (!v || !failSafeOutputState.includes(v)) return false;
}
// processSemantic
if (processSemantic?.length) {
  const v = elementProps?.["processSemantic"] as string | undefined;
  if (!v || !processSemantic.includes(v)) return false;
}
// accountManagement
if (accountManagement?.length) {
  const v = elementProps?.["accountManagement"] as string | undefined;
  if (!v || !accountManagement.includes(v)) return false;
}
// updateMechanism
if (updateMechanism?.length) {
  const v = elementProps?.["updateMechanism"] as string | undefined;
  if (!v || !updateMechanism.includes(v)) return false;
}
// authenticatorStorage
if (authenticatorStorage?.length) {
  const v = elementProps?.["authenticatorStorage"] as string | undefined;
  if (!v || !authenticatorStorage.includes(v)) return false;
}
// backupMechanism
if (backupMechanism?.length) {
  const v = elementProps?.["backupMechanism"] as string | undefined;
  if (!v || !backupMechanism.includes(v)) return false;
}
// cryptoStandard
if (cryptoStandard?.length) {
  const v = elementProps?.["cryptoStandard"] as string | undefined;
  if (!v || !cryptoStandard.includes(v)) return false;
}
// DataFlow context
if (location?.length) {
  const v = elementProps?.["location"] as string | undefined;
  if (!v || !location.includes(v)) return false;
}
if (redundancy?.length) {
  const v = elementProps?.["redundancy"] as string | undefined;
  if (!v || !redundancy.includes(v)) return false;
}
if (safetyFunction?.length) {
  const v = elementProps?.["safetyFunction"] as string | undefined;
  if (!v || !safetyFunction.includes(v)) return false;
}
if (accessMode?.length) {
  const v = elementProps?.["accessMode"] as string | undefined;
  if (!v || !accessMode.includes(v)) return false;
}
// Boolean flags — nur matchen wenn explizit true
if (templateCtx.debugInterfaceAccessible === true) {
  if (elementProps?.["debugInterfaceAccessible"] !== true) return false;
}
if (templateCtx.removableMediaAccessible === true) {
  if (elementProps?.["removableMediaAccessible"] !== true) return false;
}
```

**TemplateContext-Erweiterung** (zusätzlich zu Commit 1):
```ts
// threat-types.ts — TemplateContext
failSafeOutputState?: string[];
processSemantic?: string[];
accountManagement?: string[];
updateMechanism?: string[];
authenticatorStorage?: string[];
backupMechanism?: string[];
cryptoStandard?: string[];
location?: string[];          // DataFlow.location
redundancy?: string[];        // DataFlow.redundancy
safetyFunction?: string[];    // DataFlow.safetyFunction
accessMode?: string[];        // DataFlow.accessMode
```

---

### ⬜ Commit 6 — STALE affectsProperties korrigieren

**Datei:** `src/features/threats/services/catalog/mitigations.json` (Struktur)

Kein neuer Text, keine neuen IDs. Nur `affectsProperties` anpassen.

**Korrekturen (12 Stück):**

| ID | Property (alt) | Property (neu) |
|----|----------------|----------------|
| M-T-001 | `DataStore.integrityProtection=true` | `='"hmac"'` |
| M-T-002 | `DataFlow.integrityProtection=true` | `="hmac"` |
| M-T-003 | `DataStore.accessControl=acl` | `accessControlMechanism="process_enforced"` |
| M-R-002 | `DataFlow.integrityProtection=true` | `="signature"` |
| M-I-003 | fehlt Multiprocess | + `Multiprocess.authorizationModel=rbac` |
| M-E-002 | fehlt Multiprocess | + `Multiprocess.authorizationModel=rbac` |
| M-D-003 | `DataStore.accessControl=acl` | `accessControlMechanism="process_enforced"` |
| M-E-006 | `Interface.accessControl=physical_lock` | `Interface.implementedControls.debugProtection=fused_off` + `Interface.operationalState=hw_disabled` |
| M-IF-S-001 | `Interface.accessControl=certificate` | `Interface.implementedControls.logicalAccessControl=certificate` |
| M-IF-E-001 | `Interface.accessControl=physical_lock` | `Interface.implementedControls.debugProtection=fused_off` |
| M-IF-E-002 | `Interface.accessControl=physical_lock` | `Interface.implementedControls.debugProtection=auth_required` |
| M-IF-I-002 | `Interface.isShieldedCable=true` | `Interface.implementedControls.signalProtection=shielded` |

**Ergänzungen affectsProperties (6 Stück):**

| ID | Ergänzung |
|----|-----------|
| M-S-001 | + `Interface.implementedControls.logicalAccessControl=mfa` |
| M-S-002 | + `Interface.implementedControls.logicalAccessControl=certificate` |
| M-D-001 | + `Interface.implementedControls.abuseProtection=rate_limited` |
| M-D-004 | + `Multiprocess.backupMechanism=redundant_system` |
| M-IF-T-001 | + `Interface.implementedControls.physicalAccessProtection=inside_enclosure` |
| M-IF-T-003 | + `Interface.implementedControls.physicalAccessProtection=locked_panel` |

---

### ⬜ Commit 6b — Template-Kategorie-Mismatches korrigieren

**Dateien:** `interaction-templates.json`, `embedded-interaction-templates.json`,
`element-templates.json`, `multiprocess-element-templates.json`

**Korrekturen:**

| Template | Mismatch | Fix |
|----------|----------|-----|
| `T-INT-OT-001` | `M-IF-I-001` (I-Mitigation in T-Template) | → `M-T-008` |
| `T-INT-EMB-001` | `M-IF-I-001` (I-Mitigation in T-Template) | → `M-T-008` |
| `T-P-OT-001` | `M-IF-I-001` (I-Mitigation in T-Template) | → `M-T-010` |
| `E-INT-OT-001` | `M-CB-E-001` (CB-Mitigation für generischen OT-E-Threat) | → `M-E-006` |
| `E-SYS-EMB-002` (beide Dateien) | `M-T-004`, `M-T-005` (T-Mitigations in E-Template) | → `M-E-006`, `M-CB-E-001` |
| `T-SYS-EMB-001` (beide Dateien) | `M-T-005` (TLS — irrelevant für Embedded-internal) | → `M-T-006`, `M-T-007` |

**Ergänzungen fehlender Mitigations in bestehenden Templates:**

| Template | Ergänzung |
|----------|-----------|
| `S-INT-IN-001` | + `M-IF-S-001` |
| `S-SYS-INT-IN-001` (interaction) | + `M-IF-S-001` |
| `S-SYS-EMB-001` (element) | + `M-IF-S-001` |
| `S-SYS-EMB-001` (multiprocess) | + `M-IF-S-001`, `M-S-006` |
| `D-INT-OT-001` | + `M-IF-D-003` |
| `D-SYS-INT-IN-001` (interaction) | + `M-IF-D-003` |
| `D-P-OT-001` | + `M-IF-D-003` |
| `D-SYS-EMB-001` (beide) | + `M-D-006` |
| `D-SYS-SAF-001` (beide) | + `M-D-008` |
| `E-SYS-EMB-001` (beide) | + `M-E-007`, `M-I-006` |
| `T-P-EMB-001` | + `M-T-006`, `M-T-007` |
| `E-P-EMB-001` | + `M-E-007` |
| `T-DS-EMB-001` | + `M-I-008` |
| `I-DS-EMB-001` | + `M-I-006` |
| `I-CB-INT-001` | + `M-IF-DBG-002` |
| `D-SYS-INT-IN-001` (multiprocess) | + `M-D-006` |

---

### ⬜ Commit 7 — PhysicalBoundary: Templates + Generator + Katalog

**Neue Datei:** `physical-boundary-element-templates.json`

```json
{
  "version": "1.0.0",
  "description": "PhysicalBoundary element threat templates.",
  "elementTemplates": [
    { "id": "T-PB-001", "strideCategory": "T", "elementTypes": ["PhysicalBoundary"],
      "context": {},
      "mitigations": ["M-T-001", "M-IF-T-001", "M-IF-T-003", "M-PB-T-001"],
      "verifications": ["V-T-001", "V-IF-T-001", "V-PB-T-001"], "isCustom": false },
    { "id": "T-PB-002", "strideCategory": "T", "elementTypes": ["PhysicalBoundary"],
      "context": { "debugInterfaceAccessible": true },
      "mitigations": ["M-CB-T-001", "M-CB-T-002", "M-CB-E-001", "M-PB-T-003"],
      "verifications": ["V-CB-T-001", "V-CB-T-002", "V-PB-T-003"], "isCustom": false },
    { "id": "T-PB-003", "strideCategory": "T", "elementTypes": ["PhysicalBoundary"],
      "context": { "removableMediaAccessible": true },
      "mitigations": ["M-IF-T-002", "M-IF-T-004", "M-PB-T-004"],
      "verifications": ["V-IF-T-001", "V-PB-T-004"], "isCustom": false },
    { "id": "T-PB-004", "strideCategory": "T", "elementTypes": ["PhysicalBoundary"],
      "context": { "physicalMobility": ["portable", "removable"] },
      "mitigations": ["M-T-001", "M-IF-T-003", "M-PB-T-005"],
      "verifications": ["V-T-001", "V-I-001"], "isCustom": false },
    { "id": "I-PB-001", "strideCategory": "I", "elementTypes": ["PhysicalBoundary"],
      "context": {},
      "mitigations": ["M-I-001", "M-IF-I-001", "M-CB-I-001"],
      "verifications": ["V-I-001", "V-IF-I-001"], "isCustom": false },
    { "id": "I-PB-002", "strideCategory": "I", "elementTypes": ["PhysicalBoundary"],
      "context": { "removableMediaAccessible": true },
      "mitigations": ["M-I-002", "M-IF-I-002", "M-PB-T-004"],
      "verifications": ["V-I-001", "V-PB-T-004"], "isCustom": false },
    { "id": "D-PB-001", "strideCategory": "D", "elementTypes": ["PhysicalBoundary"],
      "context": {},
      "mitigations": ["M-D-001", "M-D-002", "M-PB-D-001"],
      "verifications": ["V-D-001", "V-IF-T-001"], "isCustom": false },
    { "id": "D-PB-002", "strideCategory": "D", "elementTypes": ["PhysicalBoundary"],
      "context": { "physicalMobility": ["portable"] },
      "mitigations": ["M-D-004", "M-D-005", "M-PB-T-005"],
      "verifications": ["V-D-001", "V-D-004"], "isCustom": false },
    { "id": "S-PB-001", "strideCategory": "S", "elementTypes": ["PhysicalBoundary"],
      "context": { "accessibility": ["public"] },
      "mitigations": ["M-S-001", "M-IF-S-001", "M-PB-S-001", "M-PB-S-002"],
      "verifications": ["V-S-001", "V-IF-S-001", "V-PB-S-001"], "isCustom": false },
    { "id": "E-PB-001", "strideCategory": "E", "elementTypes": ["PhysicalBoundary"],
      "context": {},
      "mitigations": ["M-E-001", "M-CB-E-001", "M-PB-T-001"],
      "verifications": ["V-E-001", "V-CB-E-001", "V-PB-T-001"], "isCustom": false },
    { "id": "E-PB-002", "strideCategory": "E", "elementTypes": ["PhysicalBoundary"],
      "context": { "debugInterfaceAccessible": true },
      "mitigations": ["M-CB-E-001", "M-CB-E-002", "M-CB-T-001", "M-PB-T-003"],
      "verifications": ["V-CB-E-001", "V-CB-E-002", "V-PB-T-003"], "isCustom": false },
    { "id": "R-PB-001", "strideCategory": "R", "elementTypes": ["PhysicalBoundary"],
      "context": { "monitoringType": ["none"] },
      "mitigations": ["M-R-001", "M-PB-R-001", "M-PB-R-002"],
      "verifications": ["V-R-001", "V-PB-R-001"], "isCustom": false }
  ]
}
```

**Generator-Änderungen:**
- `per-element-types.ts`: `PhysicalBoundary: ["S", "T", "R", "I", "D", "E"]`
- `threat-catalog-service.ts`: PB-Templates in `ALL_ELEMENT_TEMPLATES` einbinden
- `element-generator.ts`: PB-Elemente im `generateThreatsForProject()` erfassen
  (analog `generateInterfacesWithoutTB` — PB hat nie ein TB als Parent)

**Neue Mitigations EN | DE:**
```
M-PB-T-001: "Apply tamper-evident seals or microswitches to detect unauthorized physical access"
            | "Manipulationssichere Siegel oder Mikroschalter anbringen, um unbefugten physischen Zugang zu erkennen"
M-PB-T-002: "Apply active tamper protection (conductive mesh, potting, voltage/light sensor) with automated response"
            | "Aktiven Manipulationsschutz anwenden (Mesh, Verguss, Spannungssensor) mit automatischer Reaktion"
M-PB-T-003: "Ensure no debug or programming port is reachable from boundary exterior without disassembly"
            | "Sicherstellen, dass kein Debug-Port ohne Demontage von der Grenz-Aussenseite erreichbar ist"
M-PB-T-004: "Disable or physically block all removable media ports accessible at the boundary exterior"
            | "Alle Wechselmedien-Ports in der Firmware deaktivieren und physisch blockieren oder entfernen"
M-PB-T-005: "For portable devices: apply full-disk encryption, tamper-evident seal, and remote wipe capability"
            | "Für portable Geräte: Vollverschlüsselung, manipulationssichere Versiegelung und Fernlösch-Funktion anwenden"
M-PB-S-001: "Implement multi-factor physical access control (badge + PIN, biometric, or guarded entry)"
            | "Mehrfaktor-Zutrittskontrolle implementieren (Badge + PIN, Biometrie oder bewachter Eingang)"
M-PB-S-002: "Use RFID/NFC badge for physical access control; note: relay attack risk without second factor"
            | "RFID/NFC-Badge als Zutrittskontrolle verwenden; Relay-Angriffs-Risiko ohne zweiten Faktor beachten"
M-PB-R-001: "Install camera monitoring or alarm system at physical boundary entry points; route alerts to SOC"
            | "Kamera-Überwachung oder Alarmsystem an physischen Grenz-Zugangspunkten installieren; Alarme an SOC weiterleiten"
M-PB-R-002: "Route physical security alerts to Security Operations Centre with defined response procedure"
            | "Physische Sicherheitsalarme an Security Operations Centre mit definiertem Response-Verfahren weiterleiten"
M-PB-D-001: "Physically anchor or bolt down device/cabinet to prevent removal or relocation"
            | "Gerät oder Schrank physisch verankern oder verschrauben, um Entfernung oder Umlokation zu verhindern"
```

**Neue Verifications EN | DE:**
```
V-PB-T-001: "Inspect physical tamper protection — verify seal integrity, switch function, or mesh continuity"
            | "Physischen Manipulationsschutz prüfen — Siegelintegrität, Schalter-Funktion oder Mesh-Kontinuität verifizieren"
V-PB-T-002: "Test tamper detection response — trigger tamper event and verify alarm, zeroize, or shutdown response"
            | "Manipulationserkennungs-Reaktion testen — Ereignis auslösen und Alarm-, Zeroize- oder Shutdown-Reaktion verifizieren"
V-PB-T-003: "Verify debug interfaces are not reachable from boundary exterior without disassembly"
            | "Debug- und Programmierschnittstellen auf Erreichbarkeit von aussen prüfen — ohne Demontage nicht zugänglich"
V-PB-T-004: "Verify removable media ports are disabled in firmware and physically blocked or absent"
            | "Wechselmedien-Ports in Firmware deaktiviert und physisch blockiert verifizieren"
V-PB-S-001: "Test physical access control — verify unauthorized entry is denied and access log is complete"
            | "Physisches Zutrittskontrollsystem testen — unautorisierten Zutritt verweigern und Zugriffsprotokoll vollständig führen"
V-PB-R-001: "Verify physical monitoring system is operational — review alert log and test response procedure"
            | "Physisches Überwachungssystem auf Betriebsbereitschaft prüfen — Alarmmeldungsprotokoll und Response-Verfahren testen"
```

**Neue Threat-Texte EN | DE:** (element-threats-attacks.json)
```
T-PB-001: threat:  "Physical boundary tampering — unauthorized physical access to boundary interior"
          cause:   "No tamper detection mechanism on physical boundary — unauthorized opening is undetected"
          attack:  "Attacker opens the enclosure, cabinet, or room without triggering any alarm or leaving detectable evidence, gaining unrestricted access to internal components"
          DE threat: "Physische Grenz-Manipulation — unautorisierten physischen Zugang zum Grenzinneren"
          DE cause:  "Kein Manipulationserkennungsmechanismus — unautorisiertes Öffnen bleibt unerkannt"
          DE attack: "Angreifer öffnet Gehäuse, Schrank oder Raum, ohne Alarm auszulösen oder nachweisbare Spuren zu hinterlassen"

T-PB-002: threat:  "Debug interface physically accessible — direct hardware attack surface exposed"
          cause:   "Debug or programming port (JTAG, SWD, UART) is reachable from boundary exterior without disassembly"
          attack:  "Attacker attaches a debug probe to the accessible port and gains full processor access — reads security keys, overwrites firmware, or bypasses security controls"
          DE threat: "Debug-Schnittstelle physisch zugänglich — direkter Hardware-Angriffspunkt exponiert"
          DE cause:  "Debug-Port ist ohne Demontage von der Grenz-Aussenseite erreichbar"
          DE attack: "Angreifer verbindet Debug-Probe mit zugänglichem Port und erhält vollen Prozessorzugang — liest Sicherheitsschlüssel, überschreibt Firmware oder umgeht Sicherheitskontrollen"

T-PB-003: threat:  "Removable media insertion — unauthorized data exfiltration or malware injection via physical media"
          cause:   "Removable media port (USB, SD) is physically accessible at boundary exterior — no software or physical blocking"
          attack:  "Attacker inserts a USB drive containing malware or uses it to exfiltrate sensitive data from the device without network access"
          DE threat: "Wechselmedien-Einschleusung — unautorisierte Datenexfiltration oder Malware-Injektion"
          DE cause:  "Wechselmedien-Port ist physisch zugänglich — kein Software- oder physischer Schutz"
          DE attack: "Angreifer steckt USB-Stick mit Malware ein oder exfiltriert sensible Daten ohne Netzwerkzugang"

T-PB-004: threat:  "Device removal or depot attack — portable device taken for lab analysis or substitution"
          cause:   "Device is portable or removable — attacker can control attack environment (time, tools, lab equipment)"
          attack:  "Attacker removes the device from its installation environment, takes it to a lab, and performs full hardware analysis: chip-off, fault injection, side-channel, or firmware implant"
          DE threat: "Geräteentnahme oder Depot-Angriff — portables Gerät für Lab-Analyse oder Substitution entfernt"
          DE cause:  "Gerät ist portabel oder entnehmbar — Angreifer kann Angriffumgebung kontrollieren"
          DE attack: "Angreifer entfernt Gerät aus Installationsumgebung, bringt es ins Labor und führt vollständige Hardware-Analyse durch: Chip-Off, Fault-Injection, Side-Channel oder Firmware-Implant"

I-PB-001: threat:  "Side-channel observation — sensitive data extracted via physical measurements"
          cause:   "Physical boundary provides no electromagnetic shielding or power filtering — internal operations are observable"
          attack:  "Attacker measures power consumption, electromagnetic emissions, or timing of operations through the boundary and extracts cryptographic keys or sensitive data"
          DE threat: "Seitenkanal-Beobachtung — sensible Daten über physikalische Messungen extrahiert"
          DE cause:  "Keine EM-Abschirmung oder Stromfilterung — interne Operationen sind beobachtbar"
          DE attack: "Angreifer misst Stromverbrauch, EM-Emissionen oder Timing durch die Grenze und extrahiert kryptografische Schlüssel"

I-PB-002: threat:  "Data exfiltration via removable media — sensitive data copied out of device"
          cause:   "Removable media port accessible at boundary exterior — no data loss prevention mechanism"
          attack:  "Attacker inserts removable media and copies sensitive files, logs, or cryptographic material without leaving a network trace"
          DE threat: "Datenexfiltration via Wechselmedien"
          DE cause:  "Wechselmedien-Port zugänglich — kein Data-Loss-Prevention-Mechanismus"
          DE attack: "Angreifer steckt Wechselmedium ein und kopiert sensible Dateien, Logs oder kryptografisches Material ohne Netzwerkspur"

D-PB-001: threat:  "Physical destruction or power disruption — device rendered unavailable by physical attack"
          cause:   "No physical protection or anchoring — device can be damaged, unplugged, or destroyed by physical access"
          attack:  "Attacker physically damages the device, cuts power, or removes it from service, causing immediate and complete loss of availability"
          DE threat: "Physische Zerstörung oder Stromunterbrechung"
          DE cause:  "Kein physischer Schutz oder Verankerung — Gerät kann beschädigt oder entfernt werden"
          DE attack: "Angreifer beschädigt Gerät physisch, unterbricht Stromversorgung oder entfernt es, was zum sofortigen Verfügbarkeitsverlust führt"

D-PB-002: threat:  "Device theft — portable device stolen, causing DoS and potential data exposure"
          cause:   "Device is portable and not anchored — theft directly causes loss of availability and potential data breach"
          attack:  "Attacker steals the portable device from its operating location, causing the controlled system to lose its controller and potentially exposing all stored data"
          DE threat: "Gerätediebstahl — portables Gerät gestohlen, DoS und potenzielle Datenexposition"
          DE cause:  "Gerät ist portabel und nicht verankert — Diebstahl führt direkt zum Verfügbarkeitsverlust"
          DE attack: "Angreifer stiehlt portables Gerät aus Betriebsumgebung, das kontrollierte System verliert seinen Controller und alle gespeicherten Daten sind potenziell exponiert"

S-PB-001: threat:  "Maintenance impersonation or relay attack — attacker gains physical access by bypassing access control"
          cause:   "Physical access control is single-factor or absent — badge-only access is vulnerable to relay attack; no guard present"
          attack:  "Attacker clones RFID badge or uses relay attack device to gain entry, impersonates maintenance personnel, or tailgates through controlled entry"
          DE threat: "Wartungs-Impersonation oder Relay-Angriff — Angreifer erlangt physischen Zugang durch Umgehung der Zugangskontrolle"
          DE cause:  "Physische Zugangskontrolle ist einfaktorig oder abwesend — Badge-Only ist für Relay-Angriff anfällig"
          DE attack: "Angreifer klont RFID-Badge, nutzt Relay-Angriff oder schleust sich als Wartungspersonal ein"

E-PB-001: threat:  "Physical privilege escalation — attacker gains elevated system access via physical boundary breach"
          cause:   "Physical access to device interior grants debug/hardware access — logical security controls can be bypassed physically"
          attack:  "Attacker opens the physical boundary, connects to internal debug or hardware interface, and bypasses all software-level authentication and authorization"
          DE threat: "Physische Rechteausweitung — Angreifer erhält erhöhten Systemzugang durch physische Grenzverletzung"
          DE cause:  "Physischer Zugang zum Gerätinneren gewährt Debug-/Hardware-Zugang — logische Sicherheitskontrollen können physisch umgangen werden"
          DE attack: "Angreifer öffnet physische Grenze, verbindet sich mit internem Debug- oder Hardware-Interface und umgeht alle software-seitigen Authentifizierungs- und Autorisierungskontrollen"

E-PB-002: threat:  "Debug interface privilege escalation — full processor control via physically accessible debug port"
          cause:   "JTAG or SWD port is accessible from boundary exterior — provides full read/write access to processor memory and registers"
          attack:  "Attacker connects debug probe to accessible port, halts processor, reads security keys from memory, and modifies execution flow to bypass security checks"
          DE threat: "Debug-Schnittstellen-Rechteausweitung — voller Prozessorzugang via physisch zugänglichem Debug-Port"
          DE cause:  "JTAG/SWD-Port ist von aussen zugänglich — bietet vollen Lese-/Schreibzugang zu Prozessorspeicher und Registern"
          DE attack: "Angreifer verbindet Debug-Probe, stoppt Prozessor, liest Sicherheitsschlüssel aus Speicher und modifiziert Execution-Flow"

R-PB-001: threat:  "Physical access without audit trail — actions at physical boundary cannot be attributed"
          cause:   "No physical monitoring or access logging at boundary — who accessed the boundary and when is unknown"
          attack:  "Attacker accesses boundary and performs actions (installs tap, modifies hardware) without any record being created — forensic investigation finds no evidence"
          DE threat: "Physischer Zugang ohne Audit-Trail — Aktionen an physischer Grenze nicht zuordenbar"
          DE cause:  "Keine physische Überwachung oder Zugriffsprotokollierung — wer wann zugegriffen hat ist unbekannt"
          DE attack: "Angreifer greift auf Grenze zu und führt Aktionen durch (Tap installieren, Hardware modifizieren) ohne Protokolleintrag — forensische Untersuchung findet keine Beweise"
```

---

### ⬜ Commit 8a — Side-Channel Attack Templates + Properties

**Hintergrund:** Side-Channel-Angriffe (SCA) sind in der Praxis nachgewiesen und
mit geringem Aufwand durchführbar (TPM/SPI-Bus-Angriff, Power-Analysis auf MCU).
TARAflow soll diese Angriffsvektoren explizit modellieren.

**Neue Properties:**

```typescript
// ChipBoundaryProperties — neu
sideChannelProtection?: "none" | "basic" | "certified"
// none      → SCA-Templates aktiv (I-CB-SCA-001..003)
// basic     → Warnung, Templates bleiben aktiv
// certified → shouldEliminateThreat() → keine SCA-Threats

// DataFlowProperties — kein neues Property nötig.
// I-DF-BUS-001 triggert auf bestehenden Properties:
//   location === "on_board" AND
//   physicalPathProtection === "none" AND
//   encryptionInTransit === "none"
// Das deckt den TPM/SPI-Angriff präzise ab:
//   on_board → Leiterbahn auf Platine zugänglich
//   physicalPathProtection=none → keine inneren Lagen, kein Potting
//   encryptionInTransit=none → Klartext auf dem Bus
```

**Neue Template-Datei:** `side-channel-templates.json`

```json
{
  "I-CB-SCA-001": {
    "strideCategory": "I",
    "elementTypes": ["ChipBoundary"],
    "context": {
      "chipType": ["mcu", "fpga", "secure_element"],
      "sideChannelProtection": ["none"]
    },
    "mitigations": ["M-CB-I-001", "M-CB-SCA-001"],
    "verifications": ["V-CB-I-001", "V-CB-SCA-001"]
  },
  "I-CB-SCA-002": {
    "strideCategory": "I",
    "elementTypes": ["ChipBoundary"],
    "context": {
      "chipType": ["mcu", "fpga"],
      "sideChannelProtection": ["none"]
    },
    "mitigations": ["M-CB-I-001", "M-CB-SCA-002"],
    "verifications": ["V-CB-I-001", "V-CB-SCA-002"]
  },
  "I-CB-SCA-003": {
    "strideCategory": "I",
    "elementTypes": ["ChipBoundary"],
    "context": {
      "chipType": ["mcu"],
      "debugInterfaceLocked": [false],
      "sideChannelProtection": ["none"]
    },
    "mitigations": ["M-CB-I-001", "M-CB-SCA-003"],
    "verifications": ["V-CB-SCA-003"]
  },
  "I-CB-SCA-004": {
    "strideCategory": "I",
    "elementTypes": ["ChipBoundary"],
    "context": {
      "sideChannelProtection": ["none"],
      "chipType": ["mcu", "fpga", "secure_element"]
    },
    "mitigations": ["M-CB-SCA-004", "M-IF-I-002"],
    "verifications": ["V-CB-SCA-004"]
  },
  "I-DF-BUS-001": {
    "strideCategory": "I",
    "elementTypes": ["DataFlow"],
    "context": {
      "location": ["on_board"],
      "physicalPathProtection": ["none"],
      "encryptionInTransit": ["none"]
    },
    "mitigations": ["M-CB-SCA-004", "M-IF-I-001", "M-IF-I-002"],
    "verifications": ["V-CB-SCA-004", "V-IF-I-001"]
  }
}
```

**Neue Mitigations EN | DE:**
```
M-CB-SCA-001:  "Apply power analysis countermeasures — use constant-time algorithms,
                randomized clock, power filter or noise injection (NIST SP 800-193)"
               | "Leistungsanalyse-Gegenmassnahmen anwenden — Constant-Time-Algorithmen,
                  Takt-Randomisierung, Leistungsfilter oder Rauscheinspeisung (NIST SP 800-193)"

M-CB-SCA-002:  "Apply electromagnetic shielding and countermeasures against EM emission
                analysis — shield package, use metal lid, route sensitive signals on inner layers"
               | "Elektromagnetische Abschirmung und EM-Emissionsschutz anwenden —
                  Gehäuseabschirmung, Metalldeckel, sicherheitskritische Leitungen auf Innenlagen"

M-CB-SCA-003:  "Use constant-time cryptographic implementations — eliminate
                data-dependent branches and memory access patterns"
               | "Kryptographische Implementierungen mit konstanter Laufzeit verwenden —
                  Datenabhängige Verzweigungen und Speicherzugriffsmuster eliminieren"

M-CB-SCA-004:  "Apply potting compound or conformal coating to security-critical PCB
                areas — prevent physical probing of bus traces between security elements"
               | "Vergussmasse oder Schutzlack auf sicherheitskritische Leiterplattenregionen
                  auftragen — physisches Probing von Bus-Leiterbahnen zwischen
                  Security-Elementen verhindern"
```

**Neue Verifications EN | DE:**
```
V-CB-SCA-001:  "Side-channel power analysis test (SPA/DPA) — verify no key-correlated
                power signature is present under differential power analysis"
               | "Seitenkanal-Leistungsanalyse (SPA/DPA) — kein schlüsselkorreliertes
                  Leistungssignal unter differentieller Leistungsanalyse"

V-CB-SCA-002:  "Electromagnetic emission analysis — verify no key-correlated EM
                signal is detectable with standard near-field probe at 10cm"
               | "Elektromagnetische Emissionsanalyse — kein schlüsselkorreliertes
                  EM-Signal mit Standard-Nahfeldprobe bei 10cm detektierbar"

V-CB-SCA-003:  "Timing attack test — verify cryptographic operations complete in
                constant time independent of key or data values"
               | "Timing-Angriff-Test — kryptographische Operationen in konstanter
                  Zeit unabhängig von Schlüssel- oder Datenwerten"

V-CB-SCA-004:  "PCB inspection — verify security-critical bus traces (CPU↔TPM,
                CPU↔Secure Element, CPU↔Flash) are covered by potting or conformal
                coating; no test points accessible"
               | "Leiterplatteninspektion — sicherheitskritische Bus-Leiterbahnen
                  (CPU↔TPM, CPU↔Secure Element, CPU↔Flash) durch Verguss oder
                  Schutzlack abgedeckt; keine Test-Punkte zugänglich"
```

**shouldEliminateThreat() Erweiterung:**
```typescript
// In threat-elimination-filter.ts:
// sideChannelProtection === "certified" → alle I-CB-SCA-* eliminieren
case "I":
  if ((props as ChipBoundaryProperties).sideChannelProtection === "certified") return true;
  break;
// I-DF-BUS-001 wird durch matchesContext() gefiltert:
// location !== "on_board" OR physicalPathProtection !== "none"
// OR encryptionInTransit !== "none" → kein Match → kein Threat
```

**matchesContext() Erweiterungen:**
```typescript
// In threat-catalog-service.ts:

// ChipBoundary: sideChannelProtection
if (ctx.sideChannelProtection !== undefined) {
  const val = (elementProps as ChipBoundaryProperties).sideChannelProtection ?? "none";
  if (!ctx.sideChannelProtection.includes(val)) return false;
}

// DataFlow: physicalPathProtection (bereits vorhanden — kein neues Property)
// I-DF-BUS-001 nutzt bestehende location + physicalPathProtection + encryptionInTransit:
//   location=on_board + physicalPathProtection=none + encryptionInTransit=none
//   → Bus-Leiterbahn physisch zugänglich, kein Schutz, Klartext → Match
```

**Rauchmelder-Referenzbeispiel — betroffene Elemente:**
- CB-1, CB-2: `sideChannelProtection=none` → I-CB-SCA-001/002/003 aktiv
- CB-1, CB-2: `sideChannelProtection=none` → I-CB-SCA-004 aktiv (physisches Probing)
- DF-1 (SPI CB-1↔CB-2): `location=on_board`, `physicalPathProtection=none`,
  `encryptionInTransit=none` → I-DF-BUS-001: "Bus Eavesdropping: Messwerte + Befehle
  auf SPI-Bus auslesbar — bei Platinen ohne Potting mit $30 Logik-Analyser"

**Praktischer Impact (Workshop-Aha-Moment):**
Der TPM/SPI-Angriff ist mit einem $30 Logik-Analyser durchführbar wenn:
1. `location=on_board` + `physicalPathProtection=none` auf dem SPI DataFlow
   (keine inneren Lagen, kein Potting, kein Konformal-Lack)
2. `encryptionInTransit=none` (SPI im Klartext)
3. Physischer Zugang (nach Gehäuse öffnen — IP67 ist kein Tamper-Schutz)

Ohne Potting oder Konformal-Beschichtung ist das Risiko CRITICAL selbst
wenn `debugInterfaceLocked=true` — der Debug-Port ist gesperrt, aber die
Leiterbahn ist frei zugänglich.

---

### ⬜ Commit 8b — Gap Threat Templates: Process / Interface / System

**Neue Datei:** `gap-threat-templates.json`

Templates, i18n-Texte und Katalog-Einträge für property-basierte Gap-Threats.

**Templates (JSON):**
Siehe Catalog Gap Analysis, Sektion 8 — `gap-threat-templates.json`.

**Neue Mitigations EN | DE:**
```
M-T-FSAFE-001:    "Define and implement a deterministic fail-safe output state for all process outputs (CR 3.6)"
                  | "Deterministischen Fail-Safe-Ausgangszustand für alle Prozessausgänge definieren und implementieren (CR 3.6)"
M-T-007:          "Require cryptographically signed firmware updates — reject unsigned or unverifiable images"
                  | "Kryptografisch signierte Firmware-Updates vorschreiben — unsignierte Images werden abgewiesen"
M-S-006:          "Use centralized account management with revocation capability (LDAP, Active Directory, RADIUS, IAM)"
                  | "Zentralisiertes Account-Management mit Widerrufs-Möglichkeit verwenden (LDAP, AD, RADIUS, IAM)"
M-D-006:          "Implement automated backup and tested recovery procedure for system restoration after attack (CR 7.3/7.4)"
                  | "Automatisiertes Backup und getestetes Recovery-Verfahren zur Systemwiederherstellung implementieren (CR 7.3/7.4)"
M-IF-POLICY-001:  "Decommission factory-only interfaces before production deployment — verify operationalState=permanent_disabled"
                  | "Nur-Werk-Schnittstellen vor Produktionsfreigabe ausser Betrieb nehmen — operationalState=permanent_disabled verifizieren"
M-IF-POLICY-002:  "Enforce maintenance-window access policy — interface must be automatically disabled outside declared windows"
                  | "Wartungsfenster-Zugriffsrichtlinie durchsetzen — Schnittstelle ausserhalb Wartungsfenster automatisch deaktivieren"
M-R-006:          "Implement non-repudiation mechanism for critical operations (audit log, digital signature, hardware-backed)"
                  | "Nicht-Abstreitbarkeits-Mechanismus für kritische Operationen implementieren (Audit-Log, digitale Signatur)"
```

**Neue Verifications EN | DE:**
```
V-T-FSAFE-001:    "Test fail-safe output state under simulated attack or communication loss — verify defined safe state is reached"
                  | "Fail-Safe-Ausgangszustand unter simuliertem Angriff oder Kommunikationsausfall testen"
V-S-005:          "Verify account revocation process — confirm stale accounts are removed within SLA"
                  | "Account-Widerrufs-Prozess verifizieren — Stale-Accounts innerhalb SLA entfernt"
V-D-005:          "Execute backup restore test — verify system can be fully recovered within defined RTO"
                  | "Backup-Wiederherstellungstest durchführen — System innerhalb RTO vollständig wiederherstellbar"
V-IF-POLICY-001:  "Verify factory/maintenance interface policy — confirm interface is inaccessible outside maintenance window"
                  | "Fabrik-/Wartungs-Schnittstellenrichtlinie verifizieren — Schnittstelle ausserhalb Wartungsfenster unzugänglich"
```

**Neue Threat-Texte EN | DE:**
Siehe Catalog Gap Analysis, Sektion 9 (alle T-P-FSAFE-001, T-IF-POLICY-001/002,
S-P-ACCT-001, D-SYS-BACKUP-001, T-SYS-UPDATE-001, T-CB-CRYPTO-001, I-P-AUTH-001).

---

### ⬜ Commit 9b — Safety + Physical DataFlow Templates

**Neue Datei:** `safety-dataflow-templates.json`

Templates für `safetyFunction`, `physicalPathProtection`, `location`, `accessMode`.

**Neue Mitigations EN | DE:**
```
M-T-008:   "Protect physical cable routing with cable duct, conduit, or armored cable"
           | "Physischen Kabelweg durch Kabelkanal, Rohrleitung oder gepanzertes Kabel schützen"
M-T-009:   "Secure cable access points with tamper-evident seals or locked enclosures"
           | "Kabelzugangspunkte mit manipulationssicheren Siegeln oder abgeschlossenen Gehäusen sichern"
M-T-010:   "Restrict data flow to read-only access — disable write/command registers at protocol level"
           | "Datenfluss auf Lesezugriff beschränken — Schreib-/Befehlsregister auf Protokollebene deaktivieren"
M-T-011:   "Apply end-to-end integrity protection (HMAC/signature) on data flows crossing the safety boundary (EN 50742)"
           | "Ende-zu-Ende-Integritätsschutz auf Datenflüssen über die Sicherheitsgrenze anwenden (EN 50742)"
M-D-007:   "Use secured connectors (M12 locking, screw terminals) and cable strain relief to prevent disconnection"
           | "Gesicherte Steckverbinder (M12-Verriegelung, Schraubklemmen) und Kabelzugentlastung verwenden"
M-D-008:   "Implement redundant, independent communication path for safety-critical data flows (IEC 61508)"
           | "Redundanten, unabhängigen Kommunikationspfad für sicherheitskritische Datenflüsse implementieren (IEC 61508)"
M-D-009:   "Enable island mode capability — boundary can isolate zone completely on incident detection (NDR 5.2 RE2)"
           | "Island-Mode-Fähigkeit aktivieren — Grenzschutz kann Zone bei Zwischenfall vollständig isolieren (NDR 5.2 RE2)"
M-S-007:   "Enforce default-deny policy at trust boundary — only explicitly permitted traffic allowed (NDR 5.2 RE1)"
           | "Default-Deny-Policy an Vertrauensgrenze durchsetzen — nur explizit erlaubter Datenverkehr zulässig (NDR 5.2 RE1)"
M-I-007:   "Apply data minimization — expose only necessary registers/topics; filter or aggregate at source"
           | "Datenminimerung anwenden — nur notwendige Register/Topics exponieren; an der Quelle filtern oder aggregieren"
```

**Neue Verifications EN | DE:**
```
V-T-006:   "Inspect and document physical cable routing protection (duct, conduit, armoring) — photo evidence required"
           | "Physischen Kabelverlegungsschutz prüfen und dokumentieren — Foto-Nachweis erforderlich"
V-T-007:   "Verify end-to-end integrity on safety-relevant data flows (HMAC/signature test under attack simulation)"
           | "Ende-zu-Ende-Integritätsschutz auf sicherheitsrelevanten Datenflüssen verifizieren"
V-D-006:   "Test physical cable disconnection resilience — verify system behavior on connector pull and restoration"
           | "Physische Kabel-Trennungsresilienz testen — Systemverhalten bei Stecker-Zug verifizieren"
V-D-007:   "Verify safety function availability under network attack simulation (flood, jam, injection)"
           | "Safety-Function-Verfügbarkeit unter Netzwerk-Angriffssimulation verifizieren (Flooding, Jamming, Injection)"
```

---

### ⬜ Commit 10b — New Mitigations Batch 1 (Crypto / Auth / Backup / Malware)

**Neue Mitigations + Template-Updates:**

```
M-T-006:   "Enforce cryptographic code signing — only firmware signed with trusted key accepted for execution"
           | "Kryptografische Code-Signierung erzwingen — nur mit vertrauenswürdigem Schlüssel signierte Firmware wird akzeptiert"
M-T-012:   "Use only approved cryptographic algorithms and key lengths (NIST SP 800-131A, BSI TR-02102) — CR 4.3"
           | "Ausschliesslich zugelassene kryptografische Algorithmen und Schlüssellängen verwenden (CR 4.3)"
M-E-007:   "Implement application whitelisting — only explicitly authorized binaries may execute"
           | "Anwendungs-Whitelisting implementieren — nur explizit autorisierte Binärdateien dürfen ausgeführt werden"
M-E-008:   "Deploy antivirus / EDR software and keep signatures up to date"
           | "Antiviren- / EDR-Software einsetzen und Signaturen aktuell halten"
M-I-006:   "Store cryptographic keys and credentials in hardware-protected storage (TPM, Secure Element, HSM)"
           | "Kryptografische Schlüssel und Zugangsdaten in hardware-geschütztem Speicher ablegen (TPM, SE, HSM)"
M-I-007:   → bereits in Commit 9
M-I-008:   "Enforce hardware access control on storage (MPU memory protection or encryption-as-access-control)"
           | "Hardware-Zugriffsschutz auf Speicher erzwingen (MPU-Speicherschutz oder Verschlüsselung als Zugangskontrolle)"
M-I-009:   "Implement verifiable secure deletion (crypto erase, factory reset, overwrite) for end-of-life and device return"
           | "Verifizierbare sichere Löschung implementieren (Crypto-Erase, Factory-Reset) für Lebensende und Geräterückgabe"
M-CB-I-002: "Store device keys and certificates in dedicated hardware security module (TPM, Secure Element, HSM)"
            | "Geräteschlüssel und Zertifikate in dediziertem Hardware-Sicherheitsmodul ablegen (TPM, SE, HSM)"
```

**Neue Verifications:**
```
V-T-005:   "Verify malware protection mechanism is active (code signing verification, whitelist check, AV scan)"
           | "Malware-Schutz-Mechanismus verifizieren — Code-Signing-Prüfung, Whitelist-Check oder AV-Scan aktiv"
V-I-005:   "Verify authenticator storage protection — confirm keys are non-extractable from hardware security component"
           | "Authentifizierungs-Speicher-Schutz verifizieren — Schlüssel sind aus Hardware-Komponente nicht extrahierbar"
V-CB-I-002: "Verify hardware key storage — confirm cryptographic keys are bound to chip and non-extractable"
            | "Hardware-Schlüsselspeicher verifizieren — Schlüssel sind an Sicherheitschip gebunden und nicht extrahierbar"
```

**Template-Updates:** Bestehende Templates um neue M/V ergänzen (siehe Gap Analysis Sektion 10, Commit 10).

---

### ⬜ Commit 11b — New Mitigations Batch 2 (Interface Controls)

```
M-IF-S-002:    "Require password authentication before interface access (spoofing reduced; credential theft residual)"
               | "Passwort-Authentifizierung vor Schnittstellenzugriff vorschreiben (Credential-Theft-Restrisiko verbleibt)"
M-IF-S-003:    "Require multi-factor authentication for interface access (CR 1.1 RE2)"
               | "Multi-Faktor-Authentifizierung für Schnittstellenzugriff vorschreiben (CR 1.1 RE2)"
M-IF-DBG-001:  "Require authentication before enabling debug access; restrict to read-only or limited command set"
               | "Authentifizierung vor Debug-Zugang vorschreiben; auf Read-Only oder eingeschränkten Befehlssatz beschränken"
M-IF-DBG-002:  "Enable memory readback protection (e.g. STM32 RDP1) to prevent firmware extraction via debug interface"
               | "Speicher-Readback-Schutz aktivieren (z.B. STM32 RDP1), um Firmware-Extraktion zu verhindern"
M-IF-DBG-003:  "Permanently disable debug interface via OTP fuse or pad removal — equivalent to permanent_disabled"
               | "Debug-Schnittstelle dauerhaft via OTP-Sicherung oder Pad-Entfernung deaktivieren — entspricht permanent_disabled"
M-IF-D-003:    "Implement rate limiting and lockout on interface to prevent brute-force and flooding attacks"
               | "Rate-Limiting und Sperrung an der Schnittstelle implementieren, um Brute-Force- und Flooding-Angriffe zu verhindern"
M-IF-D-004:    "Lock interface after repeated failed access attempts to prevent brute-force attacks"
               | "Schnittstelle nach wiederholten Fehlversuchen sperren, um Brute-Force-Angriffe zu verhindern"
M-IF-MON-001:  "Enable interface access monitoring with real-time alerting or automated response on anomalous access"
               | "Schnittstellenüberwachung mit Echtzeit-Alarmierung oder automatischer Reaktion bei anomalem Zugriff aktivieren"
```

**Neue Verifications:**
```
V-IF-DBG-001:  "Verify debug interface access control — attempt unauthorized access with and without authentication"
               | "Debug-Schnittstellen-Zugangskontrolle verifizieren — unautorisierten Zugriff versuchen"
V-IF-MON-001:  "Verify interface monitoring captures access events and alerts within defined detection time"
               | "Schnittstellenüberwachung verifizieren — Zugangsereignisse werden erfasst und Alarme zeitgerecht empfangen"
```

---

### ⬜ Commit 12b — Text-Korrekturen bestehende Verifications

**Datei:** `verifications.json` (EN + DE)

| ID | Alt | Neu |
|----|-----|-----|
| V-T-003 EN | "SQL injection testing (SQLMap, Burp Suite)" | "Access control and write-access testing; SQL injection testing where applicable (SQLMap, Burp Suite)" |
| V-T-003 DE | "SQL-Injection-Tests (SQLMap, Burp Suite)" | "Zugriffsrechte- und Schreibzugriffs-Tests; SQL-Injection-Tests wo anwendbar (SQLMap, Burp Suite)" |
| V-E-002 EN | "Authorization bypass testing (OWASP ZAP, Burp Suite)" | "Authorization bypass testing (OWASP ZAP, Burp Suite); for embedded: protocol fuzzing and privilege command injection" |
| V-E-002 DE | "Autorisierungsumgehungstests (OWASP ZAP, Burp Suite)" | "Autorisierungsumgehungstests (OWASP ZAP, Burp Suite); für Embedded: Protokoll-Fuzzing und Privileged-Command-Injection" |
| V-D-002 DE | "DDoS-Simulationstests" | "DDoS-Simulationstests; für OT: Fieldbus-Flooding und Protokoll-Stress-Tests" |

---

## Property → Threat Treatment Mapping (Referenz)

### Eliminate (kein Threat generiert)

| Element | Property | Value | Eliminiert |
|---------|----------|-------|-----------|
| Interface | `operationalState` | `permanent_disabled` | Alle STRIDE |
| Interface | `implementedControls.debugProtection` | `fused_off` | T, I, E |
| Interface | `implementedControls.physicalAccessProtection` | `sealed` | T, E |
| Interface | `implementedControls.signalProtection` | `fiber_optic` | I |
| Interface | `operationalState` | `enabled_read_only` | S, E |
| DataFlow | `physicalPathProtection` | `buried` | T |
| DataFlow | `excludeFromThreatGen` | `true` | Alle (upstream) |

### Reduce (Threat + alreadyImplemented)

| Element | Property | Value | Reduces | Residual |
|---------|----------|-------|---------|----------|
| Interface | `operationalState` | `sw_disabled` | S, T, E | SW re-enable |
| Interface | `operationalState` | `hw_disabled` | S, T, E | Physical re-enable |
| Interface | `implementedControls.logicalAccessControl` | `password` | S | Credential theft |
| Interface | `implementedControls.logicalAccessControl` | `certificate` | S | Key management |
| Interface | `implementedControls.logicalAccessControl` | `hardware_token` | S, E | Token loss |
| Interface | `implementedControls.logicalAccessControl` | `mfa` | S, E | Phishing residual |
| Interface | `implementedControls.debugProtection` | `auth_required` | T, E | Credential theft |
| Interface | `implementedControls.debugProtection` | `readout_protection` | I | Side-channel |
| Interface | `implementedControls.physicalAccessProtection` | `inside_enclosure` | T, E | Bypass |
| Interface | `implementedControls.physicalAccessProtection` | `locked_panel` | T, E | Lock picking |
| Interface | `implementedControls.abuseProtection` | `rate_limited` | D | Burst flood |
| Interface | `implementedControls.abuseProtection` | `lockout` | S | Lockout bypass |
| Interface | `implementedControls.monitoringControl` | `alerted` | alle | Detectability ↓ |
| Interface | `implementedControls.monitoringControl` | `active_response` | E, T | Bypass |
| Interface | `implementedControls.signalProtection` | `shielded` | I | Active tap |
| Process | `malwareProtection` | `av_software` | E, T | Zero-day |
| Process | `malwareProtection` | `application_whitelist` | E | Whitelist bypass |
| Process | `malwareProtection` | `code_signing` | E, T | Key compromise |
| Process | `malwareProtection` | `nx_dep` | E | ROP chain |
| DataFlow | `physicalPathProtection` | `cable_duct\|conduit\|armored_cable` | T | Physical access |
| DataFlow | `physicalPathProtection` | `tamper_seal\|locked_cabinet` | T | Seal defeat |
| DataFlow | `physicalPathProtection` | `locked_cabinet` | D | Lock bypass |
| TrustBoundary | `defaultDenyPolicy` | `deny_all_permit_exception` | S, T | Misconfigured rule |
| TrustBoundary | `defaultDenyPolicy` | `island_mode` | D | Isolation failure |
| PhysicalBoundary | `tamperProtection` | `switch\|mesh` | T, E | Detection only |
| PhysicalBoundary | `physicalAccessControl` | `badge_pin\|biometric` | S, E | Credential compromise |
| PhysicalBoundary | `monitoringType` | `soc` | alle physisch | Dwell time ↓ |

### Generate Additional Threat (Property zeigt Gap)

| Element | Property | Value | Template | STRIDE |
|---------|----------|-------|----------|--------|
| Interface | `implementedControls.serviceAccessPolicy` | `factory_only` | T-IF-POLICY-001 | T |
| Interface | `implementedControls.serviceAccessPolicy` | `maintenance_only` | T-IF-POLICY-002 | T, E |
| Process | `failSafeOutputState` | `not_defined` | T-P-FSAFE-001 | T |
| Process/Multiprocess | `accountManagement` | `local_only` | S-P-ACCT-001 | S |
| Multiprocess | `backupMechanism` | `none` | D-SYS-BACKUP-001 | D |
| Multiprocess | `updateMechanism` | `none\|manual_local` | T-SYS-UPDATE-001 | T |
| Process/Multiprocess | `authenticatorStorage` | `software_only` | I-P-AUTH-001 | I |
| ChipBoundary | `cryptoStandard` | `not_assessed` | T-CB-CRYPTO-001 | T, I |
| PhysicalBoundary | `debugInterfaceAccessible` | `true` | T-PB-002, E-PB-002 | T, I, E |
| PhysicalBoundary | `removableMediaAccessible` | `true` | T-PB-003, I-PB-002 | T, I |
| PhysicalBoundary | `physicalMobility` | `portable\|removable` | T-PB-004, D-PB-002 | T, D |
| DataFlow | `location` | `field_cable\|in_enclosure\|on_board` | T-DF-PHYSICAL-001 | T |
| DataFlow | `location=field_cable` + `redundancy=none` | — | D-DF-PHYSICAL-001 | D |
| DataFlow | `safetyFunction` | `emergency_stop\|safety_gate\|...` | T-DF-SAFETY-001 | T |
| DataFlow | `safetyFunction` | `emergency_stop\|safety_gate` | D-DF-SAFETY-001 | D |
| DataFlow | OT-Protokoll + `accessMode=read_write` | — | T-DF-ACCESS-001 | T |

---

## Neue Katalog-Einträge — Vollständige Übersicht

### Neue Mitigations (37 total)

| ID | EN | DE | Commit |
|----|----|----|--------|
| M-T-FSAFE-001 | Define deterministic fail-safe output state (CR 3.6) | Deterministischen Fail-Safe-Ausgangszustand definieren (CR 3.6) | 8 |
| M-T-006 | Enforce cryptographic code signing | Kryptografische Code-Signierung erzwingen | 10 |
| M-T-007 | Require signed firmware updates | Signierte Firmware-Updates vorschreiben | 8 |
| M-T-008 | Physical cable routing protection (duct/conduit/armored) | Physischen Kabelweg durch Kabelkanal/Rohrleitung schützen | 9 |
| M-T-009 | Tamper-evident seals on cable access points | Manipulationssichere Siegel an Kabelzugangspunkten | 9 |
| M-T-010 | Restrict data flow to read-only at protocol level | Datenfluss auf Lesezugriff beschränken (Protokollebene) | 9 |
| M-T-011 | End-to-end integrity on safety boundary flows (EN 50742) | Ende-zu-Ende-Integrität auf Safety-Boundary-Flows (EN 50742) | 9 |
| M-T-012 | Approved crypto algorithms only (CR 4.3) | Ausschliesslich zugelassene Algorithmen verwenden (CR 4.3) | 10 |
| M-S-006 | Centralized account management with revocation (CR 1.3) | Zentralisiertes Account-Management mit Widerruf (CR 1.3) | 8 |
| M-S-007 | Default-deny policy at trust boundary (NDR 5.2 RE1) | Default-Deny-Policy an Vertrauensgrenze (NDR 5.2 RE1) | 9 |
| M-E-007 | Application whitelisting | Anwendungs-Whitelisting | 10 |
| M-E-008 | Antivirus / EDR software | Antiviren- / EDR-Software | 10 |
| M-I-006 | Hardware-protected authenticator storage (CR 1.5 RE1) | Hardware-geschützter Authentifizierungs-Speicher (CR 1.5 RE1) | 10 |
| M-I-007 | Data minimization at source | Datenminimerung an der Quelle | 9 |
| M-I-008 | Hardware access control on storage (MPU/crypto-erase) | Hardware-Zugriffsschutz auf Speicher (MPU/Crypto-Erase) | 10 |
| M-I-009 | Secure deletion for end-of-life | Sichere Löschung für Lebensende | 10 |
| M-R-006 | Non-repudiation mechanism (CR 2.12) | Nicht-Abstreitbarkeits-Mechanismus (CR 2.12) | 8 |
| M-D-006 | Automated backup + recovery procedure (CR 7.3/7.4) | Automatisiertes Backup + Recovery-Verfahren (CR 7.3/7.4) | 8 |
| M-D-007 | Secured connectors + strain relief | Gesicherte Steckverbinder + Kabelzugentlastung | 9 |
| M-D-008 | Redundant path for safety-critical flows (IEC 61508) | Redundanter Pfad für sicherheitskritische Flows (IEC 61508) | 9 |
| M-D-009 | Island mode capability (NDR 5.2 RE2) | Island-Mode-Fähigkeit (NDR 5.2 RE2) | 9 |
| M-CB-I-002 | Hardware key storage on chip (EDR 3.12) | Hardware-Schlüsselspeicher auf Chip (EDR 3.12) | 10 |
| M-IF-S-002 | Password auth on interface | Passwort-Auth an Schnittstelle | 11 |
| M-IF-S-003 | MFA on interface (CR 1.1 RE2) | MFA an Schnittstelle (CR 1.1 RE2) | 11 |
| M-IF-DBG-001 | Auth before debug access + restricted commands | Auth vor Debug-Zugang + eingeschränkte Befehle | 11 |
| M-IF-DBG-002 | Memory readback protection (RDP1) | Speicher-Readback-Schutz (RDP1) | 11 |
| M-IF-DBG-003 | Permanent debug disable via OTP fuse | Dauerhaftes Debug-Deaktivieren via OTP-Sicherung | 11 |
| M-IF-D-003 | Rate limiting + lockout on interface | Rate-Limiting + Sperrung an Schnittstelle | 11 |
| M-IF-D-004 | Interface lockout after failed attempts | Schnittstellen-Sperrung nach Fehlversuchen | 11 |
| M-IF-MON-001 | Interface access monitoring with alerting | Schnittstellen-Überwachung mit Alarmierung | 11 |
| M-IF-POLICY-001 | Decommission factory interface before production | Nur-Werk-Schnittstelle vor Produktion ausser Betrieb nehmen | 8 |
| M-IF-POLICY-002 | Enforce maintenance-window policy | Wartungsfenster-Richtlinie durchsetzen | 8 |
| M-PB-T-001..005 | (5 PB tamper/debug/media/mobility) | (5 PB) | 7 |
| M-PB-S-001..002 | (2 PB access control) | (2 PB) | 7 |
| M-PB-R-001..002 | (2 PB monitoring) | (2 PB) | 7 |
| M-PB-D-001 | Physical anchoring | Physische Verankerung | 7 |

### Neue Verifications (21 total)

| ID | EN | DE | Commit |
|----|----|----|--------|
| V-T-005 | Verify malware protection mechanism | Malware-Schutz-Mechanismus verifizieren | 10 |
| V-T-006 | Inspect physical cable routing protection | Physischen Kabelverlegungsschutz prüfen | 9 |
| V-T-007 | Verify safety flow integrity (attack simulation) | Safety-Flow-Integrität verifizieren | 9 |
| V-T-FSAFE-001 | Test fail-safe output state | Fail-Safe-Ausgangszustand testen | 8 |
| V-S-005 | Verify account revocation process | Account-Widerrufs-Prozess verifizieren | 8 |
| V-I-005 | Verify authenticator storage protection | Auth-Speicher-Schutz verifizieren | 10 |
| V-D-005 | Execute backup restore test | Backup-Wiederherstellungstest durchführen | 8 |
| V-D-006 | Test physical cable disconnection resilience | Physische Kabel-Trennungsresilienz testen | 9 |
| V-D-007 | Verify safety function under attack simulation | Safety-Function-Verfügbarkeit verifizieren | 9 |
| V-IF-DBG-001 | Verify debug interface access control | Debug-Schnittstellen-Zugangskontrolle verifizieren | 11 |
| V-IF-MON-001 | Verify interface monitoring captures events | Schnittstellenüberwachung verifizieren | 11 |
| V-IF-POLICY-001 | Verify factory/maintenance interface policy | Fabrik-/Wartungs-Schnittstellenrichtlinie verifizieren | 8 |
| V-CB-I-002 | Verify hardware key storage on chip | Hardware-Schlüsselspeicher auf Chip verifizieren | 10 |
| V-PB-T-001..004 | (4 PB tamper/debug/media) | (4 PB) | 7 |
| V-PB-S-001 | Test physical access control | Physisches Zutrittskontrollsystem testen | 7 |
| V-PB-R-001 | Verify physical monitoring | Physisches Überwachungssystem prüfen | 7 |

### Neue Templates (17 total)

| ID | Datei | Commit |
|----|-------|--------|
| T-PB-001..004, I-PB-001/002, D-PB-001/002, S-PB-001, E-PB-001/002, R-PB-001 | physical-boundary-element-templates.json | 7 |
| T-P-FSAFE-001, T-IF-POLICY-001/002, S-P-ACCT-001, D-SYS-BACKUP-001, T-SYS-UPDATE-001, T-CB-CRYPTO-001, I-P-AUTH-001 | gap-threat-templates.json | 8 |
| T-DF-PHYSICAL-001, D-DF-PHYSICAL-001, T-DF-SAFETY-001, D-DF-SAFETY-001, T-DF-ACCESS-001 | safety-dataflow-templates.json | 9 |
