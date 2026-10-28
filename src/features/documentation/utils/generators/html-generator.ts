// ==================== HTML DOCUMENT GENERATOR ====================
// Concrete implementation for HTML document generation
// Location: features/documentation/utils/generators/html-generator.ts

import type { DocConfiguration, DocProjectData } from "../../models/doc-types";
import {
  BaseDocumentGenerator,
  type TranslationFn,
  type ChapterContent,
} from "./base-generator";
import type { StatsTable } from "../threat-risk-stats";
import type { MethodologySection } from "../methodology-sections";
import type { AttackTreeReportSection } from "../attack-tree-report";
import type { ItemDefinitionReportSection } from "../item-definition-report";
import { HTML_TEMPLATES } from "../templates/html-templates";
import { replacePlaceholders, processConditionals } from "../templates";

export class HtmlGenerator extends BaseDocumentGenerator {
  constructor(
    project: DocProjectData,
    config: DocConfiguration,
    t: TranslationFn,
  ) {
    super(project, config, t);
  }

  // ==================== FORMAT INFO ====================

  getFormat(): string {
    return "html";
  }

  getFileExtension(): string {
    return "html";
  }

  // ==================== TEXT HANDLING ====================

  escapeTableText(text: string): string {
    return this.escapeHtml(text);
  }

  private escapeHtml(text: string): string {
    if (!text) return "";
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;")
      .replace(/\n/g, "<br>");
  }

  formatTagsGrouped(
    tagsByCategory: Array<{ categoryLabel: string; tags: string[] }>,
  ): string {
    if (tagsByCategory.length === 0) return "<p>-</p>";

    return tagsByCategory
      .map(({ categoryLabel, tags }) => {
        const categoryClass = this.getCategoryClass(categoryLabel);
        const tagSpans = tags
          .map(
            (tag) =>
              `<span class="tag ${categoryClass}">${this.escapeHtml(tag)}</span>`,
          )
          .join(" ");
        return `<div class="tag-group"><span class="tag-label">${this.escapeHtml(categoryLabel)}:</span> ${tagSpans}</div>`;
      })
      .join("\n");
  }

  private getCategoryClass(categoryLabel: string): string {
    const label = categoryLabel.toLowerCase();
    if (
      label.includes("domain") ||
      label.includes("branche") ||
      label.includes("industry")
    ) {
      return "tag-domain";
    }
    if (label.includes("platform") || label.includes("plattform")) {
      return "tag-platform";
    }
    if (label.includes("regulation") || label.includes("regulierung")) {
      return "tag-regulation";
    }
    return "tag-other";
  }

  formatClassification(text: string): string {
    const classification =
      this.ctx.config.template.classification || "internal";
    return `<span class="classification-badge classification-${classification}">${this.escapeHtml(text)}</span>`;
  }

  // ==================== OVERRIDE GENERATE ====================

  generate() {
    // Generate inner content first
    const chapters = this.generateAllChapters();

    let innerContent = "";
    innerContent += this.generateHeader();
    innerContent += this.generateToc(chapters);

    // Disabled chapters stay out (plan F6 — this loop used to check only
    // hasContent).
    for (const chapter of this.visibleChapters(chapters)) {
      innerContent += this.chapterAnchor(chapter.id) + chapter.content;
    }

    innerContent += this.generateFooter();

    // Wrap in document template
    const content = replacePlaceholders(
      HTML_TEMPLATES.documentWrapper(this.ctx.lang),
      {
        projectName: this.ctx.project.info.name,
        content: innerContent,
      },
    );

    return {
      content,
      format: this.getFormat(),
      filename: this.generateFilename(),
    };
  }

  // ==================== TOC ====================

  protected chapterAnchor(chapterId: string): string {
    return `<a id="chapter-${chapterId}"></a>\n`;
  }

  protected generateTocContent(chapters: ChapterContent[]): string {
    const tocItems: string[] = [];

    for (const chapter of this.visibleChapters(chapters)) {
      tocItems.push(
        replacePlaceholders(HTML_TEMPLATES.tocItem, {
          anchor: `chapter-${chapter.id}`,
          title: chapter.title,
        }),
      );
    }

    if (tocItems.length === 0) {
      return "";
    }

    return replacePlaceholders(this.getTocTemplate(), {
      tocContent: tocItems.join("\n"),
    });
  }

