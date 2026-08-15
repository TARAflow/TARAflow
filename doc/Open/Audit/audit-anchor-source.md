# Decision: Audit verification — anchor source (derived vs pinned)

- **Status:** Accepted (interim) — 2026-08-11
- **Scope:** In-app Audit tab verification (`AuditVerifyPanel` / `useAuditVerify`).
- **Related:** `AVE-v1.md` (engine), `taraflow-verifier/` (CLI), `useAuditProtection`.

## Context

The Audit Verification Engine (AVE) reconstructs signing authority from the
committed history starting at a **bootstrap anchor** — the commit that first
introduces `.tara/allowed_signers`. Every later commit is checked against the
manifest *as it stood before it*.

By design, the anchor is meant to be **pinned out-of-band**: a repository cannot
vouch for its own root. If an attacker rewrote history to insert a fabricated
"earlier" manifest commit, a *self-derived* anchor would simply move to the
fabricated commit, and verification would bless the forged root. The CLI/CI path
therefore takes the anchor explicitly (`--anchor <hash>` or `--policy <file>`).

However, the desktop app **already derives** the anchor today: `useAuditProtection`
computes it as the oldest commit that added the manifest
(`git log --diff-filter=A -- .tara/allowed_signers`) and exposes it as
`protection.anchor`.

## Decision

For the **in-app verification panel (v1)** we **reuse the derived anchor**
(`protection.anchor`).

Rationale:

- It is **consistent** with what the app already does for its lightweight
  protection check — we don't introduce a second, contradictory notion of "the
  anchor" in the same UI.
- It needs **no new storage** or user ceremony to start providing value.
- The panel is a **convenience/at-a-glance** check inside the app. The
  authoritative, adversarial-grade verification is the **CLI/CI** path, which
  uses an explicit pinned anchor.

## Consequences

- In-app verification places **bootstrap trust** in the repository's own
  first-manifest commit. This is **weaker** than a pinned anchor: it cannot
  detect a history rewrite that fabricates an earlier, attacker-controlled root,
  because the derived anchor would move with it.
- This is acceptable **only** because the app is not the security boundary — the
  CLI/CI verification with a pinned anchor is. The panel must not be presented as
  the authoritative attestation.

## Future / hardening (pinning)

Introduce a **versioned, committed policy file** — `\.tara/policy.json` — as the
single source of truth, shared by GUI and CLI:

```json
{
  "bootstrapAnchor": "<full commit hash>",
  "ref": "main",
  "strict": false,
  "mandateFourEyes": false,
  "protectedBranches": []
}
```

- Same shape the CLI's `resolve-policy` already consumes (`--policy`), so **one
  file drives both** the app and CI.
- The panel would then **prefer the pinned anchor** from `policy.json` and fall
  back to the derived one only when the file is absent.
- Add a **"Pin this anchor"** action in the Audit tab that writes the currently
  derived anchor into `policy.json` (a normal, signed `audit:` commit), turning
  the bootstrap trust act into an explicit, reviewable decision.
- A small shared reader/writer for `policy.json` (pure, tested) is the unit of
  work when we do this.

Until then: **derived anchor in-app, pinned anchor for CLI/CI.**
