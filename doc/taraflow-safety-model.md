# TARAflow Safety Model — Why, How, Where

Reference document for the safety side of TARAflow: how harm to persons is modeled,
rated and carried into the security analysis, **why** it was decided that way, and
**where** it lives in the code.

The detailed relationship rules (which edge is allowed between which asset categories)
remain in `taraflow-asset-relations.md` and `taraflow-asset-to-asset-relations.md`
(German versions: `taraflow-asset-beziehungen.md`, `taraflow-asset-zu-asset-beziehungen.md`).
If they disagree, this document governs the safety rating, the asset documents govern
the graph structure.

State: schema v9.

---

## 1. Scope

TARAflow models the **cyber trigger** of a hazard (`Threat → Impact`) and carries its
severity into prioritization. TARAflow is **not** a safety analysis:

| Question | Owner |
|---|---|
| Which cyber threat triggers it? Which impact on which asset? | TARAflow |
| How severe is the harm to persons in the worst case? | TARAflow (taken over or estimated) |
| Is anyone in the danger zone? How often? Avoidable? | Safety analysis (ISO 12100 / FMEA) |
| PL / SIL | Safety analysis (ISO 13849 / IEC 62061) |

**Worst-case assumption:** if a threat produces an impact on a safety-relevant asset,
the hazardous situation is taken as given. Exposure is not rated.

*Why:* exposure and avoidability are properties of the machine and its operation, not
of the attack. They belong in the accompanying safety analysis; TARAflow references it
(`externalRef` on the Hazard Item, `externalRefs` on Function Assets).

---

## 2. Overview: where a safety rating comes from

```txt
                         ┌──────────────────────────────┐
 Safety Annotation ─────►│                              │
 (on an element→asset    │  resolveAssetPhysicalImpact  │──► asset.physicalImpact
  relation)              │   manual, else worst-of      │      │
 Hazard Item ───────────►│                              │      ├─► aggregatedImpact (override rule)
 (contributes_to /       └──────────────────────────────┘      ├─► risk factor "Safety" (Se1–Se4)
  endangers)                         ▲                         └─► EN 50742 severity
 Manual override ────────────────────┘
 (asset dialog, with rationale)
```

Three sources rate an **asset**. Separately, **element properties** in the DFD (e.g.
`safetyRelevant` on an interface) drive threat generation (section 8).

---

## 3. The harm scale

One scale everywhere — annotation, `endangers` edge (human target), `physicalImpact` on
the asset, safety rating in the asset dialog:

| Level | Meaning (example) | IEC 62061 | ISO 26262 | EN 50742 | Factor |
|---|---|---|---|---|---|
| `reversible_minor` | reversible, first aid | Se1 | S1 | reversible | 1 |
| `reversible_major` | reversible, medical treatment | Se2 | S1 | reversible | 2 |
| `irreversible_minor` | irreversible, minor (finger) | Se3 | S2 | non_reversible | 3 |
| `irreversible_major` | irreversible, major (arm, eye) | Se4 | S2 | non_reversible | 4 |
| `fatal` | fatal | Se4 | S3 | fatal | 4 |

The categorical level is the source of truth. The factor (1–4) is derived; it is stored
as `impactRatings[safety].value` and used in the risk calculation.

**Why five levels:**
- There used to be three vocabularies side by side (annotation, hazard edge, asset
  dialog) with different granularity. One scale prevents translation errors between
  annotation, Hazard Item and risk.
- *Irreversible* is commonly split into minor/major in practice (IEC 62061 Se3/Se4).
  A lost finger and a lost eye are not equally severe.
- *Fatal* stays **separate** from `irreversible_major` although both map to Se4:
  ISO 26262 distinguishes S2 and S3 exactly there. With a shared level, ISO 21434 mode
  could not be mapped without loss.

**Why `fatal`, not `fatality`:** same word class as `reversible`/`irreversible`
(adjective: the kind of harm, not an event).

---

## 4. Two modeling paths: annotation and Hazard Item

| | Safety Annotation | Hazard Item |
|---|---|---|
| Location | `safety` on an element→asset relation | own node with `contributes_to` / `endangers` |
| Causes | one relation = one single cause | any number, combined explicitly |
| Combination | **ANY** only (maximum over relations) | `combinationType` **ANY** or **ALL** |
| Protection target | implicit (the related asset) | explicit (Human / Environment / Infrastructure) |
| Typical use | quick start, simple single causes | combinatorics, several targets, import from FMEA / hazard register |

