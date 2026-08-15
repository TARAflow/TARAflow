# Audit-Tab Rework — Design & Foundations

**Status:** Draft / discussion basis (rev. 4)
**Date:** 2026-07-28
**Context:** TARAflow, audit/version-control feature (Electron, renderer↔main via IPC, `simple-git` + Keytar)
**Companion specs:** `TCS-v1.md` (canonical serialization), `AVE-v1.md` (verification engine)
**Goal:** Make the audit tab produce an audit trail that holds up *in practice* — a **defensible evidence artifact** for IEC 62443 / ISO 21434 / CRA, not just a convenient Git wrapper.

---

## 0. The pipeline at a glance

Everything below serves one flow. If you read nothing else, read this:

```
        Project state (in app)
                 │
                 ▼
     Canonical Serializer  (TCS v1) ── deterministic, diffable *.tara.json
                 │
                 ▼
          Git commit  ── structured message from DiffService (§4)
                 │
                 ▼
        Signed commit  (§5.B) ── cryptographic identity, signer ∈ authorized set
                 │
                 ▼
   Protected repository  (§5.C) ── no force-push / no rewrite; four-eyes on merge
                 │
                 ▼
   Audit Verification Engine  (§5.D) ── re-checks the whole chain, emits findings
                 │
                 ▼
   Audit Report Generator  (§5.E) ── renders findings + history into a report
                 │
                 ▼
        Evidence for the auditor  (§10 compliance mapping)
```

The four architectural pillars are **A deterministic artifacts · B cryptographic identity · C history integrity · D verification**. Git hooks (§7) are *one implementation detail of pillar C*, nothing more.

**Layering (important):** the verification logic is a **standalone engine**, not a tab feature. The GUI, the hooks, a CI server, and an auditor all call the *same* engine:

```
TARAflow
├── Audit UI (tab)              ── presents state, triggers actions
├── Git Integration             ── simple-git wrappers (main process)
├── Audit Verification Engine   ── the shared core (§5.D)
├── Audit Report Generator      ── renders engine output → report (§5.E)
└── CLI  (taraflow verify / taraflow audit-report)
```

---

## 1. Why bother? — What an auditor wants to see

A Git repo full of commits is not yet an audit trail. "Auditable" means an independent third party can determine — **after the fact and without trusting us**:

1. **What** changed (semantically, not just "JSON changed").
2. **When**, and in which **review round** (round/stage).
3. **Who** did it — cryptographically proven, not just a freely chosen `author.name`.
4. **Who reviewed it** (four-eyes / `Reviewed-by`), where the process requires it.
5. That the history was **not tampered with afterwards** (no force-push, no rebase/amend, no gaps).
6. That the committed artifact is **deterministically derivable from the project**, and therefore reproducible and diffable.

The current implementation covers (1) well via `DiffService` and (2) well via round names. The gap is (3)–(6) — and that gap decides whether the trail survives an audit.

---

## 2. Why trust arises — threat model, trust model, scope

This chapter is **conceptual**: what the trail can and cannot claim, and where trust comes from. The technical realization is §5.

### 2.1 Threat model

**The audit trail protects against:**
- accidental modification of recorded analysis state;
- later repudiation ("I never assessed that risk that way");
- unnoticed history manipulation (silent rewrite, force-push, amend);
- incomplete or undocumented review.

**It does *not* protect against:**
- an administrator on the Git server with direct object-store access;
- a compromised or stolen signing key (until it is revoked);
- a malicious local user *before* push (local hooks are guardrails, not enforcement — see §7);
- operating-system or supply-chain compromise of the machine producing the commits.

The honest framing: the trail makes tampering **evident and attributable**, not **impossible**. That is exactly the property IEC 62443 / ISO 21434 evidence requires.

### 2.2 Trust model — where authority comes from

Cryptographic identity is worthless without a governed answer to "whose signatures count."

