# TARAflow – Schema Migration Strategy

## Motivation

Sobald Release 1 publiziert ist, existieren Projektdateien ausserhalb der Entwicklungskontrolle.
Jede neue Datenstruktur muss mit bestehenden Dateien kompatibel bleiben.
Ohne explizite Versionierung wird jede spätere Migration ein Ratespiel.

---

## Grundprinzip: Schema-Version im Projektmodell

```typescript
interface TaraflowProject {
  schemaVersion: number   // Pflichtfeld ab Release 1 – fehlendes Feld = Version 0
  // ... rest des Projekts
}
```

- **Version 0** = alle Projekte die vor Release 1 gespeichert wurden (kein `schemaVersion`-Feld)
- **Version 1** = Release 1 – erste offizielle Version
- Wird bei jeder breaking oder additive Schema-Änderung inkrementiert

---

## Migration beim Laden

```typescript
const CURRENT_SCHEMA_VERSION = 1

function migrateProject(raw: unknown): TaraflowProject {
  let data = raw as any

  // Fehlende Version = pre-release Projekt
  const version: number = data.schemaVersion ?? 0

  if (version === 0) data = migrate_0_to_1(data)
  // if (version === 1) data = migrate_1_to_2(data)
  // ...

  if (data.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    throw new Error(`Unsupported schema version: ${data.schemaVersion}`)
  }

  return data as TaraflowProject
}
```

> `migrateProject()` wird beim Öffnen jeder Projektdatei aufgerufen – vor jeder weiteren
> Verarbeitung. Das ist der einzige Ort wo Migrations-Logik leben darf.

---

## Migration 0 → 1 (Release 1)

Version 0 sind alle Projekte die ohne `schemaVersion`-Feld gespeichert wurden.
Die Migration befüllt fehlende Felder mit sinnvollen Defaults.

```typescript
function migrate_0_to_1(data: any): any {
  // RiskMitigationMapping: war noch nicht vorhanden
  if (!data.riskMitigationMappings) {
    data.riskMitigationMappings = []
  }

  // PlatformContext: war implizit in STM32-Feldern – Default: unknown
  for (const element of data.dfdElements ?? []) {
    if (!element.platformContext) {
      element.platformContext = {
        runtime:    'unknown',
        deployment: 'unknown',
      }
    }
  }

  // MitigationRejectionRecord: nur prüfen wenn status bereits 'rejected'
  for (const mitigation of data.mitigations ?? []) {
    if (mitigation.status === 'rejected' && !mitigation.rejectionRecord) {
      mitigation.rejectionRecord = {
        mitigationId:  mitigation.id,
        rejectedAt:    null,   // unbekannt – aus altem Projekt
        rejectedBy:    'unknown',
        reason:        '(migrated from pre-release project – reason unknown)',
        decisionType:  'risk_accepted',
      }
    }
  }

  data.schemaVersion = 1
  return data
}
```

> ⚠️ Migrierte `rejectionRecord`-Einträge sind als unvollständig markiert (`reason` enthält
> den Migrations-Hinweis). Der Analyst sollte diese nachträglich vervollständigen.
> Dafür kann im UI ein Hinweis angezeigt werden: „X Mitigations haben unvollständige
> Ablehnungsbegründungen."

---

## Migrations-Checkliste für zukünftige Schema-Änderungen

Vor jeder Schema-Änderung folgende Fragen beantworten:

- [ ] Ist die Änderung **additiv** (neues Feld) oder **breaking** (Feld umbenannt / entfernt / Typ geändert)?
- [ ] Was ist der **sinnvolle Default** für alte Projekte die das Feld nicht haben?
- [ ] Braucht der Nutzer einen **Hinweis im UI** dass ein migriertes Feld unvollständig ist?
- [ ] Wird `CURRENT_SCHEMA_VERSION` inkrementiert?
- [ ] Ist die neue `migrate_n_to_n+1()`-Funktion geschrieben und getestet?

---

## Versionierungsregeln

| Änderungstyp | Schema-Version inkrementieren? |
|-------------|-------------------------------|
| Neues optionales Feld mit Default | ✅ Ja |
| Neues Pflichtfeld | ✅ Ja |
| Feld umbenannt | ✅ Ja |
| Feld entfernt | ✅ Ja |
| Typ eines Felds geändert | ✅ Ja |
| Nur UI-Änderung, kein Datenmodell | ❌ Nein |
| Neue computed property (kein persistiertes Feld) | ❌ Nein |

---

## Geplante Schema-Änderungen (bekannt, noch nicht implementiert)

Diese Felder werden in zukünftigen Versionen eingeführt und benötigen je eine Migration:

| Feld | Ziel-Version | Default für alte Projekte |
|------|-------------|--------------------------|
| `riskMitigationMappings[]` | 1 | `[]` |
| `PlatformContext` pro Element | 1 | `{ runtime: 'unknown', deployment: 'unknown' }` |
| `MitigationRejectionRecord` | 1 | Leerer Record mit Migrations-Hinweis wenn `status === 'rejected'` |
| `RiskCoverage` (`state` + `governance`) | – | Computed – keine Migration nötig |

---

## Offene Fragen

- [ ] Wird die Projektdatei beim Öffnen **automatisch migriert und gespeichert**, oder erst beim nächsten manuellen Speichern?
- [ ] Soll eine **Backup-Kopie** der Originaldatei angelegt werden vor der Migration?
- [ ] UI-Hinweis bei migrierten Projekten: einmalige Meldung „Projekt wurde auf Schema v1 migriert" – gewünscht?
- [ ] Soll `migrateProject()` auch beim **Importieren** von Fremdprojekten aufgerufen werden (z.B. Kundenprojekte per E-Mail erhalten)?
