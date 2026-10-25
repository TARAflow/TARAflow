# Phase 6 — Security → Safety Independence Analysis (Design-Capture)

> **Status:** Konzept festgehalten, noch **nicht** eingeplant.
> Umsetzung erst nach Fertigstellung der Hazard-Tab-UI. Dieses Kapitel hält die
> Methodik fest, damit sie nicht verloren geht.

## 1. Kernidee

Die häufige Herstellerbehauptung *„Security kann unsere Safety nicht beeinflussen,
wir haben überall mechanischen/thermischen Schutz"* ist keine Systemeigenschaft,
sondern eine **pro Gefährdung zu beweisende Behauptung**.

Nicht beweisbar ist „kein Hazard durch Security". Beweisbar ist:

> Selbst bei **vollständiger Kompromittierung aller cyber-erreichbaren Knoten**
> im Hazard-Teilbaum hält eine **unabhängige Barriere** die Restschwere unter der
> Akzeptanzschwelle.

Entscheidend: der Nachweis ist **wahrscheinlichkeitsunabhängig**. Er beruht *nicht*
auf „es gibt keinen bekannten Angriffspfad" (das ist ein Security-Claim, der mit
dem nächsten Exploit zerfällt), sondern nimmt die Kompromittierung als gegeben an.
Ein Safety-Claim, der von Security-Wahrscheinlichkeit abhängt, ist keiner.

**Folge:** Der Attack Tree ist *nicht* die Basis des Safety-Nachweises (er ist nur so
vollständig wie die modellierten Angriffe). Das `CyberReachable`-Set kommt
**konservativ aus der DFD-Topologie** — alles, was von einer untrusted Boundary
erreichbar ist, gilt als kompromittiert. Der Attack Tree bleibt Security-Analyse
und Priorisierung, nicht Fundament der Safety-Aussage.

## 2. Formale Definitionen

```
HazardSubtree(H)      = alle Assets, die über contributes_to (transitiv) zu H beitragen
CyberReachable(H)     = Assets aus HazardSubtree(H) ∪ Umfeld, die von einer untrusted
                        Boundary im DFD erreichbar sind  → als kompromittiert angenommen
DependencyClosure(B)  = realizedByAssetIds(B) ∪ dependencyAssetIds(B)
                        ∪ (über DFD-Relationen abgeleitete Abhängigkeiten)   [transitiv]

Independent(B)        ⇔ DependencyClosure(B) ∩ CyberReachable(H) = ∅
Sufficient(B, target) ⇔ residualSeverity(B, target) ≤ acceptanceThreshold(targetKind)
```

Der berühmte Fehlfall (Safety-Relay hinter derselben PLC, „mechanisches" Ventil mit
software-gesetztem Sollwert) fällt hier automatisch durch: seine `DependencyClosure`
schneidet `CyberReachable(H)` → `Independent(B) = false`.

**Performance Level als Akzeptanzeinheit.** Für `human`-Ziele ist die natürliche
Einheit von `acceptanceThreshold(human)` nicht eine abstrakte Schwere, sondern der
**Required Performance Level `PLr` (EN ISO 13849-1)**. Damit wird `Sufficient(B, human)`
konkret: eine Barriere ist *ausreichend*, wenn ihre Restschwere den durch `PLr`
geforderten Risikoreduktionsgrad einhält. `PLr` ist eine **Eingabe der Schwelle**, kein
eigener Trigger — er fließt in `Sufficient(B, target)` ein, nicht in eine separate,
coverage-abhängige Regel. Das ist der entscheidende Unterschied zu einem naiven
„offene Threats → PL gefährdet"-Ansatz (siehe §3a): Letzterer macht den Safety-Claim
wieder von Security-Wahrscheinlichkeit abhängig und zerfällt mit dem nächsten Exploit.

## 3. Verdict — pro `endangers`-Ziel, nicht pro Hazard

Da die Severity auf der `endangers`-Kante liegt, hat ein Hazard mit mehreren Zielen
mehrere Claims:

```
H → Human          substantiated
H → Environment    substantiated
H → Infrastructure refuted
```

Verdict(H, target):
- **SUBSTANTIATED** — es existiert eine mitigierende Barriere B mit
  `Independent(B) ∧ Sufficient(B, target)`.
- **REFUTED** — ein cyber-erreichbarer Beitrag kann H bewaffnen und es gibt **keine**
  unabhängige, ausreichende Barriere für dieses Ziel. → Cyber-Kompromittierung kann
  zu inakzeptablem Schaden führen; Safety hängt real an Security.
- **UNCERTAIN** — die `DependencyClosure` einer relevanten Barriere ist unvollständig
  modelliert, die Disjunktheit also nicht entscheidbar. Dieser Zustand ist in der
  Praxis vermutlich der häufigste **und der wertvollste Audit-Befund**: nicht „unsicher",
  sondern „nie dokumentiert, wovon die Schutzfunktion abhängt".