  // ==================== TEMPLATE GETTERS ====================

  getHeaderTemplate(): string {
    return HTML_TEMPLATES.header(this.ctx.lang);
  }

  getTocTemplate(): string {
    return HTML_TEMPLATES.toc(this.ctx.lang);
  }

  getExecutiveSummaryTemplate(): string {
    return HTML_TEMPLATES.executiveSummary(this.ctx.lang);
  }

  getApplicableRegulationsTemplate(): string {
    return HTML_TEMPLATES.applicableRegulations(this.ctx.lang);
  }

  getRegulationEntryTemplate(): string {
    return HTML_TEMPLATES.regulationEntry(this.ctx.lang);
  }

  getSystemOverviewTemplate(): string {
    return HTML_TEMPLATES.systemOverview(this.ctx.lang);
  }

  getDfdTemplate(): string {
    return HTML_TEMPLATES.dfd(this.ctx.lang);
  }

  formatDfdFigure(image: string | undefined, alt: string): string {
    return image
      ? `<img src="${image}" alt="${alt}" class="dfd-image">`
      : `<p class="dfd-no-image">${this.escapeHtml(this.noDfdImage())}</p>`;
  }

  formatReportGroup(title: string, body: string, summary?: string): string {
    return `<h3>${this.escapeHtml(title)}</h3>\n${summary ? `<p>${this.escapeHtml(summary)}</p>\n` : ""}${body}`;
  }

  // Methodology chapter (ISO/SAE 21434 conformance plan 0d)
  formatMethodologyChapter(title: string, intro: string, body: string): string {
    return `<section id="methodology">\n  <h2>${this.escapeHtml(title)}</h2>\n  <p>${this.escapeHtml(intro)}</p>\n${body}</section>\n\n`;
  }

  formatMethodologySection(section: MethodologySection): string {
    const cells = (tag: "th" | "td", list: string[]) =>
      list.map((c) => `<${tag}>${this.escapeHtml(c)}</${tag}>`).join("");
    return [
      `  <h3>${this.escapeHtml(section.title)}</h3>`,
      ...(section.intro ? [`  <p>${this.escapeHtml(section.intro)}</p>`] : []),
      "  <table>",
      `    <thead><tr>${cells("th", section.headers)}</tr></thead>`,
      "    <tbody>",
      ...section.rows.map((r) => `      <tr>${cells("td", r)}</tr>`),
      "    </tbody>",
      "  </table>",
    ].join("\n") + "\n";
  }

  // Attack-trees chapter (plan F5)
  formatItemDefinitionChapter(title: string, intro: string, body: string): string {
    return `<section id="item-definition">\n  <h2>${this.escapeHtml(title)}</h2>\n  <p>${this.escapeHtml(intro)}</p>\n${body}</section>\n\n`;
  }

  formatItemDefinitionSection(section: ItemDefinitionReportSection): string {
    const cells = (tag: "th" | "td", list: string[]) =>
      list.map((c) => `<${tag}>${this.escapeHtml(c)}</${tag}>`).join("");
    return [
      `  <h3>${this.escapeHtml(section.title)}</h3>`,
      ...section.paragraphs.map((p) => `  <p>${this.escapeHtml(p).replace(/\n/g, "<br>")}</p>`),
      ...(section.facts.length
        ? [
            `  <p>${section.facts
              .map(([label, value]) => `<strong>${this.escapeHtml(label)}</strong>: ${this.escapeHtml(value)}`)
              .join("<br>")}</p>`,
          ]
        : []),
      ...(section.table
        ? [
            "  <table>",
            `    <thead><tr>${cells("th", section.table.headers)}</tr></thead>`,
            "    <tbody>",
            ...section.table.rows.map((r) => `      <tr>${cells("td", r)}</tr>`),
            "    </tbody>",
            "  </table>",
          ]
        : []),
    ].join("\n") + "\n";
  }