- The set of authorized signers lives in a **version-controlled manifest** in the repo (`.tara/allowed_signers` for SSH signing, or a committed keyring manifest for GPG). Because it is committed, *onboarding or revoking a signer is itself an audited event* with its own signed commit.
- **Verification is local and offline.** Git checks a signature against the *committed* manifest (`gpg.ssh.allowedSignersFile` → `.tara/allowed_signers`); the git **server is never consulted**. A public key uploaded to a hosting provider only produces that provider's cosmetic "Verified" badge and is irrelevant to verification. Two distinct questions must not be conflated: *"is the signature cryptographically valid?"* (answered by `git --show-signature`) and *"is this signer authorized at all?"* (answered by the manifest). Only `%G?` == `G` satisfies both. Consequence: the trail is verifiable independently of any host.
- **Authority is anchored to position in the immutable history, never to a timestamp.** A commit is trusted if it is signed by a key that the history *preceding it* had already authorized. Commit timestamps are attacker-controlled and carry no trust; the signed, append-only chain does. (The mechanics of reconstructing "what was authorized before this commit" are in §5.D.)
- **Root of trust / bootstrap:** the initial trust anchor is created **manually during repository initialization** and recorded as part of the repository metadata. It is the single defined special case — there is no prior signed commit to authorize it. After it, the normal chain applies. It is **self-anchoring**: the first commit that adds the manifest is signed by a key that same manifest authorizes. Four mechanisms combine (§5.C): the self-anchoring commit; **out-of-band pinning of its hash** in the verifier policy; an optional signed `audit-root` tag as a convenient in-repo pointer; and remote branch/tag protection. **The hash is the root of trust, not the tag** — a tag is movable and therefore convenience only, which is why the app additionally checks that it still points at the real anchor.
- **Governance role — maintainers own the manifest.** Only a signer carrying `role="maintainer"` may change it (format and enforcement: §5.B, §5.D). "Maintainer" is **not** "whoever created the repository": TARAflow *discovers* repositories and never creates them, so it cannot know the creator. Maintainer is solely whoever bears the marking in the manifest; the UI displays this as a derived read-only field. Three invariants keep the trail usable: the **first** signer of an empty manifest is necessarily a maintainer (otherwise the manifest could never legitimately change); the **last signer** cannot be removed (the trail would be locked out); and the **last maintainer** can be neither removed nor demoted. The last invariant makes handover fall out by itself — add the new maintainer first, then remove the old one — so ≥2 maintainers is the natural steady state rather than a mere recommendation.
- **The manifest cannot be protected locally.** Anyone with a clone can edit `.tara/allowed_signers`, add themselves and commit. That is not preventable — only *undetectable* modification is. Two layers answer it: **prevention** on the server (path-based review such as CODEOWNERS on `.tara/`, plus branch protection — §5.C) and **detection** at verification time (§5.D rejects any manifest commit not signed by a then-authorized maintainer). The guiding sentence is therefore *not* "make it immutable" but **"make it impossible to change unnoticed."**
- **Personnel change / revocation** is a *concept* here: removing a signer never invalidates their honest past commits (those keep the position-in-history they always had); it only removes authority going forward. The implementation is §5.B.

### 2.3 Scope statement (non-goals)

> The audit repository is intended as **evidence of engineering activities**, not as a replacement for configuration management or source control of the product. **Backup, retention, and disaster recovery are intentionally outside the scope of this design** and remain the organization's responsibility. §8 states only what the design must not make *impossible*.

---

## 3. Current state (as-is)

