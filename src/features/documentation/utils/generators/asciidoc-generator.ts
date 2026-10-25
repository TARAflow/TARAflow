// ==================== ASCIIDOC DOCUMENT GENERATOR ====================
// Concrete implementation for AsciiDoc document generation
// Location: features/documentation/utils/generators/asciidoc-generator.ts

import type { DocConfiguration, DocProjectData } from "../../models/doc-types";
import {
  BaseDocumentGenerator,
  type TranslationFn,
  type ChapterContent,
} from "./base-generator";
import type { StatsTable } from "../threat-risk-stats";
import type { MethodologySection } from "../methodology-sections";
import type { AttackTreeReportSection } from "../attack-tree-report";
import { ADOC_TEMPLATES } from "../templates/asciidoc-templates";
import { escapeAsciidoc, formatTagsGroupedAsciidoc } from "../templates";
import { ADOC_EXTENDED_TEMPLATES } from "../templates/asciidoc-templates-extended";
import type { PropertyGroup } from "./property-doc-mappers";

export class AsciidocGenerator extends BaseDocumentGenerator {
  constructor(
    project: DocProjectData,
    config: DocConfiguration,
    t: TranslationFn,
  ) {
    super(project, config, t);
  }

  // ==================== FORMAT INFO ====================

  getFormat(): string {
    return "asciidoc";
  }

  getFileExtension(): string {
    return "adoc";
  }

  // ==================== TEXT HANDLING ====================

  escapeTableText(text: string): string {
    return escapeAsciidoc(text);
  }

  formatTagsGrouped(
    tagsByCategory: Array<{ categoryLabel: string; tags: string[] }>,
  ): string {
    return formatTagsGroupedAsciidoc(tagsByCategory);
  }

  formatClassification(text: string): string {
    const classification =
      this.ctx.config.template.classification || "internal";
    return `[.${classification}]\n*${text}*`;
  }

  // ==================== TOC ====================

  protected generateTocContent(_chapters: ChapterContent[]): string {
    // AsciiDoc handles TOC via :toc: attribute in header
    return "";
  }

  // ==================== PROPERTY GROUPS (3-column table) ====================

  protected override formatPropertyGroups(groups: PropertyGroup[]): string {
    if (groups.length === 0) return "";

    const context = [groups[0]];
    const meta = groups.length > 1 ? groups[groups.length - 1] : undefined;
    const security = groups.slice(1, Math.max(1, groups.length - 1));

    const cell = (gs: PropertyGroup[]): string =>
      gs
        .flatMap((g) => this.getVisibleProperties(g))
        .map(
          (p) =>
            `*${this.escapeTableText(p.label)}*: ${this.escapeTableText(p.value)}`,
        )
        .join("<br>") || "—";

    let out =
      '[cols="1,1", options="header"]\n|===\n| Context | Security Controls\n\n' +
      `| ${cell(context)} | ${cell(security)}\n|===\n`;

    if (meta) {
      const metaProps = this.getVisibleProperties(meta)
        .map(
          (p) =>
            `*${this.escapeTableText(p.label)}*: ${this.escapeTableText(p.value)}`,
        )
        .join("<br>");
      if (metaProps) out += `\n*Meta*<br>${metaProps}\n`;
    }

    return out;
  }

  // ==================== TEMPLATE GETTERS ====================

  getHeaderTemplate(): string {
    return ADOC_TEMPLATES.header(this.ctx.lang);
  }

  getTocTemplate(): string {
    return ADOC_TEMPLATES.toc(this.ctx.lang);
  }

  getExecutiveSummaryTemplate(): string {
    return ADOC_TEMPLATES.executiveSummary(this.ctx.lang);
  }

  getApplicableRegulationsTemplate(): string {
    return ADOC_TEMPLATES.applicableRegulations(this.ctx.lang);
  }

  getRegulationEntryTemplate(): string {
    return ADOC_TEMPLATES.regulationEntry(this.ctx.lang);
  }

  getSystemOverviewTemplate(): string {
    return ADOC_TEMPLATES.systemOverview(this.ctx.lang);
  }

  getDfdTemplate(): string {
    return ADOC_TEMPLATES.dfd(this.ctx.lang);
  }

  formatDfdFigure(image: string | undefined, alt: string): string {
    return image ? `image::${image}[${alt}]` : `_${this.noDfdImage()}_`;
  }