  formatAttackTreesChapter(title: string, intro: string, body: string): string {
    return `<section id="attack-trees">\n  <h2>${this.escapeHtml(title)}</h2>\n  <p>${this.escapeHtml(intro)}</p>\n${body}</section>\n\n`;
  }

  formatAttackTreeSection(section: AttackTreeReportSection): string {
    const cells = (tag: "th" | "td", list: string[]) =>
      list.map((c) => `<${tag}>${this.escapeHtml(c)}</${tag}>`).join("");
    // Nested lists from the depth-annotated outline.
    const outline: string[] = [];
    let depth = -1;
    for (const item of section.outline) {
      if (item.depth > depth) {
        for (let d = depth; d < item.depth; d++) outline.push("<ul>");
      } else {
        outline.push("</li>");
        for (let d = item.depth; d < depth; d++) outline.push("</ul></li>");
      }
      outline.push(`<li>${this.escapeHtml(item.text)}`);
      depth = item.depth;
    }
    if (depth >= 0) {
      outline.push("</li>");
      for (let d = 0; d < depth; d++) outline.push("</ul></li>");
      outline.push("</ul>");
    }
    return [
      `  <h3>${this.escapeHtml(section.title)}</h3>`,
      ...(section.facts.length
        ? [
            `  <p>${section.facts
              .map(([label, value]) => `<strong>${this.escapeHtml(label)}</strong>: ${this.escapeHtml(value)}`)
              .join("<br>")}</p>`,
          ]
        : []),
      ...(outline.length
        ? [`  <h4>${this.escapeHtml(section.outlineTitle)}</h4>`, `  ${outline.join("")}`]
        : []),
      ...(section.rows.length
        ? [
            `  <h4>${this.escapeHtml(section.pathsTitle)}</h4>`,
            "  <table>",
            `    <thead><tr>${cells("th", section.headers)}</tr></thead>`,
            "    <tbody>",
            ...section.rows.map((r) => `      <tr>${cells("td", r)}</tr>`),
            "    </tbody>",
            "  </table>",
          ]
        : []),
    ].join("\n") + "\n";
  }

  formatStatsTable(table: StatsTable): string {
    const cells = (tag: "th" | "td", list: string[], strong = false) =>
      list.map((c) => `<${tag}>${strong ? `<strong>${this.escapeHtml(c)}</strong>` : this.escapeHtml(c)}</${tag}>`).join("");
    return [
      '<table class="stats-table">',
      `  <tr>${cells("th", table.headers)}</tr>`,
      ...table.rows.map((r) => `  <tr>${cells("td", r)}</tr>`),
      `  <tr>${cells("td", table.total, true)}</tr>`,
      "</table>",
    ].join("\n") + "\n";
  }

  getDfdDescriptionsTemplate(): string {
    return HTML_TEMPLATES.dfdDescriptions(this.ctx.lang);
  }

  getDfdElementTypeHeaderTemplate(): string {
    return HTML_TEMPLATES.dfdElementTypeHeader(this.ctx.lang);
  }

  getDfdElementEntryTemplate(): string {
    return HTML_TEMPLATES.dfdElementEntry(this.ctx.lang);
  }

  getDfdDataFlowsHeaderTemplate(): string {
    return HTML_TEMPLATES.dfdDataFlowsHeader(this.ctx.lang);
  }

  getDfdConnectionEntryTemplate(): string {
    return HTML_TEMPLATES.dfdConnectionEntry(this.ctx.lang);
  }

  getAssetsTemplate(): string {
    return HTML_TEMPLATES.assets(this.ctx.lang);
  }

  getAssetRowTemplate(): string {
    return HTML_TEMPLATES.assetRow;
  }

  getSecurityGoalsTemplate(): string {
    return HTML_TEMPLATES.securityGoals(this.ctx.lang);
  }

  getSecurityGoalRowTemplate(): string {
    return HTML_TEMPLATES.securityGoalRow;
  }

  getThreatsHeaderTemplate(method: "per-element" | "per-interaction"): string {
    return HTML_TEMPLATES.threatsHeader(this.ctx.lang, method);
  }

  getThreatsTableTemplate(): string {
    return HTML_TEMPLATES.threatsTable(this.ctx.lang);
  }