| Building block | Status today | Assessment for auditability |
|---|---|---|
| Semantic change detection | `DiffService` compares per-phase snapshots, builds a structured message | Good. This is the real strength. |
| Commit-message format | `generateCommitMessage()` → `[TARA] <round>` + phases/batch/author | Good, but non-binding (nothing enforces it). |
| Round/stage names | `DEFAULT_ROUND_NAMES` + custom, auto-increment | Good. |
| Author identity | `AuditConfig.author.{name,email}`, freely editable | **Weak** — no cryptographic tie to an identity. |
| GPG signing | `GPGConfig` exists, key in Keytar, `signCommit` in `CommitOptions` | **Not wired** into the commit path. Config with no effect. |
| Reviewer / four-eyes | `CommitOptions.reviewer` optional, ends up in the message | **Not enforced**, no reviewer≠author rule, no reviewer signature. |
| History protection | none (force-push/amend/rebase all possible) | **Missing.** The single most important tampering vector. |
| Deterministic serialization | `prepareForDisk` exists; `pathKey` = content hash | Good basis, but no **defined** canonical form (→ TCS v1). |
| Human-readable commit artifact | only the commit message | Otherwise the auditor sees only a JSON diff. |
| Verification tooling | none | **Missing.** There is no "verify the whole trail". |

**Core finding:** we have a very good *description* of the change (diff + message), but no *safeguarding* of that description (identity, history integrity, verification). The rework closes that second half.

---

## 4. Semantic change detection (already strong — keep)

`DiffService` produces the per-phase, per-item change set that becomes the commit message via `generateCommitMessage()`. This stays the source of the **What**. Two additions:

- feed the same structured data into the optional human-readable snapshot (§5.A);
- expose the generated message as a template the hooks can prefill (§7).

---

## 5. How we realize it — the four pillars

### 5.A — Deterministic, diffable artifact

Serialized according to **TCS v1** (see companion spec `TCS-v1.md`). In short: UTF-8/no-BOM, LF, 2-space pretty-print, code-point-sorted keys, defined per-collection array order, deterministic numbers, minimal escaping. The reproducibility identity `serializeTCS(load(x)) === x` is what the Verification Engine (§5.D) checks.

Implementation lives in the single existing serialization path (`prepare-for-disk.ts`). Add the companion `.gitattributes`.

Optionally, alongside the JSON, a **human-readable snapshot** per commit (`audit/<round>.md`/`.adoc`) generated by the CLI reporter, so `git log -p` shows *meaning*, not JSON.

### 5.B — Cryptographic provenance (the signing mechanics)

- **Signed commits mandatory** on audit branches. Support **both** formats via a config flag:
  - **SSH signing** (git ≥ 2.34, `gpg.format=ssh`, `commit -S`) — **decided default** (§11.1); lower setup hurdle, reuses existing SSH keys, same Keytar path logic as `sshKeyPath`.
  - **GPG** (`GPGConfig` already exists) — wire up `commit -S`, key from Keytar.
- **Use a dedicated signing key**, not the hosting provider's login key — separating access (push) from attestation (signature). The app sets `user.signingkey` explicitly from the configured path into the **local** repo config, which outranks any global setting. Beware **manual shell commits**: they bypass the app and pick up the global configuration instead; that is exactly how a bootstrap can end up signed by the wrong key, producing `Good signature … No principal matched` — cryptographically valid but *not authorized*.
- **Manifest format.** Entries are OpenSSH `allowed_signers` lines; options are comma-separated:

  ```
  alice@example.com namespaces="git",role="maintainer" ssh-ed25519 AAAA… alice
  bob@example.com   namespaces="git"                   ssh-ed25519 BBBB… bob
  ```

  `namespaces="git"` is **mandatory** — without it git will not verify a commit signature against the entry. Only `role="maintainer"` is ever written; its absence means an ordinary signer, which keeps the format backward compatible. Serialization is byte-stable (sorted, LF, single trailing newline) so a manifest commit shows the real change and no reordering noise.
- **`author.email` must be authorized by the manifest.** Checked *before* committing, and **blocking whenever signing is enabled**: the commit is refused unless `author.email` appears as the principal of **some** manifest entry. Team-capable by construction — any enrolled signer passes, not just an owner. Rationale: if the user asked for a signature, a commit that would later fail verification is a silent failure of their own intent, not a judgement call. What is deliberately *not* checked here is whether the locally active key is precisely the one bound to that principal — that requires reading the key from disk and is caught at verification time anyway (§5.D). This guard is an early warning, not enforcement.
- **Key rotation / revocation (implementation):** the manifest is a tracked file; adding a key is a signed commit by a maintainer, removing one likewise. Past commits are unaffected — their trust derives from their position in history (§2.2), verified in §5.D. The last-maintainer invariant (§2.2) is what makes rotation safe: a maintainer's key can always be rotated by a co-maintainer's signed commit.

