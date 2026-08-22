# Regulation likelihood scoring cores — ISO 21434 & ETSI TVRA (design)

## 1. Purpose & scope

Two new regulation presets — `iso-21434` and `etsi-tvra` — need their own
likelihood scoring. This document captures the architecture decision and the
factor/score tables for both, and defines two pure computation cores
(`iso21434-core.ts`, `etsi-tvra-core.ts`) mirroring the existing
`en50742-approach-a-core.ts`.

Out of scope here: the tab wiring, the preset catalog entries, and the
`calculateRiskValues` branch selection (tracked separately). This doc is the
normative model + the cores.

## 2. The key architectural decision — two scoring families

TARAflow now has **two fundamentally different likelihood scoring families**:

### 2a. Weighted-mean family — the `standard` factors (orig. OWASP)
Each factor is rated on a **uniform 1..N scale** (`LIKELIHOOD_SCALES`) and
combined by a **weighted mean** using a per-factor `weight` multiplier
(`ActiveFactor.weight`). This is the default TARAflow method.

### 2b. Score-table family — EN 50742 A, ISO 21434, ETSI TVRA
Each factor has a **fixed, enumerated set of levels with non-linear point
values**. The values are **summed** (or combined per a norm formula) and the
result is mapped to a band via a **lookup table**. There is *no* uniform scale
and *no* weight multiplier — the "weighting" *is* the per-level point table.

ISO 21434 (attack-potential approach, Annex G.2) and ETSI TVRA (TS 102 165-1)
both derive from **ISO/IEC 18045 / Common Criteria B.4** ("weighted summation
method"). EN 50742 Approach A is the same family with a different formula
(`AP = (EL × WoO) + AC`).

**Consequence:** `iso-21434` and `etsi-tvra` are *not* "factors with weights"
on the uniform scale. Each is a distinct likelihood method with its own
per-level score tables + aggregation + band lookup — one core each, structured
like `en50742-approach-a-core.ts`. The preset therefore selects a **scoring
method**, not merely a set of factor ids.

## 3. Two independent tag-effect axes (recap)

- **Likelihood method (preset):** `standard` (default), `iso-21434`,
  `en-50742-a`, `etsi-tvra`. Tag → `regulationPresetFromTags`.
- **Hazard tab activation (`safetyRelevant`):** EN 50742 (A/B), IEC 81001,
  IEC TR 60601, IEC 63452, CLC/TS 50701. Tag → `requiresHazardAnalysis`.

Independent: e.g. IEC 81001 activates the hazard tab while the method stays
`standard`.

## 4. ISO 21434 core (attack-potential-based, Annex G.2)

Five factors (ISO/SAE 21434:2021 Table G.6 — an adaptation of ISO/IEC 18045).
Per-level point values (verbatim from the standard):

| Factor | Levels → points |
|---|---|
| Elapsed Time (`et`) | ≤1 day = 0, ≤1 week = 1, ≤1 month = 4, ≤6 months = 17, >6 months = 19 |
| Specialist Expertise (`se`) | Layman = 0, Proficient = 3, Expert = 6, Multiple experts = 8 |
| Knowledge of item (`koic`) | Public = 0, Restricted = 3, Confidential = 7, Strictly confidential = 11 |
| Window of Opportunity (`woo`) | Unlimited = 0, Easy = 1, Moderate = 4, Difficult = 10 |
| Equipment (`eq`) | Standard = 0, Specialized = 4, Bespoke = 7, Multiple bespoke = 9 |

**Attack potential** = et + se + koic + woo + eq (plain sum).

**Attack feasibility** (Table G.7), 4 levels:

| AP sum | Feasibility |
|---|---|
| 0–9 | High |
| 10–13 | Medium |
| 14–19 | Low |
| ≥20 | Very Low |

Higher AP ⇒ lower feasibility ⇒ lower likelihood. The feasibility level maps to
the project likelihood scale (High→highest likelihood … Very Low→lowest).

## 5. ETSI TVRA core (TS 102 165-1, weighted summation CC B.4)

Six factors. The five CC/18045 factors share the same basis as ISO 21434
(§4); TVRA adds a sixth ETSI-specific **Intensity** factor. Point values for
the five shared factors follow Common Criteria B.4 / ISO/IEC 18045 (same source
ISO 21434 adapts). **Intensity** values are verbatim from TS 102 165-1 Table 3.

| Factor | Levels → points |
|---|---|
| Time (`time`) | ≤1 day = 0, ≤1 week = 1, ≤1 month = 4, ≤6 months = 17, >6 months = 19 |
| Expertise (`expertise`) | Layman = 0, Proficient = 3, Expert = 6, Multiple experts = 8 |
| Knowledge (`knowledge`) | Public = 0, Restricted = 3, Sensitive = 7, Critical = 11 |
| Opportunity (`opportunity`) | Unnecessary/Unlimited = 0, Easy = 1, Moderate = 4, Difficult = 10 |
| Equipment (`equipment`) | Standard = 0, Specialized = 4, Bespoke = 7, Multiple bespoke = 9 |
| **Intensity** (`intensity`) | Single instance = 0, Moderate (multiple) = 1, Heavy (multiple) = 2 |

**Attack potential** = sum of all six factor values.

**Attack potential level** (CC B.4 / ISO 18045 resistance mapping):

| AP sum | Level |
|---|---|
| 0–9 | Basic |
| 10–13 | Enhanced-Basic |
| 14–19 | Moderate |
| 20–24 | High |
| ≥25 | Beyond High |

Higher AP required ⇒ lower occurrence likelihood. The AP level maps to the
project likelihood scale (Basic→highest likelihood … Beyond-High→lowest).

> **VERIFY:** the ETSI OCR source was corrupted for the numeric columns. The
> five shared-factor values above use the CC B.4 / ISO 18045 basis (identical to
> ISO 21434 G.6, which is clean); Intensity (0/1/2) is verbatim. Confirm the
> exact ETSI time-bucket granularity and the AP-level→likelihood mapping against
> a clean copy of TS 102 165-1 (Tables B.3/B.4) before shipping. All values are
> centralized as constants in `etsi-tvra-core.ts` for a one-line adjustment.

TVRA also defines a threat-agent layer (Motivation × Capability → threat level,
Tables 4–6). That is a *separate* dimension from the feasibility sum and is
**not** part of this core; it can be added later as an optional TVRA-only input.

## 6. Integration

- New factor sources: `ISO21434` (5 factors) and the existing `ETSI` source
  extended with the Intensity factor (6 total). Factor definitions carry the
  per-level value tables (or the cores own them; see the core files).
- `RegulationPreset` selects the **scoring method**. `calculateRiskValues`
  already branches for EN 50742 (`calculateAttackerPotential`); the two new
  cores plug in the same way, keyed by `settings.regulationPreset`.
- Switching *to* one of these methods clears the previous method's likelihood
  ratings (see the switch/confirmation design) — impact, threats, mitigations
  are preserved; only likelihood is re-rated under the new method.

## 7. Verification

Both cores are pure and unit-tested against worked sums:
- ISO: e.g. Layman+≤1week+Public+Easy+Standard = 0+1+0+1+0 = 2 → High;
  Expert+≤6months+Confidential+Difficult+Bespoke = 6+17+7+10+7 = 47 → Very Low.
- TVRA: e.g. all-lowest = 0 → Basic; Expert+≤6months+Critical+Difficult+
  Bespoke+Heavy = 6+17+11+10+7+2 = 53 → Beyond High.
