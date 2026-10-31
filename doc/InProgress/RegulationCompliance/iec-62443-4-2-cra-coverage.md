# TARAflow — EN IEC 62443-4-2 / CRA requirement matrix

**Status:** v11 · 2026-10-31 (decisions D-1 … D-24 in §7.1, §9 aligned with them; IEC-2a, IEC-3 done;
classic sibling `iec-62443-4-2-2019-coverage.md`; target 0.17.0-beta before 2026-11-30;
release plan: `doc/InProgress/Release/release-0.17-plan.md`) · code base: `main` 8b6aefe3,
branch `feature/iec62443-cra-matrix`
**Roadmap:** item 1 of the road to 1.0.0 (IEC 62443 compliance matrix for the CRA).
**Related:** `doc/Open/RegulationCompliance/taraflow-compliance-architecture.md`
(architecture from 2026-05, based on IEC 62443-4-2:2019 — see §2 for what changes),
`en-50742-rq-coverage.md` (EN 50742 approach B uses the same CR table as a fixed subset),
`iso-21434-rq-coverage.md` (same idea for ISO/SAE 21434).

> **Source of the numbers.** CR / RE numbers, SL-C assignments and the CRA mapping were
> read from the licensed draft **EN IEC 62443-4-2:2019/prAA:2026** (CENELEC enquiry
> draft, March 2026, CLC/TC 65X) on 2026-10-31. The draft replaces the whole content of
> every CR subclause, so it is self-contained for Clauses 5–11; the base standard
> EN IEC 62443-4-2:2019 was not available. "l." numbers are the draft's line numbers.
> Requirement texts are paraphrased; the standard is authoritative. prAA is a draft:
> it may change before the EN is cited in the Official Journal (§7, K1).

---

## 1. Purpose and scope

TARAflow models a product (DFD, assets, threats, risks, controls). EN IEC 62443-4-2
with prAA is the harmonised route to a **presumption of conformity with CRA Annex I
Part I** for industrial automation components (Annex ZZ). This document answers, one
row per CR / RE:

1. **What the standard asks** (paraphrase, SL-C from which it applies, CRA essential
   requirement it supports).
2. **Whether the TARAflow model already carries evidence for it** — which element
   property shows applicability and fulfilment — or whether the analyst has to state it.

The goal is a generated **requirement matrix** for a project: per CR / RE applicable or
not applicable with reasoning, fulfilled / gap with the model evidence, linked to the
CRA requirement and to the risks the control treats.

**What prAA itself asks for — the matrix is the Statement of Applicability.**
Annex B (security evaluation methodology, normative via CCSC 4) checks:

| Evaluation activity | Asks for | TARAflow source |
|---|---|---|
| EA-2-2 Intended use | intended use of the ToE | item definition (Overview → Definition), 0.16 |
| EA-2-3 Security context | product security context | item definition assumptions, trust boundaries, external entities |
| EA-2-5 Information categorization | categorised information | `dataClassification` (DataStore, DataFlow), assets |
| EA-2-9 Statement of Applicability | SoA per 62443-4-1 SR-2 (AAR-4) | **this matrix** (generated) |
| EA-3-1…3-4 Risk method, threat model, rating, treatment | 62443-4-1 SRM-1, -4, -5, -6 | TARA: methodology, DFD + threats, risks, treatment |
| EA-4-1 Applicable requirements | per CR / RE, derived by SR-2 | matrix rows "applicable" |
| EA-4-2 Non-applicable requirements | reasoning / evidence per row, CR-specific applicability criteria considered | matrix rows "n/a" + reasoning |
| EA-6-1 Consistency | intended use ↔ context ↔ risk assessment ↔ SoA aligned | TARA and matrix from one model — consistency by construction |

So the TARA is the risk assessment, and the matrix derived from the same model is the
SoA. Annex ZZ adds that any risk assessment referenced by the standard has to meet the
CRA (Art. 13(2)) — TARAflow's risk assessment is that document.

**Out of scope (external):** EN IEC 62443-4-1 process requirements (CCSC 3: SM, SVV,
DM, SUM, SG practices, test grades of Annex G), CRA Annex I **Part II** (vulnerability
handling) and the evaluation itself. TARAflow can list them as "process — external" rows
in the report (§5) but does not assess them.

## 2. What prAA changes against IEC 62443-4-2:2019

The architecture doc (2026-05) was written for 4-2:2019. prAA changes the requirement
set the mapping has to follow:

| Change | prAA | Consequence for TARAflow |
|---|---|---|
| Device-specific requirements removed | Clauses 12–15 deleted (SAR, EDR, HDR, NDR) | no `deviceCategories` filter, no `EDR 2.13` etc. — applicability is per CR instead (next row) |
| Requirement-specific applicability | every CR / RE has "Applicability" (e.g. CR 1.1: each external interface capable of human user access) | evaluation per **interface / element**, not per device category — fits the DFD well |
| Acceptance criteria per SL-C | each CR / RE has criteria for SL-C 1…4 | an RE can be "not applicable" at a level even if the CR applies |
| Void / removed CRs | CR 1.14 void; CR 2.3, 3.3, 5.3, 5.4, 7.5: "no component level requirement"; CR 1.7 RE(1) void | rows kept as n/a with the reason, no evaluation |
| New CR | CR 7.9 Component reset (l. 3840) | new row; evidence: reset / factory-reset capability |
| CCSC renamed | CCSC 2 = *supporting measures* (was compensating countermeasures); CCSC 3 least privilege deleted; CCSC 3 = SDL per 62443-4-1; new CCSC 4 = security evaluation per Annex B | "directly or by supporting measures" appears in many CRs: a CR can be met by an element **outside** the component (e.g. a gateway) — the matrix needs that link (K4) |
| CRA annexes | Annex H: CRA ECR ↔ CRs ↔ threat list (draft of CEN/CLC JTC13/WG9); Annex ZZ: CRA Annex I Part I ↔ subclauses | CRA column in §4; threat list as optional catalog link (K6) |

Not changed: FR 1–7, SL-C 1–4, the CR numbering.

## 3. CRA Annex I Part I ↔ EN IEC 62443-4-2 (Annex ZZ)

| CRA Annex I Part I | prAA subclauses | CRs |
|---|---|---|
| (1) appropriate level of cybersecurity based on the risks | 4.4 (CCSC 3 → 62443-4-1 SR-2) | process — applicability assessment = SoA |
| (2)(a) no known exploitable vulnerabilities | 4.4 (CCSC 3) | process (62443-4-1) |
| (2)(b) secure by default configuration, reset | 5.7, 7.16, 8.4, 11.6, 11.8, 11.9, 11.11 | 1.5, 3.14, 4.2, 7.4, 7.6, 7.7, 7.9 |
| (2)(c) vulnerabilities addressed through updates | 7.12 | 3.10 |
| (2)(d) protection from unauthorised access | 5.3–5.13, 6.3, 6.4, 6.7, 6.8, 6.15, 7.13, 7.15, 8.5, 10.3, 10.4 | 1.1–1.11, 2.1, 2.2, 2.5, 2.6, 2.13, 3.11, 3.13, 4.3, 6.1, 6.2 |
| (2)(e) confidentiality of data | 5.4, 5.10, 5.11, 6.15, 7.13, 7.15, 8.3, 8.4, 8.5 | 1.2, 1.8, 1.9, 2.13, 3.11, 3.13, 4.1, 4.2, 4.3 |
| (2)(f) integrity of data, programs, configuration | 5.10, 5.11, 6.10, 6.13, 6.15, 7.3, 7.6, 7.10, 7.12–7.16, 8.5, 11.5 | 1.8, 1.9, 2.8, 2.11, 2.13, 3.1, 3.4, 3.8, 3.10–3.14, 4.3, 7.3 |
| (2)(g) data minimisation | 4.4 (62443-4-1 SD-1, SR-4) | process; model hint: `DataFlow.dataMinimization` |
| (2)(h) availability of essential functions, DoS resilience | 4.2 (CCSC 1), 6.9, 6.11, 6.12, 7.7, 11.3, 11.4, 11.5 | CCSC 1, 2.7, 2.9, 2.10, 3.5, 7.1, 7.2, 7.3 |
| (2)(i) minimise negative impact on other devices / networks | 6.10, 7.7, 7.8, 9.3, 9.4, 11.3 | 2.8, 3.5, 3.6, 5.1, 5.2, 7.1 |
| (2)(j) limit attack surfaces | 5.15, 6.6, 6.7, 6.8, 6.10, 7.7, 9.3, 9.4, 11.9 | 1.13, 2.4, 2.5, 2.6, 2.8, 3.5, 5.1, 5.2, 7.7 |
| (2)(k) reduce incident impact (exploitation mitigation) | 7.4, 7.6, 7.8, 7.9, 11.3, 11.4, 11.8, 11.9 | 3.2, 3.4, 3.6, 3.7, 7.1, 7.2, 7.6, 7.7 |
| (2)(l) record and monitor internal activity, opt-out | 6.10, 6.12, 7.6, 10.3, 10.4 | 2.8, 2.10, 3.4, 6.1, 6.2 |
| (2)(m) secure removal / transfer of data and settings | 8.3, 8.4, 8.5, 11.5, 11.6 | 4.1, 4.2, 4.3, 7.3, 7.4 |
| Part II (vulnerability handling) | — | not covered by 4-2 (62443-4-1 DM / SUM, CRA Art. 14) — external |

