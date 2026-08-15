# Ticket 1 — Validator Message Architecture Refactor

**Priorität:** Hoch  
**Typ:** Refactoring  
**Scope:** `src/features/dfd/services/validators/` + `src/features/dfd/components/`

---

## Problem

Validators generieren aktuell `KEY|part1|part2` Format-Strings:

```typescript
warnings.push(`${ValidationMessages.INTERFACE_UNUSED}|${displayId}|Interface`);
// → "dfdValidation.interfaceUnused|IF-1|Interface"
```

`dfd-notification-panel.tsx` baut daraus den Display-Text zusammen — Template-Logik im UI-Layer.

Das ist falsch: der Panel soll nur anzeigen, nicht zusammenbauen.

---

## Ziel

**Validators → fertige Display-Strings**  
**Notification Panel → zeigt String an, fertig**

```typescript
// Validator (neu):
warnings.push(`Interface "IF-1" is not crossed by any data flow`);

// Panel (neu):
<Typography>{message}</Typography>
```

---

## Betroffene Files

### Validators (10 Files)
| File | Pfad |
|------|------|
| `asset-property-validator.ts` | `src/features/dfd/services/validators/` |
| `asset-relation-validator.ts` | `src/features/dfd/services/validators/` |
| `completeness-validator.ts` | `src/features/dfd/services/validators/` |
| `connection-validator.ts` | `src/features/dfd/services/validators/` |
| `dataflow-label-property-validator.ts` | `src/features/dfd/services/validators/` |
| `dataflow-label-validator.ts` | `src/features/dfd/services/validators/` |
| `dataflow-property-validator.ts` | `src/features/dfd/services/validators/` |
| `element-property-validator.ts` | `src/features/dfd/services/validators/` |
| `element-validator.ts` | `src/features/dfd/services/validators/` |
| `validator-utils.ts` | `src/features/dfd/services/validators/` |

### UI
| File | Pfad | Änderung |
|------|------|----------|
| `dfd-notification-panel.tsx` | `src/features/dfd/components/` | Template-Logik entfernen, String direkt anzeigen |

### i18n
Validators brauchen Zugriff auf `t()` oder eine i18n-Resolver-Funktion.

**Option A:** Validators nehmen `t: TFunction` als Parameter  
**Option B:** Validators importieren einen statischen i18n-Resolver

---

## Migrationsstrategie

1. Neue Messages als fertige Strings (neue Validators zuerst)
2. Bestehende schrittweise migrieren — beide Formate im Panel kompatibel halten während Migration läuft
3. Panel-Cleanup wenn alle Validators migriert

---

## Aktueller Stand

Neue Messages in dieser Session bereits als fertige Strings:
- `chipBoundaryMissingDebugInterface` — `"Chip Boundary \"STM\" declares a jtag debug interface..."`
- `interfaceConnectorTypeInvalid` — `"Interface \"IF-1\": connector type..."`

Diese können als Template für die Migration dienen.