## 3a. Performance Level & Common-Cause-Brücke (EN ISO 13849)

Dieser Abschnitt übersetzt das Independence-Modell in die Sprache des
Safety-Ingenieurs, ohne seine Epistemik aufzugeben. Er ist die **Erklärungsbrücke**,
nicht ein zweiter Mechanismus.

**Cyber als Common Cause Failure (CCF).** Eine zweikanalige Architektur (ISO-13849
Kategorie 3/4) hält ihren Performance Level nur, solange die Kanäle *unabhängig*
ausfallen. Eine Software- bzw. Netzwerk-Kompromittierung, die beide Kanäle gleichzeitig
täuscht (z. B. ein manipuliertes Netzwerksignal, eine kompromittierte gemeinsame SPS,
ein gefälschter Sensorwert), ist genau ein **Common Cause Failure** — sie kollabiert die
Redundanz auf effektiv Kategorie B. In ISO-13849-Begriffen sinkt der *erreichte* PL
unter den geforderten, obwohl die mechanische Architektur laut ISO 12100 perfekt ist.

**CCF ist ein Spezialfall von `Independent(B) = false`.** Genau dieser Fall fällt im
Modell ohne neue Logik durch: Wenn die Knoten, die die mehrkanalige Schutzfunktion
realisieren (`realizedByAssetIds(B)`), in `CyberReachable(H)` liegen, dann teilen die
Kanäle eine cyber-erreichbare gemeinsame Ursache → `DependencyClosure(B) ∩
CyberReachable(H) ≠ ∅` → `Independent(B) = false` → **REFUTED** für das betroffene
`endangers`-Ziel. Die Aussage ist damit **patch-stand-unabhängig**: Es ist egal, wie
viele Controls auf den Kanälen liegen — solange die gemeinsame Ursache cyber-erreichbar
bleibt, ist die Redundanz aushebelbar.

**Was das dem CE-Koordinator liefert.** Nicht die schwächere, coverage-abhängige Aussage
„deine offenen Threats gefährden PL d", sondern die härtere, wahrscheinlichkeits-
unabhängige: *„Die PL-d-Funktion hängt nachweisbar an cyber-erreichbaren Knoten — die
Redundanz ist common-cause-aushebelbar, unabhängig vom Patch-Stand."* Das ist die
Demonstration, die die Maschinenverordnung verlangt (Schutz der Sicherheitsfunktion
gegen Korruption *nachweisen*, nicht behaupten), und sie hält dem nächsten Exploit stand.

> **Abgrenzung zum naiven Ansatz.** Eine Validator-Regel der Form „`PLr ≥ d` UND
> beitragende Assets haben *ungelöste* STRIDE-Threats → warnen" ist bewusst **nicht**
> Teil dieses Modells. Sie koppelt den Safety-Claim an den Mitigationsstatus und damit
> an Security-Wahrscheinlichkeit — sie verschwindet, sobald man genug Controls draufschraubt,
> obwohl die Common-Cause-Abhängigkeit unverändert besteht. Der PL läuft daher durch
> `Independent`/`Sufficient`/`Verdict`, nicht durch eine coverage-getriggerte Sonderregel.

## 4. Gespeichert vs. berechnet

**Gespeichert (Eingaben):**
- `HazardBarrier` — was die Barriere ist und woran sie hängt.
- Akzeptanzschwellen pro Zieltyp (Projekt-Config).
- `requiredPL?` an der **`endangers`-Kante** (`shared/models/hazard-types.ts`) — der
  geforderte Performance Level für diese spezifische Gefährdung des Human-Ziels. Liegt
  bewusst an der Kante (nicht am HazardItem), weil PLr eine Eigenschaft der
  Gefährdung-eines-konkreten-Ziels ist, analog zur bereits dort liegenden `severity`.

**Berechnet (nie gespeichert):**
- `HazardSubtree`, `CyberReachable`, `DependencyClosure`, Schnittmengen, Verdict.

Grund: jede Graph-Änderung (DFD-Knoten, Relation, Hazard verschoben, neue
Netzwerkschnittstelle) macht ein gespeichertes Urteil potenziell falsch. Der Verdict
trägt stattdessen die **Audit-/Git-Revision**, gegen die er erzeugt wurde, und wird bei
Änderung neu berechnet.