**Observation:** CR 1.12, 2.12, 3.9 and 7.8 carry no CRA reference in Annex ZZ; they
stay in the matrix for the 62443 SL-C claim but give no CRA presumption on their own.
Annex H lists the same CR sets per ECR plus REs; the two tables agree.

## 4. Requirement matrix

**Columns**

| Column | Meaning |
|---|---|
| ID | CR / RE as numbered in prAA; l. = draft line of the requirement heading |
| Requirement | short paraphrase |
| SL-C | lowest SL-C at which the CR / RE is selected (prAA x.y.4 "Security levels"); "—" = never selected |
| CRA | Annex I Part I letter(s) from §3 |
| Applicability in the model | which model element makes the row applicable (prAA "Applicability") |
| Evidence in the model | element type · property = values that show fulfilment |
| Type | **A** derivable from properties · **B** partly derivable (property shows the mechanism, not every criterion) · **C** analyst statement needed · **n/a** void in prAA |
| Gap | property or field TARAflow lacks for A/B (→ §6) |

Element names: Proc = Process, MP = Multiprocess, DF = DataFlow, DS = DataStore,
IF = Interface (`ic.` = `implementedControls.`), TB = TrustBoundary, CB = ChipBoundary,
PB = PhysicalBoundary, EE = ExternalEntity.

### FR 1 — Identification and authentication control (IAC)

| ID | Requirement | SL-C | CRA | Applicability in the model | Evidence in the model | Type | Gap |
|---|---|---|---|---|---|---|---|
| CR 1.1 (l. 526) | identify and authenticate human users on every external interface with human access (directly or by supporting measures) | 1 | d | IF / DF with a human EE (operator, maintenance, …) | Proc.`authenticationRequired` ≠ no; MP.`boundaryAuthentication`; DF.`endpointAuthentication` ≠ none | B | which interfaces allow human access is implicit (EE type) |
| CR 1.1 RE(1) (l. 568) | unique identification and authentication of all human users | 2 | d | as CR 1.1 | — | C | "shared account" flag |
| CR 1.1 RE(2) (l. 593) | multifactor authentication for human users | 3 | d | as CR 1.1 | MP.`boundaryAuthentication` = mfa; DF.`endpointAuthentication` = mfa; EE.`authenticationMethod` = mfa | A | — |
| CR 1.2 (l. 624) | identify and authenticate other components on external interfaces, and itself towards them | 2 | d, e | DF between Proc / MP and a non-human EE or another component | DF.`endpointAuthentication` ∈ certificate, mutual_tls, symmetric_key, token, apikey; Proc.`tlsTermination` = mutual; IF.ic.`linkAuthentication` ≠ none | A | — |
| CR 1.2 RE(1) (l. 665) | unique identification and authentication of components | 3 | d, e | as CR 1.2 | DF.`endpointAuthentication` ∈ certificate, mutual_tls (per-device identity) | B | shared vs. per-device key not modelled |
| CR 1.3 (l. 699) | account management, directly or by supporting measures | 1 | d | Proc / MP with authentication | Proc / MP.`accountManagement` | A | — |
| CR 1.4 (l. 732) | identifier management | 1 | d | as CR 1.3 | Proc / MP.`accountManagement` (implies identifier management) | B | — |
| CR 1.5 (l. 773) | authenticator management: initial authenticator, detect unchanged defaults, change / refresh, protect stored / used / transmitted authenticators | 1 | b, d | every authentication mechanism | Proc / MP / CB.`authenticatorStorage` (protection at rest); DF encryption (in transit) | B | default-credential handling (a–c) not modelled |
| CR 1.5 RE(1) (l. 817) | hardware protection of authenticators | 3 | b, d | every authenticating Proc / MP | each: `authenticatorStorage` ∈ tpm, secure_element, hsm | A | — |
| CR 1.6 (l. 853) | identify and authenticate all users of wireless communication | 1 | d | IF.`type` ∈ wifi, bluetooth, nfc; DF.`protocol` wireless (wireless_hart, bluetooth, …) | IF.ic.`linkAuthentication` ≠ none; DF.`endpointAuthentication` ≠ none | A | — |
| CR 1.6 RE(1) (l. 887) | unique identification on wireless | 2 | d | as CR 1.6 | IF.ic.`linkAuthentication` ∈ certificate_based, mutual_pairing | B | — |
| CR 1.7 (l. 918) | configurable password strength per recognised guidelines | 1 | d | any password-based mechanism (`…Authentication` = password) | — | C | — |
| CR 1.7 RE(1) (l. 947) | *void in prAA* | — | — | — | — | n/a | — |
| CR 1.7 RE(2) (l. 949) | password lifetime limits for software processes / devices | 4 | d | password-based machine authentication | — | C | — |
| CR 1.8 (l. 979) | PKI operation per best practice | 2 | d, e, f | `…Authentication` ∈ certificate, mutual_tls | — | C | — |
| CR 1.9 (l. 1019) | public-key authentication: signature / data validity, proof of possession | 2 | d, e, f | as CR 1.8 | DF.`endpointAuthentication` ∈ certificate, mutual_tls (mechanism only) | B | — |
| CR 1.10 (l. 1087) | obscure authentication feedback | 1 | d | human-user authentication present | — | C | — |
| CR 1.11 (l. 1122) | limit consecutive failed logins, lock for a period / until unlocked | 1 | d | every authentication mechanism | — (IF.ic.`abuseProtection` = lockout sits on the interface; which interface a human-access flow passes is not modelled, P-7) | C | interface ↔ flow link (P-7) |
| CR 1.12 (l. 1173) | configurable system-use notification before login on local HMI | 1 | — | local human UI (IF.`type` touchscreen, HMI EE) | — | C | — |
| CR 1.13 (l. 1222) | monitor and control all access via untrusted networks | 1 | j | MP.`remoteAccessEnabled` / `exposedToInternet`; TB of type network / cloud | each such TB: `boundaryControlTypes` ∋ vpn_gateway, jump_host, authentication_gateway, firewall; TB.`monitoringEnabled` | B | — |
| CR 1.13 RE(1) (l. 1253) | deny untrusted-network access unless explicitly approved by a role | 3 | j | as CR 1.13 | — | C | — |
| CR 1.14 (l. 1283) | *void in prAA* | — | — | — | — | n/a | — |

