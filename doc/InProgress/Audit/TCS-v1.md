# TARAflow Canonical Serialization — TCS v1

**Status:** Specification, v1
**Date:** 2026-07-28 (rev. 2026-08-07 — Phase-3 decisions folded in)
**Owner:** referenced by `audit-tab-rework-design-en.md` §5.A

## Purpose

TCS defines a **byte-stable** on-disk form for a TARAflow project file
(`*.tara.json`). The same project state must serialize to the same bytes, on any
platform, so that:

- Git diffs reflect *semantic* change, not serializer noise;
- "same state → same commit" holds (idempotent commits);
- the Audit Verification Engine can prove reproducibility by re-serializing a
  loaded project and comparing bytes.

TCS is the single source of truth for the format. Any consumer (app, CLI,
verifier, hooks) that writes or checks a `*.tara.json` file MUST follow it.

## Rules (v1)

1. **Encoding:** UTF-8, **no BOM**.
2. **Line endings:** LF (`\n`) only. Exactly **one** trailing newline at EOF.
3. **Layout:** pretty-printed, **2-space** indentation, one key per line.
   Minified output is non-conforming — line-level diffs are a requirement, not a
   preference.
4. **Object keys:** recursively sorted by **Unicode code point** (not locale
   collation).
5. **Array order:** each collection has a **defined, documented order**, applied
   consistently:
   - entity collections order by their natural key (`id`, or `pathKey` for
     attack-tree paths/nodes);
   - collections without a natural key preserve a deterministic, documented
     order (e.g. insertion order captured in the model).
   - Arrays are **never** blind-sorted — order may be semantic.
6. **Numbers:** integers emit without decimal point or exponent; **no negative
   zero**; `NaN` and `Infinity` are forbidden (reject at serialization). Ratings
   are integers by design; floats are avoided. Where a float is unavoidable, use
   fixed decimal formatting with a documented precision.
7. **Strings:** minimal JSON escaping. Printable non-ASCII is kept as UTF-8
   literals — no gratuitous `\uXXXX` escaping.
8. **null vs. absent:** keys whose value is `undefined` are **omitted**; explicit
   `null` is kept **only** where it is semantically meaningful in the model.

## On-disk reduction (what never reaches the file)

Byte-stable formatting is not sufficient for "same state → same commit". A field
that changes on its own — or that records the *result* of the very commit being
made — re-dirties the file immediately and breaks idempotence. The canonical
form is therefore also a **reduction**: the following are excluded at write time.

1. **Runtime-only fields:** the in-memory file path and the unsaved-changes flag.
   The path is the author's absolute local path and has no business in a
   committed artifact.
2. **Session and navigation state:** open/last-opened markers and the current
   phase. Not project content — the registry tracks the former, `phaseStatus`
   carries real progress — and persisting them churns the file on every open.
3. **Audit *results*:** last-commit state, commit history, and the audit
   timestamp. These live in git itself. Writing them back is circular: a commit
   can never contain its own hash, so the file is dirty the instant the commit
   finishes. Only the audit *configuration* is kept.
4. **Derived data:** the computed graph, recomputed on load.

Two related normalizations:

- The embedded diagram thumbnail carries a **randomly regenerated element id**
  per render; it is rewritten to a fixed value, otherwise an unchanged diagram
  serializes to different bytes each save.
- The project's own `lastModified` **is kept** (the recent-projects list needs
  it). "Last committed" is derived from git (`git log -1 --format=%cI -- <path>`)
  rather than stored. A remaining refinement — bumping `lastModified` only on
  real change — is deliberately deferred; done naively it self-triggers, because
  the timestamp must be excluded from its own change comparison.

The practical test: saving without editing anything must produce a diff of only
those timestamp lines, not thousands.

## Implementation notes

- TCS extends the **single** existing serialization path
  (`src/app/services/prepare-for-disk.ts` — the codebase already enforces exactly
  one, guarded by a source-level grep test). Do not add a second writer.
- Ship a companion `.gitattributes` in the audit repo:
  ```
  *.tara.json text eol=lf
  *.tara.json diff=taraflow
  ```
  (optionally a custom textconv diff driver `taraflow` for readable diffs).
- Provide a pure function `serializeTCS(project): string` and its inverse
  parse, both used by the app, the CLI, and the verifier — no divergent copies.

## Reproducibility contract

For any project `P` loaded from a conforming file:

```
serializeTCS(load(serializeTCS(P))) === serializeTCS(P)   // byte-identical
```

The Audit Verification Engine relies on this identity to flag any `*.tara.json`
in history that is not in canonical form.

## Versioning

- The ruleset is versioned (`TCS v1`). A change that alters output bytes for any
  existing project is a **new TCS version**, not an in-place edit.
- The project file records the TCS version it was written with, so the verifier
  knows which ruleset to apply and a migration can reformat deliberately (a
  single, clearly-labelled reformat commit).