### 5.C — History integrity (non-tamperable)

Two lines of defense, because local guardrails are not enforcement:

1. **Local guardrail (against mistakes, immediate feedback):** provisioned hooks (§7).
2. **Server-side enforcement (the real control):** remote branch protection.

**Branch model** (**decided**, §11.2):
- A single protected **`audit`** branch is the trail. Each round is a **distinct signed commit** on it.
- **No rebase, no squash on `audit`** — squashing destroys per-round granularity, which is exactly the evidence. Amend forbidden after push.
- Work happens on **round branches** (`risk-round-N`, already the template) → reviewed via PR/MR → merged. Merge policy is **fast-forward only**: history stays linear, and merge commits count as a violation (locally detectable via `git log --merges`).
- Protected-branch rules apply to `audit` (and `main`/`master` if used): required signed commits, required review, no force-push, no deletion.
- **Commits are path-scoped.** `git add <relpath>` **and** `git commit -- <relpath>`: a plain `git commit` writes the whole index, so scoping the staging alone would still sweep in unrelated pre-staged files. Infra commits (manifest, `.gitattributes`, hooks) share the `audit:` message category and are scoped the same way, which keeps them cleanly distinct from `[TARA] <round>` commits.

**Server-side** setup depends on the host. The division of labour is deliberate: **prove locally what git can prove, guide for what only the server can enforce** — and never claim to have checked a server policy we cannot see.

*Locally provable → concrete warning* (evaluated over `anchor..HEAD`): every commit signed **and** authorized (`%G?` == `G`); linear history (no merge commits); the `audit-root` tag present and pointing at the anchor.

