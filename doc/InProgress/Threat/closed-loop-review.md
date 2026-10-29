# Closed loop — review and fixes

**Status:** v2 · 2026-10-29 · CL-1 … CL-4 done (§4) · branch `feature/iso21434-item-definition`,
release 0.16.0-beta
**Origin:** user 2026-10-27: notifications in SmokeDetector and Headlamp "although no
mitigation was implemented". Analysed with the user's own files
(`SmokeDetector-leveled.tara.json`, `Headlamp_ISO21434_Example.tara.json`) through the
real services (`deriveControlInstances`, `computeSecurityDrifts`).
**Related:** `custom-mitigation-catalog.md` (CM-1 … CM-4: self-defined threats reach the
closed loop).

---

## 1. How the DFD notification panel is fed

`dfd-notification-panel.tsx` `buildNotifications` shows three kinds:

| Kind | Source | Shown when |
|---|---|---|
| error / warning / info | DFD validation | validator findings |
| **security** | `ControlInstance` (SHOULD) from every risk's `selectedMitigations` × catalog `affectsProperties` | the DFD property does not equal the expected value |
| **drift / conflict** | `computeSecurityDrifts` (SHOULD vs IS vs WAS = `securityControlOwnership`) | status drift / conflict |

Every selected mitigation counts — whatever its status (only `rejected` is skipped).

## 2. Findings

**SmokeDetector** (199 risks, 314 selected mitigations: 269 open, 45 implemented):
62 SHOULD instances, 57 unmet.

1. **56 of the 57 unmet instances come from mitigations that are only planned**
   (status `open`). Only one comes from a mitigation marked implemented whose DFD
   property disagrees — the one real inconsistency.
2. **Duplicates:** 24 instances appear twice, as *security* and as *conflict*.
3. **Conflict by exact comparison.** IS ≠ SHOULD and IS non-empty, no WAS → conflict.
   The values involved:
   - semantically *empty*: `failSafeOutputState=not_defined` (6),
     `cryptoStandard=not_assessed` (2);
   - *weaker*: `integrityProtection=crc` (6), `authenticatorStorage=software_only` (2),
     `endpointAuthentication=symmetric_key` (1), `accessControlMechanism=process_enforced`
     (2);
   - *stronger or equivalent*: `integrityProtection=aead` (expected `hmac`);
   - *other wording*: `physicalMobility=fixed` (expected `stationary`),
     `encryptionInTransit=custom`, `operationalState=enabled`.
4. **`"none"` as expected value** (Interface `implementedControls.serviceAccessPolicy`)
   can never be "implemented": the derivation treats `"none"` as empty before comparing.
5. **Attack-path risks never yield a SHOULD.** The derivation looks a risk's threat up in
   the per-element / per-interaction tables only; attack-path risks (threat ids
   `AT-…`, every ISO project) are skipped.

6. **Catalog effects ignore the interface type.** The debug-interface mitigations
   (`M-E-006`, `M-IF-E-001/002`, `M-IF-DBG-001…003`, context `{}`) reach every
   Interface: WLAN 802.11 is asked for `debugProtection = fused_off` and
   `operationalState = hw_disabled` (switching WLAN off), RS-485 buses likewise. The
   applicability rule exists already (`isControlApplicable(interfaceType, controlKey)`,
   `interface-control-applicability.ts`) but the derivation does not use it.
