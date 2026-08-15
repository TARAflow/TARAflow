# Phase 7 — Documentation / Reporter — Design

Status: NOT STARTED. Source of truth for scope: §8 and §9 of
`attacktree-threat-generator-design.md` (the master design doc) — this file
expands on those sections and adds the DocBook requirement; it does not
replace the master doc.

## Why this phase exists

Per §8 of the master doc: **without this, an attack-tree-focused TARA is
not auditable.** The standalone CLI report generator (`taraflow-report`,
shipped since v0.6.0-alpha, Markdown/AsciiDoc/HTML/PDF/StrictDoc) does not
yet know anything about attack trees — this phase is what teaches the
report generator (and/or an in-app reporter — not yet distinguished, see
Open below) to include them.

## Scope (§8 of the master doc)

1. **Per tree:** the anchor (asset + security goal), the DSL, the rendered
   tree (SVG → `@resvg/resvg-js` for PDF), all paths with feasibility.
2. **Traceability:** for every attack-path threat in the register, which
   tree and which path produced it.
3. **Methodology section — MANDATORY, not optional:**
   - likelihood model (ISO `feasibility-only` vs. 62443
     `feasibility-x-motivation`)
   - gate aggregation (SUM for effort, PRODUCT for probability, MIN for
     bare ordinals)
   - damage scenario cardinality — the 1:1 (asset × security goal)
     simplification, stated explicitly. A *declared* simplification is
     defensible; a silent one is an audit finding.
   - emission policy
   - feasibility method per tree (quick / attack-potential / CVSS /
     attack-vector)
   - feasibility band boundaries and factor values
   - impact source per tree (asset default vs. per-goal override) and
     aggregation method
4. **Non-emitted paths:** listed as documented, not risk-bearing. Silence
   here looks like an omission to an auditor, not a deliberate exclusion.
5. **Mitigation effect:** cheapest path before vs. after mitigation, per
   tree.

**Tests (per the master doc's Phase 7 plan):** golden/snapshot per format;
methodology section present; traceability chain risk → tree → path
verified end-to-end.
**Commit message shape (per the master doc):**
`feat(report): attack tree analysis, traceability and methodology section`

## Output formats

Existing (CLI generator, already shipped): Markdown, AsciiDoc, HTML, PDF,
StrictDoc.

**New requirement, added 2026-07-26 (not in the master doc): DocBook.**
DocBook supports attaching a custom XSLT stylesheet for
rendering/transformation — needs to be exposed as a configurable option
(which stylesheet to apply), not hardcoded to a single default.

Not yet decided:
- Where the stylesheet comes from — bundled default(s) the user picks from,
  an arbitrary file path/upload the user supplies, or both.
- Whether DocBook goes through the same dependency-cruiser-bounded CLI
  generator as the existing five formats, or is handled separately. Given
  the existing five all go through that generator, DocBook presumably
  should too, for consistency — not confirmed.
- Whether DocBook needs its own template/format module analogous to
  however the existing five are structured internally (unseen — no report
  generator source has been reviewed for this doc yet).

## Phase ordering note (§9 of the master doc, informational — already resolved)

§9 flagged, as a DEFERRED item at the time: for attack-tree-focused mode
the natural tab order would be `DFD → Assets → Threats → Attack Tree →
Risks`, but "correctness comes from the data flow, not tab position" —
reordering only touches `PhaseId`, `phaseStatus`, migration and the
reporter, and is ergonomics only. This is what later became the actual
Phase 9 work (tab-order removal, done 2026-07-25/26) — recorded here only
so the cross-reference isn't lost; no action needed from Phase 7 itself.

## Open (beyond the DocBook question above)

- In-app reporter vs. CLI-only: does Phase 7 add a tab/button inside
  TARAflow itself, or does it only extend the standalone `taraflow-report`
  CLI tool to understand attack trees? The master doc's §8 doesn't
  distinguish; needs deciding before implementation starts.
- Relationship to the existing report generator's internal architecture
  (unreviewed as of this doc).
