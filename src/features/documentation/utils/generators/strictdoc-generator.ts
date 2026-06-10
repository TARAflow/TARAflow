// ==================== STRICTDOC DOCUMENT GENERATOR ====================
// Concrete implementation for StrictDoc (.sdoc) document generation.
// Location: features/documentation/utils/generators/strictdoc-generator.ts
//
// StrictDoc format: https://strictdoc.readthedocs.io/
//
// Key differences from Markdown/AsciiDoc generators:
//
//   1. TOC is generated automatically by StrictDoc — generateTocContent()
//      returns an empty string.
//
//   2. [SECTION] blocks opened inside chapter templates must be closed with
//      [/SECTION]. The base generator concatenates chapter content, so every
//      chapter template is a self-contained, balanced block.
//
//   3. DFD element-type headers open a [SECTION] that is NOT closed by the
//      header template itself — it is closed by a dedicated sentinel emitted
//      after all elements of that type have been rendered (see
//      generateDfdDescriptions override below).
//
//   4. Threat and Risk rows are [REQUIREMENT] nodes, not table rows. The
//      "threatsTable" and "risksTable" templates are transparent pass-throughs
//      (they contain only {{threatRows}} / {{riskRows}}).
//
//   5. Text must not be pipe-escaped — StrictDoc uses plain text fields, not
//      table cells. escapeTableText() does only newline sanitisation.
//
//   6. The GRAMMAR block (declared once in the document header) references
//      custom fields (STRIDE, RISK_BEFORE, RISK_AFTER, …). The field names
//      used in [REQUIREMENT] nodes must exactly match the grammar declaration.
//      The grammar uses English field names regardless of UI language so that
//      StrictDoc tooling stays consistent across language variants.

import type { DocConfiguration, DocProjectData } from "../../models/doc-types";
import {
  BaseDocumentGenerator,
  type TranslationFn,
  type ChapterContent,
} from "./base-generator";
import { SDOC_TEMPLATES } from "../templates/strictdoc-templates";
import { SDOC_EXTENDED_TEMPLATES } from "../templates/strictdoc-templates-extended";
import { replacePlaceholders } from "../templates";

// ==================== SECTION CLOSE SENTINEL ====================
// Used to close [SECTION] blocks that are opened by type-header templates
// but must be closed after all child entries have been emitted.
const SECTION_CLOSE = `[/SECTION]

`;

export class StrictdocGenerator extends BaseDocumentGenerator {
  constructor(
    project: DocProjectData,
    config: DocConfiguration,
    t: TranslationFn,
  ) {
    super(project, config, t);
  }

  // ==================== FORMAT INFO ====================

  getFormat(): string {
    return "strictdoc";
  }

  getFileExtension(): string {
    return "sdoc";
  }

  // ==================== TEXT HANDLING ====================

  /**
   * StrictDoc fields are plain text — no pipe escaping needed.
   * We only strip raw newlines to keep field values on one logical line
   * (multi-line field values are supported by StrictDoc but require
   * explicit continuation indentation that we do not produce here).
   */
  escapeTableText(text: string): string {
    if (!text) return "";
    return text.replace(/\r/g, "").replace(/\n/g, " ");
  }

  formatTagsGrouped(
    tagsByCategory: Array<{ categoryLabel: string; tags: string[] }>,
  ): string {
    if (tagsByCategory.length === 0) return "-";
    return tagsByCategory
      .map(({ categoryLabel, tags }) => `${categoryLabel}: ${tags.join(", ")}`)
      .join("\n");
  }

  formatClassification(text: string): string {
    // Plain text — no markup needed inside [FREETEXT] blocks.
    return text;
  }

  // ==================== TOC ====================

  protected generateTocContent(_chapters: ChapterContent[]): string {
    // StrictDoc renders a TOC automatically from [SECTION] hierarchy.
    return "";
  }

  // ==================== DFD DESCRIPTIONS OVERRIDE ====================
  //
  // The base class calls getDfdElementTypeHeaderTemplate() which opens a
  // [SECTION] and then appends element entries. In StrictDoc we must close
  // that section after all elements of each type, and close the data-flows
  // section as well. We override generateDfdDescriptions to inject the
  // [/SECTION] sentinels at the right places.