  formatReportGroup(title: string, body: string, summary?: string): string {
    return `=== ${title}\n\n${summary ? `${summary}\n\n` : ""}${body}`;
  }

  // Methodology chapter (ISO/SAE 21434 conformance plan 0d)
  formatMethodologyChapter(title: string, intro: string, body: string): string {
    return `== ${title}\n\n${intro}\n\n${body}`;
  }

  formatMethodologySection(section: MethodologySection): string {
    const row = (cells: string[]) =>
      `| ${cells.map((c) => this.escapeTableText(c)).join(" | ")}`;
    return [
      `=== ${section.title}`,
      "",
      ...(section.intro ? [section.intro, ""] : []),
      `[cols="${section.headers.map(() => "1").join(",")}", options="header"]`,
      "|===",
      row(section.headers),
      "",
      ...section.rows.map(row),
      "|===",
    ].join("\n") + "\n\n";
  }

  // Attack-trees chapter (plan F5)
  formatAttackTreesChapter(title: string, intro: string, body: string): string {
    return `== ${title}\n\n${intro}\n\n${body}`;
  }

  formatAttackTreeSection(section: AttackTreeReportSection): string {
    const row = (cells: string[]) =>
      `| ${cells.map((c) => this.escapeTableText(c)).join(" | ")}`;
    const facts = section.facts.map(([label, value], i) =>
      `*${label}*: ${value}${i < section.facts.length - 1 ? " +" : ""}`,
    );
    return [
      `=== ${section.title}`,
      "",
      ...(facts.length ? [...facts, ""] : []),
      ...(section.outline.length
        ? [
            `.${section.outlineTitle}`,
            ...section.outline.map((o) => `${"*".repeat(o.depth + 1)} ${o.text}`),
            "",
          ]
        : []),
      ...(section.rows.length
        ? [
            `.${section.pathsTitle}`,
            `[cols="1,4,1,1,1", options="header"]`,
            "|===",
            row(section.headers),
            "",
            ...section.rows.map(row),
            "|===",
          ]
        : []),
    ].join("\n") + "\n\n";
  }

  formatStatsTable(table: StatsTable): string {
    const row = (cells: string[]) => `| ${cells.join(" | ")}`;
    return [
      `[cols="3,${table.headers.slice(1).map(() => "1").join(",")}", options="header"]`,
      "|===",
      row(table.headers),
      "",
      ...table.rows.map(row),
      row(table.total.map((c) => `*${c}*`)),
      "|===",
    ].join("\n") + "\n\n";
  }

  getDfdDescriptionsTemplate(): string {
    return ADOC_TEMPLATES.dfdDescriptions(this.ctx.lang);
  }

  getDfdElementTypeHeaderTemplate(): string {
    return ADOC_TEMPLATES.dfdElementTypeHeader(this.ctx.lang);
  }

  getDfdElementEntryTemplate(): string {
    return ADOC_TEMPLATES.dfdElementEntry(this.ctx.lang);
  }

  getDfdDataFlowsHeaderTemplate(): string {
    return ADOC_TEMPLATES.dfdDataFlowsHeader(this.ctx.lang);
  }

  getDfdConnectionEntryTemplate(): string {
    return ADOC_TEMPLATES.dfdConnectionEntry(this.ctx.lang);
  }

  getAssetsTemplate(): string {
    return ADOC_TEMPLATES.assets(this.ctx.lang);
  }

  getAssetRowTemplate(): string {
    return ADOC_TEMPLATES.assetRow;
  }

  getSecurityGoalsTemplate(): string {
    return ADOC_TEMPLATES.securityGoals(this.ctx.lang);
  }

  getSecurityGoalRowTemplate(): string {
    return ADOC_TEMPLATES.securityGoalRow;
  }

  getThreatsHeaderTemplate(method: "per-element" | "per-interaction"): string {
    return ADOC_TEMPLATES.threatsHeader(this.ctx.lang, method);
  }

  getThreatsTableTemplate(): string {
    return ADOC_TEMPLATES.threatsTable(this.ctx.lang);
  }

  getThreatRowTemplate(): string {
    return ADOC_TEMPLATES.threatRow;
  }

  getAttackPathThreatsHeaderTemplate(): string {
    return ADOC_TEMPLATES.attackPathThreatsHeader(this.ctx.lang);
  }