**Why both paths:** the annotation is the quick start — anyone who only wants to record
"this actuator can kill the operator" needs no hazard register. The Hazard Item is
needed as soon as causes interact (sodium **and** water) or a hazard hits several
protection targets. Forcing either into one path would make it too heavy for a quick
start or too weak for combinatorics.

**Annotation = single cause, ANY.** Every annotated relation acts as if it triggered the
harm on its own. An ALL hazard cannot be expressed with annotations; two annotations
overestimate each single cause (conservative, but imprecise).

**No collapsed hazard node.** A direct element→human edge with an annotation does **not**
create an internal Hazard Item. Earlier document versions claimed this; it was never
implemented.

*Why not build the collapsed node:* an internal Hazard Item would need a protection
target and a stable id that survives expansion — effort without analytical gain, as long
as the worst-of rule (section 5) combines both paths correctly.

---

## 5. Rating an asset: manual, else worst-of

`resolveAssetPhysicalImpact` (`src/app/utils/resolve-asset-physical-impact.ts`):

1. **manual** — the override in the asset dialog, with rationale, always wins.
2. Otherwise the **worse** of
   - `hazard`: worst severity of the Hazard Items the asset `contributes_to` (cause side),
   - `annotation`: worst safety annotation on the asset's DFD relations.
3. Tie → `hazard` (richer audit trail). If either source is `direct`, the impact counts
   as direct.

A **pure protection target** (only `endangers`, no `contributes_to`) is **not** rated by
the Hazard Item: a person is a consequence, not an attack surface.

**Double modeling raises a warning.** If an asset has an annotation **and** takes part
in a Hazard Item (as cause or protection target), asset validation reports
`safetyDoubleModelling`. The asset table tooltip shows the conflict.

**Why worst-of instead of a warning alone:** a warning can be ignored; the tool still
has to compute a value. Before, `hazard > annotation` applied — a Hazard Item rated
*reversible* hid an annotation rated *fatal* on the same asset. Worst-of ensures that
ignoring the warning never under-rates safety.

**Why manual still wins:** the override is a deliberate, justified decision of the
analyst (IEC 62443-4-1: rationale required). If worst-of overruled it too, a justified
downgrade would be impossible. The rationale requirement carries the risk of
under-rating.

**Why the warning is per asset, not per project:** a project can sensibly use both paths
(Hazard Item for the AND case at the valves, annotation on an actuator). Only rating the
*same* asset twice is double.

---

## 6. Safety Override Rule

`deriveAggregatedImpact` (`src/features/assets/services/asset-physical-impact-deriver.ts`):

| Severity | `direct` | `indirect` |
|---|---|---|
| `irreversible_major` / `fatal` | **CRITICAL** (override) | HIGH+ |
| `irreversible_minor` | HIGH+ | HIGH |
| `reversible_minor` / `reversible_major` | HIGH | MED+ |
| none | business impact | business impact |

`isSafetyCritical(annotation)` = `direct` **and** `irreversible_major | fatal`.

**Why severity *and* directness:** `direct` alone only means the asset immediately
controls the hazardous action — with a reversible outcome that does not justify
CRITICAL. Conversely, an `indirect` asset (switch, engineering workstation) influences a
fatal hazard only systemically; HIGH+ instead of CRITICAL expresses that damping.

**Why only from `irreversible_major`:** with *irreversible* split, a minor irreversible
injury should not trigger the same escalation as a major or fatal one.
`irreversible_minor` + direct stays at HIGH+, clearly above any business-only impact
below CRITICAL.