  protected override generateDfdDescriptions(title: string): ChapterContent {
    const baseResult = super.generateDfdDescriptions(title);
    if (!baseResult.hasContent) {
      return baseResult;
    }

    // The base implementation has already called getDfdElementTypeHeaderTemplate()
    // (which opens [SECTION]) and getDfdConnectionEntry() entries.
    // We need to close:
    //   - each element-type [SECTION]
    //   - the data-flows [SECTION]
    //   - they are all inside the outer [SECTION] opened by getDfdDescriptionsTemplate()
    //
    // Strategy: post-process the rendered content by inserting [/SECTION]
    // before each new element-type [SECTION] header and before [/SECTION]
    // of the outer wrapper. This is safe because element-type headers always
    // start with the literal "[SECTION]\nTITLE:" pattern.
    //
    // We track open sections by counting occurrences of our sentinel marker
    // that we embed in the type-header template.

    let content = baseResult.content;

    // The dfdElementTypeHeaderTemplate and dfdDataFlowsHeader each open a
    // [SECTION] but do NOT close it. We close them by inserting [/SECTION]
    // immediately before each subsequent type-level [SECTION] open AND once
    // at the end of the whole element-descriptions block (before the outer
    // section closes).
    //
    // The outer [SECTION] (dfdDescriptionsTemplate) is balanced already by
    // the template text itself ("[/SECTION]" at the end). So we only need to
    // close the inner type sections.
    //
    // Approach: replace every second-or-later top-level "[SECTION]\nTITLE:"
    // (i.e. the type headers, NOT the outer wrapper) with "[/SECTION]\n[SECTION]\nTITLE:".
    // The outer wrapper's [/SECTION] then closes the last open inner section.

    // Markers used by type-header / data-flows header templates
    const INNER_SECTION_OPEN_MARKER = "__SDOC_INNER_SECTION__";

    // Replace getDfdElementTypeHeaderTemplate calls' output with a marked version
    // by using a distinguishable placeholder inserted in the template.
    // Since we cannot modify the base class's loop directly, we post-process
    // the output string. Type headers always start at column 0 with [SECTION].

    // Split on the inner-section boundary: each type-header and data-flows
    // header produces "[SECTION]\nTITLE: <typename/Datenflüsse/Data Flows>\n\n"
    // We close any previously opened inner section before opening a new one.
    content = this.closeInnerSections(content);

    return { ...baseResult, content };
  }

