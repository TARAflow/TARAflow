# Ticket 3 — InterfaceProperties: Security Controls Redesign

**Priorität:** Mittel  
**Typ:** Feature / Model Redesign  
**Scope:** `element-properties.ts`, alle Element-Description-Forms, Risk-Tab Close-Loop

---

## Hintergrund

Die aktuelle `security`-Sektion von `InterfaceProperties` vermischt drei verschiedene Konzepte:

| Konzept | Beispiel | Problem |
|---------|---------|---------|
| Intrinsische Eigenschaft | `connectorType`, `location` | Korrekt — bleibt in `context` |
| Betriebszustand | `operationalState` | Gut modelliert — bleibt in `context` |
| Security Control / Mitigation | `accessControl` | Zu unscharf — wird aufgeteilt |
| Medium-Eigenschaft | `isShieldedCable` | Gehört zu DataFlow, nicht Interface |

### Close-Loop Architektur

Security Controls im DFD = applizierbare Mitigations aus dem Risk-Tab:

```
Risk-Tab: Mitigation M-123 als "implemented" markiert
  ↓
DFD-Notification: "Apply security control to Interface IF-4?"
  ↓
User: Apply
  ↓
logicalAccessControl = "certificate"
  ↓
Threats neu berechnet → Residual Risk reduziert
  ↓
Audit Trail geschrieben
```

---

## Geplante neue Struktur

### `InterfaceProperties` — `implementedControls`

```typescript
implementedControls?: {
  // 1. Access Restriction
  logicalAccessControl?:
    | "none"
    | "password"
    | "certificate"
    | "challenge_response"
    | "secure_pairing"
    | "hardware_token";

  physicalAccessProtection?:
    | "none"
    | "inside_enclosure"
    | "locked_panel"
    | "sealed"
    | "requires_tool"
    | "tamper_evident";

  // 2. Debug / Service Hardening (Embedded-spezifisch)
  debugProtection?:
    | "none"
    | "auth_required"
    | "limited_commands"
    | "readout_protection"
    | "fused_off";

  serviceAccessPolicy?:
    | "always_enabled"
    | "maintenance_only"
    | "factory_only"
    | "temporary_enable";

  // 3. Abuse Protection
  abuseProtection?:
    | "none"
    | "rate_limited"
    | "lockout"
    | "cooldown"
    | "flood_protection";

  // 4. Monitoring / Detection
  monitoring?:
    | "none"
    | "usage_logged"
    | "tamper_logged"
    | "alerted"
    | "active_response";

  // 5. Signal / Medium Protection (ersetzt isShieldedCable)
  signalProtection?:
    | "none"
    | "shielded"
    | "twisted_pair"
    | "fiber_optic"
    | "isolated"
    | "conduit_protected";
};
```

### Was entfernt wird
- `accessControl` → aufgeteilt in `logicalAccessControl` + `physicalAccessProtection`
- `isShieldedCable` (boolean) → `signalProtection` enum (DataFlow-Medium-Eigenschaft)

### Was bleibt
- `operationalState` — perfekt modelliert, bleibt in `context`
- `safetyRelevant` — bleibt in `safety`

---

## Auswirkungen auf andere Element-Types

Alle Element-Types prüfen ob sie `implementedControls` vs. intrinsische Eigenschaften sauber trennen:

| Element-Type | Prüfpunkt |
|-------------|-----------|
| `DataFlowProperties` | `shieldedCable` → hier oder `signalProtection` auf Interface? |
| `ProcessProperties` | Security Controls für Prozesse (TEE, Sandbox)? |
| `DataStoreProperties` | Encryption at rest, access control? |
| `TrustBoundaryProperties` | `boundaryControlTypes` bereits gut — analog zu `implementedControls`? |

---

## Files zu übergeben

| File | Änderung |
|------|---------|
| `src/features/dfd/models/element-properties.ts` | `implementedControls` hinzufügen, `accessControl` deprecaten |
| `src/features/dfd/components/forms/interface-description-form.tsx` | Neue Security Controls UI (3-Section Layout) |
| `src/features/dfd/models/element-property-defaults.ts` | Defaults für `implementedControls` |
| `src/i18n/locales/en/dfd.json` | i18n für alle neuen Controls |
| `src/i18n/locales/de/dfd.json` | i18n für alle neuen Controls |
| `src/features/dfd/services/validators/element-property-validator.ts` | Validierung für `implementedControls` |

---

## Threat-Generator Impact

`implementedControls` reduziert direkt die generierten Threats:

| Control | Effekt auf Threat-Generator |
|---------|---------------------------|
| `debugProtection: "fused_off"` | Eliminiert JTAG/SWD Debug-Threats |
| `logicalAccessControl: "certificate"` | Reduziert Spoofing/EoP Threats |
| `physicalAccessProtection: "sealed"` | Erhöht Attack Feasibility für physische Threats |
| `monitoring: "tamper_logged"` | Reduziert Dwell-Time in Risk-Scoring |
| `serviceAccessPolicy: "factory_only"` | Eliminiert Attack Surface in Production |

---

## Abhängigkeiten

- Ticket 1 (Validator Messages) sollte vorher abgeschlossen sein
- Risk-Tab Close-Loop Integration: separates Ticket nach diesem hier