  getThreatRowTemplate(): string {
    return HTML_TEMPLATES.threatRow;
  }

  getAttackPathThreatsHeaderTemplate(): string {
    return HTML_TEMPLATES.attackPathThreatsHeader(this.ctx.lang);
  }

  getAttackPathThreatRowTemplate(): string {
    return HTML_TEMPLATES.attackPathThreatRow;
  }

  getRisksHeaderTemplate(method: "per-element" | "per-interaction"): string {
    return HTML_TEMPLATES.risksHeader(this.ctx.lang, method);
  }

  getAttackPathRisksHeaderTemplate(): string {
    return HTML_TEMPLATES.attackPathRisksHeader(this.ctx.lang);
  }

  getRisksTableTemplate(): string {
    return HTML_TEMPLATES.risksTable(this.ctx.lang);
  }

  getRiskRowTemplate(): string {
    return HTML_TEMPLATES.riskRow;
  }

  getSRSLHeaderTemplate(): string {
    return HTML_TEMPLATES.srslHeader(this.ctx.lang);
  }

  getSRSLTableTemplate(): string {
    return HTML_TEMPLATES.srslTable(this.ctx.lang);
  }

  getSRSLRowTemplate(): string {
    return HTML_TEMPLATES.srslRow;
  }

  getAcceptedRisksTemplate(): string {
    return HTML_TEMPLATES.acceptedRisks(this.ctx.lang);
  }

  getWontRiskRowTemplate(): string {
    return HTML_TEMPLATES.wontRiskRow;
  }

  getTraceabilityMatrixHeaderTemplate(): string {
    return HTML_TEMPLATES.traceabilityMatrixHeader(this.ctx.lang);
  }

  getTraceabilityMatrixTableTemplate(): string {
    return HTML_TEMPLATES.traceabilityMatrixTable(this.ctx.lang);
  }

  getTraceabilityRowTemplate(): string {
    return HTML_TEMPLATES.traceabilityRow;
  }

  getAppendixTemplate(): string {
    return HTML_TEMPLATES.appendix(this.ctx.lang);
  }

  getDfdElementOverviewTableTemplate(): string {
    return HTML_TEMPLATES.dfdElementOverviewTable(this.ctx.lang);
  }

  getElementOverviewRowTemplate(): string {
    return HTML_TEMPLATES.elementOverviewRow;
  }

  getDfdPageSectionTemplate(): string {
    return HTML_TEMPLATES.dfdPageSection;
  }

  getDfdParentLevelFlowsTemplate(): string {
    return HTML_TEMPLATES.dfdParentLevelFlows(this.ctx.lang);
  }

  getDfdParentLevelFlowRowTemplate(): string {
    return HTML_TEMPLATES.dfdParentLevelFlowRow;
  }

  getDfdElementOverviewPageTableTemplate(): string {
    return HTML_TEMPLATES.dfdElementOverviewPageTable(this.ctx.lang);
  }

  getDfdElementDetailedEntryTemplate(): string {
    return HTML_TEMPLATES.dfdElementDetailedEntry(this.ctx.lang);
  }

  getDfdConnectionDetailedEntryTemplate(): string {
    return HTML_TEMPLATES.dfdConnectionDetailedEntry(this.ctx.lang);
  }

  getPropertyGroupTemplate(): string {
    return HTML_TEMPLATES.propertyGroup(this.ctx.lang);
  }

  getPropertyEntryTemplate(): string {
    return HTML_TEMPLATES.propertyEntry;
  }

  getAssetElementRelationsTemplate(): string {
    return HTML_TEMPLATES.assetElementRelations(this.ctx.lang);
  }

  getAssetRelationSectionTemplate(): string {
    return HTML_TEMPLATES.assetRelationSection(this.ctx.lang);
  }

  getElementRelationEntryTemplate(): string {
    return HTML_TEMPLATES.elementRelationEntry(this.ctx.lang);
  }

  getNoAssetRelationsTemplate(): string {
    return HTML_TEMPLATES.noAssetRelations(this.ctx.lang);
  }

  getFooterTemplate(): string {
    return HTML_TEMPLATES.footer(this.ctx.lang);
  }
}