  /**
   * Post-process DFD descriptions content to insert [/SECTION] sentinels
   * before each inner element-type section and before the outer close.
   *
   * The outer wrapper template ends with:
   *   ...{{elementSections}}\n[/SECTION]\n\n
   *
   * After placeholder replacement the content looks like:
   *   [SECTION]\n               <- outer open (from dfdDescriptionsTemplate)
   *   TITLE: DFD Element…\n
   *   [FREETEXT]…[/FREETEXT]\n
   *   [SECTION]\n               <- inner type open (External Entities)
   *   TITLE: External Entities\n\n
   *   [SECTION]\n               <- element detail open
   *   TITLE: EE-01: Browser\n
   *   [FREETEXT]…[/FREETEXT]\n
   *   [/SECTION]\n              <- element detail close (from dfdElementDetailedEntry)
   *   [SECTION]\n               <- next type open (Processes) — NEEDS prior [/SECTION]
   *   …
   *   [/SECTION]\n              <- outer close (from dfdDescriptionsTemplate)
   *
   * We insert [/SECTION]\n before each inner-type [SECTION] that is NOT
   * preceded by another [/SECTION].
   */
  private closeInnerSections(content: string): string {
    // We identify "inner type" section opens by the pattern:
    //   \n[SECTION]\nTITLE: <word that is NOT preceded by [/SECTION]\n>
    //
    // Simpler heuristic that works given our templates:
    // A type-level [SECTION] is always emitted at the start of a line and
    // is NOT directly preceded by [/SECTION]. Element-level [SECTION] blocks
    // are always emitted inside a type section and are always preceded by
    // content (the header text).
    //
    // We count nesting: the outer section counts as depth 1. Every [SECTION]
    // increments depth, every [/SECTION] decrements. When we see depth go
    // from 1 to 2 more than once, it's a type section. We want to close depth-2
    // sections before opening a new depth-2 section.
    //
    // For simplicity and robustness, we do a line-by-line pass.

    const lines = content.split("\n");
    const result: string[] = [];
    let depth = 0;
    let pendingTypeClose = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line === "[SECTION]") {
        depth++;
        if (depth === 2 && pendingTypeClose) {
          // Close the previous type section before opening a new one
          result.push("[/SECTION]", "");
          pendingTypeClose = false;
        }
        if (depth === 2) {
          pendingTypeClose = true;
        }
        result.push(line);
      } else if (line === "[/SECTION]") {
        if (depth === 2) {
          pendingTypeClose = false;
        }
        depth--;
        result.push(line);
      } else {
        result.push(line);
      }
    }

    return result.join("\n");
  }

  // ==================== TEMPLATE GETTERS ====================

  getHeaderTemplate(): string {
    return SDOC_TEMPLATES.header(this.ctx.lang);
  }

  getTocTemplate(): string {
    return SDOC_TEMPLATES.toc(this.ctx.lang);
  }

  getExecutiveSummaryTemplate(): string {
    return SDOC_TEMPLATES.executiveSummary(this.ctx.lang);
  }

  getApplicableRegulationsTemplate(): string {
    return SDOC_TEMPLATES.applicableRegulations(this.ctx.lang);
  }

  getRegulationEntryTemplate(): string {
    return SDOC_TEMPLATES.regulationEntry(this.ctx.lang);
  }

  getSystemOverviewTemplate(): string {
    return SDOC_TEMPLATES.systemOverview(this.ctx.lang);
  }

  getDfdTemplate(): string {
    return SDOC_TEMPLATES.dfd(this.ctx.lang);
  }

  getDfdDescriptionsTemplate(): string {
    return SDOC_TEMPLATES.dfdDescriptions(this.ctx.lang);
  }

  getDfdElementTypeHeaderTemplate(): string {
    return SDOC_TEMPLATES.dfdElementTypeHeader(this.ctx.lang);
  }

  getDfdElementEntryTemplate(): string {
    return SDOC_TEMPLATES.dfdElementEntry(this.ctx.lang);
  }

  getDfdDataFlowsHeaderTemplate(): string {
    return SDOC_TEMPLATES.dfdDataFlowsHeader(this.ctx.lang);
  }

  getDfdConnectionEntryTemplate(): string {
    return SDOC_TEMPLATES.dfdConnectionEntry(this.ctx.lang);
  }

  getAssetsTemplate(): string {
    return SDOC_TEMPLATES.assets(this.ctx.lang);
  }

  getAssetRowTemplate(): string {
    return SDOC_TEMPLATES.assetRow;
  }

  getThreatsHeaderTemplate(method: "per-element" | "per-interaction"): string {
    return SDOC_TEMPLATES.threatsHeader(this.ctx.lang, method);
  }

  getThreatsTableTemplate(): string {
    return SDOC_TEMPLATES.threatsTable(this.ctx.lang);
  }

  getThreatRowTemplate(): string {
    return SDOC_TEMPLATES.threatRow;
  }

  getRisksHeaderTemplate(method: "per-element" | "per-interaction"): string {
    return SDOC_TEMPLATES.risksHeader(this.ctx.lang, method);
  }

  getRisksTableTemplate(): string {
    return SDOC_TEMPLATES.risksTable(this.ctx.lang);
  }

  getAcceptedRisksTemplate(): string {
    return SDOC_TEMPLATES.acceptedRisks(this.ctx.lang);
  }

  getAppendixTemplate(): string {
    return SDOC_TEMPLATES.appendix(this.ctx.lang);
  }

  getFooterTemplate(): string {
    return SDOC_TEMPLATES.footer(this.ctx.lang);
  }

  getDfdElementOverviewTableTemplate(): string {
    return SDOC_EXTENDED_TEMPLATES.dfdElementOverviewTable(this.ctx.lang);
  }

  getElementOverviewRowTemplate(): string {
    return SDOC_EXTENDED_TEMPLATES.elementOverviewRow;
  }

  getDfdElementDetailedEntryTemplate(): string {
    return SDOC_EXTENDED_TEMPLATES.dfdElementDetailedEntry(this.ctx.lang);
  }

  getDfdConnectionDetailedEntryTemplate(): string {
    return SDOC_EXTENDED_TEMPLATES.dfdConnectionDetailedEntry(this.ctx.lang);
  }

  getPropertyGroupTemplate(): string {
    return SDOC_EXTENDED_TEMPLATES.propertyGroup(this.ctx.lang);
  }

  getPropertyEntryTemplate(): string {
    return SDOC_EXTENDED_TEMPLATES.propertyEntry;
  }

  getAssetElementRelationsTemplate(): string {
    return SDOC_EXTENDED_TEMPLATES.assetElementRelations(this.ctx.lang);
  }

  getAssetRelationSectionTemplate(): string {
    return SDOC_EXTENDED_TEMPLATES.assetRelationSection(this.ctx.lang);
  }

  getElementRelationEntryTemplate(): string {
    return SDOC_EXTENDED_TEMPLATES.elementRelationEntry(this.ctx.lang);
  }

  getNoAssetRelationsTemplate(): string {
    return SDOC_EXTENDED_TEMPLATES.noAssetRelations(this.ctx.lang);
  }

  // ==================== THREATS SECTION CLOSE ====================
  //
  // The threats/risks chapters open a [SECTION] in their header template
  // and must close it after all rows have been appended.
  // The base class's generateThreats() calls:
  //   1. getThreatsHeaderTemplate()  → opens [SECTION]
  //   2. getThreatsTableTemplate()   → transparent {{threatRows}} pass-through
  // and returns the concatenation. We override to append [/SECTION].

  protected override generateThreats(
    title: string,
    method: "per-element" | "per-interaction",
  ): ChapterContent {
    const result = super.generateThreats(title, method);
    if (!result.hasContent) return result;
    return { ...result, content: result.content + SECTION_CLOSE };
  }

  protected override generateRisks(
    title: string,
    method: "per-element" | "per-interaction",
  ): ChapterContent {
    const result = super.generateRisks(title, method);
    if (!result.hasContent) return result;
    return { ...result, content: result.content + SECTION_CLOSE };
  }

  // ==================== RISKS FIELD NAMES ====================
  //
  // The grammar uses different field names depending on language
  // (RISIKO_VORHER / RISIKO_NACHHER for DE, RISK_BEFORE / RISK_AFTER for EN).
  // We override getRiskRowTemplate to pick the right field names at runtime.

  override getRiskRowTemplate(): string {
    if (this.ctx.lang === "de") {
      return `[REQUIREMENT]
UID: RISK-{{threatId}}
STATUS: {{statusLabel}}
PRIORITY: {{moscowLabel}}
RISIKO_VORHER: {{riskBeforeLabel}}
RISIKO_NACHHER: {{riskAfterLabel}}
TITLE: Risiko für {{threatId}}
STATEMENT: {{threatDescription}}
MITIGATION: {{mitigations}}
RELATIONS:
- TYPE: Parent
  VALUE: {{threatId}}

`;
    }
    return SDOC_TEMPLATES.riskRow;
  }

  override getWontRiskRowTemplate(): string {
    if (this.ctx.lang === "de") {
      return `[REQUIREMENT]
UID: RISK-{{threatId}}
STATUS: Akzeptiert
PRIORITY: Wont
RISIKO_VORHER: {{riskBeforeLabel}}
TITLE: Akzeptiertes Risiko für {{threatId}}
STATEMENT: {{threatDescription}}
BEGRUENDUNG: {{justification}}
RELATIONS:
- TYPE: Parent
  VALUE: {{threatId}}

`;
    }
    return SDOC_TEMPLATES.wontRiskRow;
  }
}