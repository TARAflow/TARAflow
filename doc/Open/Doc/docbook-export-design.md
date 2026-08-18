# TARAflow — DocBook Export with User-Defined Styling — Design

Status: draft for review · Author: (Juergen)

A low-risk, self-contained addition that slots into a gap between the regulation-preset work
(EN 50742 A/B, ISO 21434). Extends the existing `taraflow-report` CLI and folds into the
Phase-7 reporter scope, where DocBook + a configurable stylesheet was already named as the
addition.

It honours existing architecture invariants: it is a new output format in the reporter family
(reads the same intermediate report model as the other formats), and it respects the packaging
policy of minimizing bundled externals (the verifier depends only on `nodejs` + `git`).

## 1. Goal & value

Let a user produce a **branded, house-styled** TARA document without TARAflow owning the
styling. DocBook is the interchange target because it is a mature, schema-defined document model
with a complete, standard customization ecosystem (DocBook XSL). The user supplies styling;
TARAflow supplies correct, structured content.

The value is *interoperability + branding*, aligned with how the other report formats already
work — a new output format in the `taraflow-report` family (MD / AsciiDoc / HTML / PDF /
StrictDoc), not a new subsystem.

## 2. Scope & non-goals

In scope:
- Emit **DocBook 5** XML from the existing report model (the same content the other formats
  render: metadata, system/component sections, risk register, per-tree traceability, the
  mandatory methodology section, non-emitted paths, mitigation effect).
- A **styling model** in which the user provides a customization layer (and brand assets), not
  a from-scratch stylesheet.
- Rendering delegation to an **installed DocBook toolchain** for HTML and print/PDF.

Non-goals:
- TARAflow does **not** bundle an XSL-FO / PDF rendering engine (see §4 — conflicts with the
  packaging policy).
- No round-tripping (DocBook is export-only).
- No change to the existing pdfmake-based PDF path; DocBook→PDF is a separate pipeline (see §4).

## 3. Where it fits

`taraflow-report` gains `docbook` as a `--format` value. The DocBook **XML emitter** is a
sibling to the existing per-format writers and reads the same intermediate report model.
Rendering (XML → HTML/PDF) is a post-step that shells out to a configured toolchain, so the
CLI's own bundle stays tiny.

## 4. Pipeline design (the key decision)

**Recommended:** TARAflow emits DocBook 5 XML; **rendering is delegated to a DocBook toolchain
the user has installed**, declared as an external dependency — exactly the pattern the verifier
already uses with `git` (`depends: [nodejs, git]`).

```
report model ──▶ DocBook 5 XML  ──(user customization XSL + assets)──▶ HTML   (xsltproc + DocBook XSL)
                    │                                                └─▶ PDF   (dblatex, or FOP via XSL-FO)
                    └─▶ (also emittable stand-alone: --docbook-xml-only)
```

Rationale:
- The existing PDF path is **pdfmake** (programmatic document definition), which does *not*
  consume XSL-FO or HTML — so a DocBook→PDF route cannot reuse it and would need its own engine
  regardless. Bundling FOP (Java) or a headless browser violates the "minimize externals / no
  heavy deps" policy.
- Delegating to an installed toolchain (`xsltproc` + DocBook XSL for HTML; `dblatex` or Apache
  FOP for PDF) keeps TARAflow's footprint to XML emission only, and hands the user the **entire
  standard DocBook customization world** — which is precisely the "user gives their own styling"
  requirement.
- Users who only want the XML (to feed their own publishing pipeline) get it via
  `--docbook-xml-only` with zero external dependency.

**Alternative considered (source path):** generate DocBook by converting the *existing AsciiDoc*
output via `asciidoctor` (AsciiDoc → DocBook). Cheap, but the DocBook structure would be
bottlenecked by the AsciiDoc emitter's expressiveness (tables, cross-references, the
methodology/traceability structure). **Recommendation: emit DocBook directly from the report
model** for full structural control — this is where DocBook's value lives. (See Decisions to
confirm.)

## 5. Styling model — what "user-defined styling" means concretely

TARAflow ships a **default customization stylesheet** (a thin XSL that imports the stock DocBook
XSL and sets sensible defaults). The user overrides via:

- a **customization layer**: their own XSL that imports the default and overrides only what they
  want (the standard DocBook customization pattern — users never write a full stylesheet);
- **brand assets** passed as parameters: logo, title-page text, fonts, colour tokens;
- optionally a full replacement stylesheet for power users.

This is far more usable than expecting a hand-authored DocBook XSL and matches how DocBook
styling is done in practice.

## 6. Config surface (CLI)

```
taraflow-report <project> --format docbook [options]
  --docbook-xml-only            emit DocBook 5 XML and stop (no toolchain needed)
  --stylesheet <file.xsl>       user customization layer (imports the default if omitted)
  --render <html|pdf|both>      delegate rendering to the configured toolchain
  --asset logo=<path> ...       brand assets / stylesheet params
  --toolchain-config <file>     paths/commands for xsltproc / dblatex / fop
```

Defaults are discoverable; a missing toolchain produces a clear error naming the required binary
(mirrors the verifier's `git --version` preflight).

## 7. Implementation phases

**Phase 0 — Decisions.** Confirm §4 (direct emission vs AsciiDoc route), §4 (delegate vs bundle),
§5 (customization layer vs full stylesheet). See "Decisions to confirm".

**Phase 1 — DocBook 5 XML emitter.** New writer over the report model. Full structured content:
`<info>`/metadata, system & component sections, risk-register tables, per-tree traceability, the
mandatory methodology section, non-emitted paths, mitigation-effect. Output validates against the
**DocBook 5 RELAX NG schema** (validation is part of the test, not a runtime step). `--format
docbook` + `--docbook-xml-only` wired. No external dependency yet.

**Phase 2 — Default stylesheet + rendering delegation.** Ship the default customization XSL. Add
the shell-out layer: HTML via `xsltproc` + DocBook XSL; PDF via `dblatex` (or FOP through
XSL-FO). Toolchain discovery + preflight + actionable "install X" errors. `--render`,
`--toolchain-config`.

**Phase 3 — User styling.** Customization-layer resolution (`--stylesheet` imports default),
asset/param injection (logo/fonts/colours), config file. Packaging: declare the external
toolchain in `nfpm.yaml` (`depends: [..., xsltproc | dblatex]`) analogous to the verifier's `git`
dependency; document the toolchain notes in the release notes.

**Phase 4 — (optional) in-app trigger.** Only if/where the app surfaces report generation;
otherwise CLI-only, consistent with the rest of the reporter.

## 8. Testing

- Unit: emitter produces **schema-valid DocBook 5** for representative projects (including
  empty/edge sections); snapshot of the XML structure.
- Integration (kept **out** of the unit run — needs installed tools, like the verifier's
  git-dependent integration test): render a fixture to HTML and PDF via the toolchain, assert
  exit status and non-empty output.
- Styling: a customization layer changes the output (e.g. injected logo/title) without changing
  content.

## 9. Decisions to confirm

1. **Source path:** emit DocBook XML directly from the report model *(recommended)*, or via the
   existing AsciiDoc output through asciidoctor?
2. **Rendering:** delegate to an installed toolchain *(recommended — tiny footprint, full
   standard customization, consistent with `git` for the verifier)*, or bundle an engine?
3. **Styling granularity:** default stylesheet + user customization layer *(recommended)*, or
   expect a full user-authored XSLT?
4. **PDF engine (if `--render pdf`):** `dblatex` *(simpler)* vs Apache FOP via XSL-FO *(heavier,
   more layout control)* — or defer PDF to Phase 3+ and ship HTML first?