7. **Catalog values the DFD does not know.** `physicalMobility = "stationary"`
   (`M-PB-T-005`, `M-PB-D-001`) — the property's options are `fixed | removable |
   portable | vehicle_mounted`, so the SHOULD can never be met; `integrityProtection =
   true` (`M-S-004`) on an enum property.

8. **Interface controls were read and applied flat.** The catalog names them
   `implementedControls.<key>`; derivation, drift, coverage and panel read
   `properties["implementedControls.<key>"]` instead of the nested value, so an
   Interface control was never met.
9. **Apply changed nothing visible.** The panel's Apply spread the update onto the
   element itself (`{ ...el, ...updates }`), not into `properties` — where the forms,
   the generator and the closed loop read it — and wrote the WAS record there too, so a
   later revert could never show as drift. Untested until CL-1.

The user's notification list (2026-10-29) matches findings 1–3, 6 and 7 one to one: 57
*security* rows, 24 of them again as *Conflict*.

**Headlamp** (10 attack-path risks): **no notification** (confirmed by the user) — no
selected mitigation, and even with selections finding 5 would suppress every SHOULD. Here
the problem is the opposite: the closed loop does not work at all for ISO projects.

## 3. Decisions (user 2026-10-29)

1. **Planned mitigations are information, not warnings.** `open` / `in_progress` →
   kind *planned* ("planned, not yet in the DFD", with Apply), shown under the *Info* and
   *Security* filters, not under *All*. A mitigation marked `in_review` / `implemented` /
   `verified` [D: in_review counts as done] whose property the DFD does not show → a
   warning (*inconsistent*). Drift (applied, then reverted) stays a warning for every
   status — someone applied it.
2. **Value semantics: empty values and a strength table.** `not_*` values (and the
   existing empty set) count as **empty** → *missing*, never *conflict*. Per property,
   where the order is unambiguous, a **satisfies** table: a stronger value meets a weaker
   expectation (e.g. `aead` and `signature` satisfy `hmac`; `hmac` does not satisfy
   `signature`). Otherwise exact comparison. One shared module for derivation, drift,
   coverage and the panel (today each has its own `isEmptyValue`).
3. **Attack-path risks join the closed loop through the tree's anchor.** Asset anchor →
   the asset's `linkedDFDElements` (elements and flows); threat anchor → the threat's
   element / flow; risk anchor → the risk's threat. An effect applies to the anchored
   elements of its target type (flows: role *channel*; *source* / *target* → the flow's
   endpoints). Always `heuristic`.

Without a question (bugs): one notification per instance (a *conflict* / *drift* row
replaces the *security* row, finding 2); an expected value equal to the current value is
met even if it is an "empty" word like `"none"` (finding 4); an effect on an Interface
applies only where its control is applicable to the interface type — a mitigation whose
`implementedControls` key is not applicable skips that interface altogether, its other
effects included [D] (finding 6); catalog values are corrected — `stationary` → `fixed`,
`M-S-004` `true` → `signature` — and a test checks every catalog expected value against
the DFD option lists (finding 7).

## 4. Steps

| Step | Content | Patch | Status |
|---|---|---|---|
| CL-1 | Shared value semantics (`shared/utils/control-value-semantics.ts`): empty set (`none`, `no`, `unknown`, `not_*`, `false`, …), `CONTROL_VALUE_MEETS` (values meeting an expected one), `controlValueState` met / empty / other with equality first; nested read / write for `implementedControls.*`; used by derivation, drift, coverage and panel. Apply writes into `properties`, nested (`apply-control-suggestion.ts`, findings 8, 9). Option register typed against the DFD types (`features/dfd/models/control-property-options.ts`) and a catalog test: every effect a DFD property and an option. Catalog corrected (15 effects) [D]: `M-S-004` `true` → `signature`; `M-T-FSAFE-001` `defined` → `fixed_value` (met also by `unpowered`, `hold_last_value`); `M-IF-POLICY-002` `none` → `maintenance_only`; `M-PB-D-001` `stationary` → `fixed`; `M-CB-I-002` `keyStorage` → `authenticatorStorage`; effects removed where the DFD has no such property or the effect did not fit — `M-R-006` auditLogging, `M-I-009` secureDeletion, `M-D-007` DataFlow connectorType, `M-D-009` islandModeCapable, `M-CB-SCA-001…004` sideChannelProtection, `M-CB-SCA-004` conformal_coating on a DataFlow, `M-PB-T-005` (portable devices) physicalMobility. SmokeDetector: 62 → 56 SHOULD, 57 → 48 unmet, 24 → 12 conflicts (the rest: weaker values). | 194 | done |
| CL-1b | Interface applicability in the derivation and the coverage: `mitigationFitsInterface` (`shared/utils/control-applicability.ts`) — a mitigation whose Interface control does not fit the interface type skips that interface, all its Interface effects [D]. The rule is the forms' one: the two group-based keys (`serviceAccessPolicy`, `monitoringControl`) moved into the shared registry as `hasServiceLayer` (test: same result as the former group rule for every type), `isInterfaceControlKeyApplicable` for string keys (no type yet / unknown key → applicable). SmokeDetector: WLAN loses its debug SHOULDs; 54 SHOULD, 46 unmet, 11 conflicts. | 195 | done |
| CL-2 | Status-aware notifications: `ControlInstance.planned` (every mitigation behind it `open` / `in_progress`; `DONE_MITIGATION_STATUSES` = in_review, implemented, verified). The panel shows one row per unmet SHOULD: *drift* (applied, then reverted — warning, any status), *planned* (information: under the Notes / planned chip and the Apply filter, not under All), *conflict* (done, another value — error), *security* (done, missing — warning); planned, conflict and security keep Apply. SmokeDetector: under All 1 notification instead of 81 — DF-10 `encryptionInTransit = custom`, expected `tls`, mitigation marked implemented (the one real inconsistency); 45 planned. | 196 | done |
| CL-3 | Attack-path risks via the anchor: only asset-anchored trees emit attack-path threats (ISO 3.1.33), so threat id `AT-<treeId>-…` → tree → anchor asset → `linkedDFDElements` (`app/utils/attack-path-control-targets.ts`). An element is offered as the threat's element; a flow both as a flow element (role-less and channel effects) and as the flow with its endpoints (source / target effects); the derivation de-duplicates. Everything reached this way is heuristic. The derivation no longer needs STRIDE threats at all. Headlamp with all proposed mitigations selected (temporary copy): 0 → 6 SHOULD on DF-9, DF-10 and MP-3, all planned; SmokeDetector unchanged (no attack-path risks). | 197 | done |
| CL-4 | The coverage badge of the risk dialog checks the anchor targets of an attack-path risk too (`ThreatReference.controlTargets`, set by the app; `computeMitigationCoverage` checks every target, de-duplicated) — risk dialog and DFD panel agree. Regression on the SmokeDetector fixture (`closed-loop-regression.int.test.ts`): all 516 threats with their proposed mitigations, alternately planned / done — one instance per element × property × value, every SHOULD a DFD option, no Interface control on an unfitting type, status and drift agree with the shared semantics, counts pinned (266 SHOULD, 49 met, 76 planned only). Re-check with the user's files: SmokeDetector under All 81 → 1 (the one real inconsistency); Headlamp 0 → 6 SHOULD once mitigations are selected. | 198 | done |

The strength tables are proposed in CL-1 for review (properties of finding 3 first).

## 5. Open

None. (Headlamp: the user sees no notifications — finding 5.)
