# Handover — Block 1: Property Cascade Rules

## Project Context

**TARAflow** — Electron + React/TypeScript threat modeling tool (TARA).
**Developer:** Juergen Messerer, bbv Software Services AG.
**Stack:** Electron, React, TypeScript, MUI, draw.io (iframe/postMessage), Vite, i18next.
**Architecture:** Vertical slice features, Clean Architecture, SOLID.

---

## What Was Done Before This Block

All 6 DFD element description forms were restructured from "General / Advanced" accordions
to a flat three-section layout: **Context → Security → Documentation**.

Cascade rules are already implemented for:
- **Process:** `technology` → authRequired, authModel, inputValidation, errorHandling (via `getProcessDefaults`)
- **Process:** `runsAs` → privilegeLevel, authRequired (via `getProcessDefaults`)
- **Process:** `technology` (embedded group) → runsAs + privilegeLevel **disabled** with tooltip
- **ExternalEntity:** `entityType` → trustLevel, authMethod, threatActor (via `EXTERNAL_ENTITY_TYPE_DEFAULTS`)

Files:
- `src/features/dfd/models/element-property-defaults.ts` — existing cascade logic
- `src/features/dfd/components/forms/process-description-form.tsx` — EMBEDDED_TECHNOLOGIES set
- `src/features/dfd/components/forms/external-entity-form.tsx` — entityType handler

---

## What Needs To Be Done In This Block

Implement cascade rules for the remaining 4 element types.
Reference document: `docs/dfd-property-cascade-rules.md`

---

## DataStore Cascades

### Driver: `technology`

```typescript
// In element-property-defaults.ts or new datastore-defaults.ts
export const DATASTORE_TECH_DEFAULTS: Record<string, Partial<DataStoreProperties>> = {
  database:   { encryptionAtRest: "tde",    integrityProtection: true,  multiTenant: undefined },
  cloud:      { encryptionAtRest: "kms",    integrityProtection: true,  multiTenant: true },
  filesystem: { encryptionAtRest: "none",   integrityProtection: false, multiTenant: false },
  cache:      { encryptionAtRest: "none",   integrityProtection: false },
  queue:      { encryptionAtRest: "none",   integrityProtection: false },
  blockchain: { encryptionAtRest: "custom", integrityProtection: true,  multiTenant: false },
};
```

### Driver: `dataClassification`

Not an auto-fill — show a **hint** when classification is `secret` or `restricted`
but `encryptionAtRest` is `none`:

```
Warning: "Data classified as SECRET/RESTRICTED without encryption at rest — 
high Information Disclosure risk"
```

### Driver: `containsSafetyRelevantData`

When set to `true`:
- `safetyRationale` field becomes visible (already implemented)
- Show warning if `integrityProtection = false`: "Safety-relevant data without integrity protection — Tampering threat"

---

## DataFlow Cascades

### Driver: `protocol`

```typescript
export const DATAFLOW_PROTOCOL_DEFAULTS: Record<string, Partial<DataFlowProperties>> = {
  https:     { direction: "requestresponse", endpointAuthentication: "token",       encryptionInTransit: "tls" },
  grpc:      { direction: "requestresponse", endpointAuthentication: "certificate", encryptionInTransit: "tls" },
  http:      { direction: "requestresponse", endpointAuthentication: "none",        encryptionInTransit: "none" },
  mqtt:      { direction: "unidirectional",  endpointAuthentication: "none",        encryptionInTransit: "none" },
  amqp:      { direction: "unidirectional",  endpointAuthentication: "token",       encryptionInTransit: "none" },
  websocket: { direction: "unidirectional",  endpointAuthentication: "token",       encryptionInTransit: "tls" },
  file:      { direction: "unidirectional",  endpointAuthentication: "none",        encryptionInTransit: "none" },
  database:  { direction: "requestresponse", endpointAuthentication: "certificate", encryptionInTransit: "none" },
};
// Note: websocket direction="bidirectional" would trigger validator C7 — use unidirectional
```

**Planned embedded protocols (add to DataFlowProperties.protocol type):**
```typescript
| "can" | "modbus" | "uart" | "spi" | "i2c"
// All default to: direction="unidirectional", endpointAuth="none", encryptionInTransit="none"
```

---

## Interface Cascades

### Driver: `type`

