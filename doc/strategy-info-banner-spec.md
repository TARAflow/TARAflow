# TARAflow — Strategy Info Banner (Phase 5 Addition)

## Kontext

Die Generator-Strategy läuft vollautomatisch — kein Config-Dialog nötig.
Der Benutzer-Workflow ist:

1. DFD erstellen
2. Asset Impact Bewertung mit Schutzzielen (CIANAAA)
3. Threats-Tab: "Generate Threats" drücken
4. → Strategy wird auto-erkannt, Threats werden generiert
5. → Info-Banner zeigt welche Strategy verwendet wurde

---

## Auto-Detection (bereits implementiert)

```typescript
// strategy-factory.ts
function detectStrategy(project: ThreatProjectData): StrategyType {
  const assetCoverage = computeAssetCoverage(project);
  const hasTags = hasAnyProjectTag(project.info?.tags);

  if (assetCoverage >= 1.0) return "RelationStrategy";
  if (assetCoverage > 0 || hasTags) return "HybridStrategy";
  return "ClassicStrategy";
}
```

---

## Info-Banner — UI Spec

**Platzierung:** Direkt unterhalb des Generate-Buttons, oberhalb der Threat-Tabelle.
Passiv — kein Modal, kein Dialog, keine Interaktion erforderlich.

### ClassicStrategy

```
ℹ️  Generated with ClassicStrategy
    No assets linked and no project tags set.
    Generic STRIDE templates applied to all elements.
```

### HybridStrategy

```
ℹ️  Generated with HybridStrategy
    11 / 15 elements have linked assets.
    STRIDE categories were modulated by element properties.
    Context-specific templates selected where applicable.
```

### RelationStrategy

```
ℹ️  Generated with RelationStrategy
    All 15 elements have linked assets with CIANAAA annotations.
    STRIDE categories derived from asset relation types.
```

---

## strategyOverride — kein UI vorerst

`ThreatConfiguration.strategyOverride?: StrategyType` ist im Code vorhanden
und bleibt dort. Kein UI-Selektor in Phase 5.

Falls später benötigt: kleines Dropdown direkt beim Generate-Button —
nicht als separater Dialog.

---

## Implementierung

**Neue Datei:** `src/features/threats/components/shared/strategy-info-banner.tsx`

```typescript
interface StrategyInfoBannerProps {
  strategyType: StrategyType;
  totalElements: number;
  elementsWithAssets: number;
}
```

**Integration in:** `threats-tab.tsx` — nach erfolgreichem Generate,
Banner-State wird mit dem Generation-Result gesetzt.

---

## Priorität

Phase 5 — zusammen mit Coverage-Indikator im Threat Dialog.
Kein Blocker für Coverage Inference selbst.
