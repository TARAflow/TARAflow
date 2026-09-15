# TARAflow — Doc-Generator Architecture: Method × Format Decoupling

> Scope: replace today's format-subclass + in-base method-conditional generator
> with two orthogonal axes — **Method** (what a report says) and **Format** (how
> it is written to a file) — joined by a small format-agnostic **Document Model
> (IR)**. Goal: adding a method or a format is *additive* (N + M), not a matrix
> edit (N × M).
>
> Drivers (from Jürgen):
> 1. Each method needs its own documentation — TARAflow (standard), EN 50742 A,
>    TVRA, ISO/SAE 21434.
> 2. That method output must then be rendered into a file format — AsciiDoc,
>    Markdown, PDF, HTML, StrictDoc, and (future) DocBook.

---

## 0. Verification provenance

Current-state claims below were read from branch `feature/iso21434_support` at
HEAD `5e5eddd`, not inferred. Re-verify before implementing — the branch moves.

---

## 1. Current state (verified) and why it doesn't scale

**Format = subclass.** `BaseDocumentGenerator` (`base-generator.ts`) holds all
chapter logic as `generateX(): ChapterContent`, where `ChapterContent.content` is
**already a format-specific string**. Concrete formats subclass it and supply
per-chapter template getters:

- `markdown-generator.ts`, `asciidoc-generator.ts`, `html-generator.ts`,
  `strictdoc-generator.ts` — string-template subclasses.
- PDF is a **separate path** entirely: `pdf-generator-{adaptive,node,renderer}.ts`
  + `pdfmake-converter.ts` (pdfmake docDefinition, not string templates).

**Method = conditionals inside the base.** Regulation behaviour is scattered as
branches in shared code: `generateTraceabilityMatrix()` gated on
`likelihoodMethod === "iso-21434"`; `generateSRSLAssessment()` only for
`en-50742-a`; per-element vs per-interaction; etc. Chapter selection is a
`switch (chapterId)` in the base — which literally carries a
`// <-- ADD THIS CASE` comment, an honest fossil of the "edit everywhere" habit.

### The cost, concretely

- **A new chapter touches every format.** The ISO traceability matrix patch had
  to add template getters in markdown + asciidoc + strictdoc + html + pdf
  renderers, plus base logic, plus i18n. That is the N × M tax per chapter.
- **A new format re-implements every chapter.** DocBook today = a new subclass
  overriding *all* getters for *all* chapters of *all* methods.
- **A new method edits shared code.** TVRA would add more conditionals into
  `base-generator.ts` that every other method's code path now steps around.
- **Cross-references are hand-built strings** (`#threat-{{id}}` per format) with
  no notion of a target. That is the direct cause of the attack-path dead-link
  bug (`TICKET-attack-path-threat-anchors.md`): there is no place that *knows*
  which anchors exist, so no place can catch a link that points nowhere.

The method logic being shared across formats is fine. The problem is that
**method semantics and format syntax are welded into the same objects**, so
neither axis can move without disturbing the other.

---

## 2. Target architecture — a two-stage pipeline

```
DocProjectData
     │
     ▼   Stage A — METHOD (composers): "what the report says"
MethodDocProfile.compose(project)  ──►  Document IR  (format-agnostic node tree)
     │
     ▼   link-resolution + validation pass (method- and format-agnostic)
Resolved Document IR  (+ coverage findings)
     │
     ▼   Stage B — FORMAT (renderers): "how it is written"
DocRenderer.render(ir)  ──►  string | pdfmake docDefinition
```

Two registries, one 2-D lookup, no cross-products in code:

```ts
generateDocument(project, format) =
  renderer(format).render(
    resolveLinks(
      method(project.risks.configuration.likelihoodMethod).compose(project)
    )
  );
```

- Add a **method** ⇒ one `MethodDocProfile`. Zero renderer changes.
- Add a **format** ⇒ one `DocRenderer`. Zero method changes.

---

## 3. The Document IR (the contract between the axes)

A small, **closed** set of nodes — expressive enough for these reports, small
enough that a new renderer is a bounded job. Everything method-specific is
*content*; everything format-specific is *rendering*; the IR is the only thing
both sides agree on.