### FR 2 — Use control (UC)

| ID | Requirement | SL-C | CRA | Applicability in the model | Evidence in the model | Type | Gap |
|---|---|---|---|---|---|---|---|
| CR 2.1 (l. 1315) | authorization enforcement for identified and authenticated users | 1 | d | Proc / MP with authentication | Proc / MP.`authorizationModel` ≠ none; DF.`accessMode` | A | — |
| CR 2.1 RE(1) (l. 1351) | authorization for all users by responsibility and least privilege | 2 | d | as CR 2.1 | `authorizationModel` + Proc.`privilegeLevel` / `runsAs` (least privilege) | B | — |
| CR 2.1 RE(2) (l. 1375) | authorized role maps permissions to roles | 2 | d | as CR 2.1 | `authorizationModel` = rbac | A | — |
| CR 2.1 RE(3) (l. 1401) | supervisor manual override | 3 | d | as CR 2.1 | — | C | — |
| CR 2.1 RE(4) (l. 1425) | dual approval for actions with serious impact on essential functions | 4 | d | as CR 2.1, safety-relevant functions | — | C | — |
| CR 2.2 (l. 1458) | wireless usage authorization, monitoring, restriction | 1 | d | wireless IF / DF (as CR 1.6) | IF.ic.`monitoringControl` ≠ none, IF.ic.`serviceAccessPolicy` | B | — |
| CR 2.3 (l. 1497) | *no component requirement (SR 2.3 is system level)* | — | — | — | — | n/a | — |
| CR 2.4 (l. 1500) | policy for mobile code (execution, transfer, …) | 1 | j | component uses mobile code | — | C | "uses mobile code" flag |
| CR 2.4 RE(1) (l. 1544) | authenticity check before executing mobile code | 2 | j | as CR 2.4 | — (`malwareProtection` = code_signing does not show that mobile code is checked) | C | "uses mobile code" flag |
| CR 2.5 (l. 1575) | session lock after inactivity / on demand | 1 | d, j | every Proc connected to a human EE | each: Proc.`sessionControl.sessionLockEnabled` | A | not on MP |
| CR 2.6 (l. 1622) | terminate remote sessions (timeout / manual) | 2 | d, j | MP.`remoteAccessEnabled`; every Proc connected to a human EE | each: Proc.`sessionControl.remoteTerminationEnabled` | A | not on MP |
| CR 2.7 (l. 1664) | limit concurrent sessions per interface and user | 3 | h | every Proc connected to an EE | each: Proc.`sessionControl.maxConcurrentSessions` | A | not on MP |
| CR 2.8 (l. 1700) | audit records for security-relevant event categories | 1 | f, i, j, l | always | Proc / MP.`nonRepudiation` = audit_log; IF.ic.`monitoringControl` ∈ usage_logged, tamper_logged | B | event categories not modelled |
| CR 2.8 RE(1) (l. 1755) | opt-out of security audit logging for authorized users (CRA (2)(l)) | 1 | l | as CR 2.8 | — | C | — |
| CR 2.9 (l. 1784) | allocate audit storage; essential functions survive a full log | 1 | h | audit logging present | — | C | — |
| CR 2.9 RE(1) (l. 1816) | warn at a configurable audit storage threshold | 3 | h | as CR 2.9 | — | C | — |
| CR 2.10 (l. 1852) | essential functions survive audit failures; react appropriately | 1 | h, l | audit logging present | — | C | — |
| CR 2.11 (l. 1896) | timestamps or time-related information for audit records | 1 | f | audit logging present | — | C | — |
| CR 2.11 RE(1) (l. 1924) | timestamps synchronised with an external source | 2 | f | timestamps created | — (would be: DF to a time-source EE, P-4) | C | no time-source marker |
| CR 2.11 RE(2) (l. 1945) | detect alteration of the time source, audit it | 4 | f | as RE(1) | — (would be: DF.`integrityProtection` on the time-sync flow, P-4) | C | no time-source marker |
| CR 2.12 (l. 1972) | determine whether a human user took an action | 1 | — | every Proc / MP connected to a human EE | each: `nonRepudiation` ≠ none | A | — |
| CR 2.12 RE(1) (l. 2004) | non-repudiation for all users | 4 | — | every Proc / MP connected to an EE | each: `nonRepudiation` ∈ digital_signature, hardware_backed | A | — |
| CR 2.13 (l. 2033) | protect physical diagnostic and test interfaces (e.g. JTAG) | 2 | d, e, f | IF.`type` ∈ jtag, swd, swd_swo, jtag_trace, uart; CB.`debugInterfacePresent` ≠ none | IF.ic.`debugProtection` ≠ none; IF.ic.`serviceAccessPolicy`; CB.`debugInterfaceLocked`; PB.`debugInterfaceAccessible` = false | A | — |
| CR 2.13 RE(1) (l. 2080) | actively monitor diagnostic interfaces, audit access attempts | 3 | f | as CR 2.13 | IF.ic.`monitoringControl` ∈ tamper_logged, alerted, active_response | A | — |

### FR 3 — System integrity (SI)

| ID | Requirement | SL-C | CRA | Applicability in the model | Evidence in the model | Type | Gap |
|---|---|---|---|---|---|---|---|
| CR 3.1 (l. 2122) | protect integrity of transmitted information | 1 | f | every external DF | DF.`integrityProtection` ∈ hmac, signature, aead; DF.`encryptionInTransit` ∈ tls, mtls, vpn | A | — |
| CR 3.1 RE(1) (l. 2147) | verify authenticity of received information | 2 | f | as CR 3.1 | DF.`integrityProtection` ∈ hmac, signature, aead + `endpointAuthentication` ≠ none | A | — |
| CR 3.2 (l. 2195) | prevent and detect installation / execution of malicious code | 1 | k | Proc / MP executing code | Proc / MP.`malwareProtection` ≠ none | A | — |
| CR 3.2 RE(1) (l. 2230) | detect and prevent installation of malicious code (report version of protection) | 2 | k | as CR 3.2 | `malwareProtection` ∈ application_whitelist, code_signing | B | — |
| CR 3.3 (l. 2264) | *no component requirement* | — | — | — | — | n/a | — |
| CR 3.4 (l. 2267) | integrity checks of software, configuration, information at rest; record and report | 1 | f, k, l | DS with software / configuration; firmware on CB | DS.`integrityProtection` ≠ none; CB.`firmwareProtection` | B | "record and report" not modelled |
| CR 3.4 RE(1) (l. 2310) | authenticity checks of software and information | 2 | f, k, l | as CR 3.4 | DS.`integrityProtection` = signature; MP.`updateMechanism` ∈ signed_local, signed_ota | A | — |
| CR 3.4 RE(2) (l. 2345) | automatic notification on integrity violations | 3 | f, k, l | as CR 3.4 | — | C | — |
| CR 3.5 (l. 2383) | validate security-relevant input from external interfaces | 1 | h, i, j | Proc receiving DF from outside its TB | Proc.`inputValidation` ∈ strict, schema (basic = partial) | A | — |
| CR 3.6 (l. 2427) | set outputs to a predetermined state if operation cannot be maintained under attack | 1 | i, k | Proc / MP connected to the controlled process (actuator, safety function) | Proc.`failSafeOutputState` ≠ not_defined | A | — |
| CR 3.7 (l. 2469) | handle errors without exploitable feedback | 1 | k | always | Proc.`errorHandling` = sanitized | A | — |
| CR 3.8 (l. 2511) | session integrity: invalidate IDs on logout, random unique IDs | 2 | f | session-based interfaces | — | C | — |
| CR 3.9 (l. 2561) | protect audit records from unauthorised access, change, deletion | 2 | — | every DS with `storedDataTypes` ∋ audit_logs | each: `accessControlMechanism` ≠ none | B | — |
| CR 3.9 RE(1) (l. 2588) | audit records on hardware write-once media | 4 | — | as CR 3.9 | — | C | — |
| CR 3.10 (l. 2613) | support updates and upgrades | 1 | c, f | always | MP.`updateMechanism` ≠ none | A | not on Proc / CB |
| CR 3.10 RE(1) (l. 2638) | validate authenticity and integrity of updates before installation | 2 | c, f | as CR 3.10 | `updateMechanism` ∈ signed_local, signed_ota | A | — |
| CR 3.10 RE(2) (l. 2664) | automatic loading, update notification or scheduled update (should: rollback) | 2 | c, f | as CR 3.10 | `updateMechanism` ∈ signed_ota, mdm_managed, ci_cd | B | rollback not modelled |
| CR 3.11 (l. 2709) | physical tamper resistance and detection (not for software-only components) | 2 | d, e, f | component with hardware (PB / CB present) | PB.`tamperProtection` ≠ none; CB.`tamperProtection` ≠ none | A | — |
| CR 3.11 RE(1) (l. 2751) | notify on tampering attempts | 3 | d, e, f | as CR 3.11 | PB.`tamperProtection` = active_detection; PB.`monitoringType` = tamper_monitoring; CB.`tamperProtection` = active | A | — |
| CR 3.12 (l. 2784) | provision and protect product supplier roots of trust at manufacture | 2 | f | component with secure boot / signed updates | CB.`secureBootEnabled`; `authenticatorStorage` ∈ secure_element, tpm, hsm | B | no root-of-trust field |
| CR 3.13 (l. 2840) | provision and protect asset owner roots of trust, without relying on components outside the zone | 2 | d, e, f | owner-managed keys / certificates | — | C | — |
| CR 3.14 (l. 2902) | verify integrity of firmware, software, configuration before boot / use | 1 | b, f | component with firmware (CB) or OS | CB.`secureBootEnabled`; CB.`firmwareProtection` | A | software components: OS does it (prAA allows) |
| CR 3.14 RE(1) (l. 2934) | verify authenticity of boot with the supplier root of trust | 2 | b, f | as CR 3.14 | CB.`secureBootEnabled` = true | B | integrity vs. authenticity not separated |

