# Feature: STRIDE-Filtered Impact Prefill

**Status:** Design — ready for implementation
**Effort:** High (touches risk-calculation-service, risk-sync-service, threat model, possibly risk-dialog)
**Recommended model:** Opus for design + implementation

---

## 1. Problem Statement

The current `applyAssetCriteriaToFactorRatings` transfers **all** asset impact ratings blindly onto **every** threat that links to an asset. This is methodically wrong: a single threat almost never violates all protection goals of an asset.

### Concrete failure (Rauchmelder reference case)

Asset `smoke meas data` has:

```
financial_damage = 3
operational      = 4
regulatory       = 4
recoverability   = 1
safety           = 4
```

Today, **every** threat on this asset inherits all five values — including a pure Eavesdropping threat that only violates Confidentiality. The result: reading smoke sensor data gets classified as `safety = 4`, which is indefensible in an audit.

### Desired behaviour

| Threat | STRIDE | Violated goal | Prefilled criteria | safety prefilled? |
|---|---|---|---|---|
| Eavesdropping | I (Info Disclosure) | C (Confidentiality) | regulatory, financial, reputation | **No** |
| Data Tampering | T (Tampering) | I (Integrity) | safety, operational, financial, regulatory | **Yes** |
| DoS | D (Denial of Service) | A (Availability) | operational, recoverability | No |

Asset impact becomes a **baseline / upper bound**, filtered down per threat by which protection goal it actually violates — exactly what a reviewer expects (IEC 62443 / ISO 21434).

---

## 2. Methodical Background

Source: methodical discussion (ChatGPT review), confirmed against IEC 62443 practice.

Two separate insights came out of that review:

1. **Asset impact must not be inherited 1:1 by every threat.** It is a starting point, validated per threat scenario by the affected CIANAAA dimension. → This feature.
2. **Mitigation reduces Likelihood, rarely Impact.** AES-GCM/HMAC against an Integrity threat lowers the *likelihood* of successful tampering, but if tampering still succeeds the damage is identical. → **Out of scope** (decision below).

### Decision on Risk-after-Mitigation (Frage 2)

Risk-after-mitigation stays **fully manual**. We do NOT auto-suppress impact factors on the mitigated side. A future "mitigation reduces likelihood by X%" feature is a separate, larger topic (where do the percentages come from? are they auditable?) and must not be mixed in here. `copyRatingsToMitigated` in `risk-service.ts` stays as-is.

---

## 3. Data Availability — Confirmed

All required data exists in the asset model. No data-model migration needed.

### Step 1 — Threat → violated protection goal

The threat carries `strideCategory` (S/T/R/I/D/E). Map STRIDE → SecurityGoalType.

**Complication:** the existing `CIANAAA_TO_STRIDE` map (in `asset-security-goals-types.ts`) is `SecurityGoal → STRIDE` and is **not bijective** — `R` (Repudiation) maps from both `N` and `Acc`. We need the **reverse**, one-to-many:

```ts
// NEW — to add to asset-security-goals-types.ts
export const STRIDE_TO_CIANAAA: Record<string, SecurityGoalType[]> = {
  S: ["AuthN"],      // Spoofing
  T: ["I"],          // Tampering
  R: ["N", "Acc"],   // Repudiation → both
  I: ["C"],          // Information Disclosure
  D: ["A"],          // Denial of Service
  E: ["AuthZ"],      // Elevation of Privilege
};
```

### Step 2 — Protection goal → asset's CIANAAA relevance

`Asset.securityGoals[]` carries `{ type, level }` per dimension, `level ∈ none|low|medium|high|critical`.

This is the **per-asset CIANAAA rating** (not just the aggregate) — the critical prerequisite. It exists. ✅

### Step 3 — Protection goal → relevant business criteria

Use the existing `CAUSE_MECHANISM_TO_GOAL` (reversed) + `CAUSE_MECHANISM_CRITERIA`:

```
C (content_disclosure)   → [regulatory_compliance, financial_damage, reputation]
I (content_manipulation) → [safety, operational, financial_damage, regulatory_compliance]
A (unavailability)       → [operational, recoverability]
AuthN (identity_abuse)   → [safety, operational, regulatory_compliance]
AuthZ (unauthorized_access) → [safety, operational, regulatory_compliance, financial_damage]
N (missing_evidence)     → [regulatory_compliance]
Acc (missing_accountability) → [regulatory_compliance, operational]
```

### Step 4 — Values

`Asset.impactRatings[]` with `{ criterionId, value }`. Already consumed by the current prefill.

---

## 4. Design Decision: Filter vs Multiplier

Two ways the goal-level can influence the result:

**Variant A — Criteria filter (RECOMMENDED).** The set of prefilled criteria is restricted to those relevant for the violated goal (`CAUSE_MECHANISM_CRITERIA`). The goal-level acts as an additional cap/damping. Precise, uses the existing data structure as intended.

**Variant B — Global multiplier.** `prefilled = asset_value × (goalLevel / maxLevel)`. The `× max(CIANAAA)/5` formula. Simpler but coarser — it scales `safety` the same as `financial`, even when safety is simply not affected by the threat.

→ **Choose Variant A.** It is the one that produces "Eavesdropping gets no safety value" correctly, and it is workshop-explainable: *"A threat only inherits the impact factors of the protection goals it actually violates."*

### How the goal-level damps (Variant A detail)

For each criterion relevant to the violated goal:

- `level = critical|high` → take full asset criterion value
- `level = medium` → cap prefilled value at `medium` (scale-dependent: e.g. 2 on 4-level)
- `level = low` → cap at `low` (e.g. 1), or skip prefill entirely (decide during impl)
- `level = none` → **see fallback rule below**

The exact cap mapping per scale (3/4/5-level) must be defined during implementation. Keep it as a small lookup table, not inline magic numbers.

---

## 5. Fallback Rule — `level === "none"`

`Asset.securityGoals` is largely derived from the DFD graph (`source: "suggested"`). A goal may be `level: "none"` simply because the DFD lacked the annotation — not because it is truly irrelevant. A naive filter would then over-damp.

**Rule:** if the violated goal's `level === "none"` (not rated):

- Fall back to **full asset impact** (conservative — matches current behaviour), AND
- Emit an analyst-visible warning: *"Protection goal {{goal}} not rated on asset {{asset}} — impact inherited conservatively. Review in Asset Tab."*

This is auditable and prevents silent under-rating. Option (b) — warn + conservative — over option (a) — silent full inherit.

---

## 6. Affected Code

### `asset-security-goals-types.ts`
- ADD `STRIDE_TO_CIANAAA` reverse map (Section 3, Step 1).
- (Optional) ADD a `GOAL_TO_CAUSE_MECHANISM` reverse of `CAUSE_MECHANISM_TO_GOAL` for cleaner Step 3 lookup, or derive inline.

### `risk-calculation-service.ts` — `applyAssetCriteriaToFactorRatings`
Main change. Extend signature:

```ts
applyAssetCriteriaToFactorRatings(
  ratings: FactorRating[],
  linkedAssets: AssetReference[],
  assetDataRef: AssetDataReference,
  configuration: RiskConfiguration,
  strideCategory: string,          // NEW — which STRIDE the threat is
  // securityGoals already reachable via linkedAssets if AssetReference carries them
): FactorRating[]
```

New internal logic:
1. `strideCategory` → `STRIDE_TO_CIANAAA` → affected goals `SecurityGoalType[]`.
2. For each affected goal: collect relevant criteria via `CAUSE_MECHANISM_CRITERIA`.
3. Union the criteria sets (a STRIDE letter may map to multiple goals, e.g. R→N,Acc).
4. For each criterion in the union: prefill from `getWorstCriterionValue`, damped by the goal `level` (Section 4). Criteria NOT in the union → leave at 0 (do not prefill).
5. Safety stays special-cased via `deriveSafetyValue` BUT only when `safety` is in the relevant-criteria union (i.e. only for I/AuthN/AuthZ threats). For a pure-C threat, safety is not in the union → not prefilled.
6. Apply fallback rule when affected goal `level === "none"`.

**Important:** keep the `source === "manual"` guard — never overwrite analyst entries.

### `AssetReference` (asset-reference-types.ts)
Confirm `securityGoals?: SecurityGoalReference[]` is populated by `memoizedAssetDataRef` in `workspace-layout.tsx`. It already exists in the type. Verify the `level` field is carried through (currently `{ type, level }`).

### `risk-sync-service.ts` — `syncRisksFromThreats`
Both call sites of `applyAssetCriteriaToFactorRatings` (kept-risks update + new-risks) must pass `threat.strideCategory`. The threat reference already carries it (used elsewhere as `risk.strideCategory`).

### `risk-dialog.tsx` (optional, later)
Consider showing WHY a factor was/wasn't prefilled (tooltip: "not prefilled — threat violates Confidentiality only"). Nice-to-have, not required for v1.

---

## 7. Test Cases (Rauchmelder)

Use the existing `Test_2_tara.json` reference. Asset `smoke meas data`:
`financial=3, operational=4, regulatory=4, recoverability=1, safety=4`.

Assume `securityGoals`: `C=low, I=high, A=high` (set these in the asset if not present).

| # | Threat | STRIDE | Expected prefill | Key assertion |
|---|---|---|---|---|
| 1 | Eavesdropping | I | regulatory + financial (damped by C=low) | safety = 0, operational = 0 |
| 2 | Data Tampering | T | safety=4, operational=4, financial=3, regulatory=4 | safety = 4 (full, I=high) |
| 3 | DoS | D | operational=4, recoverability=1 | safety = 0, financial = 0 |
| 4 | Threat on goal with level=none | any | full asset impact + warning | warning emitted |

---

## 8. Open Questions for Implementation Session

1. **Exact damping table** per scale (3/4/5-level) for low/medium caps — define explicitly.
2. **Low = skip or cap?** When goal level is `low`, do we prefill a capped value or skip the criterion entirely? (Lean: cap at 1, don't skip — keeps it visible.)
3. **Multiple linked assets** with differing goal levels for the same threat — worst-case across assets (consistent with `getWorstCriterionValue`)? Confirm.
4. **`reputation` criterion** — currently in `CAUSE_MECHANISM_CRITERIA` for C, but may not be in the project's `activeFactors`. The reconcile logic (already built) handles enabling, but verify interaction.

---

## 9. Out of Scope (explicit)

- Mitigation → Likelihood reduction percentages.
- Auto-suppression of impact factors on the mitigated side.
- Variant 3 (per-asset Business×Goal matrix) — too much data-entry overhead; revisit only if Variant A proves insufficient.

---

## 10. Files to Upload Into the Implementation Session

- `risk-calculation-service.ts`
- `risk-sync-service.ts` (current version with reconcile + auto-enable)
- `asset-security-goals-types.ts`
- `asset-reference-types.ts`
- `risk-factor-types.ts`
- `Test_2_tara.json` (reference case)
- This document