```typescript
export const INTERFACE_TYPE_DEFAULTS: Record<string, Partial<InterfaceProperties>> = {
  ethernet:  { accessControl: "credentials" },
  wifi:      { accessControl: "credentials" },
  bluetooth: { accessControl: "credentials" },
  fiber:     { accessControl: "credentials" },
  usb:       { accessControl: "none" },  // + hint: "Is this a programming/debug port?"
  serial:    { accessControl: "none" },  // + hint: "Is this connected to safety-critical component?"
  gpio:      { accessControl: "none" },  // + hint: "Does this connect to safety actuators/sensors?"
  nfc:       { accessControl: "none" },
  custom:    { accessControl: "none" },
};
```

**Safety hints** (show as Alert info, not auto-fill) for `usb`, `serial`, `gpio`:
```
"This interface type is a common attack surface on embedded systems. 
Consider setting safetyRelevant if connected to safety-critical components."
```

---

## TrustBoundary Cascades

### Driver: `boundaryType`

```typescript
export const TB_TYPE_DEFAULTS: Record<string, Partial<TrustBoundaryProperties>> = {
  network:      { defaultExposureLevel: "EL3", monitoringEnabled: true  },
  cloud:        { defaultExposureLevel: "EL4", monitoringEnabled: true  },
  privilege:    { defaultExposureLevel: "EL1", monitoringEnabled: false },
  device:       { defaultExposureLevel: "EL1", monitoringEnabled: false },
  physical:     { defaultExposureLevel: "EL1", monitoringEnabled: false },
  organization: { defaultExposureLevel: "EL3", monitoringEnabled: false },
  legal:        { defaultExposureLevel: "EL2", monitoringEnabled: false },
  peripheral:   { defaultExposureLevel: "EL1", monitoringEnabled: false },
  boot:         { defaultExposureLevel: "EL0", monitoringEnabled: false },
  debug:        { defaultExposureLevel: "EL1", monitoringEnabled: false },
};
```

**securityAssumptions placeholder** — set per boundaryType (not auto-fill, just placeholder text):
```typescript
export const TB_SECURITY_ASSUMPTIONS_PLACEHOLDERS: Record<string, string> = {
  network:      "External network is untrusted. All ingress/egress requires authentication and encryption.",
  cloud:        "Cloud perimeter is public. IAM policies and encryption are mandatory.",
  privilege:    "Lower privilege zone cannot initiate connections to higher privilege zone.",
  device:       "Device boundary. External interfaces require authentication.",
  physical:     "Physical access required for attack. Tamper-evident enclosure assumed.",
  organization: "Organizational boundary. Contractual controls apply.",
  legal:        "Regulatory boundary. Compliance controls apply.",
  peripheral:   "MCU to external chip boundary. Bus protocol has no authentication.",
  boot:         "Bootloader to application boundary. Secure Boot chain enforced.",
  debug:        "Debug interface boundary. Must be locked or disabled in production.",
};
```

---

## Implementation Pattern

All cascades should follow the existing Process pattern:

```typescript
// In the form's handlePropertyChange:
if (field === "technology") {
  const defaults = DATASTORE_TECH_DEFAULTS[value as string] ?? {};
  onChange({ properties: { ...element.properties, technology: value, ...defaults } });
  return;
}
```

**Clearing behavior:** When a driver is cleared (value = ""), also clear the fields
it drove — unless the analyst has modified them after the initial auto-fill.
Use a `userModified` ref set to track this if needed.

---

## Key File Paths

```
src/features/dfd/models/element-property-defaults.ts   ← add new DEFAULTS objects
src/features/dfd/components/forms/
  datastore-description-form.tsx
  dataflow-description-form.tsx
  interface-description-form.tsx
  trust-boundary-form.tsx
src/features/dfd/models/element-properties.ts          ← add embedded protocols to DataFlowProperties
docs/dfd-property-cascade-rules.md                     ← reference document
```

---

## Definition of Done

- [ ] `DATASTORE_TECH_DEFAULTS` in element-property-defaults.ts
- [ ] `DATAFLOW_PROTOCOL_DEFAULTS` in element-property-defaults.ts
- [ ] `INTERFACE_TYPE_DEFAULTS` in element-property-defaults.ts
- [ ] `TB_TYPE_DEFAULTS` + `TB_SECURITY_ASSUMPTIONS_PLACEHOLDERS` in element-property-defaults.ts
- [ ] DataStore form: technology handler with cascade + dataClassification warning
- [ ] DataFlow form: protocol handler with cascade + embedded protocol options
- [ ] Interface form: type handler with cascade + safety hints for usb/serial/gpio
- [ ] TrustBoundary form: boundaryType handler with cascade + dynamic placeholder
- [ ] All cascades clear dependent fields when driver is cleared
- [ ] i18n keys for new warning/hint messages in en.json + de.json