```ts
type DocNode =
  | Document        // { meta, children: Section[] }
  | Section         // { level, title, id?, children: DocNode[] }
  | Paragraph       // { children: Inline[] }
  | Table           // { caption?, columns: Column[], rows: Row[] }  Row = Cell[]; Cell = Inline[]
  | DefinitionList  // { items: { term: Inline[]; def: Inline[] }[] }
  | Admonition      // { kind: "note"|"warning"|"normative"; children }
  | CodeBlock       // { language?, text }
  | List;           // { ordered: boolean; items: DocNode[] }

type Inline =
  | Text            // { text, style?: "strong"|"em"|"code" }
  | Anchor          // { id }                         ← declares a link target
  | CrossRef        // { targetId, label: Inline[] }  ← references a target
  | StatusBadge     // { status: "resolved"|"missing"|…, label }  (semantic, not a colour)
  | ExternalLink;   // { href, label }

interface DocMeta {
  methodId: string;              // "iso-21434" | "en-50742-a" | "tvra" | "standard"
  normativeBasis?: string;       // e.g. "ISO/SAE 21434:2021"
  calcVersion?: string;          // reproducibility stamp (design doc §6)
  mappingVersion?: string;
  language: DocLanguage;
  generatedAt: string;
}
```

Design rules:

- **Tables carry inline nodes in cells**, so a link or a status badge inside a
  cell is a first-class node — not a pre-baked `[x](#y)` string. This is what lets
  one renderer decide the Markdown vs AsciiDoc vs PDF form of the *same* link.
- **`Anchor` and `CrossRef` are separate node types.** Anchors *declare*
  targets; CrossRefs *reference* them. Neither carries format syntax.
- **`StatusBadge` is semantic** ("resolved"/"missing"), not a colour or glyph;
  each renderer maps it (Markdown text, HTML class, PDF fill). The ISO matrix's
  resolved/missing column is exactly this.
- The IR is a **superset**; renderers declare capabilities and define fallbacks
  (e.g. Markdown renders an `Admonition` as a blockquote; StrictDoc maps
  `normative` admonitions / requirement-bearing sections to requirement objects).
  No lowest-common-denominator loss.

---

## 4. Stage A — Method layer (composers)

```ts
interface MethodDocProfile {
  id: string;                                  // likelihoodMethod key
  meta(project): DocMeta;                       // normativeBasis, calcVersion, …
  chapters(project): ChapterComposer[];         // ordered, method-owned selection
}

interface ChapterComposer {
  id: DocChapterId;
  isApplicable(project): boolean;               // replaces the in-base conditionals
  compose(project, ctx): Section | null;        // returns IR, never a string
}
```

- **Chapter selection lives in the profile**, not in a shared `switch`. ISO's
  profile lists the WP-15 chapters + traceability matrix; EN 50742 A's lists the
  SRSL assessment; TVRA's lists its own. `standard` is the baseline set.
- **Chapter composers are reusable.** "Asset register", "risk register",
  "appendix" are shared composers parameterised by the profile; only the
  genuinely method-specific chapters (SRSL, ISO traceability matrix) are bespoke.
  A method profile is mostly *assembly*, not new code.
- **All method conditionals migrate here** from `base-generator.ts`:
  per-element/interaction selection, ISO gating, SRSL-only-for-EN50742. Each
  method's rules sit in that method's object; other methods never step around
  them.

---

## 5. Stage B — Format layer (renderers)

```ts
interface DocRenderer {
  format: DocFormat;                 // + "docbook" (new)
  capabilities: RendererCapabilities;
  render(ir: Document): string | PdfDocDefinition;
}
```

- One renderer per format. It walks the IR node types and knows **only** syntax:
  how to write a `Section`, a `Table`, a `CrossRef`, a `StatusBadge`.
- **PDF stops being a snowflake.** The pdfmake path becomes a renderer that emits
  a docDefinition from the *same* IR, instead of a parallel generation universe.
- **DocBook = one new file.** Implement `render()` for the ~10 node types; it
  immediately works for every method, because methods only ever produced IR.
- Renderers are **pure IR → output**: trivially snapshot-testable, no project
  data, no i18n branching beyond label lookup.

---

## 6. Cross-reference resolution — the structural fix for the dead-link class

A single pass between the axes, method- and format-agnostic:

```
resolveLinks(doc):
  anchors := { every Anchor.id in the tree }
  for each CrossRef:
     if targetId ∈ anchors:  keep as link
     else:                    (policy) demote to plain Text  AND  record a finding
  return { doc, findings }
```

- Kills the entire attack-path dead-link bug **once**, for every format and every
  method — no per-format conditionals (contrast the current per-template
  `#threat-{{id}}` strings).
- The `findings` list **is** the ISO traceability "missing link" coverage signal
  (design doc §6) and feeds the 🟡 readiness checker (DS-5). A broken link becomes
  reported evidence, not a silent gap.
