# TARAflow — post-release backlog (after the first ISO/SAE 21434 release)

Deferred items from the `feature/iso21434_support` work stream. The first
21434 release ships without these; they are captured here so they are not lost.

---

## 10. Doc-generator IR architecture refactor (strategic)

**Problem.** The documentation generator currently couples *method* (what a
chapter contains) to *format* (how it is rendered). Adding a chapter or a
cross-reference tends to require per-format edits, and dead links (e.g.
`#threat-<id>` targets that don't exist) are only caught at runtime, not
structurally. Several of the shipped point-fixes (attack-path threats chapter,
AF-from-tree in the matrix, friendly display ids) were localized patches around
this coupling.

**Goal.** Decouple into three passes so new chapters/links don't ripple across
formats and dead links become structurally impossible:

1. **Composers → Document IR.** Each method/chapter emits a format-agnostic
   Document IR (typed nodes: sections, tables, threat rows, links-by-id), not
   format strings. Composers never know about HTML/Markdown/docx.
2. **Link-resolution pass.** A single pass over the IR resolves every
   cross-reference against declared anchors and fails (or reports) on any
   unresolved id. Cross-refs key on stable `id`/`pathKey`/`threatId`, never on
   the regenerable `displayId` (existing architectural rule).
3. **Format renderers.** One renderer per output format consumes the resolved
   IR. Adding a format = one renderer; adding a chapter = one composer; neither
   touches the other.

**Payoff.** New chapters/links are add-only; dead links caught before render;
the per-format special-casing behind points 1–5 collapses.

**Scope / risk.** Large, cross-cutting refactor of
`features/documentation/…/generators/*`. Best done as its own branch with a
golden-file test (render the Headlamp example before/after; assert byte-stable
output) so the refactor is provably behavior-preserving. Sequence it before
further chapter work, not after.

---

## B. Attack-tree structured leaf editor + leaves-from-threats (from open point 2)

Full design already written in **`attacktree-leaf-editor-design.md`** — this is
the summary and the extension the analyst raised.

**B1 — Structured leaf editor (deferred half of point 2).** Replace hand-typed
audit DSL (`et=1w,se=expert,…`) with five labeled dropdowns per leaf in the
attack-tree tab (same level names / ordering / per-entry tooltip as the risk
dialog). Requires: leaf selection state, a factors→DSL serializer that
round-trips without clobbering structure/benefit/comments (the current
`generateDSL` does not emit audit factors), and attacktree-local level i18n
(the hover labels from A1 already exist). Gate behind point 9's consolidation so
it builds on the single band/weight source (now shipped) rather than a second
one. The shipped A1 (hover tooltips) is the read-only precursor.

**B2 — Derive attack-tree leaves from confirmed threats (analyst request).**
In ISO mode, per-element/per-interaction STRIDE threats are enumeration that
feeds attack-tree analysis (shipped: asset-derived relevance + STRIDE excluded
from the risk register). The next step is to let a confirmed, asset-relevant
threat *seed* an attack tree — e.g. generate a starter tree/leaf per confirmed
threat (goal = the threat's security property, an initial leaf per STRIDE
vector), so the analyst refines rather than starts blank. Open questions:
one tree per threat vs per asset; how to keep generated trees in sync when the
threat set changes; and whether B2 reuses B1's serializer to write the seeded
leaves.

**Sequence.** Point 9 (done) → B1 (structured editor + serializer) → B2
(leaves-from-threats builds on the serializer).

---

## Carry-over notes (not blocking the release)

- **ID collision across domains.** `S-004` etc. are reused across
  `per-element/{embedded,general}` threat domains; safe today because lookups
  are domain-scoped (fixed the one domain-less caller in `create-threat-dialog`).
  Consider domain-prefixed ids if the catalog grows.
- **Guard test for the band tables.** Point 9 makes drift structurally
  impossible (both derive from `shared/attack-feasibility-bands`); an optional
  unit test comparing the two derived tables would lock it against a future
  re-hardcode.