```ts
// gespeichert
interface HazardBarrier {
  id: string;
  anchorHazardId: HazardItemId;
  role: "preventive" | "mitigative";
  barrierType: "mechanical" | "thermal" | "electrical" | "software" | "administrative";
  realizedByAssetIds: string[];   // Graph-Knoten, die die Barriere REALISIEREN
  dependencyAssetIds: string[];   // deklarierte Zusatz-Abhängigkeiten (Energie, Konfig, Sensor)
  // Wirkung — Eingabe, NICHT aus dem Graphen ableitbar:
  residualSeverityByTarget?: Partial<Record<HazardTargetKind, string>>;
  rationale?: string;
}

interface SafetyAcceptanceConfig {     // Projekt-Config
  human: HumanHarmSeverity;            // jeweils max. akzeptable Restschwere
  environment: EnvironmentHarmSeverity;
  infrastructure: InfrastructureDestructionSeverity;
  // PL-getriebene Schwelle für human-Ziele (EN ISO 13849-1). Ist requiredPL an der
  // endangers-Kante gesetzt, hat es Vorrang vor dem pauschalen human-Default:
  // Sufficient(B, human) prüft dann gegen die PLr-Reduktion, nicht gegen die Severity allein.
  humanRequiredPLDefault?: PerformanceLevel;   // 'a' | 'b' | 'c' | 'd' | 'e'
}

// berechnet, pro (Hazard, endangers-Ziel)
interface HazardAssuranceVerdict {
  hazardId: HazardItemId;
  targetAssetId: string;
  verdict: "substantiated" | "refuted" | "uncertain";
  cyberReachableCauseIds: string[];
  independentBarrierIds: string[];
  compromisedBarrierIds: string[];
  decisiveBarrierId?: string;          // die unabhängige + ausreichende Barriere (falls substantiated)
  residualSeverity?: string;
  justification: string[];
  evaluatedAgainstRevision: string;    // Audit/Git-Revision → invalidieren bei Änderung
}
```

## 5. Abgrenzung & Einordnung

- Es ist **kein Mitigation-Feature**, sondern ein eigenständiges **Analyse-Feature**
  (eigener Tab/Report). Barrieren sind die gespeicherte Eingabe; das Urteil ist eine
  abgeleitete Sicht.
- `DependencyClosure` = **deklariert ∪ aus dem Graphen abgeleitet**. Die deklarierten
  Abhängigkeiten reduzieren den manuellen Aufwand nicht auf null — aber unvollständige
  Deklaration ist genau der `UNCERTAIN`-Trigger und damit gewollt sichtbar.
- Der erzeugte Nachweis ist ein **Assurance-Case-Fragment** (Goal: „Kompromittierung
  erhöht die Schwere nicht über akzeptabel"; Strategy: unabhängige Barriere; Evidence:
  Erreichbarkeit + Disjunktheit + Restschwere) und damit in einen größeren Safety Case
  komponierbar.

## 6. Normbezug

- **LOPA / IPL** (IEC 61511): Unabhängigkeit, Wirksamkeit, Auditierbarkeit, Spezifität
  — hier um „nicht über den Cyber-Graphen kompromittierbar" erweitert.
- **IEC TR 63069** (Rahmen Functional Safety + Security), **IEC 62443-3-2**.
- **EN ISO 13849-1** (Performance Level / Kategorien / CCF): `requiredPL` als
  Akzeptanzeinheit; Cyber-Kompromittierung als Common Cause Failure, der mehrkanalige
  Kategorien (3/4) auf effektiv Kategorie B zurückwirft (§3a).
- **Maschinenverordnung (EU) 2023/1230**: Schutz der Sicherheitsfunktionen gegen
  Korruption ist *nachzuweisen*, nicht zu behaupten — der graphbasierte
  Independence-Nachweis ist genau dieses Demonstrationsmaterial.

## 7. Was zur Umsetzung real fehlt

Das Hazard-Modell trägt `contributes_to`, `hazardDistance`, Teilbäume und
`isPhysicalBarrier` schon. Offen:
1. `HazardBarrier` + `dependencyAssetIds` an echte Knoten binden (Modell).
2. `SafetyAcceptanceConfig` pro Zieltyp (Projekt-Config).
3. Konservative `CyberReachable`-Funktion über die DFD-Topologie (Definition der
   untrusted Boundary).
4. Abgeleiteter Independence-/Verdict-Service über dem bestehenden Graphen.
5. `PerformanceLevel`-Typ (`'a'…'e'`) + `requiredPL?` an der `endangers`-Kante
   (`shared/models/hazard-types.ts`); `humanRequiredPLDefault` in `SafetyAcceptanceConfig`.
6. `Sufficient(B, human)` um die PLr-Reduktion erweitern (Vorrang Kante > Projekt-Default).
7. CCF-Auswertung im Verdict-Service als Spezialfall von `Independent(B) = false` kenntlich
   machen (gemeinsame cyber-erreichbare Ursache mehrerer Kanäle → Begründungstext §3a).

Offene Knöpfe: Definition der untrusted Boundary; transitive Tiefe der
`DependencyClosure`; Akzeptanzschwellen-Defaults pro Zieltyp.