### FR 4 — Data confidentiality (DC)

| ID | Requirement | SL-C | CRA | Applicability in the model | Evidence in the model | Type | Gap |
|---|---|---|---|---|---|---|---|
| CR 4.1 (l. 2980) | confidentiality of sensitive information over external interfaces | 1 | e, m | DF leaving the component with `dataClassification` ∈ confidential, secret (or a confidential asset) | DF.`encryptionInTransit` ≠ none | A | — |
| CR 4.1 RE(1) (l. 3017) | confidentiality of sensitive information at rest and in processing | 2 | e, m | DS with `dataClassification` ∈ confidential, restricted, secret | DS.`encryptionAtRest` ≠ none; CB.`firmwareProtection` = encrypted | A | "in processing" (memory) not modelled |
| CR 4.2 (l. 3050) | erase all sensitive information in non-volatile memory | 2 | b, e, m | DS with sensitive data | DS.`deletionMechanism` ∈ overwrite, crypto_erase, factory_reset, physical | A | — |
| CR 4.2 RE(1) (l. 3077) | erase sensitive information in volatile memory | 3 | b, e, m | Proc handling sensitive data | — | C | — |
| CR 4.2 RE(2) (l. 3115) | verify the erasure | 3 | b, e, m | as CR 4.2 | — | C | — |
| CR 4.3 (l. 3142) | cryptography per recognised practice | 1 | d, e, f, m | any cryptographic mechanism in the model | DF / DS / CB.`cryptoStandard` ∈ nist_approved, fips_140_2, fips_140_3 | A | — |

### FR 5 — Restricted data flow (RDF)

| ID | Requirement | SL-C | CRA | Applicability in the model | Evidence in the model | Type | Gap |
|---|---|---|---|---|---|---|---|
| CR 5.1 (l. 3198) | support network segmentation; no undocumented connections between networks | 1 | i, j | MP connected to more than one network / TB | TB.`boundaryControlTypes` ∋ network_segmentation, firewall, dmz, data_diode; MP.`airGapped` | B | "connected to n networks" is derivable from the DFD |
| CR 5.2 (l. 3253) | at a security boundary: monitor and control communication | 1 | i, j | component placed on a TB (gateway, firewall: MP.`systemClass` = gateway) | TB.`boundaryControlTypes` ≠ ∅; TB.`monitoringEnabled` | A | — |
| CR 5.2 RE(1) (l. 3289) | deny all, permit by exception | 2 | i, j | as CR 5.2 | TB.`defaultDenyPolicy` = deny_all_permit_exception | A | see RE(3) |
| CR 5.2 RE(2) (l. 3311) | island mode | 3 | i, j | as CR 5.2 | TB.`defaultDenyPolicy` = island_mode | A | see RE(3) |
| CR 5.2 RE(3) (l. 3332) | fail close | 3 | i, j | as CR 5.2 | TB.`defaultDenyPolicy` = fail_close | A | **single-valued**: SL-C 3 needs RE(1)+(2)+(3) together, one value can show only one (§6, P-1) |
| CR 5.3 (l. 3361) | *no component requirement* | — | — | — | — | n/a | — |
| CR 5.4 (l. 3365) | *no component requirement* | — | — | — | — | n/a | — |

### FR 6 — Timely response to events (TRE)

| ID | Requirement | SL-C | CRA | Applicability in the model | Evidence in the model | Type | Gap |
|---|---|---|---|---|---|---|---|
| CR 6.1 (l. 3381) | read-only access to audit logs for authorised humans / tools | 1 | d, l | audit logging present | — | C | — |
| CR 6.1 RE(1) (l. 3411) | programmatic access / forwarding of audit records | 3 | d, l | as CR 6.1 | DF from the component to a log / SIEM EE | B | no "log sink" marker |
| CR 6.2 (l. 3440) | report detected security issues for continuous monitoring | 2 | d, l | always | TB.`monitoringEnabled`; TB.`boundaryControlTypes` ∋ ids_ips; IF.ic.`monitoringControl` ∈ alerted, active_response | B | — |

### FR 7 — Resource availability (RA)

| ID | Requirement | SL-C | CRA | Applicability in the model | Evidence in the model | Type | Gap |
|---|---|---|---|---|---|---|---|
| CR 7.1 (l. 3505) | keep essential functions in degraded mode under DoS | 1 | h, i, k | every IF with `exposureLevel` EL2–EL4 | each: IF.ic.`abuseProtection` ≠ none | B | — |
| CR 7.1 RE(1) (l. 3538) | mitigate message flooding | 2 | h, i, k | as CR 7.1 | each: IF.ic.`abuseProtection` ∈ flood_protection, rate_limited | A | — |
| CR 7.2 (l. 3568) | limit resource use by security functions | 1 | h, k | always | — | C | — |
| CR 7.3 (l. 3606) | backup directly or by supporting measures, without affecting operation | 1 | f, h, m | DS / MP with state worth restoring | MP.`backupMechanism` ≠ none; DS.`backupEnabled` | A | — |
| CR 7.3 RE(1) (l. 3646) | verify backup integrity before restore | 2 | f, h, m | as CR 7.3 | — | C | — |
| CR 7.4 (l. 3674) | recover and reconstitute to a known secure state | 1 | b, m | always | MP.`backupMechanism` (partly) | B | — |
| CR 7.5 (l. 3713) | *no component requirement (emergency power, system level)* | — | — | — | — | n/a | — |
| CR 7.6 (l. 3715) | secure-by-default network and security configuration; interface to read current settings | 1 | b, k, l | always | — | C | secure-by-default is a CRA headline (2)(b); no model field |
| CR 7.6 RE(1) (l. 3744) | machine-readable report of current security settings | 3 | b, k | as CR 7.6 | — | C | — |
| CR 7.7 (l. 3770) | restrict unnecessary interfaces, functions, ports, protocols, services | 1 | b, j, k | every IF / service | IF.`operationalState` ∈ sw_disabled, hw_disabled, permanent_disabled for unused IF; IF.ic.`serviceAccessPolicy` ≠ always_enabled | B | "needed for intended use" not modelled per IF |
| CR 7.8 (l. 3808) | provide component information to an inventory | 2 | — | always | — | C | — |
| CR 7.9 (l. 3840) | reset to a supplier-defined state (**new in prAA**) | 1 | b | always | DS.`deletionMechanism` = factory_reset (partly) | B | reset capability per component not modelled |

