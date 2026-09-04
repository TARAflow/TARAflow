// ==================== MARKDOWN DOCUMENT GENERATOR ====================
// Concrete implementation for Markdown document generation
// Location: features/documentation/utils/generators/markdown-generator.ts

import type { DocConfiguration, DocProjectData } from "../../models/doc-types";
import {
  BaseDocumentGenerator,
  type TranslationFn,
  type ChapterContent,
} from "./base-generator";
import { MD_TEMPLATES } from "../templates/markdown-templates";
import {
  escapeMarkdown,
  formatTagsGroupedMarkdown,
  replacePlaceholders,
} from "../templates";
import { MD_EXTENDED_TEMPLATES } from "../templates/markdown-templates-extended";
import type { PropertyGroup } from "./property-doc-mappers";

export class MarkdownGenerator extends BaseDocumentGenerator {
  constructor(
    project: DocProjectData,
    config: DocConfiguration,
    t: TranslationFn,
  ) {
    super(project, config, t);
  }

  // ==================== FORMAT INFO ====================

  getFormat(): string {
    return "markdown";
  }

  getFileExtension(): string {
    return "md";
  }

  // ==================== TEXT HANDLING ====================

  escapeTableText(text: string): string {
    return escapeMarkdown(text);
  }

  formatTagsGrouped(
    tagsByCategory: Array<{ categoryLabel: string; tags: string[] }>,
  ): string {
    return formatTagsGroupedMarkdown(tagsByCategory);
  }

  formatClassification(text: string): string {
    return `> **${text}**`;
  }

  // ==================== TOC ====================

  protected generateTocContent(chapters: ChapterContent[]): string {
    const tocLines: string[] = [];
    let chapterNum = 1;

    for (const chapter of chapters) {
      const chapterConfig = this.ctx.config.chapters.find(
        (c) => c.id === chapter.id,
      );
      if (chapterConfig && chapter.hasContent) {
        const anchor = chapter.title.toLowerCase().replace(/[^a-z0-9]/g, "-");
        tocLines.push(`${chapterNum}. [${chapter.title}](#${anchor})`);
        chapterNum++;
      }
    }

    if (tocLines.length === 0) {
      return "";
    }

    return replacePlaceholders(this.getTocTemplate(), {
      tocContent: tocLines.join("\n"),
    });
  }

  // ==================== PROPERTY GROUPS (3-column table) ====================

  protected override formatPropertyGroups(groups: PropertyGroup[]): string {
    if (groups.length === 0) return "";

    // Positional buckets: first = Context, last = Meta, the rest = Security Controls.
    // (Branches always emit basic → security → [technical] → additional.)
    const context = [groups[0]];
    const meta = groups.length > 1 ? groups[groups.length - 1] : undefined;
    const security = groups.slice(1, Math.max(1, groups.length - 1));

    const cell = (gs: PropertyGroup[]): string =>
      gs
        .flatMap((g) => this.getVisibleProperties(g))
        .map(
          (p) =>
            `**${this.escapeTableText(p.label)}**: ${this.escapeTableText(p.value)}`,
        )
        .join("<br>") || "—";

    let out =
      "| Context | Security Controls |\n|---|---|\n" +
      `| ${cell(context)} | ${cell(security)} |\n`;

    if (meta) {
      const metaProps = this.getVisibleProperties(meta)
        .map(
          (p) =>
            `**${this.escapeTableText(p.label)}**: ${this.escapeTableText(p.value)}`,
        )
        .join("<br>");
      if (metaProps) out += `\n**Meta**<br>${metaProps}\n`;
    }

    return out;
  }

  // ==================== TEMPLATE GETTERS ====================

  getHeaderTemplate(): string {
    return MD_TEMPLATES.header(this.ctx.lang);
  }

  getTocTemplate(): string {
    return MD_TEMPLATES.toc(this.ctx.lang);
  }

  getExecutiveSummaryTemplate(): string {
    return MD_TEMPLATES.executiveSummary(this.ctx.lang);
  }

  getApplicableRegulationsTemplate(): string {
    return MD_TEMPLATES.applicableRegulations(this.ctx.lang);
  }

  getRegulationEntryTemplate(): string {
    return MD_TEMPLATES.regulationEntry(this.ctx.lang);
  }

