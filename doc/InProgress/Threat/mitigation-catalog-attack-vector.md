# Mitigation catalog: attack vector and missing controls

**Status:** design agreed 2026-10-25, implementation in progress (§6)
**Scope:** threats / attack trees / risks (all presets)
**Trigger:** Headlamp example (ISO/SAE 21434). The attack-path risks get
controls that do not fit the path: a *Physical Access* path for availability is
offered rate limiting, quotas and load balancing. Typical network and operating
system controls are also missing from the catalog — firewall rules,
restricting ports, RBAC / ABAC, Linux hardening.

---

## 1. Findings

**F-A — Controls are selected without the attack vector.**
`buildAttackPathThreatReferences` (`app/utils/build-attack-path-threat-references.ts`,
`enrichWithCategoryControls`) tops up an attack-path threat with the **first
four** catalog controls of the same STRIDE letter. It never considers how the
path attacks. All 10 Headlamp risks therefore get `M-D-001 … M-D-004` or the
equivalent for their letter.

**F-B — The control context is ignored.**
Catalog controls carry a `context` (`TemplateContext`: `platform`, `domain`,
`regulation`, …), but neither the attack-path top-up nor the generic element
fallback (`element-generator.ts`, `GENERIC_CATEGORY_CONTROL_CAP`) applies
`matchesContext` to controls. The seven `platform: Embedded` controls are
offered to cloud projects too.

**F-C — Gaps in the catalog** (116 controls). The catalog has nothing on:
- inbound and outbound firewall rules, or restricting ports and services;
- ABAC (RBAC appears only together with ACLs, in `M-E-002` and `M-I-003`);
- operating-system hardening (MAC, seccomp, read-only root, SSH, a hardening
  baseline);
- in-vehicle controls (SecOC, gateway routing, CAN IDS, authenticated
  diagnostics);
