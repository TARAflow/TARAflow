// ==================== HTML DOCUMENT GENERATOR ====================
// Concrete implementation for HTML document generation
// Location: features/documentation/utils/generators/html-generator.ts

import type { DocConfiguration, DocProjectData } from "../../models/doc-types";
import {
  BaseDocumentGenerator,
  type TranslationFn,
  type ChapterContent,
} from "./base-generator";
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

    for (const chapter of chapters) {
      const chapterConfig = this.ctx.config.chapters.find(
        (c) => c.id === chapter.id,
      );
      if (chapterConfig && chapter.hasContent) {
        innerContent += chapter.content;
      }
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

  protected generateTocContent(chapters: ChapterContent[]): string {
    const tocItems: string[] = [];

    for (const chapter of chapters) {
      const chapterConfig = this.ctx.config.chapters.find(
        (c) => c.id === chapter.id,
      );
      if (chapterConfig && chapter.hasContent) {
        const anchor = chapter.title
          .toLowerCase()
          .replace(/[^a-z0-9äöüß]/g, "-")
          .replace(/-+/g, "-");
        tocItems.push(
          replacePlaceholders(HTML_TEMPLATES.tocItem, {
            anchor,
            title: chapter.title,
          }),
        );
      }
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

  getThreatsHeaderTemplate(method: "per-element" | "per-interaction"): string {
    return HTML_TEMPLATES.threatsHeader(this.ctx.lang, method);
  }

  getThreatsTableTemplate(): string {
    return HTML_TEMPLATES.threatsTable(this.ctx.lang);
  }

  getThreatRowTemplate(): string {
    return HTML_TEMPLATES.threatRow;
  }

  getRisksHeaderTemplate(method: "per-element" | "per-interaction"): string {
    return HTML_TEMPLATES.risksHeader(this.ctx.lang, method);
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

  getAppendixTemplate(): string {
    return HTML_TEMPLATES.appendix(this.ctx.lang);
  }

  getDfdElementOverviewTableTemplate(): string {
    return HTML_TEMPLATES.dfdElementOverviewTable(this.ctx.lang);
  }

  getElementOverviewRowTemplate(): string {
    return HTML_TEMPLATES.elementOverviewRow;
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
