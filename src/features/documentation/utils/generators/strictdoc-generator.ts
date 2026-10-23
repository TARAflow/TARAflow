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
//      after all elements of that type have been rendered
//      (getDfdSubsectionCloseTemplate).
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
import type { StatsTable } from "../threat-risk-stats";
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

  // ==================== DFD DESCRIPTIONS ====================
  // Each element-type header and the data-flows header open a [SECTION];
  // the base generator closes it after the type's entries.

  override getDfdSubsectionCloseTemplate(): string {
    return SECTION_CLOSE;
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

  formatDfdFigure(image: string | undefined, alt: string): string {
    return image ? `.. image:: ${image}\n   :alt: ${alt}` : this.noDfdImage();
  }

  formatReportGroup(title: string, body: string, summary?: string): string {
    // A nested section inside the chapter's (closed after the content).
    const text = summary ? `[FREETEXT]\n${summary}\n[/FREETEXT]\n\n` : "";
    return `[SECTION]\nTITLE: ${title}\n\n${text}${body}[/SECTION]\n\n`;
  }

  formatStatsTable(table: StatsTable): string {
    // RST list-table in a section of its own (a section holds one free text).
    const row = (cells: string[]) =>
      cells.map((c, i) => `${i === 0 ? "   * - " : "     - "}${c}`).join("\n");
    return [
      "[SECTION]",
      `TITLE: ${table.title}`,
      "",
      "[FREETEXT]",
      ".. list-table::",
      "   :header-rows: 1",
      "",
      row(table.headers),
      ...table.rows.map(row),
      row(table.total.map((c) => `**${c}**`)),
      "[/FREETEXT]",
      "",
      "[/SECTION]",
    ].join("\n") + "\n\n";
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

  /**
   * The asset chapter stays open for the security-goal table that the base
   * generator appends ("Schutzziele" is its subsection, as in the other
   * formats); generateAssets closes it.
   */
  getAssetsTemplate(): string {
    return SDOC_TEMPLATES.assets(this.ctx.lang).replace(/\[\/SECTION\]\s*$/, "");
  }

  protected override generateAssets(title: string): ChapterContent {
    const result = super.generateAssets(title);
    return result.hasContent ? { ...result, content: result.content + SECTION_CLOSE } : result;
  }

  getAssetRowTemplate(): string {
    return SDOC_TEMPLATES.assetRow;
  }

  getSecurityGoalsTemplate(): string {
    return SDOC_TEMPLATES.securityGoals(this.ctx.lang);
  }

  getSecurityGoalRowTemplate(): string {
    return SDOC_TEMPLATES.securityGoalRow;
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

  getAttackPathThreatsHeaderTemplate(): string {
    return SDOC_TEMPLATES.attackPathThreatsHeader(this.ctx.lang);
  }

  getAttackPathThreatRowTemplate(): string {
    return SDOC_TEMPLATES.attackPathThreatRow;
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

  getDfdPageSectionTemplate(): string {
    return SDOC_EXTENDED_TEMPLATES.dfdPageSection;
  }

  getDfdParentLevelFlowsTemplate(): string {
    return SDOC_EXTENDED_TEMPLATES.dfdParentLevelFlows(this.ctx.lang);
  }

  getDfdParentLevelFlowRowTemplate(): string {
    return SDOC_EXTENDED_TEMPLATES.dfdParentLevelFlowRow;
  }

  getDfdElementOverviewPageTableTemplate(): string {
    return SDOC_EXTENDED_TEMPLATES.dfdElementOverviewPageTable(this.ctx.lang);
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

  getSRSLHeaderTemplate(): string {
    return SDOC_TEMPLATES.srslHeader(this.ctx.lang);
  }

  getSRSLTableTemplate(): string {
    return SDOC_TEMPLATES.srslTable(this.ctx.lang);
  }

  getSRSLRowTemplate(): string {
    return SDOC_TEMPLATES.srslRow;
  }

  getTraceabilityMatrixHeaderTemplate(): string {
    return SDOC_TEMPLATES.traceabilityMatrixHeader(this.ctx.lang);
  }

  getTraceabilityMatrixTableTemplate(): string {
    return SDOC_TEMPLATES.traceabilityMatrixTable(this.ctx.lang);
  }

  getTraceabilityRowTemplate(): string {
    return SDOC_TEMPLATES.traceabilityRow;
  }

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