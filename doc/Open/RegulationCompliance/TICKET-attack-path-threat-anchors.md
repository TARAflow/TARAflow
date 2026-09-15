# TICKET — Attack-path threats have no anchor target → dead `#threat-<id>` links

**Component:** `features/documentation` (doc generator)
**Branch:** `feature/iso21434_support`
**Severity:** Medium (correctness of generated reports; ISO 21434 path specifically)
**Type:** Bug + small feature
**Status:** Ready — verified against source at HEAD `5e5eddd`

---

## Summary

Every risk row that links to a threat renders `#threat-<risk.threatDisplayId>`,
but the anchor `threat-<id>` is emitted **only** by the threat-analysis chapter,
which is built exclusively from `perElementTables` / `perInteractionTables`.
Attack-path-sourced risks (`sourceStrideMethod: "attack-path"`, display ids like
`AT-at-1789377988477-…-T`) are **not** in those tables, so their links resolve to
nothing in every format that supports anchors (Markdown, AsciiDoc, HTML).

This is not limited to the new ISO traceability matrix — it is a pre-existing
gap that the matrix merely made visible.

## Verified facts (source pass, HEAD `5e5eddd`)

- `ThreatData` (`src/features/threats/models/threat-types.ts:800`) has exactly two
  table sources: `perElementTables` and `perInteractionTables`. **No** attack-path
  source. `DocProjectData.threats: ThreatData | null` (`doc-types.ts:241`).
- `generateThreats()` (`base-generator.ts:1014`) accepts only
  `method: "per-element" | "per-interaction"` and reads only those two tables.
  It is the only place the `threat-<id>` anchor is set (via the format
  `threatRow` templates).
- Chapters that **link to** `#threat-<id>` but never set it for attack-path ids:
  - `traceabilityRow` (new matrix) — `tsAnchor: risk.threatDisplayId`
    (`base-generator.ts:1372`)
  - `riskRow`, `srslRow`, `wontRiskRow` — all link `#threat-{{threatId}}`
    (markdown/asciidoc/html templates)
- Attack-path is a **first-class ISO case**, not an edge case:
  commits `f1ad64a` (relevant attack paths reach the Risk tab without a
  mitigation) and `958083f` (show attack-path risks even when STRIDE threats
  aren't confirmed). `"attack-path"` appears across ~10 test fixtures.

## Options

**(a) Defensive guard (matrix only).** Build a set of the `threatDisplayId`s that
are actually rendered as anchors; when `tsAnchor` is not in the set, render the TS
cell as plain text (no link) — per format. *Cheap, but only hides the symptom in
one chapter; risk/SRSL/won't chapters stay broken.*

**(b) Attack-path threats become a real, anchored source. — RECOMMENDED.**
Give attack-path threats a rendered home so `threat-<id>` exists, exactly like
per-element/per-interaction threats. This fixes the matrix *and* the risk/SRSL/
won't links in one move, and it is what design doc §6 (the traceability chain
`… → TS → …`) actually implies.

## Recommended implementation — (b)

1. **Data source.** Extend the doc-project threat data with a third table
   source, `perAttackPathThreats: ThreatTable[]` (or the shape that the
   attack-path risk mapper already produces). Populate it where the other two
   are populated in the doc-project assembly. Keep it optional/back-compatible
   (absent ⇒ today's behaviour, no migration).
2. **Chapter.** Add a `DocChapterId` `"threats-attack-path"` and a
   `generateAttackPathThreats()` (or generalise `generateThreats()` to a third
   method value). It **must** emit the `threat-<threatDisplayId>` anchor using
   the same `threatRow` anchor convention so existing links resolve.
3. **Templates.** Reuse the existing `threatRow` templates where possible; add a
   chapter header per format. (Under the new generator architecture — see
   `doc-generator-architecture-design.md` — this becomes a single IR composer
   with no per-format template edits. If that refactor lands first, implement (b)
   on the new rails and let the link-resolver pass report any residual gaps.)
4. **Gating.** Show the chapter when attack-path threats exist (independent of
   `likelihoodMethod`, since standard/TVRA projects can also carry attack-path
   risks); order it after per-interaction threats.

### Interim
If (b) cannot land this iteration, apply (a) to the **traceability matrix only**
so the ISO report has no dangling links, and keep this ticket open for the
risk/SRSL/won't chapters. Do not close on (a) alone.

## Acceptance criteria

- A project with ≥1 attack-path risk generates, in Markdown/AsciiDoc/HTML, a
  `threat-<attack-path-id>` anchor that every `#threat-<id>` reference resolves to
  (matrix, risk register, SRSL, won't).
- No `#threat-<id>` reference in any generated document points at a missing
  anchor (verified by the link-resolution check / a fixture assertion).
- StrictDoc and PDF outputs contain the attack-path threats without broken
  internal references (PDF: bookmark/label; StrictDoc: requirement/link).
- Existing per-element / per-interaction output is byte-for-byte unchanged for
  projects with no attack-path risks (snapshot).

## Tests to add

- Unit: `generateAttackPathThreats()` emits the anchor for an attack-path
  `threatDisplayId`; hides when none exist.
- Unit: extend `traceability-matrix.test.ts` — for an attack-path risk, the TS
  anchor target now exists (assert the anchor is emitted by the threats chapter
  in the same document).
- Link-integrity fixture: assemble a doc with an attack-path risk, render each
  format, assert every `#threat-…` reference has a matching anchor id (this is
  the general regression net for the whole dead-link class).
- Extend `iso21434-risk-chain.int.test.ts`: full attack-path risk → `generateDocument()`
  → matrix row + resolvable anchor.

## Related
- Fixed separately: ISO Table G.7 feasibility bands
  (`iso21434-g7-feasibility-fix.patch`).
- Architecture: `doc-generator-architecture-design.md` (link-resolution pass is
  the structural, permanent fix for this bug class).

---
© Jürgen Messerer · 2026