`relevance` is **functional**, not topological (test question: "Does exactly this asset
immediately control the physical action that causes the harm?"). Distance in the graph
is carried by `hazardDistance` on the `contributes_to` edge.

---

## 7. An asset's safety relevance is derived

An asset has **no** safety fields of its own any more (since schema v9
`safetyRelevant`, `containsSafetyRelevantData`, `safetyImpact`, `safetyRationale` are
gone from `AssetProperties`). An asset is safety-relevant exactly when it has a
`physicalImpact` rating or takes part in a Hazard Item.

**Why:** the fields were only displayed and documented, never computed. `safetyImpact`
was even a fourth severity source next to `physicalImpact` that could drift from the
others.

**Why the DFD element level stays:** on interfaces, sensors, actuators, multiprocesses
and boundaries, `safetyRelevant` is an **input**: it drives threat generation
(`stride-modifier.ts`, T+D escalation), has registry defaults (e.g. safety-bus
interface), and the validator reports it as "not assessed". Derived, elements without
an asset link would lose their safety escalation, and the generated threats of existing
projects would change. See open points.

---

## 8. Where safety acts in the rest of the analysis

| Effect | Input | Code |
|---|---|---|
| Asset criticality (`aggregatedImpact`) | `physicalImpact` + directness | `deriveAggregatedImpact` |
| Risk factor "Safety" | worst `physicalImpact` of the linked assets → factor 1–4 | `deriveSafetyValue`, `risk-calculation-service.ts` |
| Auto-enable the safety factor | safety data present in the project | `hasSafetyData`, `risk-sync-service.ts` |
| EN 50742 severity (SRSL) | worst `physicalImpact` → reversible / non_reversible / fatal | `resolveEN50742Severity`, `en50742-risk-calculation.ts` |
| Threat generation (T+D escalation) | **element** properties (`safetyRelevant`, `containsSafetyRelevantData`, `systemClass`) | `stride-modifier.ts` |
| Prioritization / display | `isIrreversibleOrWorse`, `isOverrideSeverity` | threat and risk tables |

---

## 9. Migration

| Schema | Change | Why |
|---|---|---|
| v9 | Old severity values to the 5-level scale: `reversible_injury` / `reversible_moderate` → `reversible_major`, `irreversible_injury` → `irreversible_major`, `fatality` → `fatal`; safety rating 3 → 4 | **Conservative:** an undifferentiated level goes to the upper sub-level. An old "irreversible injury" may have been major; downgrading without review would be unsafe. |
| v9 | Asset safety fields removed (after the severity step). A `safetyImpact` on an asset **without** `physicalImpact` becomes a manual override with a `[MIGRATED]` rationale; otherwise dropped | No rating is lost. The override cannot hide a worse rating, because without `physicalImpact` there was no other source. |

(Both run in the schema 9 step, together with the leveled-DFD version fence: `normalize-safety-severity.ts`, then `derive-asset-safety.ts`, called from `migrate-8-to-9.ts`.)

---

## 10. Where in the code

| Topic | File |
|---|---|
| Scale, helpers (`safetyImpactRank`, `worstSafetySeverity`, `isOverrideSeverity`, `safetySeverityToFactor`, `normalizeLegacySafetyImpact`), `SafetyAnnotation`, `isSafetyCritical` | `src/shared/models/safety-types.ts` |
| Hazard Item, `contributes_to` / `endangers` | `src/shared/models/hazard-types.ts` |
| Severity per protection target (`HazardImpact`) | `src/shared/models/hazard-impact.ts` |
| Hazard projection per asset (`causeSeverity`, `causeDirect`) | `src/app/utils/build-asset-hazard-links.ts` |
| Manual / worst-of | `src/app/utils/resolve-asset-physical-impact.ts` |
| Write hazard rating onto assets | `src/app/utils/commit-hazard-safety.ts` |
| Annotation → `physicalImpact`, directness, override matrix, double modeling | `src/features/assets/services/asset-physical-impact-deriver.ts` |
| Warning `safetyDoubleModelling` | `src/features/assets/services/asset-validator.ts` |
| Scale in the asset dialog | `src/features/assets/models/asset-impact-types.ts`, `src/features/assets/components/safety-severity-select.tsx` |
| Editing annotations (DFD) | `src/features/dfd/components/forms/asset-relation-selector.tsx` |
| FMEA import → scale | `src/features/hazards/services/hazard-bridge.ts` |
| Risk / EN 50742 | `src/features/risks/services/risk-calculation-service.ts`, `en50742-risk-calculation.ts` |
| Threat escalation (element level) | `src/features/threats/utils/stride-modifier.ts` |
| Migrations | `src/app/services/versions/migrate-8-to-9.ts` → `normalize-safety-severity.ts`, `derive-asset-safety.ts` |
| Labels | i18n `common`: `safetySeverity.*` |

---

## 11. Open points

1. **Strict separation per asset.** As soon as an asset `contributes_to` a Hazard Item,
   its annotations become read-only; action "Convert to Hazard Item" (one
   `contributes_to` per annotation, `relevance` taken over, `combinationType: ANY`,
   protection target chosen by the analyst). Would replace warning + worst-of. Not built
   because of the UI effort.
2. **`safetyRelevant` on the element level.** Stays an input; open whether to make it
   "derived OR explicit, with a hint when it contradicts the annotations".
3. **`physicalHazardPotential` exists twice** — on the annotation and on the Hazard
   Item. Long term only on the Hazard Item.
4. **Scale labels per mode.** One internal scale; ISO 21434 mode shows S1–S3, machinery
   / EN 50742 mode ISO 12100. Belongs to the ISO 21434 conformance plan.