### Common component security constraints and process

| ID | Requirement | CRA | TARAflow | Type |
|---|---|---|---|---|
| CCSC 1 (l. 482) | adhere to the system's essential-function constraints (62443-3-3 Cl. 4) | h | safety annotations, hazard items (essential / safety functions) | B |
| CCSC 2 (l. 487) | document supporting measures the system has to provide | — | supporting-measure link per row (K4) | C |
| CCSC 3 (l. 496) | develop and support per 62443-4-1 (Clauses 5–13), test grade per Annex G | 1, a, g | external (process) | ext |
| CCSC 4 (l. 504) | evaluate per Annex B | — | external; the matrix and the TARA are inputs (§1) | ext |

### Count

| | A | B | C | n/a |
|---|---|---|---|---|
| FR 1 (22 rows) | 5 | 7 | 8 | 2 |
| FR 2 (24) | 9 | 3 | 11 | 1 |
| FR 3 (23) | 12 | 6 | 4 | 1 |
| FR 4 (6) | 4 | 0 | 2 | 0 |
| FR 5 (7) | 4 | 1 | 0 | 2 |
| FR 6 (3) | 0 | 2 | 1 | 0 |
| FR 7 (12) | 2 | 4 | 5 | 1 |
| **Total (97)** | **36** | **23** | **31** | **7** |

About two thirds of the 90 live rows (59) can be pre-filled from the model (A + B). The C rows
need an analyst statement (applicable / met / not met / n/a + reasoning + evidence
reference) — that is what makes the matrix a complete SoA.

## 5. Report output (target)

Per project, from one model (consistency per EA-6-1):

1. **Header:** standard version (prAA:2026 draft), component under evaluation (K2),
   claimed SL-C per FR (K3), date, model hash (reuse the verification hash of Phase 4).