  getAttackPathThreatRowTemplate(): string {
    return ADOC_TEMPLATES.attackPathThreatRow;
  }

  getRisksHeaderTemplate(method: "per-element" | "per-interaction"): string {
    return ADOC_TEMPLATES.risksHeader(this.ctx.lang, method);
  }

  getAttackPathRisksHeaderTemplate(): string {
    return ADOC_TEMPLATES.attackPathRisksHeader(this.ctx.lang);
  }

  getRisksTableTemplate(): string {
    return ADOC_TEMPLATES.risksTable(this.ctx.lang);
  }

  getRiskRowTemplate(): string {
    return ADOC_TEMPLATES.riskRow;
  }

  getSRSLHeaderTemplate(): string {
    return ADOC_TEMPLATES.srslHeader(this.ctx.lang);
  }

  getSRSLTableTemplate(): string {
    return ADOC_TEMPLATES.srslTable(this.ctx.lang);
  }

  getSRSLRowTemplate(): string {
    return ADOC_TEMPLATES.srslRow;
  }

  getTraceabilityMatrixHeaderTemplate(): string {
    return ADOC_TEMPLATES.traceabilityMatrixHeader(this.ctx.lang);
  }

  getTraceabilityMatrixTableTemplate(): string {
    return ADOC_TEMPLATES.traceabilityMatrixTable(this.ctx.lang);
  }

  getTraceabilityRowTemplate(): string {
    return ADOC_TEMPLATES.traceabilityRow;
  }

  getAcceptedRisksTemplate(): string {
    return ADOC_TEMPLATES.acceptedRisks(this.ctx.lang);
  }

  getWontRiskRowTemplate(): string {
    return ADOC_TEMPLATES.wontRiskRow;
  }

  getAppendixTemplate(): string {
    return ADOC_TEMPLATES.appendix(this.ctx.lang);
  }

  getFooterTemplate(): string {
    return ADOC_TEMPLATES.footer(this.ctx.lang);
  }

  getDfdElementOverviewTableTemplate(): string {
    return ADOC_EXTENDED_TEMPLATES.dfdElementOverviewTable(this.ctx.lang);
  }

  getElementOverviewRowTemplate(): string {
    return ADOC_EXTENDED_TEMPLATES.elementOverviewRow;
  }

  getDfdPageSectionTemplate(): string {
    return ADOC_EXTENDED_TEMPLATES.dfdPageSection;
  }

  getDfdParentLevelFlowsTemplate(): string {
    return ADOC_EXTENDED_TEMPLATES.dfdParentLevelFlows(this.ctx.lang);
  }

  getDfdParentLevelFlowRowTemplate(): string {
    return ADOC_EXTENDED_TEMPLATES.dfdParentLevelFlowRow;
  }

  getDfdElementOverviewPageTableTemplate(): string {
    return ADOC_EXTENDED_TEMPLATES.dfdElementOverviewPageTable(this.ctx.lang);
  }

  getDfdElementDetailedEntryTemplate(): string {
    return ADOC_EXTENDED_TEMPLATES.dfdElementDetailedEntry(this.ctx.lang);
  }

  getDfdConnectionDetailedEntryTemplate(): string {
    return ADOC_EXTENDED_TEMPLATES.dfdConnectionDetailedEntry(this.ctx.lang);
  }

  getPropertyGroupTemplate(): string {
    return ADOC_EXTENDED_TEMPLATES.propertyGroup(this.ctx.lang);
  }

  getPropertyEntryTemplate(): string {
    return ADOC_EXTENDED_TEMPLATES.propertyEntry;
  }

  getAssetElementRelationsTemplate(): string {
    return ADOC_EXTENDED_TEMPLATES.assetElementRelations(this.ctx.lang);
  }

  getAssetRelationSectionTemplate(): string {
    return ADOC_EXTENDED_TEMPLATES.assetRelationSection(this.ctx.lang);
  }

  getElementRelationEntryTemplate(): string {
    return ADOC_EXTENDED_TEMPLATES.elementRelationEntry(this.ctx.lang);
  }

  getNoAssetRelationsTemplate(): string {
    return ADOC_EXTENDED_TEMPLATES.noAssetRelations(this.ctx.lang);
  }
}
