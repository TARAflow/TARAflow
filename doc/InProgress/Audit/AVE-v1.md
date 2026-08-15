# Audit Verification Engine — AVE v1

**Status:** Specification, v1
**Date:** 2026-07-28 (rev. 2026-08-07 — Phase-3 decisions folded in)
**Owner:** referenced by `audit-tab-rework-design-en.md` §5.D

## Purpose

A standalone engine that re-checks an audit repository against the rules of the
security model and emits a machine- and human-readable **findings** result. One
engine, many callers: the Audit UI, the CLI (`taraflow verify`), CI, the thin
git hooks (which *invoke* it, never reimplement it), and an auditor all use the
same core. Its output feeds the Audit Report Generator (design §5.E).

## Inputs

- path to the audit repository (working tree or bare);
- target ref (default `audit`);
- the TCS serializer (§ `TCS-v1.md`) for byte-reproducibility checks;
- the **signer manifest** as committed at each point in history
  (`.tara/allowed_signers`, OpenSSH `allowed_signers` format; entries may carry
  `role="maintainer"` — see Trust reconstruction);
- policy: **`bootstrapAnchor`** (the pinned root commit hash, supplied
  out-of-band — see below), `requireSigning`, `protectedBranches`, reviewer
  rules, expected hooks version;
- optional cache (see Performance).

### The bootstrap anchor is supplied out-of-band

The root commit is the one commit no prior signature can vouch for. It is the
first commit that adds `.tara/allowed_signers`, and it is *self-anchoring*: the
manifest it introduces authorizes the key that signed it. That is internally
consistent but not by itself trustworthy — a forger could produce an equally
consistent chain from a different root.

The engine therefore takes the expected root **hash** from its policy, not from
the repository. Anything in the repo (including an `audit-root` tag) is a
convenience pointer and is itself *checked against* the pinned value, never
trusted as the source of it. A tag that has moved is a finding, not a new truth.

The app's protection checklist prints the anchor hash for exactly this purpose,
so pinning it is a copy rather than a research task.

Reference value for the example repository `TARAflow_Examples`:

```
9456a26670931b4538b8c9c5e867fa899f0f35c1
```

## Outputs

- a **Findings** object: overall `pass | fail`, plus a list of findings, each
  `{ id, severity: error|warning|info, commit?, message }`;
- a stable, serializable form (JSON) so the Report Generator and CI can consume it;
- a process **exit code** (below).

## Trust reconstruction (the core algorithm)

Authority is anchored to **position in the immutable, signed history**, never to
a commit timestamp (timestamps are attacker-controlled).

```
manifest := bootstrap anchor (pinned hash from policy)   # the ROOT special case
for commit in history(root → tip):                       # ancestry order
    effective := manifest as established *before* this commit
    verify commit signature against `effective`
    if commit modifies the signer manifest:
        require its signer ∈ effective                    # authorized before it
        require its signer carries role="maintainer" in `effective`
        manifest := updated manifest
    record finding(s)
```

- The **root commit has no predecessor** — that single special case takes its
  manifest from the pinned bootstrap anchor, not from a parent, and the walk
  starts only if the actual root matches the pinned hash.
- A commit can never authorize *itself*: it is judged against what the history
  before it established.
- **Manifest changes are maintainer-only.** The role is recorded in the manifest
  line (`role="maintainer"`); *enforcing* it is the engine's job, not the app's —
  the write flows deliberately only record and warn (see "Division of labour").
  A signer promoted by the very commit under inspection is therefore not yet a
  maintainer for that commit.
- Signature verification is **local and offline**: git checks against the
  committed manifest via `gpg.ssh.allowedSignersFile`. The hosting provider is
  never consulted, so verification works on a bare clone with no network.
- The concrete git plumbing (e.g. reading the manifest from the preceding tree)
  is the implementation's choice; the **properties** above are what must hold.

## Division of labour: the app records, the engine enforces

Worth stating explicitly, because it determines what the engine may assume: the
application's write flows do **not** enforce history-level rules. They produce
correctly shaped artifacts (path-scoped signed `audit:` commits, a byte-stable
manifest carrying roles) and warn the user early — for instance by refusing to
create a signed commit whose `author.email` is absent from the manifest.

They do **not** check whether a signer was authorized *before* their commit, nor
whether a manifest change came from a maintainer. Neither is knowable at write
time without walking history, and a local guardrail is not a control anyway: the
manifest is an ordinary file in every clone and can be edited by anyone. Local
prevention is impossible; the goal is that no change goes **unnoticed**.

Hence the two real layers: **prevention** at the server (path-based review on
`.tara/`, branch protection) and **detection** here. The engine must assume
nothing has been enforced upstream.

## Check catalogue

- **anchor:** the repository's root commit matches the pinned `bootstrapAnchor`;
  an `audit-root` tag, if present, points at it (a moved tag is a finding);
- **signatures:** every commit on the target ref is signed and the signer was
  authorized by the preceding history (above) — only `%G?` == `G` passes;
- **manifest authority:** every commit touching `.tara/allowed_signers` is
  signed by a signer who was a **maintainer** before that commit; the manifest
  never ends up empty or without a maintainer;
- **message schema:** `[TARA] <round>` header + required trailers (infra commits
  use the `audit:` category and are exempt from the round schema);
- **four-eyes:** where mandated, `Reviewed-by` present and reviewer ≠ author;
- **history shape:** linear, no orphan commits, no unexpected merges (no rewrite
  evidence);
- **repo state:** working tree clean, no detached HEAD;
- **TCS reproducibility:** each `*.tara.json` parses and is byte-identical to a
  fresh TCS re-serialization;
- **hooks version:** installed hooks match the expected version;
- **protection attestation:** branch-protection expectations recorded
  (informational for hosted remotes — the engine cannot observe server policy);
- **round monotonicity:** round numbers monotonic, no skipped rounds (optional).

The first three, plus history shape, are the ones the app already evaluates
locally in weaker form for its protection panel; the engine is the authoritative
implementation and the app's version must not diverge from it. The shared pure
checks (`checkProtection`, the manifest parser and its role helpers) are reused
rather than reimplemented.

## Exit codes (CLI)

| Code | Meaning |
|---|---|
| 0 | pass — no error-severity findings |
| 1 | fail — one or more error findings |
| 2 | usage / configuration error (bad args, repo not found) |
| 3 | engine error (could not complete verification) |

Warnings and infos do not by themselves fail the run (code 0) unless
`--strict` promotes warnings to errors.

## CLI surface

```
taraflow verify [--ref audit] [--strict] [--json] [--staged --tcs-only]
taraflow audit-report ...        # Report Generator, consumes verify output
```

- `--staged --tcs-only` is the fast single-file path the `pre-commit` hook calls
  to enforce canonical format without running the full history check.
- `--json` emits the Findings object for CI / the Report Generator.

## Performance

The engine **may cache intermediate verification state**, provided caching
**never changes the verification result**. A verified prefix of history (up to a
known-good commit) need not be re-walked; only new commits since the cached tip
are checked. This keeps a long-lived repo (years, tens of thousands of commits,
hundreds of MB) verifying incrementally. The cache is an optimization only — a
cold run with no cache must produce the identical result.

## Versioning

The rule set is versioned (`AVE v1`). A change that alters what counts as a
pass/fail is a new AVE version, recorded so results remain interpretable over time.