  getSystemOverviewTemplate(): string {
    return MD_TEMPLATES.systemOverview(this.ctx.lang);
  }

  getDfdTemplate(): string {
    return MD_TEMPLATES.dfd(this.ctx.lang);
  }

  getDfdDescriptionsTemplate(): string {
    return MD_TEMPLATES.dfdDescriptions(this.ctx.lang);
  }

  getDfdElementTypeHeaderTemplate(): string {
    return MD_TEMPLATES.dfdElementTypeHeader(this.ctx.lang);
  }

  getDfdElementEntryTemplate(): string {
    return MD_TEMPLATES.dfdElementEntry(this.ctx.lang);
  }

  getDfdDataFlowsHeaderTemplate(): string {
    return MD_TEMPLATES.dfdDataFlowsHeader(this.ctx.lang);
  }

  getDfdConnectionEntryTemplate(): string {
    return MD_TEMPLATES.dfdConnectionEntry(this.ctx.lang);
  }

  getAssetsTemplate(): string {
    return MD_TEMPLATES.assets(this.ctx.lang);
  }

  getAssetRowTemplate(): string {
    return MD_TEMPLATES.assetRow;
  }

  getThreatsHeaderTemplate(method: "per-element" | "per-interaction"): string {
    return MD_TEMPLATES.threatsHeader(this.ctx.lang, method);
  }

  getThreatsTableTemplate(): string {
    return MD_TEMPLATES.threatsTable(this.ctx.lang);
  }

  getThreatRowTemplate(): string {
    return MD_TEMPLATES.threatRow;
  }

  getRisksHeaderTemplate(method: "per-element" | "per-interaction"): string {
    return MD_TEMPLATES.risksHeader(this.ctx.lang, method);
  }

  getRisksTableTemplate(): string {
    return MD_TEMPLATES.risksTable(this.ctx.lang);
  }

  getRiskRowTemplate(): string {
    return MD_TEMPLATES.riskRow;
  }

  getSRSLHeaderTemplate(): string {
    return MD_TEMPLATES.srslHeader(this.ctx.lang);
  }

  getSRSLTableTemplate(): string {
    return MD_TEMPLATES.srslTable(this.ctx.lang);
  }

  getSRSLRowTemplate(): string {
    return MD_TEMPLATES.srslRow;
  }

  getAcceptedRisksTemplate(): string {
    return MD_TEMPLATES.acceptedRisks(this.ctx.lang);
  }

  getWontRiskRowTemplate(): string {
    return MD_TEMPLATES.wontRiskRow;
  }

  getAppendixTemplate(): string {
    return MD_TEMPLATES.appendix(this.ctx.lang);
  }

  getFooterTemplate(): string {
    return MD_TEMPLATES.footer(this.ctx.lang);
  }

  getDfdElementOverviewTableTemplate(): string {
    return MD_EXTENDED_TEMPLATES.dfdElementOverviewTable(this.ctx.lang);
  }

  getElementOverviewRowTemplate(): string {
    return MD_EXTENDED_TEMPLATES.elementOverviewRow;
  }

  getDfdElementDetailedEntryTemplate(): string {
    return MD_EXTENDED_TEMPLATES.dfdElementDetailedEntry(this.ctx.lang);
  }

  getDfdConnectionDetailedEntryTemplate(): string {
    return MD_EXTENDED_TEMPLATES.dfdConnectionDetailedEntry(this.ctx.lang);
  }

  getPropertyGroupTemplate(): string {
    return MD_EXTENDED_TEMPLATES.propertyGroup(this.ctx.lang);
  }

  getPropertyEntryTemplate(): string {
    return MD_EXTENDED_TEMPLATES.propertyEntry;
  }

  getAssetElementRelationsTemplate(): string {
    return MD_EXTENDED_TEMPLATES.assetElementRelations(this.ctx.lang);
  }

  getAssetRelationSectionTemplate(): string {
    return MD_EXTENDED_TEMPLATES.assetRelationSection(this.ctx.lang);
  }

  getElementRelationEntryTemplate(): string {
    return MD_EXTENDED_TEMPLATES.elementRelationEntry(this.ctx.lang);
  }

  getNoAssetRelationsTemplate(): string {
    return MD_EXTENDED_TEMPLATES.noAssetRelations(this.ctx.lang);
  }
}