*Only enforceable server-side → generated guidance:* block force-push, require signed commits, restrict who may push, tag protection, and **path-based review on `.tara/`** (CODEOWNERS or the host's equivalent) so only maintainers can change the signer manifest (§2.2).

- **GitHub / GitLab / Bitbucket / Azure:** the app **generates a checklist** naming each setting in that host's own vocabulary, with a deep link to the right settings page. The app deliberately does **not** configure these APIs automatically (**decided**, §11.6) — that would require an admin token per host, multiplying credential handling and forfeiting offline verifiability. The checklist also carries the **out-of-band anchor hash**, so pinning it in the verifier policy is a copy, not a research task. A later opt-in API status check ("verified at host") remains possible as a separate addition; it does not replace this split.
- **Self-hosted / generic bare repo:** ship a `pre-receive` sample (§7).

### 5.D — Audit Verification Engine

Specified separately in **`AVE-v1.md`** (inputs, outputs, algorithm, findings, exit codes, CLI) — it is now substantial enough to warrant its own document, and moving it there keeps this a *security-model* paper rather than an implementation manual. The essentials:

- It is a **standalone engine** (see §0 layering) used by the GUI, the CLI (`taraflow verify`), CI, and auditors. Hooks may *invoke* it but never *contain* the audit logic (§7).
- **It reconstructs authority from history, not from timestamps.** Each commit is checked against **the signer manifest effective immediately before it** — established by its ancestry, not by anything the commit itself could have edited. A manifest-changing commit must be signed by a signer authorized *before* it; verification proceeds inductively from the bootstrap root (§2.2). The **root commit has no predecessor — that is the single special case**, and its manifest is the bootstrap anchor. (The exact plumbing is the engine's choice; the property is what matters.)
- Its output is a green/red **findings** list that doubles as the input to the Audit Report Generator (§5.E). The full check catalogue — signatures, message schema, reviewer≠author, linear history / no orphans, clean tree / no detached HEAD, TCS byte-reproducibility, hooks version, protection attestation, round monotonicity — lives in `AVE-v1.md`.
- **Performance:** the engine may cache intermediate verification state, provided caching **never changes the verification result**. This lets a 15-year / 12k-commit / 200 MB repo verify incrementally instead of re-walking the whole history each run.

### 5.E — Audit Report Generator

Distinct from the existing content reporter. Two different reports:

- **`taraflow-report`** (exists, v0.6.0-alpha) reports the *TARA content* — risks, trees, mitigations. It answers "what does the analysis say?"
- **Audit Report Generator** (new) reports the *trail* — who committed what, in which round, verified how. It answers "can we trust the record, and here is the evidence." It consumes the **Verification Engine** output (§5.D) plus git history and renders: the commit timeline per round, signer identities and verification status, four-eyes evidence, the findings list (green/red), and the §10 compliance mapping filled in with concrete commits.

It is a **rendering layer over the engine**, not a second analysis. It reuses the reporter's existing output plumbing (MD / AsciiDoc / HTML / PDF / StrictDoc), so a signed PDF "Audit Trail Report as of commit X" drops out of the same infrastructure. Naturally the **last** layer — it has nothing to render until the engine exists.

---

## 6. Review process & four-eyes

- **`Reviewed-by: Name <mail>`** trailer (RFC-conform, `git interpret-trailers`) records the reviewer.
- **Reviewer ≠ author** is enforced: a change may not be reviewed by its author. This is the substance of four-eyes, checked by both the merge policy (approval by a different identity) and the Verification Engine.
- **Can the reviewer edit?** Policy decision (§11): either the reviewer only approves (edits go back to the author for a new signed commit — cleaner provenance), or the reviewer may commit fixes but then a *third* party approves. Recommendation: reviewer approves only.
- **Reviewer signature** (later stage): for genuine four-eyes *evidence* rather than a self-declared trailer, capture the reviewer's approval as a signed tag or `git notes` entry. Deferred deliberately — the hard part is organizational (who signs, when relative to merge, on what object), not technical.

---

## 7. Implementation detail: Git hooks (one realization of pillar C)

Hooks are *not* the architecture; they are the local guardrail for §5.C, plus one server-side sample. **Kept deliberately thin** — they check message, signing, and files only. **The full audit lives exclusively in the Verification Engine (§5.D)**; a hook may *invoke* the engine but must not reimplement it.

Dependency-free (POSIX `sh` + Git plumbing) so they run even for an auditor with bare git. Provisioned via a **versioned** directory so the guardrails are themselves part of the signed history and reproduce on a fresh clone:

```
core.hooksPath = .tara/hooks
```

| Hook | Purpose (thin) |
|---|---|
| `commit-msg` | Enforce `[TARA] <round>` header + required trailers. |
| `pre-commit` | Exactly one `*.tara.json` staged & parses; signing configured when required. **Format enforcement:** if the engine/CLI is present, delegate a fast single-file TCS-conformance check (`taraflow verify --staged --tcs-only`) so a non-canonical file cannot enter — the hook *enforces* the format but does not *contain* the TCS logic (the engine owns it). If the CLI is absent, the engine catches it on the next full verify / server-side. |
| `pre-push` | Block force-push; block direct push to a protected branch; `git verify-commit` per commit; optionally call the engine for the deep check. |
| `prepare-commit-msg` | (Comfort) prefill the DiffService-generated message. |
| `pre-receive` (server sample) | Self-hosted/generic remotes: reject unsigned / non-fast-forward. On hosted remotes use branch protection. |

App integration mirrors the existing pattern: main-process `AuditHooksService` (install/status/uninstall, sets `core.hooksPath` + policy flags), `window.auditHooks` over IPC, `AuditHooksServiceRenderer` in the renderer, and a "Secure the audit repo" section in the tab with the **threat-model note** and the server-side checklist visible.

Concrete starter files are delivered separately (`taraflow-audit-hooks/`).

---

## 8. Recovery (availability is out of scope — §2.3)

Backup and disaster recovery are the organization's responsibility. The design's only obligation is to **not make recovery impossible**:

- **Local repo lost / corrupted:** re-clone from the protected remote (the authoritative copy).
- **Remote unreachable:** commit locally — the trail continues; push when reachable. Evidence rides on the signed history, not on push timing, so a delayed push creates no gap.
- **Audit repo accidentally deleted:** protected-branch no-delete prevents the remote copy going first; restore from the organization's mirror/backup.
- **Signing key lost:** past commits stay valid (§5.B). Issue a new key, authorize it via a signed manifest commit from another maintainer, record the rotation.

---

## 9. Long-term validity (flagged, not solved)

Digital signatures age: algorithms are deprecated, keys expire. Over a 10-year horizon "is this signature still valid?" arises. Not required now, but named:

- an **expired key does not invalidate a signature made while it was valid** — provided the *existence in history* is provable, which the append-only chain already gives;
- options, if it becomes a requirement: periodic **re-attestation** (a maintainer signs "state as of commit X verified" with a current key), or **RFC 3161 trusted timestamping** of key commits/tags.

---

## 10. Compliance mapping (mechanism → evidence)

An auditor should read **requirement → mechanism** at a glance. Two honesty caveats, deliberately kept:

1. A mechanism **provides evidence toward** a requirement; it does not by itself constitute compliance.
2. Exact clause numbers are **left for Juergen to pin against the normative text** — mapping is by concept to avoid fabricating precise references.

| Mechanism (this design) | Provides evidence for | Norm area — clause TBC |
|---|---|---|
| Signed commits (§5.B) | Integrity & authenticity of records; attributability | IEC 62443-4-1 (development process / change control); ISO 21434 cybersecurity management; CRA due diligence |
| Commit metadata + `DiffService` (§4) | Traceability of changes to analysis work products | ISO 21434 work-product management; IEC 62443-4-1 traceability |
| Git history, protected (§5.C) | Complete, tamper-evident change history | IEC 62443-4-1 config/change management; ISO 21434 change management |
| `Reviewed-by`, reviewer ≠ author (§6) | Independent review / four-eyes | IEC 62443-4-1 review practices; ISO 21434 verification/review |
| TCS canonical serialization (§5.A) | Reproducibility of the recorded state | ISO 21434 work-product identification; general evidence integrity |
| Audit Verification Engine (§5.D) | Demonstrable, repeatable verification of the trail | Audit evidence generation across all three |
| Authorized-signer manifest + rotation (§2.2, §5.B) | Governed identity, revocation, personnel change | IEC 62443-4-1 / ISO 21434 cybersecurity management |
| Threat/scope statement (§2) | Honest boundary of evidential value | Auditor confidence (meta) |

---

## 11. Open decisions

### Decided (Phases 2-3)
1. **Signing default: SSH.** Lower setup hurdle; GPG stays supported via the config flag. Use a **dedicated** signing key, not the hosting login key (§5.B).
2. **Branch model (§5.C): fast-forward only.** History stays linear; merge commits are a violation and locally detectable.
3. **Canonical serialization / TCS rollout:** shipped with Phase 1-2. See `TCS-v1.md` §"On-disk reduction" for the fields excluded from the canonical form (the churn fix) — that reduction is what makes "same state → same commit" actually hold.
6. **Server-side: checklist only, no host APIs.** Automatic configuration would need an admin token per host and would forfeit offline verifiability. The generated checklist names each setting in the host's vocabulary and carries the anchor hash (§5.C).

Further Phase-3 decisions recorded in place: metadata directory `.tara/` (§5.C, `TCS-v1.md`); bootstrap anchor as a **combination** of self-anchoring commit + out-of-band hash pinning + optional `audit-root` tag + remote protection (§2.2); **maintainer role** governing manifest changes, with the first-signer / last-signer / last-maintainer invariants (§2.2); `author.email` ∈ manifest principals, **blocking** when signing is enabled (§5.B); manifest protection as **prevention at the server + detection at verification**, not local immutability (§2.2, §5.D).

### Still open
4. **Versioned `core.hooksPath`** (`.tara/hooks`, my proposal) vs. classic `.git/hooks`.
5. **Human-readable snapshot per commit** (`audit/<round>.md` via reporter) — costs a reporter call in the commit path.
7. **Four-eyes depth:** trailer only, or reviewer signature (§6)? And: reviewer approves-only vs. reviewer-may-edit?
8. **Compliance mapping (§10):** which exact clauses to anchor, for which target norm(s) first?
9. **Strict key↔principal binding:** today the pre-commit guard checks the *email* against the manifest (§5.B). A strict check that the locally active key is exactly the one bound to that principal needs pubkey reading; verification catches the mismatch regardless (§5.D). Worth it?
10. **Remote/push finish** — deferred out of Phase 3, folds into Phase 4.

---

## 12. Proposed sequence — and *how* to phase it

### The organizing principle: write-time vs. read-time

Split the work by **when a property is fixed**, because that decides what may be deferred safely:

- **Write-time properties** are baked into each commit and **cannot be fixed later without rewriting history** — which the trail forbids. These are: TCS canonical bytes (5.A), the signature (5.B), and the message schema (§4/§6). **They must be correct from the first *real* commit.**
- **Read-time properties** inspect existing history and can be added **at any time**: the Verification Engine (5.D), the Report Generator (5.E), the branch-protection checklist (5.C), and most hooks (§7).

**Consequence for the "wrapper first?" question:** do **not** ship a naive git wrapper that commits without the write-time properties. It works mechanically, but every commit it produces is history you will later have to disown (non-canonical bytes can't be reproduced; unsigned commits can't be signed after the fact). A working wrapper already exists in the codebase — re-treading it adds nothing and manufactures a tainted trail.

### Recommended: a "walking skeleton", not a horizontal wrapper

Build the thinnest **vertical** slice that is already **audit-correct from commit one**, then thicken it. Each phase ships standalone value.

| Phase | Deliverable | Class |
|---|---|---|
| **1. TCS foundation** | TCS v1 in `prepare-for-disk.ts` + `.gitattributes`. (Reviewer-rated easy; full control in own code.) | write-time |
| **2. Walking skeleton** | TCS serialize → **signed** commit (SSH default) with the existing `DiffService` message → local `audit` branch. Smallest end-to-end path that already produces defensible commits. | write-time |
| **3. Remote + integrity** | Push, protected-branch **checklist** generator, authorized-signer manifest + rotation. | write + read |
| **4. Verification Engine** | Standalone module + CLI `taraflow verify` (§5.D). Then the thin hooks (§7) that *invoke* it. | read-time |
| **5. Audit Report Generator** | `taraflow audit-report` over the engine (§5.E). | read-time |
| **6. Later stages** | Reviewer signatures, human-readable per-commit snapshots, long-term-validity handling. | read-time |

Answer to "wrapper first or straight for the whole thing?": **neither.** Phases 1–2 are a small, honest vertical slice — not a throwaway wrapper and not the whole thing at once. After phase 2 you already have real, verifiable audit commits; everything after that is additive and never forces a history rewrite.

---

## 13. Guiding principles

Not new requirements — the throughline already running through the document, stated so future contributors decide consistently:

- **Evidence over convenience.** When the two conflict, the audit value wins.
- **Determinism over implementation freedom.** One canonical form (TCS), one serialization path.
- **Verifiable identity over claimed identity.** A signature outranks an `author.name`.
- **History is append-only.** Rewrite must be impossible or, failing that, evident.
- **Every safeguard is itself auditable.** Hooks, signer manifest, and config all live under signed history.
- **Honest threat models increase credibility.** State what the trail does *not* protect against.
- **One engine, many callers.** GUI, hooks, CI, and auditor share the same verification core.