- Belt-and-braces: a CI/fixture assertion "no CrossRef without a matching Anchor
  in any generated format" becomes the permanent regression net.

---

## 7. Migration — strangler-fig, output-preserving

Never a big-bang rewrite; keep generated output stable and prove it.

- **Phase 0 — Safety net.** Snapshot the *current* Markdown/AsciiDoc/HTML/PDF/
  StrictDoc output for a representative fixture set (incl. an ISO project and an
  attack-path project). These goldens gate every later phase.
- **Phase 1 — Pilot: the ISO traceability matrix.** It is newest, self-contained,
  and carries the dead-link problem. Introduce the IR + a `MarkdownRenderer` +
  `resolveLinks`, port this one chapter to compose→IR→render across all formats,
  and prove parity against Phase-0 snapshots. Bonus: the pilot *fixes the ticket*
  on the new rails (attack-path CrossRefs are resolved or flagged).
- **Phase 2 — Port chapters one by one.** Each port adds an IR composer and
  deletes that chapter's `getXTemplate()` getters from *every* format file. Net
  code shrinks per chapter.
- **Phase 3 — Extract method profiles.** `standard`, `en-50742-a`, `iso-21434`,
  `tvra`. Move the base `switch` and the method conditionals into profiles;
  `base-generator.ts` conditionals disappear.
- **Phase 4 — Prove N + M.** Add the **DocBook** renderer (one file, zero method
  changes) and complete **TVRA** as a profile (one object, zero renderer
  changes). Fold the PDF path onto the IR renderer.

Each phase is independently shippable and snapshot-gated.

---

## 8. How this closes out ISO/SAE 21434 support

The remaining ISO items land as composers/metadata on the `iso-21434` profile,
not as new conditionals:

- WP-15 work-product chapters (damage scenarios, threat scenarios, impact,
  attack paths, feasibility, risk values, **risk treatment 15.9**, residual) =
  chapter composers.
- Treatment → residual trace, CS-goal **link stub** (DS-6) = IR CrossRefs
  resolved by §6.
- `normativeBasis` / `calcVersion` / `mappingVersion` = `DocMeta`.
- Traceability **coverage matrix** = the `resolveLinks` findings rendered as a
  chapter — the design doc §6 coverage check, now a property of the pipeline
  rather than one bespoke chapter.
- Attack-path threats chapter (the ticket) = one composer that emits `Anchor`s;
  the resolver guarantees no dangling references thereafter.

Result: ISO support is finished on rails that also make EN 50742 A cleaner and
make TVRA + DocBook cheap.

---

## 9. Decisions & open questions

- `[x]` **DECIDED (proposed):** IR-in-the-middle; method composers + format
  renderers; two registries; link-resolution pass.
- `[x]` **DECIDED (proposed):** strangler-fig migration gated by output
  snapshots; ISO traceability matrix as the pilot chapter.
- `[ ]` **OPEN:** exact IR node set for **StrictDoc** — it is requirement-object
  oriented; confirm whether `Section{requirement?}` + `CrossRef` suffice or a
  dedicated `Requirement` node is warranted. Decide during the Phase-1 pilot by
  round-tripping one chapter to StrictDoc.
- `[ ]` **OPEN:** **PDF** fidelity — validate on the pilot that pdfmake can render
  the IR (nested tables, anchors/bookmarks, status fills) without regressing the
  current adaptive layout.
- `[ ]` **OPEN:** where composers get their labels — keep the existing i18n
  `t()` at compose time (IR carries resolved strings) vs. carry keys in the IR
  and resolve at render time. Recommend resolve-at-compose (renderers stay pure,
  language is a `DocMeta` fact).
- `[ ]` **OPEN:** do method profiles own chapter *ordering* only, or also
  cross-chapter numbering/IDs (`AS-`/`DS-`/`TS-`… from design doc §6)? Recommend
  the profile owns the ID scheme; the IR carries the resulting ids as `Anchor`s.

---

## 10. Definition of Done

- A chapter is authored **once** as an IR composer and appears in all formats.
- A new format (**DocBook**) is a single renderer file, no method edits.
- A new/updated method (**TVRA**) is a single profile object, no renderer edits.
- No generated document contains a `CrossRef` without a matching `Anchor`
  (enforced by `resolveLinks` + a CI fixture) — the attack-path dead-link class
  is structurally impossible.
- Output for existing methods is unchanged across the migration (snapshot-proven).

---
© Jürgen Messerer · 2026 · Normative content derives from ISO/SAE 21434:2021;
authoritative wording is the standard.