2. **SoA table:** CR / RE · applicable? · reasoning (derived from the applicability
   column, or the analyst's) · status (met / partial / gap / n/a / manual) · evidence
   (element ids + property values, analyst evidence ref) · supporting measure (CCSC 2)
   · CRA letter · linked risks (risks whose treatment sets the evidence property).
   The status names its **source** — model, mitigation, supporting measure, statement,
   claim — so a row met by a measure marked done (D-21) is never read as model evidence.
3. **CRA view:** Annex I Part I (1)–(2)(m) with the CR rows behind each letter and an
   overall state; Part II and the 62443-4-1 rows listed as "process — external".
4. **Gaps:** applicable rows not met at the claimed SL-C, each with a link to the risk or
   a suggested mitigation from the catalog (`affectsProperties` → property → CR).

## 6. Model gaps found (input for the plan)

| # | Gap | Rows | Proposal (to decide) |
|---|---|---|---|
| P-1 | `TB.defaultDenyPolicy` is single-valued, but CR 5.2 RE(1)–(3) are cumulative at SL-C 3 | CR 5.2 RE(1–3) | multi-select (schema migration; analysis-preserving if the old value maps 1:1) — same pattern as the backlog item for `physicalPathProtection` / `malwareProtection` |
| P-2 | `sessionControl` exists on Process only; `updateMechanism` on Multiprocess only | CR 2.5–2.7, 3.10 | add to the other element type, or evaluate per component (K2) over all children |
| P-3 | no "human access" marker per interface / flow | CR 1.1, 1.10, 1.12, 2.5 | derive from the connected EE type (operator, maintenance, … — external-entity-type-registry) |
| P-4 | no log-sink / time-source markers (audit-log stores are marked: `DS.storedDataTypes` ∋ audit_logs) | CR 2.11 RE(1)/(2), 6.1 RE(1) | EE types "siem", "time_source" |
| P-5 | secure-by-default, reset, default-credential handling not modelled | CR 1.5 a–c, 7.6, 7.9 (CRA (2)(b)) | component-level fields (K2), or C rows |
| P-7 | which interface a flow passes is not in the reference view (`viaInterface: true/false` only) | CR 1.11 (lockout on the interface of human-access flows) | the dfd graph already has `interfaceIds` per flow (`DataFlowAnalysis`, used by the validator), the effective model `EffectiveFlow.interfaces` — carry the ids into the property view, then CR 1.11 can return to type A |
| P-6 | `secureErase` / `auditLogRetentionYears` from the architecture doc | CR 4.2 / EN 50742 8.5 | `DS.deletionMechanism` already covers CR 4.2 — drop `secureErase`; retention only for EN 50742 B |

## 7. Decisions and open points

### 7.1 Decisions

| # | Decision (user, 2026-10-31) | Consequence |
|---|---|---|
| D-1 (K1, K7) | **Two matrices:** classic IEC 62443-4-2 (2019 edition) and the CRA edition EN IEC 62443-4-2 (prAA, this document). The project's regulation tags select the matrix. Both tags together are allowed but not required; if both are set, the **CRA matrix applies** (stronger). | Two versioned mapping files with one evaluator; selection by tags, not by the regulation preset (so ISO / EN 50742 projects can carry it too). The classic matrix needs the 2019 text (SAR / EDR / HDR / NDR, device categories) — §4 covers only the CRA edition. Which tags exactly: K9. |
| D-2 (K3) | **SL-C follows from the TARA:** the achieved SL-C results from the chosen mitigations. It is a **vector per FR** (SL-C(IAC) … SL-C(RA)). If the project's target SL-C is not reached because one FR value falls short, **claims** are needed to reach it. | Target vector per FR on the project; achieved value per FR = highest SL-C at which every CR / RE selected for that FR (x.y.4 "Security levels") is met; a shortfall per FR lists the missing CR / RE rows, each closed by a mitigation or a claim. Open: which state counts (K10), what a 62443 claim is (K11). |
| D-3 (K9) | Tags: `IEC 62443` selects the classic matrix, a **new tag `EN IEC 62443 (CRA)`** the CRA edition; the generic `CRA` tag selects no 62443 matrix. Each tag alone selects its matrix; both → CRA edition (D-1). | New regulation tag + tooltip / doc description (DE / EN); the tag validator suggests `CRA` together with the new tag. |
| D-4 (K10) | Two vectors: **planned** (mitigations chosen in the risk treatment, SHOULD values) and **achieved** (properties as set in the DFD, IS values — closed loop). | Report states the achieved vector; the gap list shows both. |
| D-5 (K11) | Claims for SL-C gaps **reuse the 0.16 claims** (`project.cybersecurityConcept.claims`, CLM-nn) with a new kind: FR + CR / RE ids + supporting measure (prAA CCSC 2; compensating countermeasure in 2019) + responsible party. | Amends patch 244 (goals / claims ISO only): claims visible for projects with a 62443 matrix. The claim text is the supporting-measure description prAA CCSC 2 asks for in the component documentation. |
| D-6 (K12) | C rows: analyst statement (K4) or a mitigation with **`iec62443` references** (CR / RE ids) in the catalog; B rows count as met when the property is set, the unmodelled criteria are shown as a checklist. | Catalog extension (built-in + custom mitigations); "SL-C from the chosen mitigations" (D-2) holds for C rows too. |
| D-7 (K2) | **Component under evaluation = a selectable element** (Multiprocess or Process) per project; everything else in the model is its environment and may meet a CR as a supporting measure (prAA CCSC 2 / 2019 compensating countermeasure). Nothing selected → the whole model. | Applicability and evidence are evaluated on the component and its children; evidence found on elements outside it is shown as "by supporting measure" with the element named. |
| D-8 (K4) | **Stored in the project file:** `project.compliance` = { component, target SL-C vector per FR, statements per CR / RE (applicable, status, reasoning, evidenceRef, supportingMeasure) } — schema 12. | New fields only → the migration is declared in `ANALYSIS_PRESERVING_MIGRATIONS`. |
| D-9 (K5) | **Own tab "Compliance" + report chapter.** | Tab: SoA table, planned / achieved vector per FR, gaps → claim or mitigation. Report: §5. |
| D-10 (K6) | **Annex H threat list later** (not in 0.17); the CRA view uses the CR mapping of Annex ZZ. | Revisit when the JTC13/WG9 list is final. |
| D-11 (K-C2, classic doc) | Evidence mapping shared by both editions via **stable requirement ids**, explicit per-edition overrides, completeness test per edition (no silent fallback). | Applies to this document's §4 rows too: each row gets its requirement id in the mapping file (IEC-2). |
| D-12 (K-E1) | Status **`unknown`** when a property a condition reads is not set on an element in scope; counts like `needs-statement` (blocks the vector). `n/a` only when the model shows non-applicability. | Unfinished models never look better than complete ones. |
| D-13 (K-E2) | **Quantifier per rule, default "all"**: every applicable element in scope must satisfy; "any" only where the requirement concerns the component as a whole; failing elements are listed in the gap. | Rules pair applicability and evidence on the same element types. |
| D-14 (K-E3) | **Two values per FR:** *SL-C (component)* = met from model / mitigation + n/a, plus supporting measures only on rows whose text allows them ("directly or by supporting measures", flag per edition row); *SL-C with supporting measures and claims*. Claims never count for the component value. | Report and tab show and label both. |
| D-15 (K-E4) | **Type-level conformance check** of every rule path and value against the element property types, as a file in `src/tests` compiled by `tsc` (the feature itself stays free of `features/dfd`); rules declared with `satisfies`. | Part of IEC-2a. |
| D-16 (K-E5) | A mitigation reference counts only if the mitigation is chosen for a risk whose threat concerns an element **in the component scope**. | IEC-3. |
| D-17 (K-E6) | A statement stores the **model result at the time of the statement**; a later difference shows "model changed — review statement". | Schema 12 field of the statement (D-8). |
| D-18 (K-E7) | Rules are declared **`as const satisfies EvidenceRule`** — `satisfies` alone widens `property` to `string` and the conformance test (D-15) checks nothing (reproduced with tsc 5.x). | §9.2. |
| D-19 (K-E8) | For **`all` rules, elements with applicability `unknown` count as `unknown`**, never skipped: an applicable element that clearly fails → `gap` naming it; otherwise any `unknown` → the row is not met by the model and ends as `unknown` (step 9). | §9.4 steps 4, 5. |
| D-20 (K-E9) | **Supporting measures are derived automatically only for `any` rules** (e.g. backup or update by an external system). For `all` rules a supporting measure needs an analyst statement naming it; a derivation along paths (e.g. an upstream gateway) may come later. | §9.4 step 7 — evaluating `all` over scope ∪ environment would be stricter, not looser. |
| D-21 (K-E10) | In the **achieved** run a mitigation reference counts **only where the model does not decide** (rule without model evidence, or elements `unknown`). Against a clear model `no` the row is a `gap` with the note "mitigation marked done, model shows not met". In the **planned** run the mitigation may overlay. | §9.4 step 6. |
| D-22 (K-E11) | Quantifier **"any" only for the capabilities of the component as a whole**, listed with their reason in §9.2; the completeness test fails for any other "any" rule. | Review of IEC-2a (review 2026-10-31, reviewer): 28 rules had "any", several of them per element (key storage, lockout, sessions, DoS). |
| D-23 (K-E12) | The value **`custom` counts as `unknown` in type A rules** ("statement needed"); in type B rules it counts as satisfied, the checklist covers it. Applied centrally by the evaluator. | `custom` only says the analyst entered something else, not that it suffices. |
| D-24 (K-E13) | **Neighbours are the endpoints of the analysis graph** the threat generation uses (`dfd.graph`; for a leveled DFD built on the effective model — leaves only, every flow stitched to its deepest drawn endpoint). Interfaces are not flow endpoints: communication always passes an interface to the endpoint, so a flow is **sender → receiver** and carries the communication threats, while the interface gets its own logical and physical threats. *Exception (found in IEC-3, by design of the validator, "path B"):* a flow may end **at** a debug interface on a chip boundary (debugger → JTAG / SWD / UART console); there the interface is the endpoint — the debug-interface rules (CR 2.13) target it directly, the session rules do not follow it into the chip. An actor on the parent page is therefore a direct neighbour of the leaf process on the child page. A flow in state **fallback** (ends at a decomposed multiprocess because nobody drew it below) makes `endpointIf` / `connectedIf` **`unknown`** for the elements contained in that multiprocess — never `n/a` (D-12). | Review of IEC-2a / 266 (review 2026-10-31, reviewer) feared false `n/a` for processes behind an interface or on a child page (CR 2.5–2.7, 2.12); checked: the first case does not occur, the second is resolved by the effective model, only fallback flows remain. |

Achieved SL-C per FR, as decided in D-2:

```
achieved(FR) = max { n ∈ 0..4 | every CR / RE of FR selected at SL-C n is met or claimed }
gap(FR)      = target(FR) > achieved(FR)  →  rows selected at levels achieved+1 … target
```

A row counts as met when the evidence in §4 is present — properties set by a mitigation,
or an analyst statement for C rows (K4) — or when a claim covers it.

### 7.2 Open points — to decide before any code

| # | Question | Options | Recommendation |
|---|---|---|---|
| K1 | Edition | — | **decided, D-1** (both; the CRA mapping stays versioned as prAA draft until the EN is cited) |
| K2 | What is "the component" in a TARAflow project? | — | **decided, D-7** |
| K3 | SL-C target / achieved | — | **decided, D-2** |
| K4 | Analyst statements for C rows and overrides of A/B rows | — | **decided, D-8** |
| K5 | Where is it shown? | — | **decided, D-9** |
| K6 | Annex H threat list (Threat.UnauthorizedAccess …) | — | **decided, D-10** |
| K7 | Preset coupling | — | **decided, D-1** (tags, independent of the preset) |
| K8 | Architecture doc (2026-05) | — | **done**: classic sibling `iec-62443-4-2-2019-coverage.md` written (2026-10-31, own open points K-C1, K-C2); architecture doc marked superseded |
| K9 | Which tags select which matrix? (each tag alone selects its matrix, D-1) | — | **decided, D-3** |
| K10 | Which state of a mitigation counts for "achieved"? | — | **decided, D-4** |
| K11 | What is a claim in 62443 terms? | — | **decided, D-5** |
| K12 | Rows the model cannot decide (C) and partial rows (B) | — | **decided, D-6** |
| K-E1 | Review of §9 — review 2026-10-31 (reviewer) | — | **decided, D-12** |
| K-E2 | Review of §9 — review 2026-10-31 (reviewer) | — | **decided, D-13** |
| K-E3 | Review of §9 — review 2026-10-31 (reviewer) | — | **decided, D-14** |
| K-E4 | Review of §9 — review 2026-10-31 (reviewer) | — | **decided, D-15** |
| K-E5 | Review of §9 — review 2026-10-31 (reviewer) | — | **decided, D-16** |
| K-E6 | Review of §9 — review 2026-10-31 (reviewer) | — | **decided, D-17** |
| K-E7 | Review of §9 v2 — review 2026-10-31 (reviewer) | — | **decided, D-18** |
| K-E8 | Review of §9 v2 — review 2026-10-31 (reviewer) | — | **decided, D-19** |
| K-E9 | Review of §9 v2 — review 2026-10-31 (reviewer) | — | **decided, D-20** |
| K-E10 | Review of §9 v2 — review 2026-10-31 (reviewer) | — | **decided, D-21** |
| K-E11 | Review of IEC-2a — review 2026-10-31 (reviewer) | — | **decided, D-22** |
| K-E12 | Review of IEC-2a — review 2026-10-31 (reviewer) | — | **decided, D-23** |
| K-E13 | Review of 266 — review 2026-10-31 (reviewer) | — | **decided, D-24** |

## 8. Next steps

1. Discuss §7.2 one point at a time; record the decisions in §7.1 (doc patches, `main`).
   The classic matrix (D-1): IEC 62443-4-2:2019 is in the repo root (licensed, never
   committed or quoted).
2. Steps and their order: `doc/InProgress/Release/release-0.17-plan.md` §3.1; IEC-2 / IEC-3
   detail in §9.
3. Validate the A/B rows against the two examples (SmokeDetector-leveled, Headlamp) before
   the UI.

## 9. Implementation design (IEC-2, IEC-3)

Turns D-1 … D-11 into code structure. No new decisions; where this section chooses, it
follows the decisions or existing patterns.

### 9.1 Placement

- New feature `src/features/compliance/` (models, data, services) — pure, no React in
  IEC-2 / IEC-3. It imports only from `shared` (`DFDGraphReference`, `ProjectTags`,
  `ControlInstance`, `CybersecurityConcept`), never from another feature.
- The app layer computes the inputs (component scope, planned overlay) and passes them in
  — the pattern of the Risk tab's `TicketPort` and of `to-reference-graph.ts`.

### 9.2 Requirement ids and two kinds of files (D-11, K-C2)

| File | Content |
|---|---|
| `models/compliance-types.ts` | `RequirementId`, `EvidenceRule`, `EditionRow`, `Edition`, `RowResult`, `SlVector`, `ComplianceInput` |
| `data/evidence-rules.ts` | one entry per **requirement id** (e.g. `cr-1.1`, `cr-1.1-re2`, `cr-4.1-transit`, `cr-4.1-rest`, `cr-3.10`): applicability + satisfaction conditions, type A / B / C, checklist keys for B |
| `data/edition-iec-62443-4-2-2019.ts`, `data/edition-en-iec-62443-4-2-praa-2026.ts` | rows of one edition: row label (`CR 1.1 RE(1)`, `EDR 3.10`), FR, lowest SL-C or void + reason, requirement ids, device categories (2019), CRA letters (prAA), explicit overrides |

TypeScript, not JSON: the compiler checks every requirement id an edition row names.
**Licence:** edition files and checklist texts are code in the public repository — row
labels are the standard's identifiers, everything else is paraphrased; no normative text
verbatim (also not in i18n).
Device rows of 2019 map to the same requirement ids as the prAA CRs (EDR 3.10 →
`cr-3.10`); content differences are separate ids (`cr-4.1-transit` + `cr-4.1-rest` for
2019 CR 4.1; prAA CR 4.1 = `cr-4.1-transit`, RE(1) = `cr-4.1-rest`).

**Evidence rule (declarative, D-12 … D-15).** Applicability and evidence are checked **per
element** (D-13): a target names the element types, the checks that make an element
applicable and the checks that make it satisfy the requirement. For data flows a target
can also check the element at the other end (e.g. CR 1.1: every flow from a human external
entity).

```ts
/** One property check; path and values are checked against the element
 *  property types by the conformance test (D-15). */
interface PropertyCheck {
  property: string;               // dot path, e.g. "implementedControls.debugProtection"
  in?: readonly unknown[];        // value is one of these
  notIn?: readonly unknown[];     // value is set and none of these
}                                 // neither: value is set

interface EvidenceTarget {
  elementTypes: readonly EvidenceElementType[];
  appliesIf?: readonly PropertyCheck[];     // all hold → applicable; absent = every element of the types
  endpointIf?: NeighbourCheck;              // DataFlow targets: the source or the target passes
  connectedIf?: NeighbourCheck;             // element targets: a flow connects the element to one
                                            // that passes (e.g. every Process serving human users)
  satisfiedIf?: readonly PropertyCheck[];   // any holds on the same element → satisfied
}

interface EvidenceRule {
  id: RequirementId;
  type: "A" | "B" | "C";
  appliesWhen?: readonly EvidenceTarget[];  // component-level precondition: some element in scope
                                            // applicable for one of these, else n/a (unknown if only
                                            // unknowns) — e.g. "public-key authentication is used"
                                            // while the evidence sits on another element (CR 1.9 RE(1))
  targets: readonly EvidenceTarget[];       // empty = the component as a whole (always applicable)
  quantifier?: "all" | "any";               // default "all": every applicable element satisfies;
                                            // "any" only for the ids listed below (D-22)
  checklist?: readonly string[];            // unmodelled criteria (B); paraphrased, i18n in IEC-2b
}
```

Rules are declared **`as const satisfies EvidenceRule`** (D-18) — `satisfies` alone widens
`property` to `string` — so literal paths and values stay visible to the type-level
conformance test in `src/tests` (D-15): every `elementTypes` × `property`
path exists on that element type's properties interface and every `in` / `notIn` value is
assignable to the property's type. The test may import `features/dfd`; the compliance
feature itself does not. Type C rules have no `satisfiedIf`.

**Quantifier "any" (D-22)** — allowed only for these capabilities of the component as a
whole; the completeness test fails for any other "any" rule:

| Requirement ids | Why one element suffices |
|---|---|
| `cr-1.3`, `cr-1.4`, `cr-1.5` | account, identifier and authenticator management is one function of the component (or a supporting system) |
| `cr-2.8` | the component's audit function — the event categories are the checklist |
| `cr-3.10`, `cr-3.10-re1`, `cr-3.10-re2` | the component has one update mechanism |
| `cr-3.12` | supplier roots of trust are provisioned once per component |
| `cr-5.1` | support of network segmentation is a property of the component's placement |
| `cr-6.1-re1` | one programmatic access / forwarding channel for the audit records suffices |
| `cr-6.2` | the capability to report detected issues to monitoring |
| `cr-7.3`, `cr-7.4` | backup and recovery of the component |
| `cr-7.9` | reset of the component to the supplier state |

**Edition row** additionally carries `supportingMeasuresAllowed: boolean` (D-14): true where
the requirement text lets the component meet it "directly or by supporting measures"
(prAA) / "or integrated into a system" (2019).

### 9.3 Edition selection (D-1, D-3)

`selectEdition(tags)`: `EN IEC 62443 (CRA)` → prAA edition; else `IEC 62443` → 2019
edition; else none. Pure, in the compliance feature; the tag itself is added in IEC-2b
(after the i18n split).

### 9.4 Evaluation (D-2, D-4 … D-8, D-12 … D-17, K-C1)

Input: edition, a **property view** built from the DFD analysis view
(`buildPropertyView`): the **leaves** the threat generation sees (leveled DFDs: effective
model, D-24) **plus the decomposed multiprocesses** — no leaves, but carriers of the
system properties (`updateMechanism`, `backupMechanism`, `remoteAccessEnabled`,
`systemClass`, …); without them every Multiprocess rule would be a false `n/a` in a leveled
DFD — and **every drawn flow** with its resolved endpoints, flows excluded from threat
generation included (`validationConnections`; `excludeFromThreatGen` says nothing about
who accesses the component — review 2026-10-31, reviewer), plus the elements reached only
by fallback flows — the
**component scope** (element ids of the component and its descendants — containment parent,
child pages; computed by the app), the **environment** (every other element),
statements, claims, mitigations with `iec62443` references **and the risks / threats they
are chosen for**, device categories with source.

Values that only say "not decided yet" (`not_specified`, `not_assessed`, empty
multi-select) count as unset (D-12).

**Per element of a target** (three-valued, D-12): *applicable* = `yes` / `no` / `unknown`
(a property an `appliesIf`, `endpointIf` or `connectedIf` check reads is not set, or the
element sits in a decomposed multiprocess reached only by a fallback flow, D-24); *satisfied* = `yes` /
`no` / `unknown` (a property a `satisfiedIf` check reads is not set and no other check
holds).

**Per row** — the first step that decides wins:

1. **Void** row → `n/a` (reason from the edition file).
2. **Device rows** (2019) outside the confirmed categories → `n/a`; while the category
   source is "derived", the row is `pending-category` (K-C1) and blocks the vector.
3. **Statement** for the row → its status wins; the model result is shown next to it. The
   statement stores the model result at the time it was made; a different current result
   shows "model changed — review statement" (D-17).
4. **Applicability** over the elements in scope — first the rule's `appliesWhen`
   precondition (no element applicable → `n/a`, only unknowns → `unknown`), then the
   targets: no target element `yes` and at least one
   `unknown` → **`unknown`** (D-12); every target element `no`, or no element of the target
   types in scope → `n/a` with the derived reasoning. A rule without targets is always
   applicable. *Accepted limit:* a target type that does not occur at all (e.g. no
   Interface drawn) gives `n/a` — an unfinished DFD that lacks the type cannot be told
   apart from a component without it; the reasoning names the missing type so the
   analyst sees it.
5. **Satisfaction in scope** with the rule's quantifier (D-13): `all` — every applicable
   element `yes` **and no element with applicability `unknown`** (D-19); `any` — at least
   one applicable element `yes`. Met → `met`, source `model` (type B adds the checklist).
   Elements that are `no` or `unknown` (applicability or satisfaction) are listed in the
   result. In **type A** rules a check that holds only because of the value `custom`
   counts as `unknown` (D-23); in type B rules it counts, the checklist covers it.
6. **Mitigation** with the requirement id, chosen for a risk whose threat concerns an
   element in scope (D-16) → `met`, source `mitigation`. **Achieved run** (D-21): only
   mitigations in a done status, and only where the model does not decide — the rule has
   no model evidence (type C) or the listed elements are `unknown`; if step 5 found an
   element `no`, the row stays a `gap` with the note "mitigation marked done, model shows
   not met". **Planned run:** the mitigation may overlay a model `no`.
7. **Supporting measure** — automatically **only for `any` rules** (D-20): the rule holds
   on an element of the environment but on none in scope → `met`, source
   `supporting-measure`, the environment element named (D-7). For `all` rules a
   supporting measure needs a statement naming it (step 3); deriving it along paths
   (e.g. an upstream gateway) is a later extension.
8. **Claim** covering the row → `claimed` (D-5).
9. Otherwise: any listed element `no` → `gap`, listing the `no` **and** the `unknown`
   elements (a clear finding is not hidden behind unknowns, consistent with D-19 and
   step 6); else any `unknown` → `unknown`; else type C → `needs-statement`. For **`any`
   rules** an `unknown` element might still satisfy the rule, so there `unknown` comes
   before `gap`.

**Two values per FR (D-2, D-14).** A row *counts* for a value as follows:

| Row result | SL-C (component) | SL-C with supporting measures and claims |
|---|---|---|
| `met` from `model` or `mitigation`; statement "met" without supporting measure | ✓ | ✓ |
| `met` from `supporting-measure`; statement "met" naming a supporting measure | only if the row has `supportingMeasuresAllowed` | ✓ |
| `claimed` | — | ✓ |
| `n/a` | ✓ | ✓ |
| `unknown`, `pending-category`, `needs-statement`, `gap` | — | — |

`value(FR)` = highest n in 0…4 such that every row of FR with lowest SL-C ≤ n counts.
The evaluator runs twice (D-4): **achieved** on the IS properties with mitigations in a
done status (`DONE_MITIGATION_STATUSES`), **planned** on the IS properties overlaid with
the SHOULD values of the existing `ControlInstance` derivation and all chosen mitigations —
four numbers per FR, the report states *achieved (component)* as the SL-C.

### 9.5 Tests

- **Completeness per edition (D-11):** every row has an evidence rule or is void; every
  requirement id resolves; type C rules have no `satisfiedIf`; no silent fallback; quantifier
  "any" only for the ids of D-22.
- **Conformance (D-15, D-18):** type-level test in `src/tests` — every path and value against
  the element property types; compiled by `tsc` in `npm run build`. Includes negative
  cases (`@ts-expect-error`): a non-existent literal path or value is rejected, and so is a
  value list on a property typed as plain `string` (it could not be checked). The first run
  found two real defects: `authenticatorStorage` names its software-only value per element
  type (`system_software` on a Multiprocess), and `IntegrityProtection` was plain `string`
  (`INTEGRITY_PROTECTION_OPTIONS` lacked `as const`) — both fixed with IEC-2a.
- **Row lists:** SL-C and rows reproduce §4 here and §3 of the classic document (counts).
- **Evaluator (IEC-3)** on small graphs:
  - `unknown` vs `n/a`: unset property → `unknown`; all set, none matching → `n/a`;
    an unfinished model never reaches a higher value than the complete one (D-12);
  - quantifier: one of several applicable flows unauthenticated → `gap` naming it;
    `any` rules met by one element (D-13);
  - two values: supporting measure on a row with and without `supportingMeasuresAllowed`;
    a claim raises only the second value (D-14);
  - mitigation in scope vs. for a risk of another component (D-16);
  - statement override and "model changed" after an edit (D-17);
  - device category pending / changed, statements on dropped device rows kept as n/a
    (K-C1);
  - vector rule: one non-counting row caps the FR at the level below its lowest SL-C;
  - `all` rule: an element with applicability `unknown` prevents `met` (D-19);
  - one element `no` and one `unknown` → `gap` naming both (step 9);
  - `custom` in a type A rule → `unknown`, in a type B rule → `met` with checklist (D-23);
  - neighbours (D-24): an actor flow with an interface on the line → the process is the
    neighbour; actor on the parent page → leaf process on the child page is the neighbour
    (CR 2.5 applies there); a fallback flow at a decomposed multiprocess → `unknown` for its
    contained processes;
  - **smoke test in IEC-3** on `src/tests/fixtures/leveled/smoke-detector-leveled.json`
    (derived from the seminar example): no row of CR 2.5–2.7 / 2.12 is `n/a` for a process
    that serves a human actor — done: the maintenance technician on Top is the neighbour of
    the leaf process "Controller Communication Handler"; the decomposed multiprocesses stay
    in the view, so CR 3.10 is not a false `n/a`;
  - a flow excluded from threat generation still counts as neighbour relation.
  - supporting measure on an `all` rule only via a statement naming it; automatic on an
    `any` rule (D-20);
  - achieved run: a done mitigation against a model `no` → `gap` with the contradiction
    note; planned run: overlay → `met` (D-21).

### 9.6 Steps

| Step | Content | Branch | Depends on | Status |
|---|---|---|---|---|
| IEC-2a | types, evidence rules, both edition files, completeness test, conformance test — no UI, no i18n | `feature/iec62443-cra-matrix` | — | done (patches 264, 266: D-22 quantifiers, `connectedIf`) |
| IEC-3 | evaluator, edition selection, vectors, property view, evaluator tests, smoke test | same | IEC-2a | done (patch 269) |
| IEC-2b | regulation tag `EN IEC 62443 (CRA)`, checklist / reasoning i18n keys | same | B's i18n split | open |