- vulnerability and patch management (`M-E-004` "Regular security reviews and
  updates" is too vague).

## 2. Decisions

**D1 — Attack vector as an explicit DSL attribute** (user, 2026-10-25).
`av=network|adjacent|local|physical` — the four attack vectors of ISO/SAE 21434
G.9. The attribute is optional and allowed on every node. It applies to the
node's subtree, and a node below may override it. A path's vector is the one
closest to its leaf on the chain. Guessing the vector from node names was
rejected as unreliable.

```text
Lamp request spoofed;ROOT @manipulation
	Via OBD-II port;AND av=physical
		Gain access to the vehicle interior;et=1d,se=layman,kn=public,wo=easy,eq=standard
		Inject frames through the diagnostic gateway;et=1w,se=proficient,kn=restricted,wo=easy,eq=specialized
	Via cellular link;AND av=network
		…
```

The vector is stored on the node (`AttackTreeNode.attackVector`) and on the
path (`AttackPath.attackVector`). It does not enter the attack potential or the
feasibility: G.2 rates the path, and G.9 is a different rating method that is
only borrowed here for its vector vocabulary.

**D2 — Controls carry the vectors they address.** The catalog field
`attackVectors?: AttackVector[]` is optional; when absent, the control fits
every vector.

**D3 — Vector-aware top-up.** Attack-path threats are topped up from the
controls with the same STRIDE letter whose `attackVectors` contain the path's
vector or are absent. Controls with a matching vector come before generic ones;
within a group, catalog order applies. A path without `av` behaves exactly as
today, so existing projects are unchanged.

**D4 — Context applies to controls.** Both top-ups (attack path and generic
element fallback) apply `matchesContext` to the control's `context` with the
project tags. The existing `TemplateContext.domain` key is used; its
`@deprecated` note is replaced by "project-level domain gate (e.g. Automotive)".
- **Domain-independent:** network, access-control, Linux and operations
  controls get `context: {}` (user: Linux runs everywhere).
- **Automotive:** only the in-vehicle controls get `domain: ["Automotive"]`.

**D5 — Existing controls are mapped to vectors.**

| Controls | `attackVectors` |
|---|---|
| `M-PB-*`, `M-CB-*`, `M-IF-T-*`, `M-IF-D-001`, `M-IF-I-002`, `M-T-008`, `M-T-009`, `M-T-015`, `M-D-007` | `physical` |
| `M-IF-DBG-*`, `M-IF-E-*`, `M-E-006`, `M-IF-POLICY-*` | `physical`, `local` |
| `M-D-001` … `M-D-005`, `M-D-012`, `M-S-005`, `M-S-007`, `M-I-002`, `M-T-005` | `network`, `adjacent` |
| signatures, integrity, least privilege, logging, input validation, … | none (all vectors) |

The exact list is fixed in the implementation patch and covered by a test
(every control is either mapped or deliberately vector-free).

## 3. New controls

Each new control gets a verification (`V-…`) and en/de texts.

| ID | STRIDE | Vectors | Context | Control |
|---|---|---|---|---|
| M-NET-001 | E | network, adjacent | – | Inbound firewall with default deny: only explicitly needed ports / peers are reachable |
| M-NET-002 | I | network, adjacent | – | Outbound (egress) filtering: only the required destinations and protocols are allowed |
| M-NET-003 | E | network, adjacent, local | – | Disable unused ports, services and protocols; minimal attack surface per build |
| M-NET-004 | E | network, adjacent | – | Bind services to internal interfaces only; no management service on external interfaces |
| M-AC-001 | E | – | – | Role-based access control (RBAC) with defined roles and least-privileged role assignment |
| M-AC-002 | E | – | – | Attribute-based access control (ABAC): decisions use attributes such as operating state, location, time or vehicle speed |
| M-AC-003 | E | local | – | Run each service under its own unprivileged account; no root, capabilities dropped |
| M-OS-001 | E | local, network | – | Mandatory access control (SELinux / AppArmor) in enforcing mode with a profile per service |
| M-OS-002 | E | local, network | – | seccomp system-call filters for exposed services |
| M-OS-003 | T | local, physical | – | Read-only, integrity-verified root file system (e.g. dm-verity) |
| M-OS-004 | E | local | – | Kernel hardening: no unused modules, lockdown mode, hardened sysctl settings |
| M-OS-005 | S | network, adjacent | – | Remote shell access only by key, no root login, disabled in production builds |
| M-OS-006 | E | – | – | Hardening baseline (e.g. CIS benchmark) applied and checked automatically per release |
| M-VEH-001 | S | adjacent, physical | Automotive | Authenticate in-vehicle messages with freshness (AUTOSAR SecOC) |
| M-VEH-002 | T | adjacent, physical | Automotive | Gateway routing whitelist and message filtering between vehicle domains |
| M-VEH-003 | T | adjacent, physical | Automotive | Intrusion detection on in-vehicle networks (CAN IDS) with reporting to the backend |
| M-VEH-004 | S | physical | Automotive | Diagnostic access only after authentication (UDS 0x27 / 0x29) and only in a safe vehicle state (e.g. standstill) |
| M-VEH-005 | S | adjacent | Automotive | Bluetooth hardening: Secure Connections pairing only, unused profiles disabled, pairing only on user action |
| M-OPS-001 | E | – | – | Vulnerability monitoring and patch management for all third-party and OS components (SBOM-based) |
| M-OPS-002 | T | network | – | Signed over-the-air updates with anti-rollback (monotonic version counter) |

## 4. Implementation steps

1. **Parser and model** (attack tree): parse the `av=` attribute (case-insensitive,
   aliases `net`, `adj`, `loc`, `phys`; on a leaf also after the factors,
   `…,eq=standard,av=physical`); add `AttackTreeNode.attackVector` and
   inherit it down the chain into `AttackPath.attackVector`. An unknown value
   gives a parser warning and is ignored. Golden test: the attack potential is
   unchanged.
2. **Catalog:** add the `attackVectors` field and the D5 mapping; add the new
   controls and verifications with en/de texts; update the `domain` doc comment.
3. **Selection:** vector-aware top-up (D3) and the context filter (D4) in both
   top-ups. Tests cover: the physical path gets physical controls, a path
   without `av` is unchanged, an Automotive control is not offered outside the
   Automotive domain, and an Embedded control is not offered to a cloud project.
4. **Headlamp example** (separate file for the examples repository):
   - realistic trees along the DFD — cellular / Bluetooth → navigation ECU →
     gateway → CAN → body control ECU, OBD-II, physical bus access, firmware
     reflash — with `av=`;
   - risks regenerated, then controls selected and residual ratings set;
   - cybersecurity goals and claims follow with Phase 4 of the ISO 21434 plan.

## 5. Not in scope

- Selecting controls by the attack vector for STRIDE element threats (they
  have the element type and its catalog family already).
- A G.9 attack-vector-based feasibility rating — the vector is used only to
  pick controls.

## 6. Implementation status

| Step | Content | Patch | State |
|---|---|---|---|
| 1 | `av=` parsed on every node (aliases, case-insensitive, comma form on leaves; unknown value → parser warning `unknownAttackVector`, ignored); `AttackVector` type in `shared/models/attack-vector.ts`; `AttackTreeNode.attackVector`, `AttackPath.attackVector` (closest to the leaf wins); editor highlighting; a changed `av=` counts as a stale ast (F7); the report's tree structure shows the vector next to the gate ("(OR · physical)"). Attack potential, feasibility and path keys unchanged (golden test). | 148 | done |
| 2 | Catalog: `attackVectors`, D5 mapping, new controls and verifications, en/de | – | open |
| 3 | Selection: vector-aware top-up (D3), context filter (D4) | – | open |
| 4 | Headlamp example | – | open |
